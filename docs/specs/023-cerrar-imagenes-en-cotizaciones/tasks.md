# Tareas — Spec 023

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-21).** Hechas T1–T6 (T3 confirmada en pantalla por el usuario). T7 confirmada en pantalla por el usuario.

## T1 · Crear el bucket `cotizacion-imagenes` `[x]` (configuración del panel confirmada por el usuario, 2026-10-28)
Intento por MCP (2026-10-21): la cuenta conectada solo ve el proyecto `andERP-prod`; sobre `wzuipxghojvcuxonbzfz`
responde "You do not have permission". No se tocó `andERP-prod`. El usuario lo creó a mano en el panel.
**Comprobado por T2:** existe, recibe subidas y entrega URLs firmadas. **Por confirmar:** que sea privado, con
3 MB y los tres tipos (no se pudo leer `storage.buckets` sin el MCP; se ve en el panel). El GIF lo rechaza el
backend (422) antes de llegar a Storage, así que la prueba no confirma el filtro del bucket.

## T2 · `pnpm test:cotizacion-imagenes` `[x]`
Primera corrida (usuario y Claude): 2 fallas, "llegó a 5 imágenes → 4" y "una sexta imagen se rechaza → 201".
Era la prueba, no el código: subía 1 + 3 imágenes y esperaba 5, así que la "sexta" era la quinta y entraba bien
(el tope de `quotes.service.js`, `MAX_IMAGENES_POR_LINEA = 5`, es correcto). Corregido el bucle a 4 en
`tests/cotizacion-imagenes-api.js` (archivo de la 021: se le avisa a Darío en T4). **Verificado:** segunda
corrida "Todo en orden", agencias de prueba desmontadas.
## T3 · Pruebas en pantalla `[x]` (recorrida por el usuario el 2026-10-21: todo ok; en el PDF las fotos se salían de la página, ver T7)

Con `pnpm dev` en `backend/` y `frontend/`, como admin. Marcar ok/falla en cada paso:

1. Crear una cotización con un hotel y **guardarla**. Abrirla para editar: el campo de imágenes del hotel se ve
   (antes de guardar dice que primero hay que guardar la cotización).
2. Subir una foto PNG o JPG: aparece la miniatura.
3. Subir hasta 5: con 5, el botón de agregar desaparece o avisa del tope.
4. Intentar un GIF o un archivo de más de 3 MB: mensaje de error en pantalla, sin miniatura nueva.
5. Borrar una miniatura: desaparece y queda una menos.
6. Cerrar y abrir la cotización en modo "ver": las fotos aparecen bajo el detalle del hotel y abren a tamaño completo.
7. Descargar el PDF: las fotos salen debajo del bloque del hotel.
8. **Guardar otra vez la cotización con fotos y esperar más de 5 minutos**; volver a abrirla en "ver" y bajar el
   PDF. Las fotos siguen viéndose y salen en el PDF (era el defecto de T5, ya arreglado).
9. Duplicar la cotización: la copia trae las mismas fotos. Borrar una foto en la copia; abrir el original en
   "ver": la suya sigue viéndose (T6).
10. Editar el original, quitar el hotel (o todas sus fotos) y guardar: en Supabase → Storage →
    `cotizacion-imagenes` → carpeta `<id de la agencia>/<id de la cotización>`, esos archivos ya no están (T6).
11. Como asesor: en una cotización de otro asesor no se puede subir ni borrar fotos.
12. Convertir en venta: el asistente de venta abre sin errores y la venta se registra (las fotos no pasan a la venta).

## T4 · Nota para Darío `[x]`
Redactada en el chat el 2026-10-21 (bucket creado, prueba corregida y en verde, defecto de T5, lista de T3).

## T5 · Guardar una cotización con fotos guarda las URLs firmadas en vez de las rutas `[x]`

**Arreglado (2026-10-21, por orden del usuario):** `quotes.service.js::imagenesConocidas`. `lineasDe(body,
guardadas)` vuelve cada foto del cuerpo a su ruta (la propia ruta, o una URL firmada cuyo camino termina en ella) y
conserva solo las que ya estaban en las líneas de esa cotización, sin repetidas y con el tope de 5; el resto se
descarta. `updateQuote` lee esas rutas antes de reescribir; `createQuote` no pasa ninguna, así que una cotización
nueva nunca guarda fotos que lleguen en el cuerpo. **Verificado:** caso nuevo en `tests/cotizacion-imagenes-api.js`
(PUT con el `detalle` del GET más una ruta inventada → 200 y 1 foto firmada; el PDF de después, 200) y
`pnpm test:cotizacion-imagenes` "Todo en orden". Sin el arreglo, la ruta inventada quedaba guardada y el GET
fallaba al firmarla. Los archivos que quedaban huérfanos al guardar se cubren en T6.

## T6 · Archivos huérfanos al guardar y fotos compartidas al duplicar `[x]`

