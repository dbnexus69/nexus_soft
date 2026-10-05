# Plan — Spec 011

Cómo se construye lo que dice [`spec.md`](spec.md). Cada fase deja la aplicación funcionando: el voucher del navegador
sigue vivo hasta que el del servidor lo sustituye entero (fase 4), y solo entonces se borra.

## Punto de partida (lo que hay hoy)

| Pieza | Dónde | Qué hace |
|---|---|---|
| Voucher | `frontend/src/components/sales/VoucherPDF.tsx` (581 líneas) + `VoucherPDF.css` | HTML con la marca de la agencia (nombre, logo) y términos fijos |
| PDF | `frontend/src/pages/Sales.tsx` (`buildVoucherPdf`) | `html2canvas` → imagen → `jsPDF`; descarga con `doc.save` |
| Envío | `POST /sales/:id/send-voucher` → `sales.service.js` `sendVoucher(saleId, pdfBase64)` | Recibe el PDF en base64 y lo adjunta. **No mira si el correo salió** |
| Marca | `GET /branding` → `companies.service.js` `brandingActual()` | slug, nombre, `logoUrl`, colores |
| Logo | `middleware/uploadLogo.js` + `companies.service.js` `setLogo` | Disco, `/uploads/logos/…`, servido **sin sesión** por `express.static` (`index.js:98`) |
| Cuerpo | `index.js:85` | `express.json({ limit: '50mb' })`, en gran parte por el PDF en base64 |

## Decisiones de implementación

- **Cliente de Storage:** `@supabase/supabase-js` solo en el backend, con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
  Se envuelve en **`utils/almacenamiento.js`**, el único archivo que habla con Storage. Su API:
  `subir(bucket, nombre, buffer, tipo)`, `existe(bucket, nombre)`, `leer(bucket, nombre)`, `firmar(bucket, nombre, segundos)`,
  `borrar(bucket, nombre)`. Los nombres que recibe son **relativos**: el helper antepone `empresaActual()/` siempre, y lanza si
  no hay empresa en el contexto. Así ningún llamador puede escribir en la carpeta de otra agencia.
  Errores de Storage → `AppError(502, 'STORAGE_UNAVAILABLE')`.
- **Pruebas sin tocar los objetos reales:** con `ALMACENAMIENTO_PREFIJO=prueba-<sufijo>` (lo pone `tests/montaje.js`) el
  helper guarda bajo `<prefijo>/<empresa_id>/…`, y el test borra el prefijo al terminar.
- **Buckets:** `logos` y `vouchers`, privados, creados por un script idempotente (`scripts/crear-buckets.js`), no a mano.
  Límite de tamaño: 2 MB en `logos`, 5 MB en `vouchers`; tipos permitidos por bucket.
- **`pdfmake` en Node:** `pdfmake/src/printer` con Roboto de `pdfmake/build/vfs_fonts` cargado en memoria. Se genera a
  `Buffer`. Sin fuentes del sistema ni binarios.
- **Datos del voucher:** la misma lectura que `getSaleById` + `getSaleProducts` (`_saleHeader`, `_loadProducts`,
  `PRODUCT_TRANSFORMS`), así el PDF muestra exactamente lo que muestra el detalle. Los nombres de los aeropuertos salen de
  `aeropuertos` (hoy el navegador usa `utils/airportInfo`); los planes de equipaje, de `politicas_equipaje`.
- **Huella:** `sha256(JSON.stringify({ v: PLANTILLA_VERSION, venta, config, logo }))`, con `venta` y `config` como los objetos
  ya normalizados que se pasan a la plantilla (sin fechas de lectura ni campos volátiles). Lo que no cambia el PDF no cambia
  la huella.
- **Validación:** `schemas/companyProfile.schema.js` reutiliza `utils/datosPersona.js` (NIT, teléfono) y `personaCampos.js`
  donde aplique; nada de reglas nuevas para lo que ya tiene regla.
- **Quién edita:** middleware pequeño `soloAdminDeLaEmpresa` (rol `admin` o `superadmin`), junto a `soloSuperadmin.js`. Sin
  módulo nuevo en `permisos_rol`.
- **Logo con URL firmada:** `brandingActual()` y `GET /company-profile` devuelven `logoUrl` firmada (1 h). El frontend ya la
  usa como `src`, así que no cambia; la caché de la marca (`AuthContext`) se refresca antes de que caduque (TTL 50 min).

## Fases

### Fase 1 — Base y almacenamiento

