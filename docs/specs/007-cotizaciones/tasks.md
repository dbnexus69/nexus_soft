# Tareas — Spec 007

Cada tarea deja el sistema funcionando. Ninguna se da por hecha sin su comprobación.

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-16).** Implementada (T1-T10). T9 sacó del formulario de
cotización todo lo que depende de una venta que no existe (números de
tiquete/reserva/vuelo, asiento, identidad de cliente/pasajero) y quitó el selector
de cliente del todo, con formularios propios; T10, el mismo día, corrigió el *cómo*:
el usuario quería el mismo diseño de los formularios de venta, no unos nuevos — un
prop `cotizando` esconde esos campos dentro de `forms/*.tsx`. Sin tocar el backend
en ninguna de las dos (ya era opcional desde T7). Verificado solo con `tsc` (cambio
puramente de frontend). **Sigue sin probarse en pantalla** (ningún T de este
documento lo hizo): falta abrir el navegador, con permiso.

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

## T8 · Revisión completa del módulo: tres correcciones `[x]`

Pedido del usuario: analizar todo el módulo y terminarlo. Revisión estática (servicio,
controlador, rutas, esquema, alcance, PDF, frontend, permisos) contra este documento.
Se eligieron las tres correcciones reales; las menores quedan anotadas al final, sin
hacer.

1. **Faltaba el asesor en el formulario → rompía crear cotizando mientras se
   suplanta.** `Quotes.tsx` nunca mandaba `asesorId` (a diferencia de
   `Step1Client.tsx`). `createQuote` responde 400 *"Elige un asesor..."* en cuanto
   `alcance.suplantando` es `true` y no se manda uno — un superadmin suplantando no
   podía crear ninguna cotización por pantalla. Se añadió el mismo combobox de
   asesor que usa el asistente de venta, visible solo al crear (editar no reasigna
   asesor, `updateQuoteSchema` lo omite), con el mismo valor por defecto que
   `NewSaleWizard.tsx` (el propio usuario).
2. **Nada impedía convertir o enlazar dos veces la misma cotización.**
   `convertToSale`/`linkSale` solo comprobaban el estado, no `venta_id`.
   `quotes.service.js` gana el guard en los dos: 400 si `cotizacion.venta_id` ya
   está puesto.
3. **No había vista de solo lectura para una cotización cerrada.** `openEdit` abría
   el mismo formulario editable para cualquier estado; el único freno era el 400
   del backend al guardar, con un mensaje genérico. Ahora, si `!puedeEditar(q)`
   (aceptada o rechazada), se abre un resumen de solo lectura (cliente, estado,
   vencimiento, observaciones, líneas y total) con un único botón "Cerrar" — sin
   tocar `Step2Products`/`ProductFormsModal`, que no tienen (ni necesitan) un modo
   deshabilitado.

**Comprobado:** `tsc` del frontend y `pnpm check:prisma` sin problemas (sin tocar la
BD). Con permiso del usuario, agencias de prueba desechables por la API real
(`companies/:id/impersonations`, igual que `tests/aislamiento-api.js`):
suplantando B, crear sin `asesorId` sigue dando 400 (no se tocó esa parte);
suplantando B con `asesorId` de un usuario real de B: 201 (lo que ahora manda el
formulario) — confirma el arreglo 1. Aceptar una cotización y convertirla antes de
enlazarla: 200 las veces que haga falta (no hay nada que proteger todavía, el guard
es sobre `venta_id`); tras `PATCH /link-sale`, un segundo enlace da 400 "ya está
enlazada a una venta" y una nueva conversión da 400 "ya fue convertida en una venta"
— confirma el arreglo 2. El arreglo 3 (vista de solo lectura) es una decisión de
renderizado en el cliente a partir de `estado`, sin API que comprobar; queda para
una pasada en pantalla cuando se verifique el resto del módulo en el navegador.

### Menores, anotadas y sin hacer

- Los 422 del servidor (aeropuerto inválido, documento inválido) solo se ven en el
  banner genérico del modal, no junto al campo — aquí no corre el `validarPaso` del
  asistente de venta.
- Nada impide enviar o descargar una cotización en $0 o sin descripciones útiles
  (todo es opcional, por diseño de T7).
