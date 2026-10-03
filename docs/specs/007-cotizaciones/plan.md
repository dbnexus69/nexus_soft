# Plan técnico — Spec 007

## Decisiones

### 1. La línea de una cotización es simple, no reutiliza los productos de venta

Dos formas de modelarlo, evaluadas antes de tocar el esquema:

- **Reutilizar las 15 tablas `prod_*`** que ya usan las ventas (`prod_tiqueteria`,
  `prod_hoteleria`…), con su detalle completo —tramos de vuelo, pasajeros con nombre y
  documento, equipaje—. Estas tablas cuelgan de `detalle_venta_id`
  (`@unique`, `NOT NULL` en la mayoría); compartirlas con cotizaciones exigiría hacer
  esa columna opcional en las 15 y añadir `detalle_cotizacion_id` al lado, o inventar
  una tabla "detalle" común de la que cuelguen ventas y cotizaciones por igual. Es una
  migración sobre el corazón del sistema de ventas —el que más se ha endurecido en
  las specs 001/002/004/005—, con el riesgo de romper algo que ya funciona para ganar
  algo que una cotización, por definición, no necesita todavía: no hace falta el
  número de tiquete de un vuelo que el cliente ni ha aceptado.
- **Una línea de cotización propia y más simple** (la elegida): categoría, descripción
  libre, proveedor opcional, costo, TA, IVA, cantidad. Sin tabla por categoría, sin
  tramos ni pasajeros. Cuando el cliente acepta, "Convertir en venta" abre el
  asistente con el cliente y los totales ya puestos, pero el asesor rellena el detalle
  fino de cada producto ahí, con los formularios que ya existen — ese paso no
  desaparece, solo deja de empezar en blanco.

Se elige la segunda: **no toca ninguna tabla de ventas**, es una migración aditiva
pura, y cubre el objetivo real (dejarle un precio por escrito al cliente) sin heredar
la complejidad de un producto ya vendido.

### 2. Las tarifas de proveedor son su propio catálogo, no parte de `config`

`config.service.js` ya tiene ocho catálogos (aerolíneas, proveedores, métodos de
pago…), todos de solo nombre/descripción. Una tarifa de proveedor lleva un **costo**,
que es información más sensible —es el margen del negocio— y necesita su propio
permiso para poder ocultarse a quien no deba verlo, independiente de `config.view`
(que hoy cualquier asesor tiene en `true` por defecto, ver spec 002 T20). Por eso es
un módulo de permisos propio, no una fila más en `SECTION_MAP`.

`tarifas_proveedor`: `proveedor_id` (FK a `proveedores`), `categoria`
(`ProductCategory`, el mismo enum de `detalle_venta.categoria` — una tarifa de hotel no
debería poder elegirse para una línea de vuelo), `concepto` (texto), `costo`,
`vigencia_desde`/`vigencia_hasta` (nullable; sin vigencia, se asume siempre vigente,
igual que un `paquete_tarifas` sin fechas), `notas`, `status` (activo/inactivo, mismo
patrón que el resto de catálogos). `empresa_id` con su RLS, como cualquier tabla de
inquilino.

### 3. `cotizaciones` sigue el mismo patrón que `ventas`

Cabecera `cotizaciones`: `id`, `numero` (el disparador `app_asignar_numero()` ya
existente se extiende a esta tabla, igual que se hizo con las nueve tablas numeradas —
ver `docs/designs/numeros-visibles-por-agencia.md`), `cliente_id`, `asesor_id`
(`usuario_id`), `estado` (`CotizacionEstado`: `borrador`, `enviada`, `aceptada`,
`rechazada`), `fecha_vencimiento`, `observaciones`, `creado_at`, `deleted_at` (baja
lógica, como `clientes`/`ventas`, para no reutilizar un número). `venta_id` nullable,
puesta cuando se convierte en venta, para poder enlazar de vuelta sin ambigüedad.

`detalle_cotizacion`: `cotizacion_id`, `categoria`, `descripcion`, `proveedor_id`
nullable, `tarifa_proveedor_id` nullable (de qué tarifa se copió el costo, si de
alguna), `costo_proveedor`, `ta`, `iva` (derivado del `ta` igual que en una venta —
`datosFinancieros` de `saleTotals.js` se reutiliza tal cual, sin copiar la fórmula),
`cantidad`.

