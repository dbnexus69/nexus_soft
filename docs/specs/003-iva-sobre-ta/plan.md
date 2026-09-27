# Plan técnico — Spec 003

No hay rediseño: la arquitectura de las specs 001/002 se mantiene (RLS, `saleTotals.js` como única
fuente del dinero, el servidor recalculando siempre). Aquí solo las decisiones nuevas y por qué.

## Decisiones

**1. El IVA vive en un campo propio, nunca dentro de `ta`.** `detalle_venta.iva` y `ventas.iva_total`,
espejo de cómo ya conviven `ta`/`ta_total` y `costo_proveedor`/`costo_proveedor_total`. La alternativa
— guardar `ta` ya con el IVA sumado — contamina las tres métricas que leen `ta_total` como ingreso real
de la agencia (dashboard, ranking de asesores, cartera). Migración puramente aditiva, sin backfill: las
filas existentes quedan en `iva = 0`, que es correcto porque se crearon antes de que el sistema
calculara IVA.

**2. La tasa es una constante, no una fila de configuración.** Fija para toda la app, no editable por
agencia ni por producto — una tabla de configuración sería sobre-ingeniería para un valor que no
cambia por tenant. Vive en `backend/src/services/saleTotals.js` (`TASA_IVA`, fuente de verdad) y se
espeja en `frontend/src/utils/iva.ts` (vista previa en vivo del asistente), con un comentario cruzado
en los dos que dice "cambiar los dos juntos" — el mismo patrón que ya usa el repo para
`backend/src/utils/datosPersona.js` ↔ `frontend/src/utils/datosPersona.ts` (documentado en
`CLAUDE.md`). El IVA que ve el asesor mientras cotiza es una vista previa; el que se guarda siempre lo
recalcula el servidor a partir de `ta`, nunca el que mande el body.

**3. `precioProducto` pasa a incluir el IVA en su rama derivada.** Es la única función que decide el
precio de una línea (`backend/src/services/saleTotals.js`): hoy `ta + supplierCost` cuando el payload
no trae un `total` explícito; pasa a `ta + supplierCost + calcularIva(ta)`. La rama con `total`
explícito no se toca — ningún camino real del asistente la usa hoy, y no hay que inventarle
comportamiento a un caso sin uso.

**4. Un helper nuevo, `datosFinancieros(x)`, para no repetir el cálculo 15 veces.** `sales.service.js`
inserta una línea de `detalle_venta` por cada una de las 15 categorías de producto, y las 15 repiten
literalmente `subtotal: precioProducto(x), ta: Number(x.ta || 0), costo_proveedor: Number(x.supplierCost || 0)`.
En vez de agregar `iva` a mano en los 15 sitios, `datosFinancieros(x)` devuelve las cuatro cifras
juntas (`{ subtotal, ta, costo_proveedor, iva }`) y los 15 inserts pasan a `...datosFinancieros(x)`.
Se sigue tocando cada uno de los 15 sitios (no hay forma de evitarlo, son 15 `tx.detalle_venta.create`
distintos), pero la fórmula del IVA queda en un solo lugar.

**5. El servidor nunca lee `iva` del body.** El IVA no es un dato que el asesor ingrese: siempre se
deriva de `ta`. `products.schema.js` no gana un campo nuevo, y `NO_EDITABLES` (en `sales.service.js`,
lo que `PUT /sales/:id` rechaza reescribir desde la cabecera) gana `iva` junto al `ta` que ya tiene —
mismo patrón, mismo motivo.

**6. La comisión y la "Ganancia Oficina" se calculan sobre TA neta — sin cambios en la comisión, con
corrección en la ganancia.** La comisión del comisionista (`frontend/src/hooks/useSaleCalculations.ts`
y `Step3Payment.tsx`) ya se calcula como `ta * %`, así que no necesita ningún cambio: ya cumple la
regla de negocio sin saberlo. La "Ganancia Oficina", en cambio, está duplicada en 3 pantallas
(`Step3Payment.tsx`, `SaleDetailModal.tsx`, `SalePaymentsModal.tsx`) como `total − costo − comisión`,
y con el IVA sumado a `total` esa fórmula queda inflada. Se corrige a `ta − comisión` en las 3 — más
directa que `total − costo − iva − comisión`, aunque son equivalentes.

