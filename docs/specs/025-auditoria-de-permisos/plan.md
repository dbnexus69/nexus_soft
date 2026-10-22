# Plan — Spec 025

## T1 · H1, revisar solo con editar en `all`
`sales.service.js::updateReviewStatus`: además de `ventaVisible(..., { paraEscribir: true })`, rechazar con 403 si
`alcanceDeEscritura(alcance) !== 'all'` ("Solo un administrador puede marcar una venta como revisada"). Frontend: el
control de "revisada" solo con `scopeOf('sales', 'edit') === 'all'`.

## T2 · H2, freelancer sin lista de usuarios
`authorize.js` → `ROLE_DEFAULT_PERMISSIONS.freelancer.users.view = false`; `frontend/src/types/index.tsx`, el mismo
valor por defecto. `Step1Client.tsx`: el selector de asesor solo con `scopeOf('sales', 'view') === 'all'`; si no, el
asesor es el usuario actual, en solo lectura.

## T3 · H3, pantallas según permisos
`App.tsx`: `AdminRoute` de `/users`, `/config` y `/responsables` pasa a una guarda por `canView(módulo)`; `/commissions`
igual. `Sidebar.tsx`: quitar la excepción `isAdmin` de esos tres.

## T4 · H4 y H5
`sales.controller.js:166` sin el texto como `meta`. `NewSaleWizard.tsx`: fuera `fetchUsers()` y `fetchResponsables()`.

## T5 · Pruebas
Los 7 grupos de `spec.md` en `tests/aislamiento-api.js`. Un freelancer de prueba se crea como el asesor. Correrla
necesita permiso (toca la base). Más `tsc`, `check:prisma`.
