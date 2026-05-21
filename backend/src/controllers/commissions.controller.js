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
        include: { persona: true }
      })
    ]);

    const data = agents.map(a => ({
      id: a.id,
      name: `${a.persona.nombres} ${a.persona.apellidos}`,
      type: a.tipo,
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
    const persona = await prisma.personas.create({
      data: {
        nombres: data.name || '',
        apellidos: '',
        email: data.email || null,
        telefono: data.phone || null
      }
    });
    const agent = await prisma.comisionistas.create({
      data: {
        personaId: persona.id,
        tipo: data.type || null,
        umbralPago: data.paymentThreshold || 0,
        acumulado: 0,
        status: 'Activo'
      }
    });
    success(res, agent, null, 201);
  } catch (err) {
    next(err);
  }
};

exports.updateAgent = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const data = req.body;
    const agent = await prisma.comisionistas.findUnique({ where: { id }, include: { persona: true } });
    if (!agent) return error(res, 'Comisionista no encontrado', 404);

    if (data.name) {
      await prisma.personas.update({
        where: { id: agent.personaId },
        data: { nombres: data.name, updatedAt: new Date() }
      });
    }
    if (data.type) await prisma.comisionistas.update({ where: { id }, data: { tipo: data.type } });
    if (data.status) await prisma.comisionistas.update({ where: { id }, data: { status: data.status } });

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

    const data = settlements.map(s => ({
      id: s.id,
      agentId: s.comisionistaId,
      agentName: `${s.comisionista.persona.nombres} ${s.comisionista.persona.apellidos}`,
      amount: s.monto,
      date: s.fecha,
      paymentMethod: s.metodoPago?.nombre || null,
      reference: s.referencia,
      notes: s.notas,
      salesIds: s.liquidacionVentas.map(lv => lv.ventaId)
    }));

    success(res, data, buildMeta(total, page, perPage));
  } catch (err) {
    next(err);
  }
};

exports.createSettlement = async (req, res, next) => {
  try {
    const data = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const settlement = await tx.liquidacionesComision.create({
        data: {
          comisionistaId: data.agentId,
          fecha: data.date ? new Date(data.date) : new Date(),
          monto: data.amount,
          metodoPagoId: data.paymentMethod ? parseInt(data.paymentMethod) : null,
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

      return settlement;
    });

    success(res, result, null, 201);
  } catch (err) {
    next(err);
  }
};
