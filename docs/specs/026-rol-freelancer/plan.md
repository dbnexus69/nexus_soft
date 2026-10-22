# Plan — Spec 026

## T1 · Migración `responsables.creado_por_id` (toca la base compartida: con permiso)
`schema.prisma`: `creado_por_id Int?` en `responsables` y su relación con `usuarios`. Migración nueva escrita a mano
(como `20260912223500_integridad_entre_empresas`): `ADD COLUMN "creado_por_id" INTEGER`, índice, y FK compuesta
`("creado_por_id", "empresa_id") REFERENCES "usuarios" ("id", "empresa_id") ON UPDATE CASCADE ON DELETE SET NULL
("creado_por_id")`. Sin grants nuevos (la tabla ya los tiene). `migrate diff` → leer el SQL → `migrate deploy` →
`db:generate` → `migrate status` → advisors.

## T2 · Migración de datos de `permisos_rol`
En la misma carpeta de migraciones, otra migración: para cada rol `freelancer` de cada empresa, upsert de
`permisos_rol` (`rol_id`, `permiso_id` del catálogo `permisos`, `valor`, `empresa_id` del rol) con users.view = false y
responsables view/create/edit/delete = own/true/own/none. Si faltan filas de `permisos` para responsables, se crean.
Corre como `postgres` (`DIRECT_URL`), sin RLS.

## T3 · Backend: alcance en responsables
- `utils/alcancePermisos.js` `SCOPED_ACTIONS.responsables = ['edit', 'delete']`; `roles.service.js`
  `SCOPED_VIEW_MODULES` + responsables; `authorize.js`: `ADMIN_PERMISSIONS.responsables` a `all` (view/edit/delete) y los
  defaults del asesor (`view: false` como hoy) y del freelancer (los nuevos). De `authorize.js` salen también los roles
  de una agencia nueva (`companies.service.js`).
- `roles.service.js` `DEFAULT_ROLE_VALUES` (lo que muestra el panel si falta una fila): freelancer `users.view` a
  `'false'` (quedó desfasado en la 025) y responsables `own/true/own/none`; admin y superadmin responsables
  `all/true/all/all`.
- `responsables.service.js`: list/getById con `viewScope` (`own` → `creado_por_id = user.id`, mismo `where` para filas y
  conteo); update/delete con `alcanceDeEscritura` (403 en lo ajeno); create guarda `creado_por_id` (null suplantando).
  El controlador pasa el alcance como hace `clients.controller.js`.

## T4 · Backend: ganancia en el dashboard — descartada
La ganancia ya es `totalRevenue` con el alcance del dashboard. Sin cambio en `dashboardAggregates.sql` ni `db:generate`.

## T5 · Frontend
`types/index.tsx`: responsables con alcance (`SCOPED_ACTIONS` espejo, defaults de admin/asesor/freelancer).
`Responsables.tsx`: botones de editar/borrar por `scopeOf` y `createdBy` (como clientes en la 020).

## T6 · Pruebas
`test:aislamiento-api`: los casos de `spec.md` con el freelancer de la 025. Más `check:prisma`, `tsc`.
