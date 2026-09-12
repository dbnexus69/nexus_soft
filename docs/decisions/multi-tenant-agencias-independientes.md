# Multi-tenant: varias agencias independientes en el mismo software

## Contexto

Hoy el software sirve a una sola agencia. La idea es venderlo a agencias
**independientes** —clientes distintos, sin relación entre ellas— con un superadmin
que da de alta cada empresa con su nombre, logo y colores.

Eso no es "añadir una columna". Medido sobre el repo:

| Qué | Cuánto |
|---|---|
| Modelos en `schema.prisma` | 47 |
| Puntos de consulta a la base | **270** (239 con Prisma + 30 de SQL crudo + 1 `.sql` de TypedSQL) |
| Transacciones | 18 |
| Rutas | 112 (62 solo en `sales.routes.js`) |
| Mecanismos de filtro global instalados | **0** — `src/config/db.js` es `new PrismaClient()` a secas, sin `$extends` ni `$use` |

Y cuatro `@unique` globales que hoy hacen imposible convivir dos empresas:

- `personas.documento` — una cédula existe una vez en todo el sistema.
- `roles.nombre` — los roles son globales y `permisos_rol` cuelga de ellos: **todas las
  empresas compartirían la misma matriz de permisos**.
- `metodos_pago.nombre` — la empresa A no puede tener "Efectivo" si la B ya lo tiene.
- `ventas_mensuales(year, month)` — una fila por mes para todo el sistema: sumaría las
  ventas de todas las empresas juntas.

## Objetivo

Al terminar:

- El superadmin crea una empresa con nombre, slug, logo y colores, y la agencia entra y
  trabaja sin ver ni un registro de otra.
- Un descuido en una consulta **no** produce una fuga: la base rechaza lo que no sea del
  inquilino de la sesión, aunque el código se olvide del filtro.
- El superadmin puede entrar en una empresa para dar soporte, y cada entrada queda
  registrada.

## Decisiones tomadas

| Punto | Decisión |
|---|---|
| Tipo de cliente | Agencias **independientes**. Ninguna comparte datos de negocio. |
| Aislamiento | Una sola base, `empresa_id` en cada fila y **RLS de Postgres** como barrera real. |
| Catálogos del sistema | Aerolíneas, aeropuertos, políticas de equipaje y tipos de documento son compartidos y solo el superadmin los edita. Todo lo demás, por empresa. |
| Identificación | La empresa va en la **URL** (`app.com/agencia1/...`). |
| Login | **Uno solo y común** para todas las empresas, sin marca. |
| Identidad | **Un usuario pertenece a una empresa.** El correo sigue siendo único global. |
| Superadmin | Puede **entrar en una empresa** para soporte, con registro de auditoría. |
| Colores de marca | **Solo en el voucher**, el documento que llega al cliente final. La interfaz mantiene siempre los mismos colores; el nombre y el logo sí son los de la agencia. |

## Fuera de alcance

- **Facturación, planes y límites por empresa** (cuántos usuarios, cuántas ventas). Es un
  producto aparte; esto solo deja la empresa creada y activa o inactiva.
- **Dominio propio por agencia** (`agencia1.com`). La decisión fue ruta, no subdominio; el
  día que haga falta, el slug ya está y solo cambia de sitio.
- **Un usuario en dos agencias.** Decidido que no. La tabla de membresía no se crea.
- **Roles a medida por empresa.** Cada empresa recibe los cuatro roles conocidos con su
  matriz propia y editable, pero no puede inventarse un rol nuevo: hoy `authorize.js`
  deduce la forma de los permisos del nombre del rol, y uno desconocido heredaría en
  silencio los permisos de asesor (hueco 6).
- **Exportar o borrar los datos de una empresa que se va.** Solo se implementa suspender,
  que bloquea la entrada. Qué pasa después con sus datos es una decisión de negocio.
