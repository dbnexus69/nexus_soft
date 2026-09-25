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

**Lo que apareció al ejecutarla (2026-09-25).** Arreglar el dinero y probarlo de punta a punta destapó
una segunda tanda, todas del mismo tipo —datos que la pantalla pide y el servidor pierde, o estados que
la pantalla no se entera de que cambiaron—:

- Liquidar a un comisionista no marcaba ninguna venta como liquidada: el acumulado se podía pagar dos
  veces. Y la pantalla no enseñaba ningún error de la API, de ningún tipo.
- El voucher adjuntado a un producto en el asistente se ignoraba (0 de 37 productos con voucher), y la
  tarjeta con la que se paga al proveedor también. "Hotel Turístico" tumbaba el alta con un 500 y un
  `ta` negativo bajaba el total: `POST /sales` no validaba sus productos.
- La sesión caducaba a los 30 minutos de entrar aunque se estuviera trabajando, la pantalla no volvía al
  login, y cerrar sesión no la cerraba en el servidor.

## Qué será posible al terminar

1. Un despliegue o una máquina de desarrollo **no puede arrancar** con un rol que se salta la RLS.
2. El aislamiento se comprueba **por la API**, con usuarios reales de dos agencias, y se puede
   repetir en cada despliegue.
3. La suplantación se entra y se sale desde la pantalla; cerrar sesión y suspender cierran de verdad.
4. Todo lo que funcionaba antes de multi-tenant sigue funcionando con la barrera puesta: subidas,
   catálogos de gestión interna, ventas con todos sus campos.
5. El dinero de una venta es coherente: no hay sobrepagos, dos cobros simultáneos no se pisan y
   anular una venta no deja comisiones vivas.
6. Una venta se crea entera, en un solo `POST /sales` que valida cada producto, y todo lo que el
   asistente pide llega a la base: voucher, tarjeta de pago al proveedor, tipo de hotel.
7. Liquidar comisiones paga lo que se ve, una sola vez, y cualquier rechazo dice qué pasó y qué hacer.
8. La sesión dura mientras se trabaja; cuando caduca, la pantalla lo dice y vuelve al login.

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
| B14 | La aplicación no puede escribir el historial de migraciones | `app_nexus` sin `INSERT`/`UPDATE`/`DELETE` sobre `_prisma_migrations` | cumplido (sin ningún acceso) |
| B15 | Una venta se crea entera y se valida en su única puerta | `POST /sales` con un `ta` negativo o un tipo de hotel inexistente: 422 que nombra el campo, y no se crea nada. Con "Hotel Turístico": 201 | cumplido |
| B16 | Un voucher adjuntado en el asistente se guarda en su producto | Tras el 201, `PUT /sales/:id/products/:detalleId/voucher` lo guarda; con la línea de otra venta, 404 y sin huérfano en disco | cumplido (API y cliente del frontend; sin recorrido del asistente con archivo en pantalla) |
| B17 | Liquidar paga lo que se ve, una vez, y los rechazos se entienden | Sin `salesIds` liquida todo lo pendiente y marca las ventas; con un monto distinto, 409 con el actual; dos liquidaciones a la vez pagan una sola; la fecha elegida es la que se guarda y se lee (servidor en Bogotá y en UTC); el mensaje sale en el modal | cumplido |
| B18 | La tarjeta con la que se paga al proveedor se guarda | `POST /sales` con la tarjeta (por id o, en borradores viejos, por nombre) la guarda en la línea; una inexistente o de otra agencia, 400 sin venta; el detalle la devuelve | cumplido |
| B19 | La sesión dura mientras se trabaja y, al caducar, se vuelve al login | Una sesión a 1 min de caducar se renueva al usarla; una caducada da 401 y la pantalla vuelve al login con el motivo; "recordarme" no se acorta; cerrar sesión borra la fila de `sesiones` | cumplido |

## Fuera de alcance

- **La marca por agencia.** El texto legal del voucher todavía dice "DB Nexus", la marca de la casa
  parpadea mientras carga `/branding` y el `<title>` es fijo. Decidido dejarlo para después.
- **La deuda de coherencia**: unas 16 búsquedas por documento, por nombre de rol o por nombre de
  método de pago siguen escritas como si el único fuera global. La RLS las acota, así que no filtran;
  tres dan mensajes falsos ("ya está asignado en el sistema" cuando solo miraron la agencia activa).
- **Rendimiento.** Con ~0,8 a 1,2 s de ida y vuelta al pooler desde la máquina de desarrollo, el
  dashboard tarda ~2 s. En el hosting, en la misma región que la base, no aplica.
- **Borrar un catálogo en uso.** Los 8 catálogos de configuración se pueden borrar aunque algo los
  referencie (lo que apuntaba queda en `NULL`); el modal solo informa. Bloquearlo es una decisión para
  los ocho a la vez.
- **Añadir o quitar productos de una venta ya creada.** No existe en ninguna pantalla y se retiró de la
  API (B13, T15). Si hace falta, se diseña como una operación propia.

## Riesgos

**Que la barrera parezca comprobada y no lo esté.** Es el de la 001, y aquí se repitió: la prueba
estaba en verde y el aislamiento no existía en la máquina donde se trabajaba. Por eso B1 es una
comprobación al arrancar y no una recomendación en un README.

**Que los fallos solo aparezcan con la barrera puesta.** Con `postgres` (que se salta la RLS) las
subidas funcionan y no hay 500 por transacciones: el rol equivocado tapa justo lo que hay que ver.
Regla: todo lo que se pruebe, se prueba con `app_nexus`.

**Que dos ramas trabajen sobre la misma base.** `feat-bayrol` y `feat-dbmoon` comparten `nexus-bd`:
una migración aplicada desde una rama deja a la otra con `migrate status` desincronizado hasta que la
trae, y cambiar la contraseña de `app_nexus` deja sin conexión el `.env` de la otra. Cada cambio de ese
tipo se anota en el registro de `tasks.md` con lo que la otra rama tiene que hacer.
