const prisma = require('../config/db');
const { NotFoundError, BadRequestError } = require('../errors/AppError');
const { buildMeta } = require('../utils/paginationHelper');
const { soloLasSuyas } = require('./ventasAlcance');

// La cartera de crédito: el listado por cliente con su antigüedad y el detalle de los créditos de uno.
// Salió de sales.service.js (spec 010 T7); los dos comparten los mismos CTE de clasificación.

/**
 * Tramos del informe de antigüedad de cartera, el estándar en cobranza:
 * corriente (aún no vence) y mora repartida en 1-30, 31-60, 61-90 y +90 días.
 *
 * `undated` no es un tramo de verdad: recoge los créditos sin fecha de
 * vencimiento, que desde 863c468 ya no se pueden crear y solo quedan como
 * datos heredados. Existe para que los tramos sumen el pendiente en vez de
 * perder dinero por el camino.
 */
const TRAMOS_MORA = ['days1_30', 'days31_60', 'days61_90', 'days90plus'];
const TRAMOS_ANTIGUEDAD = ['current', ...TRAMOS_MORA, 'undated'];

/**
 * Los CTE que clasifican cada crédito. UNA sola definición, compartida por el
 * listado de la cartera y por el detalle de un cliente.
 *
 * Cobro y vencimiento son dos ejes independientes. El CASE original los
 * colapsaba en uno y evaluaba 'partial' antes que 'overdue', así que un abono
 * parcial tapaba el vencimiento: 4.600.000 de mora se reportaban como cero.
 * Aquí `liquidada` responde "¿queda algo por cobrar?" y `dias_mora` responde
 * "¿cuánto se pasó de fecha?". Se cruzan, no compiten.
 */
function ctesDeCredito(extraSql) {
  return `
      WITH creditos AS (
        SELECT
          v.id AS venta_id,
          v.cliente_id,
          v.creado_at,
          v.status::text AS venta_status,
          v.monto_total,
          COALESCE(v.monto_pagado_credito, 0) AS pagado,
          GREATEST(v.monto_total - COALESCE(v.monto_pagado_credito, 0), 0) AS pendiente,
          v.fecha_vence_credito,
          (COALESCE(v.monto_pagado_credito, 0) >= v.monto_total) AS liquidada,
          -- El ::date es obligatorio: fecha_vence_credito es timestamp, y
          -- restarlo de CURRENT_DATE devuelve un interval que no castea a int.
          CASE
            WHEN v.fecha_vence_credito IS NOT NULL
             AND v.fecha_vence_credito::date < CURRENT_DATE
            THEN (CURRENT_DATE - v.fecha_vence_credito::date)
          END AS dias_mora
        FROM ventas v
        JOIN clientes c ON v.cliente_id = c.id
        JOIN personas cp ON c.persona_id = cp.id
        WHERE v.deleted_at IS NULL
          AND v.status <> 'anulado'
          AND (v.es_credito = true OR v.status IN ('credito', 'abonado'))
          ${extraSql}
      ),
      -- Tramo de cada crédito. Los liquidados no tienen tramo: ya no se cobran.
      por_credito AS (
        SELECT
          cr.*,
          CASE
            WHEN cr.liquidada                       THEN NULL
            WHEN cr.fecha_vence_credito IS NULL     THEN 'undated'
            WHEN cr.dias_mora IS NULL               THEN 'current'
            WHEN cr.dias_mora <= 30                 THEN 'days1_30'
            WHEN cr.dias_mora <= 60                 THEN 'days31_60'
            WHEN cr.dias_mora <= 90                 THEN 'days61_90'
            ELSE 'days90plus'
          END AS tramo
        FROM creditos cr
      )`;
}