- **Unificar los cuatro nombres de marca del repo.** Hoy conviven "DB Nexus" (frontend),
  "iTea Travel" (remitente de correo), "Samtur Travel" (asuntos de correo) y
  `samtour-temp` (nombre del paquete). Este trabajo parametriza la marca donde se ve; la
  limpieza del resto es otra tarea.
- **Migrar las claves `itea_*` de localStorage** y el CSS del voucher scopado bajo
  `.itea-voucher` (~150 selectores). Funcionan; renombrarlos no aporta aislamiento.

## Los bloqueos previos: uno ya resuelto, dos por resolver

Comprobados contra esta base y este entorno. Si se ignora cualquiera de los que quedan, el
trabajo se hace y no protege nada.

### 1. La RLS, tal cual, no haría absolutamente nada

```
current_user = postgres | rolsuper = false | rolbypassrls = TRUE | dueño de 47 tablas
```

La aplicación se conecta con un rol que **ignora la RLS por diseño**. Las políticas se
crean sin error, se aplican sin error y no filtran nada. Hace falta un rol de aplicación
aparte (sin `BYPASSRLS` y que no sea dueño de las tablas) y cambiar `DATABASE_URL`. Es lo
primero, porque es lo único que convierte esto en una barrera de verdad.

### 2. ~~El cliente de Prisma no se puede regenerar~~ — RESUELTO

Era el bloqueo más caro y resultó ser una línea del `.env`. `pnpm db:generate` fallaba con
`P1001` porque `DIRECT_URL` apuntaba a `db.<ref>.supabase.co`, y ese host **solo tiene
registro IPv6**; esta red no tiene salida IPv6, así que no había forma de alcanzarlo. Ahora
apunta al **pooler en modo sesión** —el mismo host que `DATABASE_URL`, puerto 5432 y sin
los parámetros de pgbouncer—, que responde por IPv4 y admite sentencias preparadas y DDL.

Lo que esto cambia en el plan, y es a mejor:

- `prisma generate --sql` funciona, así que **se puede añadir `empresa_id` al schema** y el
  cliente lo conocerá. Ya no hay que convertir `dashboardAggregates.sql` a SQL crudo: el
  fichero de TypedSQL se queda.
- `prisma db push` y `prisma migrate` también funcionan, así que **la migración de las 42
  tablas no tiene que escribirse a mano**: puede ser una migración normal de Prisma,
  versionada y con su diff revisable. Comprobado además que `migrate diff` sale **vacío**
  hoy: `schema.prisma` y la base están sincronizados, así que la migración partirá de un
  estado limpio.

### 3. La empresa no puede viajar en la conexión, y sí en la transacción

Dos comprobaciones:

```
cadena con  ?options=-c app.empresa_id=7   ->  current_setting(...) = null   (el pooler no lo reenvía)
set_config(...) suelto, leído en otra consulta  ->  "7"   (¡sobrevive!)
SET LOCAL dentro de $transaction                ->  "7"
```

La segunda línea no es una comodidad, es el peligro: con el pooler la conexión se reparte
entre peticiones, así que una empresa fijada a nivel de sesión **puede quedar puesta para
la petición de otro**. Queda descartado el `SET` de sesión.

Lo que funciona es `SET LOCAL` dentro de una transacción, y eso tiene un precio medido:

| 12 consultas | Total | Por consulta | Coste |
|---|---|---|---|
| Sueltas | 4494 ms | 375 ms | — |
| En transacción con `SET LOCAL` | 6275 ms | 523 ms | **+40 %** |
| En transacción por lote | 6342 ms | 529 ms | +41 % |

(La cifra absoluta es de esta red hasta Supabase; en producción, en la misma región, será
mucho menor. Lo que no cambia es que son **una ida y vuelta más por consulta**.)

## Diseño

### La tabla `empresas`, y la marca

```
empresas
  id, slug (unique, va en la URL), nombre, nombre_comercial,
  logo_url, colores en hex (se usan en el voucher, no en la interfaz),
  email_remitente, email_nombre,
  estado (activa | suspendida), creado_at, deleted_at
```

