const prisma = require('../config/db');
const { transaccion } = require('../config/db');
const { claveDestino, limpiarDestino } = require('../utils/destinos');
const { alcanceDeEscritura } = require('../utils/alcancePermisos');
const { AppError, NotFoundError, BadRequestError, ForbiddenError } = require('../errors/AppError');
const { buildMeta } = require('../utils/paginationHelper');

const { validarDocumento } = require('../utils/tipoDocumento');
const { reutilizarPersona } = require('./personaCompartida');
const { soloLoPedido } = require('../utils/respuestaMinima');

// Qué devuelve un alta por cada campo que llegó (spec 034).
const CAMPOS_DE_RESPUESTA = {
  firstName: ['firstName', 'name'], lastName: ['lastName', 'name'],
  docTypeId: ['docTypeId', 'docType'], docType: ['docTypeId', 'docType'], docNumber: ['docNumber'],
  phone: ['phone'], email: ['email'], birthDate: ['birthDate'], avatar: ['avatar'],
  destinations: ['destinations', 'recentDestination'],
};

/**
 * Reemplaza los destinos de preferencia del cliente y su copia `destino_reciente`
 * (spec 017). Único sitio que los escribe; `lista` ya viene normalizada por el esquema,
 * del más viejo al más nuevo.
 */
async function escribirDestinos(clienteId, entrada) {
  // Un destino que la agencia ya tiene escrito de otra forma ("pEreira" frente a
  // "Pereira") toma la escritura existente, la más antigua: así el destino es uno
  // solo en el filtro y en las sugerencias.
  const existentes = entrada.length ? await prisma.cliente_destinos.findMany({
    where: { OR: entrada.map(d => ({ destino: { equals: d, mode: 'insensitive' } })) },
    select: { destino: true },
    orderBy: { creado_at: 'asc' },
  }) : [];
  const canonico = new Map();
  for (const { destino } of existentes) {
    if (!canonico.has(claveDestino(destino))) canonico.set(claveDestino(destino), limpiarDestino(destino));
  }
  const lista = entrada.map(d => canonico.get(claveDestino(d)) ?? d);

  await transaccion(async (tx) => {
    await tx.cliente_destinos.deleteMany({ where: { cliente_id: clienteId } });
    if (lista.length) {
      await tx.cliente_destinos.createMany({
        data: lista.map((destino, i) => ({ cliente_id: clienteId, destino, orden: i + 1 })),
      });
    }
    await tx.clientes.update({ where: { id: clienteId }, data: { destino_reciente: lista.at(-1) ?? null } });
  });
  return lista;
}

const destinosOrdenados = { select: { destino: true }, orderBy: { orden: 'asc' } };
const destinosDe = (c) => (c.cliente_destinos || []).map(d => d.destino);

/**
 * Con alcance de ver 'own', el cliente es "suyo" si lo creó él (spec 019), igual que en
 * `listClients`. Es el alcance de VER, no el de la acción: las de escritura son booleanas.
 * Sin alcance (llamadas internas), no se restringe.
 */
const soloLosSuyos = (alcance = {}) =>
  (alcance.viewScope || alcance.permissionScope) === 'own' && Boolean(alcance.user);

/**
 * Para escribir: 404 si no existe, 403 si es de otro asesor (quien escribe ya tiene su
 * id). Manda el alcance de editar, con el tope del de ver (spec 020).
 */
function comprobarQueEsSuyo(cliente, alcance = {}) {
  if (!cliente) throw new NotFoundError('Cliente no encontrado');
  if (alcanceDeEscritura(alcance) === 'own' && alcance.user && cliente.creado_por_id !== alcance.user.id) {
    throw new ForbiddenError('No puede modificar un cliente de otro asesor');
  }
}

// Errores que la pantalla pinta junto a su campo (`error.details`).
const documentoRepetido = (mensaje) => new BadRequestError(mensaje, 'DUPLICATE_DOCUMENT', [{ field: 'docNumber', message: mensaje }]);

