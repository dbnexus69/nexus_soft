-- El freelancer de TODAS las agencias pasa a los valores de la spec 026, aunque un admin
-- los hubiera cambiado (decisión del usuario): sin lista de usuarios (025, H2) y
-- responsables view/create/edit/delete = own/true/own/none. El resto de sus permisos no
-- se toca. Las agencias nuevas ya salen así de `authorize.js`.
--
-- Corre como `postgres` (DIRECT_URL), sin RLS: escribe en todas las agencias.

-- Responsables tiene alcance desde esta spec: un 'true'/'false' guardado (de cuando era
-- un sí/no) pasa a 'all'/'none'. Sin esto, `authorize.js` leería el 'false' del asesor
-- como 'own'.
UPDATE "permisos_rol" pr
SET "valor" = CASE WHEN pr.valor = 'true' THEN 'all' ELSE 'none' END
FROM "permisos" p
WHERE pr.permiso_id = p.id AND p.modulo = 'responsables' AND p.accion IN ('view', 'edit', 'delete')
  AND pr.valor NOT IN ('all', 'own', 'none');

-- Las filas del catálogo, por si alguna faltara.
INSERT INTO "permisos" ("modulo", "accion")
SELECT v.modulo, v.accion
FROM (VALUES ('users', 'view'), ('responsables', 'view'), ('responsables', 'create'),
             ('responsables', 'edit'), ('responsables', 'delete')) AS v(modulo, accion)
WHERE NOT EXISTS (SELECT 1 FROM "permisos" p WHERE p.modulo = v.modulo AND p.accion = v.accion);

-- Borrar y volver a insertar en vez de un upsert: si el catálogo tuviera una fila
-- repetida, el rol podría apuntar a la otra y quedarían dos valores para lo mismo.
DELETE FROM "permisos_rol" pr
USING "roles" r, "permisos" p
WHERE pr.rol_id = r.id AND pr.permiso_id = p.id AND r.nombre = 'freelancer'
  AND (p.modulo, p.accion) IN (('users', 'view'), ('responsables', 'view'), ('responsables', 'create'),
                               ('responsables', 'edit'), ('responsables', 'delete'));

INSERT INTO "permisos_rol" ("rol_id", "permiso_id", "valor", "empresa_id")
SELECT r.id,
       (SELECT MIN(p.id) FROM "permisos" p WHERE p.modulo = v.modulo AND p.accion = v.accion),
       v.valor,
       r.empresa_id
FROM "roles" r
CROSS JOIN (VALUES ('users', 'view', 'false'), ('responsables', 'view', 'own'),
                   ('responsables', 'create', 'true'), ('responsables', 'edit', 'own'),
                   ('responsables', 'delete', 'none')) AS v(modulo, accion, valor)
WHERE r.nombre = 'freelancer';