El logo sigue el patrón que ya existe: `src/middleware/upload.js` (disco, filtro de
extensión, tope de 5 MB) y se sirve por `/uploads/<fichero>`, como los vouchers. **Aviso:**
si el backend acaba en un entorno sin disco persistente, esa carpeta se vacía en cada
despliegue y habrá que mover los logos a Supabase Storage. Hoy el problema ya existe con
los vouchers, así que no lo introduce este trabajo.

### `empresa_id` en 42 tablas — sí, en todas

Las 5 del sistema (`aerolineas`, `aeropuertos`, `politicas_equipaje`, `tipos_documento`,
`permisos`) no lo llevan. Las otras 42 sí, **incluidas las que ya podrían deducirlo de su
padre** (`detalle_venta` lo sabría por `ventas`, los 15 `prod_*` por `detalle_venta`).

El motivo es la RLS: una política que tenga que subir por la relación hasta `ventas` se
convierte en una subconsulta **por fila**, y eso se paga en cada listado. Con la columna
denormalizada, la política es una igualdad sobre una columna indexada.

Para que la denormalización no pueda desincronizarse, la integridad la pone la base con
**claves ajenas compuestas**:

```
ventas(id, empresa_id)          -- índice único añadido
detalle_venta(venta_id, empresa_id) REFERENCES ventas(id, empresa_id)
```

Así es imposible colgar una línea de una venta de otra empresa: no hay código que pueda
equivocarse, lo rechaza el motor.

*Se aplazaron al ejecutar (T3b) y se pusieron el 2026-09-12, cuando el fallo que predecían
apareció de verdad: una venta que se guardaba bien y no aparecía nunca en el listado. Son
**53 claves ajenas** sobre 14 tablas padre, y la única excepción es
`suplantaciones.superadmin_id`, cruzada por definición. El detalle, en
[`tasks.md`](../specs/001-multi-tenant/tasks.md).*

### Los `@unique` que cambian de forma

| Tabla | Antes | Después |
|---|---|---|
| `personas` | `documento` | `(empresa_id, documento)` |
| `roles` | `nombre` | `(empresa_id, nombre)` |
| `metodos_pago` | `nombre` | `(empresa_id, nombre)` |
| `ventas_mensuales` | `(year, month)` | `(empresa_id, year, month)` |
| `usuarios` | `email` | **se queda global** (decisión: un usuario, una empresa) |
| `clientes`, `comisionistas`, `responsables`, `usuarios` | `persona_id` | se quedan: la persona ya es del inquilino |

Cada empresa nueva arranca con sus **4 roles sembrados** (`admin`, `asesor`,
`freelancer`, y el `superadmin` solo en la empresa 0) y su matriz de permisos propia. Es
la corrección del agujero más grave del modelo actual: hoy cambiar lo que puede hacer un
asesor lo cambiaría en todas las empresas a la vez.

### Cómo llega la empresa a cada consulta

Una **extensión de cliente de Prisma** en `src/config/db.js`, y la forma exacta importa:
la primera que escribí no funciona. Probadas las dos contra esta base:

```js
// ❌ NO funciona: query(args) NO corre dentro de esa transacción.
$allOperations({ args, query }) {
  return base.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.empresa_id', ...)`
    return query(args)          // -> current_setting() devuelve ""
  })
}

