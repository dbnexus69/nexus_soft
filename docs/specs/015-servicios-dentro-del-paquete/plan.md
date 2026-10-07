# Plan técnico — Spec 015

## Decisiones

### 1. Catálogo: hijos de un paquete = todas las categorías salvo `plan`

`backend/src/catalog/products.js`, `META[slug].canBeChild`. `CHILD_SLUGS` se deriva de ahí, y
es lo que usan `getSaleProducts` y `_attachChildren` (`sales.service.js`) para colgar los
hijos en `includedProducts[slug]` de cada paquete.

Antes solo eran hijos tiquete, hotel y seguro (y después tour). El cambio no toca escrituras:
`ventaProductos.js` ya guardaba `parentDetalleId` para cualquier categoría que no fuera
`sinPadre`, que es solo el plan.

### 2. Voucher: un helper que pinta los hijos con su sección

`backend/src/services/voucher/plantilla.js`:

- `bloquesDeHijos(plan, aeropuertos, c)` recorre `plan.includedProducts` por slug. Para cada
  uno toma `label` y `responseKey` de `META`, busca la sección con esa clave en `SECCIONES` y
  usa sus `campos`. Los tiquetes van por `bloqueTiquete`, igual que en la sección de vuelos.
- La sección de paquetes llama al helper justo después de sus propias filas.
- `campoTour` es la descripción del tour, usada tanto en su sección como dentro del paquete.
  Lee `tourName` (el nombre que entrega el catálogo, no `selectedTour`) y añade la fecha y la
  hora.

### 3. Versión de la plantilla

`PLANTILLA_VERSION` pasa de 2 a 4 (3 fue una versión intermedia del mismo cambio). El caché de
`services/voucher/index.js` se indexa con `{ v: PLANTILLA_VERSION, venta, agencia }`: sin subir
la versión, un PDF generado antes se servía igual.

### 4. Finca: nombres de campo

`ventaProductos.js` escribía `ciudad_pueblo` desde `f.city` y `direccion_finca` desde
`f.address`. Pasan a `f.fincaCity` y `f.fincaAddress`, los nombres del formulario. Está en
esta spec porque es la misma familia de datos que se pierden al guardar.

## Archivos

| Archivo | Cambio |
|---|---|
| `backend/src/catalog/products.js` | `canBeChild: true` en todas las categorías salvo `plan` |
| `backend/src/services/voucher/plantilla.js` | `bloquesDeHijos`, `campoTour`, versión 4 |
| `backend/src/services/ventaProductos.js` | nombres de campo de la finca |

## Verificación

- **Venta 603 (DB Nexus, consulta de solo lectura):** los dos tours tenían `parentDetalleId`
  apuntando al paquete, y la lectura no los devolvía. Tras el cambio, la definición del voucher
  los contiene dentro del paquete.
- **Prueba con datos ficticios:** un hijo de cada una de las 14 categorías bajo un paquete del
  ejemplo de `ventaDeEjemplo.js`. Resultado: 14/14 con su título "… incluido en …".
- `pnpm test:voucher` y `pnpm test:vuelos-api`: sin fallos.
- `node --check` de los archivos tocados.
