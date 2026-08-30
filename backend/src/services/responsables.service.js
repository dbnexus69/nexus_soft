const prisma = require('../config/db');
const { NotFoundError, BadRequestError } = require('../errors/AppError');
const { buildMeta } = require('../utils/paginationHelper');

class ResponsablesService {
  /**
   * Listar responsables con paginación y búsqueda
   */
  async listResponsables({ pagination, search, status, sortBy, sortOrder }) {
    const { page, perPage, skip } = pagination;
    // Un solo constructor de filtros para el count y para el SQL: antes el
    // count ignoraba el search y la paginación devolvía totales falsos.
    const filtros = [];
    const params = [];
    const push = (sql, ...valores) => {
      filtros.push(sql.replace(/\?/g, () => `$${params.push(valores.shift())}`));
    };

    const where = { deleted_at: null };
    if (search) {
      const q = `%${search}%`;
      push('(p.nombres ILIKE ? OR p.apellidos ILIKE ? OR p.documento ILIKE ? OR p.email ILIKE ?)', q, q, q, q);
      const como = { contains: search, mode: 'insensitive' };
      where.personas = {
        OR: [{ nombres: como }, { apellidos: como }, { documento: como }, { email: como }]
      };
    }
    if (status) {
      push('r.status = ?::"UserStatus"', status);
      where.status = status;
    }

    const whereSql = filtros.length ? 'AND ' + filtros.join(' AND ') : '';

    const sortFieldMapSQL = {
      'creadoAt': 'r.creado_at',
      'name': 'p.nombres',
      'date': 'r.creado_at'
    };
    const sqlOrderBy = sortFieldMapSQL[sortBy] || 'r.creado_at';
    const orderDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';

    const [total, responsablesRaw] = await Promise.all([
      prisma.responsables.count({ where }),
      prisma.$queryRawUnsafe(`
        SELECT 
          r.id,
          r.creado_at as "creadoAt",
          p.id as "persona_id",
          p.nombres as "firstName",
          p.apellidos as "lastName",
          p.documento as "docNumber",
          p.telefono as "phone",
          p.email,
          p.birth_date as "birthDate",
          r.status,
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

    const data = responsablesRaw.map(r => ({
      id: r.id,
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
      deudaTotal: parseFloat(r.deudaTotal)
    }));

    return {
      data,
      meta: buildMeta(total, page, perPage)
    };
  }

  /**
   * Obtener responsable por ID
   */
  async getResponsableById(id, includeSales = false) {
    const responsable = await prisma.responsables.findUnique({
      where: { id },
      include: {
        personas: { include: { tipos_documento: true } },
        ventas: includeSales ? {
          where: { status: { in: ['credito', 'abonado'] } },
          orderBy: { creadoAt: 'desc' },
          take: 50
        } : false
      }
    });

    if (!responsable || responsable.deleted_at) {
      throw new NotFoundError('Responsable no encontrado');
    }

    let deudaTotal = 0;
    let ventasDetalladas = [];
    if (includeSales && responsable.ventas) {
      ventasDetalladas = responsable.ventas.map(v => {
        const saldoPendiente = v.montoTotal - (v.montoPagadoCredito || 0);
        deudaTotal += saldoPendiente;
        return {
          id: v.id,
          date: v.creadoAt,
          montoTotal: v.montoTotal,
          montoPagadoCredito: v.montoPagadoCredito || 0,
          saldoPendiente,
          status: v.status
        };
      });
    }

    return {
      id: responsable.id,
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
      creadoAt: responsable.creadoAt,
      deudaTotal,
      ventas: ventasDetalladas
    };
  }

  /**
   * Crear responsable
   */
  async createResponsable(data) {
    const { firstName, lastName, docType, docTypeId: rawDocTypeId, docNumber, phone, email } = data;

    let docTypeId = rawDocTypeId ? parseInt(rawDocTypeId) : null;
    if (!docTypeId && docType) {
      const tipoDoc = await prisma.tipos_documento.findFirst({ where: { nombre: docType } });
      docTypeId = tipoDoc ? tipoDoc.id : null;
    }

    const result = await prisma.$transaction(async (tx) => {
      let personas = docNumber ? await tx.personas.findFirst({
        where: { documento: docNumber }
      }) : null;

      if (!personas) {
        personas = await tx.personas.create({
          data: {
            nombres: firstName,
            apellidos: lastName,
            tipo_documento_id: docTypeId || null,
            documento: docNumber || null,
            telefono: phone,
            email: email
          }
        });
      } else {
        const existingResponsable = await tx.responsables.findFirst({
          where: { persona_id: personas.id }
        });
        if (existingResponsable) {
          if (!existingResponsable.deleted_at) {
            throw new BadRequestError('Ya existe un responsable con este documento');
          } else {
            await tx.responsables.update({
              where: { id: existingResponsable.id },
              data: { deleted_at: null, status: 'active' }
            });
            await tx.personas.update({
              where: { id: personas.id },
              data: {
                nombres: firstName,
                apellidos: lastName,
                tipo_documento_id: docTypeId || personas.tipo_documento_id,
                telefono: phone || personas.telefono,
                email: email || personas.email
              }
            });
            return existingResponsable;
          }
        }
        await tx.personas.update({
          where: { id: personas.id },
          data: {
            nombres: firstName,
            apellidos: lastName,
            tipo_documento_id: docTypeId || personas.tipo_documento_id,
            telefono: phone || personas.telefono,
            email: email || personas.email
          }
        });
      }

      const responsable = await tx.responsables.create({
        data: {
          persona_id: personas.id,
          status: 'active'
        }
      });

      return responsable;
    });

    return result;
  }

  /**
   * Actualizar responsable
   */
  async updateResponsable(id, data) {
    const { firstName, lastName, docType, docTypeId: rawDocTypeId, docNumber, phone, email, status } = data;

    let docTypeId = rawDocTypeId ? parseInt(rawDocTypeId) : null;
    if (!docTypeId && docType) {
      const tipoDoc = await prisma.tipos_documento.findFirst({ where: { nombre: docType } });
      docTypeId = tipoDoc ? tipoDoc.id : null;
    }

    const responsable = await prisma.responsables.findUnique({
      where: { id },
      include: { personas: true }
    });
    if (!responsable || responsable.deleted_at) {
      throw new NotFoundError('Responsable no encontrado');
    }

    if (status === 'inactive' && responsable.status === 'active') {
      const debtCheck = await prisma.$queryRawUnsafe(`
        SELECT SUM(v.monto_total - COALESCE(v.monto_pagado_credito, 0)) as "deuda"
        FROM ventas v
        WHERE v.responsable_id = $1 AND v.status IN ('credito', 'abonado')
      `, id);
      const pendingDebt = Number(debtCheck[0]?.deuda) || 0;
      if (pendingDebt > 0) {
        throw new BadRequestError(`No se puede desactivar: El responsable tiene una deuda de $${pendingDebt.toLocaleString('es-CO')}`);
      }
    }

    if (docNumber && docNumber !== responsable.personas.documento) {
      const existingPersona = await prisma.personas.findFirst({ where: { documento: docNumber } });
      if (existingPersona && existingPersona.id !== responsable.persona_id) {
        throw new BadRequestError('El documento ya está registrado en otra persona');
      }
    }

    await prisma.$transaction([
      prisma.personas.update({
        where: { id: responsable.persona_id },
        data: {
          nombres: firstName,
          apellidos: lastName,
          tipo_documento_id: docTypeId,
          documento: docNumber,
          telefono: phone,
          email: email
        }
      }),
      prisma.responsables.update({
        where: { id },
        data: {
          status: status || responsable.status
        }
      })
    ]);

    // Return the updated responsable using getResponsableById to get consistent formatting
    const updatedResponsable = await this.getResponsableById(id);
    return updatedResponsable;
  }

  /**
   * Eliminar responsable (soft delete)
   */
  async deleteResponsable(id) {
    const responsable = await prisma.responsables.findUnique({ where: { id } });
    if (!responsable || responsable.deleted_at) {
      throw new NotFoundError('Responsable no encontrado');
    }

    await prisma.responsables.update({
      where: { id },
      data: { deleted_at: new Date() }
    });

    return { message: 'Responsable eliminado exitosamente' };
  }
}

module.exports = new ResponsablesService();
