# Tareas — Spec 026

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-22).** Completada: `test:aislamiento-api` en verde, prueba en pantalla y advisors de Supabase
confirmados por el usuario.

## T1 · Migración `responsables.creado_por_id` `[x]` aplicada
## T2 · Migración de datos de `permisos_rol` (freelancer de todas las agencias) `[x]` aplicada
## T3 · Backend: alcance en responsables `[x]` (+ 403 al vender con un responsable ajeno)
## T4 · ~~Backend: `totalProfit` en el dashboard~~ descartada (la ganancia ya es `totalRevenue`)
## T5 · Frontend: alcance en Responsables `[x]` `tsc` limpio
## T6 · Pruebas `[x]` `test:aislamiento-api` en verde

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-21 | — | Brainstorming con el usuario: ganancia = TA de sus ventas; sus responsables = los que creó; agencias existentes se migran. Spec, plan y tareas escritos. |
| 2026-10-22 | T3, T4, T5 | Revisión del plan. Ganancia = el "Ingresado en el periodo" que ya existe: T4 y la tarjeta de T5 descartadas (sin `db:generate`). El freelancer solo usa sus responsables en el asistente (400 si la persona ya es de otro): aceptado. T3 suma `DEFAULT_ROLE_VALUES` de `roles.service.js`, desfasado desde la 025. |
| 2026-10-22 | T1–T6 | Código escrito. Hallazgo: la superposición de `authorize.js` lee como 'own' un valor no reconocido en un `view` con alcance, así que el `'false'` sembrado al asesor en responsables habría pasado a 'own'. Arreglo: defaults del asesor en `'none'` y la migración T2 convierte 'true'/'false' de responsables a 'all'/'none' en todos los roles. Un responsable revivido pasa a ser de quien lo revive. `tsc`, `test:validaciones` y `test:reglas-espejo` limpios; `check:prisma` falla solo por `creado_por_id` hasta correr `db:generate`. `migrate deploy` bloqueado por el filtro de permisos del entorno. |
| 2026-10-22 | T1–T3, T6 | `sales.service.js`: con responsables en `own`, crear o editar una venta con un responsable ajeno da 403 (`comprobarResponsablePropio`). `migrate deploy` de las dos migraciones, `db:generate`, `migrate status` al día, `check:prisma` limpio. `test:aislamiento-api`: todo verde en lo visible (incluida la suplantación con `createdBy` null), 1 fallida fuera del tramo de salida leído; volver a correrlo lo bloqueó el filtro del entorno. |
| 2026-10-22 | T6 | La fallida era la prueba: el PUT ajeno mandaba `lastName: 'X'` y la validación (422) corta antes de mirar el dueño. Con un nombre válido, 403. `test:aislamiento-api`: todo en orden. |
| 2026-10-22 | T3 | También el asesor: con ver responsables en `none`, poner un responsable en una venta da 403; con `own`, solo uno suyo. Al editar una venta solo se comprueba si el responsable cambia. `test:aislamiento-api`: todo en orden. |
| 2026-10-22 | — | Cierre: el usuario confirma los advisors de Supabase y la prueba en pantalla. La 027 corrige después la lectura de los permisos y el `users.view` del asesor. |
