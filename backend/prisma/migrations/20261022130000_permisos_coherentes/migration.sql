-- Permisos coherentes (spec 027): los valores heredados de `permisos_rol` pasan a los que
-- ya se leen igual por los dos lados, y el asesor deja de listar al personal.
--
-- Corre como `postgres` (DIRECT_URL), sin RLS: escribe en todas las agencias.

-- 1. Un "ver" con alcance con un 'true' o 'false' de cuando era un sí/no. `authorize.js` lo
--    aplicaba como 'own' y el panel lo mostraba como 'all' (o 'none'). Se queda el más
--    estrecho: 'true' -> 'own', y 'false' o cualquier otra cosa -> 'none'. Nadie gana acceso.
--    `admin` y `superadmin` quedan fuera: su autorización no sale de la base (la pantalla los
--    muestra desde estas filas, y un 'own' los mostraría recortados sin estarlo).
UPDATE "permisos_rol" pr
SET "valor" = CASE WHEN pr."valor" = 'true' THEN 'own' ELSE 'none' END
FROM "permisos" p, "roles" r
WHERE pr."permiso_id" = p."id" AND pr."rol_id" = r."id"
  AND p."accion" = 'view'
  AND p."modulo" IN ('dashboard', 'sales', 'quotes', 'clients', 'responsables', 'itineraries')
  AND r."nombre" NOT IN ('admin', 'superadmin')
  AND pr."valor" NOT IN ('all', 'own', 'none');

-- 2. Editar y borrar con alcance: los dos lados ya leían 'true' como 'all' y 'false' como
--    'none'; se deja guardado lo que se lee.
UPDATE "permisos_rol" pr
SET "valor" = CASE WHEN pr."valor" = 'true' THEN 'all' ELSE 'none' END
FROM "permisos" p
WHERE pr."permiso_id" = p."id"
  AND p."accion" IN ('edit', 'delete')
  AND p."modulo" IN ('sales', 'quotes', 'clients', 'responsables', 'itineraries')
  AND (p."modulo", p."accion") IN (('sales', 'edit'), ('sales', 'delete'), ('quotes', 'edit'), ('quotes', 'delete'),
                                   ('clients', 'edit'), ('responsables', 'edit'), ('responsables', 'delete'),
                                   ('itineraries', 'edit'))
  AND pr."valor" NOT IN ('all', 'own', 'none');

-- 3. El asesor sin la lista de usuarios (correos y teléfonos del personal), como el freelancer
--    desde la 026. Ya nada suyo la necesita: el selector de asesor del asistente solo sale
--    con ventas en 'all'.
UPDATE "permisos_rol" pr
SET "valor" = 'false'
FROM "permisos" p, "roles" r
WHERE pr."permiso_id" = p."id" AND pr."rol_id" = r."id"
  AND p."modulo" = 'users' AND p."accion" = 'view' AND r."nombre" = 'asesor';
