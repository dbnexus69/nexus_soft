# Carga bajo demanda en el módulo de ventas

## Problema

`GET /sales/:id` devuelve la venta entera en una sola respuesta: cabecera, pagos y las
15 categorías de producto con sus pasajeros, tramos de vuelo y aeropuertos resueltos.
Una venta con todos los productos poblados pesa ~15 KB y cuesta ~20 joins de Prisma,
aunque el modal de detalle muestre los productos **de uno en uno** (`onViewProductDetails`
en `SaleDetailModal.tsx` ya es bajo demanda).

Ese payload además se dispara desde donde no debería: `SalesTable.tsx:164` tiene
`onMouseEnter={() => onPrefetchDetail?.(sale)}`. Pasar el cursor por la tabla lanza
un `getSale(id)` completo por cada fila rozada. Barrer 20 filas son 20 peticiones de
15 KB. En `Sales.tsx:123` ya hay un comentario reconociendo "peticiones fantasma que
colapsan la red y el backend" — se quitó un prefetch y quedó este otro puesto.

Detrás de esto hay un desorden que se arrastra a todo el módulo: **las mismas 15
categorías de producto tienen cuatro nombres distintos** según dónde se miren.

| Dónde | Vocabulario |
|---|---|
| URL de escritura (`sales.routes.js:24-50`) | `ticket`, `hotel`, `insurance`, `car`, `convention`, `pet`… |
| `detalle_venta.categoria` en BD | `tiqueteria`, `hoteleria`, `seguros_viaje`, `renta_vehiculos`… |
| `labelMap` de `listSales` (`sales.service.js:1053`) | `tiqueteria`, `hoteleria`, `seguros`, `autos`, `eventos`… |
| Claves del JSON de respuesta | `ticketData`, `hotelData`, `insuranceData`, `carRentalData`… |

Los vocabularios 2 y 3 se comparan entre sí y no cuadran:

```js
// sales.service.js:1051-1059
const tipo = d.categoria;                    // de BD: "seguros_viaje"
let label = tipo;
if (labelMap[tipo]) label = labelMap[tipo];  // labelMap tiene "seguros" → no entra
```

**8 de las 15 categorías fallan el lookup** (`seguros_viaje`, `documentacion_migratoria`,
`renta_vehiculos`, `renta_fincas`, `centros_convencion`, `visa`, `pasaporte`,
`servicio_mascotas`), así que `label` se queda con el valor crudo y la columna de
servicios muestra literalmente "renta_vehiculos" al usuario. Es un bug vivo, no una
hipótesis.

Y en el listado hay un problema aparte pero del mismo módulo: `GET /sales` está
paginado en backend (`parsePagination`, default 20, máx 100) pero el frontend nunca
manda `page` ni `perPage`. Luego `Sales.tsx:87` filtra por texto, estado y rango de
fechas **sobre esas 20 filas, en cliente**. No es lentitud: la aplicación no puede ver
ni buscar más allá de las 20 ventas más recientes.

## Objetivo

- Abrir el detalle de una venta trae ~1.5 KB en vez de ~15 KB. Cada categoría de
  producto se pide cuando el usuario abre esa sección, no antes.
- Recorrer la tabla de ventas con el ratón no genera ninguna petición.
- Una sola categoría tiene un solo nombre en todo el sistema: URL, base de datos,
  respuesta y etiqueta salen de la misma fuente.
- La tabla de ventas muestra "Renta de Auto", no "renta_vehiculos".
- Buscar y filtrar en el listado consulta todas las ventas, no las 20 primeras.

## Fuera de alcance

- **Índice en `ventas.creado_at`**. No existe hoy y es justo por lo que ordena cada
  listado. Queda fuera por decisión explícita; ver Riesgos.
- **`config.getAll()`** (`config.service.js:249`) recorre 8 secciones con `for` + `await`
  secuencial — 8 round-trips donde cabe un `Promise.all`. Sigue igual.
