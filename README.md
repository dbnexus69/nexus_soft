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
búsqueda sin resultados seguía informando de que había N registros. Cada servicio con
`$queryRawUnsafe` construye sus condiciones una sola vez y las comparte entre ambos.

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
| Check-ins urgentes / completados | `GET /flights?checkinStatus=...&perPage=1` → `meta.total` |

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

### Otras reglas

- `POST` devuelve **201**; `DELETE` devuelve **204** sin cuerpo. La excepción es
  `DELETE /sales/:id/payments/:id`, que devuelve el estado recalculado de la venta
  porque borrar un pago la muta y el cliente necesita el resultado.
- Los errores de validación devuelven **422** con `error.details: [{field, message}]`.
- Los recursos son sustantivos: la anulación es `POST /sales/:id/cancellation`.
- Nunca interpolar valores en SQL. Los servicios con `$queryRawUnsafe` usan parámetros
  posicionales. Los enums de Postgres necesitan cast explícito: `?::"UserStatus"`.

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
