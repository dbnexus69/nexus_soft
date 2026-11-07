# Plan — Spec 039

Cada corrección depende de su decisión en `spec.md`. Sin migraciones: todo es código del backend salvo H7/H14.

## H1 · Rol superadmin fuera de `/users`
`users.service.js`: un helper `_rolAsignable(nombre, solicitante)` usado en `createUser`, `reactivarUsuario` y
`updateUser` — rechaza `superadmin` (403) salvo que quien pide lo sea. `updateUser` y `removeUser` reciben el
solicitante (como ya hace `remove` con `requestedBy`) y rechazan editar a un usuario superadmin si quien pide no lo es.
`role` en `users.schema.js` pasa a `z.enum(['admin','asesor','freelancer','superadmin'])` para no resolver nombres
arbitrarios.

## H2 · Cambio de rol
En `updateUser`, si `updateData.rol_id` cambia: `olvidarUsuario(id)` (o cerrar sesiones, según decisión 2).

## H3 · `updateUser` atómico
Mover la escritura de `personas` y la comprobación de documento dentro de la `transaccion` que ya existe.

## H4 · Auditoría de suplantación
`terminarSuplantacion`: filtrar por `empresa_id = :id` y `superadmin_id = req.user.id`. Para las que caducan sin
salir: al listar, presentar como terminada la que tiene `expira_at < now()` (sin escribir), o cerrarla en
`iniciarSuplantacion` siguiente. Lo más simple: lo primero.

## H6 · Precio por producto
Quitar `total`/`subtotal` de `products.schema.js` y la rama explícita de `precioProducto`. `esVentaACredito` usa la
misma función, así que queda coherente.

## H7 / H8 · Comisión
Según decisiones 4 y 5: derivar o acotar el neto en alta y edición (mismo helper); y, si se decide, añadir la condición
de cobro a `VENTA_CON_COMISION_PENDIENTE` (afecta acumulado y liquidación a la vez, que es lo que se quiere).

## H9 / H10 / H11 · Cobros y borrado
`deletePayment`: `bloquearVenta` antes de leer y la regla de la decisión 6 para revisadas. `removeSale`: la guarda de la
decisión 7.

## H12 / H13
`registerPayment`: un id de método inexistente → 400, como en el alta. Corregir el texto de `NO_EDITABLES`.

## Verificación
Convertir el script de reproducción de la revisión en `tests/revision-039-api.js` con las aserciones invertidas
(lo que hoy pasa debe fallar) y su `pnpm test:revision-039`. Más `test:aislamiento-api` y `test:limite-usuarios`
(tocan usuarios), con permiso. `pnpm build` en frontend si se toca H7/H14.
