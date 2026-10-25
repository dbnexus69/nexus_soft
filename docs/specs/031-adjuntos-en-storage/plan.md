# Plan — Spec 031

- **`utils/almacenamiento.js`:** `adjuntos` en `BUCKETS` (privado, 5 MB, jpg/png/pdf/doc/docx). La limpieza de
  pruebas (`tests/montaje.js::limpiarAlmacenamiento`) recorre `BUCKETS`, así que lo cubre sola.
- **`middleware/upload.js`:** `multer.memoryStorage()` en vez de `diskStorage`; el mismo `fileFilter` y límite. Un
  `nombreUnico(file)` exportado (`<Date.now()>-<aleatorio><ext>`, el formato de hoy) para que los dos llamadores
  nombren igual.
- **`controllers/products.controller.js` (`uploadVoucher`):** `subir('adjuntos', nombre, file.buffer, file.mimetype)`
  después de comprobar la venta, guardar `/uploads/<nombre>`, borrar el anterior del bucket; si algo falla tras
  subir, borrarlo. Fuera `fs`, `CARPETA` y `borrarFichero` de disco.
- **`services/flights.service.js` (`updateCheckin` / `_enviarCheckin`):** subir los ficheros antes del correo;
  adjuntar con `content: f.buffer`; si el correo no sale (el 400 que ya existe) o la transacción falla, borrar lo
  subido. `docs` mantiene `{ url: '/uploads/<nombre>', filename }`.
- **`routes/uploads.routes.js`:** misma consulta; `res.redirect(302, await firmar('adjuntos', fichero, 300))`, y 404
  si el objeto no existe (`existe()` antes de firmar).
- **Avatares (si se confirma):** quitar las dos rutas, los dos `uploadAvatar` del controlador y del servicio.
- **`tests/montaje.js`:** quitar el bucle que borra ficheros de `uploads/` en disco (ya no hay).
- **`backend/uploads/`:** quitar `.gitkeep` y la línea del `.gitignore`; el PDF suelto y las carpetas viejas son de
  desarrollo y se dan por perdidos (pendiente de confirmar).
- **Bucket:** crearlo a mano en Supabase Storage, como los demás (`pnpm storage:buckets` apunta a
  `scripts/crear-buckets.js`, que no está en el repo — `scripts/` está en `.gitignore`).
- **Docs:** CLAUDE.md (línea de despliegue y la nota de uploads en Tenancy), README (sección Storage), spec 030 T6.
