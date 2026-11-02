# Plan — Spec 038

1. **Prueba de concepto de Storage primero.** `docker-compose.yml` en la raíz: `db` (Postgres), `storage`
   (`supabase/storage-api`, `STORAGE_BACKEND=file`, sin imgproxy) y `gateway` (nginx: `/storage/v1/` → `storage:5000/`,
   porque `supabase-js` fija esa ruta). Subir, firmar, abrir y medir con `docker stats`. Si falla o pesa demasiado:
   solo Postgres y el prefijo contra el bucket real.
2. **Roles.** `docker/postgres/init/` crea `app_nexus` (sin `BYPASSRLS`), `anon`, `authenticated`, `service_role` y una
   base aparte para las tablas de Storage, para que no se mezclen con las de Prisma.
3. **Migraciones desde cero.** `prisma migrate deploy` contra local. Prisma sigue siendo la única fuente de migraciones.
4. **`local:preparar`.** Script idempotente: migraciones, `prisma generate --sql`, buckets (desde `BUCKETS` de
   `almacenamiento.js`), catálogos de vuelos y una agencia + superadministrador de desarrollo. Se niega si la base o
   Storage no son locales.
5. **Variables.** Copiar `.env` a `.env.produ`; `.env` y `.env.example` con valores locales. Clave JWT de Storage fija
   y solo de desarrollo. `EMAIL_SIMULADO=1` en local.
6. **Protecciones.** `montaje.js` exige base local; `config/env.js` exige prefijo contra un Storage real fuera de
   producción; `db:migrate:produ` usa `.env.produ` de forma explícita.
7. **Comprobar** todas las suites contra local y documentar.
