-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('ticket', 'hotel', 'insurance', 'plan', 'checkin', 'migration', 'simcard', 'car', 'finca', 'tour', 'convention', 'restaurant', 'visa', 'passport', 'pet');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('Activo', 'Inactivo');

-- CreateEnum
CREATE TYPE "CheckinStatus" AS ENUM ('pendiente', 'realizado', 'critico', 'cancelado');

-- CreateEnum
CREATE TYPE "Cobertura" AS ENUM ('Nacional', 'Internacional', 'Ambos');

-- CreateEnum
CREATE TYPE "EstadoPaquete" AS ENUM ('activo', 'inactivo', 'agotado');

-- CreateEnum
CREATE TYPE "FlightMode" AS ENUM ('one_way', 'round_trip');

-- CreateEnum
CREATE TYPE "RegimenAlimenticio" AS ENUM ('solo_desayuno', 'media_pension', 'todo_incluido', 'full', 'sin_alimentacion');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('credito', 'abonado', 'pagado', 'anulado');

-- CreateEnum
CREATE TYPE "TamanoMascota" AS ENUM ('pequeno', 'mediano', 'grande', 'gigante');

-- CreateEnum
CREATE TYPE "TipoHotel" AS ENUM ('hotel', 'resort', 'boutique', 'apartamento', 'hostal', 'fincas');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive');