- La búsqueda de la lista solo filtra por nombre de cliente; una cotización sin
  cliente no aparece por ningún texto.
- No existe un `tests/quotes-api.js` permanente (tipo `test:vuelos-api`): toda la
  verificación del módulo fue por scripts desechables durante el desarrollo. Un
  cambio futuro en `quotesAlcance.js`/`authorize.js` no tiene quién lo detecte.

## T9 · Fuera el cliente y lo que depende de una venta `[~]`

El usuario, tras ver T7 (campos opcionales) y T8 (asesor, guards, solo lectura),
pidió ir más allá: los campos que dependen de una venta inexistente no debían ni
*aparecer*, y el cliente no debía tener ningún selector. Esto ya se había
construido una vez y se revirtió sin verla en pantalla (ver "Intento revertido"
abajo); esta vez se confirmó con el usuario, campo por categoría, antes de tocar
código (criterio: se queda lo que describe el servicio, se quita lo que depende de
una venta — identidad de cliente/pasajero, número de tiquete/reserva/vuelo,
asiento). Ver plan.md, decisión 12.

- `frontend/src/components/sales/wizard/QuoteProductForm.tsx` y
  `QuoteProductFormsModal.tsx` (nuevos en ese momento): un formulario mínimo por
  categoría, sin ningún campo de pasajero/huésped/titular ni número de
  reserva/tiquete/vuelo. **Superado por T10 el mismo día** — el usuario pidió el
  mismo diseño de los formularios de venta, no uno nuevo; estos dos archivos se
  borraron.
- `frontend/src/components/sales/wizardData.ts`: `INITIAL_TICKET`/`_HOTEL`/
  `_INSURANCE`/`_PLAN`/`_TOUR` vuelven a poner `client ? [...] : []` en sus arrays
  de pasajero/huésped (lo llama `Step2Products.tsx` directamente al añadir el
  primer ítem). Esto sigue vigente tras T10.
- `frontend/src/pages/Quotes.tsx`: sin ningún selector de cliente (se quitó el
  `AsyncCombobox` y el estado `clientName`). `openEdit` conserva el `clientId` de
  una cotización que ya tuviera uno, sin mostrarlo, para no borrarlo al guardar. La
  vista de solo lectura (T8) solo imprime "Cliente" si hay uno. El campo Asesor
  (T8) se queda: identifica quién cotiza, no a quién — no es el mismo problema.
- Sin cambios en el backend ni migraciones: `cliente_id` ya era opcional desde T7,
  y los esquemas de producto ya no exigían nada desde T7.

**Comprobado:** `tsc` del frontend sin errores (cambio puramente de frontend).
**Corregido por T10 el mismo día:** ver abajo — el usuario no quería formularios
nuevos, quería el mismo diseño de los formularios de venta con esos campos
escondidos.

## T10 · Corrección: el mismo diseño, con un prop `cotizando` en vez de formularios nuevos `[~]`

T9 resolvió el *qué* (qué campos esconder) pero no el *cómo*: construyó formularios
propios con un diseño distinto al de una venta. El usuario fue explícito: *"necesito
que quede el mismo diseño de las modales solo quitar los campos que no son
necesarios [...] pero de resto dejar todo"*. Ver plan.md, decisión 13.

- Las 15 categorías en `frontend/src/components/sales/forms/*.tsx` ganan un prop
  `cotizando?: boolean` (default `false`). Cada campo de T9 queda envuelto en
  `{!cotizando && (...)}` **dentro del formulario real**, sin tocar su diseño. En
  `TicketForm.tsx`, además, el `useEffect` que precargaba un pasajero en blanco se
  salta con `cotizando` (sin cliente, seguía creando un titular sin nadie a quien
  atribuírselo).
- `frontend/src/components/sales/wizard/ProductFormsModal.tsx` reenvía `cotizando`
  a cada formulario (mismo default `false`).
- `frontend/src/pages/Quotes.tsx` vuelve a usar `ProductFormsModal` (no
  `QuoteProductFormsModal`, que se borró junto con `QuoteProductForm.tsx`), con
  `cotizando` fijo en `true`.
