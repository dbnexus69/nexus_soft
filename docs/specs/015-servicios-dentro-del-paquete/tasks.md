# Tareas — Spec 015

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-06).** Implementada y verificada por la API y por la definición del
documento. Falta ver el PDF y el detalle de la venta en pantalla.

---

## T1 · Catálogo: todo lo vinculable es hijo del paquete `[x]`

`canBeChild` en todas las categorías salvo `plan`. Ver `plan.md` decisión 1.

## T2 · Voucher: los hijos salen bajo su paquete `[x]`

`bloquesDeHijos` en `plantilla.js`, con la sección de cada categoría.

Verificado:
- Venta 603: dos tours vinculados al paquete, ahora dentro del paquete en la definición.
- Datos ficticios: 14 de 14 categorías bajo un paquete.

## T3 · Tour con nombre y fecha y hora en el voucher `[~]`

`campoTour` lee `tourName` y `preferredDate`. El nombre de los tours ya guardados sigue vacío
(se capturaron antes del campo): hay que volver a capturarlos.

## T4 · Versión de la plantilla `[x]`

`PLANTILLA_VERSION` = 4, para que el caché no sirva PDFs anteriores.

## T5 · Finca: ciudad y dirección `[x]`

`ventaProductos.js` lee `fincaCity` y `fincaAddress`. Ver `plan.md` decisión 4.

## T6 · Regresión `[x]`

- `pnpm test:voucher`: "Todo en orden".
- `pnpm test:vuelos-api`: "Todo en orden", 0 fallos.

## T7 · PDF y detalle de la venta en pantalla `[ ]`

Pendiente: abrir el voucher de una venta con paquete y tours, y revisar que el detalle de la
venta muestre los hijos dentro del paquete.

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-06 | T1, T2 | Venta 603 leída y comprobada; datos ficticios 14/14. |
| 2026-10-06 | T4 | Versión de la plantilla subida a 4 (la 3 fue intermedia). |
| 2026-10-06 | T5 | Finca: ciudad y dirección leídas con sus nombres de campo. |
| 2026-10-06 | T6 | `test:voucher` y `test:vuelos-api` sin fallos. |