- **Rediseño del estado en frontend**: la caché a mano en localStorage (`salesCache`,
  `usersCache`, `configCache`, `dashboardCache`), el `DataContext` de 768 líneas y los
  9 providers anidados de `App.tsx`. Se mantienen tal cual; este trabajo se adapta a
  ellos, no los sustituye. Sin TanStack Query ni ninguna dependencia nueva.
- **Versionado de la API**. Al no haber nada en producción, los endpoints se cambian
  en sitio sin `/v1`.
- Los demás módulos (clients, users, commissions, stats, responsables) no se tocan.

## Diseño

### 1. El catálogo de productos: una sola fuente de verdad

Un módulo nuevo, `backend/src/catalog/products.js`, con una entrada por categoría.
Los cuatro vocabularios colapsan en esta tabla:

| slug (URL y BD) | modelo Prisma | clave de respuesta | label |
|---|---|---|---|
| `ticket` | `prod_tiqueteria` | `ticketData` | Tiquetería |
| `hotel` | `prod_hoteleria` | `hotelData` | Hotelería |
| `insurance` | `prod_seguros` | `insuranceData` | Seguro |
| `plan` | `prod_planes` | `planData` | Plan |
| `checkin` | `prod_checkins` | `checkInData` | Check-in |
| `migration` | `prod_migracion` | `migrationData` | Migración |
| `simcard` | `prod_simcards` | `simCardData` | SIM Card |
| `car` | `prod_autos` | `carRentalData` | Renta de Auto |
| `finca` | `prod_fincas` | `fincaData` | Finca |
| `tour` | `prod_tours` | `tourData` | Tour |
| `convention` | `prod_eventos` | `conventionData` | Evento |
| `restaurant` | `prod_restaurantes` | `restaurantData` | Restaurante |
| `visa` | `prod_visas` | `visaData` | Visa |
| `passport` | `prod_pasaportes` | `passportData` | Pasaporte |
| `pet` | `prod_mascotas` | `petServiceData` | Mascota |

Cada entrada lleva además su `include` de Prisma y su función `transform`, que hoy
viven repartidas entre `PRODUCT_INCLUDES` y `PRODUCT_TRANSFORMS` en
`sales.service.js`. Se mueven aquí sin reescribirlas.

Los slugs **no se inventan**: son exactamente los que ya usan las rutas de escritura.
Por eso `finca` se queda en español — ya está en `POST /sales/:saleId/products/finca`
y cambiarlo sería romper por estética.

El `labelMap` roto de `listSales` desaparece: el label sale del catálogo.

### 2. `detalle_venta.categoria` pasa a enum

Hoy es `String` en `schema.prisma:67`, sin restricción: nada impide escribir una
categoría que no existe. Pasa a ser un enum de Prisma con los 15 slugs, de forma que
el valor en BD y el segmento de URL sean literalmente el mismo string y el catálogo no
necesite traducir nada.

```prisma
enum ProductCategory {
  ticket hotel insurance plan checkin migration simcard car
  finca tour convention restaurant visa passport pet
}
```

Requiere un `UPDATE` que reescriba los valores existentes (`tiqueteria` → `ticket`,
`seguros_viaje` → `insurance`, …). Es seguro porque no hay nada en producción.

### 3. Los endpoints

```
GET /sales/:id
  → cabecera + pagos + inventario de productos, sin los datos de los productos

    { id, clientName, clientEmail, total, status, payments: [...],
      products: [ { category: "ticket", label: "Tiquetería", count: 1 },
                  { category: "hotel",  label: "Hotelería",  count: 1 } ] }

GET /sales/:id/products/:category
  → los datos de UNA categoría. Se pide al abrir esa sección del modal.

GET /sales/:id/products
  → todas las categorías de golpe. Existe por el voucher (ver abajo).
```

`GET /sales/:id/products/:category` es **una sola función genérica**, no quince: recibe
el slug, lo busca en el catálogo y aplica su `include` y su `transform`. Un slug
desconocido devuelve 404.

Esto cierra la simetría que ya estaba a medias — el módulo pasa a tener las cuatro
operaciones sobre el mismo recurso y con el mismo nombre:

