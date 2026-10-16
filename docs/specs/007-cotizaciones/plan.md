# Plan técnico — Spec 007 (replanificado 2026-10-12)

## Decisiones

### 1. La línea de una cotización reutiliza el cuerpo de una venta, no una línea genérica

La primera replanificación (2026-10-11) había elegido una línea propia (categoría +
descripción libre + costo + ganancia), precisamente para no tocar el esquema de
ventas. El usuario, al verla, pidió que cotizar un tiquete pidiera de dónde a dónde,
ida o ida y vuelta, fecha y hora — es decir, **el mismo formulario que una venta**, no
uno simplificado.

Se descartó copiar las 15 tablas `prod_*` de venta (exigiría hacer opcional
`detalle_venta_id`, hoy `@unique NOT NULL` en la mayoría, y añadir
`detalle_cotizacion_id` al lado — una migración sobre el corazón de ventas). En su
lugar, `detalle_cotizacion` gana una columna `detalle Json?` (migración
`20261012120000_detalle_de_cotizacion`, aditiva) que guarda **el mismo objeto que ya
usa el asistente de venta** para esa categoría (`TicketData`, `HotelData`...): mismos
campos, mismas reglas, sin tabla por categoría. `descripcion` deja de ser texto escrito
a mano — se deriva de `detalle` al guardar (`catalog/resumenProducto.js::resumenDe`).

### 2. El cuerpo de `POST/PUT /quotes` es el mismo que el de una venta

`schemas/quotes.schema.js` ya no declara `lines: [...]`; declara `ticketData`,
`hotelData`... — un array por categoría, cada uno validado con el esquema de su
categoría (`esquemaDeCategoria(slug)` de `products.schema.js`). La construcción de ese
bloque de 15 campos se compartía por copia entre `sales.schema.js` y este archivo; se
extrajo a `schemas/productArrays.js::productArrays({max, mensajeMax})`, parametrizado
solo en el mensaje de error, para que una categoría nueva no obligue a tocar los dos
esquemas.

La validación de catálogos (aeropuertos, planes de equipaje, tipos de documento,
pasajeros) vivía como métodos privados de `SalesService`
(`_precargarCatalogos`/`_validarTiquetes`/`_validarPersonas`/`_planEquipajeId`/
`_tipoDocumento`). Se extrajo a `services/productValidation.js` (funciones puras, sin
`this`) y la usan por igual `sales.service.js` y `quotes.service.js`: un tiquete con un
aeropuerto inexistente se rechaza en una cotización exactamente como en una venta
(C6), con el mismo mensaje y el mismo campo en `error.details`.

`quotes.service.js::lineasDe(body)` recorre las 15 claves del catálogo
(`CATALOG[slug].responseKey`), y por cada ítem calcula `costo_proveedor`/`ta`/`iva` con
`datosFinancieros` (`saleTotals.js`, la misma función que una venta) y guarda
`{ categoria, descripcion: resumenDe(slug, item), detalle: item, costo_proveedor, ta,
iva }`.

### 3. `cotizaciones` sigue el mismo patrón que `ventas`

Sin cambios respecto a la primera replanificación. Cabecera `cotizaciones`: `id`,
`numero` (disparador `app_asignar_numero()`, genérico vía `TG_TABLE_NAME`),
`cliente_id`, `usuario_id` (el asesor), `estado` (`CotizacionEstado`: `borrador`,
`enviada`, `aceptada`, `rechazada`), `fecha_vencimiento` (nullable), `observaciones`,
`venta_id` (nullable, puesta al convertir), `creado_at`, `deleted_at`.

`detalle_cotizacion`: `id` (uuid), `cotizacion_id`, `categoria` (`ProductCategory`),
`descripcion` (autogenerada), `costo_proveedor`, `ta`, `iva`, **`detalle` (`Json?`,
nuevo en esta replanificación)**, `creado_at`.

Claves ajenas compuestas `(id, empresa_id)` en las dos tablas, RLS, política
`empresa_aislada` y `empresa_id` con su default, como cualquier tabla de inquilino —
sin cambios respecto a T1 de la primera versión.

**`estado: vencida` no es una columna.** Se deriva al leer, comparando
`fecha_vencimiento` con la fecha de hoy en Bogotá — mismo patrón que `critico` en
vuelos (spec 004).

### 4. Editable en `borrador` y en `enviada`; cerrada en `aceptada`/`rechazada`

