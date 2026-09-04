# Nexus Soft

Software de gestión para agencia de viajes: ventas, clientes, comisionistas,
itinerarios y configuración.

- **backend** — Express 5 + Prisma sobre PostgreSQL (Supabase)
- **frontend** — React 19 + Vite + Tailwind

## Puesta en marcha

```bash
# backend
cd backend && pnpm install
cp .env.example .env        # rellenar DATABASE_URL y DIRECT_URL
pnpm db:generate
pnpm dev                    # http://localhost:3000

# frontend
cd frontend && pnpm install
pnpm dev                    # http://localhost:5173
```

### La conexión a la base de datos

`DATABASE_URL` apunta al *pooler* de Supabase (puerto 6543) y **debe** llevar:

```
?pgbouncer=true&connection_limit=10&pool_timeout=20
```

`connection_limit=1` es la recomendación de Prisma para entornos *serverless*, donde
hay muchas instancias efímeras. Este backend es un servidor de larga vida: con una
sola conexión, todas las consultas se encolan contra sí mismas y la carga inicial de
la aplicación agota el `pool_timeout` y devuelve errores 500. Medido con las mismas
8 consultas en paralelo: `limit=1` → 4182 ms, `limit=10` → 1212 ms.

El archivo `.env` no se versiona: cada persona debe aplicar este valor en el suyo.

**`DIRECT_URL` debe apuntar al pooler en modo sesión, no al host directo.** Supabase
dejó de exponer `db.<proyecto>.supabase.co:5432` por IPv4, así que ese host **no
responde**: es el mismo pooler, puerto 5432 y sin los parámetros de pgbouncer.

```
DIRECT_URL=postgresql://<usuario>:<clave>@aws-1-us-east-1.pooler.supabase.com:5432/postgres
```

No es opcional. `prisma db push` y `prisma generate --sql` usan `directUrl`, y con el
host viejo los dos fallan con `P1001 Can't reach database server`. **Eso incluye el build
de Render**, porque `npm run build` ejecuta `prisma generate --sql`.

## Convenciones de la API

### Paginación

Toda colección se pagina. **10 por página** es el valor por defecto, con un tope de 100
por petición para que un `?perPage=99999` no tumbe el servidor.

```json
{
  "success": true,
  "data": [ ... ],
  "meta": { "page": 1, "perPage": 10, "total": 47,
            "totalPages": 5, "hasNext": true, "hasPrev": false }
}
```

**El `count` y las filas deben construirse con el mismo filtro.** Es el error que más
veces ha aparecido en este repo: el SQL filtraba y el `count` de Prisma no, así que una
búsqueda sin resultados seguía informando de que había N registros.

La forma de no volver a cometerlo es **no escribir el filtro dos veces**. Con el API de
objetos hay un solo `where` y lo comparten `count` y `findMany`, así que es imposible que
discrepen. Con `$queryRawUnsafe` hay que mantener a mano el texto del SQL y el `where` de
Prisma en paralelo, que es de donde salió el bug.

### SQL tipado para lo que el API no expresa

Las consultas que necesitan `SUM`, `CASE`, `COUNT FILTER` o CTEs viven en
`backend/prisma/sql/*.sql` y se llaman con `$queryRawTyped()`. Prisma **las valida contra
la base al generar el cliente**, así que una columna mal escrita o un cast imposible
rompen el build en vez de la petición — es la red de seguridad que `check:prisma` no
puede dar, porque no puede mirar dentro de una cadena de SQL.

Requisitos y avisos:

- `previewFeatures = ["typedSql"]` en el generador. Es una *preview*.
- `build` y `db:generate` llevan `--sql`. **Sin él, `@prisma/client/sql` no existe** en un
  clon nuevo y el servicio falla al importar.
- El build **necesita conexión a la base** (ver `DIRECT_URL` arriba).
- **Los filtros opcionales van dentro del SQL**, no concatenados: TypedSQL necesita una
  consulta estática. El patrón es `AND ($1::timestamptz IS NULL OR creado_at >= $1)`.
