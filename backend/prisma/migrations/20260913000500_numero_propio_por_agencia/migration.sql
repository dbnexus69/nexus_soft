-- El número que cada agencia ve, y que empieza en 1 en todas.
--
-- El `id` es global: la agencia A veía sus clientes 22 y 23 y la B el 136, y
-- los huecos entre unos y otros son, literalmente, lo que ha dado de alta la
-- vecina. Cualquiera con la pantalla delante puede contarlo. En `ventas` ya se
-- resolvió; aquí entran las otras ocho tablas que enseñan su id, y `ventas` se
-- muda al mismo mecanismo para que no queden dos.
--
-- Lo pone la BASE, no el código. Con ocho tablas y un alta en cada servicio, la
-- alternativa era repetir el cerrojo y el MAX+1 en cada una y confiar en que la
-- novena se acordara. Un disparador no se puede olvidar: ni el alta de hoy, ni
-- la que se escriba dentro de un año, ni un INSERT hecho a mano.

-- ── 1. La función que asigna el siguiente

-- SECURITY DEFINER a propósito: el máximo tiene que calcularse sobre TODAS las
-- filas de esa agencia, las vea quien las vea. Si dependiera de lo que deja
-- pasar la política de turno, una fila oculta daría un número repetido, y el
-- único de abajo convertiría eso en un alta que falla sin motivo aparente.
--
-- El cerrojo lleva la tabla y la empresa dentro y muere con la transacción: dos
-- altas simultáneas de la misma agencia se ponen en fila, y dos agencias
-- distintas no se estorban. Se toma DESPUÉS de comprobar que hace falta, para
-- no serializar los inserts que ya traen número.
CREATE OR REPLACE FUNCTION app_asignar_numero() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  siguiente integer;
BEGIN
  IF NEW.numero IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.empresa_id IS NULL THEN
    RAISE EXCEPTION 'No se puede numerar una fila de % sin empresa', TG_TABLE_NAME;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(TG_TABLE_NAME), NEW.empresa_id);
  EXECUTE format('SELECT COALESCE(MAX(numero), 0) + 1 FROM %I WHERE empresa_id = $1', TG_TABLE_NAME)
    INTO siguiente USING NEW.empresa_id;

  NEW.numero := siguiente;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_asignar_numero() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_asignar_numero() TO app_nexus;

-- ── 2. La columna, el relleno y el único, tabla por tabla
--
-- El relleno va por orden de id, así que a la agencia que ya trabajaba no le
-- cambia el orden de nada: solo pasa a verse desde el 1.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clientes', 'usuarios', 'responsables', 'comisionistas',
    'proveedores', 'metodos_pago', 'paquetes', 'tarjetas_agencia'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS numero integer', t);
    EXECUTE format($f$
      UPDATE %I AS x SET numero = o.rn
      FROM (SELECT id, row_number() OVER (PARTITION BY empresa_id ORDER BY id) AS rn FROM %I) AS o
      WHERE x.id = o.id AND x.numero IS NULL
    $f$, t, t);
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I UNIQUE (empresa_id, numero)', t, t || '_empresa_id_numero_key');
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION app_asignar_numero()',
                   t || '_numero', t);
  END LOOP;
END $$;

-- `ventas` ya tiene columna y único desde `numero_de_venta_por_empresa`; solo
-- le falta el disparador. A partir de aquí el cerrojo y el MAX+1 que vivían en
-- `createSale` sobran, y se retiran en el mismo commit.
CREATE TRIGGER ventas_numero BEFORE INSERT ON ventas
FOR EACH ROW EXECUTE FUNCTION app_asignar_numero();
