# Tareas — Spec 040

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-11-07).** Implementada y verificada con datos sintéticos; falta aplicar la migración
contra la base (necesita permiso) y que el usuario confirme con una imagen real.

## T1 · Migración y columnas `[x]`

`voucher_encabezado_imagen`/`voucher_pie_imagen` en `empresas`, aditivas, mismo patrón que `logo_url`
(`empresas` ya tiene RLS). `npx prisma validate` en verde.

## T2 · Subida de las imágenes (backend) `[x]`

`perfilEmpresa.service.js::subirImagen` generaliza lo que antes era solo `guardarLogo` (mismo bucket
`logos`, mismo hash de contenido, mismo borrado del archivo anterior); `guardarImagenEncabezado`/
`guardarImagenPie` son wrappers de una línea. Rutas nuevas bajo `/company-profile`, solo
`soloAdminDeLaEmpresa` (igual que el logo y el resto del perfil). `node --check` en verde.

## T3 · Plantilla del voucher: imágenes a ancho completo `[x]`

Primera versión: `header`/`footer` de pdfmake con un alto fijo (130pt encabezado, 45pt pie) y `fit`. El
usuario reportó que la imagen de pie no cubría ni la mitad del ancho — el alto fijo era más alto que la
proporción real de su imagen, así que `fit` la encogía en vez de dejarla a ancho completo. Corregido
calculando el alto de la proporción REAL de cada imagen (`dimensionesImagen.js`, lee PNG/JPEG/WebP de su
cabecera, sin dependencias), acotado entre un mínimo y un máximo. Probado con `generar()` directamente
(sin servidor) con 4 proporciones sintéticas (panorámica 1200×160, vertical 300×900, cuadrada 500×500, y
~1018×230 — la proporción real del caso reportado): las cuatro generan sin error; las panorámicas calculan
`fit` a ancho completo (612pt), las verticales/cuadradas quedan acotadas por el alto máximo (correcto:
no hay forma de que una imagen cuadrada cubra todo el ancho sin volverse altísima). `node --check` y
`check:prisma` en verde.

## T4 · Pantalla "Mi empresa" `[x]`

Tarjeta "Encabezado y pie del voucher" junto a "Logo y colores", mismo patrón de subida (input de
archivo oculto, preview, estado de carga). `pnpm build` en verde.

## T5 · Aplicar contra la base `[ ]`

Pendiente — necesita permiso para `migrate deploy` + `db:generate` (y, si el backend está corriendo,
pararlo primero por el `EPERM` de Windows con el motor de Prisma).

---

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-11-07 | — | A pedido del usuario (algunas agencias ya tienen su propio diseño de voucher): se evaluó dejar subir un PDF propio y se descartó (pierde la garantía de que el voucher refleja la venta real); se acordó imágenes de encabezado/pie sobre la plantilla existente. |
| 2026-11-07 | T1-T4 | Implementado. `tsc`/`pnpm build` y `node --check` en verde; `check:prisma` pendiente de `db:generate` (ver T5). |
| 2026-11-07 | T3 | El usuario pidió que las imágenes "acoplen literal en todas las esquinas" — version con `content` y margen normal no llegaba al borde; se cambió a `header`/`footer` de pdfmake. |
| 2026-11-07 | T3 | El usuario subió una imagen real de pie y reportó que no cubría ni la mitad del ancho — diagnosticado como el alto fijo (45pt) siendo mayor que lo que la proporción real de esa imagen permitía a ancho completo, así que `fit` la encogía. Corregido calculando el alto de la proporción real de cada imagen en vez de un número a ojo (`dimensionesImagen.js`), con mínimo y máximo. Verificado con 4 proporciones sintéticas sin servidor (sin forma de ver el PDF renderizado en este entorno) — pendiente que el usuario confirme con su imagen real. |
