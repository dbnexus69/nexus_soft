# Tareas — Spec 020

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-17).** Implementada y probada por la API; falta probar el panel y los botones en pantalla.

### T1 · Modelo de permisos en el servidor `[x]`
`utils/alcancePermisos.js` (nuevo: `SCOPED_ACTIONS`, `aAlcance`, `masEstrecho`, `alcanceDeEscritura`), compartido por
`roles.service.js` y `authorize.js`. **Desvío del plan:** la lista vive en `utils/` y no en `roles.service.js`, para que
`authorize.js` no dependa de un servicio con base de datos. Plantillas por defecto con `own`/`none`/`all`; el solapado
de la base lee `true`/`false` como `all`/`none`; `authorize` deja en `permissionScope` el alcance efectivo (tope de
ver) y responde 403 si queda `none`; el `PUT` de permisos guarda recortado a ver; el esquema del panel marca editar y
borrar como `scope`.

### T2 · Comprobaciones de propiedad `[x]`
Escribir con `alcanceDeEscritura` (acción con tope de ver) en `ventasAlcance.js` (`esDeOtro`), `quotesAlcance.js`,
`clients.service.js` (`comprobarQueEsSuyo`) y `flights.service.js` (check-in y cancelación, ticket y plan). El voucher
(`products.controller.js`, ruta con `sales.create`): la propia venta siempre (paso del alta); la de otro, solo con
editar ventas en `all`. Leer sigue con el alcance de ver.

### T3 · Compatibilidad `[x]`
Antes de añadir pruebas, sin cambiarlas: `test:aislamiento-api`, `test:vuelos-api`, `test:ventas-filtros` y
`test:clientes-destinos` en verde; `test:validaciones` y `check:prisma` también.

### T4 · Pruebas nuevas `[x]`
`test:aislamiento-api`, 13 comprobaciones: con "ver todas · editar las suyas · borrar ninguna" el asesor ve la venta y
el cliente del admin (200), no los edita, no cobra ni borra la venta (403), edita los suyos (200) y no borra la suya
(403); con "editar: todas" edita la del admin; "ver: las suyas · editar: todas" se guarda como `own`; el esquema marca
`edit`/`delete` de ventas como alcance. En verde.

### T5 · Panel de permisos `[~]`
`types/index.tsx` (`Alcance`, `SCOPED_ACTIONS` espejo, valores por defecto, `normalizeRolePermissions` respeta los
alcances — si no, `own` se volvía `true` y se guardaba como `all`); `PermissionsGrid.tsx`: las opciones más amplias que
Ver se desactivan con el aviso "No puede ser más amplio que Ver" (`title` y `aria-description`), y bajar Ver baja
editar y borrar. **Comprobado:** `tsc`. **En pantalla:** falta.

### T6 · Botones por registro `[~]`
`PermissionsContext.scopeOf(módulo, acción)` (tope de ver, como el servidor). Ventas: cobrar con alcance de editar y
anular con el de borrar (antes anular era solo para admin y cobrar solo las propias para todo no-admin). Cartera:
"Cobrar" por el asesor de cada venta. Clientes: editar y cambiar estado por `createdBy`. Vuelos: check-in, marcar
pendiente y cancelar por `asesorId` del vuelo (nuevo en la respuesta de `/flights`). **No tocado:** `pages/Quotes.tsx`
(módulo de Darío, spec 007) sigue mostrando los botones por permiso del módulo; el servidor responde 403 en las ajenas.
**Comprobado:** `tsc`, `test:vuelos-api`. **En pantalla:** falta.

### T7 · Documentación `[x]`
`CLAUDE.md` (sección Permissions: acciones con alcance, tope de ver y el cuarto sitio que hay que tocar), README, spec.

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-17 | — | Diseño aprobado (opción B: editar y borrar con alcance; ventas, cotizaciones, clientes y vuelos; nunca más amplio que Ver); spec, plan y tareas escritos. |
| 2026-10-17 | T1–T7 | Implementada. Suites actuales en verde sin cambios; 13 comprobaciones nuevas en `test:aislamiento-api` en verde; `tsc` limpio. Falta la prueba en pantalla. |
