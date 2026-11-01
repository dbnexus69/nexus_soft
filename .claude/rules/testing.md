---
paths:
  - "backend/**"
  - "frontend/**"
  - ".github/workflows/**"
---

# Pruebas y verificación

## Regla principal
No ejecutar pruebas por rutina. Elige la comprobación más pequeña que cubra el cambio. No repitas una comprobación ya realizada sin motivo y no afirmes resultados que no observaste.

## Permisos
- Las pruebas que acceden a la BD, levantan servidores o escriben datos requieren permiso expreso del usuario en este proyecto, porque desarrollo y producción comparten la BD de Supabase.
- No ejecutes pruebas en navegador ni levantes servidores sin permiso.
- Sin permiso, las comprobaciones habituales que no levantan servicios ni tocan la BD son `pnpm check:prisma`, `pnpm test:validaciones` y `pnpm test:reglas-espejo` en `backend/`, y `pnpm build` en `frontend/`. Verifica el alcance real del script antes de ejecutarlo si hay dudas.

## Selección de pruebas
- Cambios de consultas Prisma: `pnpm check:prisma` en `backend/`, si está permitido.
- Cambios de reglas de datos personales: `pnpm test:validaciones`.
- Cambios en las reglas espejo de datos personales entre frontend/backend: `pnpm test:reglas-espejo`.
- Cambios frontend: `pnpm build` en `frontend/` para comprobar TypeScript y build, si está permitido.
- Cambios de multitenencia, RLS, autenticación o permisos: `pnpm test:aislamiento` y/o `pnpm test:aislamiento-api`; ambas necesitan permiso por tocar la BD. La prueba API levanta su propio servidor.
- Cambios en vuelos/check-in: `pnpm test:vuelos-api` requiere permiso por usar la API y la BD.
- Cambios en filtros de ventas: `pnpm test:ventas-filtros`, con permiso.
- Cambios en destinos preferidos de clientes: `pnpm test:clientes-destinos`, con permiso.
- Cambios en perfil/logo/vouchers: `pnpm test:voucher`, con permiso.
- Cambios en límites de usuarios por empresa: `pnpm test:limite-usuarios`, con permiso.
- Cambios de documentación, comentarios o textos sin lógica: no ejecutes pruebas por defecto.

## CI y scripts conocidos
La CI está en `.github/workflows/ci.yml`. Según la documentación del proyecto, ejecuta el build del frontend y `check:prisma`, `test:validaciones` y `test:reglas-espejo` en backend. Las suites con BD permanecen manuales.
- `db:seed` y `db:reset` ya no existen (spec 036): el primero estaba roto frente al schema y el segundo era un `db push --force-reset`.
- `pnpm db:seed:vuelos` y `pnpm db:seed:proveedores` escriben datos y requieren permiso expreso.
- `pnpm db:generate`, `prisma migrate status/deploy` y Prisma Studio requieren permiso expreso en este entorno.
- Ejecuta comandos desde `backend/` o `frontend/`, no desde la raíz.

## Qué hace cada suite
Desde `backend/`. Las que levantan servidor usan el montaje común `tests/montaje.js`: su propio servidor en `:3917` (`TEST_PORT`), agencias de prueba con prefijo propio que se desmontan al terminar, y el servidor se cierra aunque la prueba se corte.
- `test:aislamiento` — monta una 2.ª agencia y comprueba el aislamiento de la RLS; falla en el acto si el rol de `DATABASE_URL` salta la RLS.
- `test:aislamiento-api` — dos agencias y un superadministrador de prueba; aislamiento por la API real (ids, ficheros, rol asesor, liquidaciones, suplantación) y los contratos de respuesta mínima (spec 034). ~1–2 min.
- `test:vuelos-api` — vuelos y check-in por la API (spec 004): días de Bogotá, dirección, contadores, check-in, vuelos de paquete, concurrencia, documentos reemplazados.
- `test:ventas-filtros` — listado de ventas y cartera (spec 016): días de Bogotá, 422 por campo inválido.
- `test:clientes-destinos` — destinos de preferencia (spec 017): máximo 5, el reciente es el último, filtros, sugerencias.
- `test:voucher` — perfil de la empresa y logo (spec 011); sube bajo la carpeta `prueba/` de los buckets y la borra al terminar.
- `test:limite-usuarios` — límite de usuarios por plan (spec 029): plan por defecto, 422 en el tope, reactivar, altas simultáneas, sin límite.
- `test:validaciones` — reglas de datos de personas; sin BD.
- `test:reglas-espejo` — compila `frontend/src/utils/datosPersona.ts` y lo compara con la copia del servidor en ~800 entradas; sin BD.
- `check:prisma` — valida cada `prisma.<modelo>.<método>({...})` contra el DMMF (camelCase frente a snake_case); sale con 1 si encuentra algo.