Sin cambios: `PUT /quotes/:id` borra y recrea las líneas (ahora vía `lineasDe(body)`,
igual que al crear) dentro de la misma transacción, mientras el estado sea `borrador` o
`enviada`; 400 sobre `aceptada`/`rechazada`.

### 5. Duplicar copia el `detalle` completo

`POST /quotes/:id/duplicate`: mismo mecanismo que antes, pero cada línea copiada lleva
también su `detalle` (antes solo `categoria`/`descripcion`/`costo_proveedor`/`ta`). Sin
tabla ni estado de "plantilla".

### 6. Enviar sigue siendo solo un cambio de estado

Sin cambios respecto a la primera replanificación.

### 7. Convertir en venta: el detalle completo, agrupado por categoría

`POST /quotes/:id/convert-to-sale` sigue sin escribir ninguna venta, pero ahora
devuelve:

```json
{ "quoteId": 1, "clientId": 5, "client": { ... }, "products": { "ticket": [ {...} ], "hotel": [ {...} ] } }
```

`products[categoria]` es la lista de objetos `detalle` tal cual se guardaron — la misma
forma que espera cada array de `WizardFormData` (`tickets`, `hotels`...). El frontend
ya no reconstruye nada con `INITIAL_*()`: asigna el array directamente
(`form[wizardKey] = products[categoria]`). Antes la respuesta era
`{ lines: [{categoria, descripcion, costoProveedor, ta}] }` y el frontend fusionaba
esos dos números dentro de un ítem en blanco — se perdía todo lo demás (tramos,
pasajeros, fechas), que es justo lo que esta replanificación pidió conservar.

`PATCH /quotes/:id/link-sale` después de que `POST /sales` responde: sin cambios (dos
llamadas, cada una por su camino real; no se toca `sales.service.js::createSale`).

### 8. El PDF: igual mecanismo, descripción ya resuelta

Sin cambios de mecanismo (`pdfmake`, caché por huella en el bucket `quotes`, URL
firmada de 5 minutos). `services/quotes/plantilla.js` sigue leyendo `l.descripcion` y
`l.precio` de cada línea — ya no le importa si esa descripción salió de un campo libre
o de `resumenDe()`, el contrato con la plantilla no cambió.

### 9. Permisos

Sin cambios respecto a la primera replanificación: módulo `quotes`, `view:
'all'|'own'|'none'`, las tres piezas de siempre (`roles.service.js`, `authorize.js`,
`frontend/src/types/index.tsx`).

### 10. Frontend: la pantalla de cotizaciones reutiliza los componentes del asistente de venta

`Quotes.tsx` ya no tiene un editor de líneas propio (`Select` de categoría + 2
`CurrencyInput`). Su modal de crear/editar mantiene un estado local `draft:
WizardFormData` (el mismo tipo que usa `NewSaleWizard.tsx`, importado de
`wizardData.ts`) y renderiza directamente:

- `Step2Products` (`components/sales/steps/Step2Products.tsx`) — la grilla de
  categorías, el resumen en vivo y la lista de servicios añadidos.
- `ProductFormsModal` (`components/sales/wizard/ProductFormsModal.tsx`) — el formulario
  específico de cada categoría (tiquete con tramos y pasajeros, hotel con fechas y
  huéspedes...), cuando `activeForm` está puesto.
- `useSaleCalculations(draft, setDraft)` — mismo hook que usa el asistente para los
  totales en vivo (costo, ganancia, IVA, total).

Ninguno de los tres sabe que está dentro de una cotización: reciben `form`/`set`/`data`
igual que dentro de `NewSaleWizard`, y `data`/`fetchConfig` salen de `useData()` (los
catálogos de aerolíneas, proveedores, métodos de pago viven solo ahí, por convención —
ver `frontend/CLAUDE.md`). El modal usa `Modal size="panel"` (el mismo modo de panel
centrado de `h-[85vh]` que ya existía para el asistente), con su propia cabecera y pie
porque ese tamaño no trae ninguno.

Al guardar, `handleSave` recorre `CATEGORIA_A_ARRAY` (categoría → clave de
`WizardFormData` → clave del cuerpo de la petición, p. ej. `tickets` → `ticketData`) y
envía solo los arrays no vacíos — igual que arma su propio cuerpo `NewSaleWizard.tsx`
al crear una venta. Al editar, `openEdit` hace el camino inverso: agrupa
`quote.lines[].detalle` por categoría dentro de cada array de un `WizardFormData` en
blanco. `convertirEnVenta` asigna `draft.products[categoria]` directamente a cada array
(sin pasar por ningún `INITIAL_*()`), fija `selectedProducts` y escribe el borrador en
la misma clave de `localStorage` que lee `NewSaleWizard.tsx`.

