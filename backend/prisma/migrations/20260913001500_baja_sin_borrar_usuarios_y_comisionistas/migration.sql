-- Dar de baja deja de borrar la fila.
--
-- Son las dos únicas tablas numeradas que borraban de verdad, y eso reutiliza
-- el número: si se va el usuario #0004 y entra otro, el nuevo vuelve a ser el
-- #0004, y el histórico de comisiones y los registros de actividad pasan a
-- señalar a dos personas distintas con el mismo número. Clientes, responsables
-- y paquetes ya usaban `deleted_at`; estas dos se ponen al día.
--
-- De paso arregla algo que no tiene que ver con los números: borrar un
-- comisionista con comisiones liquidadas dejaba el histórico sin dueño, y
-- borrar un usuario se llevaba por delante sus `logs_usuarios`.

ALTER TABLE "usuarios" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "comisionistas" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- Los únicos pasan a aplicarse solo entre los vivos.
--
-- Si no, una baja se queda el correo para siempre y la misma persona no podría
-- volver a entrar con su dirección de siempre: habría que inventarle otra. Con
-- el índice parcial, el correo se libera al darla de baja y su número viejo
-- sigue sin reutilizarse, que es lo que se estaba protegiendo.
--
-- `persona_id` va igual, y no es un detalle: al volver a dar de alta a alguien
-- por su documento, el código reutiliza su `personas`, y esa fila seguiría
-- enganchada al usuario dado de baja.
DROP INDEX "usuarios_email_key";
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email") WHERE "deleted_at" IS NULL;

DROP INDEX "usuarios_persona_id_key";
CREATE UNIQUE INDEX "usuarios_persona_id_key" ON "usuarios"("persona_id") WHERE "deleted_at" IS NULL;

DROP INDEX "comisionistas_persona_id_key";
CREATE UNIQUE INDEX "comisionistas_persona_id_key" ON "comisionistas"("persona_id") WHERE "deleted_at" IS NULL;

-- El login resuelve el correo por aquí, así que es el único sitio donde hay que
-- cerrar la puerta: sin esto, quien fue dado de baja seguiría entrando.
CREATE OR REPLACE FUNCTION app_identidad_por_correo(p_email text)
RETURNS TABLE (usuario_id integer, empresa_id integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.empresa_id FROM usuarios u
  WHERE u.email = lower(p_email) AND u.deleted_at IS NULL
$$;