- En este backend, que es JavaScript sin `tsc`, **la comprobación de tipos en compilación
  no aporta nada**: nadie lee los `.d.ts` generados. Lo que se gana es la validación del
  SQL en el build y que la parametrización sea obligatoria por API.

### No partir una consulta agregada en varias

Es tentador mover cada agregado a `count()`/`aggregate()` de Prisma. Va al revés: lo que
cuesta es el viaje a la base, no el cálculo. Medido, cuatro agregados sobre `ventas`:

```
1 consulta SQL con los cuatro:            408 ms
4 consultas de objetos en paralelo:       889 ms
```

`dashboardAggregates.sql` calcula **doce** en una sola consulta. Por la misma razón se
descartó doblar el `count` de los listados dentro de la consulta de filas con
`COUNT(*) OVER()`: las dos ya iban en `Promise.all`, así que el ahorro era cero, y una
página vacía no devuelve total y obliga a contar aparte — 520 ms → 892 ms en una búsqueda
sin coincidencias.

**Con una base a decenas o cientos de milisegundos de distancia, lo que importa no es el
número de consultas sino cuántas van en serie.** Reducir consultas paralelas no hace nada.

### Objetos o SQL crudo

**Por defecto, el API de objetos.** Con `relationLoadStrategy: 'join'` resuelve el árbol
en una sola consulta, así que el argumento clásico de "SQL crudo para no hacer N viajes"
ya no aplica. Medido convirtiendo `listClients` y `listUsers`, 13 casos con salida
idéntica: **~483-530 ms → ~375 ms**, mismo número de consultas. Además queda cubierto por
`pnpm check:prisma`, que no puede mirar dentro de una cadena de SQL.

**SQL crudo solo para lo que el API no expresa:** `SUM`, `COUNT(*) FILTER`, CTEs, `CASE`.
Es el caso de `sales.getCreditPortfolio`, `commissions.listAgents`,
`responsables.listResponsables` y `stats.*` — 13 de las 15 consultas crudas del repo.

Cuando toque SQL crudo: **parámetros posicionales, nunca interpolación**. `listUsers`
metía los valores en el texto y los escapaba con `replace(/'/g, "''")`; eso ya no está.

### Nunca calcular totales en el navegador

Si una pantalla necesita una suma o un conteo, lo devuelve el servidor. Sumar en el
cliente sobre una lista paginada da un número incorrecto, no solo lento — y no se nota
mirando la pantalla.

| Necesidad | Endpoint |
|---|---|
| Cartera de crédito por cliente | `GET /sales/credit` → `meta.totals` |
| Acumulado de un comisionista | `GET /commissions/agents` → `accumulated` (SUM en SQL) |
| Compras de un cliente | `GET /clients/:id?includeSales=true` → `salesCount`, `salesTotal` |
| Ventas de un asesor | `GET /users/:id` → `salesCount`, `salesTotal` |
| Check-ins por estado | `GET /flights/checkins` → `meta.counts` (pendiente, crítico, realizado, cancelado) |

### Cargar solo lo que se pide

`GET /sales/:id` devuelve cabecera, pagos y un **inventario** de qué categorías tiene
la venta. Los productos se piden aparte:

```
GET /sales/:id                      cabecera + products: [{category, label, count}]
GET /sales/:id/products/:categoria  una categoría
GET /sales/:id/products             todas (lo usa el voucher, que necesita la venta entera)
```

Lo mismo en configuración: `GET /config/packages` devuelve un listado ligero y
`GET /config/packages/:id` el detalle completo. `select` e **include son excluyentes**
en Prisma, y un `include` de cinco relaciones son seis viajes a la base por fila.

**Cuando el `include` anidado hace falta, usar `relationLoadStrategy: 'join'`**
(preview `relationJoins`, activada en el generador). Resuelve todo el árbol con un JOIN
lateral en vez de una consulta por nivel. Medido en `GET /flights/checkins`, que anida
cuatro niveles: **27 consultas y ~1900 ms por petición → 12 consultas y ~350 ms**. Cada
viaje al pooler cuesta 75-160 ms, así que el coste no era el SQL sino el número de idas
y vueltas.

