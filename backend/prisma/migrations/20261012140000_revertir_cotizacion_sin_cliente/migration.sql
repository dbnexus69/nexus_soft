-- Revierte la migración `20261012130000_cotizacion_sin_cliente_obligatorio`: el usuario
-- pidió deshacer ese cambio (spec 007) y volver a exigir el cliente en toda cotización.
-- Sin filas con `cliente_id` nulo en este momento (comprobado antes de aplicarla).
ALTER TABLE "cotizaciones" ALTER COLUMN "cliente_id" SET NOT NULL;
