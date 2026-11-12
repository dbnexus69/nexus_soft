# Plan — Spec 041, IVA opcional por servicio

**Stack:** igual que el resto (Express 5, Prisma 6, CommonJS; React 19 + TS). Sin dependencias nuevas.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `backend/prisma/migrations/<ts>_iva_opcional_por_servicio/migration.sql` | `incluye_iva BOOLEAN NOT NULL DEFAULT true` en `detalle_venta` y `detalle_cotizacion` |
| `backend/prisma/schema.prisma` | el campo en los dos modelos |
| `backend/src/services/saleTotals.js` | `calcularIva(ta, incluyeIva = true)`, `precioProducto`/`datosFinancieros` lo reciben y lo devuelven |
| `backend/src/schemas/products.schema.js` | `SOBRE.incluyeIva` (boolean opcional); `precioCuadra` calcula el esperado con el mismo valor |
| `backend/src/services/ventaProductos.js` | nada que tocar: `...datosFinancieros(x)` ya lo arrastra (línea 318) |
| `backend/src/services/quotes.service.js::lineasDe` | destructura `incluye_iva` de `datosFinancieros(item)` y lo agrega a la línea (línea 61-72) |
| `backend/src/services/voucher/plantilla.js` | `['IVA', ...]` del RESUMEN DE PAGO pasa de `'Incluido'` fijo a `dinero(venta.iva_total)` (o nada si es 0) |
| `frontend/src/components/sales/forms/VoucherField.tsx::FinancialSection` | el interruptor, junto al campo TA |
| `frontend/src/components/sales/forms/TicketForm.tsx`, `HotelForm.tsx`, `InsuranceForm.tsx`, `PlanForm.tsx` | mismo interruptor en su bloque financiero propio |
| `frontend/src/hooks/useSaleCalculations.ts` | la suma por línea y el total respetan `incluyeIva` |
| `frontend/src/types/index.tsx` | `incluyeIva?: boolean` en cada interfaz de producto (mismo patrón repetido que ya tiene `ta`/`supplierCost`, sin tipo base compartido) |

## Decisiones técnicas que no están en `spec.md`

- **No hace falta tocar `ventaProductos.js`:** ya hace `...datosFinancieros(x)` (spread), así que agregar
  `incluye_iva` al objeto que devuelve esa función alcanza. `quotes.service.js::lineasDe` sí destructura
  campo por campo — ahí hay que agregarlo a mano.
- **El JSON `detalle` de una cotización ya hace de respaldo para editar:** `resto` (todo menos `images`)
  se guarda tal cual, así que el `incluyeIva` que mandó el formulario ya viaja ahí y vuelve intacto al
  reabrir para editar — no hace falta fusionar la columna explícita de vuelta al JSON para eso. La
  columna `incluye_iva` es para lo que SÍ depende de la base: la suma de `iva_total` y, en una venta
  (`detalle_venta` no tiene JSON `detalle`), cualquier lectura posterior.
- **`SaleDetailModal.tsx`/`ServiceRow.tsx` no cambian:** ya muestran el IVA condicionalmente
  (`cifras.iva ? … : null`) y ya suman `ta + supplierCost + iva` de cada línea tal cual venga — un `iva`
  en 0 por el interruptor apagado ya se ve bien sin tocar nada ahí.
- **`precioCuadra` (spec 039, H6)** valida que un `total`/`subtotal` explícito cuadre con
  `ta + supplierCost + calcularIva(ta)`; tiene que usar el mismo `incluyeIva` de la línea o rechazaría
  un total correcto sin IVA.
