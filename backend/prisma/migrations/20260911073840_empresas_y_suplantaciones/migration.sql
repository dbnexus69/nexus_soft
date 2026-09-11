-- CreateEnum
CREATE TYPE "EstadoEmpresa" AS ENUM ('activa', 'suspendida');

-- CreateTable
CREATE TABLE "empresas" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombre_comercial" TEXT,
    "logo_url" TEXT,
    "color_primario" TEXT,
    "color_acento" TEXT,
    "color_realce" TEXT,
    "email_remitente" TEXT,
    "email_nombre" TEXT,
    "estado" "EstadoEmpresa" NOT NULL DEFAULT 'activa',
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suplantaciones" (
    "id" TEXT NOT NULL,
    "superadmin_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "iniciada_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_at" TIMESTAMP(3) NOT NULL,
    "terminada_at" TIMESTAMP(3),
    "ip" TEXT,

    CONSTRAINT "suplantaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresas_slug_key" ON "empresas"("slug");

-- CreateIndex
CREATE INDEX "suplantaciones_empresa_id_idx" ON "suplantaciones"("empresa_id");

-- CreateIndex
CREATE INDEX "suplantaciones_superadmin_id_idx" ON "suplantaciones"("superadmin_id");

-- AddForeignKey
ALTER TABLE "suplantaciones" ADD CONSTRAINT "suplantaciones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suplantaciones" ADD CONSTRAINT "suplantaciones_superadmin_id_fkey" FOREIGN KEY ("superadmin_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