/** Agregado por cliente. Se apoya en `por_credito`. */
const CTE_POR_CLIENTE = `
      por_cliente AS (
        SELECT
          cliente_id,
          SUM(monto_total)::float                                             AS "totalCredit",
          SUM(pagado)::float                                                  AS "paidAmount",
          SUM(CASE WHEN NOT liquidada    THEN pendiente ELSE 0 END)::float    AS "pendingAmount",
          SUM(CASE WHEN tramo = 'current'    THEN pendiente ELSE 0 END)::float AS "agingCurrent",
          SUM(CASE WHEN tramo = 'days1_30'   THEN pendiente ELSE 0 END)::float AS "aging1_30",
          SUM(CASE WHEN tramo = 'days31_60'  THEN pendiente ELSE 0 END)::float AS "aging31_60",
          SUM(CASE WHEN tramo = 'days61_90'  THEN pendiente ELSE 0 END)::float AS "aging61_90",
          SUM(CASE WHEN tramo = 'days90plus' THEN pendiente ELSE 0 END)::float AS "aging90plus",
          SUM(CASE WHEN tramo = 'undated'    THEN pendiente ELSE 0 END)::float AS "agingUndated",
          -- "Activos" son los que quedan por cobrar: contar los liquidados hacía
          -- que un cliente al día siguiera sumando créditos.
          COUNT(*) FILTER (WHERE NOT liquidada)::int                          AS "activeCredits",
          -- El próximo vencimiento sale solo de lo pendiente. Con MIN sobre
          -- todo, la fecha de un crédito ya pagado podía ser la más antigua y la
          -- pantalla mostraba un vencimiento que no se debe.
          MIN(CASE WHEN NOT liquidada THEN fecha_vence_credito END)           AS "nextDueDate",
          COALESCE(MAX(dias_mora) FILTER (WHERE NOT liquidada), 0)::int       AS "daysOverdue"
        FROM por_credito
        GROUP BY cliente_id
        -- Un cliente sin nada por cobrar no pertenece a una lista de cobros.
        HAVING COUNT(*) FILTER (WHERE NOT liquidada) > 0
      ),
      clasificados AS (
        SELECT
          pc.*,
          ("aging1_30" + "aging31_60" + "aging61_90" + "aging90plus")::float  AS "overdueAmount",
          -- Tramo del CLIENTE: el peor en el que tenga dinero. Undated va por
          -- delante de current porque un crédito que no vence nunca es un
          -- problema que atender, no una cuenta tranquila.
          CASE
            WHEN pc."aging90plus"  > 0 THEN 'days90plus'
            WHEN pc."aging61_90"   > 0 THEN 'days61_90'
            WHEN pc."aging31_60"   > 0 THEN 'days31_60'
            WHEN pc."aging1_30"    > 0 THEN 'days1_30'
            WHEN pc."agingUndated" > 0 THEN 'undated'
            ELSE 'current'
          END AS tramo,
          -- Clasificación anterior, por urgencia del próximo vencimiento. Se
          -- mantiene mientras la pantalla la siga usando; el informe de
          -- antigüedad es la columna tramo.
          CASE
            WHEN ("aging1_30" + "aging31_60" + "aging61_90" + "aging90plus") > 0 THEN 'overdue'
            WHEN pc."nextDueDate" IS NOT NULL
             AND pc."nextDueDate" <= CURRENT_DATE + INTERVAL '3 days' THEN 'urgent'
            WHEN pc."nextDueDate" IS NOT NULL
             AND pc."nextDueDate" <= CURRENT_DATE + INTERVAL '7 days' THEN 'pending'
            ELSE 'ok'
          END AS estado
        FROM por_cliente pc
      )`;

/**
 * Ordenaciones admitidas de la cartera. Lista blanca: la clave del cliente
 * elige una expresión ya escrita, nunca se interpola en el SQL.
 *
 * `priority` es el orden por defecto y es fijo —lo más vencido primero y, a
 * igualdad, lo que vence antes—, que es el orden en que se cobra. Las demás
 * llevan su propio sentido natural: los nombres suben, el dinero y los días
 * bajan, porque nadie ordena una cartera para ver quién debe menos.
 */
const ORDENES_CARTERA = {
  priority: { sql: 'c2."overdueAmount" DESC, c2."nextDueDate" ASC NULLS LAST', fijo: true },
  client:   { sql: "cp.nombres || ' ' || cp.apellidos", defecto: 'asc' },
  credits:  { sql: 'c2."activeCredits"', defecto: 'desc' },
  overdue:  { sql: 'c2."overdueAmount"', defecto: 'desc' },
  pending:  { sql: 'c2."pendingAmount"', defecto: 'desc' },
  days:     { sql: 'c2."daysOverdue"', defecto: 'desc' },
  // Un crédito sin fecha no debe encabezar la lista en ningún sentido.
  dueDate:  { sql: 'c2."nextDueDate"', defecto: 'asc', nulos: 'NULLS LAST' },
};