// ✅ Funciona: query(args) es una PrismaPromise perezosa, así que en el array
//    las dos sentencias van en la MISMA transacción.
$allOperations({ args, query }) {
  return base.$transaction([
    base.$executeRawUnsafe(`SELECT set_config('app.empresa_id', $1, true)`, empresa),
    query(args),
  ]).then(([, r]) => r)
}
```

Comprobado: con la interactiva, un `$queryRawUnsafe` a través de la extensión ve
`current_setting('app.empresa_id') = ""`; con la de lote, ve `"42"`. Y con la RLS activa,
`""::int` **lanza excepción**, así que el fallo no habría sido una fuga sino los 30 sitios
de SQL crudo cayéndose — informe de cartera, estadísticas, comisiones y responsables.

La empresa activa se lee de un `AsyncLocalStorage` que un middleware rellena por petición
desde el token. Se elige la extensión, y no envolver la petición entera en una transacción,
porque así **los 239 puntos de consulta no se tocan**: usan `prisma.` directo, y pasarles
un `tx` a mano sería el trabajo más invasivo del proyecto.

Dos límites de la extensión que sí hay que respetar:

1. **La extensión pone el contexto; el que filtra es Postgres.** Si además inyectáramos el
   `where`, habría dos verdades y la del código es la que se olvida.
2. **No puede envolver lo que ya está dentro de una transacción** — ver el hueco 1 de
   abajo, que es el más importante que ha aparecido.

### El superadmin y la suplantación

El superadmin es un usuario con `empresa_id = NULL`. La sesión lleva dos variables:

```
app.empresa_id      -- la empresa activa (la suya, o la suplantada)
app.es_superadmin   -- 'true' solo para él
```

Las políticas de las 42 tablas son `empresa_id = current_setting('app.empresa_id')::int`,
sin excepción para el superadmin: **para ver datos tiene que entrar en una empresa**, y al
hacerlo queda el registro. La excepción vive solo en `empresas` y en las métricas
agregadas, que es lo que necesita para administrar sin abrir un registro de negocio.

```
suplantaciones
  id, superadmin_id, empresa_id, motivo, iniciada_at, expira_at, terminada_at, ip
