# Tareas — Spec 013

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-06).** Implementada y verificada por la API. Falta verla en pantalla.

---

## T1 · Endpoint `GET /stats/iva` `[x]`

Totales y lista paginada, con el filtro y el alcance del dashboard. Ver `plan.md` decisiones 1-3.

Verificado: prueba desechable por la API (`verif-iva-…`, agencia propia):
- admin: total 285 = suma de `iva_total` de las 3 ventas vigentes, comparado contra la base.
- la venta anulada no cuenta; la lista trae 3 filas.
- página 2 de 2 con `perPage=2`: 1 fila, totales iguales.
- rango de 2020: 0 y lista vacía.
- asesor con alcance `own`: 1 venta, IVA 95 (igual que su venta en la base).
- sin sesión: 401.

## T2 · Cifra y modal en el dashboard `[x]`

**Confirmado en pantalla** (2026-10-08).

Cifra "IVA del periodo" en el panel de contexto, que sigue el calendario; modal con cifra,
lista y paginación.

Verificado: `tsc` del frontend sin errores. **Pendiente:** verla en el navegador (cifra
correcta al cambiar el rango, modal paginada, botón deshabilitado mientras carga).

## T3 · Regresión de aislamiento `[x]`

`pnpm test:aislamiento-api`: "Todo en orden".

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-06 | T1 | Endpoint `/stats/iva`; 17 comprobaciones por la API contra la base, todas en verde. |
| 2026-10-06 | T2 | Cifra y modal; `tsc` sin errores. Sin probar en el navegador. |
| 2026-10-06 | T3 | `pnpm test:aislamiento-api` sin fallos. |