/** Fila de resumen por cliente, en la forma que consume la pantalla. */
function mapearResumenCliente(f) {
  return {
    totalCredit: f.totalCredit,
    paidAmount: f.paidAmount,
    pendingAmount: f.pendingAmount,
    overdueAmount: f.overdueAmount,
    daysOverdue: f.daysOverdue,
    activeCredits: f.activeCredits,
    nextDueDate: f.nextDueDate,
    // Los seis tramos suman `pendingAmount`.
    aging: {
      current: f.agingCurrent,
      days1_30: f.aging1_30,
      days31_60: f.aging31_60,
      days61_90: f.aging61_90,
      days90plus: f.aging90plus,
      undated: f.agingUndated,
    },
    agingBucket: f.tramo,
    status: f.estado,
  };
}

/**
 * Cartera por cliente, con informe de antigüedad.
 *
 * `?bucket=` filtra por tramo ('overdue' agrupa los cuatro de mora) y
 * `?status=` por la clasificación anterior de urgencia. Los dos se aplican en
 * SQL y el count comparte su predicado con las filas: antes se filtraba el
 * array del LIMIT, así que `?status=overdue` devolvía 0 filas informando de
 * `meta.total: 2` y todas las páginas salían vacías.
 */
async function getCreditPortfolio({ pagination, search, status, bucket, sortBy, sortOrder, permissionScope, viewScope, user }) {
  const { page, perPage, skip } = pagination;
  const ESTADOS = ['overdue', 'urgent', 'pending', 'ok'];

  if (status && status !== 'all' && !ESTADOS.includes(status)) {
    throw new BadRequestError(
      `Estado de cartera inválido: ${status}. Válidos: all, ${ESTADOS.join(', ')}`
    );
  }
  if (bucket && bucket !== 'all' && bucket !== 'overdue' && !TRAMOS_ANTIGUEDAD.includes(bucket)) {
    throw new BadRequestError(
      `Tramo de antigüedad inválido: ${bucket}. Válidos: all, overdue, ${TRAMOS_ANTIGUEDAD.join(', ')}`
    );
  }
  if (sortBy && !ORDENES_CARTERA[sortBy]) {
    throw new BadRequestError(
      `Orden inválido: ${sortBy}. Válidos: ${Object.keys(ORDENES_CARTERA).join(', ')}`
    );
  }
  // Sin distinguir mayúsculas: 'ASC' es lo que escribe cualquiera y rechazarlo
  // no protege de nada.
  const sentido = sortOrder ? String(sortOrder).toLowerCase() : null;
  if (sentido && sentido !== 'asc' && sentido !== 'desc') {
    throw new BadRequestError(`Sentido de orden inválido: ${sortOrder}. Válidos: asc, desc`);
  }

  // El desempate por cliente va siempre al final: sin él, dos clientes con el
  // mismo importe pueden cambiar de sitio entre páginas y una fila se ve dos
  // veces o ninguna.
  const orden = ORDENES_CARTERA[sortBy] || ORDENES_CARTERA.priority;
  const ordenSql = orden.fijo
    ? orden.sql
    : `${orden.sql} ${(sentido || orden.defecto).toUpperCase()}${orden.nulos ? ` ${orden.nulos}` : ''}`;

  const filtros = [];
  const params = [];
  const push = (sql, ...valores) => {
    filtros.push(sql.replace(/\?/g, () => `$${params.push(valores.shift())}`));
  };

  if (soloLasSuyas({ permissionScope, viewScope, user })) push('v.usuario_id = ?', user.id);
  if (search) {
    const q = `%${search}%`;
    push(`((cp.nombres || ' ' || cp.apellidos) ILIKE ? OR cp.documento ILIKE ? OR CAST(v.id AS TEXT) ILIKE ?)`, q, q, q);
  }
  const extraSql = filtros.length ? 'AND ' + filtros.join(' AND ') : '';
  const baseSql = `${ctesDeCredito(extraSql)},${CTE_POR_CLIENTE}`;

  const iEstado = params.length + 1;
  const iTramo = params.length + 2;
  const filtroSql = `
    WHERE ($${iEstado}::text IS NULL OR c2.estado = $${iEstado}::text)
      AND ($${iTramo}::text IS NULL OR
           CASE WHEN $${iTramo}::text = 'overdue'
                THEN c2.tramo IN ('days1_30','days31_60','days61_90','days90plus')
                ELSE c2.tramo = $${iTramo}::text END)`;
  const pEstado = status && status !== 'all' ? status : null;
  const pTramo = bucket && bucket !== 'all' ? bucket : null;

  const [filas, conteo, totales] = await prisma.transaccion(async (tx) => {
    return Promise.all([
      tx.$queryRawUnsafe(`
        ${baseSql}
        SELECT
          c2.*,
          cp.nombres || ' ' || cp.apellidos AS "clientName",
          cp.documento  AS "clientDocNumber",
          cp.email      AS "clientEmail",
          cp.avatar_url AS "clientAvatar"
        FROM clasificados c2
        JOIN clientes c ON c2.cliente_id = c.id
        JOIN personas cp ON c.persona_id = cp.id
        ${filtroSql}
        ORDER BY ${ordenSql}, c2.cliente_id ASC
        LIMIT $${iTramo + 1} OFFSET $${iTramo + 2}
      `, ...params, pEstado, pTramo, perPage, skip),

      tx.$queryRawUnsafe(`
        ${baseSql}
        SELECT COUNT(*)::int AS total FROM clasificados c2 ${filtroSql}
      `, ...params, pEstado, pTramo),

      // Los contadores van SIN los filtros, para que al pulsar un tramo los
      // demás sigan mostrando su cifra. Tramos y estados son excluyentes y
      // exhaustivos, así que cada familia suma el total de la cartera: es un
      // invariante comprobable.
      tx.$queryRawUnsafe(`
        ${baseSql}
        SELECT
          COUNT(*)::int                                              AS "clientsCount",
          COALESCE(SUM("pendingAmount"), 0)::float                   AS "totalPending",
          COALESCE(SUM("overdueAmount"), 0)::float                   AS "totalOverdue",
          COALESCE(SUM("agingCurrent"), 0)::float                    AS "totalCurrent",
          COALESCE(SUM("aging1_30"), 0)::float                       AS "total1_30",
          COALESCE(SUM("aging31_60"), 0)::float                      AS "total31_60",
          COALESCE(SUM("aging61_90"), 0)::float                      AS "total61_90",
          COALESCE(SUM("aging90plus"), 0)::float                     AS "total90plus",
          COALESCE(SUM("agingUndated"), 0)::float                    AS "totalUndated",
          COALESCE(MAX("daysOverdue"), 0)::int                       AS "maxDaysOverdue",
          COALESCE(SUM(CASE WHEN estado = 'urgent'
                       THEN "pendingAmount" ELSE 0 END), 0)::float   AS "totalUrgent",
          COUNT(*) FILTER (WHERE tramo = 'current')::int             AS "countCurrent",
          COUNT(*) FILTER (WHERE tramo = 'days1_30')::int            AS "count1_30",
          COUNT(*) FILTER (WHERE tramo = 'days31_60')::int           AS "count31_60",
          COUNT(*) FILTER (WHERE tramo = 'days61_90')::int           AS "count61_90",
          COUNT(*) FILTER (WHERE tramo = 'days90plus')::int          AS "count90plus",
          COUNT(*) FILTER (WHERE tramo = 'undated')::int             AS "countUndated",
          COUNT(*) FILTER (WHERE estado = 'overdue')::int            AS "countOverdue",
          COUNT(*) FILTER (WHERE estado = 'urgent')::int             AS "countUrgent",
          COUNT(*) FILTER (WHERE estado = 'pending')::int            AS "countPending",
          COUNT(*) FILTER (WHERE estado = 'ok')::int                 AS "countOk"
        FROM clasificados
      `, ...params),
    ]);
  });

  const t = totales[0] || {};

  const data = filas.map(f => ({
    client: {
      id: f.cliente_id,
      name: f.clientName,
      docNumber: f.clientDocNumber,
      email: f.clientEmail,
      avatar: f.clientAvatar,
    },
    ...mapearResumenCliente(f),
  }));

  return {
    data,
    meta: {
      ...buildMeta(conteo[0]?.total || 0, page, perPage),
      totals: {
        clientsCount: t.clientsCount || 0,
        totalPending: t.totalPending || 0,
        totalOverdue: t.totalOverdue || 0,
        totalUrgent: t.totalUrgent || 0,
        maxDaysOverdue: t.maxDaysOverdue || 0,
        aging: {
          current: t.totalCurrent || 0,
          days1_30: t.total1_30 || 0,
          days31_60: t.total31_60 || 0,
          days61_90: t.total61_90 || 0,
          days90plus: t.total90plus || 0,
          undated: t.totalUndated || 0,
        },
        bucketCounts: {
          current: t.countCurrent || 0,
          days1_30: t.count1_30 || 0,
          days31_60: t.count31_60 || 0,
          days61_90: t.count61_90 || 0,
          days90plus: t.count90plus || 0,
          undated: t.countUndated || 0,
        },
        countOverdue: t.countOverdue || 0,
        countUrgent: t.countUrgent || 0,
        countPending: t.countPending || 0,
        countOk: t.countOk || 0,
      },
    },
  };
}

