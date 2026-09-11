# Tareas — Spec 001

Cada tarea deja el sistema funcionando. Ninguna se da por hecha sin su comprobación.

Leyenda: `[x]` hecho · `[~]` en curso · `[ ]` pendiente

---

## T0 · Desbloquear el schema `[x]`

`DIRECT_URL` apuntaba a `db.<ref>.supabase.co`, que solo tiene registro IPv6, y esta red
no tiene salida IPv6: `prisma generate --sql` y `db push` fallaban con `P1001`. Ahora
apunta al pooler en modo sesión (mismo host que `DATABASE_URL`, puerto 5432, sin los
parámetros de pgbouncer).

**Comprobado:** `pnpm db:generate` termina bien · el cliente tipado de SQL sigue ahí ·
`codigos_recuperacion` ya aparece en el cliente · `migrate diff` sale vacío, o sea que
schema y base están sincronizados · 23 endpoints de lectura en 200.

*De paso:* `.gitignore` pasó de enumerar variantes de `.env` a `.env*`, porque un backup
del `.env` con la contraseña dentro apareció como fichero sin seguir.

---

## T1 · El mecanismo de contexto, en vacío `[x]`

- `src/config/tenant.js` — la empresa activa en un `AsyncLocalStorage`, con `conEmpresa`,
  `sinEmpresa` y la bandera de transacción.
- `src/config/db.js` — la extensión en forma de lote y el helper `transaccion`.
- Los 18 `$transaction` de 8 archivos pasan por el helper. No queda ninguno suelto.

Mientras no haya empresa en el contexto la extensión no interviene, así que hoy el
comportamiento es idéntico al de antes. Se activa sola en T5, cuando el token traiga la
empresa.

**Comprobado:**
1. El contexto llega tanto a una operación de modelo como a un `$queryRawUnsafe` (`"7"`),
   y dentro del helper sobrevive a las operaciones intermedias.
2. Sin empresa, la latencia no se mueve: 319 ms por consulta, igual que antes. Con empresa
   serán 447 ms (**x1,40**), que es el precio de la barrera y coincide con lo medido al
   diseñar.
3. **Una transacción que falla a mitad no deja nada**, con y sin empresa en el contexto.
4. 24 endpoints de lectura en 200, y el ciclo completo de escritura con transacción
   —POST, PATCH y DELETE de un producto— deja la venta en su importe original.

**Dos cosas que aparecieron al probar, y que el diseño no tenía:**

- **La transacción interactiva de la extensión no fijaba el contexto.** `query(args)` no
  corre dentro de ella, así que el `SET LOCAL` iba a otra conexión y llegaba vacío. La
  forma de lote sí funciona. Ya estaba anotado en las decisiones; aquí quedó confirmado en
  código.
- **`prisma.$transaction([a, b, c])` deja de ser atómico con la extensión activa**, y en
  silencio: un lote con la segunda operación imposible dejó **la primera escrita**. Cada
  elemento pasa por la extensión y se envuelve en su propia transacción antes de que el
  lote exista. Afectaba a 7 sitios reales, entre ellos borrar un usuario y restablecer una
  contraseña. Los 7 están convertidos a la forma interactiva y la de lote queda prohibida,
  documentado en `db.js`.

## T2 · La tabla `empresas` y el rol de aplicación `[x]`

**El repo pasa a tener migraciones.** No tenía ninguna: se venía usando `db push`, que no
sabe expresar el "columna nullable → rellenar → NOT NULL" que T3 necesita sobre 42 tablas
con datos. Se hizo el baseline (`0_init` con las 47 tablas existentes, marcada como
aplicada sin ejecutarla) y a partir de ahí cada cambio es una migración versionada.

No se usa `migrate dev` sino `migrate diff` + `migrate deploy`: `dev` necesita una base
sombra y el rol de Supabase no puede crear bases. El SQL se genera, se lee y se aplica.

**Lo hecho:**
- Migración `empresas_y_suplantaciones`, puramente aditiva.
- `empresas` con slug, nombre, logo, tres colores de marca, remitente de correo y estado.
  La empresa 1 sembrada con la marca EXACTA de hoy —incluido el `iTea Travel` que sale en
  los correos— para que cuando T9 la conecte no cambie nada.
- `suplantaciones`, con motivo, caducidad y quién entró.
- Rol `app_nexus`, **sin `BYPASSRLS`**, con permisos de lectura y escritura sobre las
  tablas existentes y sobre las que cree T3 (`ALTER DEFAULT PRIVILEGES`). Su contraseña se
  generó y se escribió sola en el `.env`, sin pasar por pantalla.
- `DATABASE_URL` apunta ya a ese rol; `postgres` se queda solo en `DIRECT_URL`, para
  migraciones.

