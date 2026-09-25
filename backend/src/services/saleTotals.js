const { NotFoundError } = require('../errors/AppError');

/**
 * El dinero de una venta lo calcula el servidor, nunca el cliente.
 *
 * Antes había cuatro copias de la misma regla de estado de cobro repartidas
 * entre `createSale`, `registerPayment` y las dos ramas de `deletePayment`, y
 * dos de ellas la aplicaban sobre cifras que llegaban en el cuerpo de la
 * petición (`saleTotal`, `currentPaidAmount`, `currentPayments`). Comprobado
 * contra el servidor: un POST de un peso con `saleTotal: 1` dejaba una venta de
 * 3.000.000 en `pagado` con la deuda desaparecida de la cartera.
 *
 * Aquí está la única definición, y siempre lee de la base.
 */

// Los importes son Float en la base y sumar decimales arrastra error de coma
// flotante. Se redondea a céntimos antes de guardar para que la cabecera y la
// suma de sus líneas comparen como iguales.
function aCentimos(valor) {
  return Math.round((Number(valor) || 0) * 100) / 100;
}

/**
 * Precio de un producto dentro de la venta.
 *
 * El asistente NO manda un `total` por producto: pide el costo de proveedor y
 * la TA (el margen), y el precio es su suma. Como `subtotal` solo se rellenaba
 * con `x.total`, quedaba en 0 en todas las ventas reales — y `stats.service.js`
 * calcula los ingresos por categoría con `SUM(d.subtotal)`.
 *
 * Medido antes del arreglo: la métrica mostraba 15.580.000 cuando lo real eran
 * 20.488.000, y categorías con ventas aparecían en cero.
 *
 * Si el payload trae un `total` explícito manda ese; si no, se deriva.
 */
function precioProducto(x) {
  const explicito = Number(x.total ?? x.subtotal ?? NaN);
  if (Number.isFinite(explicito) && explicito > 0) return explicito;
  return Number(x.ta || 0) + Number(x.supplierCost || 0);
}

/**
 * Estado de cobro a partir de lo pagado y lo debido. Única definición.
 *
 * `anulado` no sale de aquí: es una decisión del operador, no una consecuencia
 * de las cifras, y quien la toma es `voidSale`.
 */
function estadoSegunPago(pagado, total) {
  if (pagado >= total) return 'pagado';
  return pagado > 0 ? 'abonado' : 'credito';
}

/**
 * Recalcula la cabecera de una venta desde sus productos y sus pagos.
 *
 * Se llama dentro de la transacción que acaba de mover productos o pagos, de
 * modo que la cabecera nunca queda desincronizada ni siquiera un instante.
 *
 * Suma TODAS las líneas de `detalle_venta`, incluidas las que cuelgan de un
 * plan: el asistente cotiza cada línea por separado —el hijo de un plan viaja
 * en su propio array con `linkedToPlanIndex`— y `useSaleCalculations` las suma
 * todas. Sumar solo las raíces daría un total distinto al que ve quien vende.
 *
 * Una venta anulada conserva su estado: ya salió del circuito de cobro y no
 * debe volver por un cambio de importes.
 */
async function recalcularVenta(tx, ventaId) {
  const id = Number(ventaId);

  // Red de seguridad: una venta eliminada no se recalcula. La comprobación de
  // verdad va en quien la muta, pero si se cuela hasta aquí es mejor un 404 que
  // reescribir en silencio los importes de algo que ya no existe.
  const venta = await tx.ventas.findFirst({ where: { id, deleted_at: null }, select: { status: true } });
  if (!venta) throw new NotFoundError('Venta no encontrada');

  const [productos, pagos] = await Promise.all([
    tx.detalle_venta.aggregate({
      where: { venta_id: id },
      _sum: { subtotal: true, ta: true, costo_proveedor: true },
    }),
    tx.pagos_venta.aggregate({
      where: { venta_id: id },
      _sum: { monto: true },
    }),
  ]);

  const monto_total = aCentimos(productos._sum.subtotal);
  const monto_pagado_credito = aCentimos(pagos._sum.monto);

  const data = {
    monto_total,
    ta_total: aCentimos(productos._sum.ta),
    costo_proveedor_total: aCentimos(productos._sum.costo_proveedor),
    monto_pagado_credito,
  };

  if (venta.status !== 'anulado') {
    data.status = estadoSegunPago(monto_pagado_credito, monto_total);
  }

  return tx.ventas.update({ where: { id }, data });
}

/**
 * Bloquea la fila de la venta hasta que termine la transacción.
 *
 * Sin esto, dos cobros simultáneos leen el mismo pendiente y los dos pasan el
 * tope: con "saldar todo" se insertaban dos pagos por el saldo entero. Con el
 * cerrojo, el segundo espera a que el primero confirme y lee lo que dejó. Tiene
 * que ir ANTES de leer los importes, y dentro de `transaccion`: fuera de ella el
 * cerrojo se soltaría al terminar esta misma sentencia.
 */
async function bloquearVenta(tx, ventaId) {
  await tx.$queryRaw`SELECT id FROM ventas WHERE id = ${Number(ventaId)} FOR UPDATE`;
}

module.exports = { recalcularVenta, estadoSegunPago, aCentimos, precioProducto, bloquearVenta };
