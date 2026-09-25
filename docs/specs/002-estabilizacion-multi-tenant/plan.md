# Plan técnico — Spec 002

No hay rediseño: la arquitectura de la 001 se mantiene. Aquí solo las decisiones nuevas y por qué,
para poder ejecutar y para que la siguiente persona no las deshaga.

## Decisiones

**1. El servidor se niega a arrancar con un rol que salta la RLS.** `src/index.js` consulta
`rolbypassrls OR rolsuper` del rol de la conexión (`pg_roles WHERE rolname = current_user`) antes
de abrir el puerto y sale con código 1 si salta la RLS. Se decidió que **falle cerrado**: si no puede
comprobarlo (la base no responde), tampoco arranca. Un arranque en el que la comprobación se omitió y
luego la base vuelve con un rol equivocado es justo el fallo silencioso que se quiere evitar. **No hay
bandera de escape**: solo el arranque del servidor comprueba, así que los scripts y las migraciones,
que sí usan `postgres`, no se ven afectados. Consecuencia a tener presente: el hosting debe tener
`DATABASE_URL` con `app_nexus` o el despliegue no levantará.

**2. La prueba de aislamiento se hace por la API.** `test:aislamiento` mira la base; no ve lo que la
aplicación hace con ella. El verificador monta dos agencias con `companiesService.create` (el
servicio real, bajo `sinEmpresa` con bandera de superadmin), entra por `POST /auth/login`, crea los
datos por la API real y ataca en los dos sentidos. Cada ataque tiene su **control positivo**: sin
comprobar que la misma operación funciona sobre lo propio, un 404 podría ser una ruta mal escrita y
no un aislamiento. Levanta su propio servidor en otro puerto con `app_nexus` y
`AUTH_RATE_LIMIT_MAX` alto (el límite de login es de cinco por minuto por IP).

**3. Las agencias de prueba se borran solo si son suyas.** El desmontaje usa el rol administrador y
filtra por `slug LIKE 'verif-aisl-%'` antes de borrar nada: un fallo del script no puede tocar una
agencia real. Borra por `empresa_id` en todas las tablas que lo tengan, con pasadas repetidas hasta
que las claves ajenas dejen de estorbar. Los ficheros que las subidas dejan en disco se borran por
contenido exacto, no por nombre ni por fecha.

**4. `multer` restaura el contexto de agencia.** Lee el request en callbacks de eventos, y ahí el
`AsyncLocalStorage` de la 001 se pierde: el handler corre sin empresa y la política no deja ver ni la
fila que se acaba de autenticar. `middleware/conservarContexto.js` reabre `conEmpresa` tras el
middleware de subida, y se aplica en **un solo sitio**: `upload.js` y `uploadLogo.js` exportan
`single`/`array` ya envueltos, de modo que ninguna ruta nueva se queda sin él. La empresa sale de
`req.empresaId` (la de trabajo) y la bandera de superadmin de `req.user.role`, la fila de la base.

**5. Las transacciones tienen márgenes acordes a la latencia.** `transaccion()` pasa
`{ maxWait: 10000, timeout: 30000 }` por defecto. Los 2 s y 5 s de Prisma se alcanzan con un pico de
latencia al pooler, y entonces el dashboard falla con `Unable to start a transaction in the given
time` o `Transaction not found`. Relajar los límites no cambia la semántica; `createSale` ya pedía
30 s y sigue pudiendo pasar los suyos, que tienen prioridad.

**6. `/auth/me` devuelve lo mismo que el login.** Añade `empresaId` y `empresaSlug` de la empresa
**donde se trabaja** (`req.empresaId`), no la de origen: es la que la pantalla representa y la que
hay que usar para salir de una suplantación. La ficha del usuario se lee en su empresa de origen y la
empresa activa en la de trabajo, en paralelo, para no sumar un viaje. En el frontend, `getMe()` pasa
a estar tipado con el contrato del login; antes devolvía `any` y por eso el compilador nunca avisó de
que el campo no llegaba tras una recarga.

**7. La caché de autenticación se puede invalidar por agencia.** La entrada guarda el
`empresa_id` **del usuario** (no el de la empresa visitada) y `olvidarEmpresa` compara contra él. Así,
suspender una agencia expulsa a su gente al instante, y un superadmin que la esté suplantando no cae:
su entrada lleva su propia empresa y dar soporte a una agencia suspendida es cuando más hace falta.

**8. Los catálogos de gestión interna tienen una sola copia.** `DataContext` (`data.config`). La
pantalla de configuración y el asistente de venta leen y escriben el mismo estado. Es la misma
decisión que ya se tomó para la lista de ventas, aplicada aquí.

## Superficie de API

| Cambio | Detalle |
|---|---|
| `GET /auth/me` | Añade `empresaId` y `empresaSlug`. Ningún campo se quita. |
| Rutas con subida (`PUT /users/:id/avatar`, `PUT /clients/:id/avatar`, `POST /sales/:saleId/products/:category/:productId/voucher`, `PUT /flights/:id/checkin`, `PUT /companies/:id/logo`) | Mismo contrato; ahora funcionan con la RLS activa. |

| `PUT` y `PATCH /sales/:saleId/products/:categoria/:productId` | **Retirados** (T8). Ninguna pantalla editaba productos, y el `PUT` de un tiquete ignoraba sus tramos. Responden 404. |
| `POST` y `DELETE /sales/:saleId/products/...` (productos sueltos) | **Retirados** (T15). Los productos se crean con la venta; ninguna pantalla añadía ni quitaba productos de una venta ya creada. |
| `POST /sales/:saleId/products/:category/:productId/voucher` | **Sustituido** por `PUT /sales/:saleId/products/:detalleId/voucher` (multipart `file`, permiso `sales.create`). Reemplaza el voucher anterior y exige que la línea sea de la venta de la URL. |
| `POST /sales` | Valida cada producto (422 con el campo, p. ej. `hotelData.0.hotelType`) y la respuesta añade `products: [{ category, index, detalleId }]`. |
| Cualquier ruta inexistente bajo `/api` | 404 en el formato de la API (`ROUTE_NOT_FOUND`), no la página HTML de Express. |
| `POST /commissions/settlements` | El monto lo calcula el servidor (`amount` opcional; si llega y no coincide, 409). Errores con código propio. |

Ningún endpoint nuevo.

## Entorno

- `DATABASE_URL` usa `app_nexus.<ref>` con `?pgbouncer=true&connection_limit=10&pool_timeout=20`.
  Con `connection_limit=1` las consultas se encolan contra sí mismas y la carga inicial da 500 (medido
  en el README: 4182 ms frente a 1212 ms).
- `DIRECT_URL` sigue con `postgres` en el pooler en modo sesión: lo usan las migraciones y
  `prisma generate --sql`.
- El `.env` no se versiona, y ese es el origen de B1: la corrección que vale es la comprobación al
  arrancar, no un aviso en un README.
- Coordinación: la base `nexus-bd` es compartida. Cambiar la contraseña de `app_nexus` invalida la
  anterior para todo el que la tenga: los `.env` de los demás y el hosting.

## Orden de ejecución

Primero la barrera (B1): mientras el rol sea el equivocado no se puede comprobar nada más. Después,
la verificación por la API (B2–B6), que es lo que descubre los fallos que solo existen con la barrera
puesta. Lo que destapa se arregla dentro del mismo paso. Ventas (B10, B12, B13) y las tareas de
limpieza van después, cada una con su comprobación en `tasks.md`.
