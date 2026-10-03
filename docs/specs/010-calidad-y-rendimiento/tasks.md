# Tareas — Spec 010

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-03).** Hechas T1–T4 y T6, T8–T11. Pendientes T5 y T7, y el tipado de la API (T10).

## T1 · Textos corruptos en el asistente de venta `[x]`
`NewSaleWizard.tsx` (y `aging.ts`) tenían la codificación duplicada: 27 mensajes visibles ("no est�¡ registrado",
"Correo electr�³nico inv�lido", "Renta de Veh��culo") y 14 comentarios. Se revirtió con un script que deshace
las capas de codificación (`í` valía por `Ã` en el primer byte). **Comprobado:** 0 restos de corrupción en
`frontend/src`, `tsc` limpio, el diff solo toca esas líneas. **Por ver:** un error de validación del asistente
con tildes bien escritas.

## T2 · Integración continua `[~]` (escrita, sin activar)
`docs/ci/ci.yml` (**sin activar**: el token de git no tiene el permiso `workflow` y GitHub rechazó el push; para activarlo: `gh auth refresh -h github.com -s workflow` y mover el archivo a `.github/workflows/ci.yml`): en cada push y pull request, el frontend corre `pnpm build` (`tsc` + `vite build`)
y el backend `prisma generate`, `check:prisma`, `test:validaciones` y `test:reglas-espejo`. No necesita
secretos. Las pruebas que levantan servidor y agencias (`test:aislamiento*`, `test:vuelos-api`) usan la base
compartida y siguen siendo manuales. **Por confirmar:** que el primer corrida en GitHub quede en verde (no se
pudo ejecutar el flujo en local); si falla, es un ajuste de pasos, no del código.

## T3 · Carga inicial `[x]`
Todo iba en un solo archivo de 2.308 KB y las 4 fotos del asistente pesaban ~3,7 MB. Ahora cada pantalla se
carga al entrar (`React.lazy` en `App.tsx`, con `Suspense`): el archivo principal baja a 648 KB. Las cuatro
fotos y el fondo del login pasan a WebP (3,7 MB → 0,5 MB; el fondo, 744 KB → 66 KB), y se borran tres
archivos de `public/` que no usaba nadie (`airport_bg.png`, `business_travel_bg.png`,
`logo_ictea_backup.svg`, 1,7 MB). **Por ver:** que las fotos se vean igual y que cambiar de pantalla no
parpadee de más (hay un `LoadingScreen` entre una y otra).

## T4 · Diálogos nativos del navegador `[x]`
Fuera `alert()` y `window.prompt()`. Un error al registrar una venta se queda a la vista en el asistente hasta
el siguiente intento (antes era un `alert` bloqueante); si la venta se crea pero falta un voucher, un aviso
rojo de 10 s lo dice (los errores duran más que los avisos: 4 → 10 s en `ToastContext`). El motivo de la
suplantación se pide en una modal de la app (10 a 300 caracteres, lo que exige el servidor), no con
`prompt`, que algunos navegadores integrados no admiten.

## T6 · Contraseña `[x]`
Una sola política (`backend/src/schemas/contrasena.js`): 8–72 caracteres con minúscula, mayúscula, número y símbolo, para
restablecer, crear usuario y alta de agencia (antes: 6 caracteres sin más en usuarios). El login no la comprueba, así que
quien tiene una clave vieja entra y puede cambiarla. Espejo en `frontend/src/utils/contrasena.ts` (Login, UserModal,
Companies, con ayuda bajo el campo). **Comprobado:** `test:validaciones` (5 casos nuevos). **Por ver:** crear un usuario con
"123456" en pantalla.

## T8 · Reglas de productos `[x]` (alcance reducido)
La auditoría decía "reglas duplicadas a mano"; no era cierto: el servidor valida la forma (`products.schema.js`) y el
asistente las reglas de negocio. Lo real era que el costo del proveedor no se exigía: ahora es obligatorio (> 0) en ticket,
hotel, seguro y plan (`costoObligatorio`). **Comprobado:** `test:validaciones` (12 casos), `test:vuelos-api` y
`test:aislamiento-api` en verde.

## T9 · Contraste `[x]` (la alarma del modo oscuro era falsa)
El modo oscuro ya está resuelto de forma global en `index.css` (`.dark .bg-white`, `.dark .text-gray-*`); los 73 "fondos
blancos" no eran un fallo. Lo real era el contraste: 143 `text-gray|slate-300/400` → `-500` en superficies claras, 136
`text-[10px]` → `text-[11px]`, y `--color-text-light` oscuro de `#5d6675` (2,96:1) a `#8993a6`. **Por ver:** pantallas en modo
oscuro. **Decisión abierta:** subir el texto de 11 px a 12 px.

## T10 · Contrato de tipos `[x]` (primer paso)
`tsconfig.json` con `noImplicitAny` y `strictNullChecks` en `true` (eran 2 y 62 errores; arreglados: `targetKey` tipado,
`lastLogin` admite `null`, índices de permisos, orden con nulos). **Comprobado:** `tsc` y `vite build`. **Pendiente:** tipar
los envoltorios de `src/api/*.ts` (siguen devolviendo `res.data.data` sin tipo) y los ~367 `any`.

## T11 · Tablas en móvil `[x]`
Ancho mínimo y `overflow-x-auto` en `ui/Table.tsx`, detalle de cliente, responsable y usuario, paso 3 del asistente y
Config. **Por ver:** cada tabla a 375 px.

## Pendientes

- **T5 · Crear una venta grande tarda ~40 s** `[ ]` — agrupar la inserción de tramos y pasajeros (`createMany`); el tope de 120 s fue un parche (004 T9).
- **T7 · Archivos que hacen demasiado** `[ ]` — `sales.service.js` (2.231 líneas), `NewSaleWizard.tsx` (1.657, con 15 bloques de validación casi iguales), `Itineraries.tsx` (1.400).

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-03 | T1–T4 | Textos corruptos arreglados, CI añadida, carga inicial de 2,3 MB a 0,65 MB e imágenes a WebP, sin diálogos nativos. |
| 2026-10-03 | T6, T8–T11 | Política de contraseña única, costo de proveedor obligatorio, contraste, `noImplicitAny`/`strictNullChecks`, tablas con scroll en móvil. |
