# Tareas — Spec 027

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-22).** Completada. Los advisors de Supabase y la prueba en pantalla los confirmó el usuario (no
verificados por Claude: el conector de Supabase no tiene acceso y el navegador no se maneja sin orden).

## T1 · Medir los valores heredados en `permisos_rol` `[x]`
## T2 · Una sola lectura (`leerValor`) en `authorize.js` y `roles.service.js` `[x]`
## T3 · Migración de datos: valores heredados (D1) y `users.view` del asesor (D2) `[x]` aplicada
## T4 · `GET /auth/me/permissions` `[x]`
## T5 · Frontend: permisos propios desde la API y carga inicial según permisos `[x]` `tsc` limpio
## T6 · Valores por defecto del asesor (D2) `[x]`
## T7 · Pruebas `[x]` `test:aislamiento-api` en verde
## T8 · Advisors de Supabase `[x]` revisados por el usuario en el panel de Supabase

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-22 | — | Revisión tras la 026. H1 (la pantalla del asesor/freelancer usa las constantes porque `GET /roles/:rol/permissions` le da 403) apareció al preparar esta spec; H2–H4 venían de la 026. Spec, plan y tareas escritos. |
| 2026-10-22 | — | El usuario decide D1 = c (el más estrecho) y D2 = a (asesor sin lista de usuarios, también en las agencias existentes). Lo de ocultar costos al freelancer pasa a la 028. |
| 2026-10-22 | T1 | Medido (4 agencias: 1, 9, 18, 252): en "ver" con alcance solo 3 filas heredadas, todas del freelancer de la agencia 1 (`clients`, `dashboard`, `sales` = `'true'`). El resto, 'true'/'false' en editar y borrar, que los dos lados ya leían igual. `users.view` del asesor: `'true'` en las cuatro. |
| 2026-10-22 | T3 | La migración deja admin y superadmin fuera de la conversión de "ver": su autorización no sale de la base y el panel los muestra desde esas filas; un `'own'` los mostraría recortados. Aplicada (`20261022130000_permisos_coherentes`); después: 0 valores fuera de all/own/none, asesor `users.view` = `'false'` en las 4, freelancer de la 1 en `own`. |
| 2026-10-22 | T2, T4–T7 | `leerValor` en `alcancePermisos.js`; `authorize.js` y `parseValor` lo usan (un valor desconocido ya no da `'own'`). `GET /auth/me/permissions`. `DataContext`: `fetchMisPermisos` (una petición por sesión), los tres roles del panel solo con `permissions.view`, y users/responsables/comisionistas al arrancar solo con permiso de verlos. La prueba de `GET /users` del asesor pasó de 200 a 403 (D2). `check:prisma`, `test:validaciones`, `test:reglas-espejo`, `tsc` y `test:aislamiento-api` limpios. |
| 2026-10-22 | T5 | Asistente de venta: `NewSaleWizard` pide los comisionistas solo con `commissions.view`, y `Step3Payment` muestra el campo de responsable solo con ver responsables distinto de `none` (la búsqueda daba 403 y el servidor tampoco deja asignarlo, spec 026). `tsc` limpio; sin probar en pantalla. |
| 2026-10-22 | T8 | El usuario confirma que los advisors de Supabase y la prueba en pantalla (asesor y freelancer: arranque y asistente sin 403, permisos del panel reflejados) están hechos. Cierre de la spec. |
