-- Tope diario de búsquedas de vuelos en vivo por agencia (spec 039): la clave de SearchApi es
-- única y la paga DBNEXUS, así que el tope es lo único que evita que una agencia dispare el costo
-- de todas. Puramente aditiva.
--
-- Como el resto de tablas de inquilino: `empresa_id` por defecto sin respaldo a otra agencia,
-- RLS forzada y permisos solo para `app_nexus`. Sin clave ajena a ningún padre de negocio —no
-- cuelga de nada más que de la agencia y el día.

CREATE TABLE "busquedas_vuelos_contador" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 0,
    "empresa_id" INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer,

    CONSTRAINT "busquedas_vuelos_contador_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "busquedas_vuelos_contador_empresa_id_fecha_key" ON "busquedas_vuelos_contador"("empresa_id", "fecha");

ALTER TABLE "busquedas_vuelos_contador" ADD CONSTRAINT "busquedas_vuelos_contador_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "busquedas_vuelos_contador" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "busquedas_vuelos_contador" FORCE ROW LEVEL SECURITY;
CREATE POLICY empresa_aislada ON "busquedas_vuelos_contador"
  USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

REVOKE ALL ON "busquedas_vuelos_contador" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "busquedas_vuelos_contador" TO app_nexus;
GRANT USAGE, SELECT ON SEQUENCE "busquedas_vuelos_contador_id_seq" TO app_nexus;
