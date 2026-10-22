# Plan — Spec 023

## T1 · Crear el bucket

Por el MCP de Supabase, con `execute_sql` sobre el proyecto `wzuipxghojvcuxonbzfz` (lo mismo que hace el panel):

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cotizacion-imagenes', 'cotizacion-imagenes', false, 3145728,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
```

Antes, leer `storage.buckets` para ver cómo quedaron `logos`/`vouchers`/`quotes` y copiar ese patrón. Sin
políticas en `storage.objects`: el backend entra con la service role (`almacenamiento.js`), y el navegador solo ve
URLs firmadas. Después, `get_advisors` de seguridad.

Si el MCP no tiene acceso al proyecto: el usuario lo crea en Storage → New bucket con esos mismos valores.

## T2 · Prueba por la API

`pnpm test:cotizacion-imagenes` (con permiso). Si falla, se corrige en esta spec y se le avisa a Darío.

## T3 · Pruebas en pantalla

Lista de pasos en `tasks.md`: subir 1–5 fotos a un servicio, sexta rechazada, tipo inválido, borrar una, ver la
cotización en modo "ver", descargar el PDF con fotos, convertir en venta (las fotos no pasan a la venta).

## T4 · Nota para Darío

Resultado de T1–T3 para que cierre T1, T3 y T4 de la 021.
