# Tareas — Spec 025

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-21).** Implementada (T1–T4 por un agente con Sonnet, revisada y corregida por Claude) y probada por la API. Falta verla en pantalla.

## T1 · H1: "revisada" solo con editar ventas en `all` `[x]`
`sales.service.js::updateReviewStatus` rechaza con 403 si `alcanceDeEscritura(alcance) !== 'all'`. `Sales.tsx` no pasa `onReviewStatusChange` sin ese alcance **Corregido en la revisión:** eso ocultaba también el sello "Revisado" al asesor; `SalesTable.tsx` ahora pinta el sello siempre y el control solo con `onReviewStatusChange`. Verificado: `tsc`, `node --check`.

## T2 · H2: freelancer sin lista de usuarios; selector de asesor según alcance `[x]`
`freelancer.users.view = false` en `authorize.js` y `types/index.tsx`; `Step1Client.tsx` y `Quotes.tsx` (cambio mínimo) muestran el selector de asesor solo con `view` en `all`; si no, el asesor actual en solo lectura (Step1) o sin selector (Quotes, que ya inicializa al usuario). Las agencias ya existentes conservan la fila `permisos_rol` sembrada con `users.view` true. Verificado: `tsc`.

## T3 · H3: Usuarios, Gestión Interna, Responsables y Comisionistas según `canView` `[x]`
`App.tsx`: `PermisoRoute` (dentro de `ProtectedRoute`, o sea del `PermissionsProvider`) en esas cuatro rutas; `AdminRoute` retirada por sin uso. `Sidebar.tsx`: sin la excepción `isAdmin`, y el menú de administración ya no exige `isAdmin` (solo que haya enlaces). **Corregido en la revisión:** `Config.tsx` no mira permisos y `config.view` lo tiene todo rol (el asistente lee los catálogos), así que el asesor habría entrado a Gestión Interna con todos los botones; la ruta y el menú de Gestión Interna piden `canEdit('config')` (`PermisoRoute editar`). Usuarios queda visible al asesor (tiene `users.view` por defecto; sus botones ya miran `canCreate/canEdit/canDelete`). Verificado: `tsc`.

## T4 · H4 y H5: `meta` de revisión y cargas sobrantes del asistente `[x]`
`success(res, result)` en `sales.controller.js`; fuera `fetchUsers`/`fetchResponsables` de `NewSaleWizard.tsx` (grep: el asistente no lee `data.users` ni `data.responsables`). Verificado: `tsc`.

## T5 · Pruebas de permisos que faltaban `[x]`
Sección "Permisos por rol (spec 025)" en `tests/aislamiento-api.js`, antes de la spec 020, con los 7 grupos. El caso 7 usaba el id `1` y daba 400: `paramsUuid` rechaza un id mal formado antes de `authorize`; ahora usa un uuid aleatorio. **Verificado:** `pnpm test:aislamiento-api` "Todo en orden" (corrido por Claude con permiso del usuario). **Nota:** las agencias existentes conservan `freelancer.users.view` en true en `permisos_rol` (sembrado al crearlas); se ajusta en el panel.


## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-21 | T1–T5 | Implementado en el árbol de trabajo, sin commit. `tsc`, `check:prisma` y `test:validaciones` en verde; `test:aislamiento-api` pendiente. |
| 2026-10-21 | — | Auditoría de rutas, valores por defecto, servicios, frontend y pruebas; decisiones H1–H3 del usuario. |
| 2026-10-21 | T1, T3, T5 | Revisión: sello "Revisado" visible para todos, Gestión Interna por `config.edit`, caso de check-in con uuid válido. `test:aislamiento-api` en verde. |
