-- Cotizaciones a clientes (spec 007). Línea simple: categoría, descripción, costo de
-- proveedor y ganancia por separado; sin tabla por categoría, sin tramos ni pasajeros.
-- No toca ninguna tabla existente — puramente aditiva.
--
-- De `migrate diff` se toman el enum, las tablas, sus índices y las claves ajenas
-- simples. El resto se escribe a mano, como en el resto de tablas de inquilino:
-- - El `empresa_id` por defecto va SIN el respaldo a la empresa 1 que trae el diff (lo
--   quitó la spec 001, T4): un insert fuera de contexto tiene que fallar, no caer en
--   otra agencia.
-- - Las claves ajenas con la empresa dentro, como las de `20260912223500_integridad_
--   entre_empresas`: las comprobaciones de clave ajena se saltan la RLS, y sin esto una
--   cotización podría apuntar al cliente, al usuario o a la venta de otra agencia.
-- - RLS y el disparador de numeración (`app_asignar_numero()`, ya genérico — no se toca).

-- CreateEnum
CREATE TYPE "CotizacionEstado" AS ENUM ('borrador', 'enviada', 'aceptada', 'rechazada');

-- CreateTable
CREATE TABLE "cotizaciones" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER,
    "cliente_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "estado" "CotizacionEstado" NOT NULL DEFAULT 'borrador',
    "fecha_vencimiento" TIMESTAMP(3),
    "observaciones" TEXT,
    "venta_id" INTEGER,
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "empresa_id" INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer,

    CONSTRAINT "cotizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalle_cotizacion" (
    "id" TEXT NOT NULL,
    "cotizacion_id" INTEGER NOT NULL,
    "categoria" "ProductCategory" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "costo_proveedor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "iva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empresa_id" INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer,

    CONSTRAINT "detalle_cotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cotizaciones_empresa_id_idx" ON "cotizaciones"("empresa_id");
CREATE INDEX "cotizaciones_cliente_id_idx" ON "cotizaciones"("cliente_id");
CREATE INDEX "cotizaciones_usuario_id_idx" ON "cotizaciones"("usuario_id");
CREATE UNIQUE INDEX "cotizaciones_empresa_id_numero_key" ON "cotizaciones"("empresa_id", "numero");
-- Necesario para que detalle_cotizacion pueda apuntar a esta fila con su empresa dentro.
CREATE UNIQUE INDEX "cotizaciones_id_empresa_id_key" ON "cotizaciones"("id", "empresa_id");

CREATE INDEX "detalle_cotizacion_empresa_id_idx" ON "detalle_cotizacion"("empresa_id");
CREATE INDEX "detalle_cotizacion_cotizacion_id_idx" ON "detalle_cotizacion"("cotizacion_id");
CREATE UNIQUE INDEX "detalle_cotizacion_id_empresa_id_key" ON "detalle_cotizacion"("id", "empresa_id");

-- AddForeignKey (simples, de `migrate diff`)
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_venta_id_fkey"
  FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "detalle_cotizacion" ADD CONSTRAINT "detalle_cotizacion_cotizacion_id_fkey"
  FOREIGN KEY ("cotizacion_id") REFERENCES "cotizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "detalle_cotizacion" ADD CONSTRAINT "detalle_cotizacion_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (compuestas, con la empresa dentro — ver nota de arriba)
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_cliente_id_empresa_fkey"
  FOREIGN KEY ("cliente_id", "empresa_id") REFERENCES "clientes" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_usuario_id_empresa_fkey"
  FOREIGN KEY ("usuario_id", "empresa_id") REFERENCES "usuarios" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_venta_id_empresa_fkey"
  FOREIGN KEY ("venta_id", "empresa_id") REFERENCES "ventas" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE SET NULL ("venta_id");
ALTER TABLE "detalle_cotizacion" ADD CONSTRAINT "detalle_cotizacion_cotizacion_id_empresa_fkey"
  FOREIGN KEY ("cotizacion_id", "empresa_id") REFERENCES "cotizaciones" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- Numeración por agencia, igual que `ventas` (el disparador ya es genérico, vía TG_TABLE_NAME).
CREATE TRIGGER cotizaciones_numero BEFORE INSERT ON "cotizaciones"
  FOR EACH ROW EXECUTE FUNCTION app_asignar_numero();

-- Aislamiento por agencia, igual que las demás tablas del negocio.
ALTER TABLE "cotizaciones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cotizaciones" FORCE ROW LEVEL SECURITY;
CREATE POLICY empresa_aislada ON "cotizaciones"
  USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "detalle_cotizacion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "detalle_cotizacion" FORCE ROW LEVEL SECURITY;
CREATE POLICY empresa_aislada ON "detalle_cotizacion"
  USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

-- Solo la aplicación; nada para `anon` ni `authenticated` (20260924010000).
REVOKE ALL ON "cotizaciones" FROM anon, authenticated;
REVOKE ALL ON "detalle_cotizacion" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "cotizaciones" TO app_nexus;
GRANT SELECT, INSERT, UPDATE, DELETE ON "detalle_cotizacion" TO app_nexus;
