-- La aplicación solo habla con la base como `app_nexus`; no usa la API REST de
-- Supabase ni sus claves. Las 44 tablas con RLS ya estaban protegidas por sus
-- políticas, pero `anon` y `authenticated` conservaban permisos completos sobre
-- ellas: una política mal escrita o una tabla nueva sin RLS los habría dejado
-- abiertos. Se quita la capa entera y se evita que vuelva a aparecer.

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Lo que se cree de aquí en adelante (migraciones, que corren como `postgres`)
-- ya no hereda esos permisos. `app_nexus` conserva los suyos por defecto.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
