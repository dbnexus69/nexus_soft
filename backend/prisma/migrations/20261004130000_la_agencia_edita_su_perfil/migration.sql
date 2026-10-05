-- La agencia edita su propio perfil (spec 011, T3).
--
-- Hasta ahora solo el superadministrador podía escribir en `empresas` (`WITH CHECK (app_es_superadmin())`,
-- 20260911080331). "Mi empresa" necesita que el admin de una agencia cambie SU fila: el WITH CHECK pasa a
-- aceptar también la empresa del contexto, igual que ya hacía el USING para leer.
--
-- Pero no toda la fila: el slug, el nombre legal, el estado (suspender), el remitente de correo, la fecha de
-- alta y el borrado siguen siendo del superadministrador. Una política no puede limitar columnas, así que lo
-- hace un trigger: fuera del superadministrador, cambiar cualquiera de esas columnas lanza. La base sigue
-- garantizando lo mismo que antes, no solo el código.

DROP POLICY IF EXISTS empresa_propia ON "empresas";
CREATE POLICY empresa_propia ON "empresas"
  USING (id = app_empresa_actual() OR app_es_superadmin())
  WITH CHECK (id = app_empresa_actual() OR app_es_superadmin());

CREATE OR REPLACE FUNCTION app_empresa_solo_perfil() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF app_es_superadmin() THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.slug IS DISTINCT FROM OLD.slug
     OR NEW.nombre IS DISTINCT FROM OLD.nombre
     OR NEW.estado IS DISTINCT FROM OLD.estado
     OR NEW.email_remitente IS DISTINCT FROM OLD.email_remitente
     OR NEW.email_nombre IS DISTINCT FROM OLD.email_nombre
     OR NEW.creado_at IS DISTINCT FROM OLD.creado_at
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'Una agencia solo puede cambiar su perfil y su marca'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_empresa_solo_perfil() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS empresa_solo_perfil ON "empresas";
CREATE TRIGGER empresa_solo_perfil
  BEFORE UPDATE ON "empresas"
  FOR EACH ROW EXECUTE FUNCTION app_empresa_solo_perfil();
