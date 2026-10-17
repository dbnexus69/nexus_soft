# Spec 019 — El alcance "solo los suyos" también al leer y escribir un cliente por id

**Estado:** implementada (2026-10-17) · **Rama:** `feat-bayrol` · **No toca la base** · **Relacionadas:** `017`
(destinos, que hoy también se editan por esta vía), patrón de `ventasAlcance.js`

## Por qué

Hallado en la auditoría del 2026-10-17. El rol `asesor` tiene por defecto `clients.view = 'own'`: su lista solo trae
los clientes que creó (`creado_por_id`). Pero `GET /clients/:id`, `PUT /clients/:id`, `PATCH /clients/:id/toggle-status`
y `PUT /clients/:id/avatar` no miran el alcance: con el id de un cliente de otro asesor se lee, se edita (datos,
destinos), se desactiva y se le cambia el avatar. El `CLAUDE.md` exige aplicar el alcance también a las mutaciones.

## Qué se quiere

- Con alcance de ver `own`, un cliente de otro asesor (o sin `creado_por_id`):
  - **leer** por id → **404** (no se confirma que exista);
  - **editar, cambiar estado, subir avatar** → **403** (quien lo intenta ya tiene su id).
- Con alcance `all` (admin, superadmin), nada cambia. Los propios del asesor, tampoco.
- Las llamadas internas sin alcance (`quotes.service.js` → `getClientById`) siguen sin restricción.

Fuera de alcance: que una venta o cotización se pueda hacer con el cliente de otro asesor (no lo restringe hoy
`createSale`; sería otra decisión).

## Diseño

Mismo patrón que `ventasAlcance.js`/`quotesAlcance.js`, en
`clients.service.js`: `soloLosSuyos(alcance)` (el de VER: `viewScope || permissionScope`); al leer, `getClientById` filtra por `creado_por_id` (404); al escribir, `comprobarQueEsSuyo` (403) en
`updateClient`, `toggleClientStatus` y `uploadAvatar`. El controlador pasa `{ permissionScope, viewScope, user }`.

## Cómo se comprueba

`pnpm test:aislamiento-api`, en la sección del asesor: el cliente del admin → 404 al leer, 403 al editar, al cambiar
estado y al subir avatar; su propio cliente → 200 al leer y al editar.
