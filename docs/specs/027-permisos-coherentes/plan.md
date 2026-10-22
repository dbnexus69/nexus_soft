# Plan — Spec 027

## T1 · Medir los valores heredados (solo lectura, con permiso: base compartida)
Contar en `permisos_rol` (como `postgres`, todas las agencias) las filas de un "ver" con alcance (`dashboard`, `sales`,
`quotes`, `clients`, `responsables`, `itineraries`) y de las acciones de `SCOPED_ACTIONS` con un valor fuera de
`all/own/none`, por agencia, rol, módulo, acción y valor. Con eso se cierra D1.

## T2 · Una sola lectura (backend)
- `utils/alcancePermisos.js`: `leerValor(modulo, accion, valor)` → para acciones con alcance, `all/own/none`
  (`'true'`→`'all'`, `'false'` y desconocido → `'none'`); para el resto, booleano (`'true'`/`true` → `true`).
- `authorize.js::getEffectivePermissions`: la superposición usa `leerValor` (se quita el `: 'own'` de la línea 108).
  La regla del dashboard (no admin → como mucho `own`) se queda donde está.
- `roles.service.js::parseValor`: usa `leerValor` y conserva la misma regla del dashboard.
- Tras T3 ya no quedan valores heredados, así que pasar `'true'` → `'all'` en `authorize` no amplía nada.

## T3 · Migración de datos (base compartida, con permiso; depende de D1 y D2)
Convierte los valores heredados según D1 = c (`'true'`→`'own'` y `'false'`→`'none'` en los "ver" con alcance;
`'true'`→`'all'` y `'false'`→`'none'` en editar/borrar con alcance, que es lo que ya aplican los dos lados). Como D2 = a,
la misma migración pone `users.view = 'false'` al asesor de todas las agencias. Se aplica ANTES de usar T2.

## T4 · `GET /auth/me/permissions`
`routes/auth.routes.js`: ruta con `auth`, sin `authorize` (son los permisos de uno mismo). Devuelve
`getEffectivePermissions(req.user).permissions`. Suplantando, los del superadmin (lo que `authorize` aplica).

## T5 · Frontend
- `api`: `getMyPermissions()`. `DataContext` lo pide al arrancar y lo guarda; los tres `getRolePermissions` solo si
  `permissions.view` (los usa el panel).
- `PermissionsContext`: los del usuario conectado salen de `/auth/me/permissions`; las constantes, como reserva.
- Carga inicial: `fetchUsers` solo con `users.view`, `fetchResponsables` con `responsables.view` ≠ `none`,
  `fetchCommissionAgents` con `commissions.view`.
- `types/index.tsx`: `DEFAULT_ASESOR_PERMISSIONS.users.view = false` (D2 = a).

## T6 · Valores por defecto (D2)
`authorize.js` y `roles.service.js` (`DEFAULT_ROLE_VALUES`): asesor `users.view` a `false`.

## T7 · Pruebas
`test:aislamiento-api`: los casos de `spec.md` (las filas heredadas se escriben con el cliente `admin` que ya usa el
test, en la agencia de prueba). Más `check:prisma` y `tsc`.

## T8 · Advisors de Supabase
Revisarlos en el panel (o con el conector, si se le da acceso) y anotar el resultado en `tasks.md`.
