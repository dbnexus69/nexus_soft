-- La barrera. Hasta aquí, empresa_id era una columna más.
--
-- ENABLE somete la tabla a sus políticas; FORCE hace que ni siquiera el dueño
-- las salte. FORCE es deliberado: sin él bastaría con que alguien desplegara con
-- el usuario postgres en DATABASE_URL para que el aislamiento desapareciera sin
-- un solo error. Es justo lo que había en el .env hasta hace dos pasos.
--
-- La política es una igualdad sobre una columna indexada, no una subconsulta que
-- suba por la relación: por eso empresa_id está en las 42 tablas y no solo en
-- las raíz.
--
-- Sin contexto, app_empresa_actual() devuelve NULL, y comparar con NULL da NULL:
-- no se ve ninguna fila y no se puede insertar ninguna. Una consulta que se
-- olvide de fijar la empresa no devuelve datos de más, no devuelve nada.

ALTER TABLE "clientes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clientes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "clientes";
CREATE POLICY empresa_aislada ON "clientes" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "comisionistas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comisionistas" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "comisionistas";
CREATE POLICY empresa_aislada ON "comisionistas" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "detalle_venta" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "detalle_venta" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "detalle_venta";
CREATE POLICY empresa_aislada ON "detalle_venta" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "liquidacion_ventas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "liquidacion_ventas" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "liquidacion_ventas";
CREATE POLICY empresa_aislada ON "liquidacion_ventas" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "liquidaciones_comision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "liquidaciones_comision" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "liquidaciones_comision";
CREATE POLICY empresa_aislada ON "liquidaciones_comision" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "logs_usuarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "logs_usuarios" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "logs_usuarios";
CREATE POLICY empresa_aislada ON "logs_usuarios" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "metodos_pago" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "metodos_pago" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "metodos_pago";
CREATE POLICY empresa_aislada ON "metodos_pago" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "pagos_venta" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pagos_venta" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "pagos_venta";
CREATE POLICY empresa_aislada ON "pagos_venta" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "paquete_asistencia_medica" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "paquete_asistencia_medica" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "paquete_asistencia_medica";
CREATE POLICY empresa_aislada ON "paquete_asistencia_medica" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "paquete_hotel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "paquete_hotel" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "paquete_hotel";
CREATE POLICY empresa_aislada ON "paquete_hotel" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "paquete_proveedor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "paquete_proveedor" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "paquete_proveedor";
CREATE POLICY empresa_aislada ON "paquete_proveedor" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "paquete_tarifas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "paquete_tarifas" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "paquete_tarifas";
CREATE POLICY empresa_aislada ON "paquete_tarifas" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "paquete_vuelo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "paquete_vuelo" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "paquete_vuelo";
CREATE POLICY empresa_aislada ON "paquete_vuelo" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "paquetes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "paquetes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "paquetes";
CREATE POLICY empresa_aislada ON "paquetes" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "pasajeros_detalle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pasajeros_detalle" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "pasajeros_detalle";
CREATE POLICY empresa_aislada ON "pasajeros_detalle" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "permisos_rol" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "permisos_rol" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "permisos_rol";
CREATE POLICY empresa_aislada ON "permisos_rol" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "personas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "personas" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "personas";
CREATE POLICY empresa_aislada ON "personas" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "prod_autos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prod_autos" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "prod_autos";
CREATE POLICY empresa_aislada ON "prod_autos" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "prod_checkins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prod_checkins" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "prod_checkins";
CREATE POLICY empresa_aislada ON "prod_checkins" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "prod_eventos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prod_eventos" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "prod_eventos";
CREATE POLICY empresa_aislada ON "prod_eventos" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "prod_fincas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prod_fincas" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "prod_fincas";
CREATE POLICY empresa_aislada ON "prod_fincas" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "prod_hoteleria" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prod_hoteleria" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "prod_hoteleria";
CREATE POLICY empresa_aislada ON "prod_hoteleria" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "prod_mascotas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prod_mascotas" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "prod_mascotas";
CREATE POLICY empresa_aislada ON "prod_mascotas" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "prod_migracion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prod_migracion" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "prod_migracion";
CREATE POLICY empresa_aislada ON "prod_migracion" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "prod_pasaportes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prod_pasaportes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "prod_pasaportes";
CREATE POLICY empresa_aislada ON "prod_pasaportes" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "prod_planes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prod_planes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "prod_planes";
CREATE POLICY empresa_aislada ON "prod_planes" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "prod_restaurantes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prod_restaurantes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "prod_restaurantes";
CREATE POLICY empresa_aislada ON "prod_restaurantes" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "prod_seguros" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prod_seguros" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "prod_seguros";
CREATE POLICY empresa_aislada ON "prod_seguros" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "prod_simcards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prod_simcards" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "prod_simcards";
CREATE POLICY empresa_aislada ON "prod_simcards" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "prod_tiqueteria" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prod_tiqueteria" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "prod_tiqueteria";
CREATE POLICY empresa_aislada ON "prod_tiqueteria" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "prod_tours" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prod_tours" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "prod_tours";
CREATE POLICY empresa_aislada ON "prod_tours" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "prod_visas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prod_visas" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "prod_visas";
CREATE POLICY empresa_aislada ON "prod_visas" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "proveedores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "proveedores" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "proveedores";
CREATE POLICY empresa_aislada ON "proveedores" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "responsables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "responsables" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "responsables";
CREATE POLICY empresa_aislada ON "responsables" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "roles";
CREATE POLICY empresa_aislada ON "roles" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "codigos_recuperacion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "codigos_recuperacion" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "codigos_recuperacion";
CREATE POLICY empresa_aislada ON "codigos_recuperacion" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "sesiones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sesiones" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "sesiones";
CREATE POLICY empresa_aislada ON "sesiones" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "tarjetas_agencia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tarjetas_agencia" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "tarjetas_agencia";
CREATE POLICY empresa_aislada ON "tarjetas_agencia" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "tramos_vuelo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tramos_vuelo" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "tramos_vuelo";
CREATE POLICY empresa_aislada ON "tramos_vuelo" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "usuarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usuarios" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "usuarios";
CREATE POLICY empresa_aislada ON "usuarios" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "ventas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ventas" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "ventas";
CREATE POLICY empresa_aislada ON "ventas" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

