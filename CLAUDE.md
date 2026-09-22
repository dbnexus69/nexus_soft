# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Nexus Soft: gestión para agencias de viaje (ventas, clientes, comisionistas, itinerarios/vuelos,
configuración). Two packages, no shared workspace tooling beyond pnpm:

- `backend/` — Express 5 + Prisma 6 over PostgreSQL (Supabase), CommonJS, no TypeScript.
- `frontend/` — React 19 + Vite + Tailwind, TypeScript.

## Commands

```bash
# backend (from backend/)
pnpm dev                    # node --watch src/index.js, http://localhost:3000
pnpm db:generate            # prisma generate --sql — required after any schema.prisma change
pnpm db:push                # prisma db push — see the migrations note below before using it
pnpm db:seed                # node prisma/seed.js
pnpm db:reset               # db push --force-reset + seed — DESTRUCTIVE, and see note below
pnpm db:studio
pnpm check:prisma           # validates every prisma.<model>.<method>({...}) call against the
                             # DMMF (catches camelCase vs snake_case field mistakes); exits 1 on
                             # findings, so it's meant to gate commits that touch queries
pnpm test:aislamiento       # backend/pruebas/aislamiento.js — the multi-tenant isolation smoke
                             # test; connects with the ADMIN (bypass-RLS) role to seed a second
                             # tenant, then verifies the app role can't see or touch its rows.
                             # Only automated test in the repo; not run by check:prisma.

# frontend (from frontend/)
pnpm dev                    # vite, http://localhost:5173
pnpm build                  # tsc && vite build — tsc is the real type-check step, there's no
                             # separate lint/typecheck script
```

There is no lint script and no unit-test framework in either package — `check:prisma` and
`test:aislamiento` are the only backend guards, and `tsc` (via `build`) is the frontend one.

**Migrations hold things `schema.prisma` can't express.** `backend/prisma/migrations/` contains
hand-written SQL for the RLS policies, the `app.empresa_id` context functions, the
`empresa_id` column defaults, and the per-agency `numero` triggers. `db push` / `db:reset` build
the DB from `schema.prisma` alone and don't run that SQL. Prefer `npx prisma migrate dev` for schema
changes so the tenancy machinery stays versioned alongside them.

### Environment

`backend/.env` needs `DATABASE_URL` (Supabase pooler, port 6543, `?pgbouncer=true&connection_limit=10&pool_timeout=20`)
and `DIRECT_URL` (same pooler host, port 5432, **session mode**, no pgbouncer params — the
`db.<project>.supabase.co:5432` host is IPv6-only and unreachable from most networks; `DIRECT_URL`
is what `prisma db push`/`generate --sql` use, and the build fails without it). Both are required
for `pnpm build`/`db:generate` to work at all — see `README.md` for the full rationale.

## Architecture

### Multi-tenant isolation is enforced by Postgres RLS, not application code

This is the single most important thing to understand before touching any backend query. Full
design record: `docs/decisions/multi-tenant-agencias-independientes.md`.

- Every tenant-owned table has an `empresa_id` column and a Postgres row-level-security policy
  `empresa_id = current_setting('app.empresa_id')::int`. The Postgres role the app connects with
  has **no BYPASSRLS** — it's Postgres, not the Node process, that is the actual barrier.
- Application code **never** adds `empresa_id` to a `where` clause. If it did, there would be two
  sources of truth and the code's copy is the one that gets forgotten (this already happened once
  with `own`-scope filtering).
- The active tenant travels per-request in an `AsyncLocalStorage` (`backend/src/config/tenant.js`:
  `conEmpresa`, `sinEmpresa`, `empresaActual`, `esSuperadmin`, `dentroDeTransaccion`), populated by
  `backend/src/middleware/auth.js` from the JWT (`empresaId`, never the URL — the slug in the URL
  is cosmetic and is cross-checked against the token separately).
- `backend/src/config/db.js` wraps the raw `PrismaClient` in a `$extends({ query: { $allOperations
  } })` that, for every operation, runs `SELECT set_config('app.empresa_id', ...)` and the actual
  query **in the same `$transaction([...])` batch** — a `SET LOCAL` inside an interactive
  transaction was tried first and does not work over the pooler (the query and the `SET LOCAL` land
  on different connections). If there's no tenant in context and the caller isn't superadmin, the
  operation passes through untouched (no extra round trip).
- **Never write `prisma.$transaction([a, b, c])` (batch form) or a raw `tx` you built yourself.**
  Use `transaccion(fn)` from `backend/src/config/db.js` for anything that needs atomicity across
  multiple operations. The extension wraps *every* Prisma call in its own transaction unless the
  `AsyncLocalStorage` is explicitly marked "already inside a transaction" (`dentroDeTransaccion`),
  which `transaccion()` does for you. Without it, each statement in a batch/array silently commits
  on its own connection — proven to happen, not theoretical: a two-statement batch with a
  guaranteed-to-fail second statement left the first one committed.
- A superadmin user has `empresa_id = null`; entering an agency for support ("suplantación") is a
  logged, time-boxed action (`suplantaciones` table), not a standing permission — RLS policies make
  no exception for the superadmin role itself.
- `empresa_id` is also never set in a `create`: every tenant column defaults to
  `current_setting('app.empresa_id')` at the DB level, and is `NOT NULL`, so an insert outside a
  tenant context fails loudly.
- When adding a new tenant-owned table, it needs its own RLS policy, that column default, and its
  `empresa_id` **denormalized** (not just inferable via a parent join) — the alternative turns every
  listing query into a per-row subquery.
