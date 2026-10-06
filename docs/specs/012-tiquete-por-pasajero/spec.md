# Spec 012 — Tiquete ordenado por pasajero: reserva y asientos

**Estado:** implementada (2026-10-05), pendiente de probar en pantalla · **Rama:** `feat-bayrol` · **Toca la base
compartida** (una columna nueva) · **Relacionadas:** [`004`](../004-vuelos-y-checkin/spec.md) (tramos y check-in),
[`011`](../011-perfil-y-voucher-de-la-empresa/spec.md) (voucher en el servidor)

## Por qué

El formulario de tiquete del asistente de venta mezcla datos de bloques distintos:

- El **número de reserva** se pide arriba, en "Datos generales", como "N° de Reserva (PNR) (Titular)", y luego otra vez en
  cada pasajero que no es titular. Es un dato del pasajero.
- El **proveedor** está en "Datos generales" y es un dato financiero (a quién se le paga).
- El **asiento** se pide dos veces: en cada trayecto (un asiento por tramo para todo el tiquete) y en cada pasajero (un
  asiento para todo el viaje). Ninguno de los dos es real: cada pasajero tiene un asiento en cada tramo. Además, el asiento
  del pasajero **se pierde al guardar** (`pasajeros_detalle.asiento` existe pero `createSale` no lo escribe).

## Qué se quiere (confirmado con el usuario)

1. Cada dato en su bloque: **Datos generales** solo la aerolínea principal; **Trayectos** sin asiento; **Pasajeros** con su
   n° de reserva, n° de tiquete y **un asiento por trayecto**; **Detalles financieros** con el **proveedor**.
2. **N° de reserva por pasajero.** Obligatorio en el titular; en los demás, por defecto "igual al titular" y editable.
3. **Asiento por pasajero y por trayecto** (no uno por pasajero para todo el viaje).
4. Guardado en una **columna JSON `asientos` en `pasajeros_detalle`** (opción A), no en una tabla nueva.

## Fuera de alcance

- Check-in por pasajero (hoy es por tramo).
- Migrar los asientos de ventas viejas: se siguen mostrando desde `tramos_vuelo.asiento`.
- Editar los productos de una venta ya creada (no existe, spec 002 T8).

## Diseño

### Datos

- Migración: `ALTER TABLE pasajeros_detalle ADD COLUMN asientos JSONB` (nullable). Forma:
  `[{ "tramo": 1, "asiento": "12A" }, …]`, con `tramo` = el `orden` del tramo en su tiquete (1, 2, …), el mismo que escribe
  `ventaProductos.js` en `tramos_vuelo.orden`.
- `tramos_vuelo.asiento` y `pasajeros_detalle.asiento` se dejan como están (datos viejos); el código nuevo ya no los escribe.
- `prod_tiqueteria.nro_reserva` = la reserva del titular, la calcula el servidor.

### Contrato de la API (`POST /sales`, `ticketData[i]`)

- `passengers[j].nroReserva`: obligatorio en el titular (`esTitular`); vacío en los demás → toma el del titular.
- `passengers[j].asientos`: `[{ tramo, asiento }]`, opcional. `tramo` entero ≥ 1 que exista en el tiquete; `asiento`
  alfanumérico en mayúsculas, 1–4 caracteres. Un tramo repetido en el mismo pasajero → 422.
- `reservationNumber` del tiquete deja de ser obligatorio en el cuerpo: si llega, se ignora a favor del titular (borradores
  viejos).
- Errores → 422 con el campo (`ticketData.0.passengers.1.asientos.0.tramo`), validados antes de la transacción, como
  `_validarTiquetes`.

### Lectura

- `mapPassengers` (`catalog/products.js`) devuelve `asientos` y, para ventas viejas sin ellos, nada nuevo: el tramo sigue
  trayendo su `seat`.
- Detalle de la venta, vuelos y voucher (`plantilla.js`): la tabla de pasajeros muestra una columna por tramo con su asiento;
  si el pasajero no tiene `asientos`, se muestra el `seat` del tramo como hasta ahora.

### Formulario (`TicketForm.tsx`)

- **Datos generales:** aerolínea principal.
- **Trayectos:** sin el campo asiento.
- **Pasajeros:** por pasajero, n° de reserva (titular obligatorio; el resto con un marcador "Igual al titular" y vacío por
  defecto), n° de tiquete y una fila "Asientos" con un campo por tramo, etiquetado con su ruta (`BOG → MDE`). Agregar o
  quitar un tramo agrega o quita su campo en todos los pasajeros.
- **Detalles financieros:** proveedor, costo, ganancia, medio de pago.
- Validación del paso (`ticketSchema.ts`): fuera `reservationNumber` del tiquete y `seat` del tramo; la reserva del titular
  pasa a la lista de pasajeros.
- Un borrador viejo en `localStorage` (con `reservationNumber` arriba y `asiento` por pasajero) se abre sin romper: la reserva
  de arriba se copia al titular si él no tiene; el `asiento` suelto se descarta.

## Cómo se comprueba

- `pnpm test:vuelos-api`, casos nuevos:
  - Dos pasajeros y dos tramos: se guardan los cuatro asientos y el detalle los devuelve.
  - Un asiento en un tramo que no existe → 422 con el campo.
  - Pasajero no titular sin reserva → queda con la del titular; el tiquete toma la del titular.
  - Titular sin reserva → 422.
- `check:prisma`, `tsc` y `vite build`.
- `test:voucher` sigue en verde (el voucher con la columna de asientos).
- En pantalla (usuario): crear un tiquete de ida y vuelta con dos pasajeros, ver los asientos en el detalle y en el voucher;
  abrir un borrador guardado antes del cambio.

## Riesgos

- **El tramo se identifica por su orden.** Si el formulario reordenara tramos después de poner asientos, se moverían de
  tramo. Mitigación: los asientos se guardan en el formulario por el índice del tramo en la lista, y el servidor recibe el
  orden final.
- **Base compartida:** columna nueva y nullable; la rama de Darío no se entera.