class ClientsService {
  /**
   * Obtener lista paginada y filtrada de clientes
   */
  async listClients({ pagination, search, status, permissionScope, user, sortBy, sortOrder, destination, destinationAll }) {
    const { page, perPage, skip } = pagination;

    // UN solo `where`, compartido por el count y por las filas.
    //
    // Antes esto era SQL crudo y cada filtro se escribía DOS veces: una para el
    // texto del SQL y otra para el `where` de Prisma que usaba el count. Es el
    // origen del error que más veces ha aparecido en este repo —una búsqueda sin
    // resultados que seguía informando de N registros—, y con un solo objeto ya
    // no puede ocurrir. Además queda cubierto por `pnpm check:prisma`, que no ve
    // dentro del SQL crudo.
    const where = {};
    if (permissionScope === 'own') where.creado_por_id = user.id;

    // El estado filtra siempre; la búsqueda de texto es la que se combina.
    if (status) where.personas = { status };

    if (search) {
      const como = { contains: search, mode: 'insensitive' };
      const porTexto = [
        { personas: { nombres: como } }, { personas: { apellidos: como } },
        { personas: { documento: como } }, { personas: { email: como } },
      ];
      // Un término que sean solo cifras busca además por el número de la
      // agencia, el que se ve en la lista. Sin esto el número serviría para
      // leerlo y para nada más: quien lo tiene apuntado no llegaría a la ficha.
      //
      // Va en el `OR` de la búsqueda, NO en el `where` de arriba: el alcance
      // `own` y el estado tienen que seguir aplicándose, o buscar por número
      // sería la forma de ver la ficha de un cliente que no te toca.
      if (/^\d+$/.test(search.trim())) porTexto.push({ numero: parseInt(search.trim(), 10) });
      where.OR = porTexto;
    }

    // Por defecto, el destino reciente; con `destinationAll`, cualquiera de los del
    // cliente (spec 017). Mismo `where` para la cuenta y las filas.
    if (destination) {
      const como = { contains: destination, mode: 'insensitive' };
      if (destinationAll) where.cliente_destinos = { some: { destino: como } };
      else where.destino_reciente = como;
    }

    const dir = sortOrder === 'desc' ? 'desc' : 'asc';
    // Ordenar por nombre ahora ordena por el nombre. El SQL anterior ordenaba
    // por `persona_id`, que es la clave ajena, no el nombre.
    const orderBy = sortBy === 'name' ? { personas: { nombres: dir } } : { fecha_registro: dir };

    const [total, filas] = await Promise.all([
      prisma.clientes.count({ where }),
      prisma.clientes.findMany({
        where,
        skip,
        take: perPage,
        orderBy,
        // Un JOIN, no una consulta por relación.
        relationLoadStrategy: 'join',
        select: {
          id: true,
          numero: true,
          fecha_registro: true,
          creado_por_id: true,
          destino_reciente: true,
          cliente_destinos: destinosOrdenados,
          personas: {
            select: {
              nombres: true, apellidos: true, documento: true, telefono: true,
              email: true, birth_date: true, status: true, avatar_url: true,
              tipos_documento: { select: { id: true, abreviatura: true } },
            },
          },
        },
      }),
    ]);

    const data = filas.map(c => ({
      id: c.id,
      numero: c.numero,
      firstName: c.personas.nombres,
      lastName: c.personas.apellidos,
      name: `${c.personas.nombres} ${c.personas.apellidos}`,
      docTypeId: c.personas.tipos_documento?.id ?? null,
      docType: c.personas.tipos_documento?.abreviatura || null,
      docNumber: c.personas.documento,
      phone: c.personas.telefono,
      email: c.personas.email,
      birthDate: c.personas.birth_date,
      status: c.personas.status,
      avatar: c.personas.avatar_url,
      registrationDate: c.fecha_registro,
      createdBy: c.creado_por_id,
      destinations: destinosDe(c),
      recentDestination: c.destino_reciente,
    }));

    return {
      data,
      meta: buildMeta(total, page, perPage),
    };
  }

