-- Destinos de preferencia del cliente (spec 017): hasta 5 por cliente, en el orden en
-- que se añadieron; el de mayor `orden` es el reciente, copiado en
-- `clientes.destino_reciente` para filtrar y listar sin una subconsulta por fila (lo
-- escribe solo `clients.service.js`, en la misma transacción). Puramente aditiva.
--
-- Como el resto de tablas de inquilino: `empresa_id` por defecto SIN respaldo a otra
-- agencia (spec 001, T4), clave ajena con la empresa dentro (las comprobaciones de
-- clave ajena se saltan la RLS), RLS forzada y permisos solo para `app_nexus`.

ALTER TABLE "clientes" ADD COLUMN "destino_reciente" TEXT;

CREATE TABLE "cliente_destinos" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "destino" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empresa_id" INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer,

    CONSTRAINT "cliente_destinos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cliente_destinos_orden_check" CHECK ("orden" BETWEEN 1 AND 5)
);

CREATE INDEX "cliente_destinos_empresa_id_idx" ON "cliente_destinos"("empresa_id");
CREATE INDEX "cliente_destinos_cliente_id_idx" ON "cliente_destinos"("cliente_id");
CREATE UNIQUE INDEX "cliente_destinos_cliente_id_orden_key" ON "cliente_destinos"("cliente_id", "orden");

ALTER TABLE "cliente_destinos" ADD CONSTRAINT "cliente_destinos_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cliente_destinos" ADD CONSTRAINT "cliente_destinos_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cliente_destinos" ADD CONSTRAINT "cliente_destinos_cliente_id_empresa_fkey"
  FOREIGN KEY ("cliente_id", "empresa_id") REFERENCES "clientes" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "cliente_destinos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cliente_destinos" FORCE ROW LEVEL SECURITY;
CREATE POLICY empresa_aislada ON "cliente_destinos"
  USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

REVOKE ALL ON "cliente_destinos" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "cliente_destinos" TO app_nexus;
GRANT USAGE, SELECT ON SEQUENCE "cliente_destinos_id_seq" TO app_nexus;
