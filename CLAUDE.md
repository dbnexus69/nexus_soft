# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Skills de uso OBLIGATORIO

| Skill | Cuándo activar | Instalar si no existe |
|---|---|---|
| `ponytail` | SIEMPRE en cualquier corrección, creación de código o cumplimiento de tarea. Favorece la solución más simple y mínima que funciona. | `npx skills add https://github.com/dietrichgebert/ponytail --skill ponytail` |
| `ui-ux-pro-max` | Al diseñar, construir o revisar interfaces (accesibilidad, interacción, formularios, color, tipografía). Solo la skill principal, auditada el 2026-10-03 (sin red, solo Python estándar). Usar su búsqueda (`python .claude/skills/ui-ux-pro-max/scripts/search.py "<consulta>" --domain ux`) y no las demás skills del paquete. | Ya instalada en `.claude/skills/ui-ux-pro-max` |

## Reglas de trabajo

- **Modo cavernícola (ahorro de tokens).** Respuestas cortas y directas: lo hecho, lo que falla, lo que hay que decidir; sin recapitulaciones, sin repetir lo que el usuario ya sabe, sin explicar lo que el código o el commit ya dicen. Leer solo lo necesario, no volver a leer lo ya leído, y agrupar llamadas. Mismo criterio que `ponytail`: la solución mínima que funciona.

- **No hacer commit ni push sin que el usuario lo pida.** Se termina el cambio y se deja en el árbol de trabajo; el commit y el push (y cualquier merge) solo cuando lo ordene.

- **Pruebas solo cuando hacen falta.** No correr todas las suites por rutina: solo la que cubre lo que se tocó (p. ej. `test:aislamiento-api` si cambió tenencia/permisos, `test:vuelos-api` si cambió vuelos o el alta de ventas, `tsc` si cambió el frontend). Si el cambio no lo requiere (docs, comentarios, textos), no se corre nada. Menos comandos por turno.

- **No abrir ni manejar el navegador sin permiso expreso del usuario.** Sin esa orden no se usan las herramientas del navegador (ni el integrado ni Chrome) ni se levantan servidores para verlo. Se termina la tarea, se comprueba lo que se pueda sin navegador (`tsc`, `check:prisma`, pruebas, la API) y se explica qué hay que hacer en pantalla para probarla.

## Project overview

Nexus Soft is a **multi-tenant** travel-agency management system: sales/bookings, clients, commissions, itineraries, users/roles, stats. Each agency is an `empresa` with isolated data. Two independent pnpm packages with no shared workspace: `backend/` (Express 5 + Prisma 6, CommonJS, no TypeScript, PostgreSQL on Supabase) and `frontend/` (React 19 + Vite + TypeScript + Tailwind). Code comments, docs and UI are in Spanish. **Not deployed anywhere yet** — everything is built and verified locally; do not assume or introduce a hosting target (Render, Vercel or otherwise) until the project actually has one.

`README.md` documents conventions in depth, with measured before/after timings (DB connection strings, pagination, typed SQL, objects-vs-raw-SQL, never computing totals in the browser). `docs/specs/001-multi-tenant/{spec,plan,tasks}.md` is the multi-tenant spec and its task log; `docs/decisions/` and `docs/designs/` hold rationale. Read those before touching tenancy, pagination or the sales list.

## Commands

Run from `backend/` or `frontend/`, not the repo root.

```bash
# backend
pnpm dev                 # node --watch src/index.js, http://localhost:3000 — .env is read only at startup, restart after editing it
pnpm start
pnpm db:generate         # prisma generate --sql (typedSql preview; also what `pnpm build` runs; needs DB access). Required after any schema.prisma change
pnpm check:prisma        # scripts/check-prisma-fields.js — validates every prisma.<model>.<method>({...}) call against the DMMF (catches camelCase vs snake_case); exits 1 on findings
pnpm test:aislamiento    # tests/aislamiento.js — builds a 2nd agency, checks RLS isolation, tears it down
pnpm test:aislamiento-api # tests/aislamiento-api.js — starts its own server on :3917, two agencies + a test superadmin; checks isolation through the real API (ids, files, asesor role, settlements, impersonation); ~1-2 min, tears down everything
pnpm test:validaciones    # tests/validaciones.js — person-data rules (document by type, names, phone…); no DB needed
pnpm test:vuelos-api      # tests/vuelos-api.js — flights/check-in through the real API (spec 004): Bogotá days, direction, counts, check-in, package flights, concurrency; same harness as aislamiento-api (tests/montaje.js)
pnpm test:ventas-filtros # tests/ventas-filtros-api.js — sales list and credit filters (spec 016): Bogotá days, 422 per invalid field
pnpm test:voucher        # tests/voucher-api.js — company profile and logo through the real API (spec 011); uploads under the `prueba/` folder of the buckets, removed on teardown
pnpm test:reglas-espejo   # tests/reglas-espejo.js — compiles frontend/src/utils/datosPersona.ts and compares it with the server copy on ~800 inputs; no DB
pnpm db:seed | db:studio

# frontend
pnpm dev                 # vite, http://localhost:5173
pnpm build               # tsc && vite build — tsc is the type check
```

