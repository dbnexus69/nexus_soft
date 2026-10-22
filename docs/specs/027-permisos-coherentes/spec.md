# Spec 027 — Permisos coherentes: lo que ves es lo que se aplica

**Estado:** implementada (2026-10-22); falta revisar los advisors de Supabase (H4) · **Rama:** `feat-bayrol` ·
**Toca la base compartida** (migración de datos en `permisos_rol`) · **Relacionadas:**
[`020`](../020-alcance-de-editar-y-borrar/spec.md), [`025`](../025-auditoria-de-permisos/spec.md),
[`026`](../026-rol-freelancer/spec.md)

## Por qué

Al cerrar la 026 quedaron tres sitios donde un permiso se lee distinto según quién lo lea, y uno donde un rol ve más de
lo que necesita. Mientras existan, el panel de roles no es de fiar: el admin cambia algo y la pantalla o la API hacen
otra cosa.

## Hallazgos

| # | Qué pasa | Dónde |
|---|---|---|
| H1 | **La pantalla del asesor y del freelancer no lee sus permisos de la base.** `DataContext` pide `GET /roles/:rol/permissions`, que exige `permissions.view`; esos roles no lo tienen, reciben 403 y la pantalla usa las constantes de `types/index.tsx`. Si el admin cambia un permiso en el panel, la API lo aplica pero los botones y menús siguen con los valores por defecto. Además, cada arranque hace tres peticiones que fallan. | `frontend/src/context/DataContext.tsx:194`, `PermissionsContext.tsx:44`, `routes/roles.routes.js:16` |
| H2 | **El panel y `authorize` leen distinto un valor guardado.** En un "ver" con alcance (ventas, cotizaciones, clientes, vuelos, responsables), `authorize.js` convierte cualquier valor que no sea `all/own/none` en `'own'`; el panel (`parseValor`) convierte `'true'` en `'all'` y lo demás en `'none'`. Un `'true'` heredado: el panel dice "Todas", se aplica "Solo las propias". Un `'false'`: el panel dice "Ninguna", se aplica "Solo las propias" (acceso que nadie dio). | `middleware/authorize.js:105-109`, `services/roles.service.js::parseValor` |
| H3 | **El asesor lista a todo el personal** (`users.view: true` por defecto): correos y teléfonos. Desde la 025 nada del asesor lo necesita: el selector de asesor del asistente solo sale con ventas en `all`, y la pantalla Usuarios es de quien tenga `users.view`. Lo pide solo la carga inicial de `DataContext` (y lo mismo con responsables y comisionistas, para todos los roles). | `authorize.js`, `roles.service.js`, `DataContext.tsx:303-309` |
| H4 | **Los avisos de seguridad de Supabase** no se revisaron tras las migraciones de la 026 (el conector no tiene acceso). | Panel de Supabase |

## Qué se quiere

1. **Una sola lectura de los permisos.** Una función en `utils/alcancePermisos.js` convierte un valor guardado en el
   valor efectivo, y la usan `authorize.js` (superposición) y `roles.service.js` (`parseValor`). Un valor desconocido
   es `'none'` / `false` (falla cerrado), nunca `'own'`.
2. **La pantalla usa lo que aplica la API.** `GET /auth/me/permissions` (solo `auth`) devuelve
   `getEffectivePermissions(req.user)`, lo mismo que decide `authorize`. `PermissionsContext` lo usa para el usuario
   conectado; `GET /roles/:rol/permissions` queda solo para el panel (quien tiene `permissions.view`). Las constantes
   del frontend siguen como red de seguridad mientras responde.
3. **Los valores heredados se corrigen en la base** (migración de datos) según D1, para que tras el cambio de código
   nadie gane ni pierda acceso sin saberlo.
4. **El asesor sin lista de usuarios** por defecto (según D2), y la carga inicial pide usuarios, responsables y
   comisionistas solo si el rol puede verlos.
5. **Advisors de Supabase** revisados y sin avisos nuevos.

## Decisiones (del usuario, 2026-10-22)

- **D1 · Valores heredados `'true'`/`'false'` en un "ver" con alcance.** Opciones: (a) lo que se aplica hoy
  (`'own'` en los dos casos); (b) lo que muestra el panel (`'all'` / `'none'`); (c) **recomendada:** el más estrecho de
  los dos (`'true'` → `'own'`, `'false'` → `'none'`): nadie gana acceso, y el `'false'` deja de dar el acceso que nadie
  concedió. T1 dice cuántas filas hay; si son cero, D1 no hace falta. **Elegida: (c).**
- **D2 · `users.view` del asesor.** (a) **recomendada:** `false` por defecto y migración para todas las agencias, como
  se hizo con el freelancer en la 026; (b) solo por defecto (agencias nuevas), sin tocar las existentes; (c) dejarlo.
  **Elegida: (a).**

## Cómo se comprueba

| Caso | Se espera |
|---|---|
| Asesor `GET /auth/me/permissions` | 200, igual a lo que aplica `authorize` (p. ej. `sales.view: 'own'`) |
| El superadmin cambia `sales.view` del asesor a `none` | `/auth/me/permissions` del asesor lo refleja y `GET /sales` da 403 |
| Fila `'true'` y fila `'false'` en `sales.view` del asesor (puestas a mano en la agencia de prueba) | el panel y `/auth/me/permissions` dicen lo mismo, y `authorize` aplica eso |
| Valor desconocido (`'xyz'`) | `none`: 403 |
| Asesor `GET /users` (con D2 a) | 403 |
| Arranque del asesor/freelancer | ninguna petición 403 en la carga inicial |
| `permisos_rol` tras la migración | ningún "ver" con alcance con un valor fuera de `all/own/none` |

Más `tsc`, `check:prisma`, `test:aislamiento-api`, `prisma migrate status` y los advisors de Supabase sin avisos nuevos.

## Fuera de alcance

- Ocultar los costos de proveedor al freelancer: es una función nueva, no una incoherencia. Pendiente en la
  [`028`](../028-costos-de-proveedor-y-freelancer/spec.md).
