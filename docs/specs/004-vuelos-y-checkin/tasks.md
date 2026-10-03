# Tareas — Spec 004

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-01).** Servidor y pantalla hechos; la pantalla sin probar en el navegador.

## T1 · Servidor de vuelos `[x]`
Rango en días de Bogotá, dirección deducida, aerolínea por tramo, planes terrestres fuera, `viewScope`, bloqueo de fila en el resumen, `search` normalizado. **Comprobado** con la API real: 63 comprobaciones, 0 fallos (la carrera de 4 check-ins simultáneos dio producto `realizado` 3 de 3 veces; antes 0 de 3).

## T2 · Alta de tiquetes validada `[x]`
Aeropuertos y plan de equipaje comprobados antes de la transacción; sin `UNK`. **Comprobado**: 422 con el campo, minúsculas aceptadas, plan por texto y por id guardado en producto y tramo.

## T3 · Detalle de la venta `[x]`
Plan con columnas reales, estado por tramo, ruta multidestino, paquete con vuelos y productos incluidos. `tsc --noEmit` limpio; el JSON del servidor lo comprobó la prueba de la API, el pintado no.

## T4 · Pantalla de itinerarios `[~]`
Ver decisión 9 del plan. `tsc` limpio. **Por confirmar en el navegador:** cambiar de mes (esqueleto), cortar la red (aviso y "Reintentar"), marcar/deshacer un check-in, cancelar con motivo, ver el detalle de un paquete.

## T5 · Catálogo compartido `[x]`
Tarifas 6, 7 y 15 de `politicas_equipaje` corregidas (antes `BÃƒÂ¡sica`, `Ãƒâ€œptima`, `EconÃƒÂ³mica`). Se buscó el mismo daño en aeropuertos, aerolíneas y el resto de columnas de tarifas: no hay más. El aeropuerto DXB, que se sospechaba, está bien.

## T10 · Check-in realizado por otro medio `[~]`

Pedido: dejar constancia de un check-in hecho por WhatsApp u otro canal ajeno a la aerolínea, sin
pasar por el modal de adjuntar comprobante que ya existía (`handleMarkCheckin`).

`handleQuickCheckin` (`Itineraries.tsx`): un botón nuevo, "Check-in realizado", junto a "Realizar
Check-in" en cada fila pendiente de la lista de check-in. Llama a `PUT /flights/:id/checkin` con
`{ checkin: 'realizado' }` directo —el mismo endpoint y el mismo cuerpo mínimo que ya aceptaba el
modal cuando se confirmaba sin adjuntar archivo—, sin modal ni adjunto. Mismo patrón que ya usa
"Marcar pendiente" (acción directa, con su propio aviso de éxito o error).

**Comprobado:** `tsc --noEmit` limpio; el backend no necesitó ningún cambio, porque el camino que
usa (`checkin: 'realizado'` sin adjuntos) ya era válido desde antes.

**Por confirmar en navegador:** pulsar el botón en un vuelo pendiente y verificar que pasa a
"Realizado" sin pedir ningún archivo.

## T9 · Creación de ventas intermitente `[x]`

Reportado: en 2 de 4 corridas una venta dio 500 o timeout, con un mensaje de Prisma distinto cada vez.

**La causa:** `createSale` escribe toda la venta en una transacción interactiva, una fila por ida y
vuelta en serie (línea, detalle, cada tramo, cada pasajero), a ~0,6–1,2 s cada una contra el pooler.
La duración crece con el tamaño de la venta, y el tope de la transacción era de 30 s. Al cumplirse,
Prisma cierra la transacción y falla la consulta que esté corriendo en ese momento —por eso el mensaje
cambiaba: depende de cuál le toque—. Con la latencia del pooler variando, la misma venta pasaba o no.

**Reproducido** con una agencia desechable (`verif-t9-*`, ping ~650 ms), con payloads iguales a los del
asistente: S (1 restaurante) 3 s · M (hotel, seguro y tour con 2 personas) 8 s · L (tiquete de 3 tramos
y 4 pasajeros, hotel) 10 s · XL (2 tiquetes, 6 pasajeros, 4 productos más) 18–20 s. Una venta de grupo
(3 tiquetes de 6 tramos y 8 pasajeros, hotel, seguro y tour con 8) falló a los 31,5 s con
`Transaction not found` en el `personas.upsert` que estaba corriendo. La venta fallida se deshizo
entera (0 filas sueltas): el problema es que falle, no que corrompa.

