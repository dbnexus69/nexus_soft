# Tareas — Spec 039

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-11-04).** Implementada; falta aplicar la migración (`db:generate`/`migrate deploy`,
necesita permiso) y la prueba por la API.

## T0 · Confirmar la forma de la respuesta de SearchApi `[x]`

Dos llamadas reales (con la clave del usuario): solo ida trae `best_flights`/`other_flights`, cada
ítem con `flights[]`, `layovers[]`, `total_duration`, `price`, `type`, `booking_token`. Ida y
vuelta NO trae `booking_token` en la misma llamada —da un `departure_token` por cada ida, y hay
que volver a llamar con él para ver las vueltas—, así que ida y vuelta queda fuera de esta primera
versión (decisión 9 de `spec.md`).

## T1 · Tabla y tope diario `[x]`

`busquedas_vuelos_contador` (migración `20261104120000_tope_de_busquedas_de_vuelos`, aditiva, RLS,
igual que el resto de tablas de inquilino). `schema.prisma` validado (`npx prisma validate`).
**Pendiente:** aplicar contra la base (`db:generate` + `migrate deploy`, necesita permiso).

## T2 · Servicio y llamada a SearchApi `[x]`

`utils/searchapi.js` (la única pieza que llama a SearchApi) + `services/flightSearch.service.js`
(tope con `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` atómico, caché en memoria GLOBAL —no
por agencia, el precio de un vuelo no es dato de ninguna agencia—, transformación según T0).
`SEARCHAPI_KEY` en `.env` y placeholder en `.env.example`.

## T3 · Ruta `/flight-search` `[x]`

`schemas/flightSearch.schema.js`, `controllers/flightSearch.controller.js`,
`routes/flightSearch.routes.js`, montada en `routes/index.js`. Solo `auth`. `node --check` y
`check:prisma` en verde (el `$queryRaw` del tope no interpola nada, no hay DMMF que regenerar
para esto).

## T4 · Pantalla "Vuelos" `[x]`

`pages/FlightSearch.tsx`: Combobox de aeropuerto (reutilizado de `TicketForm.tsx`, mismos datos
de `data.config.airports`), `DatePicker`, tarjetas de resultado, "Usar este vuelo" → navega a
`/quotes` con `state.prefillTicket`; `Quotes.tsx` lo recoge en un `useEffect`, abre el asistente
con la categoría tiquete ya llena (`INITIAL_TICKET()` + aerolínea/precio/tramo) y limpia el
estado de la navegación (`replace`) para que recargar no lo repita. Ítem de menú "Vuelos" en
`Sidebar.tsx` (visible con `quotes` view, como el resto del menú), gateado de verdad por
`canCreate('quotes')` dentro de la página. `tsc` en verde.

## T5 · Renombre a "Itinerarios" `[x]`

Solo texto visible: `Sidebar.tsx` ("Vuelos" → "Itinerarios") y `Header.tsx` (el título de la
pantalla en el encabezado). La página (`pages/Itineraries.tsx`) ya decía "Itinerarios de Vuelo"
de antes — faltaba el menú y el encabezado. Sin tocar rutas ni permisos.

## T6 · Prueba por la API `[ ]`

Tope diario y su 429, aislamiento del contador entre agencias, caché (no se repite la llamada
dentro de la ventana). Pendiente — necesita permiso para correr contra la base.

## T7 · Pantalla "a lo Google Flights": pasajeros/clase, orden, filtros, insights, calendario `[x]`

A pedido del usuario, con capturas de Google Flights como referencia. Decisiones nuevas:
- **Pasajeros y clase** se agregan al buscador y viajan a SearchApi (`adults`, `travel_class`);
  entran en la clave de caché (resultados distintos por pasajero/clase).
- **`price_insights`** (bajo/típico/alto + rango + historial) ya viene en la MISMA búsqueda,
  confirmado con una llamada real — se muestra como aviso arriba de los resultados.
- **Orden** (Recomendado / Más económicos) y **filtros** (paradas, aerolínea, precio máximo) son
  client-side sobre lo ya traído: no cuestan una búsqueda más.
- **Calendario de precios** (`engine=google_flights_calendar`): confirmado con una llamada real que
  es UNA sola llamada (una grilla ida/vuelta completa, no una por día) — no rompe el tope diario,
  al contrario de lo que se pensó al principio. Pero esa API es solo para ida y vuelta (exige
  `return_date`, fuerza `flight_type: round_trip`) y no da `booking_token`; como ida y vuelta sigue
  fuera de alcance (T0), el calendario queda como referencia pura — elegir una fecha ahí no abre
  una cotización, el asesor busca esa fecha de ida arriba, solo ida, para usarla. Ruta nueva
  `POST /flight-search/calendar`, mismo tope y misma caché (prefijo `cal:`) que la búsqueda normal.
- Fila de resultado rediseñada (hora–hora, duración, ruta, CO2, precio, como la captura), con
  "Ver detalles" y "Usar" aparte. `tsc` y `check:prisma` en verde.

