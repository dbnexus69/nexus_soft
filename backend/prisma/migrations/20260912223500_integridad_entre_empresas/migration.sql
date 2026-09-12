-- Integridad entre empresas: la base deja de aceptar una fila colgada
-- de un padre de otra agencia.
--
-- Se AÑADEN junto a las que ya hay, no las sustituyen: así el modelo de
-- Prisma sigue describiendo la base y un diff futuro no las recrea. El
-- coste es una comprobación más por inserción; la garantía es que no
-- existe código capaz de cruzar los datos de dos agencias.

-- 1. Cada padre necesita ser único por (id, empresa_id) para que se le
--    pueda apuntar con las dos columnas. 14 tablas.
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_id_empresa_id_key" UNIQUE ("id", "empresa_id");
ALTER TABLE "comisionistas" ADD CONSTRAINT "comisionistas_id_empresa_id_key" UNIQUE ("id", "empresa_id");
ALTER TABLE "detalle_venta" ADD CONSTRAINT "detalle_venta_id_empresa_id_key" UNIQUE ("id", "empresa_id");
ALTER TABLE "liquidaciones_comision" ADD CONSTRAINT "liquidaciones_comision_id_empresa_id_key" UNIQUE ("id", "empresa_id");
ALTER TABLE "metodos_pago" ADD CONSTRAINT "metodos_pago_id_empresa_id_key" UNIQUE ("id", "empresa_id");
ALTER TABLE "paquete_tarifas" ADD CONSTRAINT "paquete_tarifas_id_empresa_id_key" UNIQUE ("id", "empresa_id");
ALTER TABLE "paquetes" ADD CONSTRAINT "paquetes_id_empresa_id_key" UNIQUE ("id", "empresa_id");
ALTER TABLE "personas" ADD CONSTRAINT "personas_id_empresa_id_key" UNIQUE ("id", "empresa_id");
ALTER TABLE "prod_tiqueteria" ADD CONSTRAINT "prod_tiqueteria_id_empresa_id_key" UNIQUE ("id", "empresa_id");
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_id_empresa_id_key" UNIQUE ("id", "empresa_id");
ALTER TABLE "responsables" ADD CONSTRAINT "responsables_id_empresa_id_key" UNIQUE ("id", "empresa_id");
ALTER TABLE "roles" ADD CONSTRAINT "roles_id_empresa_id_key" UNIQUE ("id", "empresa_id");
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_id_empresa_id_key" UNIQUE ("id", "empresa_id");
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_id_empresa_id_key" UNIQUE ("id", "empresa_id");

-- 2. Las 53 claves ajenas, con la empresa dentro.
--
--    En las que hoy anulan al borrar el padre, se nombra la columna que
--    se anula: un `SET NULL` a secas anularía también `empresa_id`, que
--    es NOT NULL, y el borrado fallaría. Postgres 15+ lo permite.

ALTER TABLE "clientes" ADD CONSTRAINT "clientes_creado_por_id_empresa_fkey"
  FOREIGN KEY ("creado_por_id", "empresa_id") REFERENCES "usuarios" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE SET NULL ("creado_por_id");
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_persona_id_empresa_fkey"
  FOREIGN KEY ("persona_id", "empresa_id") REFERENCES "personas" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "codigos_recuperacion" ADD CONSTRAINT "codigos_recuperacion_usuario_id_empresa_fkey"
  FOREIGN KEY ("usuario_id", "empresa_id") REFERENCES "usuarios" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "comisionistas" ADD CONSTRAINT "comisionistas_persona_id_empresa_fkey"
  FOREIGN KEY ("persona_id", "empresa_id") REFERENCES "personas" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "detalle_venta" ADD CONSTRAINT "detalle_venta_metodo_pago_proveedor_id_empresa_fkey"
  FOREIGN KEY ("metodo_pago_proveedor_id", "empresa_id") REFERENCES "metodos_pago" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE SET NULL ("metodo_pago_proveedor_id");
ALTER TABLE "detalle_venta" ADD CONSTRAINT "detalle_venta_parent_detalle_id_empresa_fkey"
  FOREIGN KEY ("parent_detalle_id", "empresa_id") REFERENCES "detalle_venta" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE SET NULL ("parent_detalle_id");
ALTER TABLE "detalle_venta" ADD CONSTRAINT "detalle_venta_proveedor_id_empresa_fkey"
  FOREIGN KEY ("proveedor_id", "empresa_id") REFERENCES "proveedores" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE SET NULL ("proveedor_id");
