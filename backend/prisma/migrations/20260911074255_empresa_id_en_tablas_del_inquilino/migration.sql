-- Cada tabla del inquilino gana su empresa_id.
--
-- Prisma genera "ADD COLUMN empresa_id INTEGER NOT NULL", que sobre una tabla
-- con filas falla: no hay valor para las que ya están. Se parte en tres pasos
-- —columna opcional, relleno, y ya entonces obligatoria— que es justo lo que
-- `db push` no sabe expresar y por lo que este repo estrena migraciones.
--
-- El relleno es 1 porque hoy solo hay una agencia usando el sistema, la que ya
-- estaba: todos sus datos le pertenecen.
--
-- Las claves ajenas van al final, cuando ninguna fila tiene ya el valor nulo.

-- DropIndex
DROP INDEX "metodos_pago_nombre_key";

-- DropIndex
DROP INDEX "personas_documento_key";

-- DropIndex
DROP INDEX "roles_nombre_key";

-- DropIndex
DROP INDEX "ventas_mensuales_year_month_key";

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "clientes" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "clientes" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "codigos_recuperacion" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "codigos_recuperacion" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "codigos_recuperacion" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "comisionistas" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "comisionistas" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "comisionistas" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "detalle_venta" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "detalle_venta" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "detalle_venta" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "liquidacion_ventas" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "liquidacion_ventas" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "liquidacion_ventas" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "liquidaciones_comision" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "liquidaciones_comision" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "liquidaciones_comision" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "logs_usuarios" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "logs_usuarios" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "logs_usuarios" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "metodos_pago" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "metodos_pago" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "metodos_pago" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "pagos_venta" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "pagos_venta" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "pagos_venta" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "paquete_asistencia_medica" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "paquete_asistencia_medica" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "paquete_asistencia_medica" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "paquete_hotel" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "paquete_hotel" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "paquete_hotel" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "paquete_proveedor" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "paquete_proveedor" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "paquete_proveedor" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "paquete_tarifas" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "paquete_tarifas" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "paquete_tarifas" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "paquete_vuelo" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "paquete_vuelo" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "paquete_vuelo" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "paquetes" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "paquetes" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "paquetes" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "pasajeros_detalle" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "pasajeros_detalle" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "pasajeros_detalle" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "permisos_rol" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "permisos_rol" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "permisos_rol" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "personas" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "personas" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "personas" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "prod_autos" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "prod_autos" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "prod_autos" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "prod_checkins" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "prod_checkins" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "prod_checkins" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "prod_eventos" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "prod_eventos" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "prod_eventos" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "prod_fincas" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "prod_fincas" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "prod_fincas" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "prod_hoteleria" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "prod_hoteleria" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "prod_hoteleria" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "prod_mascotas" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "prod_mascotas" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "prod_mascotas" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "prod_migracion" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "prod_migracion" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "prod_migracion" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "prod_pasaportes" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "prod_pasaportes" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "prod_pasaportes" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "prod_planes" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "prod_planes" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "prod_planes" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "prod_restaurantes" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "prod_restaurantes" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "prod_restaurantes" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "prod_seguros" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "prod_seguros" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "prod_seguros" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "prod_simcards" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "prod_simcards" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "prod_simcards" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "prod_tiqueteria" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "prod_tiqueteria" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "prod_tiqueteria" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "prod_tours" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "prod_tours" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "prod_tours" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "prod_visas" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "prod_visas" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "prod_visas" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "proveedores" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "proveedores" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "proveedores" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "responsables" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "responsables" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "responsables" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "roles" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "roles" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "sesiones" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "sesiones" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "sesiones" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "tarjetas_agencia" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "tarjetas_agencia" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "tarjetas_agencia" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "tramos_vuelo" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "tramos_vuelo" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "tramos_vuelo" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "usuarios" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "usuarios" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "ventas" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "ventas" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "ventas" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "ventas_mensuales" ADD COLUMN     "empresa_id" INTEGER;
UPDATE "ventas_mensuales" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
ALTER TABLE "ventas_mensuales" ALTER COLUMN "empresa_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "clientes_empresa_id_idx" ON "clientes"("empresa_id");

