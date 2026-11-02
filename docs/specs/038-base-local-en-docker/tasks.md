# Tareas — Spec 038

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-11-02).** T1–T7 hechas y comprobadas con todas las suites contra local. Falta: repaso en pantalla (T8) y
que Darío monte lo suyo.

## T1 · Prueba de concepto de Storage `[x]`
`docker-compose.yml`: `db` (`postgres:17-alpine`), `storage` (`supabase/storage-api:v1.81.0`, backend de archivos, sin
imgproxy ni PostgREST) y `gateway` (nginx: `/storage/v1/` → `storage:5000/`). Con el mismo cliente de la app: crear
bucket, subir, rechazar un tipo no permitido, existe/no existe, firmar, abrir la URL firmada, token malo rechazado, copiar,
leer, listar, borrar. Todo bien.
**Memoria medida (`docker stats`, sin carga):** db ~65 MB, storage ~90–155 MB, gateway ~8 MB: **~165–230 MB**, sin contar
Docker Desktop. **Imágenes:** storage-api 1,43 GB, postgres 424 MB, nginx 75 MB.
Tuvo que ir `DB_INSTALL_ROLES=true`: sin eso, Storage no tenía permisos sobre sus propias tablas.

## T2 · Roles `[x]`
`docker/postgres/init/01-roles.sql`: `app_nexus` (sin `BYPASSRLS`), `anon`, `authenticated`, `service_role` y la base
`nexus_storage`, aparte de la de Prisma.
**Encontrado:** las migraciones solo dan a `app_nexus` parte de los permisos; el resto se dio a mano en Supabase. En local
van como permisos por defecto. **Diferencia con producción:** una migración nueva que olvide su `GRANT` no falla en local.
Está escrito en el README y en `.claude/rules/database.md`.

## T3 · Migraciones desde cero `[x]`
Las 36 corren sobre una base vacía al primer intento. Prisma sigue siendo la única fuente.

## T4 · `local:preparar` `[x]`
`scripts/solo-local.js` → `migrate deploy` → `prisma generate --sql` → `scripts/crear-buckets.js` (ya existía) →
`prisma/seed-catalogos-vuelos.js` → `prisma/seed-local.js` (nuevo: `tipos_documento`, dos agencias por el alta real y un
superadministrador). **Encontrado:** ninguna migración llena `tipos_documento`; en producción lo sembró el seed antiguo.
**Comprobado:** desde cero y repetido: la segunda vez no crea nada (`No pending migrations`, `ajustado: logos`).

## T5 · Variables `[x]`
`backend/.env` copiado a `backend/.env.produ` (idéntico, comprobado con `cmp`; git lo ignora, comprobado con
`check-ignore`). `.env` y `.env.example` con los valores locales, `EMAIL_SIMULADO=1`. Las claves del compose son de mentira.
**Encontrado de paso:** `frontend/.env.local` y `.env.production` llamaban a `/api`, quitado en la 036; pasan a `/api/v1`
(archivos sin versionar). `frontend/.env` apuntaba a Render: ahora es `/api/v1`, por el proxy de Vite.

## T6 · Protecciones `[x]`
- `scripts/solo-local.js`: `local:preparar`, `tests/montaje.js` y `tests/aislamiento.js` se niegan si `DATABASE_URL`,
  `DIRECT_URL` o `SUPABASE_URL` no apuntan a esta máquina. **Comprobado** con URLs falsas en cada caso.
- `config/env.js`: fuera de producción, con un Storage `https` y sin `ALMACENAMIENTO_PREFIJO`, no arranca
  (`[STORAGE_WITHOUT_PREFIX]`). **Comprobado** con y sin prefijo.
- `pnpm db:migrate:produ`: `.env.produ` explícito. **Comprobado** con un archivo falso que Prisma usa ese y no `.env`
  (intentó `no-existe.invalid`). No se corrió contra producción.

## T7 · Suites contra local `[x]`
Corridas por Claude con permiso del usuario (2026-11-02), con `check:prisma`, `test:validaciones` y `tsc` también en verde:

| Suite | Comprobaciones | Tiempo |
|---|---|---|
| `test:aislamiento` | 22 | 1 s |
| `test:aislamiento-api` | 175 | 17 s |
| `test:vuelos-api` | 47 | 7 s |
| `test:ventas-filtros` | 20 | 4 s |
| `test:clientes-destinos` | 21 | 6 s |
| `test:voucher` | 34 | 9 s |
| `test:cotizacion-imagenes` | 18 | 8 s |
| `test:limite-usuarios` | 21 | 9 s |

**Bug real que la latencia escondía:** el JWT no llevaba identificador, así que dos entradas del mismo usuario en el mismo
segundo daban el mismo token. Compartían la entrada de `authCache` (permisos viejos) y su sesión. Corregido con
`jwtid: randomUUID()` en `utils/tokenUtils.js`; lo cubre `aislamiento-api`.
**Ajuste de velocidad:** el servidor de prueba usa `AUTH_RATE_LIMIT_MAX=1000`; con 5 por minuto, la suite ya es más rápida
que el límite.

## T8 · Repaso en pantalla `[ ]`
`pnpm local:up`, `pnpm local:preparar`, `pnpm dev` en `backend/` y `frontend/`. Entrar con `admin@demo.local`; crear un
cliente y una venta; subir el voucher de un proveedor y abrirlo; subir un logo. Entrar con `super@nexus.local` y suplantar
Agencia Demo.

## Por confirmar
- **Versión de Postgres:** uso la 17, la del compose oficial de Supabase. La de producción se ve en el panel de Supabase
  (Database → Settings); si es otra versión mayor, cambiar la imagen.
- **Docker Desktop:** su consumo propio no está en las cifras de T1.

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-11-02 | T1–T7 | Base y Storage locales en Docker; `.env` separados; protecciones; todas las suites en verde contra local; corregido el token repetido. |