---

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-11-04 | — | Diseño vía `/brainstorming`: caso de uso (cotizar), proveedor (SearchApi, cambiado de SerpApi a mitad del diseño), clave única paga por DBNEXUS, tope diario por agencia, caché corta, sin permiso de módulo nuevo, elegir un resultado abre una cotización nueva, y el módulo de check-in se renombra a "Itinerarios" (solo el texto, no la URL ni el permiso). Spec y plan escritos; nada implementado. |
| 2026-11-04 | T0-T5 | Implementado tras la aprobación ("dale empecemos con la implementación"). T0 con llamadas reales a SearchApi (clave del usuario): confirmó la forma de la respuesta y que ida y vuelta necesita dos pasos — se dejó fuera de alcance (decisión del usuario). Migración, servicio, ruta y pantalla escritos; `npx prisma validate`, `node --check`, `check:prisma` y `tsc` en verde. Falta aplicar la migración contra la base y la prueba por la API (T6), las dos con permiso pendiente. |
| 2026-11-04 | — | Puesto en marcha: `db:generate` falló por el `EPERM` de Windows con el backend corriendo (se paró y se volvió a generar), faltaba aplicar la migración de este spec Y la de proveedores (spec 037) contra la base (`migrate deploy`, con permiso), y `frontend/.env` tenía un `VITE_API_URL` viejo apuntando a `/api` sin `/v1` (de antes de que Bayrol lo quitara) — corregido quitando la variable, para que vuelva a usar el proxy de Vite del mismo sitio (hace falta además para la cookie de sesión httpOnly). |
| 2026-11-04 | T4 | A pedido del usuario: la tarjeta sigue mostrando lo básico, pero cada resultado ahora trae todo lo que documenta SearchApi (tramos con aeropuerto/hora exactos, avión, clase, extras, equipaje, escalas, emisiones de carbono, precio típico de la ruta si viene) detrás de un botón "Ver detalles". `transformarOpcion`/`transformarTramo` en el servicio ya no recortan esos campos; `buscarVuelos` devuelve `{ results, priceInsights }` en vez de un array a secas. `tsc` y `check:prisma` en verde. |
| 2026-11-04 | T7 | El usuario pidió una pantalla "muy completa, parecida a Google Flights" (con capturas) y, a mitad de camino, agregar el calendario de precios usando la API de SearchApi para eso. Se confirmó con una llamada real que el calendario es una sola llamada (no rompe el tope) pero es solo ida y vuelta y sin `booking_token` — el usuario decidió dejarlo como referencia pura, sin "usar" directo, en vez de construir ida y vuelta completo ahora. Implementado: pasajeros/clase, aviso de precios típicos, orden y filtros client-side, calendario de referencia, fila de resultado rediseñada. `tsc` y `check:prisma` en verde; sin commit ni push. |
| 2026-11-05 | T7 | Corrección sobre lo anterior, a pedido del usuario ("busca primero como funciona el de Google Flights"): con `flight_type=one_way` explícito, `engine=google_flights_calendar` SÍ da calendario de ida sola (confirmado con una llamada real) — no hacía falta `return_date`, el intento anterior simplemente no mandaba `flight_type` y SearchApi lo tomaba por ida y vuelta. Rehecho para que coincida con el calendario real de Google (un precio por día, de a 7, como el "viajes de 7 días" de la captura): `buscarCalendario` ya no pide `returnDate`, `FlightCalendarEntry` perdió el campo `return`, y la pantalla cambió la cuadrícula ida×vuelta por una tira de 7 días con "Próximos 7 días →" y cada día lleva directo a buscarlo arriba (sigue sin `bookingToken`, pero ahora al menos la fecha es real). `tsc` y `check:prisma` en verde. |

## T8 · Ida y vuelta completo, de dos pasos `[x]`

A pedido del usuario ("necesito que se pueda seleccionar si es ida y vuelta"), revierte la decisión
9 original (solo ida). Confirmado con llamadas reales el flujo de dos pasos de SearchApi: sin
`departureToken` la búsqueda da las IDAS (con `departure_token` en vez de `booking_token`, precio de
referencia); con `departureToken` da las VUELTAS para esa ida, ya con el precio real y el
`booking_token`. Implementado:
- `searchFlightsSchema`: `tripType`, `returnDate` (obligatoria si `round_trip`), `departureToken`.
- `flightSearch.service.js`: `buscarVuelos` arma `flight_type`/`return_date`/`departure_token` según
  corresponda; la clave de caché los incluye; `transformarOpcion` agrega `departureToken`.
- `FlightSearch.tsx`: selector "Solo ida / Ida y vuelta" junto a las fechas (en la misma fila, no
  una arriba de la otra — el otro pedido del usuario); al elegir ida y vuelta, el botón de cada fila
  pasa a "Elegir esta ida" y dispara el segundo paso; la pantalla muestra "Vuelos de ida"/"Vuelos de
  vuelta" con un "← Cambiar la ida"; "Usar" en una vuelta arma la cotización con `legs` (ida) +
  `returnLeg` (vuelta) y `flightMode: round_trip`. El precio de la ida se marca "estimado" hasta
  elegir la vuelta. `tsc` y `check:prisma` en verde; sin commit ni push.