-- CreateIndex
CREATE INDEX "codigos_recuperacion_empresa_id_idx" ON "codigos_recuperacion"("empresa_id");

-- CreateIndex
CREATE INDEX "comisionistas_empresa_id_idx" ON "comisionistas"("empresa_id");

-- CreateIndex
CREATE INDEX "detalle_venta_empresa_id_idx" ON "detalle_venta"("empresa_id");

-- CreateIndex
CREATE INDEX "liquidacion_ventas_empresa_id_idx" ON "liquidacion_ventas"("empresa_id");

-- CreateIndex
CREATE INDEX "liquidaciones_comision_empresa_id_idx" ON "liquidaciones_comision"("empresa_id");

-- CreateIndex
CREATE INDEX "logs_usuarios_empresa_id_idx" ON "logs_usuarios"("empresa_id");

-- CreateIndex
CREATE INDEX "metodos_pago_empresa_id_idx" ON "metodos_pago"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "metodos_pago_empresa_id_nombre_key" ON "metodos_pago"("empresa_id", "nombre");

-- CreateIndex
CREATE INDEX "pagos_venta_empresa_id_idx" ON "pagos_venta"("empresa_id");

-- CreateIndex
CREATE INDEX "paquete_asistencia_medica_empresa_id_idx" ON "paquete_asistencia_medica"("empresa_id");

-- CreateIndex
CREATE INDEX "paquete_hotel_empresa_id_idx" ON "paquete_hotel"("empresa_id");

-- CreateIndex
CREATE INDEX "paquete_proveedor_empresa_id_idx" ON "paquete_proveedor"("empresa_id");

-- CreateIndex
CREATE INDEX "paquete_tarifas_empresa_id_idx" ON "paquete_tarifas"("empresa_id");

-- CreateIndex
CREATE INDEX "paquete_vuelo_empresa_id_idx" ON "paquete_vuelo"("empresa_id");

-- CreateIndex
CREATE INDEX "paquetes_empresa_id_idx" ON "paquetes"("empresa_id");

-- CreateIndex
CREATE INDEX "pasajeros_detalle_empresa_id_idx" ON "pasajeros_detalle"("empresa_id");

-- CreateIndex
CREATE INDEX "permisos_rol_empresa_id_idx" ON "permisos_rol"("empresa_id");

-- CreateIndex
CREATE INDEX "personas_empresa_id_idx" ON "personas"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "personas_empresa_id_documento_key" ON "personas"("empresa_id", "documento");

-- CreateIndex
CREATE INDEX "prod_autos_empresa_id_idx" ON "prod_autos"("empresa_id");

-- CreateIndex
CREATE INDEX "prod_checkins_empresa_id_idx" ON "prod_checkins"("empresa_id");

-- CreateIndex
CREATE INDEX "prod_eventos_empresa_id_idx" ON "prod_eventos"("empresa_id");

-- CreateIndex
CREATE INDEX "prod_fincas_empresa_id_idx" ON "prod_fincas"("empresa_id");

-- CreateIndex
CREATE INDEX "prod_hoteleria_empresa_id_idx" ON "prod_hoteleria"("empresa_id");

-- CreateIndex
CREATE INDEX "prod_mascotas_empresa_id_idx" ON "prod_mascotas"("empresa_id");

-- CreateIndex
CREATE INDEX "prod_migracion_empresa_id_idx" ON "prod_migracion"("empresa_id");

-- CreateIndex
CREATE INDEX "prod_pasaportes_empresa_id_idx" ON "prod_pasaportes"("empresa_id");

-- CreateIndex
CREATE INDEX "prod_planes_empresa_id_idx" ON "prod_planes"("empresa_id");

-- CreateIndex
CREATE INDEX "prod_restaurantes_empresa_id_idx" ON "prod_restaurantes"("empresa_id");

-- CreateIndex
CREATE INDEX "prod_seguros_empresa_id_idx" ON "prod_seguros"("empresa_id");

-- CreateIndex
CREATE INDEX "prod_simcards_empresa_id_idx" ON "prod_simcards"("empresa_id");

