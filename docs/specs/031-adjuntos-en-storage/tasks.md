# Tareas — Spec 031

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-28).** Completada: bucket creado y suites con BD en verde (T8). Los documentos de check-in, solo en pantalla.
Decisiones del usuario: las rutas de avatar multipart se eliminan; los ficheros viejos de `backend/uploads/` se dan
por perdidos.

- [x] T1 · Bucket `adjuntos` en `BUCKETS` (5 MB, jpg/png/pdf/doc/docx); `upload.js` a `memoryStorage` con
  `nombreUnico` exportado.
- [x] T2 · Voucher del proveedor al bucket (`products.controller.js`): sube tras comprobar la venta, borra el
  anterior, y borra lo subido si algo falla después.
- [x] T3 · Check-in (`flights.service.js`): sube los ficheros **antes** del correo (nunca sale un correo con
  adjuntos que luego no queden guardados), adjunta desde `f.buffer`, y cualquier fallo (correo, transacción)
  borra lo subido. Se quitó `error_adjunto`: ya no hay lectura de disco que pueda fallar.
- [x] T4 · `GET /uploads/:fichero`: misma consulta de autorización; 404 si el objeto no está en el bucket, si no 302 a
  URL firmada de 5 min.
- [x] T5 · Fuera `PUT /clients/:id/avatar` y `PUT /users/:id/avatar` (rutas, controladores, servicios).
- [x] T6 · `backend/uploads/.gitkeep` fuera del repo, `.gitignore` ignora `uploads/` entero; `tests/montaje.js` ya no
  borra en disco (la limpieza de buckets recorre `BUCKETS` y cubre `adjuntos`).
- [x] T7 · CLAUDE.md, README (Storage y Despliegue), spec 032 T6.
- [x] T8 · `node --check` de todo lo tocado y `require('./src/routes')` en verde. `check:prisma` sale en rojo **igual
  que antes del cambio** (comprobado con `git stash`): el cliente generado en local no tiene `cliente_destinos` ni
  `cotizaciones`; se arregla con `db:generate` (toca la BD). Pendiente, con permiso del usuario: crear el bucket
  `adjuntos` en Supabase, `db:generate`, `test:aislamiento-api` (bloque A9) y `test:vuelos-api`.
  **Hecho (2026-10-28):** bucket `adjuntos` creado por el usuario; `check:prisma` limpio (el cliente ya se había
  regenerado); `test:aislamiento-api` "Todo en orden", bloque A9 completo contra `adjuntos` (subir, 401 sin sesión,
  404 otra agencia, 200 propia, alcance del asesor); `test:vuelos-api` "Todo en orden". **Sin cubrir por la API:**
  `test:vuelos-api` registra el check-in sin archivos, así que subir documentos de check-in a `adjuntos` solo se
  comprueba en pantalla (mismo `middleware/upload.js` y mismo bucket que los vouchers, que sí pasan).
