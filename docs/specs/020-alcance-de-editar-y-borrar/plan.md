# Plan — Spec 020

Orden: servidor (modelo de permisos → comprobaciones) → pruebas → pantalla → docs. Hasta que el panel cambie, los
valores guardados siguen siendo `true`/`false`, que se leen igual que hoy.

## Decisiones

1. **Una tabla de acciones con alcance** (`SCOPED_ACTIONS` en `roles.service.js`) sustituye a `SCOPED_VIEW_MODULES`;
   `authorize.js` la importa. No se repite la lista.
2. **El tope de "Ver" se aplica en `authorize`**, no en cada servicio: `req.permissionScope` ya es el efectivo.
3. **Un `PUT` de permisos más amplio que "Ver" se recorta a "Ver"** (no 422): el panel ya no deja elegirlo, y
   recortar es lo que de todos modos haría `authorize`.
4. **Los servicios no deciden el alcance**: reciben `{ viewScope, permissionScope, user }`; `viewScope` para leer y
   `permissionScope` para escribir.

## Pasos

| Paso | Dónde | Qué |
|---|---|---|
| 1 | `services/roles.service.js` | `SCOPED_ACTIONS`; `parseValor`/`encodeValor` con `all`/`own`/`none` (y `true`/`false`) en esas acciones; recorte a "Ver" al guardar; `type: 'scope'` en el esquema del panel; `DEFAULT_ROLE_VALUES` con `own` donde corresponde |
| 2 | `middleware/authorize.js` | Plantillas por defecto; solapado de la base con tres valores en las acciones con alcance; alcance efectivo (el más estrecho con `view`) en `req.permissionScope` |
| 3 | `services/ventasAlcance.js`, `services/quotesAlcance.js` | Escribir mira `permissionScope`; leer, `viewScope` |
| 4 | `services/clients.service.js` | `soloLosSuyos` distingue leer (ver) y escribir (acción) |
| 5 | `services/flights.service.js` (+ controlador) | Check-in con el alcance de `edit` |
| 6 | `tests/aislamiento-api.js` | Casos de la spec (rol asesor reconfigurado por la API y restaurado al final) |
| 7 | Suites actuales sin cambios | Prueba de compatibilidad |
| 8 | `frontend/src/types/index.tsx` | Tipos y valores por defecto |
| 9 | `components/users/PermissionsGrid.tsx` | Selector de alcance, opciones desactivadas, bajar con "Ver" |
| 10 | `context/PermissionsContext.tsx` + listas de ventas, cotizaciones, clientes y vuelos | `scopeOf`; ocultar botones de registros ajenos con `own` |
| 11 | Docs | `CLAUDE.md` (sección Permissions), `tasks.md`, README |

## Qué hace falta del usuario

Permiso para las pruebas con BD; la prueba en pantalla del panel y de los botones.