**Lo hecho:** el tope de la transacción de `createSale` pasa de 30 s a 120 s (`sales.service.js`). Es el
único caller de `transaccion()` cuyo número de consultas crece con el cuerpo de la petición; los
demás tienen un número fijo y siguen con los 30 s por defecto. Ni el cliente (`axios`, sin timeout)
ni Node (5 min) cortan antes.

**Comprobado:** la misma venta de grupo, 201 en 42 s, con sus 6 productos, 18 tramos y 48 pasajeros, y
TA, IVA (19 %) y total cuadrados. `check:prisma` limpio, `test:aislamiento` en verde. Agencias de prueba
desmontadas.

*Anotado sin arreglar:* una venta así tarda 40 s, que es mucho para quien espera. Si pasa en la
práctica, el arreglo de fondo es agrupar tramos y pasajeros con `createMany` (menos idas y vueltas),
marcado con `ponytail:` en el código. Y, encontrado al armar la prueba: `products.schema.js` valida
`insuranceData[].travelers` como número, pero `_precargarCatalogos` lo recorre como lista, así que un
número pasa la validación y da 500. El asistente nunca manda `travelers` (usa `members`), así que solo
sale con un cuerpo armado a mano.

## Pendientes

- **T6 · Cancelar vuelos de paquete** `[ ]` — exige columnas nuevas en `prod_planes` (migración; afecta a la otra rama).
- **T7 · `TOPE_PLANES` y estadísticas** `[ ]` — paginar los vuelos de paquete y contarlos en el panel.
- **T8 · Pasar la prueba de la API a `backend/tests/`** `[ ]` — hoy vive fuera del repo; montar agencias temporales exige `DIRECT_URL`.
- **T9 · Creación de ventas intermitente** `[x]` — ver la sección T9 abajo.

## La prueba que se queda

Pendiente de T8. Mientras tanto, esto es lo que hace, para poder rehacerla:

1. Levanta un servidor propio en otro puerto con el rol de la aplicación.
2. Crea dos agencias con el servicio real de altas (`verif-vue-a-…`, `verif-vue-b-…`) y entra en cada una.
3. Vende por `POST /sales`: plan de equipaje por texto y por id, uno inexistente, ida y vuelta simple, ida de 3 tramos y vuelta, aeropuerto inexistente y en minúsculas, salida en 30 horas (crítico), salida ayer, salida a las 23:30, paquete con vuelos, paquete con tiquete hijo, paquete terrestre y una venta en la otra agencia.
4. Lee `GET /flights` y `GET /flights/checkins`: dirección y ruta de cada tramo, día y hora de Bogotá, paquete terrestre ausente, filtros de un día y de un rango, contadores (`pendiente + realizado + cancelado = total`, `critico ≤ pendiente`), orden de pendientes.
5. Opera el check-in: registrar, adjuntar y servir el adjunto (con la sesión propia, sin sesión y con la de la otra agencia), revertir, cancelar (motivo corto → 422, con espacios en los bordes se mide recortado), no escribir `cancelado` ni `critico` por el `PUT`, cancelar un vuelo de paquete (400 con mensaje).
6. Lanza cuatro check-ins simultáneos sobre el mismo tiquete, tres veces, y mira el producto en la base.
7. Ataca por id desde la otra agencia (404), ids mal formados (400), estado inválido (400), `?search` doble (sin 500) y anula la venta (sus vuelos salen del calendario y de los contadores).
8. Desmonta lo creado solo si el identificador empieza por `verif-vue-` y borra de `uploads/` los ficheros de prueba por su contenido exacto.

Resultado de la última corrida: **63 correctas, 0 fallos.** Antes de los arreglos: 46 correctas, 11 fallos.

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-03 | T9 | Las ventas grandes se cortaban al cumplir los 30 s de la transacción (una ida y vuelta por fila, a ~1 s cada una). Reproducido y confirmado; el tope de `createSale` pasa a 120 s. Una venta de grupo que fallaba a los 31,5 s ahora pasa en 42 s, completa. |
| 2026-10-01 | T10 | Botón "Check-in realizado" para dejar constancia de un check-in hecho por WhatsApp u otro medio, sin pasar por el modal de adjuntar comprobante. |
| 2026-09-25 | T5 | Corregidas 3 tarifas corruptas del catálogo compartido. |
| 2026-09-25 | T4 | Pantalla: errores visibles, Bogotá, correo, deshacer check-in. |
| 2026-09-25 | T3 | Detalle: plan con datos reales, estado por tramo. |
| 2026-09-25 | T2 | Alta de tiquetes: 422 en vez de `UNK` y plan de equipaje resuelto. |
| 2026-09-25 | T1 | Servidor de vuelos: 63/63 por la API real. |
