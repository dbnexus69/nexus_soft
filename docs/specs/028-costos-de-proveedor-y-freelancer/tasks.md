# Tareas — Spec 028

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-22).** Cerrada: sin código; la prueba de T1 está en `aislamiento-api.js` y pasa.

## T0 · Diseño: preguntas respondidas con el usuario `[x]`
## T1 · Prueba en `aislamiento-api.js`: el freelancer con `own` no ve las ventas ajenas (ni sus costos) `[x]`

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-22 | — | Anotada a pedido del usuario al cerrar la 026. Inventario de dónde aparece el costo de proveedor y preguntas abiertas. Hallazgo: el freelancer escribe el costo en el asistente (es obligatorio), así que ocultarlo exige decidir quién lo pone. |
| 2026-10-22 | T0 | Respuestas del usuario a las 5 preguntas. Con los valores por defecto ya se cumple; queda decidir si con `all` el freelancer ve costos ajenos. |
| 2026-10-22 | T0 | El usuario elige (a): con `all` el admin decide, sin regla fija. No hay código; queda T1, la prueba. |
| 2026-10-22 | T1 | Prueba escrita y en verde, dentro del bloque de la 027: con ventas en `own`, el freelancer recibe 404 en la venta del admin y su lista no la trae. El dashboard no se asertó: `suppliersTotal` solo cuenta ventas pagadas o abonadas y la venta de la prueba es a crédito. |