-- CreateTable
CREATE TABLE "aerolineas" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo_iata" TEXT,
    "tipo" "Cobertura" NOT NULL DEFAULT 'Internacional',
    "web" TEXT,

    CONSTRAINT "aerolineas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aeropuertos" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo_iata" TEXT NOT NULL,
    "ciudad" TEXT,
    "pais" TEXT,
    "tipo" "Cobertura" NOT NULL DEFAULT 'Ambos',
    "status" "UserStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "aeropuertos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" SERIAL NOT NULL,
    "persona_id" INTEGER NOT NULL,
    "creado_por_id" INTEGER,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comisionistas" (
    "id" SERIAL NOT NULL,
    "persona_id" INTEGER NOT NULL,
    "tipo" TEXT,
    "umbral_pago" DOUBLE PRECISION DEFAULT 0,
    "acumulado" DOUBLE PRECISION DEFAULT 0,
    "status" "AgentStatus" NOT NULL DEFAULT 'Activo',
    "banco" TEXT,
    "tipo_cuenta" TEXT,
    "numero_cuenta" TEXT,
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comisionistas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalle_venta" (
    "id" TEXT NOT NULL,
    "venta_id" INTEGER NOT NULL,
    "categoria" "ProductCategory" NOT NULL,
    "nombre_servicio" TEXT,
    "subtotal" DOUBLE PRECISION DEFAULT 0,
    "ta" DOUBLE PRECISION DEFAULT 0,
    "costo_proveedor" DOUBLE PRECISION DEFAULT 0,
    "proveedor_id" INTEGER,
    "metodo_pago_proveedor_id" INTEGER,
    "voucher_url" TEXT,
    "fecha_inicio_viaje" TIMESTAMP(3),
    "fecha_fin_viaje" TIMESTAMP(3),
    "origen" TEXT,
    "destino" TEXT,
    "observaciones" TEXT,
    "creado_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "parent_detalle_id" TEXT,

    CONSTRAINT "detalle_venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidacion_ventas" (
    "id" SERIAL NOT NULL,
    "liquidacion_id" INTEGER NOT NULL,
    "venta_id" INTEGER NOT NULL,

    CONSTRAINT "liquidacion_ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidaciones_comision" (
    "id" SERIAL NOT NULL,
    "comisionista_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "metodo_pago_id" INTEGER,
    "referencia" TEXT,
    "notas" TEXT,
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liquidaciones_comision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_usuarios" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "accion" TEXT,
    "modulo" TEXT,
    "descripcion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metodos_pago" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "metodos_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_venta" (
    "id" TEXT NOT NULL,
    "venta_id" INTEGER NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "metodo_pago_id" INTEGER,
    "referencia" TEXT,
    "fecha_pago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paquete_asistencia_medica" (
    "id" SERIAL NOT NULL,
    "paquete_id" INTEGER NOT NULL,
    "cobertura_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dias_cobertura" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "paquete_asistencia_medica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paquete_hotel" (
    "id" SERIAL NOT NULL,
    "paquete_id" INTEGER NOT NULL,
    "hotel_nombre" TEXT NOT NULL,
    "tipo_hotel" "TipoHotel" DEFAULT 'hotel',
    "regimen" "RegimenAlimenticio" DEFAULT 'full',
    "noches" INTEGER,

    CONSTRAINT "paquete_hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paquete_proveedor" (
    "id" SERIAL NOT NULL,
    "paquete_id" INTEGER NOT NULL,
    "proveedor_id" INTEGER NOT NULL,

    CONSTRAINT "paquete_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paquete_tarifas" (
    "id" SERIAL NOT NULL,
    "paquete_id" INTEGER NOT NULL,
    "tarifa_adulto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tarifa_menor" DOUBLE PRECISION,
    "vigencia_desde" TIMESTAMP(3),
    "vigencia_hasta" TIMESTAMP(3),

    CONSTRAINT "paquete_tarifas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paquete_vuelo" (
    "id" SERIAL NOT NULL,
    "paquete_id" INTEGER NOT NULL,
    "aerolinea_id" INTEGER,
    "nro_vuelo" TEXT,
    "modo_vuelo" "FlightMode" DEFAULT 'round_trip',
    "trayectos" JSONB,
    "plan_equipaje" TEXT,
    "tipo_transporte" TEXT DEFAULT 'Aereo',

    CONSTRAINT "paquete_vuelo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paquetes" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "servicios_incluidos" TEXT,
    "no_incluido" TEXT,
    "status" "EstadoPaquete" NOT NULL DEFAULT 'activo',
    "creado_por_id" INTEGER,
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "paquetes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pasajeros_detalle" (
    "id" TEXT NOT NULL,
    "detalle_venta_id" TEXT NOT NULL,
    "persona_id" INTEGER NOT NULL,
    "es_titular" BOOLEAN DEFAULT false,
    "asiento" TEXT,
    "nro_reserva" TEXT,
    "nro_tiquete" TEXT,
    "nota" TEXT,

    CONSTRAINT "pasajeros_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos" (
    "id" SERIAL NOT NULL,
    "modulo" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos_rol" (
    "id" SERIAL NOT NULL,
    "rol_id" INTEGER NOT NULL,
    "permiso_id" INTEGER NOT NULL,
    "valor" TEXT NOT NULL DEFAULT 'true',

    CONSTRAINT "permisos_rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personas" (
    "id" SERIAL NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "tipo_documento_id" INTEGER,
    "documento" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "birth_date" TIMESTAMP(3),
    "nacionalidad" TEXT,
    "avatar_url" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "politicas_equipaje" (
    "id" SERIAL NOT NULL,
    "aerolinea_id" INTEGER NOT NULL,
    "tipo_tarifa" TEXT NOT NULL,
    "articulo_personal" TEXT,
    "equipaje_mano" TEXT,
    "equipaje_bodega" TEXT,
    "notas" TEXT,

    CONSTRAINT "politicas_equipaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod_autos" (
    "id" TEXT NOT NULL,
    "detalle_venta_id" TEXT NOT NULL,
    "conductor_nombre" TEXT,
    "licencia_nro" TEXT,
    "fecha_recogida" TIMESTAMP(3),
    "fecha_devolucion" TIMESTAMP(3),
    "lugar_recogida" TEXT,
    "categoria_auto" TEXT,
    "conductores_adicionales" INTEGER DEFAULT 0,
    "tipo_seguro" TEXT,
    "tarjeta_garantia_info" TEXT,

    CONSTRAINT "prod_autos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod_checkins" (
    "id" TEXT NOT NULL,
    "detalle_venta_id" TEXT NOT NULL,
    "nro_vuelo_reserva" TEXT,
    "fecha_viaje" TIMESTAMP(3),
    "asiento" TEXT,
    "maletas_contadas" TEXT,
    "telefono_contacto" TEXT,
    "necesidades_especiales" TEXT,
    "usa_silla_ruedas" BOOLEAN DEFAULT false,

    CONSTRAINT "prod_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod_eventos" (
    "id" TEXT NOT NULL,
    "detalle_venta_id" TEXT NOT NULL,
    "organizacion" TEXT,
    "nombre_contacto" TEXT,
    "email_contacto" TEXT,
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "asistencia_estimada" INTEGER,
    "espacio_requerido" TEXT,
    "tipo_evento" TEXT,
    "equipos_av" TEXT,
    "requiere_catering" BOOLEAN DEFAULT false,
    "notas_catering" TEXT,
    "ciudad" VARCHAR(40),
    "direccion" VARCHAR(40),
    "nombre_lugar" VARCHAR(40),

    CONSTRAINT "prod_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod_fincas" (
    "id" TEXT NOT NULL,
    "detalle_venta_id" TEXT NOT NULL,
    "responsable_nombre" TEXT,
    "documento_responsable" TEXT,
    "fecha_entrada" TIMESTAMP(3),
    "fecha_salida" TIMESTAMP(3),
    "adultos_count" INTEGER,
    "ninos_count" INTEGER,
    "tiene_mascotas" BOOLEAN DEFAULT false,
    "tipo_mascota" TEXT,
    "servicios_extra" TEXT,
    "nombre_finca" TEXT,
    "direccion_finca" TEXT,
    "ciudad_pueblo" TEXT,
    "observaciones" TEXT,

    CONSTRAINT "prod_fincas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod_hoteleria" (
    "id" TEXT NOT NULL,
    "detalle_venta_id" TEXT NOT NULL,
    "hotel_nombre" TEXT,
    "tipo_hotel" "TipoHotel" DEFAULT 'hotel',
    "destino" TEXT,
    "nro_reserva" TEXT,
    "fecha_entrada" TIMESTAMP(3),
    "fecha_salida" TIMESTAMP(3),
    "observaciones" TEXT,

    CONSTRAINT "prod_hoteleria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod_mascotas" (
    "id" TEXT NOT NULL,
    "detalle_venta_id" TEXT NOT NULL,
    "mascota_nombre" TEXT,
    "especie" TEXT,
    "raza" TEXT,
    "peso_kg" DOUBLE PRECISION,
    "tamanoMascota" "TamanoMascota",
    "transporte_tipo" TEXT,
    "fecha_viaje" TIMESTAMP(3),
    "pais_destino" TEXT,
    "condiciones_medicas" TEXT,
    "telefono_contacto" TEXT,
    "empresa_transporte" TEXT,
    "observaciones" TEXT,

    CONSTRAINT "prod_mascotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod_migracion" (
    "id" TEXT NOT NULL,
    "detalle_venta_id" TEXT NOT NULL,
    "tipo_tramite_migratorio" TEXT,
    "nacionalidad" TEXT,
    "tipo_documento" TEXT DEFAULT 'Pasaporte',
    "pasaporte_nro" TEXT,
    "pasaporte_vence" TIMESTAMP(3),
    "pais_destino" TEXT,

    CONSTRAINT "prod_migracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod_pasaportes" (
    "id" TEXT NOT NULL,
    "detalle_venta_id" TEXT NOT NULL,
    "nombre_completo" TEXT,
    "nro_documento" TEXT,
    "fecha_nacimiento" TIMESTAMP(3),
    "ciudad_residencia" TEXT,
    "tipo_tramite" TEXT,
    "fecha_estimada_viaje" TIMESTAMP(3),
    "telefono_contacto" TEXT,

    CONSTRAINT "prod_pasaportes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod_planes" (
    "id" TEXT NOT NULL,
    "detalle_venta_id" TEXT NOT NULL,
    "paqueteId" INTEGER,
    "paquete_tarifa_id" INTEGER,
    "nombre_plan" TEXT,
    "nombre_hotel" TEXT,
    "aerolineaId" INTEGER,
    "nro_vuelo" TEXT,
    "nro_reserva" TEXT,
    "nro_tiquete" TEXT,
    "fecha_viaje_inicio" TIMESTAMP(3),
    "fecha_viaje_fin" TIMESTAMP(3),
    "fecha_salida_vuelo" TIMESTAMP(3),
    "fecha_llegada_vuelo" TIMESTAMP(3),
    "fecha_regreso_vuelo" TIMESTAMP(3),
    "fecha_llegada_regreso_vuelo" TIMESTAMP(3),
    "adultos_count" INTEGER,
    "menores_count" INTEGER,
    "numero_confirmacion" TEXT,
    "observaciones" TEXT,
    "checkin_status_ida" "CheckinStatus" DEFAULT 'pendiente',
    "checkin_status_regreso" "CheckinStatus" DEFAULT 'pendiente',
    "tipo_paquete" TEXT DEFAULT 'own',
    "tipo_transporte" TEXT DEFAULT 'Aereo',

    CONSTRAINT "prod_planes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod_restaurantes" (
    "id" TEXT NOT NULL,
    "detalle_venta_id" TEXT NOT NULL,
    "nombre_reserva" TEXT,
    "fecha_hora_reserva" TIMESTAMP(3),
    "personas_count" INTEGER,
    "preferencia_mesa" TEXT,
    "tipo_menu" TEXT,
    "restricciones_dieta" TEXT,
    "ocasion_especial" TEXT,
    "telefono_contacto" TEXT,

    CONSTRAINT "prod_restaurantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod_seguros" (
    "id" TEXT NOT NULL,
    "detalle_venta_id" TEXT NOT NULL,
    "tipo_seguro" TEXT,
    "cobertura_usd" DOUBLE PRECISION DEFAULT 0,
    "dias_cobertura" INTEGER DEFAULT 0,
    "fecha_inicio_vigencia" TIMESTAMP(3),
    "fecha_fin_vigencia" TIMESTAMP(3),
    "telefono_contacto" TEXT,

    CONSTRAINT "prod_seguros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod_simcards" (
    "id" TEXT NOT NULL,
    "detalle_venta_id" TEXT NOT NULL,
    "pais_destino" TEXT,
    "fecha_llegada" TIMESTAMP(3),
    "duracion_viaje" TEXT,
    "plan_datos" TEXT,
    "tipo_sim" TEXT,
    "metodo_entrega" TEXT,

    CONSTRAINT "prod_simcards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod_tiqueteria" (
    "id" TEXT NOT NULL,
    "detalle_venta_id" TEXT NOT NULL,
    "aerolineaId" INTEGER,
    "nro_reserva" TEXT,
    "nro_vuelo" TEXT,
    "nro_tiquete" TEXT,
    "modo_vuelo" "FlightMode" DEFAULT 'one_way',
    "planEquipajeId" INTEGER,
    "checkin_status" "CheckinStatus" DEFAULT 'pendiente',

    CONSTRAINT "prod_tiqueteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod_tours" (
    "id" TEXT NOT NULL,
    "detalle_venta_id" TEXT NOT NULL,
    "tour_nombre" TEXT,
    "fecha_preferida" TIMESTAMP(3),
    "adultos_count" INTEGER DEFAULT 1,
    "menores_count" INTEGER DEFAULT 0,
    "edades_menores" TEXT,
    "idioma_guia" TEXT,
    "requiere_transporte" BOOLEAN DEFAULT false,
    "punto_encuentro" TEXT,
    "condiciones_medicas" TEXT,
    "telefono_contacto" TEXT,
    "observaciones" TEXT,

    CONSTRAINT "prod_tours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod_visas" (
    "id" TEXT NOT NULL,
    "detalle_venta_id" TEXT NOT NULL,
    "nombre_completo" TEXT,
    "fecha_nacimiento" TIMESTAMP(3),
    "nacionalidad" TEXT,
    "tipo_documento" TEXT DEFAULT 'Pasaporte',
    "nro_pasaporte" TEXT,
    "vencimiento_pasaporte" TIMESTAMP(3),
    "pais_aplicacion" TEXT,
    "tipo_visa" TEXT,
    "fecha_estimada_viaje" TIMESTAMP(3),
    "email_contacto" TEXT,

    CONSTRAINT "prod_visas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT,
    "email_contacto" TEXT,
    "telefono" TEXT,
    "web" TEXT,
    "observaciones" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responsables" (
    "id" SERIAL NOT NULL,
    "persona_id" INTEGER NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "responsables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigos_recuperacion" (
    "id" TEXT NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "codigo_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "usado_at" TIMESTAMP(3),
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_recuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones" (
    "id" TEXT NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_agent" TEXT,

    CONSTRAINT "sesiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarjetas_agencia" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "metodo_pago_id" INTEGER,
    "ultimos_cuatro" TEXT,
    "descripcion" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tarjetas_agencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_documento" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "abreviatura" TEXT NOT NULL,

    CONSTRAINT "tipos_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tramos_vuelo" (
    "id" TEXT NOT NULL,
    "prod_tiqueteria_id" TEXT NOT NULL,
    "aeropuerto_origen_id" INTEGER NOT NULL,
    "aeropuerto_destino_id" INTEGER NOT NULL,
    "salida" TIMESTAMP(3) NOT NULL,
    "llegada" TIMESTAMP(3) NOT NULL,
    "nro_vuelo_tramo" TEXT,
    "asiento" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 1,
    "checkin_status" "CheckinStatus" DEFAULT 'pendiente',
    "checkin_at" TIMESTAMP(3),
    "checkin_docs" JSONB,
    "canceled_at" TIMESTAMP(3),
    "reason_canceled" VARCHAR(255),
    "nro_tiquete" TEXT,
    "aerolinea_id" INTEGER,
    "plan_equipaje_id" INTEGER,

    CONSTRAINT "tramos_vuelo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "persona_id" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol_id" INTEGER NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "ultimo_login" TIMESTAMP(3),
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "monto_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costo_proveedor_total" DOUBLE PRECISION DEFAULT 0,
    "ta_total" DOUBLE PRECISION DEFAULT 0,
    "comisionista_id" INTEGER,
    "responsable_id" INTEGER,
    "monto_comision_bruto" DOUBLE PRECISION DEFAULT 0,
    "porcentaje_retencion_comision" DOUBLE PRECISION DEFAULT 0,
    "monto_comision_neto" DOUBLE PRECISION DEFAULT 0,
    "comision_liquidada" BOOLEAN DEFAULT false,
    "metodo_pago_principal_id" INTEGER,
    "status" "SaleStatus" NOT NULL DEFAULT 'credito',
    "es_credito" BOOLEAN DEFAULT false,
    "fecha_vence_credito" TIMESTAMP(3),
    "monto_pagado_credito" DOUBLE PRECISION DEFAULT 0,
    "is_reviewed" BOOLEAN DEFAULT false,
    "observaciones" TEXT,
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas_mensuales" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "count" INTEGER NOT NULL,
    "hoteles" DOUBLE PRECISION,
    "vuelos" DOUBLE PRECISION,
    "paquetes" DOUBLE PRECISION,
    "seguros" DOUBLE PRECISION,
    "transferencias" DOUBLE PRECISION,

    CONSTRAINT "ventas_mensuales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aerolineas_codigo_iata_key" ON "aerolineas"("codigo_iata");

-- CreateIndex
CREATE UNIQUE INDEX "aeropuertos_codigo_iata_key" ON "aeropuertos"("codigo_iata");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_persona_id_key" ON "clientes"("persona_id");

-- CreateIndex
CREATE UNIQUE INDEX "comisionistas_persona_id_key" ON "comisionistas"("persona_id");

-- CreateIndex
CREATE INDEX "detalle_venta_metodo_pago_proveedor_id_idx" ON "detalle_venta"("metodo_pago_proveedor_id");

-- CreateIndex
CREATE INDEX "detalle_venta_proveedor_id_idx" ON "detalle_venta"("proveedor_id");

-- CreateIndex
CREATE INDEX "detalle_venta_venta_id_idx" ON "detalle_venta"("venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "liquidacion_ventas_liquidacion_id_venta_id_key" ON "liquidacion_ventas"("liquidacion_id", "venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "metodos_pago_nombre_key" ON "metodos_pago"("nombre");

-- CreateIndex
CREATE INDEX "pagos_venta_venta_id_idx" ON "pagos_venta"("venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "paquete_asistencia_medica_paquete_id_key" ON "paquete_asistencia_medica"("paquete_id");

-- CreateIndex
CREATE INDEX "pasajeros_detalle_detalle_venta_id_idx" ON "pasajeros_detalle"("detalle_venta_id");

-- CreateIndex
CREATE INDEX "pasajeros_detalle_persona_id_idx" ON "pasajeros_detalle"("persona_id");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_rol_rol_id_permiso_id_key" ON "permisos_rol"("rol_id", "permiso_id");

-- CreateIndex
CREATE UNIQUE INDEX "personas_documento_key" ON "personas"("documento");

-- CreateIndex
CREATE UNIQUE INDEX "prod_autos_detalle_venta_id_key" ON "prod_autos"("detalle_venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "prod_checkins_detalle_venta_id_key" ON "prod_checkins"("detalle_venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "prod_eventos_detalle_venta_id_key" ON "prod_eventos"("detalle_venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "prod_fincas_detalle_venta_id_key" ON "prod_fincas"("detalle_venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "prod_hoteleria_detalle_venta_id_key" ON "prod_hoteleria"("detalle_venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "prod_mascotas_detalle_venta_id_key" ON "prod_mascotas"("detalle_venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "prod_migracion_detalle_venta_id_key" ON "prod_migracion"("detalle_venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "prod_pasaportes_detalle_venta_id_key" ON "prod_pasaportes"("detalle_venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "prod_planes_detalle_venta_id_key" ON "prod_planes"("detalle_venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "prod_restaurantes_detalle_venta_id_key" ON "prod_restaurantes"("detalle_venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "prod_seguros_detalle_venta_id_key" ON "prod_seguros"("detalle_venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "prod_simcards_detalle_venta_id_key" ON "prod_simcards"("detalle_venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "prod_tiqueteria_detalle_venta_id_key" ON "prod_tiqueteria"("detalle_venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "prod_tours_detalle_venta_id_key" ON "prod_tours"("detalle_venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "prod_visas_detalle_venta_id_key" ON "prod_visas"("detalle_venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "responsables_persona_id_key" ON "responsables"("persona_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");

-- CreateIndex
CREATE INDEX "codigos_recuperacion_usuario_id_idx" ON "codigos_recuperacion"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_documento_abreviatura_key" ON "tipos_documento"("abreviatura");

-- CreateIndex
CREATE INDEX "tramos_vuelo_aeropuerto_destino_id_idx" ON "tramos_vuelo"("aeropuerto_destino_id");

-- CreateIndex
CREATE INDEX "tramos_vuelo_aeropuerto_origen_id_idx" ON "tramos_vuelo"("aeropuerto_origen_id");

-- CreateIndex
CREATE INDEX "tramos_vuelo_prod_tiqueteria_id_idx" ON "tramos_vuelo"("prod_tiqueteria_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_persona_id_key" ON "usuarios"("persona_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "ventas_cliente_id_idx" ON "ventas"("cliente_id");

-- CreateIndex
CREATE INDEX "ventas_comisionista_id_idx" ON "ventas"("comisionista_id");

-- CreateIndex
CREATE INDEX "ventas_usuario_id_idx" ON "ventas"("usuario_id");

-- CreateIndex
CREATE INDEX "ventas_creado_at_idx" ON "ventas"("creado_at");

-- CreateIndex
CREATE UNIQUE INDEX "ventas_mensuales_year_month_key" ON "ventas_mensuales"("year", "month");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comisionistas" ADD CONSTRAINT "comisionistas_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_venta" ADD CONSTRAINT "detalle_venta_metodo_pago_proveedor_id_fkey" FOREIGN KEY ("metodo_pago_proveedor_id") REFERENCES "metodos_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_venta" ADD CONSTRAINT "detalle_venta_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_venta" ADD CONSTRAINT "detalle_venta_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_venta" ADD CONSTRAINT "detalle_venta_parent_detalle_id_fkey" FOREIGN KEY ("parent_detalle_id") REFERENCES "detalle_venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_ventas" ADD CONSTRAINT "liquidacion_ventas_liquidacion_id_fkey" FOREIGN KEY ("liquidacion_id") REFERENCES "liquidaciones_comision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_ventas" ADD CONSTRAINT "liquidacion_ventas_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones_comision" ADD CONSTRAINT "liquidaciones_comision_comisionista_id_fkey" FOREIGN KEY ("comisionista_id") REFERENCES "comisionistas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones_comision" ADD CONSTRAINT "liquidaciones_comision_metodo_pago_id_fkey" FOREIGN KEY ("metodo_pago_id") REFERENCES "metodos_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_usuarios" ADD CONSTRAINT "logs_usuarios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_venta" ADD CONSTRAINT "pagos_venta_metodo_pago_id_fkey" FOREIGN KEY ("metodo_pago_id") REFERENCES "metodos_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_venta" ADD CONSTRAINT "pagos_venta_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paquete_asistencia_medica" ADD CONSTRAINT "paquete_asistencia_medica_paquete_id_fkey" FOREIGN KEY ("paquete_id") REFERENCES "paquetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paquete_hotel" ADD CONSTRAINT "paquete_hotel_paquete_id_fkey" FOREIGN KEY ("paquete_id") REFERENCES "paquetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paquete_proveedor" ADD CONSTRAINT "paquete_proveedor_paquete_id_fkey" FOREIGN KEY ("paquete_id") REFERENCES "paquetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paquete_proveedor" ADD CONSTRAINT "paquete_proveedor_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paquete_tarifas" ADD CONSTRAINT "paquete_tarifas_paquete_id_fkey" FOREIGN KEY ("paquete_id") REFERENCES "paquetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paquete_vuelo" ADD CONSTRAINT "paquete_vuelo_aerolinea_id_fkey" FOREIGN KEY ("aerolinea_id") REFERENCES "aerolineas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paquete_vuelo" ADD CONSTRAINT "paquete_vuelo_paquete_id_fkey" FOREIGN KEY ("paquete_id") REFERENCES "paquetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paquetes" ADD CONSTRAINT "paquetes_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pasajeros_detalle" ADD CONSTRAINT "pasajeros_detalle_detalle_venta_id_fkey" FOREIGN KEY ("detalle_venta_id") REFERENCES "detalle_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pasajeros_detalle" ADD CONSTRAINT "pasajeros_detalle_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permisos_rol" ADD CONSTRAINT "permisos_rol_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permisos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permisos_rol" ADD CONSTRAINT "permisos_rol_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_tipo_documento_id_fkey" FOREIGN KEY ("tipo_documento_id") REFERENCES "tipos_documento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "politicas_equipaje" ADD CONSTRAINT "politicas_equipaje_aerolinea_id_fkey" FOREIGN KEY ("aerolinea_id") REFERENCES "aerolineas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_autos" ADD CONSTRAINT "prod_autos_detalle_venta_id_fkey" FOREIGN KEY ("detalle_venta_id") REFERENCES "detalle_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_checkins" ADD CONSTRAINT "prod_checkins_detalle_venta_id_fkey" FOREIGN KEY ("detalle_venta_id") REFERENCES "detalle_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_eventos" ADD CONSTRAINT "prod_eventos_detalle_venta_id_fkey" FOREIGN KEY ("detalle_venta_id") REFERENCES "detalle_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_fincas" ADD CONSTRAINT "prod_fincas_detalle_venta_id_fkey" FOREIGN KEY ("detalle_venta_id") REFERENCES "detalle_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_hoteleria" ADD CONSTRAINT "prod_hoteleria_detalle_venta_id_fkey" FOREIGN KEY ("detalle_venta_id") REFERENCES "detalle_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_mascotas" ADD CONSTRAINT "prod_mascotas_detalle_venta_id_fkey" FOREIGN KEY ("detalle_venta_id") REFERENCES "detalle_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_migracion" ADD CONSTRAINT "prod_migracion_detalle_venta_id_fkey" FOREIGN KEY ("detalle_venta_id") REFERENCES "detalle_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_pasaportes" ADD CONSTRAINT "prod_pasaportes_detalle_venta_id_fkey" FOREIGN KEY ("detalle_venta_id") REFERENCES "detalle_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_planes" ADD CONSTRAINT "prod_planes_aerolineaId_fkey" FOREIGN KEY ("aerolineaId") REFERENCES "aerolineas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_planes" ADD CONSTRAINT "prod_planes_detalle_venta_id_fkey" FOREIGN KEY ("detalle_venta_id") REFERENCES "detalle_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_planes" ADD CONSTRAINT "prod_planes_paqueteId_fkey" FOREIGN KEY ("paqueteId") REFERENCES "paquetes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_planes" ADD CONSTRAINT "prod_planes_paquete_tarifa_id_fkey" FOREIGN KEY ("paquete_tarifa_id") REFERENCES "paquete_tarifas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_restaurantes" ADD CONSTRAINT "prod_restaurantes_detalle_venta_id_fkey" FOREIGN KEY ("detalle_venta_id") REFERENCES "detalle_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_seguros" ADD CONSTRAINT "prod_seguros_detalle_venta_id_fkey" FOREIGN KEY ("detalle_venta_id") REFERENCES "detalle_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_simcards" ADD CONSTRAINT "prod_simcards_detalle_venta_id_fkey" FOREIGN KEY ("detalle_venta_id") REFERENCES "detalle_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_tiqueteria" ADD CONSTRAINT "prod_tiqueteria_aerolineaId_fkey" FOREIGN KEY ("aerolineaId") REFERENCES "aerolineas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_tiqueteria" ADD CONSTRAINT "prod_tiqueteria_detalle_venta_id_fkey" FOREIGN KEY ("detalle_venta_id") REFERENCES "detalle_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_tiqueteria" ADD CONSTRAINT "prod_tiqueteria_planEquipajeId_fkey" FOREIGN KEY ("planEquipajeId") REFERENCES "politicas_equipaje"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_tours" ADD CONSTRAINT "prod_tours_detalle_venta_id_fkey" FOREIGN KEY ("detalle_venta_id") REFERENCES "detalle_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod_visas" ADD CONSTRAINT "prod_visas_detalle_venta_id_fkey" FOREIGN KEY ("detalle_venta_id") REFERENCES "detalle_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responsables" ADD CONSTRAINT "responsables_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_recuperacion" ADD CONSTRAINT "codigos_recuperacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarjetas_agencia" ADD CONSTRAINT "tarjetas_agencia_metodo_pago_id_fkey" FOREIGN KEY ("metodo_pago_id") REFERENCES "metodos_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramos_vuelo" ADD CONSTRAINT "tramos_vuelo_aerolinea_id_fkey" FOREIGN KEY ("aerolinea_id") REFERENCES "aerolineas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramos_vuelo" ADD CONSTRAINT "tramos_vuelo_aeropuerto_destino_id_fkey" FOREIGN KEY ("aeropuerto_destino_id") REFERENCES "aeropuertos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramos_vuelo" ADD CONSTRAINT "tramos_vuelo_aeropuerto_origen_id_fkey" FOREIGN KEY ("aeropuerto_origen_id") REFERENCES "aeropuertos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramos_vuelo" ADD CONSTRAINT "tramos_vuelo_plan_equipaje_id_fkey" FOREIGN KEY ("plan_equipaje_id") REFERENCES "politicas_equipaje"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramos_vuelo" ADD CONSTRAINT "tramos_vuelo_prod_tiqueteria_id_fkey" FOREIGN KEY ("prod_tiqueteria_id") REFERENCES "prod_tiqueteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_comisionista_id_fkey" FOREIGN KEY ("comisionista_id") REFERENCES "comisionistas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_metodo_pago_principal_id_fkey" FOREIGN KEY ("metodo_pago_principal_id") REFERENCES "metodos_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "responsables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

