# Spec 025 — Auditoría de permisos por rol: huecos y pruebas que faltaban

**Estado:** completada (2026-10-28), probada por la API y confirmada en pantalla por el usuario (2026-10-28) · **Rama:** `feat-bayrol` · **No toca el esquema** (los
valores por defecto viven en código; lo guardado en `permisos_rol` no cambia) · **Relacionadas:**
[`020`](../020-alcance-de-editar-y-borrar/spec.md) (alcance de editar y borrar), [`022`](../022-cierre-de-pendientes/spec.md) T5 (archivos)

## Qué se revisó (2026-10-21)

Todas las rutas de `backend/src/routes` con su `auth`/`authorize`, los permisos por defecto de cada rol
(`middleware/authorize.js`), las tres copias de la definición (`roles.service.js`, `authorize.js`,
`frontend/src/types/index.tsx`), el alcance en los servicios, las rutas y el menú del frontend, y qué cubren las pruebas.

**Bien:** toda ruta de negocio tiene `authorize`; las que no lo tienen están justificadas (login, branding, perfil,
`/companies` con `soloSuperadmin`, `/uploads` con su propio alcance). Las 7 estadísticas aplican `own`. La
recuperación de contraseña tiene límite. Las tres copias coinciden. Crear venta o cotización a nombre de otro asesor
con alcance `own` da 403. Subir un voucher a la venta de otro exige editar en `all`.

## Huecos y decisión del usuario (2026-10-21)

| # | Hueco | Decisión |
|---|---|---|
| H1 | `PATCH /sales/:id/review-status` pide editar ventas: un asesor marca "revisada" su propia venta pagada, y ya no se puede cambiar. | Solo quien edita ventas en `all` (admin y superadmin, salvo delegación). |
| H2 | El freelancer tiene `users.view: true` por defecto: ve correos y teléfonos del personal. | `false` por defecto. El selector de asesor del asistente (que lista usuarios) solo se muestra con ver ventas en `all`; con `own` el asesor es uno mismo, que es lo único que el servidor admite. |
| H3 | Usuarios, Gestión Interna y Responsables están fijos a `isAdmin` en `App.tsx` y `Sidebar.tsx`, aunque el panel los deja delegar; `/commissions` no tiene guarda de ruta. | Ruta y menú según `canView` del módulo, como los demás; `/commissions` protegido igual. |
| H4 | `updateReviewStatus` responde `meta` como texto. | Se corrige (sin `meta`). |
| H5 | El asistente de venta pide al abrir usuarios y responsables, que no lee (`data.users`/`data.responsables`); para un asesor, responsables da 403 en cada apertura. | Se quitan esas dos cargas. |

## Pruebas que faltaban (se añaden a `test:aislamiento-api`)

1. Asesor: comisionistas (listar, crear) y liquidaciones → 403; responsables (listar, crear) → 403; Gestión Interna
   editar → 403 (ver → 200).
2. Asesor: la cotización de otro asesor no se ve (404) ni se edita.
3. Asesor: cobrar en la venta de otro → 403/404.
4. Asesor: estadísticas → solo suma sus ventas (el total del dashboard del asesor < el del admin y = sus ventas).
5. H1: el asesor marca "revisada" su venta pagada → 403; el admin → 200.
6. H2: un freelancer: `GET /users` → 403; crea su propia venta → 201; a nombre de otro → 403.
7. Vuelos: el asesor con editar `none` no hace check-in (403).

## Fuera de alcance

- Cambiar permisos ya guardados en `permisos_rol` de agencias existentes (se ajustan en el panel).
- `send-voucher` con permiso de ver: enviar el voucher al cliente de una venta que se puede ver es intencional.