**Comprobado:** la aplicación conecta como `app_nexus` y `rolbypassrls = false` · 24
endpoints de lectura en 200 · el ciclo de escritura con transacción funciona y la venta
queda en su importe · `migrate status` dice que la base está al día.

**Lo que no se sabía y ahora sí:** el pooler de Supabase acepta un rol propio con el
formato `app_nexus.<ref>`. Era el riesgo de este paso, porque si no lo aceptara no habría
forma de que la aplicación conectara con un rol que no ignore la RLS.

> **Al desplegar:** hay que cambiar `DATABASE_URL` también en el hosting. Si se queda con
> el usuario `postgres`, la RLS de T4 se aplicará sin error y sin filtrar nada.

## T3 · `empresa_id` en las 42 tablas `[x]`

Dos migraciones. La primera añade la columna en tres pasos —opcional, rellenar con 1,
ponerla obligatoria—, su índice y su clave ajena a `empresas`, y rehace los cuatro únicos
globales como compuestos: `personas(empresa_id, documento)`, `roles(empresa_id, nombre)`,
`metodos_pago(empresa_id, nombre)` y `ventas_mensuales(empresa_id, year, month)`.

**El paso rompió 72 sitios, y por eso se arregla aquí y no en T5:**

- **61 inserts**, porque la columna es obligatoria y nadie la pasaba. La segunda migración
  le da valor por defecto desde la propia variable de sesión:
  `COALESCE(NULLIF(current_setting('app.empresa_id', true), '')::int, 1)`. Así ninguno de
  los 61 tiene que acordarse, y el valor no puede discrepar del que comprobará la política
  porque sale del mismo sitio.
  > **Pendiente para T5:** quitar el `COALESCE` a 1. Es un respaldo temporal para que el
  > login y lo que corre fuera de una petición sigan funcionando mientras no hay contexto.
  > Con el middleware puesto, un insert sin contexto debe fallar, no caer en la empresa 1.
- **11 `findUnique`** por documento y por nombre de rol, que dejaron de ser claves únicas.
  Pasan a `findFirst`: la empresa la aplicará la política, no ese `where`.

**Comprobado:** ninguna columna `empresa_id` admite nulo · 43 tablas la tienen · los
recuentos de 16 tablas son idénticos antes y después · las 11 ventas pertenecen a la
empresa 1 · `check:prisma` limpio · 24 endpoints de lectura en 200 · al crear un producto
la línea nueva nace con `empresa_id = 1` y al borrarlo la venta vuelve a su importe.

**Queda fuera, como T3b:** las claves ajenas compuestas (`detalle_venta(venta_id,
empresa_id)` → `ventas(id, empresa_id)`). Impiden colgar una línea de la venta de otra
empresa, pero son una segunda capa: la barrera de verdad es la RLS de T4, y conviene tener
esa antes que esto.

## T5a · El contexto llega desde el token `[x]`

**El orden del plan estaba mal y se corrigió al ejecutar.** La RLS no se puede encender
antes que esto: el propio middleware de autenticación lee `usuarios` para saber quién
eres, y con las políticas puestas y sin contexto no vería ni esa fila. Así que primero el
contexto, después la barrera.

- El token lleva `empresaId`. Un token anterior al multi-tenant se rechaza con
  `SESSION_SIN_EMPRESA` en vez de asumir una empresa por defecto.
- El middleware abre el contexto en cuanto descifra el token y envuelve el resto de la
  petición.
- **El login es el único que mira a través de las empresas**, porque quien entra solo dice
  su correo. En vez de dejar `usuarios` sin proteger, se abre una rendija del tamaño
  exacto: `app_identidad_por_correo`, una función `SECURITY DEFINER` que devuelve dos
  números —id de usuario e id de empresa— y nada más. Con eso ya se fija el contexto y el
  resto se lee por el camino normal. Lo mismo para recuperar la contraseña.

## T4 · Encender la RLS `[x]`

`ENABLE` + `FORCE ROW LEVEL SECURITY` y una política por tabla en las 42, más `empresas`,
que cada agencia ve solo la suya. La política es `empresa_id = app_empresa_actual()`, una
igualdad sobre columna indexada. Sin contexto la función devuelve NULL, y comparar con
NULL da NULL: no se ve ninguna fila y no se puede insertar ninguna.

De paso, el valor por defecto de `empresa_id` pierde el respaldo a la empresa 1 que T3
había dejado: con la política puesta ese insert se rechazaba igualmente, así que el
respaldo solo servía para que el error fuese más confuso. **Queda saldada la deuda que T3
dejaba apuntada.**

**Comprobado con dos empresas y datos en las dos** (montadas y desmontadas en la prueba):

| | empresa 1 | empresa 2 |
|---|---|---|
| `prisma.ventas.count()` | 11 | 1 |
| `SELECT count(*) FROM ventas` (sin WHERE) | 11 | 1 |

