# Spec 040 — Imágenes propias de encabezado y pie del voucher

**Estado: implementada, sin commit.** · **Toca la base compartida:** sí (una migración chica, aditiva) ·
**Relacionadas:** 011 (voucher y "Mi empresa")

## Qué y por qué

Varias agencias ya tienen su propio diseño de voucher (un encabezado y un pie con su propia imagen) y
piden poder usarlo tal cual, en vez de conformarse con logo + 3 colores. El voucher sigue siendo el
mismo documento generado en el servidor (spec 011, `services/voucher/plantilla.js`): lo que cambia es
que, si la agencia sube su propia imagen, esa imagen reemplaza (encabezado) o se agrega (pie) a lo que
ya había — el cuerpo (tramos, pasajeros, precios, términos) no se toca nunca, porque es lo único que
garantiza que el voucher siempre coincide con los datos reales de la venta.

## Decisiones (de la conversación con el usuario)

1. **Solo imágenes de banner, no un PDF/plantilla libre.** Se evaluó dejar que la agencia suba su propio
   PDF ya armado (sin datos dinámicos) y se descartó: perdería la garantía de que el voucher siempre
   refleja la venta real. La mayoría de los que piden "ya tengo mi diseño" se refieren al encabezado y al
   pie — eso es lo que se construyó.
2. **La imagen de encabezado reemplaza entera la banda de color + logo + nombre.** No se superponen: o
   se usa el diseño de Nexus (logo + colores) o el propio, nunca los dos a la vez.
3. **La imagen de pie se agrega, no reemplaza.** `voucher_pie` (el texto legal/de contacto) sigue
   viéndose; la imagen de pie es puramente decorativa, debajo de ese texto.
4. **Las dos deben tocar las 4 esquinas de la hoja de verdad** (pedido explícito tras la primera versión,
   que las dejaba con el margen de 36pt del cuerpo del documento, y por eso una imagen angosta se veía
   mal). Se resolvió con `header`/`footer` de `pdfmake`, que dibujan de borde a borde de la página — es
   la única forma de lograrlo, `content` siempre respeta los márgenes.
5. **El alto de cada imagen se calcula de su proporción real, no un número fijo** (segundo pedido, tras
   un bug real: con un alto fijo, una imagen menos "panorámica" que ese número quedaba angosta en vez de
   ocupar todo el ancho). Se lee el ancho/alto reales de la cabecera del archivo (PNG/JPEG/WebP, sin
   decodificar los píxeles) y se calcula el alto que le corresponde a esa imagen para el ancho completo
   de la página, acotado entre un mínimo y un máximo para que una imagen muy vertical no se coma media
   página.
6. **Solo "Mi empresa", nunca desde el panel de Empresas del superadministrador.** Cada agencia sube la
   suya sobre su propia fila (`soloAdminDeLaEmpresa`), igual que ya hace con el logo — no se abrió ningún
   camino nuevo para que el superadministrador suba o vea esto de otra agencia.

## Qué se guarda

`empresas.voucher_encabezado_imagen` / `voucher_pie_imagen` (`String?`, nombre del archivo en el bucket
`logos`, igual que `logo_url`) — no las imágenes en sí en una tabla, el archivo vive en Storage.

## Cómo se comprueba

- "Mi empresa" → "Encabezado y pie del voucher": subir una imagen de cada una, PNG/JPG/WebP hasta 2 MB;
  la vista previa del voucher (ya existente) muestra el resultado antes de guardar nada más.
- Sin ninguna imagen subida, el voucher se ve exactamente igual que antes de esta spec.
- Con encabezado subido, la banda de color + logo + nombre desaparece y la imagen ocupa todo el ancho,
  tocando las dos esquinas de arriba.
- Con pie subido, aparece debajo del texto de `voucher_pie`, tocando las dos esquinas de abajo.
- Generar el mismo voucher con imágenes de proporciones muy distintas (panorámica, cuadrada, vertical)
  no lanza error ni corta el documento — probado con 4 proporciones sintéticas, incluida una real de
  ~1018×230 (confirma T3 de `tasks.md`).
