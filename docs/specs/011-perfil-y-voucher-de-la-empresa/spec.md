# Spec 011 — Perfil de la empresa y voucher personalizable

**Estado:** implementada (2026-10-04), pendiente de probar en pantalla · **Rama:** `feat-bayrol` · **Toca la base compartida** (columnas nuevas en
`empresas` y una tabla nueva) · **Relacionadas:** [`001`](../001-multi-tenant/spec.md) (tenancy, RLS),
[`003`](../003-validacion-de-datos-de-personas/spec.md) (reglas de NIT y teléfono), [`005`](../005-iva-sobre-ta/spec.md)
(IVA aparte en el resumen)

## Por qué

Cada agencia emite vouchers a sus clientes, pero el voucher no es suyo del todo:

- **Los términos y condiciones están escritos en el código** (`VoucherPDF.tsx`) y son los mismos para todas.
- **Los colores de la agencia no se usan:** `empresas` tiene `color_primario`, `color_acento` y `color_realce`, pero
  `VoucherPDF.css` lleva los colores fijos.
- **No hay datos de contacto:** `empresas` no guarda NIT, dirección, teléfono, correo ni web; donde iría el contacto, el
  voucher pone el `slug`.
- **Solo el superadministrador** puede tocar logo y colores (`/companies`). La agencia no tiene dónde ver ni editar su perfil.
- **El PDF se hace en el navegador** (`html2canvas` + `jsPDF`): es una imagen (el texto no se puede seleccionar), pesa más,
  y para enviarlo el navegador lo sube en base64 a `POST /sales/:id/send-voucher`.
- **Ningún voucher se guarda:** no consta qué se le envió a quién ni cuándo.

## Qué se quiere (confirmado con el usuario, 2026-10-04)

1. Un módulo **"Mi empresa"** con dos pestañas: **Perfil** (solo lectura, lo ve cualquiera de la agencia) y
   **Configuración** (solo `admin`, y el superadministrador cuando suplanta).
2. Perfil con datos de contacto: **NIT, dirección, teléfono, correo de contacto y sitio web**, además de nombre comercial,
   logo y colores. Sin datos legales extra (RNT, cámara de comercio) por ahora.
3. En Configuración la agencia personaliza su voucher: **logo, tres colores, términos y condiciones como lista de cláusulas**
   (título + texto, que se agregan, quitan y reordenan) y **un texto de pie**. Sin plantillas alternativas ni bloques que se
   ocultan.
4. **Vista previa** del voucher en Configuración con los datos sin guardar.
5. El voucher se **genera en el servidor** con `pdfmake` (texto real, sin navegador ni Chromium).
6. Los vouchers y los logos se **guardan en Supabase Storage**; se entregan con **URL firmada** al descargar y como adjunto
   al enviar.
7. Un voucher guardado es una **caché por contenido**: si nada cambió se reutiliza; si cambió la venta o la configuración se
   genera otro. Los **envíos** quedan registrados.

## Fuera de alcance

- Plantillas de diseño alternativas, mostrar u ocultar bloques, QR o enlace en el voucher (se pueden añadir después).
- Datos legales (RNT, cámara de comercio, representante legal).
- Editar el **nombre legal** y el **slug** desde la agencia: siguen siendo del superadministrador (`/companies`).
- Limpiar del bucket los PDFs que nunca se enviaron (ocupan ~50 KB cada uno; una limpieza periódica puede venir luego).
- Cualquier otro archivo subido (adjuntos de check-in, vouchers de proveedor de los productos): sigue en disco. Pasarlos a
  Storage es otra spec.

## Diseño

### Datos

Columnas nuevas en `empresas`, todas opcionales (migración aditiva):

| Columna | Tipo | Regla |
|---|---|---|
| `nit` | text | NIT con la regla de `datosPersona.js` (DIAN mod 11 cuando el dígito de verificación es inequívoco) |
| `direccion` | text | ≤ 150 |
| `telefono` | text | Regla de teléfono de personas |
| `email_contacto` | text | Correo válido |
| `sitio_web` | text | URL `http(s)://`, ≤ 200 |
| `voucher_pie` | text | ≤ 300 |
| `voucher_terminos` | jsonb | `[{ "titulo", "texto" }]`, 0–15 cláusulas, título ≤ 80, texto ≤ 600. `NULL` = términos por defecto |

