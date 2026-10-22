# Spec 023 — Dejar funcionando las imágenes de las cotizaciones

**Estado:** en ejecución · **Rama:** `feat-bayrol` · **Toca:** Supabase Storage del proyecto `wzuipxghojvcuxonbzfz`
(bucket nuevo; sin migración de esquema) · **Continúa:** [`021`](../021-imagenes-en-cotizaciones/spec.md) (de Darío,
no se edita: lo que se haga aquí se le pasa como nota)

## Por qué

La 021 ya guarda las fotos de cada servicio cotizado en Supabase Storage (bucket privado `cotizacion-imagenes`,
rutas en `detalle_cotizacion.detalle.images`, URL firmada de 5 min al leer, bytes directos en el PDF). No funciona
todavía porque el bucket no existe, y su prueba por la API y la prueba en pantalla no se han hecho.

## Qué se quiere (decidido con el usuario, 2026-10-21)

1. Crear el bucket `cotizacion-imagenes` con la configuración de `BUCKETS` en `backend/src/utils/almacenamiento.js`:
   privado, 3 MB, `image/png`, `image/jpeg`, `image/webp`. Sin script (el usuario lo descartó); vía MCP de Supabase
   si tiene acceso al proyecto, si no, a mano en el panel.
2. Correr `pnpm test:cotizacion-imagenes` (toca la base y Storage: con permiso).
3. Lista de pruebas en pantalla para el usuario.
4. Nota para Darío con el resultado, para que cierre las `[~]` de la 021.

## Cómo se comprueba

| # | Comprobación |
|---|---|
| 1 | `select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'cotizacion-imagenes'` devuelve `false`, `3145728`, los tres tipos. |
| 2 | `pnpm test:cotizacion-imagenes` en verde. |
| 3 | El usuario marca ok cada paso de la lista en pantalla. |
| 4 | Advisors de seguridad de Supabase sin avisos nuevos. |

## Fuera de alcance

- Cambiar el diseño de la 021 (límite, tamaños, bucket público).
- `scripts/crear-buckets.js` (el `storage:buckets` de `package.json` sigue huérfano; anotado, no se arregla aquí).
