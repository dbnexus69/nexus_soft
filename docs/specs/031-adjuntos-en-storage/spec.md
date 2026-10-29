# Spec 031 — Adjuntos en Supabase Storage, no en el disco

**Estado:** diseño, sin implementar · **Rama:** `feat-bayrol` · **Toca la base compartida:** no (ninguna migración;
un bucket nuevo en Storage, creado a mano) · **Relacionadas:** 032 (despliegue, bloqueante B1), 011 (Storage por
empresa), 022 (alcance al abrir ficheros)

## Por qué

Render borra el disco en cada deploy o reinicio (spec 032, B1). Hoy `middleware/upload.js` escribe en
`backend/uploads/`, así que todo lo que se sube por ahí desaparece al redeployar y las filas quedan apuntando a
`/uploads/<fichero>` que ya no existe.

## Qué se sube hoy a disco (análisis 2026-10-25)

| Ruta | Dónde se guarda la referencia | ¿Quién lo vuelve a leer? |
|---|---|---|
| `PUT /sales/:id/products/:detalleId/voucher` (voucher del proveedor) | `detalle_venta.voucher_url` = `/uploads/<fichero>` | Solo `GET /uploads/:fichero`. **El frontend no lo abre en ningún sitio** (ni `voucher_url` sale en las respuestas de lectura). |
| `PUT /flights/:id/checkin` (hasta 5 documentos) | `tramos_vuelo.checkin_docs` = `[{ url, filename }]` | El correo del check-in los adjunta **leyéndolos del disco** en la misma petición; después solo `GET /uploads/:fichero`. El frontend no los abre. |
| `PUT /clients/:id/avatar`, `PUT /users/:id/avatar` | `personas.avatar_url` = `/uploads/<fichero>` | **Nadie.** El frontend no llama a estas rutas (los avatares viajan como data URL en el JSON) y `GET /uploads/:fichero` ni siquiera sirve avatares: autoriza solo vouchers y check-in. Código muerto. |

En `backend/uploads/` local hay un solo PDF más dos carpetas viejas (`comprobantes/`, `logos/`) que ningún código
escribe ni lee.

## Qué se quiere

1. El voucher del proveedor y los documentos de check-in se guardan en un bucket privado nuevo, **`adjuntos`**, en
   la carpeta de la empresa (`utils/almacenamiento.js`, como logos y vouchers). Nada se escribe en disco.
2. **La referencia guardada no cambia de formato:** sigue siendo `/uploads/<fichero>`, y el objeto vive en
   `adjuntos/<empresa_id>/<fichero>`. Así `GET /uploads/:fichero` conserva la misma consulta de autorización
   (agencia por RLS + alcance del rol, spec 022) y las filas viejas siguen siendo válidas.
3. `GET /uploads/:fichero`, si autoriza, responde **302 a una URL firmada de 5 minutos**; si el objeto no está en
   el bucket (un fichero de antes de esta spec), 404 — no 502.
4. El correo de check-in adjunta los documentos desde la memoria de la petición, sin volver a leerlos.
5. Un rechazo o fallo después de subir no deja huérfanos en el bucket (igual que hoy con el disco); reemplazar un
   voucher borra el anterior.
6. Las rutas de avatar multipart se eliminan **(pendiente de confirmar, ver tasks)**.

## Cómo se comprueba

- `check:prisma` en verde.
- `test:aislamiento-api` (con permiso, toca la BD): el bloque A9 ya cubre subir un voucher, abrirlo sin sesión
  (401), con otra agencia (404) y con la propia (200 — `fetch` sigue el 302 hasta Storage).
- `test:vuelos-api` (con permiso): el check-in con correo sigue saliendo.
- `grep -rn "uploads" backend/src` solo deja la ruta `/uploads` y el formato de la referencia; nada de `fs`.
- En Render: subir un voucher, redeployar y abrirlo de nuevo.
