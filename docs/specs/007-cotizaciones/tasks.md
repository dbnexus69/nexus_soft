# Tareas — Spec 007

Cada tarea deja el sistema funcionando. Ninguna se da por hecha sin su comprobación.

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-12).** Implementada con el diseño de la segunda replanificación
(reutiliza el cuerpo y los formularios de una venta) más la relajación de validación
de T7 (nada es obligatorio en una cotización; sí lo sigue siendo en una venta).
Backend verificado de punta a punta por la API real con agencias de prueba
desechables, incluyendo validación de catálogos y `convertToSale` con detalle
completo. Frontend verificado con `tsc`, sin probar en pantalla (el proyecto pide
permiso expreso para abrir el navegador).

---

## T1 · Migración: `cotizaciones` y `detalle_cotizacion` `[x]`

Las dos tablas base (migración `20261011120000_cotizaciones`): RLS, `empresa_id` por
defecto (sin respaldo a la empresa 1), claves ajenas compuestas y el disparador
`app_asignar_numero()` en `cotizaciones`. Más, de esta replanificación, la columna
`detalle_cotizacion.detalle Json?` (migración `20261012120000_detalle_de_cotizacion`,
aditiva). `pnpm db:generate` corrido tras cada una.

**Comprobado:** dentro de `conEmpresa` se crea con `numero: 1` y `empresa_id`
correcto; fuera de contexto el insert falla por `empresa_id` nulo; la columna nueva es
nula en filas de antes del cambio y no rompe nada existente.

## T2 · Backend: cotizaciones con el cuerpo de una venta `[x]`

- `backend/src/services/productValidation.js` — validación de catálogos extraída de
  `SalesService` (`precargarCatalogos`, `validarTiquetes`, `validarPersonas`,
  `tipoDocumento`, `planEquipajeId`), sin `this`, para que la use también
  `quotes.service.js`. `sales.service.js` actualizado para llamarla en vez de sus
  antiguos métodos privados.
- `backend/src/schemas/productArrays.js` — el bloque de 15 campos (`ticketData`,
  `hotelData`...) que antes se repetía en `sales.schema.js`, parametrizado por
  `{max, mensajeMax}`.
- `backend/src/catalog/resumenProducto.js` — `resumenDe(categoria, detalle)`: la
  descripción legible de cada línea, derivada del detalle completo (una función por
  categoría, con su reserva si el detalle no trae nada útil).
- `backend/src/schemas/quotes.schema.js` — reescrito: `createQuoteSchema`/
  `updateQuoteSchema` ya no declaran `lines`, declaran el mismo bloque de
  `productArrays()` que una venta.
- `backend/src/services/quotes.service.js` — reescrito: `lineasDe(body)` valida con
  `productValidation` y construye una línea por ítem de cada categoría presente, con
  `detalle` completo; `convertToSale` devuelve `products` agrupado por categoría en
  vez de `lines` con solo costo/ganancia.
- `backend/src/services/quotesAlcance.js`, `backend/src/controllers/quotes.controller.js`,
  `backend/src/routes/quotes.routes.js` — sin cambios (siguen pasando el cuerpo
  validado tal cual). Permiso `quotes` en `roles.service.js`/`authorize.js` — sin
  cambios respecto a la primera replanificación (view `own`/`all`, como `sales`).

**Comprobado**, por la API con agencias de prueba desechables:
- `sales.service.js` tras el refactor: `pnpm test:vuelos-api` en verde (0 fallos; un
  primer intento mostró 13 fallos por una caída transitoria del *pooler* de Supabase,
  no relacionada con el cambio — confirmado reejecutando).
- Crear con un tiquete (tramos, pasajero) y un hotel: 201, el total cuadra con
  `costo + ganancia + IVA` de las dos líneas (C1), cada línea trae su `detalle`
  completo (`legs[0].origin/destination`...) y su descripción autogenerada
  ("BOG → CTG", "Hotel Caribe · Cartagena").
- Un aeropuerto inexistente en `ticketData.0.legs.0.destination` da 422 con el campo
  exacto, igual que en una venta (C6).
- Editar cambia el tiquete a ida y vuelta: 200, el `detalle` guardado trae
  `returnLeg` y la descripción pasa a "... (ida y vuelta)" (C2).
- Aceptar y convertir: `products.ticket[0]` llega con `flightMode: round_trip`,
  `legs`/`returnLeg` completos y el mismo origen/destino cotizados; `client` viene
  con el cliente completo (C7).
- (De la primera replanificación, no repetido por no haber cambiado: otra agencia no
  ve la cotización; duplicar crea una independiente; el número empieza en 1 por
  agencia; `linkSale` con venta inexistente da 400 y con una real la enlaza; sin
  `quotes.create` el asesor recibe 403 y conserva `view`.)

## T3 · Backend: PDF de la cotización `[x]`

