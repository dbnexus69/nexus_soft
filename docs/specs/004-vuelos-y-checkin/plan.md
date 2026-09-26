# Plan técnico — Spec 004

El razonamiento de las tres decisiones de diseño (días de Bogotá, dirección deducida, alta validada)
y lo descartado está en [`docs/designs/vuelos-fechas-de-bogota-y-direccion.md`](../../designs/vuelos-fechas-de-bogota-y-direccion.md).

## Decisiones

1. **Rango de fechas en días de Bogotá.** `rangoDeDias(dateFrom, dateTo)` (`flights.service.js`) acepta `AAAA-MM-DD` o un instante y devuelve `[desde, hasta)` con `hasta` = medianoche de Bogotá del día siguiente. Se filtra `salida >= desde AND salida < hasta`. El frontend manda días, no `toISOString()`. Los planes reciben el mismo rango en SQL.
2. **Dirección al leer.** `direccionesDeUnIdaYVuelta`: ordena los tramos por salida y parte la lista en el mayor hueco entre la llegada de uno y la salida del siguiente; antes es `ida`, después `regreso`. Solo se aplica a `round_trip`; el resto es `ida`.
3. **Aerolínea por tramo** (`t.aerolineas`) con la del producto como reserva.
4. **Planes:** se excluye `tipo_transporte = 'Terrestre'`; el `viewScope` se pasa también desde `listFlights` (faltaba).
5. **Sin carrera en el resumen del producto.** `recalcularProducto` empieza con `SELECT … FOR UPDATE` sobre `prod_tiqueteria`, que serializa los check-ins del mismo tiquete dentro de su transacción.
6. **Alta de tiquetes validada antes de la transacción** (`_validarTiquetes`, `_planEquipajeId` en `sales.service.js`): aeropuertos por código en mayúsculas contra el catálogo precargado, plan de equipaje por `"<aerolínea> - <tarifa>"` (sin distinguir mayúsculas) o por id. 422 con `AppError` y `details` por campo. Se elimina la creación de `UNK`.
7. **`paginate` normaliza `search`** (un arreglo pasa a su último valor; lo que no es texto, a vacío).
8. **Lo que devuelve el detalle:** `catalog/products.js` lee las columnas reales de `prod_planes` y expone los cuatro vuelos y el check-in de ida/regreso; cada tramo trae `checkinStatus` y `checkinReason`. `serviceShapes.tsx` pinta la ruta multidestino sin perder paradas, el estado por tramo, y el paquete con sus vuelos y los productos incluidos (`includedProducts`).
9. **Pantalla `Itineraries.tsx`:** día "hoy" y estado vencido/urgente en hora de Bogotá; el calendario muestra esqueleto al cambiar de mes y un aviso con "Reintentar" si falla; lo mismo la lista de check-in; la página se recoloca si deja de existir; el correo no enviado (`sin_correo`, `error_adjunto`, `error_envio`) se avisa; los avisos se cierran solos; se puede volver un check-in realizado a pendiente.
10. **Datos:** `UPDATE politicas_equipaje` de los ids 6, 7 y 15 (`Básica`, `Óptima`, `Económica`) en la base compartida.

## Superficie de API

| Cambio | Detalle |
|---|---|
| `POST /sales` (tiquetes) | 422 con `details` por campo si un aeropuerto o un plan de equipaje no existe. |
| `GET /flights`, `GET /flights/checkins` | `dateFrom`/`dateTo` son días (o instantes) de Bogotá, ambos inclusivos. `?search` repetido ya no da 500. |
| Detalle de venta, plan | Campos reales del paquete (`flightDepartureDate`, `checkinStatusOutbound`, …); desaparecen los que nunca tuvieron valor (`includesFlight`, `mealPlan`, …). |
| Detalle de venta, tramo | `checkinStatus`, `checkinReason`. |

Sin migraciones ni endpoints nuevos.
