const prisma = require('../config/db');
const { NotFoundError, BadRequestError, ForbiddenError } = require('../errors/AppError');
const { buildMeta } = require('../utils/paginationHelper');
const { validarDocumento } = require('../utils/tipoDocumento');
const { reutilizarPersona } = require('./personaCompartida');
const { alcanceDeEscritura } = require('../utils/alcancePermisos');
const { soloLoPedido } = require('../utils/respuestaMinima');

/**
 * Con alcance de ver 'own', los suyos son los que creó (spec 026), como en clientes.
 * Sin alcance (llamadas internas), no se restringe.
 */
const soloLosSuyos = (alcance = {}) =>
  (alcance.viewScope || alcance.permissionScope) === 'own' && Boolean(alcance.user);

/** Para escribir: 404 si no existe, 403 si es de otro. Manda el alcance de la acción, con el tope del de ver. */
function comprobarQueEsSuyo(responsable, alcance = {}) {
  if (!responsable || responsable.deleted_at) throw new NotFoundError('Responsable no encontrado');
  if (alcanceDeEscritura(alcance) === 'own' && alcance.user && responsable.creado_por_id !== alcance.user.id) {
    throw new ForbiddenError('No puede modificar un responsable de otro usuario');
  }
}

/** Qué devuelve `updateResponsable` por cada campo que llegó: el mismo nombre de la ficha (spec 033). */
const CAMPOS_DE_RESPUESTA = {
  firstName: ['firstName', 'name'], lastName: ['lastName', 'name'],
  docTypeId: ['docTypeId', 'docType'], docType: ['docTypeId', 'docType'], docNumber: ['docNumber'],
  phone: ['phone'], email: ['email'], status: ['status'],
};

/** No se desactiva a quien debe: suma lo pendiente de sus ventas a crédito vigentes. */
async function comprobarSinDeuda(id) {
  const [fila] = await prisma.$queryRaw`
    SELECT SUM(v.monto_total - COALESCE(v.monto_pagado_credito, 0)) AS "deuda"
    FROM ventas v
    WHERE v.responsable_id = ${id} AND v.status IN ('credito', 'abonado') AND v.deleted_at IS NULL`;
  const deuda = Number(fila?.deuda) || 0;
  if (deuda > 0) {
    throw new BadRequestError(`No se puede desactivar: El responsable tiene una deuda de $${deuda.toLocaleString('es-CO')}`);
  }
}