ALTER TABLE "ventas_mensuales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ventas_mensuales" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_aislada ON "ventas_mensuales";
CREATE POLICY empresa_aislada ON "ventas_mensuales" USING (empresa_id = app_empresa_actual()) WITH CHECK (empresa_id = app_empresa_actual());

-- Cada agencia ve su propia ficha y ninguna más. El listado para el superadmin
-- llega en T8, con la suplantación y su variable de sesión.
ALTER TABLE "empresas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "empresas" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_propia ON "empresas";
CREATE POLICY empresa_propia ON "empresas" USING (id = app_empresa_actual()) WITH CHECK (id = app_empresa_actual());

-- El valor por defecto de empresa_id deja de tener respaldo.
--
-- Con la política puesta, un insert sin contexto ya no se colaba igualmente
-- —WITH CHECK lo rechaza—, así que el COALESCE a 1 solo servía para que el error
-- fuese más confuso. Ahora, sin contexto, la columna queda NULL y salta el
-- NOT NULL, que dice exactamente lo que pasa.
ALTER TABLE "clientes" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "comisionistas" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "detalle_venta" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "liquidacion_ventas" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "liquidaciones_comision" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "logs_usuarios" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "metodos_pago" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "pagos_venta" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "paquete_asistencia_medica" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "paquete_hotel" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "paquete_proveedor" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "paquete_tarifas" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "paquete_vuelo" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "paquetes" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "pasajeros_detalle" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "permisos_rol" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "personas" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "prod_autos" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "prod_checkins" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "prod_eventos" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "prod_fincas" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "prod_hoteleria" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "prod_mascotas" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "prod_migracion" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "prod_pasaportes" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "prod_planes" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "prod_restaurantes" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "prod_seguros" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "prod_simcards" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "prod_tiqueteria" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "prod_tours" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "prod_visas" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "proveedores" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "responsables" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "roles" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "codigos_recuperacion" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "sesiones" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "tarjetas_agencia" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "tramos_vuelo" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "usuarios" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "ventas" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
ALTER TABLE "ventas_mensuales" ALTER COLUMN "empresa_id" SET DEFAULT NULLIF(current_setting('app.empresa_id', true), '')::integer;
