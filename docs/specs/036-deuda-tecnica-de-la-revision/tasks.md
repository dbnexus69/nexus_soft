# Tareas — Spec 036

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente · `[-]` descartada

**Estado (2026-11-01).** Completada: T1–T7 hechas; `test:aislamiento-api` en verde y pantalla confirmada por el usuario.

## T1 · Inventario de interpolaciones en el SQL crudo `[x]`
18 llamadas a `$queryRawUnsafe`/`$executeRawUnsafe`. Las interpolaciones son de tres clases, ninguna con datos del
usuario: fragmentos armados en el mismo archivo (`whereSql`, `fromSql`, `baseSql`, `vigencia`…), índices de
parámetros posicionales (`$${params.length + 1}`) y un ternario `ASC`/`DESC` en `ventasListado.js`, que pasó a la
constante `orderDirection` (como en `responsables.service.js`). Dos llamadas de `stats.service.js` reciben el SQL en
una variable (`categorySql`, `monthlyTrendSql`).

## T2 · `check:prisma` vigila el SQL crudo `[x]`
`scripts/check-prisma-fields.js`: falla si un `${…}` dentro de la plantilla de un `$queryRawUnsafe` no es un índice
posicional ni está en `FRAGMENTOS_PERMITIDOS`, o si el SQL llega en una variable que no está en
`SQL_EN_VARIABLE_PERMITIDO`. **Límite:** vigila la llamada, no cómo se arma cada fragmento permitido; por eso añadir uno
a la lista es afirmar que se revisó. **Comprobado:** pasa con el repo (salida 0); con un `${req.query.x}` y un SQL en
variable de prueba, fuera del repo, los nombra y sale con 1. Va en la CI con `check:prisma`.

## T3 · Inventario de `DataContext` frente a los hooks `[x]`
Por `useData()` en cada archivo (2026-11-01). Sin uso: `updateUser`, `deleteUser`, `updateClient`,
`toggleClientStatus`, `deleteResponsable`, `updateCommissionAgent`, `deleteCommissionAgent`, `updateRolePermissions`
(las páginas usan las de sus hooks: `UsersContext`, `useClients`, `CommissionsContext`). Las listas `data.users`,
`data.clients`, `data.commissionAgents`, `data.responsables` **sí** se usan: son el catálogo de los selectores
(asistente de venta, responsables, etc.), no la tabla paginada de cada página, así que se quedan.

## T4 · `DataContext` sin funciones muertas `[x]`
Quitadas las ocho de T3 (interfaz, implementación y `value`) y el import de `invalidateUsersCache` que dejaron sin uso.
613 → 525 líneas. **Comprobado:** `tsc`.

## T5 · `avatar` acotado `[x]`
`schemas/personaCampos.js::avatar`: URL de `api.dicebear.com` (el selector, `AvatarPicker.tsx`), hasta 300
caracteres, nullable y opcional. En usuarios (crear y editar), clientes y comisionistas (crear y editar).
`tests/validaciones.js`: del selector y nulo pasan; texto, otro dominio, data URI y más de 300 caracteres → rechazo;
el esquema de cliente nombra el campo. **Comprobado:** `test:validaciones` (150) en verde.
**Riesgo descartado (consulta de solo lectura, 2026-11-01):** de 44 personas, 25 sin avatar y 19 con uno de dicebear; ninguna rechazada por la regla nueva. Contexto: `UserModal.tsx` reenvía el avatar guardado al editar. Si alguna fila tiene un avatar que no
es de dicebear (p. ej. de la antigua subida de avatares, quitada en la 031), editar esa persona daría 422 en
`avatar`. Para saberlo hace falta contar en la BD los `personas.avatar_url` que no empiezan por
`https://api.dicebear.com/` (consulta de solo lectura, con permiso del usuario).

## T6 · Código muerto según las decisiones 2–4 `[x]`
- `DELETE /responsables/:id` fuera: ruta, `controller.delete`, `responsablesService.deleteResponsable` y
  `api.deleteResponsable` (+ su export). `aislamiento-api`: el `DELETE` ahora espera 404 (la ruta ya no existe).
- Solo `/api/v1`: fuera `app.use('/api', routes)` y el limitador de `/api/auth/...`. `GET /api/health` y el 404 en
  formato de la API siguen.
- `db:seed`, `db:reset`, `prisma.seed` de `package.json` y `prisma/seed.js` fuera.
- Documentos al día: `.claude/rules/{backend,database,testing}.md`, `docs/architecture/overview.md`.
**Comprobado:** `node --check`, las rutas cargan, `check:prisma`, `test:validaciones`, `test:reglas-espejo`, `tsc`.
**Pendiente (con permiso):** `test:aislamiento-api`.
**También (decisión del usuario, 2026-11-01):** fuera el permiso `responsables.delete` (`MODULE_ACTIONS`,
`DEFAULT_ROLE_VALUES`, `authorize.js`, `SCOPED_ACTIONS` en los dos lados, `types/index.tsx`); las filas viejas de
`permisos_rol` con esa acción se ignoran (el overlay solo aplica acciones conocidas) y desaparecen al guardar el rol.
Y fuera `db:push` de `package.json`.
**Prueba con base (2026-11-01):** `test:aislamiento-api` no llegó al final en seis corridas por la red (RTT ~300 ms
con pérdida de paquetes al pooler de Supabase: cuelgues en puntos distintos, un 500 y un `Can't reach database
server`). En la última pasaron 102 comprobaciones, entre ellas las de esta spec: `DELETE /responsables/:id` → 404 y
el panel del freelancer sin `delete`. Corrida completa en verde: "Todo en orden" (usuario, 2026-11-01).
`tests/montaje.js` muestra ahora la salida de error del servidor de prueba si una comprobación falla, y avisa si se
cae a mitad.

## T7 · Pruebas en pantalla `[x]` (confirmadas por el usuario, 2026-11-01)
Usuarios, clientes, comisionistas y responsables (listar, crear, editar), asistente de venta (selectores) y el
selector de avatar.

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-11-01 | — | Spec creada a partir de la revisión del proyecto (puntos 3, 4, 5 y 7). |
| 2026-11-01 | T1–T6 | SQL crudo vigilado en `check:prisma`, `DataContext` sin 8 funciones muertas, `avatar` acotado, fuera `DELETE /responsables/:id`, `/api` y `db:seed`/`db:reset`. |
| 2026-11-01 | T5, T6 | Avatares guardados revisados (ninguno inválido); fuera `responsables.delete` y `db:push`; `aislamiento-api` cortada por la red tras 102 comprobaciones en verde. |
| 2026-11-01 | — | `test:aislamiento-api` en verde y repaso en pantalla aprobado por el usuario. Spec cerrada. |