-- CreateIndex
CREATE INDEX "prod_tiqueteria_empresa_id_idx" ON "prod_tiqueteria"("empresa_id");

-- CreateIndex
CREATE INDEX "prod_tours_empresa_id_idx" ON "prod_tours"("empresa_id");

-- CreateIndex
CREATE INDEX "prod_visas_empresa_id_idx" ON "prod_visas"("empresa_id");

-- CreateIndex
CREATE INDEX "proveedores_empresa_id_idx" ON "proveedores"("empresa_id");

-- CreateIndex
CREATE INDEX "responsables_empresa_id_idx" ON "responsables"("empresa_id");

-- CreateIndex
CREATE INDEX "roles_empresa_id_idx" ON "roles"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_empresa_id_nombre_key" ON "roles"("empresa_id", "nombre");

-- CreateIndex
CREATE INDEX "sesiones_empresa_id_idx" ON "sesiones"("empresa_id");

-- CreateIndex
CREATE INDEX "tarjetas_agencia_empresa_id_idx" ON "tarjetas_agencia"("empresa_id");

-- CreateIndex
CREATE INDEX "tramos_vuelo_empresa_id_idx" ON "tramos_vuelo"("empresa_id");

-- CreateIndex
CREATE INDEX "usuarios_empresa_id_idx" ON "usuarios"("empresa_id");

-- CreateIndex
CREATE INDEX "ventas_empresa_id_idx" ON "ventas"("empresa_id");

-- CreateIndex
CREATE INDEX "ventas_mensuales_empresa_id_idx" ON "ventas_mensuales"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "ventas_mensuales_empresa_id_year_month_key" ON "ventas_mensuales"("empresa_id", "year", "month");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comisionistas" ADD CONSTRAINT "comisionistas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_venta" ADD CONSTRAINT "detalle_venta_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_ventas" ADD CONSTRAINT "liquidacion_ventas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones_comision" ADD CONSTRAINT "liquidaciones_comision_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_usuarios" ADD CONSTRAINT "logs_usuarios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metodos_pago" ADD CONSTRAINT "metodos_pago_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_venta" ADD CONSTRAINT "pagos_venta_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paquete_asistencia_medica" ADD CONSTRAINT "paquete_asistencia_medica_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paquete_hotel" ADD CONSTRAINT "paquete_hotel_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paquete_proveedor" ADD CONSTRAINT "paquete_proveedor_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paquete_tarifas" ADD CONSTRAINT "paquete_tarifas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paquete_vuelo" ADD CONSTRAINT "paquete_vuelo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paquetes" ADD CONSTRAINT "paquetes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pasajeros_detalle" ADD CONSTRAINT "pasajeros_detalle_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permisos_rol" ADD CONSTRAINT "permisos_rol_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_autos" ADD CONSTRAINT "prod_autos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_checkins" ADD CONSTRAINT "prod_checkins_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_eventos" ADD CONSTRAINT "prod_eventos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_fincas" ADD CONSTRAINT "prod_fincas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_hoteleria" ADD CONSTRAINT "prod_hoteleria_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_mascotas" ADD CONSTRAINT "prod_mascotas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_migracion" ADD CONSTRAINT "prod_migracion_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_pasaportes" ADD CONSTRAINT "prod_pasaportes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_planes" ADD CONSTRAINT "prod_planes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_restaurantes" ADD CONSTRAINT "prod_restaurantes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_seguros" ADD CONSTRAINT "prod_seguros_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_simcards" ADD CONSTRAINT "prod_simcards_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_tiqueteria" ADD CONSTRAINT "prod_tiqueteria_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_tours" ADD CONSTRAINT "prod_tours_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_visas" ADD CONSTRAINT "prod_visas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responsables" ADD CONSTRAINT "responsables_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_recuperacion" ADD CONSTRAINT "codigos_recuperacion_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarjetas_agencia" ADD CONSTRAINT "tarjetas_agencia_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramos_vuelo" ADD CONSTRAINT "tramos_vuelo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_mensuales" ADD CONSTRAINT "ventas_mensuales_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