Lo que queda son en su mayoría `BEGIN`/`COMMIT`/`DEALLOCATE ALL`: Prisma envuelve cada
operación en su transacción implícita. **No agruparlas con `$transaction([...])`**: las
consultas independientes van hoy en `Promise.all` y se solapan; dentro de una
transacción se ejecutarían en serie y el tiempo de pared empeoraría.

### Selectores con muchas opciones

Usar `AsyncCombobox`, que busca en el servidor, en vez de cargar el catálogo entero.
Cuando de verdad haga falta la lista completa en memoria, `api/fetchAll.ts` recorre
todas las páginas: pedir `perPage: 100` y quedarse con lo que venga corta la lista en
silencio en cuanto hay más de 100 registros.

### Categorías de producto

Las 15 categorías tienen **un solo nombre** en todo el sistema —segmento de URL, valor
de `detalle_venta.categoria` y clave del catálogo— definido en
`backend/src/catalog/products.js`:

```
ticket · hotel · insurance · plan · checkin · migration · simcard · car
finca · tour · convention · restaurant · visa · passport · pet
```

`detalle_venta.categoria` es un enum de Postgres (`ProductCategory`). Añadir una
categoría se hace en el catálogo y en el enum, no repartido por quince sitios.

**Productos dentro de un plan:** un plan puede contener vuelos, hotelería y seguros.
Se guardan con `parentDetalleId` apuntando al plan, y **solo aparecen dentro del GET de
su plan**, nunca en el de su propia categoría.

### Vuelos y check-in

La pantalla vive en `/flights` (antes `/itineraries`, que redirige) y la sirve
`/api/flights`. El módulo de permisos sigue llamándose `itineraries`, porque es una clave
almacenada en `permisos_rol`.

```
GET  /flights                              calendario: un tramo por fila, filtrable por fechas
GET  /flights/checkins                     check-ins, con meta.counts por estado
PUT  /flights/:id/checkin                  registra el check-in de UN tramo y envía los adjuntos
POST /flights/:id/checkin/cancellation     cancela el check-in; el motivo es obligatorio
```

**El estado del check-in vive en `tramos_vuelo.checkin_status`, por tramo.** No en el
producto: el check-in aéreo se hace vuelo a vuelo, y con el estado a nivel de
`prod_tiqueteria` hacer el check-in de la ida marcaría el regreso como realizado y lo
haría desaparecer de la lista de pendientes sin que nadie lo hubiera hecho.

`prod_tiqueteria.checkin_status` se conserva porque la lee el detalle de venta
(`catalog/products.js`), y se mantiene como **agregado**: pasa a `realizado` solo cuando
lo están todos los tramos del producto. Ese recálculo va en la misma transacción que la
escritura del tramo.

**`critico` no se almacena.** Depende de la hora actual, así que guardarlo exigiría un
cron y quedaría desincronizado. Se deriva: pendiente y salida dentro de las próximas 48
horas. Por eso `?status=critico` no es una igualdad de enum sino un predicado compuesto,
y por eso `meta.counts.critico` sale de un `count` aparte y no del `groupBy` —agrupar por
la columna daría siempre 0—. Es un **subconjunto** de `pendiente`, no un estado disjunto:
si excluyera a los críticos de la lista de pendientes, los vuelos más urgentes
desaparecerían justo de la pantalla que sirve para no olvidarlos.

`checkin_status` es nullable, así que el filtro de pendientes casa también los NULL. Con
la igualdad a secas, una fila con NULL se mostraría como pendiente pero no la encontraría
ningún filtro ni la contaría ningún contador.

El correo del check-in se envía **después** del commit, nunca dentro de la transacción, y
un fallo de envío no revierte el check-in: se devuelve `emailSent: false` con el motivo.

**La cancelación es un recurso aparte,** no un valor más del `PUT`. Cancelar exige un
motivo (`reasonCanceled`, 5-255 caracteres, `trim` antes de medir), y como endpoint propio
esa obligación la impone el schema en vez de una validación condicional según el estado
pedido, que es la clase de regla que se escapa. Guarda `canceled_at` y `reason_canceled`,
y limpia `checkin_at` porque el check-in deja de estar hecho.