- `NewSaleWizard.tsx` no se tocó: nunca manda `cotizando`, así que el asistente de
  venta real se ve exactamente igual que antes — ninguno de los `{!cotizando && ...}`
  se activa ahí.

**Comprobado:** `tsc` del frontend sin errores; `grep` confirma que
`NewSaleWizard.tsx` no menciona `cotizando` en ningún punto (cero riesgo de cambiar
el asistente de venta real) y que no queda ninguna referencia a los archivos
borrados. **Pendiente:** verlo en pantalla — abrir un tiquete en una cotización y
confirmar que no aparecen pasajeros ni números de vuelo/tiquete, y abrir el mismo
tiquete desde una venta real y confirmar que ahí sí aparecen, igual que siempre.

## T11 · Paréntesis: el formulario de Paquetes separa hotel de vuelo/transporte `[~]`

No es de esta spec — es una mejora general de `forms/PlanForm.tsx`, compartido por
igual entre la venta real y la cotización, pedida al ver T10 funcionando: el
formulario tenía los datos del hotel mezclados con los del vuelo/transporte en las
mismas secciones ("Datos del Plan Vacacional" traía `hotelName` junto con
`transportType`/aerolínea; "Reservación y Transporte" traía el número de reserva del
hotel, los 4 campos de vuelo y las fechas de check-in/check-out del hotel, todo en
una sola grilla). Se reorganizó en tres secciones separadas, sin mover ninguna otra
lógica:

- **Información General**: nombre del plan, adultos, menores. Se quitó el `<Select>`
  de "Tipo de Transporte" que estaba aquí duplicado — ya existía (y se queda) el par
  de botones Aéreo/Terrestre dentro de la sección de Vuelo/Transporte.
- **Hotel del Plan** (nueva): nombre del hotel, número de reserva (oculto si
  `cotizando`), check-in, check-out.
- **Vuelo del Plan / Transporte Terrestre del Plan** (la misma sección de antes,
  renombrada): el combobox de aerolínea/empresa de transporte (movido aquí desde
  "Información General"), número de vuelo/placa, tiquete/silla, confirmación
  (ocultos si `cotizando`), y las 4 fechas de vuelo/transporte — ya sin las fechas
  de hotel, que se movieron a la sección de Hotel.
- Finanzas, Integrantes y Servicios Vinculados no cambiaron de lugar ni de lógica.

**Comprobado:** `tsc` sin errores. **Pendiente:** verlo en pantalla, en los dos
lados (venta real y cotización).

---

## T12 · En la sección financiera de cada formulario, Proveedor y Método de Pago también se ocultan al cotizar `[~]`

Mismo principio que T9/T10: "Proveedor" y "Método de Pago Proveedor" son decisiones
de compra que no hacen falta para cotizar un precio al cliente — solo costo y
ganancia sí. `FinancialSection` (`VoucherField.tsx`, compartida por 11 de las 15
categorías) ganó el mismo prop `cotizando?: boolean` (default `false`) y esconde esos
dos campos; los 11 formularios que la llaman (`CarRentalForm`, `CheckInForm`,
`ConventionForm`, `FincaForm`, `MigrationForm`, `PassportForm`, `PetServiceForm`,
`RestaurantForm`, `SimCardForm`, `TourForm`, `VisaForm`) le pasan `cotizando={cotizando}`.
Los 4 formularios con bloque financiero propio (`TicketForm`, `HotelForm`,
`InsuranceForm`, `PlanForm`) envuelven sus campos de Proveedor/Método de Pago en
`{!cotizando && (...)}` donde ya estaban — en Hotel e Insurance, "Proveedor" vive en
la sección de datos principales, separado de "Método de Pago" en la financiera, así
que son dos envoltorios independientes. Costo Proveedor y Ganancia quedan siempre
visibles en los quince.

**Comprobado:** `tsc` sin errores. **Pendiente:** verlo en pantalla.

---

## T13 · Nombre libre de la cotización `[x]`

Pedido del usuario: poder ponerle un nombre a la cotización al crearla (ejemplo:
"Cartagena plan para 2") para identificarla en la lista, en vez de depender solo del
cliente o del número. Mismo criterio que el resto de la cabecera (`fechaVencimiento`,
`observaciones`): opcional, nada se exige.

