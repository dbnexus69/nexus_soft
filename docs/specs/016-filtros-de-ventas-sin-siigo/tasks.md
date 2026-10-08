# Tareas — Spec 016

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

## T1 · Quitar Siigo de Ventas `[x]`

**Confirmado en pantalla** (2026-10-08).

Fuera la modal "Facturación electrónica" que se abría tras cada venta y el botón "S" de la cabecera.
`tsc` limpio. **Por confirmar en pantalla.**

## T2 · Filtros validados en el backend `[x]`

`listSalesQuerySchema` y `creditQuerySchema`; el listado usa `rangoDeDias` (movido a `utils/fechas.js`).
**Comprobado:** `pnpm test:ventas-filtros` (nuevo, 16 comprobaciones), `test:vuelos-api` sigue en orden tras
mover `rangoDeDias`, `check:prisma` y `test:validaciones` limpios.

## T3 · Filtros validados en la pantalla `[x]`

**Confirmado en pantalla** (2026-10-08).

Búsqueda con espera de 350 ms, recortada y con tope de 100 (listado y cartera); selector y búsqueda con
etiqueta accesible; "Desde" sin pasar de "Hasta" ni de hoy, "Hasta" sin bajar de "Desde", y aviso debajo de
las fechas; un rango al revés no se pide; el error de la API se enseña sobre la tabla. `tsc` limpio.
**Por confirmar en pantalla** (no se abrió el navegador: la regla del `CLAUDE.md` pide permiso).

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-08 | T1–T3 | Siigo fuera de Ventas; filtros validados en el backend (422 por campo, días de Bogotá) y en la pantalla. |
