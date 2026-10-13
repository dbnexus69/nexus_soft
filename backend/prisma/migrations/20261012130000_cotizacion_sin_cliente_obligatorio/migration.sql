-- El cliente de una cotización ya no es obligatorio (spec 007, tercera replanificación):
-- se cotiza el servicio sin atarlo a un cliente, para poder reutilizar la misma
-- cotización con cualquiera; el cliente se elige solo al convertirla en venta. La clave
-- ajena compuesta (`cotizaciones_cliente_id_empresa_fkey`, MATCH SIMPLE por defecto en
-- Postgres) ya no se comprueba cuando `cliente_id` es nula, así que no hace falta
-- tocarla.
ALTER TABLE "cotizaciones" ALTER COLUMN "cliente_id" DROP NOT NULL;
