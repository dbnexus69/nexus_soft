-- La aplicación (`app_nexus`) no tiene nada que hacer con el historial de
-- migraciones. Tenía SELECT, INSERT, UPDATE y DELETE sobre él por el GRANT
-- general de la spec 001: una inyección de SQL, o un fallo del código, podía
-- borrar o falsear el registro de qué migraciones están aplicadas, y
-- `migrate deploy` dejaría de saber en qué estado está la base.
--
-- Las migraciones corren con `postgres` (`DIRECT_URL`); ningún código de
-- `src/` lee esta tabla. Spec 002, T10.
REVOKE ALL ON TABLE public."_prisma_migrations" FROM app_nexus;
