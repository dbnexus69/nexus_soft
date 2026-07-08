const prisma = require('../config/db');
const { NotFoundError, BadRequestError } = require('../errors/AppError');
const { buildMeta } = require('../utils/paginationHelper');
const { formatName } = require('../utils/stringUtils');

const splitFullName = (fullName) => {
  const parts = fullName ? fullName.trim().split(/\s+/) : [];
  let firstName = fullName || '';
  let lastName = '';
  if (parts.length > 1) {
    if (parts.length === 2) {
      firstName = parts[0];
      lastName = parts[1];
    } else if (parts.length === 3) {
      firstName = parts.slice(0, 2).join(' ');
      lastName = parts[2];
    } else {
      firstName = parts.slice(0, 2).join(' ');
      lastName = parts.slice(2).join(' ');
    }
  }
  return { firstName, lastName };
};

class CommissionsService {
  async listAgents({ pagination, search, status }) {
    const { page, perPage, skip } = pagination;
    const where = {};
    if (status) where.status = status;

    let statusCondition = '';
    if (status) statusCondition = `AND c.status = '${status.replace(/'/g, "''")}'`;
    let searchCondition = '';
    if (search) {
      const cleanSearch = search.replace(/'/g, "''");
      searchCondition = `AND (p.nombres ILIKE '%${cleanSearch}%' OR p.apellidos ILIKE '%${cleanSearch}%')`;
    }

    const [total, agentsRaw] = await Promise.all([
      prisma.comisionistas.count({ where }),
      prisma.$queryRawUnsafe(`
        SELECT 
          c.id,
          c.tipo as "type",
          c.status,
          c.acumulado as "accumulated",
          c.umbral_pago as "paymentThreshold",
          p.nombres as "firstName",
          p.apellidos as "lastName",
          p.telefono as "phone",
          p.email,
          p.documento as "docNumber",
          p.avatar_url as "avatar",
          td.abreviatura as "docType"
        FROM comisionistas c
        JOIN personas p ON c.persona_id = p.id
        LEFT JOIN tipos_documento td ON p.tipo_documento_id = td.id
        WHERE 1=1 ${statusCondition} ${searchCondition}
        ORDER BY c.id DESC
        LIMIT ${perPage} OFFSET ${skip}
      `)
    ]);

    const data = agentsRaw.map(a => ({
      id: a.id,
      name: `${a.firstName} ${a.lastName}`.trim(),
      type: a.type,
      docType: a.docType || '',
      docNumber: a.docNumber || '',
      status: a.status,
      accumulated: a.accumulated,
      paymentThreshold: a.paymentThreshold,
      phone: a.phone,
      email: a.email,
      avatar: a.avatar || null
    }));

    return {
      data,
      meta: buildMeta(total, page, perPage)
    };
  }

  async createAgent(data) {
    let tipo_documento_id = null;
    if (data.docType) {
      const dt = await prisma.tipos_documento.findUnique({ where: { abreviatura: data.docType } });
      if (dt) tipo_documento_id = dt.id;
    }

    if (data.docNumber) {
      const existingAgent = await prisma.comisionistas.findFirst({
        where: { personas: { documento: data.docNumber } },
        include: { personas: true }
      });
      if (existingAgent && !existingAgent.personas.deleted_at) {
        throw new BadRequestError('Este número de documento ya está registrado como comisionista activo');
      }
    }

    let persona;
    if (data.docNumber) {
      const existingPersona = await prisma.personas.findUnique({
        where: { documento: data.docNumber }
      });
      if (existingPersona) {
        const { firstName, lastName } = splitFullName(data.name || `${existingPersona.nombres} ${existingPersona.apellidos}`);
        persona = await prisma.personas.update({
          where: { id: existingPersona.id },
          data: {
            nombres: formatName(firstName) || existingPersona.nombres,
            apellidos: formatName(lastName) || existingPersona.apellidos,
            tipo_documento_id: tipo_documento_id || existingPersona.tipo_documento_id,
            email: data.email || existingPersona.email,
            telefono: data.phone || existingPersona.telefono,
            avatar_url: data.avatar || existingPersona.avatar_url,
            status: 'active',
            deleted_at: null
          }
        });
      }
    }

    if (!persona) {
      const { firstName, lastName } = splitFullName(data.name);
      persona = await prisma.personas.create({
        data: {
          nombres: formatName(firstName),
          apellidos: formatName(lastName),
          tipo_documento_id: tipo_documento_id,
          documento: data.docNumber || null,
          email: data.email || null,
          telefono: data.phone || null,
          avatar_url: data.avatar || null
        }
      });
    }

    const agent = await prisma.comisionistas.create({
      data: {
        persona_id: persona.id,
        tipo: data.type || null,
        umbral_pago: parseFloat(data.paymentThreshold) || 0,
        acumulado: 0,
        status: data.status || 'Activo'
      },
      include: { personas: { include: { tipos_documento: true } } }
    });

    return {
      id: agent.id,
      name: `${agent.personas.nombres} ${agent.personas.apellidos}`.trim(),
      type: agent.tipo,
      docType: agent.personas.tipos_documento?.abreviatura || '',
      docNumber: agent.personas.documento || '',
      status: agent.status,
      accumulated: agent.acumulado,
      paymentThreshold: agent.umbral_pago,
      phone: agent.personas.telefono,
      email: agent.personas.email,
      avatar: agent.personas.avatar_url || null
    };
  }

  async updateAgent(id, data) {
    const agent = await prisma.comisionistas.findUnique({
      where: { id },
      include: { personas: { include: { tipos_documento: true } } }
    });
    if (!agent) {
      throw new NotFoundError('Comisionista no encontrado');
    }

    const personaUpdate = {};
    if (data.name) {
      const { firstName, lastName } = splitFullName(data.name);
      personaUpdate.nombres = formatName(firstName);
      personaUpdate.apellidos = formatName(lastName);
    }

    if (data.docNumber !== undefined) {
      if (data.docNumber) {
        const existingDoc = await prisma.personas.findUnique({
          where: { documento: data.docNumber }
        });
        if (existingDoc && existingDoc.id !== agent.persona_id) {
          throw new BadRequestError('Este número de documento ya está asignado a otra persona en el sistema');
        }
      }
      personaUpdate.documento = data.docNumber;
    }

    if (data.phone !== undefined) personaUpdate.telefono = data.phone;
    if (data.email !== undefined) personaUpdate.email = data.email;
    if (data.avatar !== undefined) personaUpdate.avatar_url = data.avatar;

    if (data.docType) {
      const dt = await prisma.tipos_documento.findUnique({ where: { abreviatura: data.docType } });
      if (dt) personaUpdate.tipo_documento_id = dt.id;
    }

    if (Object.keys(personaUpdate).length > 0) {
      personaUpdate.updatedAt = new Date();
      await prisma.personas.update({
        where: { id: agent.persona_id },
        data: personaUpdate
      });
    }

    if (data.type !== undefined) await prisma.comisionistas.update({ where: { id }, data: { tipo: data.type } });
    if (data.status !== undefined) await prisma.comisionistas.update({ where: { id }, data: { status: data.status } });
    if (data.paymentThreshold !== undefined) {
      await prisma.comisionistas.update({ where: { id }, data: { umbral_pago: parseFloat(data.paymentThreshold) || 0 } });
    }

    return { message: 'Comisionista actualizado' };
  }

  async deleteAgent(id) {
    const agent = await prisma.comisionistas.findUnique({ where: { id } });
    if (!agent) {
      throw new NotFoundError('Comisionista no encontrado');
    }
    await prisma.comisionistas.delete({ where: { id } });
    return { message: 'Comisionista eliminado' };
  }

  async listSettlements({ pagination, agentId, dateFrom, dateTo }) {
    const { page, perPage, skip } = pagination;
    const where = {};
    if (agentId) where.comisionistaId = parseInt(agentId);
    if (dateFrom || dateTo) {
      where.fecha = {};
      if (dateFrom) where.fecha.gte = new Date(dateFrom);
      if (dateTo) where.fecha.lte = new Date(dateTo);
    }

    let agentCondition = '';
    if (agentId) agentCondition = `AND lc.comisionista_id = ${parseInt(agentId)}`;

    let dateCondition = '';
    if (dateFrom) dateCondition += ` AND lc.fecha >= '${new Date(dateFrom).toISOString()}'`;
    if (dateTo) dateCondition += ` AND lc.fecha <= '${new Date(dateTo).toISOString()}'`;

    const [total, settlementsRaw] = await Promise.all([
      prisma.liquidaciones_comision.count({ where }),
      prisma.$queryRawUnsafe(`
        SELECT 
          lc.id,
          lc.comisionista_id as "agentId",
          lc.monto as "amount",
          lc.fecha as "date",
          lc.referencia as "reference",
          lc.notas as "notes",
          p.nombres as "firstName",
          p.apellidos as "lastName",
          mp.nombre as "paymentMethod",
          COALESCE((
            SELECT json_agg(lv.venta_id)
            FROM liquidacion_ventas lv WHERE lv.liquidacion_id = lc.id
          ), '[]'::json) as "salesIds"
        FROM liquidaciones_comision lc
        JOIN comisionistas c ON lc.comisionista_id = c.id
        JOIN personas p ON c.persona_id = p.id
        LEFT JOIN metodos_pago mp ON lc.metodo_pago_id = mp.id
        WHERE 1=1 ${agentCondition} ${dateCondition}
        ORDER BY lc.creado_at DESC
        LIMIT ${perPage} OFFSET ${skip}
      `)
    ]);

    const data = settlementsRaw.map(s => {
      const d = s.date;
      const dateStr = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;

      return {
        id: s.id,
        agentId: s.agentId,
        agentName: `${s.firstName} ${s.lastName}`.trim(),
        amount: s.amount,
        date: dateStr,
        paymentMethod: s.paymentMethod || null,
        reference: s.reference,
        notes: s.notes,
        salesIds: s.salesIds || []
      };
    });

    return {
      data,
      meta: buildMeta(total, page, perPage)
    };
  }

  async createSettlement(data) {
    return await prisma.$transaction(async (tx) => {
      const metodo_pago_id = data.paymentMethod ? parseInt(data.paymentMethod) : null;

      const settlement = await tx.liquidaciones_comision.create({
        data: {
          comisionista_id: data.agentId,
          fecha: data.date ? new Date(data.date) : new Date(),
          monto: data.amount,
          metodo_pago_id: metodo_pago_id,
          referencia: data.reference || null,
          notas: data.notes || null
        }
      });

      if (data.salesIds && data.salesIds.length > 0) {
        for (const venta_id of data.salesIds) {
          await tx.liquidacion_ventas.create({
            data: { liquidacion_id: settlement.id, venta_id: venta_id }
          });
          await tx.ventas.update({
            where: { id: venta_id },
            data: { comision_liquidada: true }
          });
        }
      }

      const fullSettlement = await tx.liquidaciones_comision.findUnique({
        where: { id: settlement.id },
        include: {
          comisionistas: { include: { personas: true } },
          metodos_pago: true,
        }
      });

      const date = fullSettlement.fecha;
      const dateStr = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : null;

      return {
        id: fullSettlement.id,
        agentId: fullSettlement.comisionista_id,
        agentName: `${fullSettlement.comisionistas.personas.nombres} ${fullSettlement.comisionistas.personas.apellidos}`.trim(),
        amount: fullSettlement.monto,
        date: dateStr,
        paymentMethod: fullSettlement.metodos_pago?.nombre || null,
        reference: fullSettlement.referencia,
        notes: fullSettlement.notas,
        salesIds: data.salesIds || [],
      };
    });
  }
}

module.exports = new CommissionsService();
