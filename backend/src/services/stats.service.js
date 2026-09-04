const prisma = require('../config/db');
// SQL tipado: la consulta vive en `prisma/sql/dashboardAggregates.sql` y Prisma
// la valida contra la base al generar (`prisma generate --sql`), así que una
// columna mal escrita rompe el build en vez de la petición.
const { dashboardAggregates } = require('@prisma/client/sql');

class StatsService {
  async getDashboardStats({ dateFrom, dateTo, permissionScope, user }) {
    const currentYear = new Date().getFullYear();
    const scopeUserId = permissionScope === 'own' ? user.id : null;

    /**
     * Condiciones de fecha y de ámbito con parámetros posicionales.
     *
     * Antes los valores se metían en el texto del SQL: las fechas con
     * `toISOString()` y el id con `'${user.id}'`. No había hueco de inyección
     * —el id viene del JWT y la fecha pasa por `Date`— pero era seguro por
     * accidente de la coerción, no por construcción, y una fecha inválida
     * hacía que `toISOString()` lanzara un RangeError con un 500 ilegible (eso
     * ahora lo corta `validateQuery(dateRangeSchema)` en la ruta, con un 422).
     *
     * Cada consulta necesita su propia numeración de placeholders, así que se
     * construye una vez por consulta, con el prefijo de alias que le toque.
     * Antes esto se resolvía con un `dateCondition.replace(/creado_at/g, ...)`
     * sobre el SQL ya construido.
     */
    const condiciones = (prefijo = '') => {
      const filtros = [];
      const params = [];
      const push = (sql, ...valores) => {
        filtros.push(sql.replace(/\?/g, () => `$${params.push(valores.shift())}`));
      };
      if (dateFrom) push(`${prefijo}creado_at >= ?`, new Date(dateFrom));
      if (dateTo) push(`${prefijo}creado_at <= ?`, new Date(dateTo));
      if (scopeUserId !== null) push(`${prefijo}usuario_id = ?`, scopeUserId);
      return { sql: filtros.length ? 'AND ' + filtros.join(' AND ') : '', params };
    };

    const cDetalle = condiciones('v.'); // JOIN ventas v


    const categorySql = `
      SELECT categoria, COUNT(d.id)::int as count, COALESCE(SUM(d.subtotal), 0)::float as revenue
      FROM detalle_venta d
      JOIN ventas v ON d.venta_id = v.id
      WHERE v.deleted_at IS NULL ${cDetalle.sql}
      GROUP BY categoria
    `;

    // Solo el ámbito de usuario, sin fechas.
    const cTendencia = (() => {
      const params = [];
      const sql = scopeUserId !== null ? `AND usuario_id = $${params.push(scopeUserId)}` : '';
      return { sql, params };
    })();

    const monthlyTrendSql = `
      SELECT 
        EXTRACT(MONTH FROM creado_at)::int as month,
        SUM(CASE WHEN EXTRACT(YEAR FROM creado_at) = ${currentYear} THEN monto_total ELSE 0 END)::float as "currentYear",
        SUM(CASE WHEN EXTRACT(YEAR FROM creado_at) = ${currentYear - 1} THEN monto_total ELSE 0 END)::float as "previousYear"
      FROM ventas
      -- La tendencia compara dos años completos: no lleva el filtro de fechas.
      WHERE deleted_at IS NULL ${cTendencia.sql}
      GROUP BY EXTRACT(MONTH FROM creado_at)
      ORDER BY month ASC
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

    const [aggResult, activeClientsCount, totalClientsCount, categoryResult, trendResult, suppliersCount, recentSales] = await Promise.all([
      // Doce agregados en una consulta. Los filtros son opcionales dentro del
      // SQL con `($n IS NULL OR ...)`, así que la consulta es estática y
      // TypedSQL puede analizarla.
      prisma.$queryRawTyped(dashboardAggregates(
        dateFrom ? new Date(dateFrom) : null,
        dateTo ? new Date(dateTo) : null,
        scopeUserId,
        currentYear,
      )),
      prisma.clientes.count({ where: { ...clientsWhere, personas: { status: 'active' } } }),
      prisma.clientes.count({ where: clientsWhere }),
      prisma.$queryRawUnsafe(categorySql, ...cDetalle.params),
      prisma.$queryRawUnsafe(monthlyTrendSql, ...cTendencia.params),
      prisma.proveedores.count({ where: { status: 'active' } }),
      prisma.ventas.findMany({
        where: {
          deleted_at: null,
          ...(permissionScope === 'own' ? { usuario_id: user.id } : {})
        },
        orderBy: { creado_at: 'desc' },
        take: 5,
        relationLoadStrategy: 'join',
        include: { clientes: { include: { personas: true } } }
      })
    ]);

    const agg = aggResult[0] || {};
    const currentSales = Number(agg.currentYearSales) || 0;
    const prevSales = Number(agg.prevYearSales) || 0;
    const salesGrowth = prevSales > 0 ? Number((((currentSales - prevSales) / prevSales) * 100).toFixed(2)) : 0;

    const categoryBreakdown = {};
    let totalFlights = 0;
    categoryResult.forEach(c => {
      categoryBreakdown[c.categoria] = { count: c.count, revenue: c.revenue };
      if (c.categoria === 'ticket') totalFlights = c.count;
    });

    return {
      totalOperations: agg.totalOperations || 0,
      totalRevenue: Number(agg.totalRevenue) || 0,
      activeClients: activeClientsCount,
      totalClients: totalClientsCount,
      pendingBalance: Number(agg.pendingBalance) || 0,
      pendingCount: agg.pendingCount || 0,
      suppliersTotal: Number(agg.suppliersTotal) || 0,
      supplierCount: suppliersCount,
      totalFlights,
      categoryBreakdown,
      monthlyTrend: trendResult || [],
      recentSales: recentSales.map(s => ({
        id: s.id,
        date: s.creado_at,
        clientName: s.clientes?.personas ? `${s.clientes.personas.nombres} ${s.clientes.personas.apellidos}` : 'N/A',
        amount: s.monto_total,
        status: s.status
      })),
      salesGrowth,
      carteraStatus: [
        { name: "Pagado", value: Number(agg.paids) || 0, color: "#10b981" },
        { name: "Abonado", value: Number(agg.partPaids) || 0, color: "#3b82f6" },
        { name: "Pendiente", value: Number(agg.credits) || 0, color: "#f59e0b" }
      ],
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
