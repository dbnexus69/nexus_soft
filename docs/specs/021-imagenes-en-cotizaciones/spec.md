# Spec 021 — Imágenes en los servicios de una cotización

**Estado:** completada (2026-10-28): bucket, prueba de API y pantalla cerrados en la [`023`](../023-cerrar-imagenes-en-cotizaciones/tasks.md) · **Rama:** `feat-dbmoon` · **Toca la base compartida:** no (bucket nuevo en Supabase Storage, sin
migración de esquema) · **Relacionadas:** [`007`](../007-cotizaciones/spec.md) (cotizaciones;
T14-T16 son el precedente directo: el mismo `detalle` por categoría, la misma pantalla de "ver" y el mismo PDF que
esta spec extiende), [`011`](../011-perfil-y-voucher-de-la-empresa/spec.md) (primer uso de Supabase Storage con
buckets privados y URLs firmadas — el patrón que sigue esta spec)

## Por qué

El usuario quiere que el cliente vea cómo es el servicio que está cotizando (p. ej. un hotel), no solo leer su
descripción. Hoy una cotización no admite ningún archivo.

## Qué se quiere (confirmado con el usuario, brainstorming 2026-10-20)

1. **Las 15 categorías**, no solo Hotel (que fue el ejemplo que lo disparó): un mismo campo de imágenes disponible
   en los 15 formularios, igual que ya pasa con "Observaciones".
2. **El asesor las sube a mano**, un archivo a la vez, desde su computador — no hay galería ni catálogo reutilizable
   de fotos por proveedor/hotel.
3. **Hasta 5 imágenes por servicio** (por línea de la cotización), en miniatura.
4. **Se ven en los dos canales**: en la pantalla (vista de "ver", T15/T16) y en el PDF que se descarga.
5. **Exclusivo de cotizar.** El mismo formulario de cada categoría lo usan también una venta real (`cotizando`
   oculta ahí los campos de identidad/reserva que no existen todavía) y una cotización — pero el campo de imágenes
   se muestra **solo mientras se cotiza** (`{cotizando && (...)}`, al revés de los demás campos de ese prop), nunca
   al vender directamente.

## Fuera de alcance

- Galería o catálogo de fotos reutilizable por proveedor, hotel o paquete.
- Que las imágenes sobrevivan a convertir la cotización en venta: el formulario de venta no tiene este campo
  (decisión 5), así que al convertir se ignoran, igual que ya se ignora cualquier otro campo que la venta real no
  pide.
- Limpieza automática de imágenes huérfanas (cotización borrada, o línea quitada antes de guardar): queda anotado
  como límite conocido, no se resuelve en esta entrega.
- Reordenar o recortar/editar la imagen ya subida; ampliar en un visor propio (alcanza con abrirla en una pestaña
  nueva).

## Diseño

### Datos

- **Bucket nuevo en Supabase Storage**, `cotizacion-imagenes`: privado, `image/png`/`image/jpeg`/`image/webp`,
  3 MB máximo por archivo (mismo orden que `logos`, que hoy tiene 2 MB). Hay que crearlo una vez a mano en Supabase
  (`prisma migrate deploy` no lo cubre — mismo aviso que ya deja `almacenamiento.js` para `quotes`).
- **Sin columna ni tabla nueva.** Cada imagen sube bajo `<empresa>/<cotizaciónId>/<líneaId>/<uuid>.<ext>`; la ruta
  (no la URL firmada, que expira) se agrega a un array `images: string[]` dentro del mismo JSON `detalle` de esa
  línea en `detalle_cotizacion` — el mismo objeto donde ya viven `ta`, `costo_proveedor` y todos los campos propios
  de la categoría (`TicketData`, `HotelData`...).
- Al leer una cotización (`GET /quotes/:id`, y el listado), cada ruta guardada se resuelve a una URL firmada de
  corta duración antes de mandarla al navegador — igual que ya se hace con el PDF (`urlDeDescarga`); nunca se
  expone la ruta cruda del bucket.

### API

