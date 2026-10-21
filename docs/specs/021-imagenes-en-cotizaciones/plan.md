# Plan — Spec 021

Orden: bucket → backend (subir, borrar, leer) → pruebas de API → pantalla (campo compartido, PDF, vista de "ver").
Cada paso deja la aplicación funcionando: mientras no exista el campo en pantalla, los endpoints nuevos simplemente
no los llama nadie.

## Decisiones

1. **Bucket nuevo, no reutilizar `quotes`.** El bucket `quotes` ya existe para el PDF (`application/pdf` únicamente,
   spec 007); mezclar tipos de archivo en el mismo bucket complicaría `allowedMimeTypes`. `cotizacion-imagenes`
   aparte, mismo patrón que `logos`/`vouchers`/`quotes` en `backend/src/utils/almacenamiento.js::BUCKETS`.
2. **Subida en memoria, no a disco.** El mecanismo existente de `voucher_url` (vouchers de producto en una venta)
   usa `multer` con disco local (`middleware/upload.js`) — es el patrón viejo que spec 011 dejó de usar para los
   logos. Esta spec sigue el camino de spec 011: `multer.memoryStorage()` + `almacenamiento.subir(bucket, ruta,
   buffer, tipo)`, nunca tocando el disco del servidor.
3. **Ruta del archivo, no la URL firmada, es lo que se guarda.** Igual que con los logos: una URL firmada expira
   (5 minutos en el patrón de `quotes`); lo único estable para guardar es la ruta dentro del bucket. La URL se
   genera al leer, nunca al escribir.
4. **Un archivo por llamada,** como ya hace `uploadProductVoucher`. Sin subida múltiple en una sola petición: más
   simple de validar (tope de 5, tipo, tamaño) y de mostrar el progreso en pantalla.
5. **`detalle.images` se escribe con `tx.detalle_cotizacion.update` dentro de la misma `transaccion` que mueve el
   archivo.** Orden: subir el archivo primero (si falla, no se tocó nada); si falla escribir `detalle`, borrar el
   archivo recién subido antes de responder con el error (riesgo anotado en la spec).
6. **El límite de 5 se comprueba leyendo `detalle.images.length` de la línea antes de aceptar la subida** (no un
   contador aparte): una sola fuente, consistente con que la cotización entera es "lo que hay en `detalle`".
7. **Componente de pantalla nuevo, `ImagesField.tsx`**, junto a `FinancialSection` en `forms/VoucherField.tsx`: recibe
   `images: string[]` (URLs ya firmadas, resueltas por el backend), `quoteId`/`lineId` (o `undefined` si la línea
   todavía no tiene id del servidor, caso en que se deshabilita con el aviso "Guardá la cotización primero"),
   `onChange` para refrescar la lista local tras subir/borrar. Llama directo a la API nueva (no pasa por el
   `onChange(updates)` genérico del formulario, porque no es un campo que se guarde junto con el resto al dar
   "Guardar" — sube y borra al toque, como ya hace `uploadProductVoucher` con los vouchers de producto).
8. **`Quotes.tsx` necesita saber el `lineId` de cada producto que ya está guardado.** Hoy el array de líneas
   (`editing.lines`) tiene `id` (el de `detalle_cotizacion`) pero el array de productos en `draft`
   (`draft.hotels`, `draft.tickets`...) no lo lleva — se construye desde `line.detalle` en `openEdit`, sin su `id`.
   Hay que llevar ese `id` junto con el `detalle` al armar `draft` (ej. un campo `_lineId` no enumerado en el tipo
   de producto, o un mapa paralelo `índice → lineId` en el estado de `Quotes.tsx`) para poder pasárselo a
   `ImagesField`. Un producto recién agregado (todavía sin guardar) no tiene `lineId`.

## Pasos

| Paso | Dónde | Qué |
|---|---|---|
| 1 | Supabase Storage (a mano, por consola) | Crear el bucket `cotizacion-imagenes` (privado, tipos y tamaño de la spec) |
| 2 | `backend/src/utils/almacenamiento.js` | Entrada nueva en `BUCKETS` |
| 3 | `backend/src/middleware/upload.js` (o una variante nueva junto a él) | Multer en memoria para este caso, con el mismo límite de tamaño/tipo que el bucket |
| 4 | `backend/src/services/quotes.service.js` | `addLineImage(quoteId, lineId, alcance, {buffer, mimetype})` y `removeLineImage(quoteId, lineId, indice, alcance)`: comprobaciones de escritura (`cotizacionVisible`, estado), tope de 5, subir/borrar + `transaccion` con el `update` de `detalle` |
| 5 | `backend/src/controllers/quotes.controller.js`, `backend/src/routes/quotes.routes.js` | `POST /quotes/:id/lines/:lineId/images`, `DELETE /quotes/:id/lines/:lineId/images/:indice` |
| 6 | `backend/src/services/quotes.service.js` (`mapCotizacion`/`getQuoteById`/`listQuotes`) | Resolver cada ruta de `images` a una URL firmada antes de devolver la línea |
| 7 | `backend/tests/` (nuevo, mismo arnés que `tests/voucher-api.js`) | Subir, tope de 5, borrar, ajena → 403/404, cotización cerrada → 400, PDF con imágenes no falla |
| 8 | `frontend/src/api/quotes.ts` | `uploadQuoteLineImage`, `deleteQuoteLineImage` |
| 9 | `frontend/src/components/sales/forms/VoucherField.tsx` (o archivo propio junto a él) | `ImagesField.tsx` nuevo |
| 10 | Los 15 `forms/*.tsx` | `{cotizando && <ImagesField ... />}` en cada uno |
| 11 | `frontend/src/pages/Quotes.tsx`, `wizardData.ts`/tipos | Llevar el `lineId` de cada producto guardado hasta el formulario (decisión 8) |
| 12 | `backend/src/services/quotes/plantilla.js` | Descargar e incrustar las imágenes de cada línea bajo su bloque de detalle |
| 13 | `frontend/src/components/sales/detail/serviceShapes.tsx` (o `ServiceRow.tsx`) | Fila de miniaturas genérica, debajo del `Detalle` de cada categoría |
| 14 | Docs | `tasks.md` de esta spec; `backend/CLAUDE.md` y `frontend/CLAUDE.md` (el campo de imágenes, exclusivo de cotizar); README (lista de specs) |

## Qué hace falta del usuario

- Crear el bucket en Supabase (paso 1) — no lo cubre ninguna migración.
- Permiso para correr la prueba de API nueva (toca la base) cuando llegue el momento.
- La prueba en pantalla.
