# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Nexus Soft is a **multi-tenant** travel-agency management system: sales/bookings, clients, commissions, itineraries, users/roles, stats. Each agency is an `empresa` with isolated data. Two independent pnpm packages with no shared workspace: `backend/` (Express 5 + Prisma, CommonJS, PostgreSQL on Supabase → Render) and `frontend/` (React 19 + Vite + TypeScript + Tailwind → Vercel). Code comments, docs and UI are in Spanish.

`README.md` documents conventions in depth (DB connection strings, pagination, typed SQL, objects-vs-raw-SQL, never computing totals in the browser). `docs/specs/001-multi-tenant/{spec,plan,tasks}.md` is the multi-tenant spec and its task log; `docs/decisions/` and `docs/designs/` hold rationale. Read those before touching tenancy, pagination or the sales list.

## Commands

Run from `backend/` or `frontend/`, not the repo root.

```bash
# backend
pnpm dev                 # node --watch
pnpm start
pnpm db:generate         # prisma generate --sql (typedSql preview; also what `pnpm build` runs; needs DB access)
pnpm check:prisma        # scripts/check-prisma-fields.js — validates field names used in code against the schema
pnpm test:aislamiento    # pruebas/aislamiento.js — the only test: builds a 2nd agency, checks RLS isolation, tears it down
pnpm db:seed | db:studio

# frontend
pnpm dev | build (tsc + vite build) | preview
```

No lint config and no test framework. Run `pnpm check:prisma` after touching Prisma queries and `pnpm test:aislamiento` after touching tenancy/RLS/auth; run `pnpm build` in `frontend/` for a type check.

## Database and migrations

- **Use versioned migrations, never `db push`.** The repo has `prisma/migrations/` (baseline `0_init`, then one per change). `db push`/`db:reset` are still in `package.json` but would try to reconcile the schema against RLS policies, composite FKs and functions that Prisma's schema doesn't model — do not run them against the shared Supabase DB. The workflow is `prisma migrate diff` → read the SQL → `prisma migrate deploy` (`migrate dev` needs a shadow DB that the Supabase role can't create). Existing migrations must not be edited (checksums); corrections go in a `NOTA.md` next to them.
- `migrate diff` against the datasource is never fully empty: the composite `(id, empresa_id)` foreign keys, RLS and SQL functions live only in raw migration SQL. `prisma migrate status` is the real "in sync" check.
- Connection strings (details in README): `DATABASE_URL` = Supabase transaction pooler, port 6543, `?pgbouncer=true&connection_limit=10&pool_timeout=20`. `DIRECT_URL` = **session pooler on port 5432**, not `db.<ref>.supabase.co` (IPv6-only, unreachable → `P1001`). Both are needed to run `prisma generate --sql`.
- **`DATABASE_URL` must use the `app_nexus.<ref>` role, which has no `BYPASSRLS`.** With `postgres` the RLS policies apply without error and filter nothing, silently voiding tenant isolation. `postgres` belongs only in `DIRECT_URL` (migrations). Must also be set that way in the hosting env. `pnpm test:aislamiento` fails fast if the role bypasses RLS.
- The app never uses Supabase's REST API or its `anon`/`authenticated` roles: migration `20260924010000_sin_permisos_para_anon_ni_authenticated` revoked all their privileges in `public` (and default privileges for new objects), and `20260924000000_cerrar_la_api_rest_de_supabase` closed the `app_*` functions. New tables created by migrations get grants only for `app_nexus`; keep it that way. Supabase's security advisors (`get_advisors`) should stay empty after any migration.
- Table/column names are Spanish. Product subtypes have one table each (`prod_*`); `detalle_venta.categoria` is the `ProductCategory` enum.

## Backend architecture

`src/index.js` → helmet, CORS allowlist (`FRONTEND_URL`, localhost, `*.vercel.app`), rate limits, `/api` routes (`routes/index.js`; note `/companies` and `/branding` for tenancy/branding). Each feature is **route → middleware → controller → service → Prisma**; responses use `utils/apiResponse.js` (`{ success, data, meta }` / `{ success:false, error:{ message, code } }`), errors flow to `middleware/errorHandler.js` (maps Prisma codes, Zod, multer, `errors/AppError.js`).

### Tenancy: Postgres enforces it, the code only says who is asking

- `middleware/auth.js` verifies the JWT (which carries `empresaId`; pre-multi-tenant tokens are rejected with `SESSION_SIN_EMPRESA`), checks the session row in `sesiones` (logout/password change revoke it; cached in `authCache.js`), and **opens the tenant context** with `conEmpresa(...)` from `config/tenant.js` (an `AsyncLocalStorage`). There is no unauthenticated bypass anymore.
- `config/db.js` exports a Prisma client extended so every query runs in a batch transaction with `set_config('app.empresa_id', …, true)`; RLS policies (`empresa_id = app_empresa_actual()`) on the 42 business tables do the actual filtering. Do **not** add `where empresa_id` filters in services — two sources of truth is the bug this design avoids. No context → no rows visible/insertable.
- **Transactions:** use the `transaccion(fn)` helper from `config/db.js`, never `prisma.$transaction(async tx => …)` (each inner op would open its own transaction on another connection) and never the array form `prisma.$transaction([a, b])` (silently loses atomicity with the extension).
- `conEmpresa` opens its scope with `async () => fn()` on purpose (Prisma promises are lazy). `sinEmpresa` is the explicit opt-out (login, maintenance); login resolves the tenant via the `SECURITY DEFINER` function `app_identidad_por_correo`.
- Superadmin (`soloSuperadmin.js`, `/companies`) administers agencies and can impersonate one (`suplantaciones`, audited, expiring) — the token then has `empresaId` (working agency) ≠ `empresaOrigen` (user's own).
- Per-agency visible numbering (`numero` on ventas, clientes, etc.) is assigned by the DB with a per-empresa lock; uploaded files are namespaced per empresa.
- Email sender/branding resolve from the tenant context automatically.

### Permissions

`middleware/authorize.js` `authorize(modulo, accion)` layers role defaults (`admin`, `asesor`, `freelancer`) with DB overrides (`permisos_rol`) and sets `req.permissionScope` (`'all'|'own'`), which services must apply to mutations as well as listings. `view` is `'all'|'own'|'none'`; other actions are booleans. There is no `permisos_usuario` table — per-user overrides were removed from the schema.

## Frontend architecture

`src/App.tsx` nests one Context provider per domain (Auth → Users → Clients → Sales → Config → Commissions → Data); `PermissionsProvider` sits inside `ProtectedRoute`. Route guards: `ProtectedRoute`, `AdminRoute`, `SuperadminRoute` (`/companies`). `api/client.ts` is the single axios instance (`VITE_API_URL`, Bearer token from `localStorage['itea_token']`, clears it on 401). `PermissionsContext` mirrors the backend permission shape — keep both in sync when adding modules. Agency branding (name, logo, colors) is driven from the tenant via CSS variables. `components/` is organized by domain; `sales/` is split into `forms/ steps/ wizard/ details/ vouchers/` for the multi-step sale flow and its ~15 product types. Lists are server-paginated (10/page default, max 100); totals always come from the server.