- **A1 pasa**: ninguna ve las ventas de la otra sobre una tabla que tiene 12 filas.
- **A2 pasa**: el SQL crudo sin `WHERE` tampoco las ve. La barrera no está en el código.
- Sin contexto: 0 filas visibles y los inserts rechazados.
- Insertar una venta con el `empresa_id` de la otra: rechazado por `WITH CHECK`.
- 24 endpoints de lectura en 200 con la RLS puesta, entrando por el login real, y el ciclo
  de escritura con transacción sigue funcionando.

**El fallo que costó encontrar, y que vale por toda la prueba:** el login empezó a
responder "correo o contraseña incorrectos" con la contraseña correcta. Las operaciones de
Prisma son perezosas, así que `conEmpresa(id, () => prisma.usuarios.findFirst(...))`
devolvía la promesa sin esperarla y el ámbito se cerraba **antes** de que la consulta
arrancara: corría sin empresa y la política no dejaba ver ni al propio usuario. Arreglado
en el helper —`async () => fn()`— y no en cada llamada, para que dé igual cómo lo escriba
quien lo use.

**Corrección a un comentario de la migración**, anotada en su carpeta: `FORCE` no protege
de desplegar con el usuario `postgres`, porque `postgres` tiene `BYPASSRLS` y salta las
políticas igual —comprobado—. Esa protección es de despliegue y merece una comprobación al
arrancar, que queda pendiente.

## T5b · El superadmin da de alta agencias `[x]`

`GET/POST /companies`, `GET/PATCH /companies/:id`, detrás de una guarda propia
(`soloSuperadmin`) y no de `authorize`: administrar agencias no es un permiso que una
empresa pueda delegarse, es del sistema. El rol se comprueba contra la **fila** del
usuario, no contra el token, que es una foto del momento en que se emitió.

- **El alta crea la agencia entera:** ficha, sus tres roles con la matriz de permisos
  leída de la misma plantilla que usa `authorize` para decidir, y su primer
  administrador. Todo en una transacción. Una empresa en la que nadie puede entrar no
  sirve, y dejarlo para un segundo paso obligaría a suplantar solo para crear al primer
  usuario.
- **Slugs reservados**: las nueve rutas de `App.tsx` más `api`, `uploads`, `assets`… La
  lista vive en el backend, porque si viviera en la interfaz bastaría una llamada directa
  para colarse.
- **El slug no se puede editar.** Es la dirección por la que la agencia entra y comparte
  enlaces; cambiarlo rompe todos los marcadores a la vez. Si hace falta, será una
  operación propia con su redirección.
- **Suspender cierra las sesiones abiertas.** Si no, quien ya estaba dentro seguiría
  trabajando hasta que caducara su token y suspender no suspendería nada. El login
  comprueba el estado **después** de la contraseña: antes, el mensaje distinto convertiría
  el login en un detector de qué agencias están suspendidas.

**Comprobado de punta a punta**, con una agencia creada y borrada en la prueba:

| | Viajes Sol (nueva) | DB Nexus (la de siempre) |
|---|---|---|
| ventas | 0 | 5 |
| clientes | 0 | 2 |
| usuarios | 1 (su administradora) | 3 |
| **aerolíneas** | **18** | 18 |

Las 18 aerolíneas son la decisión de catálogos funcionando: la agencia nueva arranca con
el catálogo del sistema lleno y utilizable el primer día. Y el superadministrador ve esas
cifras de uso **sin poder abrir un solo registro**: su propio `/sales` devuelve las de su
empresa, no las de ella.

Suspender: Ana deja de poder entrar, con el mensaje del estado. Reactivar: vuelve a
entrar. **Criterios A6 y A8 cumplidos.**

**El fallo de este paso, el mismo patrón otra vez:** `conEmpresa` dentro de una
transacción abre un ámbito con `enTransaccion: false`, así que lo de dentro volvía a pasar
por la extensión, que lo envolvía en OTRA transacción en otra conexión — que no veía la
empresa recién creada y sin confirmar. Salía como violación de clave ajena, que no dice
nada de esto. Resuelto con `conEmpresaEnTransaccion`, que cambia el contexto sobre la
transacción que ya está abierta.

**Cambio de decisión, anotado:** el plan pedía un 403 si el slug de la URL no era el de tu
empresa. No hace falta y se retira: la marca y los datos salen del **token**, no del slug,
así que pegar la URL de otra agencia no enseña nada suyo — solo una dirección equivocada.
Lo resuelve la interfaz redirigiendo al slug correcto, que es donde está el problema.

## T6 · Numeración propia por empresa `[ ]`

`ventas.numero` y sustituirlo en los cinco sitios donde hoy se pinta el id, incluido el
voucher que recibe el cliente. La búsqueda por id del listado pasa a `numero`.