**7. El voucher del cliente no se toca.** `VoucherPDF.tsx` ya muestra un solo total (`sale.total`) sin
desglosar TA ni costo de proveedor; ese total incluye el IVA automáticamente en cuanto
`precioProducto` lo incluye, sin que el componente necesite saber que existe.

**8. Los 4 formularios que no usan `FinancialSection` no se tocan.** `HotelForm`, `InsuranceForm`,
`PlanForm` y `TicketForm` duplican a mano el bloque de Costo Proveedor/TA en vez de usar el componente
compartido `VoucherField.tsx` → `FinancialSection`. El IVA no se ingresa por producto, así que no hay
campo nuevo que agregarles; unificarlos en `FinancialSection` queda anotado como deuda técnica aparte,
no depende de este cambio.

## Dónde vive la tasa (detalle)

```js
// backend/src/services/saleTotals.js
// Fija para toda la app, no configurable por agencia ni por producto. Si
// cambia la tasa nacional, se cambia aquí Y en frontend/src/utils/iva.ts.
const TASA_IVA = 0.19;

function calcularIva(ta) {
  return aCentimos(Number(ta || 0) * TASA_IVA);
}
```

```ts
// frontend/src/utils/iva.ts
// Espejo de TASA_IVA en backend/src/services/saleTotals.js. Cambiar los dos juntos.
export const TASA_IVA = 0.19;
export function calcularIva(ta: number): number {
  return Math.round((ta || 0) * TASA_IVA * 100) / 100;
}
```

Un solo archivo frontend consumido por `useSaleCalculations.ts`, `Step3Payment.tsx`,
`SaleDetailModal.tsx` y `SalePaymentsModal.tsx`, para que la fórmula no se repita 4 veces del lado del
cliente.

## Superficie tocada (mapa completo, de la exploración previa)

| Capa | Archivo | Cambio |
|---|---|---|
| Schema DB | `schema.prisma` | `detalle_venta.iva`, `ventas.iva_total` |
| Migración | `prisma/migrations/20260927170000_iva_sobre_ta/` | Aditiva, sin backfill |
| Cálculo del dinero | `saleTotals.js` | `TASA_IVA`, `calcularIva`, `precioProducto`, `datosFinancieros`, `recalcularVenta` |
| Inserts de venta | `sales.service.js` | 15 inserts → `...datosFinancieros(x)`; `NO_EDITABLES`; `listSales`; `_saleHeader` |
| Lectura de producto | `catalog/products.js` | 15 `PRODUCT_TRANSFORMS` ganan `iva: d.iva \|\| 0` |
| Validación | `products.schema.js` | Sin cambios — el IVA nunca llega en el body |
| Tasa (preview) | `frontend/src/utils/iva.ts` (nuevo) | `TASA_IVA`, `calcularIva` |
| Motor del resumen | `useSaleCalculations.ts` | `calcIva`, `calcTotal` incluye IVA, se escribe `form.iva` |
| Tipos | `types/index.tsx` | `Sale.iva?`, tipo del form agregado del asistente |
| Resumen del asistente | `Step2Products.tsx` | Cuarta cifra "IVA" en el banner |
| Comisión y ganancia | `Step3Payment.tsx`, `SaleDetailModal.tsx`, `SalePaymentsModal.tsx` | Ganancia = `ta − comisión` en los 3; comisión sin cambios |
| Precio por línea | `ServiceRow.tsx` | Fallback incluye `iva` cuando no hay `subtotal` explícito |

## Lo que NO se toca, y por qué

- `VoucherPDF.tsx`, `commissions.service.js` (backend nunca deriva comisión de `ta`), las 15
  interfaces de producto y las 15 factories de `wizardData.ts` (el IVA es un total de venta, no un
  campo por producto), los 4 formularios sin `FinancialSection` — ver decisión 8.

## Verificación

1. `pnpm db:generate` en `backend/` tras la migración.
2. `pnpm check:prisma` — limpio.
3. `pnpm test:aislamiento` — 15/15.
4. `pnpm build` en `frontend/` — el `tsc` atrapa los sitios donde falte el campo `iva` en los tipos
   tocados.
5. Manual, con una agencia de prueba desechable (patrón `verif-*`): crear una venta con un producto de
   un formulario que use `FinancialSection` y uno de los 4 que no (p. ej. Hotel), y comprobar los 8
   criterios de aceptación de `spec.md` (C1–C8).