Sin cambios de código respecto a la primera replanificación — `plantilla.js` solo lee
`l.descripcion`/`l.precio`/`totals.total`, que `mapCotizacion` sigue produciendo igual.

**Comprobado (de la primera replanificación, no afectado por esta):** el PDF
descargado es un PDF real, no contiene costo de proveedor ni ganancia (C5), y la
segunda petición reutiliza la caché.

## T4 · Frontend: pantalla de cotizaciones reutilizando el asistente de venta `[~]`

- `frontend/src/types/index.tsx` — `QuoteLine.detalle?: Record<string, unknown> | null`
  añadido.
- `frontend/src/api/quotes.ts` — `QuoteDraft.lines` → `QuoteDraft.products:
  Record<string, Record<string, unknown>[]>`.
- `frontend/src/pages/Quotes.tsx` — reescrito: el modal de crear/editar ya no tiene un
  editor de líneas propio; mantiene un `draft: WizardFormData` y renderiza
  `Step2Products`/`ProductFormsModal`/`useSaleCalculations` tal cual los usa
  `NewSaleWizard.tsx` (ver plan.md, decisión 10), dentro de `Modal size="panel"`.
  `openEdit` agrupa `quote.lines[].detalle` por categoría en los arrays del borrador;
  `handleSave` recorre esos arrays y los manda como `ticketData`/`hotelData`/... .
- `frontend/src/hooks/useQuotes.ts`, `frontend/src/context/QuotesContext.tsx` — sin
  cambios (ya pasaban el cuerpo tal cual). `quotes` en `RolePermissions`, las cuatro
  constantes por rol, `SCOPED_VIEW_MODULES`, ruta en `App.tsx`, enlace en
  `Sidebar.tsx` — sin cambios respecto a la primera replanificación.

**Comprobado:** `tsc` sin errores (0). **Pendiente:** verlo en pantalla — abrir
"Nueva cotización", elegir un tiquete, confirmar que aparece el mismo formulario de
tramos/pasajeros que en una venta, guardar y comprobar que la lista y el PDF se ven
bien.

## T5 · Convertir en venta, de punta a punta `[~]`

`Quotes.tsx::convertirEnVenta` ya no reconstruye cada ítem con `INITIAL_*()`: asigna
`borrador.products[categoria]` directamente al array de `WizardFormData` que
corresponda (`CATEGORIA_A_ARRAY`), con el detalle completo (no solo costo/ganancia).
El resto del recorrido no cambió: escribe en la misma clave de `localStorage` que lee
`NewSaleWizard.tsx`, navega a `/sales?fromQuote=<id>`; `Sales.tsx` abre el asistente
con `fromQuoteId`; al crear la venta, `NewSaleWizard.tsx` llama
`PATCH /quotes/:id/link-sale`.

**Comprobado:** `tsc` sin errores; `convertToSale` devolviendo `products` con el
detalle completo (T2) ya prueba la mitad servidor de punta a punta. **Pendiente:** el
recorrido completo en pantalla — convertir una cotización con un tiquete cotizado y
confirmar que el asistente abre con los mismos tramos y pasajeros ya puestos.

## T6 · Verificación `[x]`

- `pnpm check:prisma`: sin problemas, tras el refactor de `sales.service.js` y los
  esquemas nuevos.
- `node --check` sobre cada archivo backend tocado o nuevo: sin errores de sintaxis.
- `pnpm test:vuelos-api`: en verde tras extraer la validación de catálogos a
  `productValidation.js` (sin regresión en `sales.service.js`).
- (De la primera replanificación, no repetido por no haber cambiado el esquema de las
  tablas: `prisma migrate status` al día; `pnpm test:aislamiento` extendido con
  `cotizaciones`/`detalle_cotizacion`, 20/20 en verde (C9); `pnpm test:aislamiento-api`
  con 2 fallos preexistentes sin relación con esta spec.)

## T7 · Nada obligatorio en una cotización; sí en la venta `[x]`

Sin tocar formularios ni pantallas (eso ya se probó y se revirtió, ver el registro
abajo): pura relajación de validación, con la venta sin cambios como referencia.

- Migración `20261012150000_cotizacion_cliente_opcional` (`cliente_id` vuelve a ser
  nullable) + `schema.prisma` (`cliente_id Int?`, relación `clientes?`).
- `backend/src/schemas/quotes.schema.js`: `clientId` vuelve a ser el `id` opcional
  (no `idRequerido`).
- `backend/src/services/quotes.service.js`: `idDeClienteExistente(clientId)` (nuevo
  helper, `null` sin cliente) en `createQuote`/`updateQuote`; `convertToSale` no pide
  el cliente a `clientsService` si la cotización no tiene uno; `validarTiquetes` se
  llama con `{ exigirReserva: false }` en los dos métodos.
