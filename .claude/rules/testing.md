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
- Las pruebas que acceden a la BD, levantan servidores o escriben datos requieren permiso expreso del usuario. Corren contra la base local en Docker (spec 038): `pnpm local:up` y `pnpm local:preparar`, y se niegan si la base o Storage no son locales (`scripts/solo-local.js`).
- No ejecutes pruebas en navegador ni levantes servidores sin permiso.
- Sin permiso, las comprobaciones habituales que no levantan servicios ni tocan la BD son `pnpm check:prisma`, `pnpm test:validaciones`, `pnpm test:voucher-plantilla` y `pnpm test:reglas-espejo` en `backend/`, y `pnpm build` en `frontend/`. Verifica el alcance real del script antes de ejecutarlo si hay dudas.

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
- Cambios en imágenes de cotizaciones: `pnpm test:cotizacion-imagenes`, con permiso.
- Cambios de documentación, comentarios o textos sin lógica: no ejecutes pruebas por defecto.

## CI y scripts conocidos
La CI está en `.github/workflows/ci.yml`. Según la documentación del proyecto, ejecuta el build del frontend y `check:prisma`, `test:validaciones` y `test:reglas-espejo` en backend. Las suites con BD permanecen manuales.
- `db:seed` y `db:reset` ya no existen (spec 036): el primero estaba roto frente al schema y el segundo era un `db push --force-reset`.
- `pnpm db:seed:vuelos` y `pnpm db:seed:proveedores` escriben datos y requieren permiso expreso. `pnpm local:preparar` ya siembra los catálogos y las agencias de desarrollo (`prisma/seed-local.js`).
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
- `test:cotizacion-imagenes` — fotos de los servicios de una cotización (specs 021, 023): dos agencias y un asesor de prueba; sube al bucket `cotizacion-imagenes` bajo `prueba/` y la borra al terminar.
- `test:revision-039` — lo corregido de la revisión de la spec 039 (alta de agencia, edición atómica, suplantación, paquetes, días del dashboard, convertir cotización); con BD, y crece al corregir el resto.
- `test:iva-opcional` — IVA opcional por servicio (spec 041): venta y cotización con líneas con y sin IVA, el IVA por línea y de cabecera, el total, el interruptor leído de vuelta y el 422 si el total no cuadra; con BD.
- `test:validaciones` — reglas de datos de personas y el cuadre de precio con y sin IVA; sin BD.
- `test:voucher-plantilla` — qué imágenes puede usar el PDF y dónde quedan en la página; sin BD.
- `test:reglas-espejo` — compila `frontend/src/utils/datosPersona.ts` y lo compara con la copia del servidor en ~800 entradas; sin BD.
- `check:prisma` — valida cada `prisma.<modelo>.<método>({...})` contra el DMMF (camelCase frente a snake_case); sale con 1 si encuentra algo.