### 11. Nada es obligatorio en una cotización — se exige recién al convertir en venta

Al verla armada con el mismo rigor que una venta, el usuario pidió lo contrario de lo
que parecía implicar la decisión 1: una cotización **no es** una venta, así que no
debería exigir los mismos campos — ni el cliente, ni el costo de proveedor, ni la
reserva del titular de un tiquete. Esos datos nacen cuando la cotización se convierte
en venta real; mientras se cotiza, pueden faltar.

Se resolvió sin tocar ni los formularios ni la pantalla (eso ya se probó una vez —
formularios simplificados, sin selector de cliente— y se revirtió por pedido del
usuario: ver el registro en `tasks.md`). Es, en cambio, puramente una relajación de
validación, con la venta como referencia de qué sigue siendo estricto:

- **Cliente opcional.** `cotizaciones.cliente_id` vuelve a ser `Int?` (migración
  `20261012150000_cotizacion_cliente_opcional`, tras una ida y vuelta: se hizo opcional,
  se revirtió a `NOT NULL`, y esta decisión la vuelve a hacer opcional — tres
  migraciones en la tabla por el mismo campo, todas aditivas, ninguna editada).
  `quotes.schema.js::clientId` pasa a ser el mismo `id` opcional que `asesorId`.
  `quotes.service.js` gana `idDeClienteExistente(clientId)`: `null` si no se mandó
  nada, el id si el cliente existe, 400 si se mandó uno que no existe. `convertToSale`
  solo pide el cliente a `clientsService` si `cotizacion.cliente_id` no es nulo.
- **Costo de proveedor opcional.** `products.schema.js::esquemaDeCategoria(slug,
  {relajado})` — con `relajado: true`, el `supplierCost` de ticket/hotel/insurance/plan
  deja de ser `costoObligatorio` (> 0, obligatorio) y vuelve a ser `dinero` opcional
  como en el resto de categorías; nada más del esquema cambia (los enums que ya eran
  opcionales lo siguen siendo, y se siguen rechazando si llega un valor que no existe).
  `productArrays({relajado})` lo pasa a través. `quotes.schema.js` llama
  `productArrays({relajado: true, ...})`; `sales.schema.js` no pasa la opción, así que
  sigue con el esquema estricto de siempre.
- **Reserva del titular opcional.** `productValidation.js::validarTiquetes(ticketData,
  catalogos, {exigirReserva})` — con `exigirReserva: false` se salta solo la regla "si
  hay titular, necesita número de reserva"; el resto (aeropuertos y plan de equipaje
  reales si se mandaron) se sigue comprobando igual. `quotes.service.js` llama con
  `{exigirReserva: false}` en `createQuote`/`updateQuote`; `sales.service.js` no pasa
  la opción (`exigirReserva` por defecto `true`), así que una venta sigue exigiéndola
  exactamente igual que siempre.
- **`validarPersonas` no necesitó cambios.** Ya solo valida el documento de una
  persona cuando se manda un `docNumber` — si no se manda, no hay nada que revisar.
  Nunca fue una regla de "campo obligatorio", así que no hacía falta relajarla.
- **"Al menos un servicio" se mantiene.** No es un campo de un producto, es que la
  cotización tenga contenido: `lineasDe(body).length === 0` sigue dando 400 en
  `createQuote`/`updateQuote`, en los dos casos.

En el frontend, `Quotes.tsx` deja de bloquear "Guardar" por falta de cliente
(`disabled={saving || draft.selectedProducts.length === 0}`, antes también exigía
`draft.clientId`) y la etiqueta pasa de "Cliente *" a "Cliente (opcional)". Los
formularios por categoría (`forms/TicketForm.tsx` y los demás, reutilizados sin
cambios desde la decisión 10) no se tocaron: sus atributos `required` y asteriscos
son solo visuales ahí — `Quotes.tsx` nunca corre el `validarPaso` del asistente de
venta que los haría bloquear algo, así que ya no forzaban nada en el camino de
cotizar incluso antes de esta vuelta. `openEdit`/`convertirEnVenta` ganan el guard
`q.clientId ? {...} : {}` para no mandar `clientId: "null"` como texto cuando la
cotización no tiene cliente.