class ResponsablesService {
  /**
   * Listar responsables con paginación y búsqueda
   */
  async listResponsables({ pagination, search, status, sortBy, sortOrder, ...alcance }) {
    const { page, perPage, skip } = pagination;
    // Un solo constructor de filtros para el count y para el SQL: antes el
    // count ignoraba el search y la paginación devolvía totales falsos.
    const filtros = [];
    const params = [];
    const push = (sql, ...valores) => {
      filtros.push(sql.replace(/\?/g, () => `$${params.push(valores.shift())}`));
    };

    // El filtro se escribe UNA vez. Antes cada condición se duplicaba: el texto
    // del SQL para las filas y un objeto `where` de Prisma para el count. Ese
    // par que hay que mantener a mano es el origen del error recurrente del
    // repo (el count sin el filtro). Como esta consulta no puede dejar de ser
    // cruda —`deudaTotal` es un SUM correlacionado—, la solución es que el
    // count también sea crudo y comparta el mismo `whereSql` y los mismos
    // parámetros. Así no hay dos versiones que puedan discrepar.
    if (search) {
      const q = `%${search}%`;
      // Si el término son solo cifras, se busca también por el número de la
      // agencia: es el que aparece en la lista, y si no se pudiera buscar por
      // él no sería un identificador, sería un adorno.
      const comoNumero = /^\d+$/.test(search.trim()) ? parseInt(search.trim(), 10) : null;
      push(
        `(p.nombres ILIKE ? OR p.apellidos ILIKE ? OR p.documento ILIKE ? OR p.email ILIKE ?${comoNumero !== null ? ' OR r.numero = ?' : ''})`,
        ...(comoNumero !== null ? [q, q, q, q, comoNumero] : [q, q, q, q]),
      );
    }
    if (status) {
      push('r.status = ?::"UserStatus"', status);
    }
    if (soloLosSuyos(alcance)) {
      push('r.creado_por_id = ?', alcance.user.id);
    }

    const whereSql = filtros.length ? 'AND ' + filtros.join(' AND ') : '';

    const sortFieldMapSQL = {
      'creadoAt': 'r.creado_at',
      'name': 'p.nombres',
      'date': 'r.creado_at'
    };
    const sqlOrderBy = sortFieldMapSQL[sortBy] || 'r.creado_at';
    const orderDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';

    // Dos consultas EN PARALELO, no una con COUNT(*) OVER().
    //
    // Se probó doblar el total dentro de la consulta de filas con una función de
    // ventana. Reduce el número de consultas pero NO el tiempo: las dos ya se
    // solapan en Promise.all, así que el viaje que cuenta es uno igual. Y con la
    // ventana, una página vacía no devuelve total y hay que contar aparte, esta
    // vez en serie: medido, 441ms -> 440ms con resultados, pero 520ms -> 892ms
    // en una búsqueda sin coincidencias. Menos consultas no es menos latencia.
    const [totalRows, responsablesRaw] = await prisma.transaccion(async (tx) => {
      return Promise.all([
        // Mismo FROM y mismo WHERE que las filas, con los mismos parámetros.
        tx.$queryRawUnsafe(`
          SELECT COUNT(*)::int AS total
          FROM responsables r
          JOIN personas p ON r.persona_id = p.id
          WHERE r.deleted_at IS NULL ${whereSql}
        `, ...params),
        tx.$queryRawUnsafe(`
          SELECT 
            r.id,
            r.numero,
            r.creado_at as "creadoAt",
            p.id as "persona_id",
            p.nombres as "firstName",
            p.apellidos as "lastName",
            p.documento as "docNumber",
            p.telefono as "phone",
            p.email,
            p.birth_date as "birthDate",
            r.status,
            r.creado_por_id as "createdBy",
            td.id as "docTypeId",
            td.nombre as "docType",
            COALESCE(
              (SELECT SUM(v.monto_total - COALESCE(v.monto_pagado_credito, 0))
               FROM ventas v
               WHERE v.responsable_id = r.id AND v.status IN ('credito', 'abonado')), 0
            ) as "deudaTotal"
          FROM responsables r
          JOIN personas p ON r.persona_id = p.id
          LEFT JOIN tipos_documento td ON p.tipo_documento_id = td.id
          WHERE r.deleted_at IS NULL ${whereSql}
          ORDER BY ${sqlOrderBy} ${orderDirection}
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `, ...params, perPage, skip)
      ]);
    });

    const data = responsablesRaw.map(r => ({
      id: r.id,
      numero: r.numero,
      persona_id: r.persona_id,
      firstName: r.firstName,
      lastName: r.lastName,
      name: `${r.firstName} ${r.lastName}`,
      docTypeId: r.docTypeId || null,
      docType: r.docType || null,
      docNumber: r.docNumber,
      phone: r.phone,
      email: r.email,
      birthDate: r.birthDate,
      status: r.status,
      creadoAt: r.creadoAt,
      createdBy: r.createdBy,
      deudaTotal: parseFloat(r.deudaTotal)
    }));

    return {
      data,
      meta: buildMeta(Number(totalRows[0]?.total || 0), page, perPage)
    };
  }

  /**
   * Obtener responsable por ID
   */
  async getResponsableById(id, includeSales = false, alcance = {}) {
    // La deuda se suma en SQL sobre TODAS sus ventas a crédito, igual que en el
    // listado. Antes se traían 50 ventas para sumarlas aquí, así que con más de
    // 50 el total salía corto; y el array de ventas que devolvía no lo usaba
    // nadie: el modal pide las suyas paginadas con GET /sales?responsableId=.
    const [responsable, resumen] = await Promise.all([
      prisma.responsables.findFirst({
        where: { id, ...(soloLosSuyos(alcance) ? { creado_por_id: alcance.user.id } : {}) },
        include: { personas: { include: { tipos_documento: true } } }
      }),
      includeSales
        ? prisma.ventas.aggregate({
            where: {
              responsable_id: id,
              status: { in: ['credito', 'abonado'] },
              deleted_at: null,
            },
            _count: { _all: true },
            _sum: { monto_total: true, monto_pagado_credito: true },
          })
        : null,
    ]);

    if (!responsable || responsable.deleted_at) {
      throw new NotFoundError('Responsable no encontrado');
    }

    const deudaTotal = resumen
      ? (resumen._sum.monto_total || 0) - (resumen._sum.monto_pagado_credito || 0)
      : 0;

    return {
      id: responsable.id,
      numero: responsable.numero,
      persona_id: responsable.personas.id,
      firstName: responsable.personas.nombres,
      lastName: responsable.personas.apellidos,
      name: `${responsable.personas.nombres} ${responsable.personas.apellidos}`,
      docTypeId: responsable.personas.tipos_documento?.id || null,
      docType: responsable.personas.tipos_documento?.nombre || null,
      docNumber: responsable.personas.documento,
      phone: responsable.personas.telefono,
      email: responsable.personas.email,
      birthDate: responsable.personas.birth_date,
      status: responsable.status,
      creadoAt: responsable.creado_at,
      createdBy: responsable.creado_por_id,
      deudaTotal,
      salesCount: resumen ? resumen._count._all : undefined,
    };
  }

