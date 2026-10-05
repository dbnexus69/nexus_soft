# frontend/CLAUDE.md

Loaded when working under `frontend/`; the root `CLAUDE.md` still applies.

## Frontend architecture

`src/App.tsx` nests one Context provider per domain (Auth → Users → Clients → Sales → Commissions → Data); `PermissionsProvider` sits inside `ProtectedRoute`. Route guards: `ProtectedRoute`, `AdminRoute`, `SuperadminRoute` (`/companies`). Most cross-cutting state lives in `src/context/*`. The internal-management catalogs (airlines, suppliers, payment methods…) live only in `DataContext` (`data.config`); the settings screen and the sales wizard read the same copy, so there must not be a second one.

`api/client.ts` is the single axios instance (`VITE_API_URL`, Bearer token from `localStorage['nexus_token']`, clears it on 401); `src/api/*.ts` are thin per-resource wrappers. `api/fetchAll.ts` is the one place that pages through a whole collection when a full list is genuinely needed — never a huge `perPage`, the server caps it at 100 and it truncates silently. `src/utils/*Cache.ts` are localStorage caches with TTLs keyed by empresa and user, invalidated on mutation and on logout. `PermissionsContext` mirrors the backend permission shape — keep both in sync. Agency name and logo come from the tenant (`GET /branding`); brand colors apply only to the voucher, not the UI. `components/` is organized by domain; `sales/` splits into `forms/ steps/ wizard/ detail/ credit/` for the multi-step sale flow and its ~15 product types.

`src/utils/datosPersona.ts` is a hand-written mirror of `backend/src/utils/datosPersona.js` (rules in `backend/CLAUDE.md`): change both together; `pnpm test:reglas-espejo` in `backend/` fails if they drift.