1. **Migración** `…_perfil_y_voucher_de_la_empresa` (a mano, leída antes de `migrate deploy`): columnas de `empresas`;
   tabla `vouchers_venta` con `empresa_id` por defecto, `NOT NULL`, índice, RLS (`empresa_id = app_empresa_actual()`), claves
   compuestas a `ventas` y `usuarios`, `GRANT` solo a `app_nexus`. Esquema de Prisma al día y `db:generate`.
2. **`utils/almacenamiento.js`**, `scripts/crear-buckets.js`, variables nuevas en `.env.example` y en el README.

### Fase 2 — Perfil de la empresa (API)

3. `GET /company-profile`, `PATCH /company-profile` (esquema + servicio en `companies.service.js` o un
   `companyProfile.service.js` si crece), rutas montadas en `routes/index.js`.
4. Logo al bucket: `PUT /company-profile/logo` y el `PUT /companies/:id/logo` del superadmin usan el mismo servicio
   (`guardarLogo`), que sube, actualiza `logo_url` y borra el anterior. `uploadLogo` pasa a memoria (`multer.memoryStorage`),
   sigue envuelto en `conservarContexto`. `brandingActual()` firma la URL.
5. **Script `scripts/migrar-logos.js`** (una vez, idempotente): sube cada `/uploads/logos/<archivo>` a
   `logos/<empresa_id>/…` y reescribe `logo_url`. Después se quita `express.static('/uploads/logos')` de `index.js`.

### Fase 3 — Voucher en el servidor

6. **`services/voucher/plantilla.js`**: definición `pdfmake`. Se recorre `VoucherPDF.tsx` sección por sección y se reproduce
   cada dato (cabecera, cliente, tramos con aeropuertos y equipaje, pasajeros, 15 categorías vía `seccionesPorCategoria`,
   pagos, IVA, términos, pie, marca ANULADA). Términos por defecto en `services/voucher/terminosPorDefecto.js` (los cuatro de
   hoy, con `{agencia}` sustituido).
7. **`services/voucher/index.js`**: `obtenerVoucher(ventaId, alcance)` → `{ ruta, huella, buffer? }` con la caché por
   huella; `urlDeDescarga(ventaId, alcance)`; `enviarVoucher(ventaId, alcance)` (correo + fila en `vouchers_venta` solo si
   salió); `vistaPrevia(borrador)` con una venta de ejemplo fija (`services/voucher/ventaDeEjemplo.js`), sin guardar.
8. **API:** `GET /sales/:id/voucher`, `POST /sales/:id/send-voucher` sin cuerpo (fuera `pdfBase64` del controlador),
   `POST /company-profile/voucher-preview` (`Content-Type: application/pdf`). El listado o detalle de la venta expone el último
   envío (`lastVoucherSent: { to, at }`).

### Fase 4 — Frontend

9. **Ventas:** "Descargar voucher" → `api.getVoucherUrl(id)` y `window.open(url)`; "Enviar" → `api.sendVoucher(id)`. Borrar
   `buildVoucherPdf`, `VoucherPDF.tsx`, `VoucherPDF.css`, `html2canvas` y `jspdf`. El detalle muestra el último envío.
10. **`/empresa`** ("Mi empresa" en el menú): `pages/Empresa.tsx` con las pestañas Perfil y Configuración;
    `components/empresa/` con `PerfilEmpresa`, `FormularioEmpresa`, `EditorTerminos` y `VistaPreviaVoucher` (`<iframe>` con un
    `blob:` del PDF). Errores 422 junto a su campo con `FormField`. Tras guardar o cambiar el logo, refrescar la marca
    (`AuthContext`) para que la barra lateral la vea.

### Fase 5 — Cierre

11. `pnpm test:voucher` (nuevo, en `package.json`), `test:aislamiento` con el número de claves compuestas actualizado.
12. Bajar `express.json` de 50 MB a lo que haga falta sin el PDF en base64 (comprobar antes qué otra ruta manda cuerpos
    grandes; el borrador de venta no lleva archivos).
13. Documentación: `CLAUDE.md` (Storage, voucher en el servidor, `vouchers_venta`, quién edita el perfil), README (variables y
    buckets), `tasks.md` al día.

## Orden y dependencias

```
1 → 2 → (3, 4) → 5
2 → 6 → 7 → 8 → 9
3 + 8 → 10
todo → 11 → 12 → 13
```

## Qué toca a Darío

Las columnas son opcionales y la tabla es nueva: su rama sigue funcionando sin cambios. Lo que sí le afecta al mezclar:
`POST /sales/:id/send-voucher` deja de aceptar `pdfBase64`, y `VoucherPDF.tsx` desaparece. Avisarle antes de la fase 4.
