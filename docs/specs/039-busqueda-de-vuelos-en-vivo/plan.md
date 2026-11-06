# Plan — Spec 039

## Decisiones técnicas

1. **Ruta nueva: `/flight-search`** (inglés, como el resto de rutas: `/sales`, `/quotes`,
   `/clients`...). `/flights` queda intacta, es de Itinerarios.
2. **`utils/searchapi.js`**: la única pieza que llama a SearchApi. `SEARCHAPI_KEY` como query param
   (`api_key=...`), igual que `emailService.js` resuelve `RESEND_API_KEY` — una función, sin clase.
3. **`services/flightSearch.service.js`**: arma los parámetros (`engine=google_flights`,
   `departure_id`, `arrival_id`, `outbound_date`, `return_date` si hay vuelta, `currency=COP`),
   llama, y transforma la respuesta a `[{ airline, duration, stops, price, bookingToken }]`. La
   transformación exacta de campos se ajusta al implementar, contra una respuesta real (T0).
4. **Tope diario:** tabla `busquedas_vuelos_contador` (`empresa_id`, `fecha`, `cantidad`),
   `@@unique([empresa_id, fecha])`, RLS igual que cualquier tabla de inquilino. Se lee y se
   incrementa con un `UPSERT ... ON CONFLICT DO UPDATE SET cantidad = cantidad + 1` (una sola ida y
   vuelta, sin leer-luego-escribir). Si `cantidad` ya pasó el tope antes de incrementar, 429.
5. **Caché corta:** un `Map` en memoria del proceso (`<empresa_id>|<departure>|<arrival>|<fechas>`
   → resultado + expiración), igual de simple que `authCache.js`. No vive en la base: es
   descartable, y una caída del servidor la vacía sin problema.
6. **Ruta:** `POST /flight-search` con `auth` únicamente (sin `authorize`, por la decisión 6 de la
   spec); el controlador comprueba `getActionScope`/permisos de `quotes.create` a mano si hace
   falta ocultar la pantalla, pero el endpoint en sí no exige un permiso de módulo.
7. **Frontend:** `pages/FlightSearch.tsx` (pantalla nueva, ítem de menú "Vuelos", visible con
   `canCreate('quotes')`). Formulario con los Combobox de aeropuerto que ya usa `TicketForm.tsx`
   (mismo componente, reutilizado). Resultados en tarjetas; cada una con "Usar este vuelo" →
   navega a `Quotes.tsx` con un estado inicial que abre el asistente, categoría tiquete, con
   `TicketData` prellenado (aerolínea, precio) — mismo mecanismo que ya usa "Convertir en venta"
   para prellenar un asistente desde otra pantalla.
8. **Renombre de Itinerarios:** cambiar los textos visibles (menú en `Layout.tsx`, título de la
   pantalla en `Flights.tsx` o como se llame) de "Vuelos" a "Itinerarios". Nada de rutas,
   permisos ni componentes se renombra — es texto, no estructura.

## Pasos

| Paso | Dónde | Qué |
|---|---|---|
| 1 | `backend/prisma/migrations/`, `schema.prisma` | Tabla `busquedas_vuelos_contador` |
| 2 | `backend/src/utils/searchapi.js` (nuevo) | Llamada a SearchApi |
| 3 | `backend/src/services/flightSearch.service.js` (nuevo) | Parámetros, tope, caché, transformación |
| 4 | `backend/src/controllers/flightSearch.controller.js`, `routes/flightSearch.routes.js` (nuevos), `routes/index.js` | `POST /flight-search` |
| 5 | `backend/.env.example` | `SEARCHAPI_KEY` |
| 6 | `frontend/src/pages/FlightSearch.tsx` (nuevo), `App.tsx`, `Layout.tsx` (menú) | Pantalla "Vuelos" |
| 7 | `frontend/src/pages/Quotes.tsx` | Recibir el estado inicial y abrir el asistente con el tiquete prellenado |
| 8 | `frontend/src/components/layout/Layout.tsx`, `pages/Flights.tsx` (o su nombre actual) | Renombrar los textos visibles a "Itinerarios" |
| 9 | `backend/tests/` (nuevo archivo) | Tope diario, 429, aislamiento entre agencias, caché |
