-- Funciones que la RLS necesita.
--
-- 1) `app_empresa_actual()` centraliza la lectura del contexto. Sin ella, cada
--    una de las 42 políticas repetiría el mismo `NULLIF(...)::int` y bastaría
--    una mal escrita para abrir un agujero. El `true` de `current_setting` es
--    obligatorio: sin él, una consulta sin contexto lanza excepción en vez de
--    devolver NULL, y sin contexto se queda el login.
CREATE OR REPLACE FUNCTION app_empresa_actual() RETURNS integer
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.empresa_id', true), '')::integer
$$;

-- 2) El login es el único que necesita mirar a través de las empresas: quien
--    entra dice su correo, y hasta resolverlo no se sabe de qué agencia es.
--
--    En vez de dejar `usuarios` sin proteger, o de confiar en que el código no
--    consulte sin contexto, se abre exactamente una rendija: una función que
--    corre con los permisos de su dueño y devuelve SOLO el id y la empresa. Ni
--    el nombre, ni el correo, ni la contraseña. Con eso la aplicación ya puede
--    fijar el contexto y leer el resto por el camino normal, bajo la política.
CREATE OR REPLACE FUNCTION app_identidad_por_correo(p_email text)
RETURNS TABLE (usuario_id integer, empresa_id integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.empresa_id FROM usuarios u WHERE u.email = lower(p_email)
$$;

REVOKE ALL ON FUNCTION app_identidad_por_correo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_identidad_por_correo(text) TO app_nexus;
GRANT EXECUTE ON FUNCTION app_empresa_actual() TO app_nexus;