### 12. Segundo ajuste (2026-10-16): fuera lo que depende de una venta, y fuera el cliente

T11 relajó la validación pero dejó los formularios tal cual (decisión 10: los
mismos `forms/TicketForm.tsx` y compañía, con pasajeros, números de reserva y un
selector de cliente). El usuario, al verlo descrito, pidió más: esos campos no solo
no deben ser obligatorios, no deben **aparecer**. El criterio, confirmado con él:
se quita un campo si depende de una venta que todavía no existe (identidad de
cliente/pasajero, número de tiquete/reserva/vuelo, asiento); se queda si describe
el servicio en sí (tipo, destino, fechas, cantidades, costo, ganancia).

Esto ya se había construido una vez (una primera versión de
`QuoteProductForm.tsx`/`QuoteProductFormsModal.tsx` con cliente opcional) y se
revirtió por completo a pedido del usuario — sin llegar a verla en pantalla, según
aclaró después. La causa real, aclarada en esta vuelta: no fue el enfoque, fue que
el campo "cliente" seguía ahí (solo opcional, no retirado) y la tabla de campos por
categoría no se había confirmado con él antes de construirla. Esta vez:

- **Sin selector de cliente, en ningún punto.** `Quotes.tsx` no tiene ningún
  `AsyncCombobox` de cliente ni estado `clientName`. El cuerpo de `POST`/`PUT
  /quotes` nunca manda `clientId` desde la pantalla (sigue aceptándolo si llega por
  otra vía, decisión 11, pero nada en la UI lo pone). `openEdit` conserva
  internamente el `clientId` de una cotización que ya tuviera uno (de antes de este
  cambio, o puesto por la API) para no borrarlo en silencio al guardar, pero no lo
  muestra. La vista de solo lectura (T8) solo imprime la fila "Cliente" si hay uno.
  Sin cambio de esquema ni migración: `cliente_id` ya era opcional desde T7.
- **Los campos que dependen de una venta se esconden *dentro* de los formularios de
  venta — no hay formularios nuevos.** Un primer intento dentro de esta misma
  decisión reconstruyó `QuoteProductForm.tsx`/`QuoteProductFormsModal.tsx` (otro
  diseño, propio para cotizar); el usuario pidió deshacerlo en la misma conversación:
  quería el formulario real de cada categoría, con su mismo diseño, solo sin esos
  campos puntuales. Queda resuelto en la decisión 13: `Quotes.tsx` sigue usando
  `ProductFormsModal` (como en la decisión 10), que le pasa a cada
  `forms/TicketForm.tsx`/`HotelForm.tsx`/etc. un prop `cotizando` que por defecto es
  `false` — el asistente de venta real nunca lo manda.
- **`wizardData.ts`**: los `INITIAL_*` que antes precargaban un pasajero/huésped
  desde el cliente (`INITIAL_TICKET`, `_HOTEL`, `_INSURANCE`, `_PLAN`, `_TOUR`)
  vuelven a poner `client ? [...] : []` — necesario porque `Step2Products.tsx`
  (reutilizado sin cambios) llama estas factorías directamente al añadir el primer
  ítem de una categoría, y sin cliente (ya no hay ninguno) el array queda vacío en
  vez de traer un pasajero en blanco. No cambia nada en una venta real (ahí siempre
  hay cliente para este punto).
- **El campo Asesor (T8) se queda.** No es el mismo problema: identifica quién
  cotiza dentro de la agencia, no a quién se le cotiza, y sin él la suplantación
  sigue rota (decisión del T8).

### 13. Corrección el mismo día: el mismo diseño, con un prop `cotizando`

El usuario, tras ver el plan de la decisión 12, fue explícito: *"necesito que quede
el mismo diseño de las modales solo quitar los campos que no son necesarios [...]
pero de resto dejar todo"*. Los formularios propios (`QuoteProductForm.tsx`) tenían
exactamente los campos correctos (sin pasajeros ni números de reserva), pero se
veían distinto — inputs sueltos en vez del diseño real de cada categoría (iconos,
secciones, el manejo de escalas de un tiquete, etc.). Se borraron y se reemplazó el
enfoque:

