const prisma = require('../config/db');
const { success, error } = require('../utils/apiResponse');
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

exports.listAgents = async (req, res, next) => {
  try {
    const { page, perPage, skip } = req.pagination;
    const { search, status } = req.query;

    const where = {};
    if (status) where.status = status;
    if (search) {
      where.persona = {
        OR: [
          { nombres: { contains: search, mode: 'insensitive' } },
          { apellidos: { contains: search, mode: 'insensitive' } }
        ]
      };
    }

    let statusCondition = '';
    if (status) statusCondition = `AND c.status = '${status}'`;
    let searchCondition = '';
    if (search) {
      searchCondition = `AND (p.nombres ILIKE '%${search}%' OR p.apellidos ILIKE '%${search}%')`;
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
      email: a.email
    }));

    success(res, data, buildMeta(total, page, perPage));
  } catch (err) {
    next(err);
  }
};

exports.createAgent = async (req, res, next) => {
  try {
    const data = req.body;

    let tipoDocumentoId = null;
    if (data.docType) {
      const dt = await prisma.tiposDocumento.findUnique({ where: { abreviatura: data.docType } });
      if (dt) tipoDocumentoId = dt.id;
    }

    // Check if agent with this document already exists
    if (data.docNumber) {
      const existingAgent = await prisma.comisionistas.findFirst({
        where: { persona: { documento: data.docNumber } }
      });
      if (existingAgent) {
        return error(res, 'Este número de documento ya está registrado como comisionista', 400);
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
            tipoDocumentoId: tipoDocumentoId || existingPersona.tipoDocumentoId,
            email: data.email || existingPersona.email,
            telefono: data.phone || existingPersona.telefono,
            status: 'active',
            deletedAt: null
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
          tipoDocumentoId,
          documento: data.docNumber || null,
          email: data.email || null,
          telefono: data.phone || null
        }
      });
    }

    const agent = await prisma.comisionistas.create({
      data: {
        personaId: persona.id,
        tipo: data.type || null,
        umbralPago: parseFloat(data.paymentThreshold) || 0,
        acumulado: 0,
        status: data.status || 'Activo'
      },
      include: { persona: { include: { tipoDocumento: true } } }
    });

    success(res, {
      id: agent.id,
      name: `${agent.persona.nombres} ${agent.persona.apellidos}`.trim(),
      type: agent.tipo,
      docType: agent.persona.tipoDocumento?.abreviatura || '',
      docNumber: agent.persona.documento || '',
      status: agent.status,
      accumulated: agent.acumulado,
      paymentThreshold: agent.umbralPago,
      phone: agent.persona.telefono,
      email: agent.persona.email
    }, null, 201);
  } catch (err) {
    next(err);
  }
};

exports.updateAgent = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const data = req.body;
    const agent = await prisma.comisionistas.findUnique({
      where: { id },
      include: { persona: { include: { tipoDocumento: true } } }
    });
    if (!agent) return error(res, 'Comisionista no encontrado', 404);

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
        if (existingDoc && existingDoc.id !== agent.personaId) {
          return error(res, 'Este número de documento ya está asignado a otra persona en el sistema', 400);
        }
      }
      personaUpdate.documento = data.docNumber;
    }

    if (data.phone !== undefined) personaUpdate.telefono = data.phone;
    if (data.email !== undefined) personaUpdate.email = data.email;

    if (data.docType) {
      const dt = await prisma.tiposDocumento.findUnique({ where: { abreviatura: data.docType } });
      if (dt) personaUpdate.tipoDocumentoId = dt.id;
    }

    if (Object.keys(personaUpdate).length > 0) {
      personaUpdate.updatedAt = new Date();
      await prisma.personas.update({
        where: { id: agent.personaId },
        data: personaUpdate
      });
    }

    if (data.type !== undefined) await prisma.comisionistas.update({ where: { id }, data: { tipo: data.type } });
    if (data.status !== undefined) await prisma.comisionistas.update({ where: { id }, data: { status: data.status } });
    if (data.paymentThreshold !== undefined) {
      await prisma.comisionistas.update({ where: { id }, data: { umbralPago: parseFloat(data.paymentThreshold) || 0 } });
    }

    success(res, { message: 'Comisionista actualizado' });
  } catch (err) {
    next(err);
  }
};

exports.deleteAgent = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.comisionistas.delete({ where: { id } });
    success(res, { message: 'Comisionista eliminado' });
  } catch (err) {
    next(err);
  }
};

exports.listSettlements = async (req, res, next) => {
  try {
    const { page, perPage, skip } = req.pagination;
    const { agentId, dateFrom, dateTo } = req.query;

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
      prisma.liquidacionesComision.count({ where }),
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

    success(res, data, buildMeta(total, page, perPage));
  } catch (err) {
    next(err);
  }
};

exports.createSettlement = async (req, res, next) => {
  try {
    const data = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const metodoPagoId = data.paymentMethod ? parseInt(data.paymentMethod) : null;

      const settlement = await tx.liquidacionesComision.create({
        data: {
          comisionistaId: data.agentId,
          fecha: data.date ? new Date(data.date) : new Date(),
          monto: data.amount,
          metodoPagoId,
          referencia: data.reference || null,
          notas: data.notes || null
        }
      });

      if (data.salesIds && data.salesIds.length > 0) {
        for (const ventaId of data.salesIds) {
          await tx.liquidacionVentas.create({
            data: { liquidacionId: settlement.id, ventaId }
          });
          await tx.ventas.update({
            where: { id: ventaId },
            data: { comisionLiquidada: true }
          });
        }
      }

      const fullSettlement = await tx.liquidacionesComision.findUnique({
        where: { id: settlement.id },
        include: {
          comisionista: { include: { persona: true } },
          metodoPago: true,
        }
      });

      const date = fullSettlement.fecha;
      const dateStr = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : null;

      return {
        id: fullSettlement.id,
        agentId: fullSettlement.comisionistaId,
        agentName: `${fullSettlement.comisionista.persona.nombres} ${fullSettlement.comisionista.persona.apellidos}`.trim(),
        amount: fullSettlement.monto,
        date: dateStr,
        paymentMethod: fullSettlement.metodoPago?.nombre || null,
        reference: fullSettlement.referencia,
        notes: fullSettlement.notas,
        salesIds: data.salesIds || [],
      };
    });

    success(res, result, null, 201);
  } catch (err) {
    next(err);
  }
};
