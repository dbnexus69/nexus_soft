# Tareas — Spec 011

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-04).** Hechas todas (T5 descartada). Falta probar en pantalla T9 y T10.

Cada tarea deja la aplicación funcionando y no se da por hecha sin su comprobación.

## Fase 0 — Preparación

### T0 · Proyecto de Supabase y aviso `[x]`
- El usuario añade `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` al `.env` del backend (la clave no se comparte por chat).
- Avisar a Darío: columnas nuevas en `empresas`, tabla `vouchers_venta`, y que `send-voucher` cambia en la fase 4.
- **Se comprueba:** `node -e` con el cliente lista los buckets sin error.
- **Hecho:** variables puestas por el usuario. `SUPABASE_URL` traía la clave *publishable*; se corrigió a
  `https://<ref>.supabase.co` (el `ref` sale de la service role key, que es `service_role` del mismo proyecto). Darío ya
  está al tanto de los cambios.

## Fase 1 — Base y almacenamiento

### T1 · Migración `[x]`
Columnas `nit`, `direccion`, `telefono`, `email_contacto`, `sitio_web`, `voucher_pie`, `voucher_terminos` en `empresas`;
tabla `vouchers_venta` (RLS, `empresa_id` por defecto, claves compuestas a `ventas` y `usuarios`, grants solo a `app_nexus`).
`prisma migrate diff` → leer el SQL → `migrate deploy` → `db:generate`.
- **Se comprueba:** `migrate status` al día; `check:prisma`; `test:aislamiento` con el número de claves compuestas nuevo;
  `get_advisors` sin avisos nuevos.
- **Hecho:** `20261004120000_perfil_y_voucher_de_la_empresa` aplicada (`migrate status` al día); `empresa_id` por defecto sin
  el respaldo a la empresa 1 que trae el diff. `db:generate` (lo corrió el usuario), `check:prisma` limpio, `test:aislamiento` con 56 de 56
  claves compuestas.

### T2 · Almacenamiento `[x]`
`utils/almacenamiento.js` (prefijo de empresa obligatorio, `ALMACENAMIENTO_PREFIJO` para pruebas, 502 `STORAGE_UNAVAILABLE`),
`scripts/crear-buckets.js` (privados, límites de tamaño y tipo), `.env.example`.
- **Se comprueba:** el script crea los buckets y es idempotente; subir, firmar, leer y borrar un objeto de prueba; sin
  contexto de empresa el helper lanza.
- **Hecho:** `utils/almacenamiento.js` (`@supabase/supabase-js`), `pnpm storage:buckets` (`logos` 2 MB PNG/JPG/WebP,
  `vouchers` 5 MB PDF, los dos privados) corrido dos veces sin error. Probado contra Supabase: subir, `existe` (un objeto que
  no está responde 400 y se toma como "no"), leer, firmar y descargar por la URL firmada, borrar; sin empresa lanza; `../`
  rechazado; un `.txt` en `vouchers` rechazado por el bucket; la URL pública da error (bucket privado).

## Fase 2 — Perfil de la empresa

### T3 · API del perfil `[x]`
`GET /company-profile`, `PATCH /company-profile` con `schemas/companyProfile.schema.js` (NIT y teléfono con `datosPersona.js`,
correo, URL, `#rrggbb`, 0–15 cláusulas, límites de texto), `soloAdminDeLaEmpresa`.
- **Se comprueba:** asesor → 403; admin guarda y lee lo guardado; 422 con `details` para NIT erróneo, color mal escrito y
  16 cláusulas; suplantando, el superadmin edita la agencia visitada.
- **Hecho:** `schemas/companyProfile.schema.js`, `services/perfilEmpresa.service.js`, `routes/companyProfile.routes.js`,
  `middleware/soloAdminDeLaEmpresa.js`. **Lo que el diseño no sabía:** la política de `empresas` solo dejaba ESCRIBIR al
  superadministrador, así que el admin recibía un 500. Migración `20261004130000_la_agencia_edita_su_perfil`: el WITH CHECK
  acepta la empresa del contexto, y un trigger (`app_empresa_solo_perfil`) impide que una agencia cambie slug, nombre legal,
  estado, remitente, alta o borrado. **Comprobado:** `test:voucher` (perfil, 422 por campo, vaciar con `''`/`null`, B no ve A,
  superadmin suplantando; y en la base, con el rol de la app: cambiar el estado lanza y la fila de otra agencia no se toca),
  `test:aislamiento` y `test:aislamiento-api` en verde.

### T4 · Logo en el bucket `[x]`
`guardarLogo` común a `PUT /company-profile/logo` y `PUT /companies/:id/logo`; `uploadLogo` en memoria;
`brandingActual()` y el perfil firman la URL.
- **Se comprueba:** subir un PNG lo deja en `logos/<empresa>/…` y borra el anterior; otra agencia no puede firmar esa ruta;
  un archivo de 3 MB o un `.gif` → 422.