`cancelado` es **terminal y disjunto**: no cuenta como pendiente, así que nunca es crítico
—sale gratis, porque el predicado de pendiente solo casa `pendiente` y NULL—. El
invariante de los contadores es `pendiente + realizado + cancelado == total`, con
`critico <= pendiente`. Revertir una cancelación equivocada se hace con el `PUT`, que
limpia los dos campos: dejar el motivo puesto contradiría al estado.

En el rollup, **un tramo cancelado no bloquea**: si el resto está hecho el producto queda
`realizado`, porque un tramo que ya no se vuela no puede dejarlo pendiente para siempre.
Si todos están cancelados, el producto es `cancelado`.

En el calendario el **rojo es cancelado**. Antes lo usaba "vencido", que pasó a ámbar: con
los dos en rojo el color no distinguiría "el check-in se pasó de fecha" de "el vuelo se
canceló".

### Otras reglas

- `POST` devuelve **201**; `DELETE` devuelve **204** sin cuerpo. La excepción es
  `DELETE /sales/:id/payments/:id`, que devuelve el estado recalculado de la venta
  porque borrar un pago la muta y el cliente necesita el resultado.
- Los errores de validación devuelven **422** con `error.details: [{field, message}]`.
- Los recursos son sustantivos: la anulación es `POST /sales/:id/cancellation`.
- Nunca interpolar valores en SQL. Los servicios con `$queryRawUnsafe` usan parámetros
  posicionales. Los enums de Postgres necesitan cast explícito: `?::"UserStatus"`.

### Nombres de Prisma

El schema declara los campos en **snake_case** (`monto_total`, `creado_at`,
`detalle_venta_id`). Escribirlos en camelCase no da error al programar: Prisma falla en
ejecución, y solo si esa rama llega a ejecutarse. Así estuvieron rotos durante meses
`createSale` con productos, los 45 endpoints de producto, `getClientById`,
`updatePermissions`, `listPayments`, `sendVoucher` y `getResponsableById`.

La excepción es cuando el schema usa `@map`: ahí el nombre que espera Prisma es el del
**schema**, no el de la columna. `parentDetalleId @map("parent_detalle_id")` se escribe
`parentDetalleId`.

Antes de subir cambios que toquen consultas:

```bash
cd backend && pnpm check:prisma
```

Valida cada llamada contra el modelo correspondiente y sugiere el nombre correcto.
Sale con código 1 si encuentra algo, así que sirve tal cual en CI.

Cubre los literales dentro de la llamada y los objetos que `products.controller.js`
construye en sus *transforms*. Lo que **no** puede ver es un objeto armado en una
variable y pasado después a `create`: para eso está la prueba de humo, que ejercita
los endpoints de verdad.

## Permisos

Los permisos son **por rol** (`admin`, `asesor`, `freelancer`) y viven en la base de
datos, en `permisos_rol`. Se leen y editan con:

```
GET  /roles/:rol/permissions
PUT  /roles/:rol/permissions     body: { permissions: { modulo: { accion: valor } } }
```

Las constantes de `frontend/src/types/index.tsx` son la red de seguridad para cuando esa
petición aún no ha respondido o falla, **nunca la fuente**.

Los permisos individuales por usuario se retiraron: la tabla estaba vacía y el endpoint
que los guardaba nunca llegó a funcionar.

> `authorize.js` mantiene un atajo que concede todo al rol `admin`. Es deliberado: evita
> que alguien se bloquee fuera del sistema quitándole permisos al rol admin desde la
> propia interfaz. Si se retira, hace falta antes una salvaguarda que impida quitar
> `users.view` y `config.edit`.

## Documentación

- `docs/designs/` — decisiones de diseño, con el problema, las alternativas descartadas
  y el resultado medido.
- `docs/specs/` — especificaciones de pantallas.

## Herramientas de agentes

`skills-lock.json` es el manifiesto de las skills que el equipo usa en este proyecto.
Para reinstalarlas:

```bash
npx skills add <owner/repo@skill>
```
