# Tareas — Spec 022

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-21).** Completada: T1 a T5, y T6 resuelta en la spec 024.

## T1 · Cerrar la 014 T7 como no reproducible `[x]`
Marcada `[x]` en `014/tasks.md` con el motivo y una fila en su registro (orden expresa del usuario). Falta
avisar a Darío.

## T2 · Pruebas en pantalla de 008, 011, 017 y 020 (y lista para Darío) `[x]` (recorrida por el usuario el 2026-10-21: todo ok)

La 012 sale de la lista: su T5 ya está "Confirmado en pantalla" (2026-10-08); solo su encabezado quedó viejo.
Con `pnpm dev` en `backend/` y `frontend/`. Marcar ok/falla:

**008 · Accesibilidad**
1. Recorrer una pantalla con Tab: el anillo de foco se ve al tabular, no al hacer clic.
2. Pulsar la etiqueta de un campo: el cursor va al campo.
3. Avisos de los formularios: el icono va junto al texto.
4. Tipo de transporte de un plan y chips del calendario de vuelos con texto de 12 px: nada se desborda.
5. Responsables → detalle: iniciales, estado en texto, deuda, ventas con estado en palabras, teléfono y correo
   enlazados, "Ida/Regreso" en texto.

**011 · Perfil y voucher de la empresa**
6. Detalle de una venta → "Descargar" voucher: abre el PDF. "Enviar": avisa a quién se envió y el detalle muestra
   "Voucher enviado".
7. "Mi empresa" como asesor: solo Perfil. Como admin: editar, ver la vista previa, guardar y ver el logo nuevo en
   la barra lateral.

**017 · Destinos de preferencia**
8. Cliente → editar: añadir destinos (con "+" y con Enter, y eligiendo una sugerencia), quitar uno, repetir uno
   (pasa a reciente), tope de 5 con aviso.
9. Detalle del cliente: el reciente, "+N" despliega la lista numerada; sin destinos dice "Sin destinos de preferencia".
10. Lista de clientes: filtro "Destino de preferencia" con sugerencias; "Incluir destinos anteriores" amplía el filtro.

**020 · Alcance de editar y borrar**
11. Roles y permisos (superadmin): en asesor, con Ver "las suyas", las opciones más amplias de editar/borrar salen
    desactivadas con "No puede ser más amplio que Ver"; bajar Ver baja editar y borrar.
12. Como asesor con editar "las suyas": en ventas, cartera, clientes y vuelos, los botones de cobrar, anular,
    editar, cambiar estado, check-in y cancelar solo aparecen en sus registros.
13. Con editar "todas" (ver "todas"): aparecen también en los de otros.
## T3 · Activar la CI `[x]`
`docs/ci/ci.yml` → `.github/workflows/ci.yml` (`git mv`), sin el comentario "PENDIENTE DE ACTIVAR". No hizo falta
`gh auth refresh`: la cuenta activa de `gh` (`bmunoz-dev`) ya tenía el permiso `workflow`. Actualizados `CLAUDE.md`
y la 010 T2. **Verificado:** primera corrida en verde (run 39705180146: backend 16 s, frontend 26 s). Avisos sin efecto: las acciones `@v4` corren en Node 24 por la retirada de Node 20.

## T4 · Archivar la 009 `[x]`
Encabezados de `009/spec.md` y `009/tasks.md` en "archivada (2026-10-21)", con enlace a T6. Sin código.

## T5 · Alcance del rol en `GET /uploads/:fichero` `[x]`
`uploads.routes.js`: cada rama de la consulta se une a `ventas` y aplica el alcance de ver (`sales` para el
voucher, `itineraries` para el check-in) con `getEffectivePermissions`/`getActionScope`; `own` →
`v.usuario_id = req.user.id`, sin alcance → la rama no devuelve nada. `%`, `_` y `\` del nombre se escapan en el
`LIKE`. `tests/aislamiento-api.js`, bloque del asesor: el voucher de la venta del admin → 404, el de su propia
venta → 200, el admin abre el del asesor → 200. **Comprobado:** `node --check` en los dos archivos. **Verificado (2026-10-21):** `pnpm test:aislamiento-api` en verde, corrido por el usuario. El documento de check-in no tiene prueba
propia (montarlo pide un vuelo con check-in); usa la misma condición que el voucher.

## T6 · Crear un cliente sobrescribe la `persona` de otro rol `[x]` (resuelta en la [spec 024](../024-persona-compartida-sin-sobrescribir/spec.md))
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
| 2026-10-21 | T3 | Flujo movido a `.github/workflows/`; falta push y primera corrida. |
| 2026-10-21 | T3 | Push y primera corrida de la CI en verde. T2: lista de pantalla escrita. |
| 2026-10-21 | T2 | Pantalla ok en 008, 011, 017 y 020; specs marcadas completadas (012 ya lo estaba). |
| 2026-10-21 | T6 | Resuelta en la spec 024 (reutilizar sin sobrescribir, con aviso). |