- **Migración** `20261016120000_nombre_de_cotizacion`: `cotizaciones.nombre` (`TEXT`,
  nullable). `schema.prisma` → `cotizaciones.nombre String?`.
- **Backend**: `quotes.schema.js` agrega `name` (string, 1-120, opcional/nulo) a
  `createQuoteSchema` (heredado por `updateQuoteSchema`). `quotes.service.js` lo lee
  en `createQuote`/`updateQuote`, lo copia en `duplicateQuote`, y lo expone como
  `name` en `mapCotizacion`. El PDF (`services/quotes/plantilla.js`) lo muestra bajo
  "COTIZACIÓN" en el encabezado y en el título del documento, cuando existe.
- **Frontend**: `types/index.tsx` (`Quote.name`), `Quotes.tsx` — campo "Nombre
  (opcional)" en el formulario de alta/edición, columna "Nombre" en la lista, y el
  nombre (si existe) sustituye a "Cotización #N" en los encabezados del modal y en la
  vista de solo lectura (que ahora también muestra el N.º aparte, para no perderlo).

**Comprobado:** migración aplicada (`prisma migrate deploy`, con permiso del usuario)
y cliente regenerado (`pnpm db:generate` — necesitó parar antes el backend, que
tenía bloqueado el motor de Prisma en Windows); `check:prisma` y `tsc` en verde.
Confirmado además por la API real: `PUT /quotes/43` con `name` quedó en `200` (antes
daba 500 por faltar la migración) y `GET /quotes/43/pdf` en `200`. **Pendiente:**
verlo en pantalla.

---

## T14 · El PDF de la cotización muestra el detalle completo de cada servicio, no solo el resumen `[~]`

El usuario notó que el PDF solo mostraba el resumen corto de una línea (p. ej. un
tiquete solo enseñaba el destino) en vez de todo lo que se llenó en el formulario de
cada servicio. La información completa ya existía (`detalle_cotizacion.detalle`, el
mismo `TicketData`/`HotelData`... que usa el asistente de venta) — solo faltaba
pintarla en el PDF, igual que ya hace el voucher de una venta (spec 011).

- **`backend/src/services/voucher/secciones.js` (nuevo)**: se extrajo de
  `voucher/plantilla.js` todo lo que describe una categoría de producto en PDF
  —`SECCIONES` (título y pares etiqueta/valor por categoría), `bloqueTiquete`
  (itinerario con tramos, pasajeros y asientos), `rejilla`/`tarjeta`/`titulo` y los
  formatos de fecha/dinero—, para que el voucher de una venta y el PDF de una
  cotización describan la MISMA categoría con el MISMO mapeo de campos, en vez de
  mantener dos copias que puedan desalinearse (la nota de spec 015 ya advertía de
  esto: "mantener las dos listas sincronizadas al agregar una categoría").
  `voucher/plantilla.js` pasó a importar de ahí, sin cambiar su resultado.
- **`services/quotes/plantilla.js`**: agrupa las líneas de la cotización por
  categoría y, antes de la tabla de precios, arma un bloque completo por cada
  servicio con las mismas `SECCIONES` — itinerario de vuelo con tramos para
  tiquetes, y el resto de categorías con su rejilla de campos llenados (vacíos no se
  pintan, así que lo que una cotización no pide —reserva, confirmación— simplemente
  no aparece). Nunca se agregó nada de costo de proveedor, ganancia ni método de
  pago al proveedor: ninguna sección los incluye, igual que en el voucher de venta.
  La tabla de precio por servicio se mantiene (eso sí es propio de una cotización;
  un voucher de venta no la tiene). `PLANTILLA_VERSION` subió a 2 (invalida la
  caché).
- **`services/voucher/index.js`**: `ciudades()` (nombres de aeropuerto por código
  IATA) generalizada para tomar un array de tiquetes en vez de una venta completa,
  y exportada — reutilizada por `services/quotes/index.js` para que el itinerario
  de la cotización también muestre nombre de ciudad junto al código.

