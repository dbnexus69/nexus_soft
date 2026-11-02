-- Lo que en Supabase ya existe y las migraciones dan por hecho (spec 038). Solo para la base local.

-- El rol de la aplicación, sin BYPASSRLS: con otro, las políticas no filtran y `src/index.js` no arranca.
CREATE ROLE app_nexus LOGIN PASSWORD 'app_nexus' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

-- Los de la API REST de Supabase: la app no los usa, pero las migraciones les revocan permisos.
CREATE ROLE anon NOLOGIN NOINHERIT;
CREATE ROLE authenticated NOLOGIN NOINHERIT;
CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;

-- Las tablas de la API de Storage van aparte de las de Prisma.
CREATE DATABASE nexus_storage;

-- En Supabase parte de los permisos de `app_nexus` se dio a mano y no está en las migraciones. Aquí, lo que creen las
-- migraciones (corren como `postgres`) nace con esos permisos. La RLS sigue siendo la que filtra.
-- Diferencia con producción: una migración nueva que olvide su GRANT no falla en local.
GRANT USAGE ON SCHEMA public TO app_nexus;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_nexus;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_nexus;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO app_nexus;