```
GET    /sales/:id/products/ticket        ← nuevo
POST   /sales/:id/products/ticket        ← ya existe
PUT    /sales/:id/products/ticket/:pid   ← ya existe
DELETE /sales/:id/products/ticket/:pid   ← ya existe
```

**El caso del voucher.** `buildVoucherPdf` (`Sales.tsx:169`) necesita la venta entera
para renderizar el PDF; no puede ir por secciones. Por eso existe
`GET /sales/:id/products` — la colección completa. Es la forma REST correcta de decir
"todos los productos de esta venta" y evita tener que meter un `?include=all` que
volvería a abrir la puerta al payload monolítico.

### 4. El listado deja de mentir

`GET /sales` gana los filtros que hoy se aplican en cliente (`dateFrom`/`dateTo` ya
existen en el backend pero el frontend no los usa) y el frontend empieza a mandar
`page` y `perPage`. La tabla gana controles de paginación. `Sales.tsx:87` pierde su
`useMemo` de filtrado, que pasa a ser responsabilidad del servidor.

Dentro de `listSales` hay hoy dos construcciones de la misma condición: un objeto
`where` de Prisma para el `count` y strings concatenados para el `$queryRawUnsafe`.
Se unifican en un único constructor de filtros, y los valores dejan de interpolarse en
el SQL (hoy `search` entra con un escape de comillas hecho a mano) para pasar como
parámetros.

### 5. El consumidor

- Fuera el `onMouseEnter` de `SalesTable.tsx:164`. La tabla no pide detalle nunca.
- `SaleDetailModal` pide `GET /sales/:id` al abrirse y `GET /sales/:id/products/:cat`
  al desplegar una sección, con su propio estado de carga por sección.
- `isAlreadyFull()` (`SaleDetailModal.tsx:59`), que hoy adivina si una venta viene
  completa mirando si `ticketData !== undefined`, desaparece: el inventario `products`
  dice explícitamente qué hay.

## Decisiones y alternativas

| Decisión | Elegimos | Descartamos | Por qué |
|---|---|---|---|
| Forma del contrato | Sub-recursos por categoría | Un endpoint con `?include=` | Las rutas de escritura por categoría ya existen; el GET cierra la simetría. `?include=` da forma variable por llamada, cachea peor en HTTP y `?include=*` revive el problema. |
| Vocabulario ganador | Inglés, el de las rutas de escritura | El español de la BD | Si el GET usara otro vocabulario que el POST/PUT/DELETE, la asimetría vuelve por la puerta de atrás y media API queda en cada idioma. |
| Valores en BD | Migrar a los slugs en inglés + enum | Mapear inglés↔español en el catálogo | No hay nada en producción: la migración es barata hoy y evita convivir para siempre con dos nombres por categoría. El enum además impide categorías inexistentes. |
| Venta completa para el PDF | `GET /sales/:id/products` | `GET /sales/:id?include=all` | Una colección es REST correcto y no reabre la puerta al payload monolítico por parámetro. |
| Prefetch en hover | Eliminarlo | Debounce / caché de detalles | El modal ya carga al abrirse. El prefetch resuelve un problema que no existe y crea uno que sí. |
| Estado en frontend | Seguir con contexts + localStorage | TanStack Query | Fuera de alcance por decisión explícita. |

## Riesgos y desconocidos

- **Sin índice en `ventas.creado_at`.** Queda fuera de alcance, pero la paginación real
  va a hacerlo más visible: cada página ejecuta `ORDER BY v.creado_at` sobre la tabla
  completa. Con pocos cientos de filas no se nota; se detecta cuando el listado empiece
  a tardar al crecer los datos. Es un `@@index` de una línea y el schema ya se toca en
  el paso 2 — se puede colar ahí si se quiere.
- **Más peticiones, más pequeñas.** Un usuario que abre las 15 secciones de una venta
  hace 16 peticiones donde antes hacía 1. El total transferido es parecido; lo que
  mejora es el caso común (abrir el detalle y mirar una o dos secciones) a costa del
  caso raro. Si en la práctica los usuarios abren casi siempre todas las secciones, este
  diseño no gana nada — se detecta mirando qué secciones se abren de verdad.