**Comprobación:** criterio **A4**.

## T7 · Ficheros y cachés `[ ]`

`/uploads` deja de ser estático y se sirve con `auth`; `empresaId` entra en la clave de
las cuatro cachés del navegador.

**Comprobación:** criterio **A9**, y que al suplantar y volver se pinten los catálogos de
la empresa en la que se está.

## T8 · Suplantación con auditoría `[ ]`

Entrar, salir, token con caducidad, tabla de auditoría y pantalla del superadmin.

**Comprobación:** criterio **A7**.

## T9 · La marca `[~]`

Hecho el nombre, el logo y los colores. Los correos por empresa quedan pendientes.

- **`GET /branding`**, sin id en la ruta: la empresa sale del token. Un
  `/companies/:id/branding` invitaría a pedir la marca de otra.
- **Los colores se aplican en caliente**, y esto salió casi gratis por una decisión
  anterior: el tema declara los colores en canales (`--primary-rgb: 43 45 66`) y el
  hexadecimal se deriva de ellos, así que vestir la aplicación con la paleta de una
  agencia es escribir tres variables. Las 46 clases con opacidad siguen funcionando
  porque dependen de esos mismos canales.
- **La variante para modo oscuro se deriva**: una agencia elige un color, no dos. Se sube
  la luminosidad a un mínimo legible y se baja la saturación, que es lo que hace el tema de
  la casa a mano (su primario pasa de `#2B2D42` a `#8D99AE`). Comprobado con la misma
  aritmética: `#2B2D42 → 164 166 183`, `#1D4ED8 → 139 157 208`, y un color que ya es claro
  se deja quieto para que no se vaya a blanco.
- **`PUT /companies/:id/logo`**, no POST: subir el logo reemplaza el que hubiera, así que
  repetirlo deja el mismo resultado. El anterior se borra, para que la carpeta no acabe
  siendo un archivo de todos los logos que una agencia ha tenido.
- **Los logos se sirven sin sesión, a propósito.** Los carga una etiqueta `<img>` —incluida
  la del voucher que html2canvas rasteriza con `crossOrigin`— y una etiqueta no manda
  cabeceras. Un logo es la marca pública de la agencia; los vouchers y los documentos de
  check-in sí pasarán a pedir sesión en T7, y por eso van en carpetas distintas.
- **Dónde se ve**: barra lateral, cabecera y el voucher en PDF, que es lo único de esta
  aplicación que llega al cliente final. La pantalla de entrada NO: es común a todas.

**Pantalla del superadministrador (`/companies`)**, con una idea detrás: una lista de
empresas es una lista de MARCAS, así que cada fila lleva la suya —su franja de color y su
logo, o sus iniciales sobre su color si aún no lo ha subido—. El color ahí no decora,
identifica: distingue una agencia de otra antes de leer un solo nombre.

**Comprobado:** la marca de la empresa 1 sale con sus colores actuales; una agencia nueva
con paleta propia sube su logo, se sirve sin sesión (200) y su administradora ve su propia
marca por `/branding`. **Criterio A10 cumplido**; A11 (correos) pendiente.

### Pendiente de T9
Remitente y asuntos de correo por empresa: `emailService.js` tiene `iTea Travel` escrito en
el código y hay una sola cuenta de Resend. Los campos ya están en la tabla.

---

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-09-11 | T0 | Cerrada. El bloqueo era una línea del `.env`, no el TypedSQL: con `DIRECT_URL` bueno, la migración de las 42 tablas ya no hay que escribirla a mano. |
| 2026-09-11 | T9 | Nombre, logo y colores, de punta a punta. Los colores salieron casi gratis por los canales CSS de un trabajo anterior. Quedan los correos. |
| 2026-09-11 | T5b | Cerrada. El superadmin ya crea agencias completas. Retirado el 403 por slug: no cerraba ningún hueco real. |
| 2026-09-11 | T4 + T5a | Cerradas, y en este orden: la RLS no se puede encender antes de que el contexto llegue del token. A1 y A2 pasan con dos empresas reales. |
| 2026-09-11 | T3 | Cerrada. El paso rompió 61 inserts y 11 findUnique; los dos se arreglan dentro del mismo paso. El valor por defecto sale de la variable de sesión, con un respaldo temporal que hay que quitar en T5. |
| 2026-09-11 | T2 | Cerrada. De paso, el repo estrena migraciones: `db push` no podía con lo que viene en T3. Y confirmado que el pooler acepta un rol propio. |
| 2026-09-11 | T1 | Cerrada. El mecanismo funciona y está inerte hasta T5. Encontrado de paso que la forma de lote de `$transaction` pierde la atomicidad con la extensión puesta: 7 sitios convertidos. |
