# Plan — Spec 017

Orden: base → servidor (reglas, escritura, lectura, filtro, sugerencias) → pruebas → pantalla. Cada paso deja la
aplicación funcionando: `destinations` es opcional, así que el formulario viejo sigue guardando clientes.

## Decisiones

1. **Una regla, un sitio.** La normalización (recortar, colapsar espacios, 2–60, repetidos por la última aparición,
   tope de 5) vive en una función `normalizarDestinos(lista)` del servidor, que usan el esquema Zod (para el 422 con
   el campo) y el servicio (para escribir). En el navegador solo se repite lo necesario para la experiencia (no
   duplicar etiquetas, desactivar a los 5); el servidor decide.
2. **`destino_reciente` lo escribe solo el servicio**, en la misma `transaccion` que `cliente_destinos`, con un
   helper `escribirDestinos(tx, clienteId, lista)`: `deleteMany` + `createMany` + `update` de la columna. Una sola
   función para alta y edición.
3. **Alta en una transacción.** Si `createClient` no crea persona y cliente dentro de una `transaccion`, los destinos
   se escriben en una propia justo después de crear el cliente (dos idas y vuelta más, no N). No se reescribe el alta
   entera de clientes para esto.
4. **Filtro en el mismo `where`** de `listClients`: `destino_reciente: { contains, mode: 'insensitive' }`, o con
   `destinationAll`, `cliente_destinos: { some: { destino: { contains, mode: 'insensitive' } } }`. Se combina con
   `AND` con la búsqueda de texto (que ya usa `OR`) y con el alcance `own`.
5. **Sugerencias:** `prisma.cliente_destinos.groupBy({ by: ['destino'], where: { destino: contains… }, _count, orderBy:
   _count desc, take: 10 })`. Repetidos que solo difieren en mayúsculas entre clientes distintos salen como dos
   sugerencias; se acepta (la RLS ya filtra por agencia, sin alcance por asesor — decisión 3 de la spec).
6. **Ruta `/clients/destinations` antes de `/:id`** en `clients.routes.js` (`paramsNumericos` rechazaría
   "destinations" como id).
7. **Componente de pantalla nuevo y pequeño**, `DestinosField.tsx`, con `AsyncCombobox` (ya existe) para las
   sugerencias y etiquetas para la lista. El detalle usa un `<details>`/botón con `aria-expanded`, sin librería.

## Pasos

| Paso | Dónde | Qué |
|---|---|---|
| 1 | `prisma/migrations/…_destinos_de_preferencia`, `schema.prisma` | Tabla `cliente_destinos` (RLS `FORCE`, `empresa_id` sin respaldo, FK compuesta con `ON DELETE CASCADE`, único `(cliente_id, orden)`, índices, permisos solo `app_nexus`, `REVOKE` a `anon`/`authenticated`) y columna `clientes.destino_reciente`. `migrate diff` → leer → `migrate deploy`; `db:generate` con el backend parado |
| 2 | `utils/destinos.js` (nuevo) | `normalizarDestinos(lista)` → `{ destinos, errores }` |
| 3 | `schemas/clients.schema.js` | `destinations` opcional en alta y edición; `superRefine` con `normalizarDestinos` → 422 en `destinations` / `destinations.<i>` |
| 4 | `services/clients.service.js` | `escribirDestinos`; `createClient` y `updateClient` lo llaman si llega `destinations`; `getClientById` y `listClients` devuelven `destinations` (por `orden`) y `recentDestination` |
| 5 | `services/clients.service.js`, `controllers/clients.controller.js` | Filtro `destination` / `destinationAll` en `listClients` (decisión 4); `destination` > 60 → 422 (esquema de query) |
| 6 | `routes/clients.routes.js`, servicio y controlador | `GET /clients/destinations?search=` con `authorize('clients','view')` (decisiones 5 y 6) |
| 7 | `tests/clientes-destinos-api.js` (nuevo), `package.json` | `pnpm test:clientes-destinos` con los casos de la spec, arnés `tests/montaje.js` |
| 8 | `tests/aislamiento.js` | `cliente_destinos` en la comprobación de RLS y en el desmontaje |
| 9 | `frontend/src/types/index.tsx`, `api/` de clientes | `destinations?: string[]`, `recentDestination?: string`; llamada a sugerencias |
| 10 | `components/clients/DestinosField.tsx` (nuevo), `ClientModal.tsx` | Campo con sugerencias, "+", Enter, etiquetas con quitar, reciente marcado, tope de 5 con aviso; error del 422 junto al campo |
| 11 | `ClientDetailModal.tsx` | Reciente + insignia "+N" + desplegable (más nuevo primero); "Sin destinos de preferencia" |
| 12 | `pages/Clients.tsx` | Filtro "Destino" con sugerencias y espera de 350 ms, casilla "Incluir destinos anteriores" |
| 13 | Docs | `tasks.md`, `backend/CLAUDE.md` (destinos de preferencia), `CLAUDE.md` (`test:clientes-destinos`), README (lista de specs) |

## Qué hace falta del usuario

- Permiso para `migrate deploy`, `db:generate` y las pruebas con BD (regla del `CLAUDE.md`); `db:generate` con
  `pnpm dev` parado.
- La prueba en pantalla.
