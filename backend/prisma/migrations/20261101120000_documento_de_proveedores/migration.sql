-- Documento de los proveedores (spec 037, fase 0): el NIT (u otro documento) con que la agencia relaciona a
-- cada proveedor como tercero en su software contable, para el ingreso para terceros de la factura.
--
-- Puramente aditiva. Las dos columnas son opcionales —los proveedores sembrados por agencia (spec 030) no
-- traen documento— pero van juntas (CHECK). Se exigen al facturar, no al crear el proveedor.
-- `tipos_documento` es un catálogo global (sin `empresa_id`), así que la clave ajena es simple, como la de
-- `personas`. El único `(empresa_id, documento)` deja pasar varios NULL: en Postgres no chocan.

ALTER TABLE "proveedores" ADD COLUMN "tipo_documento_id" INTEGER;
ALTER TABLE "proveedores" ADD COLUMN "documento" TEXT;

ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_documento_completo_check"
  CHECK (("tipo_documento_id" IS NULL) = ("documento" IS NULL));

ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_tipo_documento_id_fkey"
  FOREIGN KEY ("tipo_documento_id") REFERENCES "tipos_documento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "proveedores_empresa_id_documento_key" ON "proveedores"("empresa_id", "documento");
CREATE INDEX "proveedores_tipo_documento_id_idx" ON "proveedores"("tipo_documento_id");