- **La migración del enum es de ida.** Si algún dato tiene una categoría fuera de las 15
  (posible: hoy la columna es `String` libre), el `UPDATE` la deja fuera y el catálogo
  dará 404. Hay que hacer un `SELECT DISTINCT categoria FROM detalle_venta` antes de
  migrar y comprobar que salen exactamente 15 valores conocidos.
- **La caché de ventas en localStorage.** `salesCache` guarda objetos `Sale` con la
  forma vieja. Al cambiar la forma de la respuesta, un usuario con caché previa puede
  ver datos inconsistentes. Hay que invalidarla en el arranque (ya existe el patrón:
  `DataContext.tsx:28` hace justo eso con la caché de permisos).
- **Paginación en `Responsables.tsx`.** Esa página consume la lista de ventas vía
  `DataContext` para agregar por responsable. Si pasa a recibir solo una página, sus
  totales quedan mal. Hay que decidir si necesita un endpoint de agregación propio o si
  le basta con pedir un `perPage` alto — no está resuelto todavía.

## Plan de implementación

Cada paso es verificable por separado y la aplicación sigue funcionando entre uno y otro.

1. **Quitar el prefetch en hover** — borrar `onMouseEnter` de `SalesTable.tsx:164`.
   *Verificable:* recorrer la tabla con el ratón no produce ninguna entrada en la
   pestaña Red. Independiente de todo lo demás; se puede hacer y mergear ya.

2. **Crear el catálogo** — `backend/src/catalog/products.js` con las 15 entradas,
   moviendo `PRODUCT_INCLUDES` y `PRODUCT_TRANSFORMS` desde `sales.service.js` sin
   cambiar su lógica. *Verificable:* `getSaleById` sigue devolviendo exactamente el
   mismo JSON que hoy, leyendo del catálogo.

3. **Arreglar el label de la tabla** — `listSales` toma el label del catálogo en vez del
   `labelMap`. *Verificable:* una venta con seguro muestra "Seguro" y no
   "seguros_viaje" en la columna de servicios.

4. **Migrar `detalle_venta.categoria`** — `SELECT DISTINCT` de comprobación, `UPDATE` de
   los 15 valores, enum `ProductCategory` en el schema, `prisma db push`. *Verificable:*
   el `SELECT DISTINCT` posterior devuelve solo slugs del enum, y crear una venta nueva
   por el wizard guarda el slug correcto.

5. **Endpoints de lectura por categoría** — `GET /sales/:id/products/:category` y
   `GET /sales/:id/products`, ambos sobre la función genérica del catálogo.
   *Verificable:* por Postman, `/sales/24/products/ticket` devuelve solo tiquetería y
   `/sales/24/products/xyz` devuelve 404.

6. **Adelgazar `GET /sales/:id`** — pasa a devolver cabecera + pagos + inventario
   `products`. *Verificable:* el payload de la venta 24 baja de ~15 KB a ~1.5 KB.

7. **Adaptar el modal** — `SaleDetailModal` carga por sección, se elimina
   `isAlreadyFull`, y `buildVoucherPdf` pasa a usar `GET /sales/:id/products`.
   *Verificable:* abrir el detalle carga la cabecera al instante; abrir "Tiquetería"
   dispara una petición; el PDF del voucher sale idéntico al de hoy.

8. **Unificar filtros en `listSales`** — un solo constructor de condiciones para el
   `count` y la consulta, con parámetros en vez de interpolación. *Verificable:* los
   filtros existentes devuelven los mismos resultados, y un `search` con comilla simple
   no rompe la consulta.

9. **Paginación real** — el frontend manda `page`/`perPage`, los filtros de fecha y
   texto viajan al servidor, la tabla gana controles de página, se elimina el `useMemo`
   de filtrado de `Sales.tsx:87`, y se invalida `salesCache`. *Verificable:* con más de
   20 ventas en BD, buscar una de la página 3 la encuentra.

10. **Resolver `Responsables.tsx`** — decidir entre endpoint de agregación o `perPage`
    alto, según lo que muestre esa pantalla. *Verificable:* los totales por responsable
    coinciden con los de antes del cambio.