ALTER TABLE "detalle_venta" ADD CONSTRAINT "detalle_venta_venta_id_empresa_fkey"
  FOREIGN KEY ("venta_id", "empresa_id") REFERENCES "ventas" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "liquidacion_ventas" ADD CONSTRAINT "liquidacion_ventas_liquidacion_id_empresa_fkey"
  FOREIGN KEY ("liquidacion_id", "empresa_id") REFERENCES "liquidaciones_comision" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "liquidacion_ventas" ADD CONSTRAINT "liquidacion_ventas_venta_id_empresa_fkey"
  FOREIGN KEY ("venta_id", "empresa_id") REFERENCES "ventas" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "liquidaciones_comision" ADD CONSTRAINT "liquidaciones_comision_comisionista_id_empresa_fkey"
  FOREIGN KEY ("comisionista_id", "empresa_id") REFERENCES "comisionistas" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "liquidaciones_comision" ADD CONSTRAINT "liquidaciones_comision_metodo_pago_id_empresa_fkey"
  FOREIGN KEY ("metodo_pago_id", "empresa_id") REFERENCES "metodos_pago" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE SET NULL ("metodo_pago_id");

ALTER TABLE "logs_usuarios" ADD CONSTRAINT "logs_usuarios_usuario_id_empresa_fkey"
  FOREIGN KEY ("usuario_id", "empresa_id") REFERENCES "usuarios" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "pagos_venta" ADD CONSTRAINT "pagos_venta_metodo_pago_id_empresa_fkey"
  FOREIGN KEY ("metodo_pago_id", "empresa_id") REFERENCES "metodos_pago" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE SET NULL ("metodo_pago_id");
ALTER TABLE "pagos_venta" ADD CONSTRAINT "pagos_venta_venta_id_empresa_fkey"
  FOREIGN KEY ("venta_id", "empresa_id") REFERENCES "ventas" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "paquete_asistencia_medica" ADD CONSTRAINT "paquete_asistencia_medica_paquete_id_empresa_fkey"
  FOREIGN KEY ("paquete_id", "empresa_id") REFERENCES "paquetes" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "paquete_hotel" ADD CONSTRAINT "paquete_hotel_paquete_id_empresa_fkey"
  FOREIGN KEY ("paquete_id", "empresa_id") REFERENCES "paquetes" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "paquete_proveedor" ADD CONSTRAINT "paquete_proveedor_paquete_id_empresa_fkey"
  FOREIGN KEY ("paquete_id", "empresa_id") REFERENCES "paquetes" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "paquete_proveedor" ADD CONSTRAINT "paquete_proveedor_proveedor_id_empresa_fkey"
  FOREIGN KEY ("proveedor_id", "empresa_id") REFERENCES "proveedores" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "paquete_tarifas" ADD CONSTRAINT "paquete_tarifas_paquete_id_empresa_fkey"
  FOREIGN KEY ("paquete_id", "empresa_id") REFERENCES "paquetes" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "paquete_vuelo" ADD CONSTRAINT "paquete_vuelo_paquete_id_empresa_fkey"
  FOREIGN KEY ("paquete_id", "empresa_id") REFERENCES "paquetes" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "paquetes" ADD CONSTRAINT "paquetes_creado_por_id_empresa_fkey"
  FOREIGN KEY ("creado_por_id", "empresa_id") REFERENCES "usuarios" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE SET NULL ("creado_por_id");

ALTER TABLE "pasajeros_detalle" ADD CONSTRAINT "pasajeros_detalle_detalle_venta_id_empresa_fkey"
  FOREIGN KEY ("detalle_venta_id", "empresa_id") REFERENCES "detalle_venta" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "pasajeros_detalle" ADD CONSTRAINT "pasajeros_detalle_persona_id_empresa_fkey"
  FOREIGN KEY ("persona_id", "empresa_id") REFERENCES "personas" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "permisos_rol" ADD CONSTRAINT "permisos_rol_rol_id_empresa_fkey"
  FOREIGN KEY ("rol_id", "empresa_id") REFERENCES "roles" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "prod_autos" ADD CONSTRAINT "prod_autos_detalle_venta_id_empresa_fkey"
  FOREIGN KEY ("detalle_venta_id", "empresa_id") REFERENCES "detalle_venta" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "prod_checkins" ADD CONSTRAINT "prod_checkins_detalle_venta_id_empresa_fkey"
  FOREIGN KEY ("detalle_venta_id", "empresa_id") REFERENCES "detalle_venta" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "prod_eventos" ADD CONSTRAINT "prod_eventos_detalle_venta_id_empresa_fkey"
  FOREIGN KEY ("detalle_venta_id", "empresa_id") REFERENCES "detalle_venta" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "prod_fincas" ADD CONSTRAINT "prod_fincas_detalle_venta_id_empresa_fkey"
  FOREIGN KEY ("detalle_venta_id", "empresa_id") REFERENCES "detalle_venta" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "prod_hoteleria" ADD CONSTRAINT "prod_hoteleria_detalle_venta_id_empresa_fkey"
  FOREIGN KEY ("detalle_venta_id", "empresa_id") REFERENCES "detalle_venta" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "prod_mascotas" ADD CONSTRAINT "prod_mascotas_detalle_venta_id_empresa_fkey"
  FOREIGN KEY ("detalle_venta_id", "empresa_id") REFERENCES "detalle_venta" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "prod_migracion" ADD CONSTRAINT "prod_migracion_detalle_venta_id_empresa_fkey"
  FOREIGN KEY ("detalle_venta_id", "empresa_id") REFERENCES "detalle_venta" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "prod_pasaportes" ADD CONSTRAINT "prod_pasaportes_detalle_venta_id_empresa_fkey"
  FOREIGN KEY ("detalle_venta_id", "empresa_id") REFERENCES "detalle_venta" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "prod_planes" ADD CONSTRAINT "prod_planes_detalle_venta_id_empresa_fkey"
  FOREIGN KEY ("detalle_venta_id", "empresa_id") REFERENCES "detalle_venta" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "prod_planes" ADD CONSTRAINT "prod_planes_paqueteId_empresa_fkey"
  FOREIGN KEY ("paqueteId", "empresa_id") REFERENCES "paquetes" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE SET NULL ("paqueteId");
