# Tareas — Spec 039

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente · `[-]` descartada

**Estado (2026-11-07).** Revisión hecha y hallazgos reproducidos en local. Correcciones pendientes de las decisiones
1–8 de `spec.md`.

## T0 · Revisión y reproducción `[x]`
Lectura del núcleo de tenencia, autenticación, suplantación, usuarios, ventas (cobros, anulación, borrado, revisión),
comisiones y lo que envía el asistente. Reproducidos por la API contra Docker local (agencias `prueba-rev039-*`,
desmontadas al terminar): H1, H2, H6, H7, H8, H9, H10.

## T1 · H1 rol superadmin fuera de `/users` `[ ]` — decisión 1
## T2 · H2 cambio de rol invalida la caché/sesión `[ ]` — decisión 2
## T3 · H3 `updateUser` atómico `[ ]`
## T4 · H4 auditoría de suplantación `[ ]`
## T5 · H6 sin `total` por producto `[ ]` — decisión 3
## T6 · H7 coherencia de la comisión neta `[ ]` — decisión 4
## T7 · H8 liquidar solo lo cobrado `[ ]` — decisión 5
## T8 · H9 y H11 borrar pago: cerrojo y venta revisada `[ ]` — decisión 6
## T9 · H10 guarda al eliminar venta `[ ]` — decisión 7
## T10 · H12 y H13 `[ ]`
## T11 · H5 y H14 `[ ]` — decisión 8
## T12 · `tests/revision-039-api.js` con las aserciones invertidas `[ ]`
## T13 · H15 catálogos compartidos solo del superadmin (ruta + RLS) `[ ]` — decisión 9
## T14 · H16 borrar abonos con editar en `all`; pantalla por permisos, no por `isAdmin` `[ ]` — decisión 10
## T15 · H17 paquetes en una `transaccion` `[ ]`
## T16 · H18 dashboard con días de Bogotá (`rangoDeDias`) `[ ]`
## T17 · H19 `linkSale` con alcance y estado; H20 orden correo/guardado `[ ]`
## T18 · H21 mensajes en español y prueba de `POST /companies` con la sesión del superadmin `[ ]`

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-11-07 | T0 | Spec creada. 14 hallazgos; 7 reproducidos por la API en local, todos confirmados. |
| 2026-11-07 | T0 | Alta de agencia por la API probada (desde la sesión y suplantando): funciona; el bug avisado fue un falso positivo. |
| 2026-11-07 | T0 | Segunda tanda: H15–H21. Reproducidos en local H15 y H16; catálogos de prueba borrados al terminar. |
