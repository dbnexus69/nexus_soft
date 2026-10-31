# Tareas — Spec 034

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-30).** Completada: T1–T6, T8 y T9 hechas, probadas con base y confirmadas en pantalla; T7 y T10
descartadas, con su motivo.

## T1 · Inventario de lo que responde cada escritura `[x]`
Leído el 2026-10-30 (servicio → controlador → `src/api/*.ts` → quién lo usa en la pantalla). Gravedad: **A** = fila
cruda de la base (lleva `empresa_id` y columnas internas, regla 4); **B** = datos personales o internos que nadie pidió;
**C** = ficha entera, sin datos sensibles de más; **ok** = ya es mínima o es lo que se pidió.

| Ruta | Responde hoy | La pantalla lee | Gravedad |
|---|---|---|---|
| `POST /responsables` | fila cruda de `responsables` (`empresa_id`, `persona_id`, `creado_por_id`, `deleted_at`) | nada (recarga la lista) | **A** → T2 |
| `PATCH /sales/:id/review-status` | fila cruda de `ventas` (`empresa_id`, costos, ganancias, `usuario_id`…) | nada | **A** → T2 |
| `POST /commissions/agents` | ficha con **banco y tipo de cuenta**, documento, teléfono, correo, acumulado | la fila nueva | **B** → T3 |
| `POST /users`, `PUT /users/:id` | ficha con documento, fecha de nacimiento, último login, teléfono | la fila | **B** → T4 |
| `POST /clients` | ficha con documento, fecha de nacimiento, teléfono, correo, creador | la fila | **B** → T5 |
| `PUT /sales/:id` | `getSaleById` entero | revisar | **C** → T6 |
| `POST/PUT /quotes…` (crear, editar, duplicar, enviar, responder, vincular, imagen) | `getQuoteById` entero | la pantalla de la cotización lo pinta | **C** → T7 |
| `POST/PATCH /companies…`, `PUT /:id/logo` (superadmin) | ficha de la agencia con uso | nada (recarga) | **C** → T8 |
| `PATCH /company-profile` | el perfil | revisar | **C** → T8 |
| `POST/PUT/PATCH /config/:section` | el ítem transformado | el ítem (reemplazo optimista) | **C** → T9 |
| `PUT /roles/:role/permissions` | el conjunto de permisos del rol | el panel | ok (es lo que se mandó: reemplaza todo) |
| `PUT /clients/:id`, `PUT /commissions/agents/:id`, `POST /sales/:id/cancellation` | `{ message }` | nada | ok |
| `PATCH /clients/:id/toggle-status` | `{ status }` | — | ok |
| `POST /sales/:id/payments` | saldo, estado y el pago | eso | ok |
| `PUT /flights/:id/checkin`, `POST …/cancellation` | estado del check-in del tramo | eso | ok |
| `POST /commissions/settlements` | la liquidación con nombre del comisionista | la liquidación | ok |
| `POST /quotes/:id/convert-to-sale` | lo que precarga el asistente | eso | ok (es lo pedido) |
| `POST /sales` | `{ …, products: [{ category, index, detalleId }] }` | eso | ok (fuera de alcance) |
| `PUT/PATCH /responsables/:id…` | lo editado / `{ id, status }` | eso | ok (033 T17) |

**De paso:** `roles.controller.js::updatePermissions` lee `req.body.permissions`, no `req.validatedBody`: revisar en T10
si la ruta tiene `validate` (si no, la regla de pasar `req.validatedBody` no se cumple).

## T2 · Filas crudas: alta de responsable y venta revisada `[x]`
- `responsables.service.js::createResponsable` → `{ id, numero }` (+ `aviso` en `meta`, como antes).
- `sales.service.js::updateReviewStatus` → `{ id, isReviewed }`.
- `src/api/responsables.ts`: tipo de `createResponsable` al día. Nadie en la pantalla leía ninguna de las dos.
- `tests/aislamiento-api.js`: las dos respuestas, por sus claves.
**Comprobado:** `node --check`, `check:prisma`, `tsc`. **Comprobado:** `test:aislamiento-api` en verde (2026-10-30).

## T3 · Comisionistas (datos bancarios) `[x]`
`commissions.service.js::createAgent` → `{ id, numero, ...lo enviado }` (`CAMPOS_DE_RESPUESTA`): banco, tipo y número
de cuenta, teléfono, correo y acumulado solo vuelven si se mandaron. `updateAgent` ya respondía `{ message }`.
Prueba: un alta sin datos bancarios no los devuelve. La prueba del mínimo por defecto (50.000) leía
`paymentThreshold` de la respuesta del alta; ahora lo lee del listado (primera corrida del usuario, 2026-10-30: era
la única falla, por la prueba, no por el código).

