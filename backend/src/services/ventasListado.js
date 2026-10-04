const prisma = require('../config/db');
const { BadRequestError } = require('../errors/AppError');
const { buildMeta } = require('../utils/paginationHelper');
const { labelOf } = require('../catalog/products');
const { soloLasSuyas } = require('./ventasAlcance');

// El listado paginado de ventas (GET /sales). Salió de sales.service.js (spec 010 T7).

async function listSales({ pagination, search, status, asesorId, clientId, responsableId, commissionAgentId, dateFrom, dateTo, permissionScope, viewScope, user, sortBy, sortOrder }) {
  const { page, perPage, skip } = pagination;

  // Un solo constructor de filtros para las dos consultas: el count de Prisma
  // y el SQL del listado. Los valores van como parámetros, nunca interpolados.
  const filtros = [];
  const params = [];
  // Cada '?' del fragmento consume un valor y se convierte en $1, $2, ...
  const push = (sql, ...valores) => {
    const resuelto = sql.replace(/\?/g, () => `$${params.push(valores.shift())}`);
    filtros.push(resuelto);
  };

  // El filtro se escribe UNA vez.
  //
  // Antes cada una de las nueve condiciones se duplicaba: el texto del SQL
  // para las filas y un objeto `where` de Prisma para el count. Mantener ese
  // par a mano es el origen del error recurrente del repo. Esta consulta no
  // puede dejar de ser cruda (json_agg de pagos y detalles), así que la
  // solución es que el count también sea crudo y comparta el mismo `whereSql`
  // y los mismos parámetros: ya no hay dos versiones que discrepen.
  if (search) {
    // La búsqueda cubre lo mismo que cubría el filtro en cliente: cliente,
    // asesor, comisionista, número de venta y observaciones.
    const q = `%${search}%`;
    // Si el término es un número, se interpreta como número de venta exacto.
    // Ambas consultas usan la misma regla para que el total nunca discrepe.
    const comoId = /^\d+$/.test(search.trim()) ? parseInt(search.trim(), 10) : null;

    push(`(
      v.observaciones ILIKE ?
      OR (cp.nombres || ' ' || cp.apellidos) ILIKE ?
      OR (up.nombres || ' ' || up.apellidos) ILIKE ?
      OR (comp.nombres || ' ' || comp.apellidos) ILIKE ?
      ${comoId !== null ? 'OR v.numero = ?' : ''}
    )`, ...(comoId !== null ? [q, q, q, q, comoId] : [q, q, q, q]));

  }
  if (status) {
    push('v.status = ?::"SaleStatus"', status);
  }
  if (clientId) {
    push('v.cliente_id = ?', parseInt(clientId));
  }
  if (responsableId) {
    push('v.responsable_id = ?', parseInt(responsableId));
  }
  if (commissionAgentId) {
    push('v.comisionista_id = ?', parseInt(commissionAgentId));
  }
  if (dateFrom) {
    push('v.creado_at >= ?', new Date(dateFrom));
  }
  if (dateTo) {
    push('v.creado_at <= ?', new Date(dateTo));
  }
  // El alcance 'own' manda sobre el filtro de asesor que venga por query.
  const asesorEfectivo = soloLasSuyas({ permissionScope, viewScope, user }) ? user.id : (asesorId ? parseInt(asesorId) : null);
  if (asesorEfectivo !== null) {
    push('v.usuario_id = ?', asesorEfectivo);
  }

  const whereSql = filtros.length ? 'AND ' + filtros.join(' AND ') : '';

  const sortFieldMap = { 'creadoAt': 'creadoAt', 'date': 'creadoAt', 'total': 'montoTotal', 'status': 'status', 'clientName': 'cliente_id' };
  const effectiveSortBy = sortFieldMap[sortBy] || 'creadoAt';
  const sqlOrderBy = effectiveSortBy === 'montoTotal' ? 'v.monto_total' : (effectiveSortBy === 'status' ? 'v.status' : 'v.creado_at');

  // Mismo FROM y mismo WHERE que las filas, con los mismos parámetros.
  const fromSql = `
      FROM ventas v
      JOIN clientes c ON v.cliente_id = c.id
      JOIN personas cp ON c.persona_id = cp.id
      JOIN usuarios u ON v.usuario_id = u.id
      JOIN personas up ON u.persona_id = up.id
      LEFT JOIN comisionistas com ON v.comisionista_id = com.id
      LEFT JOIN personas comp ON com.persona_id = comp.id
      WHERE v.deleted_at IS NULL ${whereSql}`;

  const [totalRows, ventasRaw] = await prisma.transaccion(async (tx) => {
    return Promise.all([
      tx.$queryRawUnsafe(`SELECT COUNT(*)::int AS total ${fromSql}`, ...params),
      tx.$queryRawUnsafe(`
        SELECT 
          v.id,
          v.numero,
          v.cliente_id as "cliente_id",
          v.usuario_id as "usuarioId",
          v.creado_at as "creadoAt",
          v.monto_total as "montoTotal",
          v.status,
          v.observaciones,
          v.es_credito as "esCredito",
          v.fecha_vence_credito as "fechaVenceCredito",
          v.monto_pagado_credito as "montoPagadoCredito",
          v.is_reviewed as "isReviewed",
          v.comisionista_id as "comisionistaId",
          v.monto_comision_bruto as "montoComisionBruto",
          v.porcentaje_retencion_comision as "porcentajeRetencionComision",
          v.monto_comision_neto as "montoComisionNeto",
          v.costo_proveedor_total as "costoProveedorTotal",
          v.ta_total as "taTotal",
          v.iva_total as "ivaTotal",
          v.comision_liquidada as "comision_liquidada",
          v.responsable_id as "responsableId",
          cp.nombres || ' ' || cp.apellidos as "clientName",
          cp.email as "clientEmail",
          cp.avatar_url as "clientAvatar",
          up.nombres || ' ' || up.apellidos as "asesorName",
          comp.nombres || ' ' || comp.apellidos as "commissionAgentName",
          
          COALESCE((
            SELECT json_agg(json_build_object(
              'id', p.id,
              'fechaPago', p.fecha_pago,
              'monto', p.monto,
              'metodoPago', (SELECT json_build_object('nombre', mp.nombre) FROM metodos_pago mp WHERE mp.id = p.metodo_pago_id)
            ))
            FROM pagos_venta p WHERE p.venta_id = v.id
          ), '[]'::json) as "pagosVenta",

          COALESCE((
            SELECT json_agg(json_build_object(
              'categoria', dv.categoria,
              'nombreServicio', dv.nombre_servicio,
              'origen', dv.origen,
              'destino', dv.destino,
              'pasajerosDetalle', COALESCE((
                SELECT json_agg(json_build_object(
                  'persona', (SELECT json_build_object('nombres', paxp.nombres, 'apellidos', paxp.apellidos) FROM personas paxp WHERE paxp.id = pd.persona_id)
                ))
                FROM pasajeros_detalle pd WHERE pd.detalle_venta_id = dv.id
              ), '[]'::json)
            ))
            FROM detalle_venta dv WHERE dv.venta_id = v.id
          ), '[]'::json) as "detalleVentas"

        ${fromSql}
        ORDER BY ${sqlOrderBy} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, ...params, perPage, skip)
    ]);
  });

  const data = ventasRaw.map(v => {
    const servicesSummary = (v.detalleVentas || []).map(d => {
      const tipo = d.categoria;
      const label = labelOf(tipo);
      const route = (d.origen && d.destino) ? `${d.origen}→${d.destino}` : null;
      const pax = d.pasajerosDetalle?.[0]?.persona;
      const paxName = pax ? `${pax.nombres} ${pax.apellidos}` : null;
      const hasCustomName = d.nombreServicio && d.nombreServicio !== label;
      const detail = [hasCustomName ? d.nombreServicio : null, route, paxName].filter(Boolean).join(' · ');
      return { tipo, label, detail: detail || null };
    });

    return {
      id: v.id,
      clientId: v.cliente_id,
      clientName: v.clientName,
      clientEmail: v.clientEmail,
      clientAvatar: v.clientAvatar,
      responsableId: v.responsableId,
      asesorId: v.usuarioId,
      asesorName: v.asesorName,
      date: v.creadoAt,
      numero: v.numero,
      total: v.montoTotal,
      status: v.status,
      observations: v.observaciones,
      isCredit: v.esCredito,
      creditDueDate: v.fechaVenceCredito,
      creditPaidAmount: v.montoPagadoCredito,
      isReviewed: v.isReviewed,
      commissionAgentId: v.comisionistaId,
      commissionAgentName: v.commissionAgentName,
      commissionAgentAmount: v.montoComisionBruto,
      commissionAgentRetentionPercentage: v.porcentajeRetencionComision || 0,
      commissionAgentNetPayment: v.montoComisionNeto,
      supplierCost: v.costoProveedorTotal,
      ta: v.taTotal,
      iva: v.ivaTotal,
      isSettled: v.comision_liquidada,
      payments: (v.pagosVenta || []).map(p => ({
        id: p.id,
        date: p.fechaPago,
        amount: p.monto,
        method: p.metodoPago?.nombre || null
      })),
      servicesSummary
    };
  });

  return { data, meta: buildMeta(Number(totalRows[0]?.total || 0), page, perPage) };
}

// Cartera de crédito agrupada por cliente.
//
// Antes esto se calculaba en el navegador recorriendo la lista de ventas, que
// viene paginada: la cartera salía calculada sobre una página. Aquí se agrupa
// en SQL sobre todas las ventas a crédito del cliente.
//
// Reglas (las mismas que aplicaba creditUtils):
//   venta a crédito = es_credito OR status IN ('credito','abonado')
//   pagada  -> pagado >= total
//   parcial -> pagado > 0          (tiene prioridad sobre vencida)
//   vencida -> vence < hoy
//   pendiente en cualquier otro caso

module.exports = { listSales };
