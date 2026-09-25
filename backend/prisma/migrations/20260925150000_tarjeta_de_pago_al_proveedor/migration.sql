-- La tarjeta con la que la agencia le pagó al proveedor de un producto.
--
-- El asistente de venta elige una TARJETA concreta ("Visa Empresa ****1234")
-- y `createSale` no la leía: el dato se perdía. La columna que había,
-- `metodo_pago_proveedor_id`, apunta a un método genérico y no puede decir qué
-- tarjeta fue. El método de la tarjeta sale de `tarjetas_agencia.metodo_pago_id`.
--
-- De `migrate diff` solo se toman la columna, su índice y su clave ajena. El
-- diff trae además `ALTER COLUMN "empresa_id" SET DEFAULT ... , 1)`, que
-- reintroduciría el respaldo a la empresa 1 que la spec 001 (T4) quitó: no se
-- aplica.
ALTER TABLE "detalle_venta" ADD COLUMN "tarjeta_proveedor_id" INTEGER;

CREATE INDEX "detalle_venta_tarjeta_proveedor_id_idx" ON "detalle_venta"("tarjeta_proveedor_id");

ALTER TABLE "detalle_venta" ADD CONSTRAINT "detalle_venta_tarjeta_proveedor_id_fkey"
  FOREIGN KEY ("tarjeta_proveedor_id") REFERENCES "tarjetas_agencia"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- La clave ajena con la empresa dentro, como las 53 de
-- `20260912223500_integridad_entre_empresas`: las comprobaciones de clave
-- ajena se saltan la RLS, y sin esto una línea podría apuntar a la tarjeta de
-- otra agencia. Necesita el único (id, empresa_id) en la tabla padre.
ALTER TABLE "tarjetas_agencia" ADD CONSTRAINT "tarjetas_agencia_id_empresa_id_key" UNIQUE ("id", "empresa_id");

ALTER TABLE "detalle_venta" ADD CONSTRAINT "detalle_venta_tarjeta_proveedor_id_empresa_fkey"
  FOREIGN KEY ("tarjeta_proveedor_id", "empresa_id") REFERENCES "tarjetas_agencia" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE SET NULL ("tarjeta_proveedor_id");
