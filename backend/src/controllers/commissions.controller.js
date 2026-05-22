const prisma = require('../config/db');
const { success, error } = require('../utils/apiResponse');
const { buildMeta } = require('../utils/paginationHelper');

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

    const [total, agents] = await Promise.all([
      prisma.comisionistas.count({ where }),
      prisma.comisionistas.findMany({
        where,
        skip,
        take: perPage,
        include: { persona: { include: { tipoDocumento: true } } }
      })
    ]);

    const data = agents.map(a => ({
      id: a.id,
      name: `${a.persona.nombres} ${a.persona.apellidos}`.trim(),
      type: a.tipo,
      docType: a.persona.tipoDocumento?.abreviatura || '',
      docNumber: a.persona.documento || '',
      status: a.status,
      accumulated: a.acumulado,
      paymentThreshold: a.umbralPago,
      phone: a.persona.telefono,
      email: a.persona.email
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

    const persona = await prisma.personas.create({
      data: {
        nombres: data.name || '',
        apellidos: '',
        tipoDocumentoId,
        documento: data.docNumber || null,
        email: data.email || null,
        telefono: data.phone || null
      }
    });
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
    if (data.name) personaUpdate.nombres = data.name;
    if (data.docNumber !== undefined) personaUpdate.documento = data.docNumber;
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

    const [total, settlements] = await Promise.all([
      prisma.liquidacionesComision.count({ where }),
      prisma.liquidacionesComision.findMany({
        where,
        skip,
        take: perPage,
        include: {
          comisionista: { include: { persona: true } },
          metodoPago: true,
          liquidacionVentas: { include: { venta: true } }
        },
        orderBy: { creadoAt: 'desc' }
      })
    ]);

    const data = settlements.map(s => {
      const d = s.fecha;
      const dateStr = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;

      return {
        id: s.id,
        agentId: s.comisionistaId,
        agentName: `${s.comisionista.persona.nombres} ${s.comisionista.persona.apellidos}`.trim(),
        amount: s.monto,
        date: dateStr,
        paymentMethod: s.metodoPago?.nombre || null,
        reference: s.referencia,
        notes: s.notas,
        salesIds: s.liquidacionVentas.map(lv => lv.ventaId)
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