## T4 · Usuarios `[x]`
`users.service.js`: `createUser` y `reactivarUsuario` → `{ id, numero, ...lo enviado }`; `updateUser` → `{ id, ...lo
editado }`. La contraseña no está en el mapa: no vuelve nunca. Ya no viajan fecha de alta ni último login. Pruebas:
el alta no trae contraseña, fecha de nacimiento, último login ni fecha de alta; editar el teléfono → `{ id, phone }`.

## T5 · Clientes `[x]`
`clients.service.js::createClient` → `{ id, numero, ...lo enviado }`, con lo guardado cuando la persona es compartida
(spec 024; las pruebas de la 024 leen `firstName` de la respuesta y siguen valiendo). Ya no viajan fecha de
nacimiento, creador ni fecha de registro si no se mandaron. Prueba en `aislamiento-api`.

**Pantalla (T3–T5):** los hooks ya recargaban la lista y nadie leía estas respuestas. Quitadas de `DataContext`
`addUser`, `addClient` y `addCommissionAgent`, que no usaba nadie y metían la respuesta como fila completa. Tipos de
`src/api/{users,clients,commissions}.ts` al día (`Partial<…> & { id }`).

## T6 · Editar venta `[x]`
`sales.service.js::updateSale` → `{ id, ...lo editado (valor guardado), status, total }`: el estado y el total pueden
cambiar sin que se manden. Antes, `getSaleById` entero. `useSales` ya recargaba la lista. Prueba: editar las
observaciones → `["id","observations","status","total"]`.

## T7 · Cotizaciones `[-]`
Se queda como está. La respuesta es el documento que se está editando: las líneas con los ids que asigna el servidor y
las URLs firmadas de sus imágenes, que necesitan el formulario (`ImagesField` lee las imágenes de la línea de la
respuesta de subir/borrar) y la prueba de la 021 (`cotizacion-imagenes-api.js`, de Darío). No lleva datos personales
más allá de los que la cotización ya muestra. Recortarla es rehacer ese flujo y la prueba de otra spec.

## T8 · Agencias y perfil de la empresa `[x]`
- `companies.service.js` (superadmin): `create` y `update` → `{ id, ...lo enviado }` (sin `admin`, que lleva la
  contraseña del primer usuario); `setLogo` → `{ id, logoUrl }`, que es lo único que lee `Companies.tsx`. Prueba en
  `limite-usuarios-api`: subir el límite → `["id","limiteUsuarios"]`.
- `PATCH /company-profile` **se queda**: `Empresa.tsx` repinta el formulario entero con la respuesta (valores
  normalizados) y son datos de la agencia, no de una persona.

## T9 · Catálogos de configuración `[x]`
`config.service.js::updateItem` → `{ id, ...lo enviado }` (los campos que el catálogo devuelve con el mismo nombre).
`createItem` se queda: `DataContext` reemplaza con él el ítem optimista y necesita la fila entera; es lo que se mandó
más el id.

## T10 · Roles: `validate` y `req.validatedBody` `[-]`
Descartada. `PUT /roles/:role/permissions` no tiene `validate`, pero `roles.service.js::updatePermissions` ya rechaza
con 400 lo que no es un objeto por módulo, lo vacío y lo que no está en `MODULE_ACTIONS`. Un esquema Zod repetiría esa
regla en un segundo sitio. Su respuesta es el conjunto que se mandó (reemplaza todo): ya es mínima.

## Ayudante común
`utils/respuestaMinima.js::soloLoPedido(ficha, cuerpo, mapa)`: de la ficha guardada, el `id` y los campos que la
petición mandó, según el mapa de cada servicio. Lo usan responsables, usuarios, clientes, comisionistas y agencias.

**Comprobado (T3–T9):** `node --check`, `check:prisma`, `test:validaciones`, `tsc`; con base (2026-10-30, Claude con permiso
del usuario): `test:aislamiento-api`, `test:limite-usuarios`, `test:clientes-destinos` y `test:voucher` en verde. En
`voucher-api` se corrigió una prueba vieja (esperaba un error por el dígito del NIT, que no se comprueba desde `a0cafee`).
**Confirmado en pantalla (usuario, 2026-10-30):** crear y editar usuarios, clientes, comisionistas, ventas y
agencias, y el logo de una agencia.

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-30 | — | Spec creada a pedido del usuario, a partir de la 033 T17. |
| 2026-10-30 | T1, T2 | Inventario de las escrituras; recortadas las dos que devolvían filas crudas. |
| 2026-10-30 | T3–T10 | Respuestas mínimas en comisionistas, usuarios, clientes, editar venta, agencias y catálogos (`utils/respuestaMinima.js`); T7 y T10 descartadas. |
| 2026-10-30 | — | Suites con base en verde y repaso en pantalla aprobado por el usuario. Spec cerrada. |