- `backend/src/schemas/products.schema.js`: `esquemaDeCategoria(slug, {relajado})` —
  con `relajado: true`, `supplierCost` deja de ser `costoObligatorio` en
  ticket/hotel/insurance/plan y vuelve a ser dinero opcional. `productArrays.js`
  pasa `relajado` a través. `quotes.schema.js` llama con `relajado: true`;
  `sales.schema.js` no pasa la opción (sigue estricto).
- `backend/src/services/productValidation.js`: `validarTiquetes(ticketData,
  catalogos, {exigirReserva = true})` — con `false` se salta solo la regla de la
  reserva del titular; el resto (aeropuertos, plan de equipaje) sigue igual.
  `sales.service.js` no pasa la opción (sigue exigiéndola).
- `frontend/src/pages/Quotes.tsx`: "Guardar" ya no se bloquea por falta de cliente;
  la etiqueta pasa a "Cliente (opcional)"; `openEdit`/`convertirEnVenta` con guard
  para no mandar `clientId` cuando la cotización no tiene uno.
- `frontend/src/types/index.tsx` (`Quote.clientId: number | null`) y
  `frontend/src/api/quotes.ts` (`QuoteDraft.clientId`/`client` nullable).

**Comprobado**, por la API con una agencia de prueba desechable: crear una
cotización sin cliente, sin costo de proveedor y con un tiquete sin pasajeros: 201,
costo en 0 sin exigirlo; con un titular pero sin número de reserva: 201 (antes daría
422); un aeropuerto inexistente sigue dando 422 (C6); editar sin cliente: 200. Del
lado de la venta, sin tocar nada: `POST /sales` sin `supplierCost` sigue dando 422
"el costo del proveedor es obligatorio" (C11) — la misma prueba, con el mismo cuerpo,
que en una cotización pasa. `pnpm check:prisma`, `pnpm test:aislamiento` (20/20,
C9) y `pnpm test:vuelos-api` completo en verde (incluye "titular sin reserva: 422"
del lado de venta, sin regresión). `tsc` del frontend sin errores.

---

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-12 | T7 | Nada es obligatorio en una cotización (ni cliente, ni costo de proveedor, ni reserva del titular); la validación de una venta no se tocó y sigue exigiéndolo todo. Migración `cliente_id` opcional (de nuevo), `esquemaDeCategoria({relajado})`, `validarTiquetes({exigirReserva})`, `idDeClienteExistente`. Sin cambios en formularios ni pantallas. Verificado por la API real (cotización sin cliente/costo/reserva: 201; la misma venta sin costo: 422) y `test:vuelos-api` completo en verde. |
| 2026-10-12 | T1-T6 | Segunda replanificación implementada: `detalle_cotizacion.detalle` (Json), validación y arrays de producto compartidos con `sales.service.js`/`sales.schema.js`, descripción autogenerada, `convertToSale` con detalle completo agrupado por categoría, y `Quotes.tsx` reescrito para reutilizar `Step2Products`/`ProductFormsModal`/`useSaleCalculations` del asistente de venta. Backend verificado de punta a punta por la API real (tiquete con tramos/pasajeros + hotel, validación de aeropuerto, edición, conversión). Frontend solo con `tsc`, sin pantalla. |
| 2026-10-11 | — | (Primera replanificación, reemplazada) Línea de cotización propia (categoría + descripción libre + costo + ganancia, sin cantidad), sin tarifas de proveedor. Implementada y verificada en su momento; superada por el pedido explícito de reutilizar el formulario de cada categoría tal cual lo usa una venta. |
| 2026-10-03 | — | (Diseño original, reemplazado) Cotizaciones + tarifas de proveedor conectadas. Nunca se implementó nada. |

---

### Intento revertido el mismo día (2026-10-12)

Se probó una tercera vuelta —formularios simplificados sin identidad de pasajero ni
números de reserva/tiquete/vuelo, y cliente opcional en la cotización (migración
`20261012130000_cotizacion_sin_cliente_obligatorio`, `QuoteProductForm.tsx`/
`QuoteProductFormsModal.tsx` nuevos, guards en `wizardData.ts`)—, verificada por la
API real y con `tsc` limpio. El usuario pidió deshacerla por completo ("no me gustó
como quedó") antes de verla en pantalla. Se revirtió con una nueva migración
(`20261012140000_revertir_cotizacion_sin_cliente`, `cliente_id` vuelve a `NOT NULL`;
sin filas con `cliente_id` nulo en ese momento, comprobado antes de aplicarla —
siguiendo la regla del proyecto de nunca editar una migración ya aplicada, se agregó
una migración nueva en vez de borrar la anterior), `schema.prisma`/
`quotes.schema.js`/`quotes.service.js` de vuelta a cliente obligatorio, los dos
archivos nuevos del frontend borrados, `wizardData.ts`/`Quotes.tsx`/
`types/index.tsx`/`api/quotes.ts` de vuelta a la versión de T1-T6 de arriba.
`check:prisma`, `test:aislamiento` (20/20) y `tsc` verificados de nuevo tras
revertir, sin regresión.