```

La suplantación **caduca** (p. ej. 1 hora) y emite un token nuevo con la empresa dentro,
en vez de un permiso permanente.

### La URL, y por qué no es la fuente de verdad

Con un usuario por empresa, `empresa_id` sale del **token**, no de la URL. El slug de la
ruta es para las personas: da un sitio a la marca y hace legible el enlace.

Eso obliga a una comprobación explícita: si el slug de la URL no corresponde a la empresa
del token, el backend responde **403**. Sin eso, la URL sería un adorno que miente —
alguien pega `app.com/agencia2/ventas` y ve las suyas bajo el nombre de otra.

### La marca en el frontend

**Los colores van solo al voucher; la interfaz no cambia de color.** Se decidió así al
ejecutar: la aplicación es la herramienta del equipo de la agencia y conviene que sea
siempre la misma —dar soporte no debería depender de la paleta que eligió cada cliente—,
mientras que el voucher es lo único que llega al cliente final. El nombre y el logo sí
están en la interfaz, porque dicen en qué agencia se está trabajando.

El voucher toma dos variables (`--v-tinta` y `--v-acento`) derivadas del color de la
agencia y forzadas a una legibilidad comprobada: la cabecera lleva texto blanco encima y
el acento va sobre papel blanco, con 4,5 a 1 de contraste garantizado.

Lo que hay que parametrizar, con ubicaciones:

| Qué | Dónde |
|---|---|
| Logo | `Sidebar.tsx:131` y `:205`, `Login.tsx:188`, `VoucherPDF.tsx:178` |
| Nombre visible | `Sidebar.tsx:210`, `Header.tsx:87`, `Login.tsx:489` |
| Voucher PDF | `VoucherPDF.tsx:180, 197, 531, 543, 547, 551, 552, 558, 560` y la paleta propia de `VoucherPDF.css` |
| Remitente de correo | `emailService.js:19` (`iTea Travel` está **hardcodeado**; `EMAIL_FROM` solo controla la dirección) |
| Asuntos con marca | `users.service.js:261`, `sales.service.js:1921` (dicen "Samtur Travel") |
| Título de pestaña | `index.html:6` |

El login queda **sin marca de empresa**, como se decidió: es común a todas.

## Huecos que aparecieron al buscarlos

Ordenados por gravedad. Los tres primeros son de los que no avisan.

### 1. La extensión rompería la atomicidad de las 18 transacciones existentes

El repo abre 18 `$transaction` con **88 operaciones** dentro (48 solo en `createSale`). Una
extensión que envuelva cada operación en su propia transacción hace que esas 88 dejen de
pertenecer a la transacción externa. Comprobado midiendo la conexión:

```
conexión de la transacción externa : pid 1760960
conexión de la extensión           : pid 1760958   -> transacciones independientes
```

Y no falla: **funciona y calla**. Dos consecuencias, las dos silenciosas:

- **Una venta a medias deja de revertirse.** Si `createSale` falla en el producto 30 de 48,
  los 29 anteriores ya están confirmados en transacciones propias. Hoy se revierten todos.
- **Riesgo de interbloqueo consigo misma.** La transacción externa tiene filas bloqueadas
  (la cabecera de la venta) y la interna intenta escribirlas desde otra conexión: espera
  hasta el tiempo límite. `recalcularVenta`, que corre dentro de la transacción de la
  venta, tiene exactamente esa forma.

**Solución:** el `AsyncLocalStorage` guarda además "ya estoy en una transacción". Las 18
llamadas pasan por un helper que fija el `SET LOCAL` como primera sentencia de la
transacción y marca la bandera; la extensión, al verla, deja pasar la operación sin
envolverla. Son **18 sitios**, no 239, y cada uno es verificable.

### 2. Los ids que ve cada empresa le dicen cuánto vende la vecina

`ventas.id` es un autoincrement global y se muestra tal cual, relleno a 4 cifras por
`formatSaleId` (`formatters.ts:111`). Con dos agencias trabajando, la A ve sus ventas
`0018, 0019, 0031` y la B `0024, 0029`: **los huecos son las ventas de la otra**, y
cualquiera puede contarlas. Aparece en `SaleDetailModal.tsx:129`,
`SaleEditModal.tsx:287`, `Sales.tsx:326`, `AgentDetailsModal.tsx:146` y —lo peor—
`VoucherPDF.tsx:198`, que es el documento que **recibe el cliente final**.

Hay además un problema comercial: una agencia que empieza hoy vería su primera venta
numerada 0247.

**Solución:** `ventas.numero` con `@@unique([empresa_id, numero])`, asignado dentro de la
transacción de creación, y es lo que se muestra. El `id` sigue siendo la clave interna y
la URL. La búsqueda por id del listado (`comoId` en `listSales`) pasa a buscar `numero`.
Lo mismo aplica a `clientes`, `usuarios` y `paquetes` donde se pinte su id con `formatId`.

### 3. Las cachés del navegador se comparten entre empresas al suplantar

`getCacheKey` (`configCache.ts:10`, y lo mismo en `clientsCache`, `usersCache` y
`dashboardCache`) construye la clave con **`payload.userId`** del token. El superadmin
entra en la empresa A, mira catálogos y clientes, sale, entra en la B: mismo `userId`,
misma clave, y el navegador le sirve **los datos de A dentro de B**. Sin error y sin aviso,
durante los 15 minutos del TTL.

**Solución:** añadir `empresaId` a la clave en los cuatro ficheros, y vaciar las cachés al
entrar o salir de una suplantación. Es una línea por fichero, pero si se olvida es una
fuga real en la pantalla.

### 4. `/uploads` se sirve sin ninguna autenticación

```js
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));   // index.js:93
```

Ahí viven los vouchers y los documentos de check-in. Cualquiera con la URL los lee, sin
sesión. Los nombres son `Date.now()-random(1e9).ext` (`upload.js:10`), así que no se pueden
enumerar por fuerza bruta, pero el enlace no caduca nunca y viaja por correo. Hoy es la
misma empresa; con inquilinos, es el documento de otra agencia.

**Solución:** servirlos por una ruta con `auth` que compruebe que el fichero pertenece a la
empresa activa. Requiere guardar a qué empresa pertenece cada fichero, que hoy no se guarda.

### 5. Seis búsquedas de persona por documento, y cinco de rol por nombre

`findOrCreatePersona` y compañía buscan `personas` por documento **sin empresa**:
`clients.service.js:158` y `:244`, `sales.service.js:430` y `:535`,
`products.controller.js:21`, `users.service.js:206`. Si no se cambian, al dar de alta un
pasajero con la cédula de un cliente de otra agencia, el código **enlazaría la persona de
la otra empresa** dentro de la venta.

Lo mismo con `roles.findUnique({ where: { nombre } })` en `roles.service.js:227` y `:300`
y `users.service.js:146`, `:242`, `:354`.

**A favor:** al pasar los `@unique` a compuestos, `findUnique({ where: { documento } })`
deja de ser válido y Prisma lo rechaza. Son 11 fallos ruidosos al arrancar, no fugas
calladas. Es la razón de cambiar los índices antes que el código.

### 6. Un rol nuevo de una empresa recibiría los permisos de asesor

`authorize.js` tiene los cuatro nombres de rol escritos en el código
(`ROLES_ADMINISTRATIVOS`, `ROLE_DEFAULT_PERMISSIONS`) y `getEffectivePermissions` hace
`ROLE_DEFAULT_PERMISSIONS[user.role] || ROLE_DEFAULT_PERMISSIONS.asesor`. Una empresa que
cree un rol "Cajero" no obtendría un rol vacío: **obtendría los permisos de asesor en
silencio**.

**Resuelto así, y por eso los roles a medida quedan fuera de alcance:** cada empresa
recibe al crearse los **cuatro roles conocidos**, cada uno con su matriz de permisos propia
y editable. Eso ya cumple lo que hacía falta —que cambiar lo que puede un asesor en la
agencia A no lo cambie en la B— sin tocar la lógica de forma de `authorize.js`. Permitir
crear roles nuevos exigiría que `getEffectivePermissions` construyera la forma desde
`permisos` + `permisos_rol` en vez de tener plantilla por nombre; es lo correcto a futuro,
es un trabajo aparte, y mientras la interfaz no ofrezca crear roles este hueco no se puede
alcanzar.

### 7. El slug de la empresa choca con las rutas que ya existen

El frontend tiene `/login`, `/sales`, `/clients`, `/users`, `/config`, `/commissions`,
`/flights`, `/stats`, `/itineraries` (`App.tsx:44-58`). Con la empresa en la ruta,
`app.com/sales` es ambiguo: ¿es la sección o una empresa llamada "sales"?

**Solución:** lista de slugs reservados —esas nueve, más `api`, `uploads`, `assets`,
`admin`— validada al crear la empresa, y redirección de los enlaces antiguos sin slug a la
empresa del token.

### 8. Un solo remitente de correo para todas las agencias

`emailService.js:19` compone `from: \`iTea Travel <${fromEmail}>\`` con el nombre
**hardcodeado**; `EMAIL_FROM` solo controla la dirección, y hay una sola cuenta de Resend.
Los clientes de la agencia B recibirían sus vouchers firmados por otra marca. Los asuntos
además dicen "Samtur Travel" (`users.service.js:261`, `sales.service.js:1921`).

