-- Responsables con dueño (spec 026): quién lo creó, para que el alcance 'own' en
-- responsables muestre y deje editar solo los suyos. Puramente aditiva: los que ya
-- existen quedan sin dueño (solo los ve quien tiene 'all').
--
-- Dos claves ajenas, como `clientes.creado_por_id`: la simple que describe el modelo de
-- Prisma y la compuesta con la empresa dentro (las comprobaciones de clave ajena se
-- saltan la RLS). `SET NULL` nombra la columna: a secas anularía también `empresa_id`.
-- Sin permisos nuevos: la tabla ya los tiene.

ALTER TABLE "responsables" ADD COLUMN "creado_por_id" INTEGER;

CREATE INDEX "responsables_creado_por_id_idx" ON "responsables"("creado_por_id");

ALTER TABLE "responsables" ADD CONSTRAINT "responsables_creado_por_id_fkey"
  FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "responsables" ADD CONSTRAINT "responsables_creado_por_id_empresa_fkey"
  FOREIGN KEY ("creado_por_id", "empresa_id") REFERENCES "usuarios" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE SET NULL ("creado_por_id");
