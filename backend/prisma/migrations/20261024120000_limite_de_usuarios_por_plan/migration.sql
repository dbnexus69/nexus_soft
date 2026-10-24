-- Licenciamiento por plan (spec 029): el servidor frena el alta de un usuario por encima del
-- límite de la agencia; el nombre y el precio son solo para que el panel de superadmin los
-- muestre. Puramente aditiva: las agencias que ya existen quedan sin límite.

ALTER TABLE "empresas" ADD COLUMN "limite_usuarios" INTEGER;
ALTER TABLE "empresas" ADD COLUMN "nombre_plan" TEXT;
ALTER TABLE "empresas" ADD COLUMN "precio_plan" INTEGER;

-- El trigger de 20261004130000 ya limita qué columnas puede cambiar la propia agencia (todo
-- menos su perfil y su marca). Las tres de arriba son del superadministrador, como `estado`:
-- se agregan a la misma lista, o la agencia podría subirse su propio límite desde "Mi empresa".
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
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     OR NEW.limite_usuarios IS DISTINCT FROM OLD.limite_usuarios
     OR NEW.nombre_plan IS DISTINCT FROM OLD.nombre_plan
     OR NEW.precio_plan IS DISTINCT FROM OLD.precio_plan THEN
    RAISE EXCEPTION 'Una agencia solo puede cambiar su perfil y su marca'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