ALTER TABLE "prod_planes" ADD CONSTRAINT "prod_planes_paquete_tarifa_id_empresa_fkey"
  FOREIGN KEY ("paquete_tarifa_id", "empresa_id") REFERENCES "paquete_tarifas" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE SET NULL ("paquete_tarifa_id");

ALTER TABLE "prod_restaurantes" ADD CONSTRAINT "prod_restaurantes_detalle_venta_id_empresa_fkey"
  FOREIGN KEY ("detalle_venta_id", "empresa_id") REFERENCES "detalle_venta" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "prod_seguros" ADD CONSTRAINT "prod_seguros_detalle_venta_id_empresa_fkey"
  FOREIGN KEY ("detalle_venta_id", "empresa_id") REFERENCES "detalle_venta" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "prod_simcards" ADD CONSTRAINT "prod_simcards_detalle_venta_id_empresa_fkey"
  FOREIGN KEY ("detalle_venta_id", "empresa_id") REFERENCES "detalle_venta" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "prod_tiqueteria" ADD CONSTRAINT "prod_tiqueteria_detalle_venta_id_empresa_fkey"
  FOREIGN KEY ("detalle_venta_id", "empresa_id") REFERENCES "detalle_venta" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "prod_tours" ADD CONSTRAINT "prod_tours_detalle_venta_id_empresa_fkey"
  FOREIGN KEY ("detalle_venta_id", "empresa_id") REFERENCES "detalle_venta" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "prod_visas" ADD CONSTRAINT "prod_visas_detalle_venta_id_empresa_fkey"
  FOREIGN KEY ("detalle_venta_id", "empresa_id") REFERENCES "detalle_venta" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "responsables" ADD CONSTRAINT "responsables_persona_id_empresa_fkey"
  FOREIGN KEY ("persona_id", "empresa_id") REFERENCES "personas" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_empresa_fkey"
  FOREIGN KEY ("usuario_id", "empresa_id") REFERENCES "usuarios" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "tarjetas_agencia" ADD CONSTRAINT "tarjetas_agencia_metodo_pago_id_empresa_fkey"
  FOREIGN KEY ("metodo_pago_id", "empresa_id") REFERENCES "metodos_pago" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE SET NULL ("metodo_pago_id");

ALTER TABLE "tramos_vuelo" ADD CONSTRAINT "tramos_vuelo_prod_tiqueteria_id_empresa_fkey"
  FOREIGN KEY ("prod_tiqueteria_id", "empresa_id") REFERENCES "prod_tiqueteria" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_persona_id_empresa_fkey"
  FOREIGN KEY ("persona_id", "empresa_id") REFERENCES "personas" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_empresa_fkey"
  FOREIGN KEY ("rol_id", "empresa_id") REFERENCES "roles" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cliente_id_empresa_fkey"
  FOREIGN KEY ("cliente_id", "empresa_id") REFERENCES "clientes" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_comisionista_id_empresa_fkey"
  FOREIGN KEY ("comisionista_id", "empresa_id") REFERENCES "comisionistas" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE SET NULL ("comisionista_id");
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_metodo_pago_principal_id_empresa_fkey"
  FOREIGN KEY ("metodo_pago_principal_id", "empresa_id") REFERENCES "metodos_pago" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE SET NULL ("metodo_pago_principal_id");
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_responsable_id_empresa_fkey"
  FOREIGN KEY ("responsable_id", "empresa_id") REFERENCES "responsables" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE SET NULL ("responsable_id");
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_usuario_id_empresa_fkey"
  FOREIGN KEY ("usuario_id", "empresa_id") REFERENCES "usuarios" ("id", "empresa_id")
  ON UPDATE CASCADE ON DELETE RESTRICT;
