# Tareas — Spec 003

Cada tarea deja el sistema funcionando. Ninguna se da por hecha sin su comprobación.

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-03).** Hechas T1–T10.

---

## T1 · Migración y schema `[x]`

`detalle_venta.iva` y `ventas.iva_total`, aditivos, sin backfill (`prisma/migrations/20260927170000_iva_sobre_ta/`).

**Comprobado:** `prisma migrate deploy` aplicó la migración sin errores; `schema.prisma` actualizado
con los dos campos nuevos, comentados con el porqué de mantenerlos aparte de `ta`/`ta_total`; cliente
de Prisma regenerado (`pnpm db:generate`).

## T2 · `saleTotals.js`, la fuente única de verdad `[x]`

`TASA_IVA`, `calcularIva(ta)`, `precioProducto` incluye IVA en su rama derivada, `datosFinancieros(x)`
nuevo, `recalcularVenta` suma `iva` en el `_sum` y escribe `iva_total`.

**Comprobado:** con una venta real de dos productos (`ta: 100000`/`ta: 50000`), `detalle_venta.iva`
quedó en `19000`/`9500` (19 % exacto) y `ta` sin tocar.

## T3 · `sales.service.js` `[x]`

Los 15 inserts de `detalle_venta` pasan a `...datosFinancieros(x)`. `NO_EDITABLES` gana `iva`.
`listSales` y `_saleHeader` exponen `iva`/`ivaTotal`.

**Comprobado:** `node --check` limpio tras los 15 reemplazos (13 mecánicos + 2 a mano por formato
distinto, ticket y hotel) · `GET /sales/:id` devuelve `iva` en la cabecera.

## T4 · `catalog/products.js` `[x]`

Los 15 `PRODUCT_TRANSFORMS` ganan `iva: d.iva || 0`.

**Comprobado:** las 15 ocurrencias confirmadas por grep, indentación consistente, `node --check` limpio.

## T5 · Tasa y motor del resumen en el frontend `[x]`

`frontend/src/utils/iva.ts` nuevo (espejo de `TASA_IVA`). `useSaleCalculations.ts`: `calcIva`,
`calcTotal` lo incluye, se escribe `form.iva`. La comisión (`calcTa * %`) no cambia — ya está sobre TA
neta.

## T6 · Tipos `[x]`

`Sale.iva?: number` en `types/index.tsx`. `WizardFormData.iva: string` en `wizardData.ts`, junto a
`ta`/`supplierCost`, con su valor inicial en `INITIAL_FORM`.

## T7 · Resumen en vivo del asistente `[x]`

`Step2Products.tsx`: el banner pasa de 3 a 4 columnas, con "IVA" entre "T.A. Acumulada" y "Venta
Total", leyendo `form.iva`.

## T8 · Comisión y "Ganancia Oficina" en sus 3 sitios `[x]`

`Step3Payment.tsx`, `SaleDetailModal.tsx`, `SalePaymentsModal.tsx`: la ganancia pasa de
`total − costo − comisión` a `ta − comisión`. La comisión en `Step3Payment.tsx` no cambia (ya sobre
`ta`).

## T9 · Detalle de venta y precio por línea `[x]`

`SaleDetailModal.tsx`: nueva línea "IVA" en el desglose de cabecera (junto a "Costo proveedor" / "TA"),
leyendo `sale.iva`. `ServiceRow.tsx`: el fallback sin `subtotal` explícito incluye `iva`.

## T10 · Verificación completa `[x]`

`pnpm check:prisma` limpio · `pnpm test:aislamiento` 15/15 (54 claves ajenas compuestas, sin cambio) ·
`pnpm build` del frontend sin errores de tipos.

**Comprobado por API**, con una agencia de prueba desechable (`verif-iva`, montada y desmontada) y una
venta real de dos productos (Hotel — uno de los 4 formularios sin `FinancialSection` — y Restaurant,
más un comisionista con `commissionAgentNetPayment: 20000`):