- **`forms/*.tsx` gana un prop `cotizando?: boolean` (default `false`) en las 15
  categorías.** Cada campo que depende de una venta que no existe queda envuelto en
  `{!cotizando && (...)}` dentro del mismo formulario, sin cambiar su estructura ni
  su estilo. Lo que se esconde, por categoría:
  - **Ticket:** toda la sección "Información de Pasajeros", y el campo "N° Vuelo"
    de cada tramo (ida, vuelta, escalas) y "N° Tiquete" de cada escala. El
    `useEffect` que precarga un pasajero en blanco también se salta
    (`if (cotizando) return;`) — sin esto, seguía creando un pasajero titular sin
    cliente al que atribuírselo.
  - **Hotel:** "Número de Reserva" y la sección "Huéspedes".
  - **Seguro:** "Teléfono del Cliente" y "Miembros del Grupo".
  - **Paquete:** los 4 campos de la reserva (número de reservación, vuelo/placa,
    tiquete/silla, confirmación) y "Integrantes del Plan" — las fechas y el resto de
    "Reservación y Transporte" se quedan, son del servicio, no de la reserva.
  - **Check-in:** nombre y documento del pasajero, "Vuelo o Reserva", "Silla
    Preferida", "Celular".
  - **Trámite migratorio / Visa:** identidad completa del solicitante (nombre,
    nacimiento, nacionalidad, documento, vencimiento, correo) — solo quedan los
    campos del trámite en sí (país, tipo, fecha estimada).
  - **SimCard:** nombre y documento del titular, correo.
  - **Renta de auto:** conductor principal, número de licencia, tarjeta de
    garantía.
  - **Finca:** responsable, documento, teléfono.
  - **Tour:** teléfono, "Integrantes del Tour" y la sección de subir vouchers (un
    archivo no existe antes de una venta).
  - **Convención:** nombre de contacto, correo.
  - **Restaurante:** "Nombre de la Reserva", celular.
  - **Pasaporte:** nombre, número de identificación, nacimiento, teléfono.
  - **Mascota:** nombre del dueño, teléfono (el nombre de la mascota se queda: no
    identifica a ningún cliente).
  - Sin cambios en ningún campo financiero (`supplierCost`, `ta`, método de pago) ni
    en los que describen el servicio (destino, fechas, tipo, cantidades) — eso es
    exactamente lo que sí hace falta para cotizar.
- **`wizard/ProductFormsModal.tsx` reenvía `cotizando` a cada formulario**, con el
  mismo valor por defecto `false`.
- **`Quotes.tsx` vuelve a usar `ProductFormsModal`** (como en la decisión 10), con
  `cotizando` fijo en `true`. `QuoteProductForm.tsx`/`QuoteProductFormsModal.tsx`
  (de la decisión 12) se borraron.
- `NewSaleWizard.tsx` no se tocó y nunca manda `cotizando`: con el valor por defecto
  en `false`, el asistente de venta real queda exactamente igual que antes.

## Superficie de API

Misma superficie y mismos permisos desde la primera replanificación; el cuerpo de
`POST`/`PUT /quotes` cambió de forma en la decisión 2 y de obligatoriedad en la 11:
`clientId` es opcional, y ningún producto exige ya su costo de proveedor.

| Ruta | Qué hace | Permiso |
|---|---|---|
| `GET /quotes` | Lista paginada, con el alcance del rol | `quotes.view` |
| `POST /quotes` | Crea cabecera + líneas en una transacción; nada es obligatorio (decisión 11) | `quotes.create` |
| `GET /quotes/:id` | Detalle | `quotes.view` |
| `PUT /quotes/:id` | Reemplaza cabecera + líneas; 400 si está cerrada | `quotes.edit` |
| `DELETE /quotes/:id` | Baja lógica | `quotes.delete` |
| `POST /quotes/:id/duplicate` | Copia independiente, 201 | `quotes.create` |
| `POST /quotes/:id/send` | `estado → enviada` | `quotes.edit` |
| `POST /quotes/:id/respond` | `{ accepted: boolean } → aceptada/rechazada` | `quotes.edit` |
| `POST /quotes/:id/convert-to-sale` | Devuelve el borrador precargado (`clientId`/`client` nulos si la cotización no tenía cliente), no escribe nada | `quotes.edit` |
| `PATCH /quotes/:id/link-sale` | `{ saleId }`, fija `venta_id` tras crear la venta | `quotes.edit` |
| `GET /quotes/:id/pdf` | URL firmada del PDF (genera o reutiliza caché) | `quotes.view` |

`numero` sale siempre del disparador, nunca se calcula en el código. Totales de una
cotización, igual que una venta: se computan en el servidor, nunca se suman en el
navegador.
