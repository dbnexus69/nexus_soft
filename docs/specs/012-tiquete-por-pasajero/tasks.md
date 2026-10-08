# Tareas — Spec 012

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-05).** Implementada; falta probar el formulario en pantalla (T5).

### T1 · Migración `asientos` `[x]`
Columna `asientos JSONB` en `pasajeros_detalle`. **Se comprueba:** `migrate status`, `check:prisma`.

### T2 · Contrato y validación en el servidor `[x]`
`products.schema.js` y `_validarTiquetes` (pasos 2–3 del plan). **Se comprueba:** `test:vuelos-api` (422 por tramo
inexistente y titular sin reserva).

### T3 · Escritura y lectura `[x]`
`ventaProductos.js` y `mapPassengers` (pasos 4–5). **Se comprueba:** `test:vuelos-api` (cuatro asientos guardados; reserva
del titular heredada).

### T4 · Voucher `[x]`
Columna de asientos por tramo en la tabla de pasajeros; `PLANTILLA_VERSION` 2. **Se comprueba:** `test:voucher`.

### T5 · Formulario de tiquete `[x]`

**Confirmado en pantalla** (2026-10-08).
Pasos 7–10 del plan. **Se comprueba:** `tsc`, `vite build`. **En pantalla:** tiquete de ida y vuelta con dos pasajeros;
borrador viejo.

### T6 · Documentación `[x]`
`backend/CLAUDE.md` y este archivo.

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-05 | — | Diseño aprobado (asiento por pasajero y tramo, columna JSON); spec, plan y tareas escritos. |
| 2026-10-05 | T1–T6 | Migración `20261005120000_asientos_por_pasajero` aplicada. Servidor: `passengers[].asientos` validado (tramo existente, 1–4 alfanuméricos, sin repetir), reserva del titular obligatoria y heredada por los demás y por el tiquete; `tramos_vuelo.asiento` ya no se escribe. Voucher (`PLANTILLA_VERSION` 2) y detalle de la venta con reserva y asientos por pasajero. **Corregido de paso:** el voucher del servidor y el resumen del detalle leían `p.name`/`p.docNumber`, que la API no manda (`nombreCompleto`/`nroDocumento`): los pasajeros salían vacíos. Formulario: proveedor a Detalles financieros, reserva y asientos por pasajero, sin asiento en los tramos; borradores viejos pasan su reserva al titular. **Comprobado:** `test:vuelos-api` (cuatro casos nuevos), `test:voucher`, `test:aislamiento-api`, `check:prisma`, `tsc`. **Falta:** probar el formulario en pantalla. |
