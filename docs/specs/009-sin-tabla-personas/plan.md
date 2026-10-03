# Plan técnico — Spec 009

## Decisiones

**1. Expandir → cambiar → contraer, con migraciones versionadas.** Nunca `db push` (`CLAUDE.md`). Dos
migraciones SQL a mano, leídas antes de aplicar: `…_personas_columnas_propias` (expandir, con la copia de datos)
y `…_quitar_personas` (contraer). Entre las dos, solo cambia código.

**2. Las columnas son *nullable* hasta el final.** `NOT NULL` en `nombres`/`apellidos` solo se pone al
contraer, cuando la resincronización ha dejado todas las filas completas. Así el código viejo de la otra rama no
rompe al insertar (T2, T11).

**3. Una copia en SQL, no en JavaScript.** El backfill es `UPDATE tabla SET … FROM personas WHERE …` dentro de
la propia migración (atómico, rápido, sin pasar por el pooler fila a fila) y se repite como script idempotente
(`WHERE nombres IS NULL`) para la resincronización. Normaliza al copiar: `upper(btrim(documento))`, `lower(btrim(email))`.

**4. Un solo helper para las columnas de persona** (`backend/src/utils/datosDePersona.js`): la lista de
columnas, `columnasDePersona(data)` (cuerpo validado → campos de la tabla) y `datosDePersonaARespuesta(fila)`
(fila → `firstName`, `docType`…). Los cuatro servicios dejan de repetir el mapeo (`personas.nombres` →
`firstName`…, hoy copiado en ~15 sitios). Los esquemas de Zod (`schemas/personaCampos.js`) no cambian.

**5. Un solo sitio traduce el duplicado.** `errorHandler` ya traduce `P2002`; se añade que, cuando el índice es
el del documento de una de las cuatro tablas, la respuesta es `400 DUPLICATE_DOCUMENT` con `details`
`[{ field: 'docNumber', message }]`, igual que hoy lo arma a mano `clients.service`. Se borran las consultas
previas "¿ya existe?" y los cuatro mensajes distintos.

**6. Sin revivir.** Se eliminan `reactivarUsuario` y las ramas "persona existente de baja" de clientes,
responsables y comisionistas. El alta de un documento dado de baja es un `create` normal; el índice parcial lo
permite porque la fila vieja tiene `deleted_at`.

**7. Pasajeros = copia.** `createSale` escribe `nombres`, `apellidos`, `tipo_documento_id`, `documento` en cada
`pasajeros_detalle`. Desaparecen `findOrCreatePersona`, la precarga `catalogos.personas` y el upsert por
`(empresa_id, documento)` (que existía para evitar choques de unicidad entre pasajeros: ya no hay unicidad).
La separación nombre/apellidos del pasajero (hoy "mitad y mitad" en `findOrCreatePersona`) se mantiene tal cual.

**8. Contraer en dos pasos.** Primero renombrar `personas` → `personas_respaldo`, quitar sus claves ajenas, la
política RLS y `persona_id` de las cinco tablas, y revocar los permisos de `app_nexus`; una versión después,
`DROP TABLE`. Renombrar hace fallar de golpe a cualquier lector olvidado, y se puede deshacer.

## Orden de ejecución

```
T0 preparar ─ T1 expandir ─ T2 verificador/resincronización ─ T3 helper + duplicado
                                      │
        ┌─────────────┬───────────────┼───────────────┬─────────────┐
       T4 clientes   T5 comisionistas  T6 responsables  T7 usuarios   T8 pasajeros      (independientes entre sí)
        └─────────────┴───────────────┬───────────────┴─────────────┘
                              T9 lecturas restantes ─ T10 semilla, pruebas, frontend
                                      │
                         T11 ventana de verificación (corte)
                                      │
                    T12 contraer (renombrar) ─ T13 borrar ─ T14 documentación
```

T4–T8 se pueden hacer en cualquier orden y cada una deja el sistema funcionando (las demás siguen leyendo
`personas`, que se mantiene al día hasta T11 por la resincronización).

**Mientras dura T4–T8 hay dos fuentes.** Un módulo ya cambiado escribe solo en sus columnas, así que `personas`
queda desfasada para ese módulo; ningún código no migrado lee esa fila *de ese módulo* (cada módulo lee la suya),
salvo las lecturas cruzadas de T9 (estadísticas, correo del cliente, `flights`), que por eso van **después**.

## Rollback

| Hasta | Cómo se deshace |
|---|---|
| T3 | Nada que deshacer: solo columnas nuevas y un helper sin usar. `DROP COLUMN` si se abandona |
| T4–T8 | Revertir el commit del módulo. Lo escrito en columnas propias tras el cambio se recupera con la resincronización inversa (T2, `--hacia-personas`) |
| T12 | `ALTER TABLE personas_respaldo RENAME TO personas` + volver a crear las claves (guion en la propia migración) |
| T13 | Solo con la copia de seguridad (punto de restauración de Supabase). **Por eso T13 espera una versión** |

## Verificación

- `tests/personas-migracion.js` (nuevo, T2): compara campo a campo las cuatro tablas y los pasajeros contra
  `personas`; sirve antes del corte (T11) y deja de tener sentido tras T12.
- Las suites existentes son el contrato de la API (A2) y **no se editan** salvo lo estrictamente necesario
  (`aislamiento.js` monta filas con `personas`; `montaje.js` crea el superadmin con una persona).
- Pruebas nuevas en `aislamiento-api.js`: A3, A4, A5. En `vuelos-api.js`/`aislamiento-api.js`: A6.
- `pnpm check:prisma` tras cada tarea (valida los campos contra el esquema).

## Qué no se mide hasta tenerlo

El número de filas por tabla y los documentos duplicados o vacíos que ya existan en producción. T0 los cuenta
con consultas de solo lectura que el usuario debe autorizar (la base es compartida y se vio que la lectura de
datos de agencias reales está restringida); el plan no depende de ellos, pero el verificador sí los usará.