- **Hecho:** `uploadLogo` en memoria (PNG/JPG/WebP, sin SVG), `perfilEmpresa.guardarLogo` común a "Mi empresa" y a
  `/companies/:id/logo`, nombre con hash del contenido, borra el anterior; `aFicha`, `getById` y `/branding` firman la URL (1 h).
  Quitado `express.static('/uploads/logos')`: un `logo_url` viejo (`/uploads/…`) se trata como "sin logo" hasta que se vuelva a
  subir. Un archivo de más de 2 MB da 413 (`FILE_TOO_LARGE`, el manejo de multer de siempre), no 422.
  **Comprobado:** `test:voucher` (URL firmada de su carpeta que descarga, sin firma no, `/branding`, GIF → 422, asesor → 403,
  B sin logo, el superadmin sube a la carpeta de B).

### T5 · Migrar los logos existentes — descartada
No se migran: el usuario los vuelve a subir desde "Mi empresa". Queda quitar `express.static('/uploads/logos')` en T4.
- **Se comprueba:** todas las agencias con logo lo siguen viendo en la barra lateral; correr el script dos veces no duplica.

## Fase 3 — Voucher en el servidor

### T6 · Plantilla `pdfmake` `[x]`
`services/voucher/plantilla.js`, `seccionesPorCategoria` (15), `terminosPorDefecto.js`, marca ANULADA, `PLANTILLA_VERSION`.
- **Se comprueba:** un PDF por categoría generado desde una venta real comparado con el de `VoucherPDF.tsx` (ningún dato
  perdido); el texto se puede seleccionar; sin términos propios salen los cuatro de hoy.
- **Hecho:** `pdfmake@0.2` (Roboto embebida, sin binarios). `SECCIONES` reproduce los campos de `VoucherPDF.tsx` categoría por
  categoría; tiquetes con tabla de tramos (ciudad del aeropuerto desde `aeropuertos`) y de pasajeros; resumen de pago con total,
  IVA, abonado y saldo; términos de la agencia o los de por defecto (cinco: los cuatro de hoy más la intermediación) con
  `{agencia}`; pie propio o por defecto; marca de agua ANULADA. **Comprobado:** definición con las 15 categorías y un tiquete
  (secciones, ciudades, NIT, hora 12 h, términos propios y por defecto, marca ANULADA) y un PDF válido.

### T7 · Caché, descarga, envío y vista previa `[x]`
`services/voucher/index.js` (`obtenerVoucher`, `urlDeDescarga`, `enviarVoucher`, `vistaPrevia`), `ventaDeEjemplo.js`.
- **Se comprueba:** dos peticiones sin cambios → mismo objeto; tras un abono → otro; envío correcto → fila en
  `vouchers_venta`; correo fallido o cliente sin correo → sin fila; venta anulada → se descarga, no se envía.
- **Hecho:** `services/voucher/index.js`. La huella deja fuera lo que no sale en el PDF (revisión interna, comisión). El envío
  registra `enviado_por_id` nulo si se suplanta. Se quitó `sendVoucher(pdfBase64)` de `sales.service.js`.

### T8 · Rutas `[x]`
`GET /sales/:id/voucher`, `POST /sales/:id/send-voucher` sin cuerpo, `POST /company-profile/voucher-preview`;
`lastVoucherSent` en el detalle de la venta.
- **Se comprueba:** `test:voucher` (T11) en verde para estas rutas; la venta de otra agencia → 404.
- **Hecho y comprobado** (`test:voucher`): URL firmada de la carpeta de la agencia que baja un PDF; misma ruta sin cambios y
  otra tras un abono; B → 404 al descargar y al enviar; sin correo → 400 sin registro; con correo → 200 y `lastVoucherSent` en
  el detalle; anulada se descarga (otra huella) y no se envía (400); vista previa devuelve `application/pdf` sin guardar el
  borrador; el asesor → 403. **Sigue vivo** el voucher del navegador hasta T9 (el frontend aún manda `pdfBase64`, que ahora se
  ignora: el envío ya lo hace el servidor).

## Fase 4 — Frontend

### T9 · Ventas sin voucher en el navegador `[~]`
Descargar y enviar por la API; borrar `VoucherPDF.tsx`, `VoucherPDF.css`, `buildVoucherPdf`, `html2canvas`, `jspdf`; último
envío en el detalle.
- **Se comprueba:** `tsc` y `vite build`; `grep` sin restos de `html2canvas`/`jspdf`. **En pantalla:** descargar y enviar.
- **Hecho:** "Descargar" abre la URL firmada (`api.getVoucherUrl`); "Enviar" llama a `send-voucher` sin cuerpo y avisa a quién
  se envió. Borrados `VoucherPDF.tsx`, `VoucherPDF.css`, `utils/airportInfo.ts`, `buildVoucherPdf`, `handleSendVoucher` de
  `useSales` y las dependencias `html2canvas` y `jspdf`. El detalle de la venta muestra "Voucher enviado" (`lastVoucherSent`).
  **Comprobado:** `tsc` y `vite build`; `grep` limpio. **Falta:** probarlo en pantalla.

