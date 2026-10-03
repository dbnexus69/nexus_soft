# Tareas — Spec 009

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-03).** Diseño escrito; **nada implementado y nada aplicado a la base**. Espera la aprobación
del usuario sobre la spec y el plan.

Cada tarea deja el sistema funcionando y no se da por hecha sin su comprobación.

## Fase 0 — Preparación

### T0 · Línea base, copia de seguridad y aviso `[ ]`
- Todas las suites en verde antes de empezar (`test:aislamiento`, `-api` ×2, `validaciones`, `reglas-espejo`, `check:prisma`) y su resultado anotado aquí.
- Consultas de **solo lectura** (a autorizar por el usuario): filas por tabla; personas sin rol; documentos
  nulos; correos de `usuarios` distintos de los de su persona; espacios o minúsculas en `documento`.
- Punto de restauración de Supabase confirmado por el usuario (antes de T11 y antes de T12).
- **Avisar a Darío** del cambio de contrato y de la ventana (spec, "Coordinación con Darío").
- **Se comprueba:** suites en verde; cifras anotadas; copia confirmada; aviso hecho.

## Fase 1 — Expandir

### T1 · Migración: columnas propias, copia y únicos `[ ]`
`…_personas_columnas_propias`, a mano y leída antes de `migrate deploy`. En `clientes`, `usuarios`,
`responsables`, `comisionistas`: `nombres`, `apellidos`, `tipo_documento_id` (+ clave ajena simple),
`documento`, `email`/`telefono`/`birth_date`/`avatar_url` (menos `email` en `usuarios`, que ya existe);
`clientes.status`. En `pasajeros_detalle`: `nombres`, `apellidos`, `tipo_documento_id`, `documento`. Todo
*nullable*. Copia con `UPDATE … FROM personas` (normalizando). Índices únicos parciales por tabla. Esquema de
Prisma al día; `db:generate`.
- **Se comprueba:** `migrate status` al día; el verificador de T2 en verde; `check:prisma` limpio; el código
  actual no cambia y las suites siguen verdes (A2 con el código viejo).
- **Ojo:** `db:generate` falla con `EPERM` si hay un `pnpm dev` abierto; pararlo antes.

### T2 · Verificador y resincronización `[ ]`
`backend/tests/personas-migracion.js` (`pnpm test:personas-migracion`): para cada tabla y para los pasajeros,
cuenta filas y compara cada campo con su `persona` (ya normalizado). `backend/scripts/resincronizar-personas.js`:
idempotente (`WHERE nombres IS NULL`), con `--hacia-personas` para el camino inverso del rollback.
- **Se comprueba (A1):** verde tras T1; después de insertar a mano una fila "como la crearía el código viejo"
  (solo en `personas`), el verificador la señala y el script la completa.

## Fase 2 — Cambiar el código

### T3 · Helper común y duplicado en un solo sitio `[ ]`
`utils/datosDePersona.js` (`COLUMNAS_PERSONA`, `columnasDePersona`, `datosDePersonaARespuesta`);
`errorHandler`: `P2002` sobre el documento de las cuatro tablas → `400 DUPLICATE_DOCUMENT` con `details`.
- **Se comprueba:** prueba unitaria sin base del mapeo en los dos sentidos; prueba de `errorHandler` con un
  error `P2002` simulado (patrón de la prueba de T14 de la 002).

### T4 · Clientes `[ ]`
`clients.service.js` (48 referencias): listar, leer, crear, editar, activar/desactivar (`status` propio), sin
`existingPersona` ni "revivir"; el buscador usa las columnas propias. `ClientDetail`, correo del voucher.
- **Se comprueba:** `aislamiento-api` y `validaciones` en verde; **A3** (un cliente nuevo no toca al usuario
  con ese documento); **A4**; **A5** para clientes.

### T5 · Comisionistas `[ ]`
`commissions.service.js` (27): directorio, alta, edición, baja, liquidaciones. Sin revivir; el SQL crudo del
directorio (`FROM comisionistas c JOIN personas p`) pasa a leer `c.nombres`…
- **Se comprueba:** sección de comisionistas y liquidaciones de `aislamiento-api`; A4; A5.

### T6 · Responsables `[ ]`
`responsables.service.js` (36): lista (SQL crudo con `JOIN personas`), detalle, alta, edición, baja. Sin
`persona_id` en la respuesta.
- **Se comprueba:** sección de responsables; A4; A5.

