-- El superadministrador del sistema, que administra empresas sin ver sus datos.
--
-- Es lo único que la base no puede deducir sola, así que se lo dice la
-- aplicación con una variable de sesión que solo pone el middleware cuando el
-- rol leído de la base es `superadmin`.
--
-- Lo que le abre es EXACTAMENTE dos cosas: la tabla de empresas y la de
-- auditoría. Las 42 tablas de negocio siguen cerradas para él igual que para
-- cualquiera: para ver una venta tiene que entrar en la empresa, y entrar deja
-- fila en `suplantaciones`.
CREATE OR REPLACE FUNCTION app_es_superadmin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.es_superadmin', true), '') = 'true'
$$;
GRANT EXECUTE ON FUNCTION app_es_superadmin() TO app_nexus;

DROP POLICY IF EXISTS empresa_propia ON "empresas";
CREATE POLICY empresa_propia ON "empresas"
  USING (id = app_empresa_actual() OR app_es_superadmin())
  WITH CHECK (app_es_superadmin());

-- La auditoría es solo suya: la escribe al entrar y la lee para rendir cuentas.
-- Una agencia no puede ver ni modificar el registro de quién entró en ella, lo
-- cual es discutible y está anotado: el argumento en contra es la transparencia,
-- y el argumento a favor es que un cliente no debería poder borrar ese rastro.
ALTER TABLE "suplantaciones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suplantaciones" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS solo_superadmin ON "suplantaciones";
CREATE POLICY solo_superadmin ON "suplantaciones"
  USING (app_es_superadmin()) WITH CHECK (app_es_superadmin());