/**
 * Los créditos de UN cliente: el ítem de la colección `/sales/credit`.
 *
 * La pantalla los sacaba de `listSales({ clientId, perPage: 50 })` y los
 * filtraba y clasificaba en el navegador: se traía la venta entera con todos
 * sus productos para leer cuatro campos, se cortaba en 50 sin mirar
 * `meta.totalPages`, y el estado se calculaba con una tercera copia de la
 * regla. Aquí van ya clasificados por el MISMO SQL que el listado.
 */
async function getClientCredits(clientId, { pagination, permissionScope, viewScope, user } = {}) {
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BadRequestError('El identificador del cliente debe ser un número entero');
  }
  const { page = 1, perPage = 20, skip = 0 } = pagination || {};

  const filtros = [];
  const params = [];
  const push = (sql, ...valores) => {
    filtros.push(sql.replace(/\?/g, () => `$${params.push(valores.shift())}`));
  };

  push('v.cliente_id = ?', id);
  // Mismo ámbito que el listado: con alcance 'own' un asesor no ve la cartera
  // de un cliente atendido por otro, ni por su URL directa.
  if (soloLasSuyas({ permissionScope, viewScope, user })) push('v.usuario_id = ?', user.id);
  const extraSql = 'AND ' + filtros.join(' AND ');
  const baseSql = ctesDeCredito(extraSql);

  const [resumen, creditos, conteo] = await prisma.transaccion(async (tx) => {
    return Promise.all([
      tx.$queryRawUnsafe(`
        ${baseSql},${CTE_POR_CLIENTE}
        SELECT
          c2.*,
          cp.nombres || ' ' || cp.apellidos AS "clientName",
          cp.documento  AS "clientDocNumber",
          cp.email      AS "clientEmail",
          cp.avatar_url AS "clientAvatar"
        FROM clasificados c2
        JOIN clientes c ON c2.cliente_id = c.id
        JOIN personas cp ON c.persona_id = cp.id
      `, ...params),

      tx.$queryRawUnsafe(`
        ${baseSql}
        SELECT
          venta_id, creado_at, venta_status, fecha_vence_credito,
          monto_total::float AS total, pagado::float AS paid, pendiente::float AS pending,
          COALESCE(dias_mora, 0)::int AS "daysOverdue", liquidada, tramo
        FROM por_credito
        WHERE NOT liquidada
        -- Lo más atrasado primero, que es el orden en que se cobra. Los sin
        -- fecha van al final: no tienen vencimiento con el que ordenarlos.
        ORDER BY dias_mora DESC NULLS LAST, fecha_vence_credito ASC NULLS LAST, venta_id ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, ...params, perPage, skip),

      tx.$queryRawUnsafe(`
        ${baseSql}
        SELECT COUNT(*)::int AS total FROM por_credito WHERE NOT liquidada
      `, ...params),
    ]);
  });

  const r = resumen[0];
  if (!r) throw new NotFoundError('El cliente no tiene créditos pendientes');

  return {
    data: creditos.map(c => ({
      saleId: c.venta_id,
      date: c.creado_at,
      saleStatus: c.venta_status,
      dueDate: c.fecha_vence_credito,
      total: c.total,
      paidAmount: c.paid,
      pendingAmount: c.pending,
      daysOverdue: c.daysOverdue,
      agingBucket: c.tramo,
    })),
    meta: {
      ...buildMeta(conteo[0]?.total || 0, page, perPage),
      client: {
        id: r.cliente_id,
        name: r.clientName,
        docNumber: r.clientDocNumber,
        email: r.clientEmail,
        avatar: r.clientAvatar,
      },
      summary: mapearResumenCliente(r),
    },
  };
}

module.exports = { getCreditPortfolio, getClientCredits };
