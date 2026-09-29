# Spec 003 — IVA sobre la Tarifa Administrativa (TA)

**Estado:** en ejecución · **Continúa:** [`002-estabilizacion-multi-tenant`](../002-estabilizacion-multi-tenant/spec.md)

Este documento dice **qué** tiene que pasar y **cómo se comprueba**. El *cómo* técnico está en
`plan.md`; el reparto en tareas, con lo que ya se hizo y lo que falta, en `tasks.md`.

## Problema

El asesor cotiza cada producto de una venta con dos números: `costo_proveedor` (lo que cuesta
comprarle al proveedor) y `ta` (Tarifa Administrativa, el margen que se queda la agencia). Hasta ahora
no existe ningún concepto de IVA en el sistema. La agencia necesita cobrarle IVA al cliente sobre su
margen — la TA —, no sobre el costo del proveedor, y ese IVA no puede confundirse con ingreso real de
la agencia en ningún reporte.

Se evaluaron dos formas de resolverlo:
1. El asesor ingresa la TA neta, y el IVA se calcula aparte y se suma para llegar al subtotal que paga
   el cliente.
2. El asesor ingresa la TA ya con el IVA incluido, y el sistema la desglosa hacia atrás — pero el
   campo `ta` en la base terminaría siendo el bruto.

Se eligió la **opción 1**. `ta_total` (la suma de `ta` de una venta) ya es la fuente de tres métricas
financieras reales:
- `totalRevenue` del dashboard (`backend/prisma/sql/dashboardAggregates.sql`).
- El ranking de asesores por ingresos (`stats.service.js`, `getAsesorPerformance`).
- El reparto proporcional de la cartera de cobros (`stats.service.js`, `getCreditBreakdown`).

Meter el IVA dentro de `ta` inflaría las tres con dinero que no es ingreso de la agencia, sino un
impuesto que se traslada al Estado. La opción 1 mantiene `ta` como el margen neto real y el IVA en un
campo espejo propio, igual que ya conviven `ta` y `costo_proveedor`.

## Qué será posible al terminar

1. El asistente de venta calcula el IVA sobre la TA de cada producto (tasa fija, igual en las 15
   categorías) y lo suma al total que paga el cliente.
2. `ta`/`ta_total` en la base siguen siendo el margen neto — ningún reporte existente (dashboard,
   ranking de asesores, cartera) queda contaminado por el cambio.
3. La comisión del comisionista y la "Ganancia Oficina" que ve el asesor se calculan sobre la TA neta,
   nunca sobre TA+IVA.
4. El desglose (TA / IVA / Total) se ve en las pantallas internas: el resumen en vivo del asistente y
   el detalle de una venta ya creada. El voucher que recibe el cliente no cambia — sigue mostrando un
   solo total, que ya incorpora el IVA.
5. El IVA nunca lo manda el navegador: lo calcula siempre el servidor a partir de la TA, igual que el
   resto del dinero de una venta.

## Criterios de aceptación

| # | Criterio | Cómo se comprueba | Estado |
|---|---|---|---|
| C1 | El IVA se calcula sobre la TA neta, no al revés | `POST /sales` con un producto con `ta: 100000`: `detalle_venta.iva` queda en `19000` (TASA_IVA = 0.19) y `ta` sigue en `100000` | cumplido |
| C2 | El total que paga el cliente incluye el IVA | El `subtotal` de la línea y el `monto_total` de la venta son `costo_proveedor + ta + iva` | cumplido |
| C3 | `ta_total` no se contamina | Tras crear ventas con IVA, `SUM(ta_total)` (dashboard, ranking de asesores, cartera) sigue siendo solo la suma de las TA netas | cumplido |
| C4 | La comisión del comisionista se calcula sobre TA neta | Con un comisionista asignado, `commissionAgentAmount` sugerido = `ta * %`, no `(ta+iva) * %` | hecho, falta confirmar en pantalla |
| C5 | La "Ganancia Oficina" no incluye el IVA | En el resumen del asistente, en el detalle de venta y en la pantalla de abonos, la ganancia mostrada es `ta − comisión`, no `total − costo − comisión` | hecho, falta confirmar en pantalla |
| C6 | El IVA nunca lo acepta el servidor desde el body | Un `POST /sales` que mande `iva` en el producto no lo usa: el valor guardado siempre sale de recalcularlo desde `ta` | cumplido |
| C7 | El voucher del cliente no cambia | Descargar el voucher de una venta con IVA sigue mostrando un único total, sin desglose nuevo | hecho, falta confirmar en pantalla |
| C8 | Las 15 categorías de producto quedan cubiertas | Crear una venta con un producto de cada categoría, incluidas las 4 que no usan `FinancialSection` (Hotel, Insurance, Plan, Ticket): todas calculan y guardan el IVA igual | cubierto en código; probado en vivo Hotel y Restaurant |

## Fuera de alcance

- **Tasa de IVA configurable por agencia o por producto.** Se decidió fija para toda la app; si hace
  falta que varíe, es un cambio de diseño propio, no una extensión de este.
- **Desglosar el IVA en el voucher del cliente.** Decidido explícitamente que el comprobante siga
  mostrando un solo total.
- **Unificar los 4 formularios de producto que duplican el bloque financiero a mano** (`HotelForm`,
  `InsuranceForm`, `PlanForm`, `TicketForm`) en el componente compartido `FinancialSection`. El IVA no
  se ingresa por producto, así que no les agrega ningún campo nuevo; unificarlos es una deuda técnica
  aparte, anotada pero no resuelta aquí.
- **El dígito de verificación o el régimen tributario del cliente/proveedor.** Este cambio es solo
  sobre cómo se calcula y se guarda el IVA de la TA, no sobre facturación electrónica ni retenciones.

## Riesgos

**Que el IVA se cuele en una métrica de ingresos sin que nadie lo note.** `ta_total` tiene tres
lectores fuera de `saleTotals.js` (`dashboardAggregates.sql`, `getAsesorPerformance`,
`getCreditBreakdown`); ninguno debe empezar a leer `iva_total` como si fuera ingreso. La comprobación
es contar manualmente tras crear ventas de prueba y comparar contra lo que muestran esas tres
pantallas.

**Que la "Ganancia Oficina" quede inflada por el IVA.** Está duplicada en 3 pantallas
(`Step3Payment.tsx`, `SaleDetailModal.tsx`, `SalePaymentsModal.tsx`), y las 3 hoy calculan
`total − costo − comisión`. Con el IVA sumado a `total`, las 3 quedan mal si no se corrigen a la vez —
es el mismo patrón de "regla copiada en varios sitios" que ya ha causado bugs antes en este repo.
