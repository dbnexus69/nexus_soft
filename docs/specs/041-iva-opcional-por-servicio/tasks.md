# Tareas — Spec 041

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-11-11).** Implementada, corregida tras la revisión (T8) y probada contra la base local.
Migración aplicada en producción y `main` publicado; falta solo una prueba manual en pantalla.

## T1 · Migración y columnas `[x]`

`incluye_iva` en `detalle_venta` y `detalle_cotizacion`, aditiva, `DEFAULT true`. `npx prisma validate`
en verde. Aplicada en local (`pnpm local:preparar`) y en producción (`pnpm db:migrate:produ`, 2026-11-11).

## T2 · Cálculo (`saleTotals.js`) `[x]`

`calcularIva(ta, incluyeIva = true)`; `precioProducto`/`datosFinancieros` leen `x.incluyeIva` y lo
devuelven como `incluye_iva`. Probado a mano (sin BD): con el interruptor apagado, `iva` da 0 y el
`subtotal` baja exactamente eso.

## T3 · Validación (`products.schema.js`) `[x]`

`SOBRE.incluyeIva` opcional; `precioCuadra` usa el mismo valor al calcular el esperado. Probado a mano:
un `total` que coincide con costo+TA (sin IVA) pasa; uno que todavía trae el 19% de más se rechaza con
"no cuadra con costo + TA + IVA".

## T4 · Persistencia en cotizaciones (`quotes.service.js`) `[x]`

`lineasDe` agrega `incluye_iva` a la línea que guarda (`totalesDe` ya sumaba `iva` tal cual, sin
cambios). El JSON `detalle` de cada línea ya hace de respaldo para editar: el `incluyeIva` que manda
el formulario viaja ahí tal cual y vuelve igual al reabrir, sin fusionar nada de la columna explícita.

## T5 · Voucher `[x]`

`RESUMEN DE PAGO`: al principio `IVA` mostraba `dinero(venta.iva_total)`; tras la revisión (T8) vuelve a
`'Incluido'` sin el monto, y la fila no aparece si ninguna línea lleva IVA. `pnpm test:voucher-plantilla` sigue en verde (no toca esa suite, pero confirma que `plantilla.js`
sigue generando bien).

## T6 · Frontend — interruptor `[x]`

Checkbox "Este servicio lleva IVA" en `FinancialSection` (11 categorías) y en los 4 formularios con
bloque financiero propio (`TicketForm`, `HotelForm`, `InsuranceForm`, `PlanForm`), con el monto de IVA
en vivo al lado. `useSaleCalculations.ts` sumaba el IVA una sola vez sobre la TA total — se cambió a
sumarlo por línea, porque con líneas mixtas no da lo mismo. `incluyeIva?: boolean` en las 15 interfaces
de producto de `types/index.tsx` (14 compartían el mismo bloque final, una sola edición; `TourData`
tenía dos campos de más en medio y se hizo aparte) y `true` por defecto en los 15 ítems iniciales de
`wizardData.ts`. `pnpm build` en verde.

## T7 · Verificación `[~]`

`node --check` de los 5 archivos de backend tocados y `pnpm check:prisma`: en verde. `pnpm build` del
frontend: en verde. Probado a mano el cálculo y la validación del servidor (T2/T3) sin necesidad de
servidor ni base. Migración y pruebas con base: hechas en T1 y T8. **Falta:** una prueba en pantalla
(crear un servicio con el interruptor apagado y ver que el total y el voucher reflejan lo esperado).

## T8 · Correcciones de la revisión `[x]`

- El voucher vuelve a decir «Incluido»: el monto del IVA no se le enseña al cliente (decisión del 2026-11-11).
- Cada casilla «lleva IVA» usa `useId`: con ids fijos, el texto del segundo servicio marcaba el primero.
- La venta devuelve `incluyeIva` en cada producto (`catalog/products.js`, las 15 categorías).
- Pruebas: cuadre con y sin IVA en `test:validaciones`, la fila de IVA en `test:voucher-plantilla` y la suite
  nueva `test:iva-opcional` (venta y cotización con líneas mixtas), en verde contra la base local.

---

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-11-10 | — | Diseño vía `/brainstorming`: por servicio (no por venta entera), baja el total (no solo cambia el reporte), mismo permiso que crear, sin efecto en comisión/Ganancia Oficina (ya se calculan solo sobre TA). |
| 2026-11-10 | T1-T7 | Implementado tras la aprobación del diseño. Todo verificado sin BD (sintaxis, tipos, y el cálculo/la validación probados a mano con `node -e`); falta aplicar la migración y la prueba en pantalla, las dos con permiso pendiente. |
| 2026-11-11 | T1, T5, T8 | Revisión: voucher de nuevo con «Incluido», ids únicos en las casillas, `incluyeIva` al leer la venta y tres suites con pruebas (commit `b9e908c`). Migración aplicada en local y en producción; `main` adelantado. Falta la prueba en pantalla. |