**Solución:** remitente y nombre por empresa (`empresas.email_remitente`,
`email_nombre`). Si alguna quiere su propio dominio, hace falta verificarlo en Resend con
su SPF y DKIM — eso es trabajo de configuración por cliente, no de código.

*De paso, sin relación con el multi-tenant:* `users.service.js:263-278` envía la
**contraseña en claro** por correo al crear un usuario.

### 9. Suspender o dar de baja una empresa no está diseñado

Si una agencia deja de pagar: ¿se le bloquea la entrada, se conservan los datos, se
exportan, se borran? Suspender tiene que cerrar las sesiones abiertas de sus usuarios y
denegar el login, no solo ocultar la empresa. Borrarla arrastra 42 tablas. Hace falta
decidirlo, aunque sea para dejarlo fuera de esta fase.

### 10. Menores, anotados para no tropezar dos veces

| Hueco | Detalle |
|---|---|
| `ventas_mensuales` es una tabla muerta | Cero referencias en `src/`. Su `@@unique(year, month)` parecía un bloqueo y no lo es: sale más limpio borrarla que migrarla. |
| Zona horaria y moneda fijas | `America/Bogota` en 5 sitios y formato `es-CO`. No molesta mientras todas las agencias sean colombianas; el día que no, es un campo por empresa. |
| `olvidarTodo()` vacía la caché de todos | Cambiar los permisos de un rol de una empresa invalida la sesión cacheada de **todas**. No es fuga, es un coste de rendimiento. |
| Limitador por IP compartido | Dos agencias tras la misma IP corporativa comparten los 5 intentos de login por minuto. |
| El logo en el voucher | `VoucherPDF.tsx:178` usa `crossOrigin="anonymous"` para que html2canvas pueda rasterizarlo. Un logo servido desde `/uploads` necesita CORS o el PDF sale sin logo. |