- User-visible numbers are the per-agency `numero` column (unique per `empresa_id`, assigned by
  a `BEFORE INSERT` trigger `app_asignar_numero()` as `MAX+1`), never the global `id` — the `id`
  leaks how many rows other agencies have. Code never computes `numero`. Numbered tables
  soft-delete via `deleted_at` so numbers aren't reused. See
  `docs/designs/numeros-visibles-por-agencia.md`.

### Permissions: role-based, DB-backed, three places to touch

Permissions live in Postgres (`permisos_rol`), keyed by role (`admin`, `asesor`, `freelancer`) and
module/action. `backend/src/middleware/authorize.js` seeds a hardcoded default
(`ADMIN_PERMISSIONS`, `ROLE_DEFAULT_PERMISSIONS`) and overlays whatever the DB says on top — **the
DB is the source of truth**, the hardcoded object is only the fallback for before that request
resolves or if it fails. `frontend/src/types/index.tsx` has its own copy of the same constants for
the same reason (client-side fallback only, `DataContext` reads it).

Adding a module or action touches exactly three places, and missing any of them fails silently:

1. `backend/src/services/roles.service.js` — `MODULE_ACTIONS` (and `SCOPED_VIEW_MODULES` if the
   `view` action has `all`/`own`/`none` scope rather than a plain boolean).
2. `backend/src/middleware/authorize.js` — `ADMIN_PERMISSIONS` and `ROLE_DEFAULT_PERMISSIONS`. The
   overlay only applies a DB value `if (pr.accion in mod)`, so a permission missing from these
   objects gets saved to the DB and then silently ignored.
3. `frontend/src/types/index.tsx` — `RolePermissions` and the matching default constants.

Any route that should be permission-scoped **must** call `authorize(module, action)` after `auth`.
`auth` alone only validates the JWT and sets up the tenant context — it does not set
`req.permissionScope`. Routes with only `auth` return data unscoped by role; this has been the
source of every real permission leak in this repo (commissions, stats, `GET
/roles/:rol/permissions` were all missing it at some point). A rejection that comes back as 404 or
422 instead of 403 is the tell that `authorize` never ran.

`superadmin` and `admin` are fixed roles — their permissions are hardcoded, not editable, and
`PUT /roles/:rol/permissions` rejects attempts to edit either with 400. `PUT` **replaces** a role's
entire permission set, it doesn't merge.

### API conventions (see `README.md` for full detail and measured rationale)

- Every collection endpoint is paginated (default 10/page, cap 100), response shape
  `{ success, data, meta: { page, perPage, total, totalPages, hasNext, hasPrev } }`.
- Row-fetch and `count` must share one `where` object (Prisma's object API) — never duplicate a
  filter as a raw-SQL string and a separate Prisma `where`, that's the bug that has recurred most.
- Prisma's object API (with `relationLoadStrategy: 'join'`) is the default; raw SQL
  (`$queryRawTyped` against files in `backend/prisma/sql/*.sql`, validated against the DB at
  `generate` time) is reserved for what the object API can't express — `SUM`, `COUNT FILTER`,
  CTEs, `CASE`. Raw SQL always uses positional parameters, never string interpolation.
- Schema fields are **snake_case** (`monto_total`, `creado_at`) except where `@map` is used, in
  which case the Prisma-side name (camelCase) is what code must use. `pnpm check:prisma` catches
  mismatches — run it before pushing anything that touches queries.
- Totals/sums are always computed server-side, never summed client-side over a paginated list.
- Product categories (`ticket`, `hotel`, `insurance`, `plan`, `checkin`, `migration`, `simcard`,
  `car`, `finca`, `tour`, `convention`, `restaurant`, `visa`, `passport`, `pet`) have one canonical
  name shared across URL segments, `detalle_venta.categoria` (a Postgres enum), and
  `backend/src/catalog/products.js` — adding a category means updating the catalog and the enum,
  not scattering a new string through the codebase.
- `POST` → 201, `DELETE` → 204 (except `DELETE /sales/:id/payments/:id`, which returns the
  recalculated sale). Validation errors → 422 with `error.details: [{field, message}]`.

### Backend module layout

Standard layering per resource: `routes/*.routes.js` → `middleware` (`auth`, `authorize`,
`validate` against a `schemas/*.schema.js` Zod schema) → `controllers/*.controller.js` →
`services/*.service.js` (Prisma calls live here). `backend/src/routes/index.js` mounts each
resource; `src/index.js` serves the whole router at both `/api` (legacy) and `/api/v1` (current —
the frontend targets `/api/v1`; `/api` stays only so nothing already deployed breaks).

Flights/check-in is the one module with a naming split worth knowing: the screen and API are
`/flights` (was `/itineraries`, which now redirects), but the permissions module key is still
`itineraries` because that's what's stored in `permisos_rol`.

### Frontend structure

`App.tsx` nests one context provider per domain (`Auth`, `Users`, `Clients`, `Sales`, `Config`,
`Commissions`, `Data`, plus `Permissions` inside the protected route) — most cross-cutting frontend
state lives in `src/context/*`, not component-local state. `src/api/*.ts` are thin per-resource
Axios wrappers; `api/fetchAll.ts` is the one place that pages through an entire collection when a
full in-memory list is genuinely needed (never fetch with a huge `perPage` instead — the server
caps it at 100 and that silently truncates larger catalogs). `src/utils/*Cache.ts` (clients, users,
config, dashboard) are localStorage caches with TTLs, invalidated explicitly on mutation.

## Documentation in this repo

- `docs/decisions/` — architecture decisions with the problem, discarded alternatives, and the
  measured outcome (currently just the multi-tenant one, which is required reading before backend
  work on tenancy/permissions/transactions).
- `docs/designs/` — narrower design docs for specific features.
- `docs/specs/` — screen/feature specs.

Read `README.md` for the full, measured version of the API conventions above (it documents actual
before/after timings for several of these decisions) — this file only summarizes what changes how
you should write code.
