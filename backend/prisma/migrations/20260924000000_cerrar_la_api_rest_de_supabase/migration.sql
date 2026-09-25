-- La aplicación habla con la base solo como `app_nexus`. La API REST de Supabase
-- (roles `anon` y `authenticated`) no forma parte del diseño y no debe llegar a
-- nada de lo que aquí se crea.

-- 1. Las funciones de contexto y de identidad solo las ejecuta la aplicación.
--    `app_identidad_por_correo` es SECURITY DEFINER y devuelve (usuario, empresa)
--    dado un correo: expuesta por /rest/v1/rpc permitía comprobar qué correos existen.
REVOKE EXECUTE ON FUNCTION public.app_identidad_por_correo(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.app_asignar_numero()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.app_empresa_actual()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.app_es_superadmin()            FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.app_identidad_por_correo(text) TO app_nexus;
GRANT  EXECUTE ON FUNCTION public.app_asignar_numero()           TO app_nexus;
GRANT  EXECUTE ON FUNCTION public.app_empresa_actual()           TO app_nexus;
GRANT  EXECUTE ON FUNCTION public.app_es_superadmin()            TO app_nexus;

-- 2. Las dos funciones de contexto solo leen `current_setting`, que vive en
--    pg_catalog y se resuelve siempre: un search_path vacío no las afecta.
ALTER FUNCTION public.app_empresa_actual() SET search_path = '';
ALTER FUNCTION public.app_es_superadmin()  SET search_path = '';

-- 3. Seis tablas sin RLS (catálogos globales e historial de migraciones) tenían
--    permisos completos para `anon` y `authenticated`: con la clave pública se
--    podían modificar o borrar. Sin RLS no hay política que las proteja, así que
--    se les quitan los permisos; `app_nexus` conserva los suyos.
REVOKE ALL ON TABLE public.permisos, public.aerolineas, public.aeropuertos,
                    public.tipos_documento, public.politicas_equipaje,
                    public._prisma_migrations
  FROM PUBLIC, anon, authenticated;
