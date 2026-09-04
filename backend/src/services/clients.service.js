const prisma = require('../config/db');
const { NotFoundError, BadRequestError } = require('../errors/AppError');
const { buildMeta } = require('../utils/paginationHelper');

class ClientsService {
  /**
   * Obtener lista paginada y filtrada de clientes
   */
  async listClients({ pagination, search, status, permissionScope, user, sortBy, sortOrder }) {
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

    const personas = {};
    if (search) {
      const como = { contains: search, mode: 'insensitive' };
      personas.OR = [
        { nombres: como }, { apellidos: como }, { documento: como }, { email: como },
      ];
    }
    if (status) personas.status = status;
    if (Object.keys(personas).length) where.personas = personas;

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
          fecha_registro: true,
          creado_por_id: true,
          personas: {
            select: {
              nombres: true, apellidos: true, documento: true, telefono: true,
              email: true, birth_date: true, status: true, avatar_url: true,
              tipos_documento: { select: { abreviatura: true } },
            },
          },
        },
      }),
    ]);

    const data = filas.map(c => ({
      id: c.id,
      firstName: c.personas.nombres,
      lastName: c.personas.apellidos,
      name: `${c.personas.nombres} ${c.personas.apellidos}`,
      docType: c.personas.tipos_documento?.abreviatura || null,
      docNumber: c.personas.documento,
      phone: c.personas.telefono,
      email: c.personas.email,
      birthDate: c.personas.birth_date,
      status: c.personas.status,
      avatar: c.personas.avatar_url,
      registrationDate: c.fecha_registro,
      createdBy: c.creado_por_id,
    }));

    return {
      data,
      meta: buildMeta(total, page, perPage),
    };
  }

  /**
   * Obtener cliente por ID
   */
  async getClientById(id, includeSales = false) {
    // includeSales ya no arrastra las ventas: devuelve solo el resumen
    // (cuántas y cuánto suman). El historial se pide paginado con
    // GET /sales?clientId=:id, que es donde vive ese listado.
    const [cliente, resumen] = await Promise.all([
      prisma.clientes.findUnique({
        where: { id },
        include: { personas: { include: { tipos_documento: true } } }
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
      firstName: cliente.personas.nombres,
      lastName: cliente.personas.apellidos,
      name: `${cliente.personas.nombres} ${cliente.personas.apellidos}`,
      docType: cliente.personas.tipos_documento?.abreviatura || null,
      docNumber: cliente.personas.documento,
      phone: cliente.personas.telefono,
      email: cliente.personas.email,
      birthDate: cliente.personas.birth_date,
      status: cliente.personas.status,
      avatar: cliente.personas.avatar_url,
      registrationDate: cliente.fecha_registro,
      createdBy: cliente.creado_por_id,
      salesCount: resumen ? resumen._count._all : undefined,
      salesTotal: resumen ? (resumen._sum.monto_total || 0) : undefined
    };
  }

  /**
   * Crear nuevo cliente
   */
  async createClient(data, userId) {
    let tipo_documento_id = null;

    if (data.docType) {
      const tipoDoc = await prisma.tipos_documento.findUnique({
        where: { abreviatura: data.docType }
      });
      if (tipoDoc) tipo_documento_id = tipoDoc.id;
    }

    if (data.docNumber) {
      const existingClient = await prisma.clientes.findFirst({
        where: { personas: { documento: data.docNumber } },
        include: { personas: true }
      });
      if (existingClient && !existingClient.personas.deleted_at) {
        throw new BadRequestError('Este número de documento ya está registrado como cliente activo');
      }
    }

    let persona;
    if (data.docNumber) {
      const existingPersona = await prisma.personas.findUnique({
        where: { documento: data.docNumber }
      });
      if (existingPersona) {
        persona = await prisma.personas.update({
          where: { id: existingPersona.id },
          data: {
            nombres: data.firstName || existingPersona.nombres,
            apellidos: data.lastName || existingPersona.apellidos,
            tipo_documento_id: tipo_documento_id || existingPersona.tipo_documento_id,
            email: data.email || existingPersona.email,
            telefono: data.phone || existingPersona.telefono,
            avatar_url: data.avatar || existingPersona.avatar_url,
            birth_date: data.birthDate && !isNaN(new Date(data.birthDate).getTime()) ? new Date(data.birthDate) : existingPersona.birth_date,
            status: 'active',
            deleted_at: null
          }
        });
      }
    }

    const parsedBirthDate = data.birthDate && !isNaN(new Date(data.birthDate).getTime()) ? new Date(data.birthDate) : null;

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

    return {
      id: cliente.id,
      firstName: persona.nombres,
      lastName: persona.apellidos,
      name: `${persona.nombres} ${persona.apellidos}`,
      docType: data.docType,
      docNumber: data.docNumber,
      phone: data.phone,
      email: data.email,
      birthDate: data.birthDate,
      avatar: persona.avatar_url,
      status: 'active',
      registrationDate: cliente.fecha_registro,
      createdBy: cliente.creado_por_id
    };
  }

  /**
   * Actualizar cliente existente
   */
  async updateClient(id, data) {
    const cliente = await prisma.clientes.findUnique({
      where: { id },
      include: { personas: true }
    });

    if (!cliente) {
      throw new NotFoundError('Cliente no encontrado');
    }

    const personaData = {};
    if (data.firstName) personaData.nombres = data.firstName;
    if (data.lastName) personaData.apellidos = data.lastName;

    if (data.docType) {
      const tipoDoc = await prisma.tipos_documento.findUnique({
        where: { abreviatura: data.docType }
      });
      if (tipoDoc) personaData.tipo_documento_id = tipoDoc.id;
    }

    if (data.docNumber) {
      const existingDoc = await prisma.personas.findUnique({
        where: { documento: data.docNumber }
      });
      if (existingDoc && existingDoc.id !== cliente.persona_id) {
        throw new BadRequestError('Este número de documento ya está asignado a otra persona en el sistema');
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

    return { message: 'Cliente actualizado' };
  }

  /**
   * Cambiar estado activo/inactivo
   */
  async toggleClientStatus(id) {
    const cliente = await prisma.clientes.findUnique({
      where: { id },
      include: { personas: true }
    });

    if (!cliente) {
      throw new NotFoundError('Cliente no encontrado');
    }

    const newStatus = cliente.personas.status === 'active' ? 'inactive' : 'active';
    await prisma.personas.update({
      where: { id: cliente.persona_id },
      data: { status: newStatus, updated_at: new Date() }
    });

    return { status: newStatus };
  }

  /**
   * Actualizar avatar de cliente
   */
  async uploadAvatar(id, file) {
    if (!file) {
      throw new BadRequestError('Archivo requerido');
    }

    const cliente = await prisma.clientes.findUnique({ where: { id } });
    if (!cliente) {
      throw new NotFoundError('Cliente no encontrado');
    }

    const avatarUrl = `/uploads/${file.filename}`;
    await prisma.personas.update({
      where: { id: cliente.persona_id },
      data: { avatarUrl }
    });

    return { avatarUrl };
  }
}

module.exports = new ClientsService();