CI is written in `docs/ci/ci.yml` but **not active yet** (git's token lacks the `workflow` scope; see `docs/specs/010-calidad-y-rendimiento/tasks.md` T2): once moved to `.github/workflows/` it runs the frontend build and, in the backend, `check:prisma`, `test:validaciones` and `test:reglas-espejo` on every push; the DB-backed suites stay manual. No lint config and no test framework. Run `pnpm check:prisma` after touching Prisma queries and `pnpm test:aislamiento` and `pnpm test:aislamiento-api` after touching tenancy/RLS/auth/permissions; run `pnpm build` in `frontend/` for a type check. `db:push` / `db:reset` exist in `package.json` but must not be run against the shared DB (see below).

## Database and migrations

- **Use versioned migrations, never `db push`.** The repo has `prisma/migrations/` (baseline `0_init`, then one per change). `db push`/`db:reset` build the DB from `schema.prisma` alone and would not run the RLS policies, composite FKs, `empresa_id` defaults, `numero` triggers and SQL functions that live only in raw migration SQL — do not run them against the shared Supabase DB. The workflow is `prisma migrate diff` → read the SQL → `prisma migrate deploy` (`migrate dev` needs a shadow DB that the Supabase role can't create). Existing migrations must not be edited (checksums); corrections go in a `NOTA.md` next to them.
- `migrate diff` against the datasource is never fully empty: the composite `(id, empresa_id)` foreign keys, RLS and SQL functions live only in raw migration SQL. `prisma migrate status` is the real "in sync" check.
- Connection strings (details in README): `DATABASE_URL` = Supabase transaction pooler, port 6543, `?pgbouncer=true&connection_limit=10&pool_timeout=20` (with `connection_limit=1` the initial load times out and returns 500s). `DIRECT_URL` = **session pooler on port 5432**, not `db.<ref>.supabase.co` (IPv6-only, unreachable → `P1001`). Both are needed to run `prisma generate --sql`.
- **`DATABASE_URL` must use the `app_nexus.<ref>` role, which has no `BYPASSRLS`.** With `postgres` the RLS policies apply without error and filter nothing, silently voiding tenant isolation. `postgres` belongs only in `DIRECT_URL` (migrations). Must also be set that way in the hosting env. `pnpm test:aislamiento` fails fast if the role bypasses RLS, and `src/index.js` refuses to start (exit 1) for the same reason.
- The app never uses Supabase's REST API or its `anon`/`authenticated` roles: migration `20260924010000_sin_permisos_para_anon_ni_authenticated` revoked all their privileges in `public` (and default privileges for new objects), and `20260924000000_cerrar_la_api_rest_de_supabase` closed the `app_*` functions. New tables created by migrations get grants only for `app_nexus`; keep it that way. Supabase's security advisors (`get_advisors`) should stay empty after any migration.
- Table/column names are Spanish. Schema fields are **snake_case** (`monto_total`, `creado_at`) except where `@map` is used, in which case the Prisma-side name is what code must use. Product subtypes have one table each (`prod_*`); `detalle_venta.categoria` is the `ProductCategory` enum.

## Backend architecture

`src/index.js` → helmet, CORS explicit allowlist (`FRONTEND_URL` + localhost; no wildcard), rate limits, `/api` and `/api/v1` (same router; the frontend targets `/api/v1`). Each feature is **route → middleware (`auth`, `authorize`, `validate` against `schemas/*.schema.js` Zod schemas) → controller → service → Prisma**; `routes/index.js` mounts each resource. Responses use `utils/apiResponse.js` (`{ success, data, meta }` / `{ success:false, error:{ message, code } }`), errors flow to `middleware/errorHandler.js` (maps Prisma codes, Zod, multer, `errors/AppError.js`).

**Logging convention.** Comments, docs and UI text are Spanish, but any ad-hoc `console.error`/`console.warn` outside `errorHandler.js` (a swallowed failure that doesn't reach the client, e.g. a background email send) is written in **English**, tagged with a short `SCREAMING_SNAKE_CASE` code naming the failure — e.g. `[WELCOME_EMAIL_FAILED]`, `[RECOVERY_EMAIL_FAILED]`, `[EMAIL_SEND_FAILED]` — mirroring how `AppError`'s own `code` field is named (`NOT_FOUND`, `VALIDATION_ERROR`, `DUPLICATE`...). This is deliberately a different tag style from `errorHandler.js`'s own `[ERROR]`/`[ERROR META]`/`[ERROR STACK]` + `referencia`, which is reserved for truly unexpected 500s (expected rejections — 4xx, translated Prisma/Zod/multer errors — log one `[REQUEST_REJECTED]` line without a stack); reusing `[ERROR]` for a routine, already-handled failure makes the two impossible to tell apart when grepping logs. The same applies in the frontend: comments and UI stay Spanish, but `console.error`/`console.warn` messages are English.

Flights/check-in is the one naming split worth knowing: the screen and API are `/flights` (was `/itineraries`, which redirects), but the permissions module key is still `itineraries` because that is what is stored in `permisos_rol`.

### Tenancy: Postgres enforces it, the code only says who is asking

- `middleware/auth.js` verifies the JWT (which carries `empresaId`; pre-multi-tenant tokens are rejected with `SESSION_SIN_EMPRESA`), checks the session row in `sesiones` (logout/password change revoke it; cached in `authCache.js`; on each cache miss the same query renews it, so a session without "remember me" expires after 30 min of inactivity — `GREATEST` never shortens a 7-day one), and **opens the tenant context** with `conEmpresa(...)` from `config/tenant.js` (an `AsyncLocalStorage`). The empresa comes from the token, never the URL. There is no unauthenticated bypass.
- `config/db.js` exports a Prisma client extended so every query runs in a batch transaction with `set_config('app.empresa_id', …, true)`; RLS policies (`empresa_id = app_empresa_actual()`) on the 42 business tables do the actual filtering. A `SET LOCAL` inside an interactive transaction does not work over the pooler (the query and the `SET LOCAL` land on different connections). No context → no rows visible/insertable.
- **Never add `where empresa_id` filters or set `empresa_id` in a `create`** — two sources of truth is the bug this design avoids. Every tenant column defaults to `current_setting('app.empresa_id')` at the DB level and is `NOT NULL`, so an insert outside a tenant context fails loudly.
- **Transactions:** use the `transaccion(fn)` helper from `config/db.js`, never `prisma.$transaction(async tx => …)` (each inner op would open its own transaction on another connection) and never the array form `prisma.$transaction([a, b])` (silently loses atomicity with the extension — proven: a batch with a failing second statement left the first committed).
- `conEmpresa` opens its scope with `async () => fn()` on purpose (Prisma promises are lazy). `sinEmpresa` is the explicit opt-out (login, maintenance); login resolves the tenant via the `SECURITY DEFINER` function `app_identidad_por_correo`.
- Superadmin (`soloSuperadmin.js`, `/companies`) is a regular user row belonging to some real agency (`usuarios.empresa_id` is `NOT NULL` for every row, superadmin included — despite what an earlier version of this note said), with role `superadmin`; it administers agencies and can impersonate one (`suplantaciones`, audited, expiring) — the token then has `empresaId` (working agency) ≠ `empresaOrigen` (where the user's own row and session live, `req.empresaOrigen`/`req.user.empresa_id`). RLS makes no exception for the superadmin on business tables. Anything that touches the user's own session/row during an impersonation (logout, `/auth/me`) must run in `empresaOrigen`. **Writing `req.user.id` into any composite `(x_id, empresa_id) → usuarios(id, empresa_id)` FK breaks while impersonating** — that id belongs to `empresaOrigen`, not the agency being written to. `req.suplantacion` (truthy while impersonating) is the existing signal to catch this: write `null` for a nullable "created by" column, or reject with a clear 400 for a required one (spec 002, T19).
- Postgres FK checks skip RLS, so composite `(id, empresa_id)` foreign keys stop a row in one agency from pointing at another's. Anything validating "this id belongs to my agency" by a plain `findFirst` relies on RLS actually filtering — it silently passes with a role that bypasses it.
- User-visible numbers are the per-agency `numero` column (unique per `empresa_id`, assigned by the `BEFORE INSERT` trigger `app_asignar_numero()` as `MAX+1` under a per-empresa lock), never the global `id`, which leaks how many rows other agencies have. Code never computes `numero`. Numbered tables soft-delete via `deleted_at` so numbers aren't reused. See `docs/designs/numeros-visibles-por-agencia.md`.
- Uploaded files are namespaced per empresa and served through an authenticated route; email sender/branding resolve from the tenant context automatically. **Routes that upload files must use `upload.single/array` from `middleware/upload.js` (or `uploadLogo`), never `multer` directly:** multer reads the request in event callbacks and the `AsyncLocalStorage` context is lost, so the handler runs without an empresa and RLS hides every row (a 404 on your own resource). `middleware/conservarContexto.js` restores it.
- `empresas` is not a business table: an agency reads and updates only its own row, and the trigger `app_empresa_solo_perfil` limits that to profile/brand columns (slug, legal name, estado, sender, dates stay superadmin-only). Logos and vouchers live in private Supabase Storage buckets, one folder per empresa; only `utils/almacenamiento.js` talks to Storage and it always prefixes the folder from the tenant context (spec 011).
- When adding a tenant-owned table: its own RLS policy, the `empresa_id` default, and `empresa_id` **denormalized** (not inferable via a parent join — that turns every listing into a per-row subquery).

### Permissions

Permissions live in Postgres (`permisos_rol`), per role (`admin`, `asesor`, `freelancer`) and module/action. `middleware/authorize.js` seeds a hardcoded default (`ADMIN_PERMISSIONS`, `ROLE_DEFAULT_PERMISSIONS`) and overlays the DB on top — **the DB is the source of truth**. `authorize(modulo, accion)` sets `req.permissionScope` (`'all'|'own'`), which services must apply to mutations as well as listings. `view` is `'all'|'own'|'none'`; other actions are booleans. There is no `permisos_usuario` table — per-user overrides were removed.

Adding a module or action touches exactly three places, and missing any fails silently:
1. `services/roles.service.js` — `MODULE_ACTIONS` (and `SCOPED_VIEW_MODULES` if `view` has scope).
2. `middleware/authorize.js` — `ADMIN_PERMISSIONS` and `ROLE_DEFAULT_PERMISSIONS`. The overlay only applies a DB value `if (pr.accion in mod)`, so a permission missing here is saved and then ignored.
3. `frontend/src/types/index.tsx` — `RolePermissions` and the default constants (client-side fallback only).

Any route that should be permission-scoped **must** call `authorize(...)` after `auth`; `auth` alone does not set `req.permissionScope`, and routes with only `auth` return data unscoped by role (the source of every real permission leak here). A rejection that comes back as 404/422 instead of 403 is the tell that `authorize` never ran. `superadmin` and `admin` are fixed roles (not editable; `PUT /roles/:rol/permissions` rejects them with 400). `PUT` **replaces** a role's whole permission set, it doesn't merge.

### API conventions (measured rationale in README)

- Every collection is paginated (default 10, cap 100): `{ success, data, meta: { page, perPage, total, totalPages, hasNext, hasPrev } }`. Row-fetch and `count` must share **one** `where` (Prisma object API) — duplicating a filter as raw SQL plus a separate Prisma `where` is the bug that has recurred most.
- Prisma object API (with `relationLoadStrategy: 'join'`) by default; raw SQL only for `SUM`, `COUNT FILTER`, CTEs, `CASE` — via `$queryRawTyped` against `prisma/sql/*.sql` (validated against the DB at generate time), always with positional parameters, never interpolation.
- Totals are always computed server-side, never summed in the browser over a paginated list.
- Domain conventions (person data, sale creation in batches, VAT on the TA, flights in Bogotá days, the 15 product categories) live in `backend/CLAUDE.md`, loaded when working under `backend/`.
- `POST` → 201, `DELETE` → 204 (except `DELETE /sales/:id/payments/:id`, which returns the recalculated sale). Validation errors → 422 with `error.details: [{field, message}]`.

## Frontend architecture

See `frontend/CLAUDE.md` (loaded when working under `frontend/`).

## Documentation in this repo

- `docs/decisions/` — architecture decisions with the problem, discarded alternatives and measured outcome (the multi-tenant one is required reading before backend work on tenancy, permissions or transactions).
- `docs/designs/` — narrower design docs for specific features.
- `docs/specs/` — spec-driven work, one numbered folder per spec with `spec.md` (what and how it is checked), `plan.md` (how) and `tasks.md` (done/pending, with what was verified); the header of each `spec.md` says whether it is implemented or design only. Read the relevant spec's `tasks.md` before working under it, update it as you go, and give new work a new numbered folder. Specs owned by Darío (e.g. `007-cotizaciones`) are his.