## Riesgos

| Riesgo | Cómo se detecta temprano |
|---|---|
| **La RLS no está activa y nadie lo nota.** Es el fallo que anula el trabajo entero. | Una prueba automática que se conecte con el rol de aplicación, fije la empresa 1 y compruebe que `SELECT count(*) FROM ventas` **no** ve las de la empresa 2. Debe correr en cada despliegue, no una vez. |
| **La atomicidad roída por la extensión.** Ya comprobado que ocurre con la forma ingenua: las 88 operaciones dentro de las 18 transacciones pasarían a transacciones propias, y una venta a medias dejaría de revertirse. | Paso 1, apartado (c): una transacción que falla a mitad no debe dejar nada escrito. Es la prueba que autoriza a seguir. |
| **La latencia.** +40 % por consulta medido; el dashboard hace 12. | Medir `/stats/dashboard` antes y después. Si duele, la salida es reducir consultas por petición (ya hay SQL crudo que agrupa) o acercar la aplicación a la región de la base — el 375 ms de base ya es el problema mayor. |
| **La migración de 42 tablas a medias.** | Todo en una transacción y con `NOT NULL` puesto al final, tras el relleno. Si falla, no queda nada a medias. |
| **`empresa_id` olvidado en un `create`.** La RLS no lo impide: `NOT NULL` sí. | Las 42 columnas van `NOT NULL`, así que un insert sin empresa falla en desarrollo, no en producción. |

## Plan de implementación

Cada paso es verificable por separado y ninguno deja el sistema roto a medias.

**0. Desbloquear el schema. — HECHO.** `DIRECT_URL` apuntaba al host directo, que solo
tiene IPv6, y esta red no lo alcanza; ahora apunta al pooler en modo sesión. *Verificado:*
`pnpm db:generate` termina bien, el cliente tipado de SQL sigue existiendo, los modelos que
se habían creado por SQL (`codigos_recuperacion`) ya aparecen en el cliente, `migrate diff`
sale vacío y los 23 endpoints de lectura siguen en 200.

**1. El mecanismo, en vacío y con la atomicidad intacta.** La extensión en su forma de
lote, el `AsyncLocalStorage` con la empresa y la bandera de "ya estoy en transacción", y el
helper por el que pasan las 18 transacciones existentes. Sin tocar el schema todavía.
*Verificable:* tres cosas, y la tercera es la que importa —
(a) `current_setting('app.empresa_id')` llega tanto en una operación de modelo como en un
`$queryRawUnsafe`; (b) `/stats/dashboard` medido y anotado para comparar; (c) **una
transacción que falle a mitad revierte todo**, comprobado sobre una venta de prueba con
varios productos: si queda alguno, la bandera no está funcionando y el resto del proyecto
no se puede construir encima.

**2. La tabla `empresas` y el rol de aplicación.** La tabla ya como migración de Prisma
—con `DIRECT_URL` arreglado ya se puede—, dar de alta la empresa 1 con la marca actual,
crear el rol sin `BYPASSRLS`, dar permisos y probar la conexión con él. *Verificable:* la
aplicación arranca con la cadena del rol nuevo y los endpoints de lectura siguen en 200.

