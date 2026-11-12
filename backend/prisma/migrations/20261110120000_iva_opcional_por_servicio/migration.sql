-- IVA opcional por servicio (spec 041): un interruptor por línea, no por venta/cotización entera.
--
-- `iva` sigue siendo el monto real (0 cuando está apagado, igual que si la TA fuera 0); esta columna
-- guarda la intención, para que al reabrir una cotización para editar el interruptor refleje lo que
-- el asesor eligió, sin tener que adivinarlo de si `iva` dio 0 (que también pasa con TA 0).
--
-- DEFAULT true: el comportamiento de siempre (todo lleva IVA), así que ninguna fila existente cambia.

ALTER TABLE "detalle_venta" ADD COLUMN "incluye_iva" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "detalle_cotizacion" ADD COLUMN "incluye_iva" BOOLEAN NOT NULL DEFAULT true;
