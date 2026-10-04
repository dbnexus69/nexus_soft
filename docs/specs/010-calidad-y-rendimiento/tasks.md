# Tareas — Spec 010

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-04).** Hechas T1–T11. Solo queda activar la CI (T2).

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
oscuro. **Texto de 12 px:** hecho después (ver abajo).

## T10 · Contrato de tipos `[x]`
`noImplicitAny` y `strictNullChecks` activos; los envoltorios de `src/api/*.ts` devuelven tipos (`api/tipos.ts`:
`Pagina<T>`, `Recurso<T>`); los pasos del asistente, `ConfigForms`, los 15 formularios de producto y el comprobante tienen sus
props tipadas (`ClienteDelFormulario` en `wizardData.ts`). `any` explícitos: 421 → 208.

Tipar sacó a la luz fallos reales, ya corregidos:
- **Tipos de documento en hotel y en los pasajeros del tiquete:** las opciones usaban `d.abreviatura`/`d.code`, que la API no
  manda (manda `abbreviation`), así que el valor era el nombre largo ("Cédula de Ciudadanía") y el tipo que el formulario
  ponía por defecto ("CC") no coincidía con ninguna opción. Ahora el valor es la abreviatura.
- `FlightLegsManager` y `PassengerManager` estaban importados pero no se usaban (y el primero leía `a.code`, que no existe):
  borrados.
- Campos que la API sí manda y el tipo no declaraba: `airlineName` del tiquete, `city`/`country` del aeropuerto,
  `transportType` del vuelo de un paquete, `arrivalTime` de un tramo. Y uno que el comprobante leía y no existe:
  `plan.airlineName`.
- `documentTypes` declaraba `abreviatura`; `DashboardStats` no era la respuesta real; `CommissionAgent` sin `avatar`.

**Quedan (deliberados):** los `("" as any)` de los contadores de 5 formularios (dejan el campo vacío mientras se escribe), los de
la librería del selector de fecha, claves dinámicas por categoría (`ProductFormsModal`, `Step2Products`) y `catch (err: any)`.

## T11 · Tablas en móvil `[x]`
Ancho mínimo y `overflow-x-auto` en `ui/Table.tsx`, detalle de cliente, responsable y usuario, paso 3 del asistente y
Config. **Por ver:** cada tabla a 375 px.

## T5 · Crear una venta grande `[x]`
`createSale` escribía una fila por ida y vuelta al pooler. Ahora `services/ventaProductos.js` acumula las filas de
las 15 categorías (tabla por categoría, en lugar de 15 bloques casi iguales) y las escribe con **una inserción por tabla**
(`createMany`), con las personas nuevas resueltas antes (`createMany` + `skipDuplicates`, o `createManyAndReturn` si no
tienen documento) y los abonos también por lote. El número de viajes ya no depende del tamaño de la venta; el tope de 120 s
de la 004 T9 se quitó (vuelve el de 30 s). **Comprobado:** venta de grupo (3 tiquetes × 6 tramos × 8 pasajeros) en
**3,8 s** (antes ~40 s), con todas sus filas, en `test:vuelos-api` (nuevo caso); `test:aislamiento-api`, `test:aislamiento`
y `check:prisma` en verde.

## T7 · Archivos que hacen demasiado `[x]`
- `sales.service.js`: 2.231 → 1.025 líneas. Fuera: la escritura de productos (`ventaProductos.js`, T5), el listado
  (`ventasListado.js`), la cartera de crédito con sus CTE (`ventasCartera.js`) y el alcance de una venta
  (`ventasAlcance.js`: `soloLasSuyas`, `esDeOtro`, `ventaVisible`). El controlador no cambió: el servicio sigue exponiendo
  `listSales`, `getCreditPortfolio` y `getClientCredits`.
- `NewSaleWizard.tsx`: 1.662 → 890; las reglas de cada paso en `wizard/validarPaso.ts`, con una sola función `revisar`
  para los 12 productos que se validaban con el mismo bloque copiado.
- `Itineraries.tsx`: 1.400 → 116. La página solo tiene la cabecera, las pestañas y los avisos; el calendario
  (`components/itineraries/CalendarioVuelos.tsx`) y la lista de check-in con sus acciones y diálogos (`ListaCheckin.tsx`)
  cargan cada uno lo suyo. Las dos pestañas siguen montadas (se ocultan), así que cambiar de una a otra no pierde el mes ni
  la página, como antes.
**Comprobado:** `tsc`, `vite build`, `check:prisma`, `test:aislamiento-api` y `test:vuelos-api` en verde.

## Texto de 12 px `[x]`
Los 161 `text-[11px]` pasan a `text-xs` (12 px) y las marcas de los gráficos del tablero a 12. El comprobante (`VoucherPDF.css`)
no se tocó: es un documento impreso. **Por ver en pantalla:** etiquetas en mayúscula y insignias de pantallas densas
(Tabla, Clientes, Dashboard, Check-in) por si alguna se desborda o salta de línea.

## Pendientes

- Activar la CI (T2): necesita un token con permiso `workflow`.

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-03 | T1–T4 | Textos corruptos arreglados, CI añadida, carga inicial de 2,3 MB a 0,65 MB e imágenes a WebP, sin diálogos nativos. |
| 2026-10-03 | T6, T8–T11 | Política de contraseña única, costo de proveedor obligatorio, contraste, `noImplicitAny`/`strictNullChecks`, tablas con scroll en móvil. |
| 2026-10-03 | T5, T7, 12 px | Escritura de ventas por lotes (40 s → 3,8 s), archivos grandes partidos (parcial), texto mínimo de 12 px. |
| 2026-10-03 | T7, T10 | `validarPaso` con una sola función por lista, diálogos del check-in aparte, API tipada y `any` 421 → 330. |
| 2026-10-04 | T7, T10 | `Itineraries` en calendario y lista, `sales.service` sin listado ni cartera, formularios y comprobante tipados (`any` 330 → 208); tipos de documento de hotel y tiquete corregidos. |
