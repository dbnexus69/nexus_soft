const prisma = require('../config/db');
const { success } = require('../utils/apiResponse');

exports.dashboard = async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const where = {};
    if (dateFrom || dateTo) {
      where.creadoAt = {};
      if (dateFrom) where.creadoAt.gte = new Date(dateFrom);
      if (dateTo) where.creadoAt.lte = new Date(dateTo);
    }

    // Run all DB queries in parallel
    const [ventas, monthlyTrend, categoryStats, [totalClients, activeClients], recentSales, supplierCount] = await Promise.all([
      prisma.ventas.findMany({ where: { ...where, deletedAt: null } }),
      prisma.ventasMensuales.findMany({ orderBy: [{ year: 'asc' }, { month: 'asc' }], take: 24 }),
      prisma.detalleVenta.groupBy({
        by: ['categoria'],
        _sum: { subtotal: true },
        _count: true,
        where: { venta: { ...where, deletedAt: null } }
      }),
      Promise.all([
        prisma.clientes.count({ where: { deletedAt: null } }),
        prisma.clientes.count({ where: { deletedAt: null, persona: { status: 'active' } } }),
      ]),
      prisma.ventas.findMany({
        where: { ...where, deletedAt: null },
        orderBy: { creadoAt: 'desc' },
        take: 5,
        include: {
          cliente: { select: { persona: { select: { nombres: true, apellidos: true } } } },
          usuario: { select: { persona: { select: { nombres: true, apellidos: true } } } },
        }
      }),
      prisma.proveedores.count(),
    ]);

    // In-memory computations (no DB roundtrips)
    const totalRevenue = ventas
      .filter(v => v.status === 'pagado' || v.status === 'abonado')
      .reduce((sum, v) => sum + v.montoTotal, 0);
    const pendingBalance = ventas
      .filter(v => v.status === 'credito')
      .reduce((sum, v) => sum + (v.montoTotal - (v.montoPagadoCredito || 0)), 0);
    const pendingCount = ventas.filter(v => v.status === 'credito').length;
    const totalOperations = ventas.length;
    const suppliersTotal = ventas.reduce((sum, v) => sum + (v.costoProveedorTotal || 0), 0);
    const paids = ventas.filter(v => v.status === 'pagado').reduce((s, v) => s + v.montoTotal, 0);
    const credits = ventas.filter(v => v.status === 'credito').reduce((s, v) => s + v.montoTotal, 0);
    const partPaids = ventas.filter(v => v.status === 'abonado').reduce((s, v) => s + v.montoTotal, 0);

    const categoryMap = {
      tiqueteria: 'Tiquetes', hoteleria: 'Hoteles', planes: 'Planes',
      seguros_viaje: 'Seguros', checkin: 'Check-in', documentacion_migratoria: 'Documentos',
      simcard: 'SIM Cards', renta_vehiculos: 'Vehículos', renta_fincas: 'Fincas',
      tours: 'Tours', centros_convencion: 'Eventos', restaurantes: 'Restaurantes',
      visa: 'Visa', pasaporte: 'Pasaporte', servicio_mascotas: 'Mascotas'
    };

    const totalCategoria = categoryStats.reduce((sum, d) => sum + (d._sum.subtotal || 0), 0);
    const categoryDistribution = categoryStats.map(d => ({
      name: categoryMap[d.categoria] || d.categoria,
      value: d._sum.subtotal || 0,
      percentage: totalCategoria > 0 ? Math.round((d._sum.subtotal / totalCategoria) * 10000) / 100 : 0
    }));

    const carteraTotal = paids + credits + partPaids || 1;
    const carteraStatus = [
      { name: 'Pagado', value: Math.round((paids / carteraTotal) * 100), color: '#16a34a' },
      { name: 'Abonado', value: Math.round((partPaids / carteraTotal) * 100), color: '#f59e0b' },
      { name: 'Crédito', value: Math.round((credits / carteraTotal) * 100), color: '#dc2626' },
    ];

    const categoryBreakdown = {
      hoteles: { count: 0, revenue: 0 },
      seguros_viaje: { count: 0, revenue: 0 },
      planes: { count: 0, revenue: 0 },
      tiqueteria: { count: 0, revenue: 0 },
    };
    let totalFlights = 0;
    for (const cs of categoryStats) {
      const cat = cs.categoria;
      const sum = cs._sum.subtotal || 0;
      const cnt = cs._count;
      if (categoryBreakdown[cat]) {
        categoryBreakdown[cat].count = cnt;
        categoryBreakdown[cat].revenue = Math.round(sum);
      }
      if (cat === 'tiqueteria') totalFlights = cnt;
    }

    const currentYear = new Date().getFullYear();
    const currentYearSales = ventas.filter(v => new Date(v.creadoAt).getFullYear() === currentYear)
      .reduce((s, v) => s + v.montoTotal, 0);
    const prevYearSales = ventas.filter(v => new Date(v.creadoAt).getFullYear() === currentYear - 1)
      .reduce((s, v) => s + v.montoTotal, 0);

    success(res, {
      totalRevenue: Math.round(totalRevenue),
      previousYearRevenue: Math.round(prevYearSales),
      revenueGrowth: prevYearSales > 0 ? Math.round(((currentYearSales - prevYearSales) / prevYearSales) * 100) : 0,
      totalOperations,
      operationsGrowth: 0,
      pendingBalance: Math.round(pendingBalance),
      pendingCount,
      suppliersTotal: Math.round(suppliersTotal),
      monthlyRevenue: Math.round(currentYearSales),
      categoryDistribution: categoryDistribution.slice(0, 8),
      carteraStatus,
      monthlyTrend: monthlyTrend.map(t => ({
        month: t.month,
        currentYear: Math.round(t.total * (t.year === currentYear ? 1 : 0)),
        previousYear: Math.round(t.total * (t.year === currentYear - 1 ? 1 : 0))
      })),
      totalClients,
      activeClients,
      totalFlights,
      categoryBreakdown,
      recentSales: recentSales.map(v => ({
        id: v.id,
        clientName: `${v.cliente.persona.nombres} ${v.cliente.persona.apellidos}`,
        asesorName: `${v.usuario.persona.nombres} ${v.usuario.persona.apellidos}`,
        date: v.creadoAt,
        total: v.montoTotal,
        status: v.status,
      })),
      supplierCount,
    });
  } catch (err) {
    next(err);
  }
};

