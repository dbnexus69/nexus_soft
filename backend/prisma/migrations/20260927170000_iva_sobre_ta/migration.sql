-- El IVA se cobra sobre la TA (el margen de la agencia), no sobre el costo
-- del proveedor. `ta`/`ta_total` ya alimentan métricas de ingresos reales
-- (dashboard, ranking de asesores, reparto de cartera): si el IVA se metiera
-- ahí, esas métricas quedarían infladas con dinero que no es ingreso de la
-- agencia, sino un impuesto que se traslada al Estado. Por eso el IVA vive en
-- un campo propio, espejo de cómo ya conviven `ta` y `costo_proveedor`.
--
-- Puramente aditiva, sin backfill: las filas existentes quedan en 0, que es
-- correcto — se crearon antes de que el sistema calculara IVA.
ALTER TABLE "detalle_venta" ADD COLUMN "iva" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "ventas" ADD COLUMN "iva_total" DOUBLE PRECISION DEFAULT 0;
