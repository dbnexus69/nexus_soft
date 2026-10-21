# Tareas — Spec 021

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-20).** Implementada de punta a punta (T2-T3, T5-T7); verificada sin tocar la base (`node --check`,
`require` de cada módulo nuevo, un PDF de prueba generado en memoria con una imagen incrustada, `tsc`,
`check:prisma`). **Pendiente:** T1 (crear el bucket real en Supabase), T4 (correr la prueba — toca la base, pide
permiso), y ver todo en pantalla.

## T1 · Bucket y utilidades de almacenamiento `[~]`

Código listo: entrada `cotizacion-imagenes` en `BUCKETS` (`backend/src/utils/almacenamiento.js`) y
`middleware/uploadQuoteImage.js` (multer en memoria, mismo patrón que `uploadLogo.js`). **Pendiente:** el `pnpm
storage:buckets` que crea buckets automáticamente no existe de verdad (el script está en `package.json` pero el
archivo `scripts/crear-buckets.js` nunca se creó — huérfano de antes de esta spec, no es de acá) — hay que crear
`cotizacion-imagenes` a mano en el panel de Supabase Storage, con permiso, antes de poder usar la función.

## T2 · Backend: subir y borrar imágenes de una línea `[x]`

`quotes.service.js` (`addLineImage`/`removeLineImage`), rutas (`POST`/`DELETE
/quotes/:id/lines/:lineId/images[/:indice]`) y controlador. Comprobaciones de escritura iguales a las que ya tiene
`updateQuote` (visible, editable, no cerrada); la línea tiene que ser de esa cotización; tope de 5; sube el archivo
primero y si falla escribir `detalle.images` lo borra, para no dejar un huérfano. `paramsUuid(router, 'lineId')`
nuevo en `numericParams.js` ya existente, usado tal cual.

## T3 · Backend: URLs firmadas al leer `[~]`

`getQuoteById(id, alcance, { resolverImagenes })` resuelve cada ruta a una URL firmada de 5 minutos antes de
responder — **desviación del plan**: solo ahí, no en `listQuotes` (el listado de `Quotes.tsx` no muestra ninguna
imagen; firmar las de cada línea de cada cotización de cada página habría sido puro desperdicio). El PDF
(`services/quotes/index.js`) pide la cotización con `resolverImagenes: false` a propósito: necesita la ruta cruda
para descargar los bytes con el service role, y además una URL firmada cambia en cada pedido, lo que habría roto la
caché por huella de contenido del PDF.

## T4 · Prueba por la API `[~]`

Escrita en `tests/cotizacion-imagenes-api.js` (`pnpm test:cotizacion-imagenes`, agregado a `package.json`): sube,
tipo inválido (422), tope de 5 (sexta → 400), ajena (404), línea de otra cotización (404), cotización aceptada
(400), borra, índice inválido (400), y que el PDF no falla con una imagen incluida. **Pendiente:** correrla de
verdad — toca la base y necesita el bucket de T1 ya creado; sin ninguno de los dos, no se pudo ejecutar todavía.

## T5 · Pantalla: campo compartido de imágenes `[x]`

`ImagesField` (en `forms/VoucherField.tsx`, junto a `FinancialSection`): miniaturas, borrar, agregar, tope de 5,
"Guardá la cotización primero" sin `lineId`. Los 15 `forms/*.tsx` lo agregan envuelto en `{cotizando && (...)}` — el
único campo de cada formulario que se muestra así y no al revés. `Quotes.tsx::openEdit` lleva el `lineId` de cada
línea ya guardada metido en el propio objeto del producto (`{ ...linea.detalle, lineId: linea.id }`); `handleSave`
lo saca antes de mandar el cuerpo a la API, para que no quede guardado dentro de `detalle` (sería un id viejo en
cuanto se reemplacen las líneas al guardar otra vez). `ProductFormsModal.tsx` recibe `quoteId` de `Quotes.tsx` y
cada uno de los 15 casos del `switch` le pasa `lineId={form.<categoría>[activeIdx]?.lineId}` al formulario.

## T6 · PDF `[x]`

`services/quotes/plantilla.js` (`bloqueImagenes`) incrusta las imágenes de cada línea debajo de su bloque de
detalle, con los `Buffer` que `services/quotes/index.js::imagenesDeLineas` descarga en paralelo antes de generar el
documento. Probado generando un PDF en memoria (hotel con 2 imágenes de prueba) sin tocar la base: 22.861 bytes sin
excepciones.

## T7 · Vista de "ver" `[x]`

`components/sales/detail/ServiceRow.tsx`: fila de miniaturas (enlaces a tamaño completo) genérica debajo del
`Detalle` de cada categoría, leyendo `item.images` — sin tocar `serviceShapes.tsx`, que no necesitaba saber nada de
esto.

## T8 · Documentación `[x]`

`backend/CLAUDE.md`, `frontend/CLAUDE.md` (el campo es exclusivo de cotizar, nunca de una venta real) y `README.md`
(lista de specs) actualizados.

---

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-20 | T2-T8 | Implementada de punta a punta: endpoints de subir/borrar, URLs firmadas solo al leer una cotización (no en el listado), PDF con las imágenes incrustadas, `ImagesField` compartido en los 15 formularios con el `lineId` llevado desde `Quotes.tsx`, miniaturas en la vista de "ver". Verificado sin tocar la base (`tsc`, `check:prisma`, `node --check`, un PDF de prueba con imagen). Pendiente: crear el bucket real, correr la prueba de API (las dos piden permiso/acceso a Supabase) y verlo en pantalla. |
| 2026-10-20 | — | Diseño completo vía `/brainstorming` con el usuario: alcance (15 categorías), origen de la imagen (subida manual, no galería), cantidad (hasta 5), dónde se ve (pantalla y PDF), y que es exclusivo de cotizar (no de una venta real). Spec y plan escritos; nada implementado. |
