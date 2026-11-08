# Tareas — Spec 039

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente · `[-]` descartada

**Estado (2026-11-08).** H1 y las correcciones de la spec 040 (H22–H28), hechas y aprobadas en pantalla. El resto sigue
pendiente; las decisiones 2–10 de `spec.md` están por tomar.

## T0 · Revisión y reproducción `[x]`
Lectura del núcleo de tenencia, autenticación, suplantación, usuarios, ventas (cobros, anulación, borrado, revisión),
comisiones y lo que envía el asistente. Reproducidos por la API contra Docker local (agencias `prueba-rev039-*`,
desmontadas al terminar): H1, H2, H6, H7, H8, H9, H10.

## T1 · H1 rol superadmin fuera de `/users` `[x]` — hecho en T19: solo otro superadministrador lo asigna
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
## T19 · H22–H26 correcciones del commit `0a82629` (spec 040) y H1 `[x]`
**Comprobado:** `test:voucher-plantilla` (nueva, va en la CI), `check:prisma`, `test:validaciones`, `pnpm build`; con la
base local, `test:voucher`, `test:cotizacion-imagenes`, `test:limite-usuarios` y `test:aislamiento-api`, todas en verde.
**En pantalla:** «Mi empresa» y el modal de Usuarios, aprobados por el usuario (2026-11-08).
## T21 · H28 correo guardado con mayúsculas `[x]`
## T20 · H27 migración `20261107120000` en producción antes de subir a `main` `[x]`
Ya estaba aplicada: `migrate status` contra producción (2026-11-08) responde «up to date» con las 36 migraciones. No hizo falta `migrate deploy`.

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-11-07 | T0 | Spec creada. 14 hallazgos; 7 reproducidos por la API en local, todos confirmados. |
| 2026-11-07 | T0 | Alta de agencia por la API probada (desde la sesión y suplantando): funciona; el bug avisado fue un falso positivo. |
| 2026-11-07 | T0 | Segunda tanda: H15–H21. Reproducidos en local H15 y H16; catálogos de prueba borrados al terminar. |
| 2026-11-08 | T19 | Análisis del commit `0a82629` y correcciones H22–H26, con H1. Migración aplicada en local. Suites con base en verde; `test:aislamiento-api` destapó que comparar el correo sin mayúsculas dejaba bloquear a otro admin (corregido) y H28. |
| 2026-11-08 | T19 | Repaso en pantalla aprobado por el usuario. T1 y T19 cerradas. |
