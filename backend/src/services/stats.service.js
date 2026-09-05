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

    // Se retiró `recentSales`. Era una consulta más por petición para alimentar
    // la tabla "Últimas Ventas Aprobadas", que ni filtraba por aprobadas —no
    // había filtro de estado— ni aportaba nada: mismas columnas que /sales, con
    // cinco filas y sin búsqueda ni filtros. El dashboard ahora usa
    // GET /stats/attention, que responde algo que /sales no responde.
    const [aggResult, activeClientsCount, totalClientsCount, categoryResult, trendResult, suppliersCount] = await Promise.all([
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

  /**
   * Los tres listados de gestión aceptan ámbito.
   *
   * Antes ignoraban `permissionScope`: sus rutas no tenían `authorize`, así que
   * `req.permissionScope` llegaba undefined y devolvían datos globales. Un
   * asesor con `dashboard: view: 'own'` veía el rendimiento de todos los demás
   * asesores y la lista global de mejores clientes.
   *
   * `$queryRaw` con plantilla etiquetada parametriza sola, así que interpolar
   * `${...}` aquí es seguro: Prisma lo convierte en un placeholder.
   */
  async getTopClients({ permissionScope, user, limit = 6 } = {}) {
    const propio = permissionScope === 'own' && user ? Number(user.id) : null;
    return prisma.$queryRaw`
      SELECT p.nombres || ' ' || p.apellidos AS name,
             COALESCE(SUM(v.monto_total), 0)::float AS total,
             COUNT(v.id)::int AS count
      FROM ventas v
      JOIN clientes c ON v.cliente_id = c.id
      JOIN personas p ON c.persona_id = p.id
      WHERE v.deleted_at IS NULL
        AND (${propio}::int IS NULL OR v.usuario_id = ${propio})
      GROUP BY c.id, p.nombres, p.apellidos
      ORDER BY total DESC
      LIMIT ${Math.min(Number(limit) || 6, 50)}
    `;
  }

  async getAsesorPerformance({ permissionScope, user, limit = 6 } = {}) {
    const propio = permissionScope === 'own' && user ? Number(user.id) : null;
    return prisma.$queryRaw`
      SELECT p.nombres || ' ' || p.apellidos AS "asesorName",
             COALESCE(SUM(v.ta_total), 0)::float AS "totalIngresos",
             COUNT(v.id)::int AS "totalVentas"
      FROM ventas v
      JOIN usuarios u ON v.usuario_id = u.id
      JOIN personas p ON u.persona_id = p.id
      WHERE v.deleted_at IS NULL
        AND (${propio}::int IS NULL OR v.usuario_id = ${propio})
      GROUP BY u.id, p.nombres, p.apellidos
      ORDER BY "totalIngresos" DESC
      LIMIT ${Math.min(Number(limit) || 6, 50)}
    `;
  }

  async getCategoryDistribution({ permissionScope, user, limit = 6 } = {}) {
    const propio = permissionScope === 'own' && user ? Number(user.id) : null;
    return prisma.$queryRaw`
      SELECT mp.nombre AS name, COUNT(v.id)::int AS value
      FROM ventas v
      JOIN metodos_pago mp ON v.metodo_pago_principal_id = mp.id
      WHERE v.deleted_at IS NULL
        AND (${propio}::int IS NULL OR v.usuario_id = ${propio})
      GROUP BY mp.id, mp.nombre
      ORDER BY value DESC
      LIMIT ${Math.min(Number(limit) || 6, 50)}
    `;
  }

  /**
   * Lo que requiere atención hoy: créditos vencidos, check-ins inminentes y
   * ventas sin revisar.
   *
   * Va en un solo endpoint y en tres consultas paralelas a propósito. Con la
   * base a decenas o cientos de milisegundos, tres peticiones HTTP separadas
   * costarían tres veces la latencia; aquí es un viaje.
   *
   * Cada bloque devuelve el conteo, el importe y lo justo para pintar una
   * línea. La lista completa se ve en su pantalla, que es donde se resuelve.
   */
  async getAttention({ permissionScope, user } = {}) {
    const propio = permissionScope === 'own' && user ? Number(user.id) : null;
    const ahora = new Date();
    const en48h = new Date(ahora.getTime() + 48 * 60 * 60 * 1000);

    const ventaVigente = {
      deleted_at: null,
      status: { not: 'anulado' },
      ...(propio !== null ? { usuario_id: propio } : {}),
    };

    // El filtro de check-ins críticos se escribe UNA vez y lo comparten la fila
    // de muestra y el conteo. Los dos van dentro del mismo Promise.all: dejar
    // el conteo fuera lo volvía secuencial y la respuesta pasaba de ~400 ms a
    // ~1100 ms por un viaje de más.
    const whereCheckin = {
      OR: [{ checkin_status: 'pendiente' }, { checkin_status: null }],
      salida: { gte: ahora, lte: en48h },
      prod_tiqueteria: { detalle_venta: { ventas: ventaVigente } },
    };

    const [vencidos, checkins, sinRevisar, checkinsCount] = await Promise.all([
      // Crédito vencido: la fecha de vencimiento ya pasó y queda saldo.
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS count,
               COALESCE(SUM(v.monto_total - COALESCE(v.monto_pagado_credito, 0)), 0)::float AS amount,
               MIN(v.fecha_vence_credito) AS oldest
        FROM ventas v
        WHERE v.deleted_at IS NULL
          AND v.status <> 'anulado'
          AND (v.es_credito = true OR v.status IN ('credito', 'abonado'))
          AND v.fecha_vence_credito IS NOT NULL
          AND v.fecha_vence_credito < CURRENT_DATE
          AND v.monto_total - COALESCE(v.monto_pagado_credito, 0) > 0
          AND (${propio}::int IS NULL OR v.usuario_id = ${propio})
      `,
      // Check-ins críticos: pendientes con salida en las próximas 48 h. Misma
      // regla que usa GET /flights/checkins?status=critico.
      prisma.tramos_vuelo.findMany({
        where: whereCheckin,
        orderBy: { salida: 'asc' },
        take: 1,
        select: {
          salida: true,
          aeropuertos_tramos_vuelo_aeropuerto_origen_idToaeropuertos: { select: { codigo_iata: true } },
          aeropuertos_tramos_vuelo_aeropuerto_destino_idToaeropuertos: { select: { codigo_iata: true } },
        },
      }),
      prisma.ventas.aggregate({
        where: { ...ventaVigente, is_reviewed: false },
        _count: { _all: true },
        _sum: { monto_total: true },
      }),
      prisma.tramos_vuelo.count({ where: whereCheckin }),
    ]);

    const v = vencidos[0] || {};
    const proximo = checkins[0];

    return {
      overdueCredit: {
        count: Number(v.count) || 0,
        amount: Number(v.amount) || 0,
        oldestDueDate: v.oldest ? new Date(v.oldest).toISOString() : null,
      },
      criticalCheckins: {
        count: checkinsCount,
        next: proximo
          ? {
              departure: proximo.salida.toISOString(),
              origin: proximo.aeropuertos_tramos_vuelo_aeropuerto_origen_idToaeropuertos?.codigo_iata || null,
              destination: proximo.aeropuertos_tramos_vuelo_aeropuerto_destino_idToaeropuertos?.codigo_iata || null,
            }
          : null,
      },
      unreviewedSales: {
        count: sinRevisar._count._all,
        amount: Number(sinRevisar._sum.monto_total) || 0,
      },
    };
  }

}

module.exports = new StatsService();