**Comprobado:** `node -e require(...)` de los tres módulos sin error; PDF de prueba
generado en memoria (tiquete ida/vuelta + hotel, sin tocar la base) — 23.852 bytes
sin excepciones. `check:prisma` en verde. **Pendiente:** descargarlo desde una
cotización real y verlo en pantalla.

---

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-17 | T14 | El PDF de la cotización pasó de mostrar solo el resumen corto de cada línea a mostrar el detalle completo por categoría, igual que el voucher de una venta: se extrajo `SECCIONES`/`bloqueTiquete`/etc. del voucher a un módulo compartido nuevo (`voucher/secciones.js`) para no mantener dos copias del mapeo de campos. `ciudades()` generalizada y reutilizada para resolver nombres de aeropuerto también en la cotización. Verificado generando un PDF de prueba en memoria sin tocar la base; pendiente de pantalla. |
| 2026-10-16 | T13 | Nombre libre y opcional para la cotización ("Cartagena plan para 2"): migración `nombre` en `cotizaciones`, `name` en el esquema/servicio/PDF, campo y columna nuevos en `Quotes.tsx`. Aplicada y confirmada por la API real (`PUT`/`PDF` en 200). |
| 2026-10-16 | T12 | Proveedor y Método de Pago también se ocultan al cotizar, mismo patrón que T9/T10: prop `cotizando` en `FinancialSection` (11 formularios que la usan) y envoltorios propios en los 4 que no (Ticket, Hotel, Insurance, Plan). Costo Proveedor y Ganancia siguen siempre visibles. Verificado con `tsc`; pendiente de pantalla. |
| 2026-10-16 | T11 | Paréntesis fuera de spec 007: `forms/PlanForm.tsx` (compartido con la venta real) tenía el hotel mezclado con el vuelo/transporte en las mismas secciones. Reorganizado en tres: Información General (plan, adultos, menores), Hotel del Plan (nombre, reserva, check-in/out) y Vuelo del Plan / Transporte Terrestre (aerolínea o empresa, números, fechas de vuelo). Se quitó un `<Select>` de tipo de transporte duplicado (ya existía el toggle Aéreo/Terrestre). Sin tocar Finanzas/Integrantes/Vinculados. `tsc` sin errores; pendiente de pantalla. |
| 2026-10-16 | T10 | Corrección el mismo día de T9: el usuario quería el mismo diseño de los formularios de venta, no unos nuevos. Se borraron `QuoteProductForm.tsx`/`QuoteProductFormsModal.tsx`; las 15 categorías en `forms/*.tsx` ganan un prop `cotizando` (default `false`) que esconde los mismos campos de T9 dentro del formulario real; `ProductFormsModal.tsx` lo reenvía; `Quotes.tsx` vuelve a usar `ProductFormsModal` con `cotizando` fijo en `true`. `NewSaleWizard.tsx` no se tocó y nunca lo manda, así que el asistente de venta real queda igual. Verificado con `tsc` y un `grep` que confirma que `NewSaleWizard.tsx` no menciona `cotizando`; pendiente de pantalla. |
| 2026-10-16 | T9 | Fuera el selector de cliente (en ningún punto de `Quotes.tsx`) y fuera de cada formulario de servicio lo que depende de una venta inexistente (número de tiquete/reserva/vuelo, asiento, identidad de pasajero/huésped). Confirmado el criterio con el usuario antes de tocar código. `QuoteProductForm.tsx`/`QuoteProductFormsModal.tsx` reconstruidos; `wizardData.ts` con los guards de T7-reverted reaplicados. Sin cambios en backend ni migración (ya era opcional desde T7). Verificado con `tsc`; pendiente de pantalla. |
| 2026-10-15 | T8 | Revisión completa del módulo a pedido del usuario. Tres correcciones: asesor en el formulario (arregla crear suplantando), guard contra doble conversión/enlace (`venta_id` ya puesto → 400), y vista de solo lectura para cotizaciones aceptadas/rechazadas en vez del formulario editable. Verificado por la API real con agencias desechables, con permiso del usuario (suplantación con y sin asesor, doble conversión, doble enlace); la vista de solo lectura queda pendiente de ver en pantalla. Menores (errores inline, cotización en $0, búsqueda solo por cliente, sin prueba automática permanente) anotadas, sin hacer. |
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
