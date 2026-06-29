const prisma = require('../config/db');

class StatsService {
  async getDashboardStats({ dateFrom, dateTo, permissionScope, user }) {
    const currentYear = new Date().getFullYear();
    let dateCondition = '';
    if (dateFrom && dateTo) {
      dateCondition = `AND creado_at >= '${new Date(dateFrom).toISOString()}' AND creado_at <= '${new Date(dateTo).toISOString()}'`;
    } else if (dateFrom) {
      dateCondition = `AND creado_at >= '${new Date(dateFrom).toISOString()}'`;
    } else if (dateTo) {
      dateCondition = `AND creado_at <= '${new Date(dateTo).toISOString()}'`;
    }

    let userCondition = '';
    if (permissionScope === 'own') {
      userCondition = `AND usuario_id = '${user.id}'`;
    }

    const aggregatesSql = `
      SELECT
        COUNT(*)::int as "totalOperations",
        COALESCE(SUM(CASE WHEN status = 'pagado' THEN ta_total WHEN status = 'abonado' AND monto_total > 0 THEN (ta_total * (COALESCE(monto_pagado_credito, 0) / monto_total)) ELSE 0 END), 0) as "totalRevenue",
        COALESCE(SUM(CASE WHEN status IN ('credito', 'abonado') THEN (monto_total - COALESCE(monto_pagado_credito, 0)) ELSE 0 END), 0) as "pendingBalance",
        COUNT(CASE WHEN status IN ('credito', 'abonado') THEN 1 END)::int as "pendingCount",
        COALESCE(SUM(CASE WHEN status = 'pagado' THEN costo_proveedor_total WHEN status = 'abonado' AND monto_total > 0 THEN (costo_proveedor_total * (COALESCE(monto_pagado_credito, 0) / monto_total)) ELSE 0 END), 0) as "suppliersTotal",
        COALESCE(SUM(CASE WHEN status = 'pagado' THEN monto_total ELSE 0 END), 0) as "paids",
        COALESCE(SUM(CASE WHEN status = 'credito' THEN monto_total ELSE 0 END), 0) as "credits",
        COALESCE(SUM(CASE WHEN status = 'abonado' THEN monto_total ELSE 0 END), 0) as "partPaids",
        COALESCE(SUM(CASE WHEN EXTRACT(YEAR FROM creado_at) = ${currentYear} THEN monto_total ELSE 0 END), 0) as "currentYearSales",
        COALESCE(SUM(CASE WHEN EXTRACT(YEAR FROM creado_at) = ${currentYear - 1} THEN monto_total ELSE 0 END), 0) as "prevYearSales",
        COALESCE(SUM(CASE WHEN status IN ('credito', 'abonado') AND monto_total > 0 THEN (costo_proveedor_total * ((monto_total - COALESCE(monto_pagado_credito, 0)) / monto_total)) ELSE 0 END), 0) as "creditProveedores",
        COALESCE(SUM(CASE WHEN status IN ('credito', 'abonado') AND monto_total > 0 THEN (ta_total * ((monto_total - COALESCE(monto_pagado_credito, 0)) / monto_total)) ELSE 0 END), 0) as "creditTa"
      FROM ventas
      WHERE deleted_at IS NULL ${dateCondition} ${userCondition}
    `;

    let clientsWhere = { deleted_at: null };
    if (permissionScope === 'own') {
      clientsWhere.creado_por_id = user.id;
    }
    if (dateFrom || dateTo) {
      clientsWhere.fecha_registro = {};
      if (dateFrom) clientsWhere.fecha_registro.gte = new Date(dateFrom);
      if (dateTo) clientsWhere.fecha_registro.lte = new Date(dateTo);
    }

    const [aggResult, activeClientsCount] = await Promise.all([
      prisma.$queryRawUnsafe(aggregatesSql),
      prisma.clientes.count({ where: clientsWhere })
    ]);

    const agg = aggResult[0] || {};
    const currentSales = Number(agg.currentYearSales) || 0;
    const prevSales = Number(agg.prevYearSales) || 0;
    const salesGrowth = prevSales > 0 ? Number((((currentSales - prevSales) / prevSales) * 100).toFixed(2)) : 0;

    return {
      totalOperations: agg.totalOperations || 0,
      totalRevenue: Number(agg.totalRevenue) || 0,
      activeClients: activeClientsCount,
      pendingBalance: Number(agg.pendingBalance) || 0,
      pendingCount: agg.pendingCount || 0,
      suppliersTotal: Number(agg.suppliersTotal) || 0,
      salesGrowth,
      salesDistribution: {
        paids: Number(agg.paids) || 0,
        credits: Number(agg.credits) || 0,
        partPaids: Number(agg.partPaids) || 0,
        creditProveedores: Number(agg.creditProveedores) || 0,
        creditTa: Number(agg.creditTa) || 0
      }
    };
  }

  async getTopClients(params) {
    return await prisma.$queryRaw`
      SELECT p.nombres || ' ' || p.apellidos as name, COALESCE(SUM(v.monto_total), 0)::float as total, COUNT(v.id)::int as count
      FROM ventas v
      JOIN clientes c ON v.cliente_id = c.id
      JOIN personas p ON c.persona_id = p.id
      WHERE v.deleted_at IS NULL
      GROUP BY c.id, p.nombres, p.apellidos
      ORDER BY total DESC
      LIMIT 6
    `;
  }

  async getAsesorPerformance(params) {
    return await prisma.$queryRaw`
      SELECT p.nombres || ' ' || p.apellidos as "asesorName", COALESCE(SUM(v.ta_total), 0)::float as "totalIngresos", COUNT(v.id)::int as "totalVentas"
      FROM ventas v
      JOIN usuarios u ON v.usuario_id = u.id
      JOIN personas p ON u.persona_id = p.id
      WHERE v.deleted_at IS NULL
      GROUP BY u.id, p.nombres, p.apellidos
      ORDER BY "totalIngresos" DESC
      LIMIT 6
    `;
  }

  async getCategoryDistribution(params) {
    return await prisma.$queryRaw`
      SELECT mp.nombre as name, COUNT(v.id)::int as value
      FROM ventas v
      JOIN metodos_pago mp ON v.metodo_pago_principal_id = mp.id
      WHERE v.deleted_at IS NULL
      GROUP BY mp.id, mp.nombre
      ORDER BY value DESC
      LIMIT 6
    `;
  }
}

module.exports = new StatsService();
