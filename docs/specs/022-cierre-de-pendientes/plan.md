# Plan — Spec 022

## T1 · Cerrar la 014 T7

Solo documentación. Se registra el cierre aquí y se redacta el aviso para Darío (la 014 la trabajó su rama).
Editar la línea `[ ]` → `[x]` de la 014 solo si el usuario lo ordena expresamente.

## T2 · Pruebas en pantalla

Claude no abre el navegador ni levanta servidores sin permiso, así que: Claude escribe en `tasks.md` una lista de
pasos por spec (008, 011, 012, 017, 020) sacada del "falta probar" de cada `tasks.md`, el usuario la recorre con
`pnpm dev` en las dos carpetas y marca ok/falla. Claude actualiza el `tasks.md` de cada spec con el resultado.
Lista aparte, en el chat, para Darío con sus specs (006, 013, 014, 015, 021).

## T3 · Activar la CI

1. El usuario corre `! gh auth refresh -h github.com -s workflow` (abre el navegador para iniciar sesión).
2. Claude: `git mv docs/ci/ci.yml .github/workflows/ci.yml` y quita el comentario "PENDIENTE DE ACTIVAR".
3. Commit y push **solo con orden del usuario**; luego se mira la corrida con `gh run list`/`gh run view`.
4. Se cierra la 010 T2 y se actualiza la mención de la CI en `CLAUDE.md` ("not active yet").

Riesgo: el primer verde no se pudo probar en local; si falla, es un ajuste de pasos del YAML.

## T4 · Archivar la 009

Cambiar el encabezado de `009/spec.md` y `009/tasks.md` a **archivada (2026-10-21)** con el motivo. Sin código.

## T5 · Alcance en `GET /uploads/:fichero`

En `backend/src/routes/uploads.routes.js`, sin `authorize` de un solo módulo (un fichero puede ser voucher —
módulo `sales`— o documento de check-in —módulo `itineraries`—):

- Leer los alcances con `getEffectivePermissions(req.user)` de `middleware/authorize.js`: `sales.view` e
  `itineraries.view`.
- Cada rama de la consulta se une a `ventas` y añade su condición: rama desactivada si el alcance no es `all`
  ni `own`; con `own`, `v.usuario_id = req.user.id`.
  - voucher: `detalle_venta d JOIN ventas v ON v.id = d.venta_id`
  - check-in: `tramos_vuelo t JOIN prod_tiqueteria p ON p.id = t.prod_tiqueteria_id JOIN detalle_venta d ON
    d.id = p.detalle_venta_id JOIN ventas v ON v.id = d.venta_id`
- Respuesta igual que hoy: 404 si no hay fila visible (no distingue "no existe" de "no es tuyo").
- De paso: escapar `%` y `_` del nombre en el `LIKE` del check-in.
- Superadmin y admin ya resuelven a `all`; con suplantación, `req.user` es el superadmin → `all`.

Prueba: ampliar el bloque "Un asesor de la agencia" de `tests/aislamiento-api.js` (voucher de venta propia 200,
de venta del admin 404). Correrla necesita permiso (toca la base compartida). Sin permiso: `node --check`.