`logo_url` pasa a guardar la **ruta dentro del bucket** (`<empresa_id>/logo-<hash>.<ext>`) en vez de `/uploads/logos/…`.
Los colores usan las columnas que ya existen (`#rrggbb`).

`empresas` ya tiene RLS (`empresa_propia`: cada agencia solo ve y escribe su fila), así que editar el propio perfil no
necesita filtros en el código ni políticas nuevas.

Tabla nueva **`vouchers_venta`**, el registro de lo enviado:

| Columna | Nota |
|---|---|
| `id` uuid | |
| `empresa_id` | Por defecto del contexto, `NOT NULL`, RLS propia |
| `venta_id` | Clave ajena compuesta `(venta_id, empresa_id) → ventas(id, empresa_id)` |
| `huella` | El hash del contenido que se envió |
| `ruta` | El objeto en el bucket |
| `enviado_a` | Correo del cliente |
| `enviado_at` | |
| `enviado_por_id` | Nulo si quien envía está suplantando (spec 002, T19); si no, clave compuesta a `usuarios` |

Grants solo para `app_nexus`, como el resto de tablas creadas por migración.

### Almacenamiento (Supabase Storage)

- **Dos buckets privados, una carpeta por empresa:** `logos/<empresa_id>/…` y `vouchers/<empresa_id>/<venta_id>/<huella>.pdf`.
  Se eligió carpeta por empresa y no un bucket por empresa: crear y borrar buckets al dar de alta o de baja una agencia exige
  permisos de administración de Storage y choca con el límite de buckets; las carpetas dan la misma separación con menos
  piezas.