  /**
   * Crear responsable
   */
  async createResponsable(data, userId = null) {
    const { firstName, lastName, docNumber, phone, email } = data;

    const tipo = await validarDocumento(data);
    const docTypeId = tipo ? tipo.id : null;

    const result = await prisma.transaccion(async (tx) => {
      const previo = docNumber
        ? await tx.responsables.findFirst({ where: { personas: { documento: docNumber } } })
        : null;
      if (previo && !previo.deleted_at) {
        throw new BadRequestError('Ya existe un responsable con este documento');
      }

      // Si el documento ya es de otra persona de la agencia, se conservan sus datos (spec 024).
      let { persona, aviso } = await reutilizarPersona(tx, docNumber, {
        nombres: firstName, apellidos: lastName, tipo_documento_id: docTypeId, telefono: phone, email,
      });
      if (!persona) {
        persona = await tx.personas.create({
          data: {
            nombres: firstName,
            apellidos: lastName,
            tipo_documento_id: docTypeId || null,
            documento: docNumber || null,
            telefono: phone,
            email: email
          }
        });
      }

      // Un responsable dado de baja con ese documento se revive en vez de crear otro, y pasa a
      // ser de quien lo revive: si no, con alcance 'own' recibiría un 201 por algo que no ve.
      const responsable = previo
        ? await tx.responsables.update({ where: { id: previo.id }, data: { deleted_at: null, status: 'active', creado_por_id: userId } })
        : await tx.responsables.create({ data: { persona_id: persona.id, status: 'active', creado_por_id: userId } });

      // El id y el número visible (spec 034): la fila cruda llevaba `empresa_id`, `persona_id` y el creador.
      return { id: responsable.id, numero: responsable.numero, aviso };
    });

    return result;
  }

  /**
   * Actualizar responsable
   */
  async updateResponsable(id, data, alcance = {}) {
    const { firstName, lastName, docNumber, phone, email, status } = data;

    const tipo = await validarDocumento(data);
    const docTypeId = tipo ? tipo.id : null;

    const responsable = await prisma.responsables.findUnique({
      where: { id },
      include: { personas: true }
    });
    comprobarQueEsSuyo(responsable, alcance);

    if (status === 'inactive' && responsable.status === 'active') await comprobarSinDeuda(id);

    if (docNumber && docNumber !== responsable.personas.documento) {
      const existingPersona = await prisma.personas.findFirst({ where: { documento: docNumber } });
      if (existingPersona && existingPersona.id !== responsable.persona_id) {
        throw new BadRequestError('El documento ya está registrado en otra persona');
      }
    }

    await prisma.transaccion(async (tx) => {
      // Solo lo que llegó (spec 033): la persona es compartida por documento (spec 024), y un campo
      // ausente no es "vaciarlo". El tipo, igual: `null` aquí borraba el de la persona.
      await tx.personas.update({
        where: { id: responsable.persona_id },
        data: {
          nombres: firstName,
          apellidos: lastName,
          ...(tipo ? { tipo_documento_id: docTypeId } : {}),
          documento: docNumber,
          telefono: phone,
          email: email
        }
      });
      await tx.responsables.update({
        where: { id },
        data: {
          status: status || responsable.status
        }
      });
    });

    // Solo lo que se pidió cambiar, ya guardado y normalizado (spec 033): la ficha entera (deuda,
    // creador, fechas) no viaja en la respuesta de una edición.
    return soloLoPedido(await this.getResponsableById(id), data, CAMPOS_DE_RESPUESTA);
  }

  /**
   * Activar o desactivar (spec 033). Solo el estado: no toca a la persona, y responde solo lo que
   * cambió, no la ficha con sus datos personales.
   */
  async setStatus(id, status, alcance = {}) {
    const responsable = await prisma.responsables.findUnique({ where: { id } });
    comprobarQueEsSuyo(responsable, alcance);
    if (status === 'inactive' && responsable.status === 'active') await comprobarSinDeuda(id);
    await prisma.responsables.update({ where: { id }, data: { status } });
    return { id, status };
  }

  /**
   * Eliminar responsable (soft delete)
   */
  async deleteResponsable(id, alcance = {}) {
    const responsable = await prisma.responsables.findUnique({ where: { id } });
    comprobarQueEsSuyo(responsable, alcance);

    await prisma.responsables.update({
      where: { id },
      data: { deleted_at: new Date() }
    });

    return { message: 'Responsable eliminado exitosamente' };
  }
}

module.exports = new ResponsablesService();