Al cubrir los huérfanos apareció otro defecto de la 021: `duplicateQuote` copiaba `detalle.images` tal cual, así
que copia y original apuntaban a los mismos archivos y borrar una foto en una rompía la otra (ya pasaba con
`removeLineImage`). Decisión del usuario (2026-10-21): **copiar los archivos**.
- `almacenamiento.copiar(bucket, desde, hacia)`: copia dentro de la carpeta de la empresa, sin bajar el archivo.
- `duplicateQuote`: las líneas nuevas nacen sin fotos; después de la transacción se copia cada foto a
  `<copia>/<línea nueva>/<uuid>.<ext>` y se escribe en su línea. Si una copia falla, esa línea queda sin fotos,
  se borran las que alcanzaron a copiarse y se registra `[QUOTE_IMAGE_COPY_FAILED]`.
- `updateQuote`: después de confirmar la escritura, borra del bucket las rutas que estaban guardadas y ya no están
  en ninguna línea; un fallo solo se registra (`[QUOTE_IMAGE_DELETE_FAILED]`), no tumba el guardado.
- Seguro porque `ImagesField` actualiza el formulario con la respuesta de cada subida/borrado (`VoucherField.tsx`
  380/393) y el modal se cierra al guardar (`Quotes.tsx:244`): lo que viaja al guardar es la lista real.
- Borrar una cotización es lógico (`deleted_at`): sus fotos se quedan, a propósito.

**Verificado:** cuatro casos nuevos en `tests/cotizacion-imagenes-api.js` (duplicar trae la foto, la copia tiene su
propio archivo en el bucket, borrarla en la copia no rompe el original, guardar sin la foto la borra del bucket) y
`pnpm test:cotizacion-imagenes` "Todo en orden" (18 comprobaciones).

Hallazgo original:
Hallado leyendo el código al preparar T3 (sin ejecutar): `getQuoteById` devuelve `detalle.images` como URLs
firmadas de 5 min (`quotes.service.js:122`); `Quotes.tsx::openEdit` (línea 209) copia ese `detalle` al formulario;
`handleSave` solo quita `lineId`; el esquema es `passthrough`, y `updateQuote` reescribe las líneas
(`deleteMany` + `createMany`, línea 244) con `detalle.images` = URLs firmadas. Pasados 5 minutos, la vista de "ver"
y el PDF no pueden firmar ni descargar esas fotos. La prueba por la API no lo cubre (nunca guarda una cotización
con fotos). Arreglo propuesto, en el servidor: en `updateQuote`, aceptar solo imágenes que ya estaban en las líneas
de esa cotización (las rutas guardadas, o una URL firmada que apunte a una de ellas, convertida de vuelta a ruta) y
descartar el resto; más un caso en `tests/cotizacion-imagenes-api.js`. Es código de la 021 (Darío): pendiente de
decidir quién lo arregla (lo arregló Claude, ver arriba).

## T7 · Fotos del PDF en cuadrícula `[x]` (confirmada en pantalla por el usuario, 2026-10-21)

Visto por el usuario al probar T3: en el PDF de la cotización las fotos iban todas en una fila de 150 pt y con 5 se
salían por la derecha (carta: 540 pt útiles). `quotes/plantilla.js::bloqueImagenes` las pone ahora en una
cuadrícula de 3 por fila, celdas de 174,7 × 120 pt con 8 pt de separación, cada foto encajada sin deformarse y
centrada; la última fila se completa con celdas vacías y ninguna fila se parte entre páginas (`unbreakable`).
`PLANTILLA_VERSION` 2 → 3 (invalida los PDF en caché). Guía aplicada (`ui-ux-pro-max`, ux "Image Scaling"): la imagen
se ajusta al ancho del contenedor, nunca un ancho fijo que se desborda. **Comprobado sin base:** PDF generado en
memoria con 5 fotos de proporciones distintas (4:3, 3:4, 3:1, 1:1, 3:2); las 5 dibujadas entre los márgenes, en filas
de 3 y 2. **Por ver en pantalla:** bajar el PDF de una cotización con 1, 3 y 5 fotos.

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-21 | — | Spec y plan escritos. |
| 2026-10-21 | T1 | MCP sin acceso al proyecto de Nexus; bucket creado a mano por el usuario. |
| 2026-10-21 | T2 | Prueba corregida (1 + 4 subidas, no 1 + 3) y en verde. |
| 2026-10-21 | T3, T4 | Lista de pantalla escrita; nota para Darío redactada. |
| 2026-10-21 | T5 | Defecto hallado: guardar una cotización con fotos guarda URLs firmadas. |
| 2026-10-21 | T5 | Arreglado en `updateQuote` y cubierto por la prueba; en verde. |
| 2026-10-21 | T6 | Duplicar copia los archivos; guardar borra los huérfanos. 18 comprobaciones en verde. |
| 2026-10-21 | T3 | Pruebas en pantalla ok (usuario). |
| 2026-10-21 | T7 | Fotos del PDF en cuadrícula de 3; comprobado generando el PDF en memoria. |
| 2026-10-28 | T1 | El usuario confirma la configuración del bucket en el panel. |
