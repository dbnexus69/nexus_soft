---
paths:
  - "backend/prisma/**"
  - "backend/src/config/db.js"
  - "backend/src/config/tenant.js"
  - "backend/src/**/*.service.js"
  - "backend/src/**/*.controller.js"
  - "backend/src/middleware/**"
  - "backend/src/utils/**"
  - "backend/tests/**"
---

# PostgreSQL, Prisma y multitenencia

## Base de datos compartida: permiso antes de ejecutar
La BD de desarrollo y producción es la misma instancia compartida de Supabase. Sin autorización expresa, no ejecutes migraciones, scripts que escriban, suites de pruebas con BD, `db:generate`, `db:seed*`, `db:studio`, `prisma migrate status/deploy`, ni comandos que puedan alterar o inspeccionar datos reales. No levantes servicios sin permiso. Si hace falta una de estas acciones, explica el comando y su propósito y espera autorización.

## Migraciones
- Usa migraciones versionadas en `backend/prisma/migrations/`; nunca uses `db push` ni `db reset` contra la BD compartida. `pnpm db:push` y `pnpm db:reset` existen en `package.json`, pero no se corren: construyen la BD solo desde `schema.prisma` y no aplicarían RLS, FKs compuestas, defaults de `empresa_id`, triggers de `numero` ni las funciones SQL.
- Las migraciones incluyen SQL que Prisma Schema no representa por completo: RLS, FKs compuestas, defaults de `empresa_id`, triggers de `numero` y funciones SQL. No reemplaces esos mecanismos por cambios solo en `schema.prisma`.
- Flujo previsto: `prisma migrate diff` → revisar el SQL generado → obtener autorización antes de aplicar con `prisma migrate deploy`.
- No edites migraciones ya aplicadas: cambiaría sus checksums. Documenta correcciones en un `NOTA.md` junto a la migración y crea una nueva migración cuando corresponda.
- `migrate diff` contra la BD puede mostrar diferencias incluso cuando está sincronizada, porque no representa todo el SQL manual. `prisma migrate status` es el chequeo de estado, pero también requiere autorización en este proyecto.
- Las migraciones no se ejecutan durante el build ni al iniciar el servicio.

## Conexiones y roles
- `DATABASE_URL`: pooler de transacciones de Supabase, puerto 6543, con `?pgbouncer=true&connection_limit=10&pool_timeout=20`.
- `DIRECT_URL`: pooler de sesión en puerto 5432; no usar `db.<ref>.supabase.co` si no es accesible desde el entorno.
- `DATABASE_URL` debe usar el rol `app_nexus.<ref>` sin `BYPASSRLS`. No uses `postgres` para consultas de aplicación: puede hacer que las políticas RLS no aíslen datos. El rol `postgres` corresponde únicamente a `DIRECT_URL` para migraciones, según la configuración del proyecto.
- La aplicación no usa la API REST de Supabase ni los roles `anon`/`authenticated`. Las nuevas tablas deben conceder permisos de aplicación solo al rol `app_nexus`, siguiendo las migraciones existentes. Los asesores de seguridad de Supabase deben quedar limpios tras migraciones.

## Tenencia: la BD aplica el aislamiento
- `middleware/auth.js` valida JWT y sesión; el token contiene `empresaId`. Tokens anteriores a la multitenencia sin empresa se rechazan. La empresa nunca debe derivarse de la URL.
- `config/tenant.js` establece el contexto de empresa con `AsyncLocalStorage` y `conEmpresa(...)`.
- `config/db.js` extiende Prisma para establecer `app.empresa_id` en la transacción usada por cada consulta. Las políticas RLS basadas en `app_empresa_actual()` realizan el filtrado real. Sin contexto no debe haber filas visibles ni insertables.
- No agregues `where empresa_id` manual a las consultas Prisma ni asignes `empresa_id` en `create`: el contexto y RLS son la fuente de verdad. Las columnas de tenencia tienen default de BD y son `NOT NULL`.
- Usa `transaccion(fn)` de `config/db.js` para las transacciones. No uses `prisma.$transaction(async tx => ...)` ni la forma de array en este proyecto: el cliente extendido y el pooler hacen que esos patrones no garanticen la atomicidad esperada.
- `sinEmpresa` es una excepción explícita para flujos como login o mantenimiento; no la uses como bypass general. El login resuelve la empresa mediante `app_identidad_por_correo`.
- Las FKs compuestas `(id, empresa_id)` impiden referencias entre empresas porque las comprobaciones de FK de PostgreSQL no dependen de RLS.
- Al crear una tabla de datos de empresa, añade su política RLS, default de `empresa_id` y columna `empresa_id` desnormalizada cuando corresponda; sigue el patrón de las tablas existentes.
- Los archivos se guardan en buckets privados de Supabase Storage, bajo carpeta por empresa. Solo `utils/almacenamiento.js` debe manejar Storage y debe derivar la carpeta del contexto de empresa. No depender del disco local de Render.

## Prisma y SQL
- Los nombres de tablas y columnas están en español. Los campos Prisma suelen ser `snake_case`, salvo mapeos `@map`; en código usa el nombre Prisma definido en el schema.
- Prefiere Prisma Object API con `relationLoadStrategy: 'join'`. Usa SQL tipado mediante `$queryRawTyped` y archivos `prisma/sql/*.sql` para agregaciones o consultas que lo justifiquen (`SUM`, `COUNT FILTER`, CTE, `CASE`).
- Nunca interpolar SQL dinámico; usa parámetros posicionales.
- Después de cambiar consultas Prisma, ejecuta `pnpm check:prisma` si está permitido. Después de modificar `schema.prisma`, `pnpm db:generate` requiere acceso a BD en este proyecto y necesita permiso expreso.
- Las listas y su `count` deben compartir el mismo objeto `where`; no dupliques filtros en SQL y Prisma.
- Los totales se calculan en el servidor, no en el navegador sumando una página de resultados.
- No calcules manualmente `numero`: lo asigna el trigger `app_asignar_numero()` (`MAX+1` con un bloqueo por empresa) y es el número visible por empresa. No expongas el `id` global como número de negocio: revela cuántas filas tienen las demás agencias. Las tablas numeradas se borran de forma lógica (`deleted_at`) para no reutilizar números. Ver `docs/designs/numeros-visibles-por-agencia.md`.