exports.salesHistory = async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const data = await prisma.ventasMensuales.findMany({
      where: { year },
      orderBy: { month: 'asc' }
    });
    success(res, data.map(d => ({
      id: d.id,
      year: d.year,
      month: d.month,
      total: Math.round(d.total),
      count: d.count,
      category: {
        hotels: Math.round(d.hoteles || 0),
        flights: Math.round(d.vuelos || 0),
        packages: Math.round(d.paquetes || 0),
        insurance: Math.round(d.seguros || 0),
        transfers: Math.round(d.transferencias || 0),
      }
    })));
  } catch (err) {
    next(err);
  }
};

exports.asesorPerformance = async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const where = { deletedAt: null };
    if (dateFrom || dateTo) {
      where.creadoAt = {};
      if (dateFrom) where.creadoAt.gte = new Date(dateFrom);
      if (dateTo) where.creadoAt.lte = new Date(dateTo);
    }

    const ventas = await prisma.ventas.findMany({
      where,
      include: { usuario: { include: { persona: true } } }
    });

    const grouped = {};
    for (const v of ventas) {
      const uid = v.usuarioId;
      if (!grouped[uid]) {
        grouped[uid] = {
          asesorId: uid,
          asesorName: `${v.usuario.persona.nombres} ${v.usuario.persona.apellidos}`,
          totalVentas: 0,
          totalIngresos: 0,
          comisiones: 0
        };
      }
      grouped[uid].totalVentas++;
      grouped[uid].totalIngresos += v.montoTotal;
      grouped[uid].comisiones += v.montoComisionNeto || 0;
    }

    success(res, Object.values(grouped).map(g => ({
      ...g,
      totalIngresos: Math.round(g.totalIngresos),
      comisiones: Math.round(g.comisiones)
    })));
  } catch (err) {
    next(err);
  }
};

exports.topClients = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const { dateFrom, dateTo } = req.query;
    const where = { deletedAt: null };
    if (dateFrom || dateTo) {
      where.creadoAt = {};
      if (dateFrom) where.creadoAt.gte = new Date(dateFrom);
      if (dateTo) where.creadoAt.lte = new Date(dateTo);
    }

    const ventas = await prisma.ventas.findMany({
      where,
      include: { cliente: { include: { persona: true } } }
    });

    const grouped = {};
    for (const v of ventas) {
      const cid = v.clienteId;
      if (!grouped[cid]) {
        grouped[cid] = {
          clientName: `${v.cliente.persona.nombres} ${v.cliente.persona.apellidos}`,
          totalVentas: 0,
          totalPagado: 0
        };
      }
      grouped[cid].totalVentas++;
      grouped[cid].totalPagado += v.montoTotal;
    }

    const sorted = Object.values(grouped)
      .sort((a, b) => b.totalPagado - a.totalPagado)
      .slice(0, limit)
      .map(g => ({ ...g, totalPagado: Math.round(g.totalPagado) }));

    success(res, sorted);
  } catch (err) {
    next(err);
  }
};

exports.categoryDistribution = async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const where = {};
    if (dateFrom || dateTo) {
      where.venta = { deletedAt: null, creadoAt: {} };
      if (dateFrom) where.venta.creadoAt.gte = new Date(dateFrom);
      if (dateTo) where.venta.creadoAt.lte = new Date(dateTo);
    }

    const detalles = await prisma.detalleVenta.groupBy({
      by: ['categoria'],
      _sum: { subtotal: true },
      where: { venta: { ...where.venta, deletedAt: null } }
    });

    const categoryMap = {
      tiqueteria: 'Tiquetes', hoteleria: 'Hoteles', planes: 'Planes',
      seguros_viaje: 'Seguros', checkin: 'Check-in', documentacion_migratoria: 'Documentos',
      simcard: 'SIM Cards', renta_vehiculos: 'Vehículos', renta_fincas: 'Fincas',
      tours: 'Tours', centros_convencion: 'Eventos', restaurantes: 'Restaurantes',
      visa: 'Visa', pasaporte: 'Pasaporte', servicio_mascotas: 'Mascotas'
    };

    const total = detalles.reduce((s, d) => s + (d._sum.subtotal || 0), 0);
    success(res, detalles.map(d => ({
      name: categoryMap[d.categoria] || d.categoria,
      value: d._sum.subtotal || 0,
      percentage: total > 0 ? Math.round((d._sum.subtotal / total) * 10000) / 100 : 0
    })));
  } catch (err) {
    next(err);
  }
};
