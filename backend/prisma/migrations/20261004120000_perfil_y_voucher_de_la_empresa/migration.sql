-- Perfil de la agencia y registro de vouchers enviados (spec 011, T1).
--
-- Las columnas de `empresas` son opcionales: ninguna agencia existente cambia, y el voucher usa los
-- términos por defecto mientras `voucher_terminos` sea NULL. `empresas` ya tiene RLS (`empresa_propia`),
-- así que cada agencia solo puede leer y escribir su propia fila.
--
-- De `migrate diff` se toman las columnas, la tabla, sus índices y sus claves ajenas. El `empresa_id`
-- por defecto va SIN el respaldo a la empresa 1 que trae el diff (lo quitó la spec 001, T4): un insert
-- fuera de contexto tiene que fallar, no caer en otra agencia.

ALTER TABLE "empresas" ADD COLUMN "direccion" TEXT,
ADD COLUMN "email_contacto" TEXT,
ADD COLUMN "nit" TEXT,
ADD COLUMN "sitio_web" TEXT,
ADD COLUMN "telefono" TEXT,
ADD COLUMN "voucher_pie" TEXT,
ADD COLUMN "voucher_terminos" JSONB;

CREATE TABLE "vouchers_venta" (
    "id" TEXT NOT NULL,
    "venta_id" INTEGER NOT NULL,
    "huella" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "enviado_a" TEXT NOT NULL,
    "enviado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviado_por_id" INTEGER,
    "empresa_id" INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer,

    CONSTRAINT "vouchers_venta_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vouchers_venta_empresa_id_idx" ON "vouchers_venta"("empresa_id");
CREATE INDEX "vouchers_venta_venta_id_idx" ON "vouchers_venta"("venta_id");

ALTER TABLE "vouchers_venta" ADD CONSTRAINT "vouchers_venta_venta_id_fkey"
  FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vouchers_venta" ADD CONSTRAINT "vouchers_venta_enviado_por_id_fkey"
  FOREIGN KEY ("enviado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vouchers_venta" ADD CONSTRAINT "vouchers_venta_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Las claves ajenas con la empresa dentro, como las de `20260912223500_integridad_entre_empresas`:
-- las comprobaciones de clave ajena se saltan la RLS, y sin esto un envío podría apuntar a la venta o
-- al usuario de otra agencia.
ALTER TABLE "vouchers_venta" ADD CONSTRAINT "vouchers_venta_venta_id_empresa_fkey"
  FOREIGN KEY ("venta_id", "empresa_id") REFERENCES "ventas" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "vouchers_venta" ADD CONSTRAINT "vouchers_venta_enviado_por_id_empresa_fkey"
  FOREIGN KEY ("enviado_por_id", "empresa_id") REFERENCES "usuarios" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE SET NULL ("enviado_por_id");

-- Aislamiento por agencia, igual que las demás tablas del negocio.
ALTER TABLE "vouchers_venta" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vouchers_venta" FORCE ROW LEVEL SECURITY;
CREATE POLICY empresa_aislada ON "vouchers_venta"
  USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

-- Solo la aplicación; nada para `anon` ni `authenticated` (20260924010000).
REVOKE ALL ON "vouchers_venta" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "vouchers_venta" TO app_nexus;
