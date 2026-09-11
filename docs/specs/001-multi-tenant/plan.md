# Plan técnico — Spec 001

El razonamiento completo, con las mediciones que lo sostienen, está en
[`docs/decisions/multi-tenant-agencias-independientes.md`](../../decisions/multi-tenant-agencias-independientes.md).
Aquí solo la forma de la solución y la superficie de API, para poder ejecutar.

## Forma de la solución

**Una base, `empresa_id` en cada fila, y la RLS de Postgres como barrera.** El filtro del
código pasa a ser comodidad; el que separa es el motor. Se eligió así porque el patrón
contrario ya falló en este repo: el alcance `own` estaba aplicado en los listados y
olvidado en 15 mutaciones. Con inquilinos, ese mismo olvido es una agencia viendo las
ventas de otra.

**42 tablas llevan `empresa_id`**, incluidas las que podrían deducirlo de su padre: una
política que suba por la relación es una subconsulta por fila. La integridad de esa
denormalización la garantizan claves ajenas compuestas —`detalle_venta(venta_id,
empresa_id)` referencia a `ventas(id, empresa_id)`—, así que no hay código que pueda
colgar una línea de la venta de otra empresa.

**5 tablas quedan fuera**, compartidas y mantenidas solo por el superadmin: `aerolineas`,
`aeropuertos`, `politicas_equipaje`, `tipos_documento` y `permisos`.

**La empresa activa llega a la base por `SET LOCAL` dentro de una transacción**, puesto
por una extensión de cliente de Prisma en su forma de lote. La forma interactiva no sirve:
`query(args)` no corre dentro de esa transacción —comprobado, el contexto llega vacío—.
La empresa vive en un `AsyncLocalStorage` que rellena un middleware por petición.

**Las 18 transacciones existentes pasan por un helper.** Si la extensión envolviera una
operación que ya está dentro de una transacción, abriría otra en otra conexión: las 88
operaciones internas dejarían de revertirse juntas y `recalcularVenta` podría bloquearse
consigo misma. El helper fija el contexto una vez al abrir y marca el `AsyncLocalStorage`
para que la extensión no envuelva nada dentro.

## Superficie de API

Sobre `/api/v1`. Recursos en plural, verbos HTTP con su semántica, y las acciones como
recurso (igual que el `POST /sales/:id/cancellation` que ya existe).

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /companies` | superadmin | Listado paginado de agencias, con su estado |
| `POST /companies` | superadmin | Alta. Crea sus 4 roles y su matriz de permisos. **201** + `Location` |
| `GET /companies/:id` | superadmin | Ficha, con métricas agregadas y sin un solo registro de negocio |
| `PATCH /companies/:id` | superadmin | Actualización parcial: nombre, colores, estado |
| `PUT /companies/:id/logo` | superadmin | Sube el logo (multipart). Idempotente: reemplaza |
| `POST /companies/:id/impersonations` | superadmin | Entra en la agencia. Devuelve un token con caducidad |
| `DELETE /companies/:id/impersonations/current` | superadmin | Sale. **204** |
| `GET /branding` | cualquiera autenticado | Marca de la empresa activa: nombre, logo y colores |

Decisiones de forma:

- **`PATCH`, no `PUT`**, para actualizar una agencia: es una actualización parcial y ya
  hubo que corregir ese mismo desajuste en catálogos y productos.
- **La suplantación es un recurso**, no un verbo (`/impersonations`), y terminarla es
  `DELETE` sobre ella. Así la auditoría tiene dónde vivir de forma natural.
- **`GET /branding` sin id**: la empresa sale del token. Un `/companies/:id/branding`
  invitaría a pedir la marca de otra.
- **Nada de `empresa_id` en el cuerpo de ninguna petición.** Si el cliente pudiera
  mandarlo, sería otra vez el código quien decide el aislamiento.
- Errores con el formato que ya usa la aplicación: `{ success, error: { message, code } }`.

## Numeración visible

`ventas.numero`, único por `(empresa_id, numero)`, asignado dentro de la transacción de
creación. Es lo que se muestra en la interfaz y en el voucher; el `id` sigue siendo la
clave interna y lo que viaja en la URL. Sin esto, los huecos de un autoincrement global le
dicen a cada agencia cuánto vende la otra.

## Orden de ejecución

El orden no es negociable en su primer tramo: el mecanismo antes que el schema, el schema
antes que la RLS, y la RLS antes que cualquier funcionalidad. Cada paso tiene su
comprobación en `tasks.md`.
