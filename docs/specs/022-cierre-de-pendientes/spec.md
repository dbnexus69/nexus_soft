# Spec 022 — Cierre de pendientes tras el análisis del 2026-10-21

**Estado:** diseño, pendiente de permiso para desarrollar · **Rama:** `feat-bayrol` · **Toca la base:** no (solo
la prueba de T5 corre contra la base compartida, con permiso) · **Relacionadas:** [`009`](../009-sin-tabla-personas/spec.md),
[`010`](../010-calidad-y-rendimiento/spec.md) (CI), [`014`](../014-ajustes-del-asistente-de-venta/spec.md) (T7),
[`020`](../020-alcance-de-editar-y-borrar/spec.md) (alcance)

## Por qué

El análisis del 2026-10-21 dejó cinco pendientes sueltos repartidos entre specs. Esta spec los cierra en un solo
lugar, con lo decidido por el usuario el mismo día.

## Qué se quiere (decidido con el usuario, 2026-10-21)

1. **Error 500 de la 014 T7: se cierra como no reproducible.** Se intentó el 2026-10-08 con tres ventas grandes
   por la API (todas 201) y el equipo confirma que las ventas funcionan. Si reaparece, se abre una tarea nueva con
   la línea `[ERROR] <referencia>` del backend. La 014 es de la rama de Darío: se le avisa.
2. **Pruebas en pantalla de las specs propias:** 008, 011, 012, 017 y 020. Las de Darío (006, 013, 014, 015,
   021) no se tocan: se le deja una lista de pasos aparte, sin escribir en sus documentos.
3. **Activar la CI** escrita en la 010 T2 (`docs/ci/ci.yml`).
4. **Archivar la 009** (quitar la tabla `personas`): no se implementa.
5. **Los ficheros subidos respetan el alcance del rol.** Hoy `GET /uploads/:fichero` solo aísla por agencia: un
   asesor con ver `own` abre el voucher o los documentos de check-in de una venta ajena de su agencia si tiene el
   enlace. Debe responder 404, igual que `GET /sales/:id` sobre esa venta.

6. **Crear un cliente no debe sobrescribir los datos de otra persona** (problema heredado de la 009, añadido
   el 2026-10-21). Comportamiento por decidir; ver `tasks.md` T6.

## Cómo se comprueba

| # | Comprobación |
|---|---|
| 1 | La 014 T7 queda cerrada con su motivo (o Darío avisado, ver plan) y esta spec lo registra. |
| 2 | Cada paso de la lista de pruebas marcado ok/falla por el usuario; los ok cierran el "falta probar" de su spec, las fallas abren tarea aquí. |
| 3 | `.github/workflows/ci.yml` existe y la primera corrida en GitHub queda en verde (los dos jobs). |
| 4 | El encabezado de la 009 dice "archivada" con fecha y motivo; nada del código cambia. |
| 5 | `test:aislamiento-api`: el asesor de A pide el voucher de una venta del admin de A → 404; el de su propia venta → 200; el admin → 200 a ambos; otra agencia sigue en 404 y sin sesión en 401. |

## Fuera de alcance

- Mover los ficheros de `backend/uploads` a Supabase Storage (lo exigirá el despliegue, 002 T12).
- Escribir en specs de Darío (006, 007, 013–015, 021) sin orden expresa.
