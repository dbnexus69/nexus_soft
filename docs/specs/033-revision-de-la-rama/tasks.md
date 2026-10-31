# Tareas — Spec 033

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente · `[-]` descartada

**Estado (2026-10-30).** Completada: T1–T3, T5 y T7–T18 hechas y probadas (`test:limite-usuarios`,
`test:vuelos-api`, `test:aislamiento-api` en verde y T16 recorrida en pantalla por el usuario); T4 y T6 descartadas.

## T1 · Límite de usuarios: reactivar y altas simultáneas `[x]`
`users.service.js`: `_comprobarLimiteDeUsuarios(tx)` bloquea la fila de la agencia (`FOR UPDATE`) y cuenta dentro de
la transacción que escribe, en `createUser`, `reactivarUsuario` y `updateUser` (de inactivo a activo). Un alta
inactiva ya no ocupa cupo. `tests/limite-usuarios-api.js` con dos casos nuevos: reactivar con el cupo lleno → 422 y
dos altas a la vez → una sola entra. `backend/CLAUDE.md` al día.
**Comprobado:** `node --check` y `check:prisma` en verde; `pnpm test:limite-usuarios` corrido por el usuario
(2026-10-30): "Todo en orden".

## T2 · Check-in: borrar los documentos reemplazados `[x]`
`flights.service.js::updateCheckin`: tras guardar documentos nuevos, borra del bucket los de `tramo.checkin_docs`
anteriores; un fallo del borrado no deshace el check-in (`borrar` lo deja en el log como `[STORAGE_FAILED]`).
`tests/vuelos-api.js`: subir uno, reemplazarlo, el viejo da 404 y el nuevo 200.
**Comprobado:** `pnpm test:vuelos-api` corrido por el usuario (2026-10-30): "Todo en orden".

