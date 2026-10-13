-- Una cotización no es una venta: ningún campo es obligatorio mientras se cotiza,
-- ni siquiera el cliente (se exige recién al convertirla en venta, con la validación
-- normal de una venta). La clave ajena compuesta usa MATCH SIMPLE por defecto en
-- Postgres, así que no se comprueba cuando `cliente_id` es nula.
ALTER TABLE "cotizaciones" ALTER COLUMN "cliente_id" DROP NOT NULL;
