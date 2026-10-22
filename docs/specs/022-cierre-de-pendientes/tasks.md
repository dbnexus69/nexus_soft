# Tareas — Spec 022

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-21).** Hechas T1, T4 y T5. Pendientes T2, T3 y T6.

## T1 · Cerrar la 014 T7 como no reproducible `[x]`
Marcada `[x]` en `014/tasks.md` con el motivo y una fila en su registro (orden expresa del usuario). Falta
avisar a Darío.

## T2 · Pruebas en pantalla de 008, 011, 012, 017 y 020 (y lista para Darío) `[ ]`
## T3 · Activar la CI `[ ]` — necesita que el usuario corra `gh auth refresh` y ordene el push

## T4 · Archivar la 009 `[x]`
Encabezados de `009/spec.md` y `009/tasks.md` en "archivada (2026-10-21)", con enlace a T6. Sin código.

## T5 · Alcance del rol en `GET /uploads/:fichero` `[x]`
`uploads.routes.js`: cada rama de la consulta se une a `ventas` y aplica el alcance de ver (`sales` para el
voucher, `itineraries` para el check-in) con `getEffectivePermissions`/`getActionScope`; `own` →
`v.usuario_id = req.user.id`, sin alcance → la rama no devuelve nada. `%`, `_` y `\` del nombre se escapan en el
`LIKE`. `tests/aislamiento-api.js`, bloque del asesor: el voucher de la venta del admin → 404, el de su propia
venta → 200, el admin abre el del asesor → 200. **Comprobado:** `node --check` en los dos archivos. **Verificado (2026-10-21):** `pnpm test:aislamiento-api` en verde, corrido por el usuario. El documento de check-in no tiene prueba
propia (montarlo pide un vuelo con check-in); usa la misma condición que el voucher.

## T6 · Crear un cliente sobrescribe la `persona` de otro rol `[ ]`
Problema heredado de la 009 (archivada). `createClient` (`clients.service.js:257`): si el documento ya existe
en `personas` (p. ej. es de un usuario o un comisionista), hace `personas.update` con el nombre, correo,
teléfono, etc. del formulario del cliente y la reactiva (`status: 'active'`, `deleted_at: null`), sin aviso.
Hay que decidir el comportamiento (reutilizar sin sobrescribir, rechazar con 422, o avisar y pedir
confirmación) y revisar los otros `personas.update` del mismo archivo (líneas 353, 401, 421) y de los otros
tres servicios que crean personas. Sin diseño todavía.

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-21 | — | Spec, plan y tareas escritos con las decisiones del usuario. |
| 2026-10-21 | T1, T4 | 014 T7 cerrada; 009 archivada. |
| 2026-10-21 | T5 | Alcance del rol en los ficheros y prueba ampliada; `node --check`. Falta correr la prueba. |
| 2026-10-21 | T6 | Registrado el efecto cruzado sobre `personas` como problema por resolver. |
| 2026-10-21 | T5 | `test:aislamiento-api` en verde (corrido por el usuario). |