  /**
   * Obtener cliente por ID
   */
  async getClientById(id, includeSales = false, alcance = {}) {
    // includeSales ya no arrastra las ventas: devuelve solo el resumen
    // (cuántas y cuánto suman). El historial se pide paginado con
    // GET /sales?clientId=:id, que es donde vive ese listado.
    const [cliente, resumen] = await Promise.all([
      // Al leer, el de otro asesor responde 404, como si no existiera (spec 019).
      prisma.clientes.findFirst({
        where: { id, ...(soloLosSuyos(alcance) ? { creado_por_id: alcance.user.id } : {}) },
        include: { personas: { include: { tipos_documento: true } }, empresas: true, cliente_destinos: destinosOrdenados }
      }),
      includeSales
        ? prisma.ventas.aggregate({
            // `deleted_at: null` es obligatorio: el borrado de ventas es lógico
            // y sin esto el importe acumulado del cliente seguía sumando las
            // que ya se habían borrado. `listSales` sí las excluye, así que el
            // resumen y el listado discrepaban.
            where: { cliente_id: id, deleted_at: null, status: { not: 'anulado' } },
            _count: { _all: true },
            _sum: { monto_total: true }
          })
        : null
    ]);

    if (!cliente) {
      throw new NotFoundError('Cliente no encontrado');
    }

    return {
      id: cliente.id,
      numero: cliente.numero,
      firstName: cliente.personas.nombres,
      lastName: cliente.personas.apellidos,
      name: `${cliente.personas.nombres} ${cliente.personas.apellidos}`,
      docTypeId: cliente.personas.tipos_documento?.id ?? null,
      docType: cliente.personas.tipos_documento?.abreviatura || null,
      docNumber: cliente.personas.documento,
      phone: cliente.personas.telefono,
      email: cliente.personas.email,
      birthDate: cliente.personas.birth_date,
      status: cliente.personas.status,
      avatar: cliente.personas.avatar_url,
      registrationDate: cliente.fecha_registro,
      createdBy: cliente.creado_por_id,
      destinations: destinosDe(cliente),
      recentDestination: cliente.destino_reciente,
      // La agencia a la que pertenece el cliente.
      //
      // Va el id Y el nombre, no solo el id. Un id suelto obligaría a quien
      // consume esto a resolverlo por su cuenta, y no puede: `/companies/:id`
      // es solo para el superadministrador, así que un asesor recibiría un
      // número que no hay forma de traducir. Devolver las dos cosas ahorra una
      // llamada que además no existiría.
      empresaId: cliente.empresa_id,
      empresaNombre: cliente.empresas?.nombre_comercial || cliente.empresas?.nombre || null,
      salesCount: resumen ? resumen._count._all : undefined,
      salesTotal: resumen ? (resumen._sum.monto_total || 0) : undefined
    };
  }

  /**
   * Crear nuevo cliente
   */
  async createClient(data, userId) {
    // El tipo por id o por texto, y la regla del número según él (spec 003, T4).
    const tipoDoc = await validarDocumento(data);
    const tipo_documento_id = tipoDoc ? tipoDoc.id : null;

    if (data.docNumber) {
      const existingClient = await prisma.clientes.findFirst({
        where: { personas: { documento: data.docNumber } },
        include: { personas: true }
      });
      if (existingClient && !existingClient.personas.deleted_at) {
        throw documentoRepetido('Este número de documento ya está registrado como cliente activo');
      }
    }

    const parsedBirthDate = data.birthDate && !isNaN(new Date(data.birthDate).getTime()) ? new Date(data.birthDate) : null;

    let { persona, aviso } = await reutilizarPersona(prisma, data.docNumber, {
      nombres: data.firstName, apellidos: data.lastName, tipo_documento_id,
      email: data.email, telefono: data.phone, avatar_url: data.avatar, birth_date: parsedBirthDate,
    });

    if (!persona) {
      persona = await prisma.personas.create({
        data: {
          nombres: data.firstName || '',
          apellidos: data.lastName || '',
          tipo_documento_id,
          documento: data.docNumber || null,
          email: data.email,
          telefono: data.phone,
          avatar_url: data.avatar || null,
          birth_date: parsedBirthDate,
          status: 'active'
        }
      });
    }

    const cliente = await prisma.clientes.create({
      data: { persona_id: persona.id, creado_por_id: userId },
      include: { personas: true }
    });
    const destinos = data.destinations?.length ? await escribirDestinos(cliente.id, data.destinations) : [];

    const ficha = {
      id: cliente.id,
      numero: cliente.numero,
      firstName: persona.nombres,
      lastName: persona.apellidos,
      name: `${persona.nombres} ${persona.apellidos}`,
      docTypeId: tipo_documento_id,
      docType: tipoDoc?.abreviatura || null,
      docNumber: data.docNumber,
      // Lo guardado, no lo del formulario: con una persona compartida se conservan sus datos (spec 024).
      phone: persona.telefono,
      email: persona.email,
      birthDate: persona.birth_date,
      avatar: persona.avatar_url,
      status: persona.status,
      registrationDate: cliente.fecha_registro,
      createdBy: cliente.creado_por_id,
      destinations: destinos,
      recentDestination: destinos.at(-1) ?? null,
    };
    // El id, el número y lo que se mandó, con lo guardado (spec 034): fecha de nacimiento, creador o
    // fecha de registro no viajan si el formulario no los trajo.
    return { ...soloLoPedido(ficha, data, CAMPOS_DE_RESPUESTA), numero: ficha.numero, aviso };
  }

