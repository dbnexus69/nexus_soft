# Plan técnico — Spec 013

## Decisiones

### 1. Un endpoint de lista con los totales en `meta`

`GET /stats/iva?dateFrom&dateTo&page&perPage` devuelve `{ data, meta }`. `data` es la página
de ventas; `meta` lleva la paginación habitual (`buildMeta`) y `meta.totals` con `iva`,
`ventas` y `total` **del rango entero**. Así la modal pinta cifra y lista con una sola
petición, y el dashboard pide `perPage=1` solo para leer los totales.

Alternativa descartada: un endpoint de totales y otro de lista. Dos viajes para lo mismo, y
dos sitios donde el filtro podía divergir.

### 2. El filtro es el del dashboard, en un solo sitio

`getIva` usa el mismo predicado de fechas (`creado_at` entre `dateFrom` y `dateTo`) y el
mismo alcance (`permissionScope === 'own'` → `usuario_id = user.id`) que
`getDashboardStats`. Además excluye `deleted_at` y `status = 'anulado'`.

La suma es una agregación de Prisma (`aggregate`), sin SQL crudo: no hace falta un fichero
en `prisma/sql/`, porque no hay JOIN ni CTE.

### 3. Permisos

`authorize('dashboard', 'view')` y `paginate`, igual que el resto de `/stats`. Sin
`authorize` no habría `req.permissionScope` y el endpoint devolvería datos globales a un
asesor (ver `stats.routes.js`).

### 4. Frontend

- `api/stats.ts`: `getIva` devuelve el sobre completo (no solo `data`), porque los totales
  van en `meta`. Tipos `VentaIva` y `RespuestaIva`.
- `components/dashboard/IvaBreakdownModal.tsx`: copia la estructura de
  `CreditBreakdownModal` (cifra arriba, lista debajo, `Pagination` compartido). Vuelve a la
  página 1 cuando cambia el rango y descarta respuestas viejas con un contador de peticiones.
- `pages/Dashboard.tsx`: la cifra va en el panel de contexto (`dl`), no como tercer titular,
  porque el propio código dice que hay dos titulares por dashboard y nada más.

## Archivos

| Archivo | Cambio |
|---|---|
| `backend/src/services/stats.service.js` | `getIva` |
| `backend/src/controllers/stats.controller.js` | `iva` |
| `backend/src/routes/stats.routes.js` | `GET /iva` con `authorize`, `validateQuery`, `paginate` |
| `frontend/src/api/stats.ts`, `frontend/src/api/index.ts` | `getIva`, tipos |
| `frontend/src/components/dashboard/IvaBreakdownModal.tsx` | nuevo |
| `frontend/src/pages/Dashboard.tsx` | cifra, estado, efecto y modal |

## Verificación

- Prueba desechable por la API, no versionada, con agencia propia: 17 comprobaciones contra la
  base (ver `tasks.md`).
- `pnpm test:aislamiento-api`: sin fallos.
- `pnpm check:prisma`, `tsc` del frontend: sin problemas.
