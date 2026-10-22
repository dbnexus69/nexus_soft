# Tareas — Spec 024

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-21).** Implementada y probada por la API. Falta verla en pantalla (T4).

## T1 · `reutilizarPersona` `[x]`
`services/personaCompartida.js`. Campos que rellena: nombres, apellidos, tipo de documento, correo, teléfono, foto y
fecha de nacimiento. En uso: nunca toca `status` ni `deleted_at`.

## T2 · Los cuatro altas y sus controladores `[x]`
Clientes, usuarios, comisionistas y responsables, con `meta.aviso` en el 201. La reactivación de un usuario dado de
baja (`reactivarUsuario`, mismo rol) sigue como estaba.

## T3 · Aviso en pantalla `[x]`
`api/client.ts` (`EVENTO_AVISO`) y `context/ToastContext.tsx`. **Comprobado:** `tsc` limpio.

## T4 · Prueba `[~]`
Tres casos en `tests/aislamiento-api.js`. **Verificado:** `pnpm test:aislamiento-api` "Todo en orden" (con las
comprobaciones de antes), `check:prisma` y `test:validaciones` en verde. **Por ver en pantalla:** crear un cliente
con la cédula de un usuario → aviso azul y el cliente aparece con el nombre del usuario.

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-21 | — | Diseño aprobado por el usuario (reutilizar sin sobrescribir, con aviso). |
| 2026-10-21 | T1–T4 | Implementada; `test:aislamiento-api`, `check:prisma`, `test:validaciones` y `tsc` en verde. |