  /**
   * Actualizar cliente existente
   */
  async updateClient(id, data, alcance = {}) {
    const cliente = await prisma.clientes.findUnique({
      where: { id },
      include: { personas: true }
    });
    comprobarQueEsSuyo(cliente, alcance);

    const personaData = {};
    if (data.firstName) personaData.nombres = data.firstName;
    if (data.lastName) personaData.apellidos = data.lastName;

    const tipoDoc = await validarDocumento(data);
    if (tipoDoc) personaData.tipo_documento_id = tipoDoc.id;

    if (data.docNumber) {
      const existingDoc = await prisma.personas.findFirst({
        where: { documento: data.docNumber }
      });
      if (existingDoc && existingDoc.id !== cliente.persona_id) {
        throw documentoRepetido('Este número de documento ya está asignado a otra persona de la agencia');
      }
      personaData.documento = data.docNumber;
    }

    if (data.email) personaData.email = data.email;
    if (data.phone) personaData.telefono = data.phone;
    if (data.avatar) personaData.avatar_url = data.avatar;
    if (data.birthDate && !isNaN(new Date(data.birthDate).getTime())) personaData.birth_date = new Date(data.birthDate);

    if (Object.keys(personaData).length > 0) {
      personaData.updated_at = new Date();
      await prisma.personas.update({
        where: { id: cliente.persona_id },
        data: personaData
      });
    }

    if (data.destinations) await escribirDestinos(cliente.id, data.destinations);

    return { message: 'Cliente actualizado' };
  }

  /**
   * Sugerencias de destino (spec 017): hasta 10 distintos de la agencia que contengan
   * el texto, los más usados primero. Sin alcance por asesor: solo el nombre del
   * destino, nunca el cliente; la RLS ya limita a la agencia.
   */
  async suggestDestinations(search) {
    const filas = await prisma.cliente_destinos.groupBy({
      by: ['destino'],
      where: search ? { destino: { contains: search, mode: 'insensitive' } } : {},
      _count: { destino: true },
      orderBy: [{ _count: { destino: 'desc' } }, { destino: 'asc' }],
      take: 50,
    });
    // `groupBy` separa "Pereira" de "pEreira" (y de escrituras guardadas antes de unificarlas):
    // se juntan por su clave, con la escritura más usada.
    const vistos = new Set();
    const unicos = [];
    for (const f of filas) {
      const clave = claveDestino(f.destino);
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      unicos.push(limpiarDestino(f.destino));
    }
    return unicos.slice(0, 10);
  }

  /**
   * Cambiar estado activo/inactivo
   */
  async toggleClientStatus(id, alcance = {}) {
    const cliente = await prisma.clientes.findUnique({
      where: { id },
      include: { personas: true }
    });
    comprobarQueEsSuyo(cliente, alcance);

    const newStatus = cliente.personas.status === 'active' ? 'inactive' : 'active';
    await prisma.personas.update({
      where: { id: cliente.persona_id },
      data: { status: newStatus, updated_at: new Date() }
    });

    return { status: newStatus };
  }
}

module.exports = new ClientsService();