## T3 · `config/env.js`: exigir las claves de Storage en producción `[x]`
`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en la lista de `[MISSING_ENV]`. `render.yaml` ya las declara.

## T4 · Tope de memoria de las subidas `[-]`
Hoy: 5 MB por fichero, hasta 5 ficheros por check-in (25 MB por petición en memoria). Descartada por decisión del usuario
(2026-10-30): se deja así.
**Recomendación (2026-10-30):** dejarlo así. 25 MB es el peor caso (cinco ficheros de 5 MB); una tarjeta de
embarque pesa unos cientos de KB. Hacen falta unas diez subidas así a la vez para acercarse a los 512 MB de Render, y
bajar el número rompe el caso de un grupo con varias tarjetas. Revisar si las métricas de Render muestran presión de
memoria.

## T5 · `nombreUnico` con `crypto.randomUUID()` `[x]`
`middleware/upload.js`. **Comprobado:** carga del módulo.

## T6 · `GET /uploads/:fichero` con un solo viaje a Storage `[-]`
Descartada: `almacenamiento.firmar` convierte cualquier error en un 502, así que quitar `existe()` cambiaría "no
existe" (404) por "Storage no responde" (502), o habría que tocar `firmar`, que usan el voucher, los logos y las
imágenes de cotización. Una llamada de más al abrir un fichero no compensa ese riesgo.

## T7 · `sales.service.js` sin importar `middleware/authorize` `[x]`
El controlador pasa `alcance.responsablesView` (`conResponsables` en `sales.controller.js`, solo en crear y editar);
`comprobarResponsablePropio` lo lee de ahí. `createSale`/`updateSale` no tienen otros llamadores.
**Comprobado:** `pnpm test:aislamiento-api` corrido por el usuario (2026-10-30): "Todo en orden".

## T8 · Comentario viejo de `roles.service.js` y voseo del mensaje del límite `[x]`
El mensaje dice "tienes", "necesitas", "escríbenos". El `plan.md` de la 029 conserva el texto original (es histórico).

## T9 · `status` de usuario como `z.enum(['active', 'inactive'])` `[x]`
`schemas/users.schema.js`, en crear y editar; la pantalla solo manda esos dos. **Comprobado:** `test:validaciones`
en verde.

## T10 · Pruebas que faltan `[x]`
- `GET /auth/me/permissions` suplantando: caso nuevo en `tests/aislamiento-api.js` (200, ventas `all`, panel visible).
- Reemplazo de documentos del check-in: en T2.
- Un fallo de Storage en el check-in no envía el correo: **sin prueba**, no hay forma de forzar el fallo desde la
  API sin tocar el código de producción. Queda cubierto por lectura (la subida va antes del correo, dentro del `try`).
**Comprobado:** `test:aislamiento-api` y `test:vuelos-api` en verde (usuario, 2026-10-30).

## T11 · Permisos que llegan tarde no pisan al usuario nuevo `[x]`
`DataContext.tsx::fetchMisPermisos` solo escribe la respuesta si sigue siendo la petición vigente, y la carga inicial
no pide listas si el usuario ya cambió (`vigente`, que la limpieza del efecto pone en `false`).
**Comprobado:** `tsc` sin errores.

## T12 · Un responsable de un borrador no se envía sin permiso de verlo `[x]`
`NewSaleWizard.tsx`: `responsableId` solo viaja si `scopeOf('responsables', 'view') !== 'none'`, la misma condición
con la que `Step3Payment.tsx` muestra el campo. **Comprobado:** `tsc` sin errores. **Confirmado en pantalla (usuario, 2026-10-30):** como
asesor, una venta a crédito con un borrador que traía un responsable → 201.

## T13 · Aviso de límite por debajo del uso en la ficha de la agencia `[x]`
`companies.service.js::getById` devuelve `uso.usuariosActivos` (el mismo conteo que el límite; `uso.usuarios` cuenta
también inactivos y dados de baja). `Companies.tsx` avisa, sin impedir guardar, si el límite queda por debajo.
**Comprobado:** `tsc`, `node --check`, `check:prisma`. **Confirmado en pantalla (usuario, 2026-10-30).**

## T14 · Errores por campo en la ficha de la agencia `[x]`
`Companies.tsx` (`CAMPOS_FICHA`): los `error.details` de un 422 van a su campo (nombre, límite, plan, precio, correo y
nombre del remitente); los de otros campos, al aviso general. **Comprobado:** `tsc`. **Confirmado en pantalla (usuario, 2026-10-30):**
límite 0 → error en "Límite de usuarios".

## T15 · Sin copia vieja de permisos si falla la carga `[x]`
`DataContext.tsx::fetchMisPermisos` escribe también el `null` de un fallo (solo si sigue siendo la petición vigente):
borra la copia del caché y `PermissionsContext` cae a los del rol. **Comprobado:** `tsc`.

## T16 · Pruebas en pantalla de lo que tocó la rama `[x]`
Con `pnpm dev` en `backend/` y `frontend/`. Marcar ok/falla:
1. Freelancer: Responsables muestra solo los suyos; editar y desactivar solo en los suyos; sin botón de borrar.
2. Asesor: no ve el menú Responsables ni el campo "Responsable del crédito"; T12.
3. Superadmin → Agencias → ficha: plan (límite, nombre, precio) y remitente se guardan y vuelven a cargar.
4. Admin con el cupo lleno: crear un usuario muestra el mensaje del límite en el modal; reactivar uno inactivo también.
5. Check-in con documento, y reemplazarlo: el nuevo se abre.

## T17 · Desactivar un responsable sin reescribir a la persona, y con respuesta mínima `[x]`
Revisado el 2026-10-30 (no hay botón de borrar: el de la tabla desactiva). Lo que se encontró:
1. **Media — reescribía los nombres de la persona.** El botón reenviaba la ficha rehecha desde `name`
   (`split(' ')[0]` como nombre): "Juan Carlos Pérez Gómez" quedaba "Juan" / "Carlos Pérez Gómez", en la persona
   compartida por documento (spec 024), o sea también en el cliente o usuario con ese documento.
2. **Media — un `PUT` sin tipo de documento lo borraba** (`tipo_documento_id: null`).
3. **Media — respondía la ficha entera** (nombre, documento, teléfono, correo, deuda…) a un cambio de estado.
4. **Baja — `status` era `z.string()`**, y la deuda que impide desactivar contaba ventas borradas (`$queryRawUnsafe`).

**Hecho:**
- `PATCH /responsables/:id/status` (`authorize('responsables', 'edit')`, `statusResponsableSchema` estricto: solo
  `status`, `active`/`inactive`) → `responsablesService.setStatus`: mismo alcance que editar (404/403), la deuda antes
  de desactivar, y responde **solo `{ id, status }`**.
- `updateResponsable` ya no escribe el tipo de documento si no llegó; `status` como enum.
- `comprobarSinDeuda`: `$queryRaw` con parámetro y `deleted_at IS NULL`.
- Pantalla: el botón llama a `DataContext.setResponsableStatus`, que cambia solo el estado de la fila.
- `tests/aislamiento-api.js`: respuesta con solo `id`/`status`, nombres compuestos y tipo intactos, 422 con un estado
  que no existe o con otros campos, `PUT` con solo el estado no borra el tipo, freelancer sobre uno ajeno → 403.
**Comprobado:** `node --check`, `check:prisma`, `tsc`. **Comprobado:** `test:aislamiento-api` en verde y en pantalla (usuario, 2026-10-30).
**También (pedido del usuario):** `PUT /responsables/:id` responde solo `{ id, ...los campos que llegaron }`
(`CAMPOS_DE_RESPUESTA`), y `DataContext.updateResponsable` lo mezcla con la fila. Prueba: un `PUT` de solo el estado →
`{ id, status }`; uno de nombres → `{ id, firstName, lastName, name }`. El resto de las escrituras del sistema, en la
[`034`](../034-respuestas-minimas/spec.md).

## T18 · Una sola lectura de permisos en `PermissionsContext` `[x]`
`canView/canCreate/canEdit/canDelete = scopeOf(módulo, acción) !== 'none'`, y `can()` (sin uso) quitado. `scopeOf`
ahora recorta por ver **solo las acciones con alcance** (`tieneAlcance`), como `authorize`: antes recortaba cualquiera,
así que crear o borrar sí/no se habrían recortado sin que el servidor lo hiciera. Un módulo o acción que falte da
`'none'` (antes `canView` daba `true`). `frontend/CLAUDE.md` lo dice. **Comprobado:** `tsc`. **Comprobado:** T16 en
pantalla con cada rol (menú, rutas, botones).

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-30 | — | Spec creada a partir de la revisión de la rama contra `main`. |
| 2026-10-30 | T1 | Límite con bloqueo de la agencia en las tres escrituras que dejan a alguien activo. |
| 2026-10-30 | T2–T10 | T2, T3, T5, T7–T10 en el código; T6 descartada; T4 a decidir. `node --check`, `check:prisma` y `test:validaciones` en verde. |
| 2026-10-30 | T2, T7, T10 | `test:vuelos-api` y `test:aislamiento-api` en verde (usuario). T4 descartada: se deja 5 × 5 MB. |
| 2026-10-30 | T11–T18 | Revisión del frontend: T11 y T12 corregidas (`tsc` en verde); T13–T18 creadas. |
| 2026-10-30 | T13–T15, T17, T18 | T13–T15 en el código (`tsc`, `check:prisma`). Revisado desactivar (T17) y `canView` (T18): propuestas a decidir. |
| 2026-10-30 | T17, T18 | `PATCH /responsables/:id/status` con respuesta mínima; `PermissionsContext` sobre `scopeOf`. `tsc`, `check:prisma`, `node --check` en verde. |
| 2026-10-30 | T17 | `PUT /responsables/:id` con respuesta mínima; el resto de escrituras pasa a la spec 034. |
| 2026-10-30 | T12–T18 | `test:aislamiento-api` en verde y T16 recorrida en pantalla por el usuario: todo ok. Spec cerrada. |
