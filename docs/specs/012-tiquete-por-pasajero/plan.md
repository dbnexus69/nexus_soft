# Plan — Spec 012

Orden: base → servidor (escritura, validación, lectura) → voucher → formulario. Cada paso deja la aplicación funcionando:
el servidor acepta el cuerpo nuevo y el viejo hasta que el formulario cambia.

| Paso | Dónde | Qué |
|---|---|---|
| 1 | `prisma/migrations/…_asientos_por_pasajero`, `schema.prisma` | Columna `asientos JSONB` en `pasajeros_detalle`; `db:generate` (con el backend parado) |
| 2 | `schemas/products.schema.js` | `passengers[].asientos` (`tramo` int ≥ 1, `asiento` `^[A-Z0-9]{1,4}$`, sin tramos repetidos), `nroReserva`; `reservationNumber` opcional |
| 3 | `sales.service.js` `_validarTiquetes` | Titular con reserva; cada `tramo` existe en el tiquete (cuenta de `legs` + `outboundStops` + `returnLeg` + `returnStops`, la misma que `ventaProductos.js`); 422 con el campo |
| 4 | `services/ventaProductos.js` | Escribe `asientos` y `nro_reserva` (el del titular si viene vacío); `prod_tiqueteria.nro_reserva` = el del titular; deja de escribir `tramos_vuelo.asiento` |
| 5 | `catalog/products.js` `mapPassengers` | Devuelve `asientos` |
| 6 | `services/voucher/plantilla.js` | Tabla de pasajeros: columna por tramo con el asiento (o el `seat` del tramo si no hay); subir `PLANTILLA_VERSION` |
| 7 | `frontend/src/types/index.tsx`, `wizardData.ts` | `asientos` en el pasajero; fuera `asiento`/`seat` de lo nuevo |
| 8 | `TicketForm.tsx` | Bloques reordenados (proveedor a financieros, reserva y asientos al pasajero, sin asiento en el tramo) |
| 9 | `validations/sales/ticketSchema.ts`, `validarPaso.ts` | Reglas nuevas; lectura de borradores viejos |
| 10 | Detalle de la venta (`detail/serviceShapes.tsx` o donde se pinte el tiquete) | Asientos por pasajero y tramo |
| 11 | `tests/vuelos-api.js` | Los cuatro casos de la spec |
| 12 | Docs | `tasks.md`, `backend/CLAUDE.md` (asientos por pasajero) |
