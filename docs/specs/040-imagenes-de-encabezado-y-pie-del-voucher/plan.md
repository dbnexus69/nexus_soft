# Plan — Spec 040, imágenes de encabezado y pie del voucher

Escrito después de implementar (surgió de una conversación de soporte, no de un diseño previo); documenta
la arquitectura real, no un plan a seguir.

**Stack:** igual que el resto del backend (Express 5, Prisma 6, CommonJS); `pdfmake` ya era dependencia
(spec 011), sin paquetes nuevos — el lector de dimensiones de imagen es un archivo propio de ~70 líneas
(ver decisión 5 de `spec.md`: PNG/JPEG/WebP solo necesitan leer su cabecera, no vale la pena una
dependencia para eso).

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `backend/prisma/migrations/20261107120000_imagenes_de_encabezado_y_pie_del_voucher/migration.sql` | 2 columnas nuevas en `empresas`, aditivas |
| `backend/prisma/schema.prisma` | `voucher_encabezado_imagen` / `voucher_pie_imagen` en `model empresas` |
| `backend/src/services/perfilEmpresa.service.js` | `subirImagen` (privada, generaliza lo que antes era solo `guardarLogo`); `guardarImagenEncabezado`/`guardarImagenPie`; `aPerfil` expone las dos URLs firmadas |
| `backend/src/controllers/companyProfile.controller.js` | `subirImagenEncabezado` / `subirImagenPie` |
| `backend/src/routes/companyProfile.routes.js` | `PUT /company-profile/voucher-encabezado` y `.../voucher-pie-imagen`, mismo middleware `uploadLogo` reusado con otro campo |
| `backend/src/services/voucher/dimensionesImagen.js` | nuevo: ancho/alto real de un PNG/JPEG/WebP desde su cabecera |
| `backend/src/services/voucher/plantilla.js` | `header`/`footer` de `pdfmake` con las imágenes a ancho completo; alto calculado con `dimensionesImagen` |
| `backend/src/services/voucher/index.js` | `empresaYConfig` y `generarCon` pasan las dos imágenes (buffers) a la plantilla |
| `frontend/src/api/companyProfile.ts` | `voucherEncabezadoImagenUrl`/`voucherPieImagenUrl` en `PerfilEmpresa`; `uploadVoucherHeaderImage`/`uploadVoucherFooterImage` |
| `frontend/src/pages/Empresa.tsx` | tarjeta "Encabezado y pie del voucher" en "Mi empresa", mismo patrón de subida que el logo |

## Decisiones técnicas que no están en `spec.md`

- **`header`/`footer` de pdfmake, no `content` con margen negativo.** Se consideró "sangrar" la imagen
  fuera del margen del cuerpo con un margen negativo (truco conocido de pdfmake), pero `header`/`footer`
  ya hacen exactamente eso de forma nativa y además resuelven solos el reparto del alto reservado
  (`pageMargins`) — menos código, sin necesidad del truco.
- **El bucket es `logos`, no uno nuevo.** Mismo patrón de nombre con hash de contenido
  (`<prefijo>-<hash>.<ext>`), mismas reglas (PNG/JPG/WebP, 2 MB) — no hay nada que una imagen de voucher
  necesite que el logo no tuviera ya.
- **`guardarLogo` se generalizó sin cambiar su contrato.** `companies.service.js::setLogo` (el logo desde
  el panel del superadministrador) sigue llamando `guardarLogo(id, fichero)` igual que antes; el mensaje
  de error del campo `logo` tampoco cambió (lo comprueba `tests/voucher-api.js`).