| Criterio | Resultado |
|---|---|
| C1 — IVA sobre TA neta | `ta: 100000` → `iva: 19000`; `ta: 50000` → `iva: 9500`. Exacto al 19 %. |
| C2 — Total incluye el IVA | `monto_total: 248500` = `costo_proveedor_total (70000) + ta_total (150000) + iva_total (28500)` |
| C3 — `ta_total` sin contaminar | `ta_total: 150000` = solo la suma de las dos TA netas, sin el IVA sumado |
| C6 — El servidor nunca lee `iva` del body | No se mandó `iva` en ningún producto y aun así se calculó correctamente en los dos |
| C8 — Las 15 categorías | Cubierto código (15/15 en `sales.service.js` y `catalog/products.js`); probado en vivo Hotel y Restaurant |

**Confirmado en el navegador (2026-10-03)**, con una agencia desechable (`verif-ui-*`) y ventas hechas
desde el asistente:

| Criterio | Resultado |
|---|---|
| Resumen del paso 2 | Hotel con costo 300.000 y TA 100.000: IVA $19.000, venta total $419.000 |
| C4 — Comisión sobre TA neta | Restaurante con TA 50.000 y comisionista al 10 %: comisión $5.000 (no $5.950) |
| C5 — Ganancia Oficina = TA − comisión | Paso 3: $100.000 sin comisionista y $45.000 con él; detalle de la venta ("Ganancia neta") y modal de abonos ("Ganancias Oficina"): $100.000. El detalle muestra además la línea IVA $19.000 |
| C7 — El voucher no cambia | Por código: `VoucherPDF.tsx` pinta un solo total, `sale.total`, que ya incluye el IVA. No se descargó el PDF |

---

## T11 · Planteada y descartada: que la TA ya incluya el IVA (no se le suma) `[x]`

El usuario preguntó si había que ajustar la regla: según le dijo un cliente, el IVA
"se saca de la TA", no se le suma. Se investigó a fondo antes de tocar nada:

- **Fórmula alternativa evaluada**: `iva = TA × 19/119` (extraído de una TA que ya es
  el precio final con IVA adentro) en vez de `iva = TA × 19%` sumado encima. Implicaba
  cambiar `saleTotals.js` (`calcularIva`, `precioProducto`), su espejo
  `frontend/src/utils/iva.ts`, la base de la comisión en `useSaleCalculations.ts`
  (pasaría de la TA completa a TA menos su IVA) y la "ganancia" mostrada en
  `SaleDetailModal.tsx` (pasaría a restar también el IVA).
- **Consecuencia encontrada al investigar, no pedida**: el dashboard
  (`prisma/sql/dashboardAggregates.sql`: `totalRevenue`, `creditTa`) y el desglose de
  cartera en `stats.service.js` ("agency" vs "supplier") suman `ta_total` asumiendo
  que ya es margen puro sin IVA — con la TA incluyendo IVA, esas cifras quedarían
  infladas, y las ventas ya guardadas (bajo la regla vieja) necesitarían una migración
  de datos para no quedar inconsistentes con las nuevas en los mismos agregados.
- Las cuatro fórmulas se implementaron y se verificaron a mano (TA 119.000 → IVA
  19.000, precio = costo + 119.000, sin sumar nada encima), con `tsc`/`check:prisma`
  en verde. Antes de tocar el dashboard o los datos históricos, el usuario pidió
  revertir todo y **dejarlo como estaba** (IVA sumado sobre la TA, la regla de T1-T10
  de este spec sigue vigente tal cual). Revertido sin dejar diferencia: `git diff`
  contra el estado anterior, vacío en los cuatro archivos.

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-17 | T11 | Planteado (por un comentario de un cliente) que el IVA se saque de la TA en vez de sumarse. Implementado y verificado a mano; al investigar aparecieron consecuencias no pedidas en el dashboard/cartera (`ta_total` como margen puro) y en los datos históricos (necesitarían migración). El usuario pidió revertirlo y dejar la regla de T1-T10 tal cual estaba. Revertido sin diferencia neta en el código. |
| 2026-10-03 | T10 | Confirmado en el navegador: IVA en el resumen del asistente, comisión y "Ganancia Oficina" sobre TA neta en el paso 3, el detalle y los abonos. |
| 2026-09-27 | T2–T9 | Implementado y probado por API (C1, C2, C3, C6, C8). Falta confirmar en pantalla C4, C5, C7 — sin navegador disponible en esta sesión. |
| 2026-09-27 | T1 | Migración aplicada y schema al día; cliente de Prisma regenerado. |