Las dos llevan clave ajena compuesta `(id, empresa_id)` donde haga falta, siguiendo el
patrón de T3b de la spec 001: `detalle_cotizacion.cotizacion_id` apunta a
`cotizaciones(id, empresa_id)`, no solo a `cotizaciones(id)`.

**`estado: vencida` no es una columna.** Se deriva al leer, comparando
`fecha_vencimiento` con la fecha de hoy en Bogotá (`fechaEnColombia`, `utils/fechas.js`,
ya existe) — el mismo patrón que ya usa `critico` en vuelos (spec 004): guardarlo
exigiría un cron y quedaría desincronizado.

### 4. Duplicar, no "plantillas"

`POST /quotes/:id/duplicate`: lee la cotización y sus líneas, crea una nueva con
`estado: borrador`, mismo cliente (editable después), mismas líneas, fecha de
vencimiento recalculada desde hoy. No hay una tabla ni un estado de "plantilla": toda
cotización, acabe o no, sirve como punto de partida para otra. Más simple que una
segunda entidad, y es exactamente el caso de uso que se pidió ("guardar para
reutilizar").

### 5. Convertir en venta

`POST /quotes/:id/convert-to-sale` no escribe la venta directamente: devuelve un
`body` con la forma que el asistente de venta ya espera para precargar su borrador de
`localStorage` (`clientId`, y las líneas traducidas a `products` con su categoría y
precio) y el frontend redirige al asistente ya con esos datos puestos. La escritura
real sigue pasando, como siempre, por `POST /sales` (spec 002, T15: una venta se crea
entera, en una sola transacción) — convertir no crea un segundo camino para escribir
una venta, solo precarga el primero.

### 6. El PDF reutiliza el mecanismo del voucher

`VoucherPDF.tsx` ya genera un documento con la marca de la agencia
(`GET /branding`) para una venta. Una `QuotePDF.tsx` nueva sigue el mismo patrón
—mismos colores derivados, mismo renderizado a imagen—, con su propio maquetado
porque una cotización no tiene pasajeros ni tramos que mostrar.

### 7. Permisos

Módulo `quotes` en las tres piezas de siempre, con `view` de alcance (`own`/`all`,
como `sales`) porque tiene sentido que un asesor vea solo lo que él cotizó:

1. `roles.service.js` — `MODULE_ACTIONS.quotes = ['view', 'create', 'edit', 'delete']`,
   añadido a `SCOPED_VIEW_MODULES`.
2. `authorize.js` — `ADMIN_PERMISSIONS.quotes` con todo en `true`/`'all'`;
   `ROLE_DEFAULT_PERMISSIONS.asesor/freelancer.quotes` con `view: 'own', create: true,
   edit: true, delete: false` (mismo patrón que `sales`).
3. `frontend/src/types/index.tsx` — `RolePermissions.quotes` y las constantes por
   defecto, en paralelo.

Módulo `supplierRates` para las tarifas de proveedor, booleano simple (sin alcance:
una tarifa no es "de" un asesor), con los mismos tres sitios.

## Superficie de API

| Ruta | Qué hace |
|---|---|
| `GET/POST /supplier-rates`, `PUT/DELETE /supplier-rates/:id` | CRUD de tarifas de proveedor, paginado como cualquier colección |
| `GET /supplier-rates?providerId=&category=` | Para el selector dentro de una línea de cotización: solo las vigentes de ese proveedor y esa categoría |
| `GET/POST /quotes`, `GET/PUT/DELETE /quotes/:id` | CRUD de cotizaciones, con sus líneas anidadas en el mismo body (igual que una venta con sus productos) |
| `POST /quotes/:id/duplicate` | Devuelve la cotización nueva, 201 |
| `POST /quotes/:id/send` | `estado: borrador → enviada` |
| `POST /quotes/:id/respond` | `{ accepted: boolean }` → `aceptada`/`rechazada` |
| `POST /quotes/:id/convert-to-sale` | Devuelve el borrador precargado para el asistente, no escribe la venta |

`numero` sale siempre del disparador, nunca se calcula en el código (misma regla que
el resto de tablas numeradas). Totales de una cotización, igual que una venta: se
computan en el servidor, nunca se suman en el navegador.
