-- Los catálogos compartidos por todas las agencias los lee cualquiera y solo los escribe el superadministrador
-- (decisión de multitenencia; spec 039, H15). No llevaban RLS, así que el rol de la aplicación podía escribirlos desde
-- cualquier agencia. Un REVOKE a secas no sirve: el superadministrador entra con ese mismo rol.
-- `permisos` queda fuera: `roles.service.js` lo escribe al guardar una matriz.

ALTER TABLE "aerolineas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "aerolineas" FORCE ROW LEVEL SECURITY;
CREATE POLICY catalogo_leer ON "aerolineas" FOR SELECT USING (true);
CREATE POLICY catalogo_insertar ON "aerolineas" FOR INSERT WITH CHECK (app_es_superadmin());
CREATE POLICY catalogo_actualizar ON "aerolineas" FOR UPDATE USING (app_es_superadmin()) WITH CHECK (app_es_superadmin());
CREATE POLICY catalogo_borrar ON "aerolineas" FOR DELETE USING (app_es_superadmin());

ALTER TABLE "aeropuertos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "aeropuertos" FORCE ROW LEVEL SECURITY;
CREATE POLICY catalogo_leer ON "aeropuertos" FOR SELECT USING (true);
CREATE POLICY catalogo_insertar ON "aeropuertos" FOR INSERT WITH CHECK (app_es_superadmin());
CREATE POLICY catalogo_actualizar ON "aeropuertos" FOR UPDATE USING (app_es_superadmin()) WITH CHECK (app_es_superadmin());
CREATE POLICY catalogo_borrar ON "aeropuertos" FOR DELETE USING (app_es_superadmin());

ALTER TABLE "politicas_equipaje" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "politicas_equipaje" FORCE ROW LEVEL SECURITY;
CREATE POLICY catalogo_leer ON "politicas_equipaje" FOR SELECT USING (true);
CREATE POLICY catalogo_insertar ON "politicas_equipaje" FOR INSERT WITH CHECK (app_es_superadmin());
CREATE POLICY catalogo_actualizar ON "politicas_equipaje" FOR UPDATE USING (app_es_superadmin()) WITH CHECK (app_es_superadmin());
CREATE POLICY catalogo_borrar ON "politicas_equipaje" FOR DELETE USING (app_es_superadmin());

ALTER TABLE "tipos_documento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tipos_documento" FORCE ROW LEVEL SECURITY;
CREATE POLICY catalogo_leer ON "tipos_documento" FOR SELECT USING (true);
CREATE POLICY catalogo_insertar ON "tipos_documento" FOR INSERT WITH CHECK (app_es_superadmin());
CREATE POLICY catalogo_actualizar ON "tipos_documento" FOR UPDATE USING (app_es_superadmin()) WITH CHECK (app_es_superadmin());
CREATE POLICY catalogo_borrar ON "tipos_documento" FOR DELETE USING (app_es_superadmin());