- **Solo el backend accede**, con la *service role key* de Supabase (`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el
  `.env` del backend, nunca en el navegador). La app sigue sin usar la API REST ni los roles `anon`/`authenticated`.
- **La carpeta sale siempre de `empresaActual()`**, nunca de la URL ni del cuerpo: es lo que impide que una agencia pida el
  objeto de otra. Un helper único (`utils/almacenamiento.js`) construye las rutas y es el único que habla con Storage.
- **Entrega:** URL firmada de 5 minutos para descargar un voucher; de 1 hora para el logo (barra lateral, perfil).
- **Migración de los logos existentes:** un script de una vez sube los de `/uploads/logos/` al bucket y reescribe `logo_url`.

### Generación del voucher (`services/voucher/`)

- **`plantilla.js`**: venta + configuración → definición de `pdfmake`. Cabecera (logo, nombre comercial, NIT, contacto, web)
  en el color principal; datos del cliente; una sección por producto; resumen de pago (total, abonado, saldo, IVA aparte);
  cláusulas de la agencia (o las cuatro por defecto, las de hoy) y el pie. Títulos y bordes en el color de acento.
- **Las 15 categorías salen de una tabla `seccionesPorCategoria`**, un renderizador por categoría, igual que
  `ventaProductos.js`: no 15 bloques copiados.
- Una venta **anulada** lleva la marca ANULADA.
- **`PLANTILLA_VERSION`**: constante que se sube cuando cambia el diseño, para invalidar la caché.
- Fuente Roboto (la que trae `pdfmake`). Logo leído del bucket; sin logo, solo el nombre.

**Caché por contenido** (`services/voucher/index.js`):

1. Cargar la venta (con el alcance de quien pide: `ventaVisible`) y la configuración de la agencia.
2. `huella = sha256(PLANTILLA_VERSION + datos de la venta + configuración + ruta del logo)`.
3. Si `vouchers/<empresa>/<venta>/<huella>.pdf` existe, se usa; si no, se genera y se sube.
4. Descargar → URL firmada. Enviar → se adjunta al correo del cliente y, **solo si el correo salió**, se escribe una fila en
   `vouchers_venta` (mismo criterio que el check-in: lo que no salió no consta como enviado).

### API

Todo con `auth`, sobre la empresa del token; nunca un id de empresa en la URL.

| Ruta | Quién | Qué |
|---|---|---|
| `GET /company-profile` | Todos | Perfil + configuración del voucher, con URL firmada del logo |
| `PATCH /company-profile` | `admin` / superadmin | Datos, colores, pie, términos. Zod; 422 con `details` por campo |
| `PUT /company-profile/logo` | `admin` / superadmin | PNG/JPG/WebP ≤ 2 MB, al bucket. Por `middleware/upload.js` (conserva el contexto) |
| `POST /company-profile/voucher-preview` | `admin` / superadmin | Borrador sin guardar → PDF de una venta de ejemplo (`application/pdf`, no se guarda) |
| `GET /sales/:id/voucher` | Quien puede ver la venta | `{ url, expiraEn }` |
| `POST /sales/:id/send-voucher` | Como hoy | Sin cuerpo: el servidor genera (o reutiliza) y envía |
| `GET /branding` | Todos | Como hoy, con la URL del logo firmada |

**Permiso:** sin módulo nuevo en `permisos_rol`. Editar es fijo para `admin` (y superadmin), como los roles fijos actuales:
no hay que tocar los tres sitios de permisos y un asesor no cambia la marca de la agencia.

`/companies` (superadmin) sigue editando logo y colores sobre las mismas columnas, y su subida de logo pasa también al bucket.

### Frontend

- Ruta **`/empresa`**, entrada "Mi empresa" en el menú.
  - **Perfil:** tarjeta de solo lectura.
  - **Configuración** (solo `admin`/superadmin): datos, logo, tres selectores de color con su hex, lista de cláusulas
    (agregar, quitar, subir/bajar, "Restaurar los de por defecto"), pie. A la derecha, la **vista previa** en un `<iframe>`,
    con botón "Ver vista previa" (no un PDF por tecla). Errores 422 junto a su campo, como los modales de personas.
- **Ventas:** "Descargar voucher" pide la URL y la abre; "Enviar" llama a `send-voucher` sin cuerpo. El detalle de la venta
  muestra el último envío ("Enviado el 4 oct a cliente@…").
- **Se eliminan** `VoucherPDF.tsx`, `VoucherPDF.css`, `html2canvas` y `jsPDF`.

### Errores

| Caso | Respuesta |
|---|---|
| Storage no responde al subir o firmar | 502 `STORAGE_UNAVAILABLE`, nada escrito a medias |
| Falla el correo | 502, sin fila en `vouchers_venta` |
| Cliente sin correo al enviar | 400 con el motivo |
| Venta anulada | Se descarga (con marca ANULADA); enviarla → 400 |
| `asesor` o `freelancer` intenta editar | 403 |
| Validación | 422 con `details: [{ field, message }]` |

## Cómo se comprueba

- **`pnpm test:voucher`** (nuevo, por la API real con `tests/montaje.js`, correo simulado con `EMAIL_SIMULADO` y una carpeta de
  prueba en los buckets que se borra al final):
  - Dos agencias: ninguna obtiene el voucher ni el logo de la otra (404).
  - Pedir el voucher dos veces sin cambios devuelve el mismo objeto; tras un abono, otro distinto.
  - Enviar escribe una fila en `vouchers_venta`; un envío fallido no.
  - Un asesor recibe 403 al editar el perfil; un admin guarda y los cambios aparecen en `GET /company-profile`.
  - Sin términos propios, el PDF lleva los de por defecto (se busca el texto en el PDF).
  - NIT con dígito de verificación erróneo, color mal escrito y 16 cláusulas → 422 con su campo.
- `pnpm test:aislamiento` con el número de claves compuestas actualizado (`vouchers_venta` añade dos).
- `check:prisma` y `tsc`/`vite build` limpios.
- **En pantalla** (lo hace el usuario): Mi empresa como admin y como asesor; vista previa con colores y cláusulas nuevas;
  descargar y enviar un voucher; el voucher de una venta anulada.

## Riesgos

- **La service role key salta RLS en Storage.** Mitigación: un único helper construye todas las rutas desde `empresaActual()`
  y el test de aislamiento lo cubre. La clave nunca sale del backend.
- **Reescribir el voucher en `pdfmake`** puede dejar fuera algún dato que hoy se muestra. Mitigación: se recorre
  `VoucherPDF.tsx` sección por sección antes de borrarlo, y se compara un voucher de cada categoría.
- **Base compartida con Darío:** las columnas son aditivas y opcionales, la tabla es nueva; no rompe su rama. Se le avisa
  antes de aplicar la migración.