### T7 · Usuarios y sesión `[ ]`
`users.service.js` (77), `auth.service.js` (20: login, `me`, recuperación de contraseña), `middleware/auth.js`
(carga `usuarios` + `personas`: ahora solo `usuarios`), `companies.service.js` (alta del admin de una agencia),
`roles.service.js`, `config.service.js`. Se elimina `reactivarUsuario`.
- **Se comprueba:** suplantación, asesor y permisos de `aislamiento-api`; el login y `/auth/me` devuelven lo
  mismo que antes (incluido `empresaNombre`, `suplantacionId`); A4; A5.

### T8 · Pasajeros: copia `[ ]`
`sales.service.js` (40): `createSale` escribe la copia en `pasajeros_detalle`; fuera `findOrCreatePersona`,
`catalogos.personas` y su precarga; `flights.service.js` (15), `catalog/products.js` (5: `mapPassengers`),
`schemas/products.schema.js`. La validación de documentos de la 003 T4 (`_validarPersonas`) se mantiene.
- **Se comprueba:** `vuelos-api` en verde (los nombres y documentos por pasajero del check-in); **A6**; la
  prueba de huéspedes de `aislamiento-api` (documento normalizado y tipo guardados).

## Fase 3 — Lo que queda leyendo `personas`

### T9 · Lecturas cruzadas `[ ]`
`stats.service.js` (7: mejores clientes, rendimiento de asesores, `activeClients` por `personas.status`),
`emailService` y el voucher (correo del cliente), cualquier `include: { personas }` que `check:prisma` o un
`grep personas` encuentre. Al terminar: `grep -rn "personas" backend/src` solo debe dar comentarios.
- **Se comprueba:** `test:aislamiento-api` (dashboard) y `check:prisma`; el `grep` limpio.

### T10 · Semilla, pruebas, scripts y frontend `[ ]`
`prisma/seed.js`, `tests/aislamiento.js` (monta filas con `personas`), `tests/montaje.js` (`montarSuperadmin`),
`scripts/check-prisma-fields.js`. Frontend: el tipo opcional `personaId` y cualquier lectura de `persona_id`.
- **Se comprueba (A9):** todas las suites; `tsc`; `grep persona_id frontend/src` sin lectores.

## Fase 4 — Corte y contracción

### T11 · Ventana de verificación `[ ]`
Con T4–T10 mezclados en la rama común y la copia de seguridad hecha: resincronizar; correr el verificador;
dejar pasar un uso real; comprobar que **no hay filas nuevas ni modificadas en `personas` desde el corte**
(`creado_at`/`updated_at` posteriores al corte), y que la rama de Darío ya trae el cambio.
- **Se comprueba (A7):** la consulta sin resultados y el verificador en verde dos veces seguidas.

### T12 · Contraer: renombrar `[ ]`
`…_quitar_personas`: `NOT NULL` en `nombres`/`apellidos`; quitar `persona_id` y sus únicos parciales de las
cinco tablas, las 5 claves ajenas compuestas y la política RLS; `ALTER TABLE personas RENAME TO personas_respaldo`;
`REVOKE` a `app_nexus`. Esquema de Prisma sin `personas`. Con su guion de vuelta atrás en el propio archivo.
- **Se comprueba (A8):** `migrate status` al día; `test:aislamiento` con **49** claves compuestas (el número
  esperado baja de 54: se cambia en el test y se explica en el comentario); todas las suites; Supabase
  `get_advisors` sin avisos nuevos.

### T13 · Borrar `personas_respaldo` `[ ]`
Una versión después de T12, con la copia de seguridad a mano: `DROP TABLE personas_respaldo`.
- **Se comprueba:** `migrate status`; suites.

## Cierre

### T14 · Documentación `[ ]`
`CLAUDE.md` (Tenancy y "Person data": ya no hay `personas`; el duplicado se traduce en `errorHandler`; los
pasajeros son una copia), `README.md` (convenciones), notas en las specs 002 (el 54 → 49) y 003 (el contrato
de persona), y esta spec en `Estado: hecha`.
- **Se comprueba:** `grep -rn "personas" docs CLAUDE.md README.md` solo en historia (specs viejas, decisiones).

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-03 | — | Diseño aprobado en conversación (independientes, camino híbrido); spec, plan y tareas escritos. |
