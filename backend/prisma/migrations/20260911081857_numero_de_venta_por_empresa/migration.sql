-- La numeración propia de cada agencia.
--
-- Las ventas que ya existen se numeran por orden de creación dentro de su
-- empresa: la más antigua es la 1. Así la agencia que ya usaba el sistema no ve
-- cambiar los números que ya conocía por unos aleatorios, solo pierde los huecos
-- que nunca fueron suyos.
-- AlterTable
ALTER TABLE "clientes" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "codigos_recuperacion" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "comisionistas" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "detalle_venta" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "liquidacion_ventas" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "liquidaciones_comision" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "logs_usuarios" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "metodos_pago" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "pagos_venta" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "paquete_asistencia_medica" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "paquete_hotel" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "paquete_proveedor" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "paquete_tarifas" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "paquete_vuelo" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "paquetes" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "pasajeros_detalle" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "permisos_rol" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "personas" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "prod_autos" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "prod_checkins" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "prod_eventos" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "prod_fincas" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "prod_hoteleria" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "prod_mascotas" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "prod_migracion" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "prod_pasaportes" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "prod_planes" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "prod_restaurantes" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "prod_seguros" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "prod_simcards" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "prod_tiqueteria" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "prod_tours" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "prod_visas" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "proveedores" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "responsables" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "roles" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "sesiones" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "tarjetas_agencia" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "tramos_vuelo" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "usuarios" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "ventas" ADD COLUMN     "numero" INTEGER,
ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- AlterTable
ALTER TABLE "ventas_mensuales" ALTER COLUMN "empresa_id" SET DEFAULT COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1);

-- CreateIndex
CREATE UNIQUE INDEX "ventas_empresa_id_numero_key" ON "ventas"("empresa_id", "numero");


-- Renumerado de lo que ya había, por empresa y por fecha de creación.
WITH ordenadas AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY empresa_id ORDER BY creado_at, id) AS n
    FROM ventas
)
UPDATE ventas v SET numero = o.n FROM ordenadas o WHERE v.id = o.id;
