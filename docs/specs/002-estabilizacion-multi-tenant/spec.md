# Spec 002 — Estabilización tras la migración a multi-tenant

**Estado:** en ejecución · **Ramas:** `feat-bayrol` y `feat-dbmoon`, una por persona, sobre la misma base `nexus-bd` · **Continúa:** [`001-multi-tenant`](../001-multi-tenant/spec.md)

Este documento dice **qué** tiene que pasar y **cómo se comprueba**. El *cómo* técnico está en
`plan.md`; el reparto en tareas, con lo que ya se hizo y lo que falta, en `tasks.md`.

## Problema

La spec 001 dejó el aislamiento construido: RLS en 44 tablas, contexto por petición, suplantación
con auditoría, numeración propia. Pero construido no es comprobado de punta a punta. Al ponerlo a
trabajar en una máquina de desarrollo apareció una serie de fallos que su prueba
(`pnpm test:aislamiento`) no podía ver, porque esa prueba mira la base y no la aplicación:

- Las tres agencias se veían entre sí. El `.env` de esa máquina conectaba con `postgres`, que tiene
  `BYPASSRLS`: las políticas se aplican sin error y no filtran nada. Nada lo impedía ni lo avisaba.
- La suplantación no se podía abandonar desde la pantalla, y cerrar sesión o suspender una agencia
  no cortaba el acceso.
- Toda subida de archivos daba 404 sobre recursos propios, y el dashboard fallaba de forma
  intermitente con 500. Los dos solo existen con la barrera puesta.
- En ventas, el asistente perdía en silencio campos que el usuario había rellenado, y había errores
  de dinero anteriores a la migración que la migración no tocó.

## Qué será posible al terminar

1. Un despliegue o una máquina de desarrollo **no puede arrancar** con un rol que se salta la RLS.
2. El aislamiento se comprueba **por la API**, con usuarios reales de dos agencias, y se puede
   repetir en cada despliegue.
3. La suplantación se entra y se sale desde la pantalla; cerrar sesión y suspender cierran de verdad.
4. Todo lo que funcionaba antes de multi-tenant sigue funcionando con la barrera puesta: subidas,
   catálogos de gestión interna, ventas con todos sus campos.
5. El dinero de una venta es coherente: no hay sobrepagos, dos cobros simultáneos no se pisan y
   anular una venta no deja comisiones vivas.

## Criterios de aceptación

Los de la 001 (A1–A12) siguen vigentes. Estos se añaden, y la columna dice si ya se cumplen.

| # | Criterio | Cómo se comprueba | Estado |
|---|---|---|---|
| B1 | El servidor se niega a arrancar con un rol que salta la RLS | `DATABASE_URL` con `postgres`: sale con código 1 y un mensaje. Con `app_nexus`: arranca y `/api/health` da 200 | cumplido |
| B2 | Ninguna agencia lee datos de otra por ningún listado | Dos agencias, un admin en cada una: 24 listados x 3 pasadas x 2 sentidos, sin rastro de la otra | cumplido |
| B3 | Ninguna agencia lee, edita ni borra un recurso ajeno por id | 26 intentos por sentido: ninguno responde 2xx y los datos ajenos quedan idénticos | cumplido |
| B4 | Un alta con ids de otra agencia responde 400 y no crea nada | Cliente, asesor, responsable, comisionista y método de pago de un abono ajenos | cumplido |
| B5 | Lo propio funciona (control positivo de B2–B4) | GET/PUT sobre cada recurso propio: 200 | cumplido |
| B6 | Las subidas funcionan y respetan al dueño | Voucher y avatares propios: 200. Sin sesión: 401. Con la sesión de otra agencia: 404 | cumplido |
| B7 | Se sale de una suplantación desde la pantalla, y cerrar sesión durante ella cierra la sesión | `/auth/me` trae `empresaId`; tras salir, el token suplantado da 401 | hecho, falta probarlo en pantalla |
| B8 | Suspender una agencia corta el acceso al momento | 401 en la siguiente petición, sin esperar la caché de 5 minutos | hecho, sin prueba automática |
| B9 | Ningún listado da 500 con la latencia normal del pooler | 100 llamadas seguidas a los endpoints con transacción: 0 errores | cumplido |
| B10 | El asistente de venta guarda todos los campos que se rellenan | Crear una venta con cada categoría y leer el detalle | 5 categorías corregidas, sin prueba automática |
| B11 | La pantalla de gestión interna y el asistente de venta leen los mismos catálogos | Crear una aerolínea y verla en el selector del tiquete sin recargar | hecho, falta confirmar en pantalla |
| B12 | El dinero de una venta es coherente | Sin sobrepago; dos abonos simultáneos no superan el total; anular libera la comisión | cumplido |
| B13 | Ningún camino edita un producto a medias (los tramos de un tiquete se ignoraban) | Los productos no se editan: `PUT` y `PATCH` de producto responden 404 `ROUTE_NOT_FOUND` y el producto queda intacto | cumplido (se retiró la edición) |
| B15 | Una venta se crea entera y se valida en su única puerta | `POST /sales` con un `ta` negativo o un tipo de hotel inexistente: 422 que nombra el campo, y no se crea nada. Con "Hotel Turístico": 201 | cumplido |
| B16 | Un voucher adjuntado en el asistente se guarda en su producto | Tras el 201, `PUT /sales/:id/products/:detalleId/voucher` lo guarda; con la línea de otra venta, 404 y sin huérfano en disco | cumplido |
| B14 | La aplicación no puede escribir el historial de migraciones | `app_nexus` sin `INSERT`/`UPDATE`/`DELETE` sobre `_prisma_migrations` | cumplido (sin ningún acceso) |

## Fuera de alcance

- **La marca por agencia.** El texto legal del voucher todavía dice "DB Nexus", la marca de la casa
  parpadea mientras carga `/branding` y el `<title>` es fijo. Decidido dejarlo para después.
- **La deuda de coherencia**: unas 16 búsquedas por documento, por nombre de rol o por nombre de
  método de pago siguen escritas como si el único fuera global. La RLS las acota, así que no filtran;
  tres dan mensajes falsos ("ya está asignado en el sistema" cuando solo miraron la agencia activa).
- **Rendimiento.** Con ~0,8 a 1,2 s de ida y vuelta al pooler desde la máquina de desarrollo, el
  dashboard tarda ~2 s. En el hosting, en la misma región que la base, no aplica.

## Riesgos

**Que la barrera parezca comprobada y no lo esté.** Es el de la 001, y aquí se repitió: la prueba
estaba en verde y el aislamiento no existía en la máquina donde se trabajaba. Por eso B1 es una
comprobación al arrancar y no una recomendación en un README.

**Que los fallos solo aparezcan con la barrera puesta.** Con `postgres` (que se salta la RLS) las
subidas funcionan y no hay 500 por transacciones: el rol equivocado tapa justo lo que hay que ver.
Regla: todo lo que se pruebe, se prueba con `app_nexus`.