- `POST /quotes/:id/lines/:lineId/images` (multipart, un archivo por llamada, campo `image`). Valida, en este
  orden: la cotización existe y es escribible por quien pide (`cotizacionVisible(id, alcance, {paraEscribir:
  true})` + no estar `aceptada`/`rechazada`, igual que ya exige actualizar una cotización); la línea (`lineId`)
  pertenece a esa cotización; todavía tiene menos de 5 imágenes; el archivo cumple tipo y tamaño. Sube el archivo al
  bucket y agrega su ruta a `detalle.images` de esa línea, en una `transaccion`. Responde con la línea actualizada
  (o al menos la nueva ruta y su URL firmada).
- `DELETE /quotes/:id/lines/:lineId/images/:indice` — mismas comprobaciones de escritura; borra el archivo del
  bucket y lo saca de `detalle.images` en el mismo índice.
- Una cotización **nueva, sin guardar todavía**, no tiene `lineId` del servidor (los ids de línea los asigna
  `quotes.service.js` al crear, igual que hoy): subir imágenes en una línea así queda deshabilitado en pantalla con
  un aviso, hasta guardar la cotización por primera vez. Es la misma limitación que ya tiene el asistente de venta
  con los vouchers de producto (`NewSaleWizard.tsx`): un archivo no puede viajar en el cuerpo de la petición antes
  de que exista el id al que pertenece.

### Pantalla

- **Componente nuevo y compartido** (al lado de `FinancialSection` en `forms/VoucherField.tsx`, o un archivo propio
  junto a él): miniaturas de las imágenes que ya tiene esa línea, cada una con su botón de borrar, más "Agregar
  imagen" (deshabilitado al tope de 5, o si la línea aún no tiene `lineId`). Cada uno de los 15 `forms/*.tsx` lo
  agrega envuelto en `{cotizando && (...)}` — el único campo de todo el formulario que se muestra así y no al
  revés —, en un lugar razonable (cerca de "Observaciones" donde exista, o al final del bloque principal).
- **PDF** (`services/quotes/plantilla.js`): cada imagen de una línea se descarga del bucket al generar el PDF y se
  incrusta debajo de su bloque de detalle — mismo mecanismo que ya usa el logo de la agencia (`logo: Buffer`).
- **Vista de "ver"** (`ServiceRow`/`serviceShapes.tsx`, spec 007 T15/T16): una fila de miniaturas debajo del
  `Detalle` de cada servicio, genérica para las 15 categorías (lee `item.images`, no hay que tocar cada forma por
  separado).

## Cómo se comprueba

- Prueba por la API (agencia desechable, mismo arnés que `tests/montaje.js`): crear una cotización, subir una
  imagen a una de sus líneas (200, `images` con 1 ruta), subir hasta 5 (la sexta → 400), borrar una (vuelve a 4),
  subir a una línea de otra cotización ajena (403/404 según corresponda), subir a una cotización `aceptada` (400,
  igual que editarla), generar el PDF y confirmar que no falla con imágenes incluidas.
- `check:prisma` (no debería tener nada que revisar, sin columnas nuevas), `tsc`.
- En pantalla: subir, ver la miniatura, borrarla, ver el tope de 5, y confirmar que una venta real (sin cotizar)
  nunca muestra este campo.

## Riesgos

- **Dos sitios nuevos que mantener sincronizados con la realidad del bucket:** el array `images` en el JSON y los
  archivos del bucket pueden desalinearse si algo falla a mitad de camino (sube el archivo pero la escritura en
  `detalle` falla, o viceversa). Mitigación: subir primero, escribir el JSON después, dentro de una `transaccion`;
  si la escritura falla, borrar el archivo que se acababa de subir antes de responder con el error.
- **Imágenes huérfanas** de cotizaciones borradas o de líneas quitadas antes de guardar: aceptado como límite
  conocido (ver "Fuera de alcance"); si crece en volumen, un futuro trabajo de limpieza por lotes podría recorrer
  el bucket contra lo que de verdad referencian las cotizaciones vivas.
- **El PDF tarda más** cuantas más imágenes tenga que descargar y incrustar; con el tope de 5 por línea no debería
  notarse, pero si una cotización tiene muchas líneas con 5 imágenes cada una, vale la pena medirlo al implementar.