**3. `empresa_id` en las 42 tablas.** Ahora como migración de Prisma en vez de SQL a mano:
añadir la columna nullable, rellenar con 1, poner `NOT NULL`, crear los índices y las
claves ajenas compuestas, y rehacer los
cuatro `@unique`. Actualizar `schema.prisma` en el mismo commit para que no divergen.
*Verificable:* `pnpm check:prisma` limpio y una consulta que confirme que no queda ninguna
fila con `empresa_id` nulo en ninguna de las 42.

**4. Encender la RLS.** `ENABLE` + `FORCE ROW LEVEL SECURITY` y la política en las 42
tablas, más las de `empresas` y los agregados. *Verificable:* la prueba de aislamiento del
apartado de riesgos, con dos empresas sembradas y datos en las dos.

**5. Autenticación y URL.** `empresa_id` en el token y en `sesiones`, el middleware que
rellena el contexto, la lista de slugs reservados, la comprobación del slug (403 si no
cuadra), el bloqueo de login para una empresa suspendida y el alta de empresa del
superadmin con sus 4 roles y su matriz de permisos sembrados. Los 11 `findUnique` por
documento y por nombre de rol se corrigen aquí, porque el paso 3 ya los habrá roto.
*Verificable:* dos usuarios de dos empresas ven listados disjuntos; el de la empresa 1
pegando la URL de la 2 recibe 403; una empresa suspendida no deja entrar a nadie.

**5b. Numeración propia por empresa.** `ventas.numero` con `@@unique([empresa_id, numero])`,
asignado en la transacción de creación, y sustituirlo en los cinco sitios donde hoy se
pinta el id — incluido el voucher que recibe el cliente. La búsqueda por id del listado
pasa a `numero`. *Verificable:* dos empresas creando ventas a la vez y las dos numeradas
desde 1, sin huecos y sin colisiones.

**5c. Ficheros y cachés.** `/uploads` deja de ser estático y se sirve por una ruta con
`auth` que comprueba la empresa del fichero; `empresaId` entra en la clave de las cuatro
cachés del navegador. *Verificable:* la URL de un voucher de la empresa 1, pegada sin
sesión, devuelve 401; y con la sesión de la empresa 2, 403. Al suplantar y volver, los
catálogos que se pintan son los de la empresa en la que se está.

**6. Suplantación con auditoría.** Endpoint de entrada y salida, token con caducidad,
tabla `suplantaciones` y pantalla del superadmin. *Verificable:* entrar, ver datos, salir,
y la fila con motivo y hora en la tabla.

**7. La marca.** Endpoint que sirve la marca de la empresa activa, aplicación de los
canales de color en caliente, logo y nombre desde la base en los seis sitios de la tabla de
arriba, y remitente y asuntos de correo por empresa. *Verificable:* dos empresas con
paletas distintas, cada una con su logo y su nombre, y un correo de prueba de cada una con
su remitente.

## Verificación de punta a punta

```bash
cd backend
pnpm db:generate            # tiene que funcionar sin red tras el paso 0
pnpm check:prisma           # nombres de campo del código nuevo
PORT=3101 pnpm dev

cd ../frontend
npx tsc --noEmit && npx vite build
```

Manual, en orden:

1. Con el rol de aplicación y la empresa 1 fijada, `SELECT count(*) FROM ventas` no ve las
   de la empresa 2. **Es la comprobación que valida el proyecto entero**; si esta falla, lo
   demás da igual.
2. Los 26 endpoints de lectura en 200 para un usuario de cada empresa, con totales
   distintos y disjuntos.
3. Un usuario de la empresa 1 pidiendo por id una venta de la 2: 404. Editándola: 403.
4. Crear una empresa desde el superadmin, entrar con su primer usuario y comprobar que ve
   los catálogos del sistema llenos (aerolíneas, aeropuertos) y los suyos vacíos.
5. Suplantar, ver, salir, y comprobar la fila de auditoría.
6. Las dos empresas con colores y logo distintos, en claro y en oscuro.
7. `/stats/dashboard` medido y comparado con la cifra anotada en el paso 1.

No hay pruebas automáticas en el repo. La del punto 1 debería ser la primera, porque es la
única que distingue "aislado" de "parece aislado".
