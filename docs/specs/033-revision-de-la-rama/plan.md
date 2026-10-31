# Plan — Spec 033

1. **Límite de usuarios (1, 2).** `_comprobarLimiteDeUsuarios(tx)` lee la agencia con `SELECT … FOR UPDATE` y cuenta los
   activos dentro de la `transaccion` que escribe; la llaman `createUser` (más una comprobación previa fuera de la
   transacción, para no tocar `personas` si ya no hay cupo), `reactivarUsuario` y `updateUser` cuando pasa a alguien
   de inactivo a activo. Un alta ya inactiva no ocupa cupo.
2. **Huérfanos del check-in (3).** En `flights.service.js::updateCheckin`, tras guardar los `checkin_docs` nuevos, borrar
   del bucket los ficheros de los anteriores (el mismo patrón que `products.controller.js::uploadVoucher`), sin fallar si
   el borrado falla.
3. **Variables de producción (4).** Añadir `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` a la lista de `config/env.js`.
4. **Memoria (5).** Bajar el tope de `upload.array('files', 5)` del check-in o el `fileSize` de `upload.js`; decidir con
   el usuario cuál.
5. **Nombre del adjunto (6).** `nombreUnico` con `crypto.randomUUID()` y la extensión.
6. **Un viaje a Storage (7).** `uploads.routes.js`: quitar `existe()`, firmar directamente y responder 404 si Storage dice
   que el objeto no existe.
7. **Permiso de responsables en la venta (8).** Que el controlador pase el alcance de ver responsables en `alcance` (o
   reutilizar `req.user` ya resuelto) en vez de llamar a `getEffectivePermissions` desde el servicio.
8. **Textos (9).** Comentario de `DEFAULT_ROLE_VALUES.asesor.users` y el mensaje del límite en el español de la app.
9. **`status` (10).** `z.enum(['active', 'inactive'])` en `schemas/users.schema.js`.
10. **Pruebas (11).** En `tests/vuelos-api.js` el reemplazo de documentos y el fallo de Storage; en
    `tests/aislamiento-api.js` `GET /auth/me/permissions` suplantando.

Las pruebas con base (`test:limite-usuarios`, `test:vuelos-api`, `test:aislamiento-api`) solo con permiso del usuario.