### T10 · Mi empresa `[~]`
`pages/Empresa.tsx`, `components/empresa/*` (Perfil, formulario, editor de cláusulas, vista previa), entrada en el menú,
refresco de la marca tras guardar.
- **Se comprueba:** `tsc` y `vite build`. **En pantalla:** como asesor solo Perfil; como admin, editar, ver la vista previa,
  guardar y ver el logo nuevo en la barra lateral.
- **Hecho:** `pages/Empresa.tsx` (una página: Perfil para todos, Configuración para admin/superadmin), `api/companyProfile.ts`,
  `SelectorDeColores` movido a `components/empresa/` (lo comparte Agencias), `refrescarMarca` en `AuthContext`, ruta
  `/empresa`; "Mi empresa" va en el menú del usuario, encima de "Cerrar sesión" (lo pidió el usuario). Términos: sin propios se dice que van los de por defecto (no se copian al navegador);
  "Escribir los míos" empieza una lista y "Usar los de por defecto" la devuelve a NULL. Errores 422 junto a su campo (los de
  una cláusula juntos bajo la lista). **Comprobado:** `tsc` y `vite build` (página aparte, 11 kB). **Falta:** probarla en
  pantalla.

## Fase 5 — Cierre

### T11 · Pruebas `[x]`
`tests/voucher-api.js` (`pnpm test:voucher`) con el montaje habitual, `EMAIL_SIMULADO` y `ALMACENAMIENTO_PREFIJO`.
- **Se comprueba:** todos los casos de "Cómo se comprueba" de la spec; el prefijo de prueba queda vacío al terminar.
- **Hecho:** `pnpm test:voucher` (perfil, logo, voucher, vista previa, aislamiento); `tests/montaje.js` sube bajo `prueba/` y lo borra al desmontar. Pendiente un caso de "correo fallido sin registro" (necesita forzar un fallo de envío).

### T12 · Límite del cuerpo `[x]`
Bajar `express.json` de 50 MB tras confirmar qué rutas mandan cuerpos grandes.
- **Se comprueba:** crear una venta grande (la de grupo de `test:vuelos-api`) sigue entrando.
- **Hecho:** de 50 MB a 5 MB (los avatares aún viajan como data URL en JSON). **Comprobado:** `test:vuelos-api` en verde.

### T13 · Documentación `[x]`
`CLAUDE.md`, README (variables, buckets, scripts), esta lista.
- **Se comprueba:** releída contra el código final.
- **Hecho:** README (Storage, variables, voucher), `backend/CLAUDE.md` (voucher en el servidor), `CLAUDE.md` (regla de `empresas`, Storage, `test:voucher`).

## T14 · Ajustes del voucher `[x]`

- **Asientos.** La flecha "→" no está en la Roboto que incrusta `pdfmake` y desaparecía: la ruta salía "MDE CTG" y
  el asiento "MDE CTG12B". Ahora la ruta usa raya (`MDE – CTG`) y los asientos van uno por tramo, ruta en gris y
  asiento en negrita (con un solo tramo, solo el asiento). Se emparejan por el `orden` del tramo, que es lo que
  guarda `asientos[].tramo`; en ventas anteriores, el del tramo o el del pasajero.
- **Reserva por pasajero.** Ya llegaba. Sin la suya (ventas anteriores), la del titular o la del tiquete, igual
  que al guardar.
- **IVA.** El resumen dice "IVA: Incluido", sin el valor.
- **Términos.** El título de cada cláusula va encima de su texto.
- **Fechas de vuelo un día antes** (encontrado al probar): `fecha('2026-10-10')` era medianoche UTC, que en Bogotá
  es el 9. Una fecha `AAAA-MM-DD` se pinta tal cual; un instante con hora se sigue convirtiendo a Bogotá.
- `PLANTILLA_VERSION` 5: los PDF en caché se regeneran.

**Comprobado:** voucher de una venta real (un tramo) y de la venta de ejemplo (dos pasajeros, dos tramos)
generados y leídos con `pdftotext`, y la página revisada como imagen. `pnpm test:voucher` en verde.

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-04 | — | Diseño acordado en conversación; spec, plan y tareas escritos. |
| 2026-10-04 | T0–T2 | Variables de Supabase, migración aplicada, buckets creados y helper de almacenamiento probado; T5 descartada. |
| 2026-10-04 | T1, T3, T4 | API del perfil y logo en el bucket; la RLS de `empresas` no dejaba escribir a la agencia (migración + trigger). `pnpm test:voucher` nuevo. |
| 2026-10-04 | T6–T8 | Voucher en el servidor con `pdfmake`, caché por huella en Storage, descarga firmada, envío registrado y vista previa. |
| 2026-10-04 | T9, T10 | Ventas usa el voucher del servidor (fuera `html2canvas`/`jspdf`); pantalla Mi empresa con vista previa. |
| 2026-10-04 | T11–T13 | Límite del cuerpo a 5 MB, documentación al día. Spec cerrada salvo la prueba en pantalla. |
| 2026-10-08 | T14 | Asientos legibles por tramo, reserva por pasajero, IVA "Incluido", título de cláusula encima, y las fechas de vuelo ya no salen un día antes. |
