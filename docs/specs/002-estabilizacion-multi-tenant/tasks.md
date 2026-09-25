# Tareas — Spec 002

Cada tarea deja el sistema funcionando. Ninguna se da por hecha sin su comprobación.

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

---

## T0 · La barrera estaba inerte en esta máquina `[x]`

`DATABASE_URL` del `.env` local usaba `postgres.<ref>`, que tiene `BYPASSRLS`. Las 44 políticas
estaban puestas y no filtraban nada: las tres agencias veían las mismas ventas y los mismos usuarios,
sin un solo error. `pnpm test:aislamiento` lo detectaba, pero solo si alguien lo corría: se corta en
su primera comprobación.

El rol `app_nexus` existía y estaba bien montado (sin `BYPASSRLS`, con permisos sobre las tablas,
las secuencias y las funciones `app_*`). Su contraseña se había generado en la T2 de la spec 001 y
escrita solo en el `.env` de quien la creó: nadie más la tenía, y la base nunca la muestra.

**Lo hecho:** se restableció con `ALTER ROLE` y una contraseña aleatoria escrita directamente en el
`.env` sin pasar por pantalla. Se cambió `DATABASE_URL` a `app_nexus.<ref>`, conservando host, puerto
y parámetros del pooler, y de paso `connection_limit=1` pasó a `10&pool_timeout=20`, que es lo que el
README exige.

**Comprobado:** conecta como `app_nexus` con `rolbypassrls = false` · `pnpm test:aislamiento` pasa
las 15 comprobaciones · los catálogos compartidos (18 aerolíneas, 57 aeropuertos) son iguales para las
tres agencias y los propios (proveedores, tarjetas) son distintos.

**Efecto que hay que comunicar:** la contraseña anterior de `app_nexus` deja de valer. Quien la tenga
—otro `.env`, el hosting— debe pedir la nueva. La base `nexus-bd` es compartida con otra persona.

## T1 · El servidor se niega a arrancar con un rol que salta la RLS `[x]`

Es el arreglo de fondo de T0, y salda la deuda que la T4 de la 001 dejó apuntada ("merece una
comprobación al arrancar"). `src/index.js` consulta el rol de la conexión antes de abrir el puerto y
sale con código 1 si salta la RLS o si no puede comprobarlo. Detalle de la decisión en `plan.md`.

**Comprobado**, arrancando el servidor real en otro puerto: con el `.env` (rol `app_nexus`) levanta y
`/api/health` da 200. Forzando `postgres` por variable de entorno: sale con código 1, con el mensaje
que dice qué rol usó y qué hacer, y no llega a abrir el puerto.

## T2 · Suplantación: entrar, salir, cerrar sesión y suspender `[~]`

Cuatro fallos, todos en el mismo punto ciego: **al suplantar, la empresa del usuario y la empresa en la
que trabaja dejan de ser la misma**, y cada sitio que asumía que lo eran fallaba en silencio.

- **Salir no hacía nada.** `/auth/me` no devolvía `empresaId` ni `empresaSlug` (el login sí). Entrar
  en una agencia recarga la página, y tras la recarga el usuario se rehidrata solo con `/auth/me`. El
  manejador del botón empezaba con `if (user.suplantacionId && user.empresaId)`: la segunda mitad era
  falsa y se iba sin pedir nada ni avisar. El aviso rojo sí salía, porque solo mira `suplantacionId`.
  El registro de la 001 del 2026-09-12 daba esto por arreglado: se había corregido el 404 de `/auth/me`
  al leer al superadmin en la agencia visitada, pero no el campo que faltaba.
- **Cerrar sesión durante una suplantación no la cerraba.** La fila de `sesiones` vive en la empresa
  de origen y el borrado corría en la de destino: la política no la veía y `deleteMany` borraba cero
  filas sin error. Como la caché sí se olvidaba, la siguiente petición volvía a la base, encontraba la
  fila intacta y revalidaba el token.
- **Suspender una agencia dejaba entrar hasta cinco minutos más.** Se borraban sus sesiones, pero el
  middleware devuelve desde la caché antes de mirar la fila.
- **En el navegador:** el borrador del asistente de venta no llevaba la empresa en la clave y saltaba
  de una agencia a otra; suplantar una segunda agencia desde dentro de la primera pisaba el token
  original del superadmin, y cerrar sesión dejaba ese token, que es válido, en el `localStorage`.

**Lo hecho:** `me` devuelve los dos campos de la empresa de trabajo y `getMe()` está tipado con el
contrato del login · el botón solo exige `suplantacionId` y muestra el error si falla · el
controlador de `logout` abre el contexto de la empresa de origen · la caché guarda la empresa del
usuario y `olvidarEmpresa` la invalida por agencia · la clave del borrador lleva la empresa · el token
original no se pisa y se borra al cerrar sesión, junto con las cachés.

**Comprobado:** `tsc --noEmit` limpio · `me` reproducido contra la base devuelve `empresaId` y
`empresaSlug` · el verificador de T3 confirma que un admin de agencia recibe 403 al intentar suplantar
o suspender otra.

**Por confirmar:** el flujo de pantalla completo (entrar, ver el aviso, pulsar *Salir*, volver a la
sesión de superadmin) y `logout` durante una suplantación **no se han probado** con un superadmin real:
requieren sus credenciales. Sin prueba automática de que suspender expulsa al instante.

## T3 · Verificación del aislamiento por la API `[x]`

Dos agencias de prueba con un admin en cada una, datos creados por la API real y ataques en los dos
sentidos. Diseño en `plan.md` y en la sección de más abajo.

**Comprobado (80 comprobaciones, 0 fallos):**

| Qué | Resultado |
|---|---|
| Listados: 24 rutas x 3 pasadas x 2 sentidos | 144 lecturas sin rastro de la otra agencia |
| Acceso por id a lo ajeno: leer, editar, borrar, en clientes, ventas (con pagos, cancelación, productos), usuarios, responsables, comisionistas y proveedores | 52 intentos, ninguno 2xx; los datos ajenos quedan idénticos antes y después |
| El hueco que señalaba la auditoría: `PUT`/`DELETE` de un producto ajeno pasando una venta propia | Rechazado con 404: la RLS lo cubre |
| Altas con ids de otra agencia | 10 intentos, todos 400, y el recuento de ventas no cambia |
| Sin sesión / token falso | 401 |
| Un admin de agencia sobre `/companies`, suplantar, suspender, reescribir permisos | 403 |
| Ficheros: voucher de A sin sesión, con la de B, con la de A | 401, 404, 200 |
| Numeración, con seis altas simultáneas | Cada agencia recibe 3, 4 y 5, sin choques ni huecos |
| Roles y permisos | Cada agencia tiene sus tres roles, y ningún permiso apunta a un rol de otra |

Los 54 errores que el servidor registra en una corrida son los rechazos esperados: 38 "no
encontrado", 10 "no existe" de las altas cruzadas y 6 `update`/`delete` de filas que la base no ve.

**Lo que no cubre:** la suplantación de punta a punta, el check-in de vuelos con archivos (usa el
arreglo de T3a, pero no hay vuelo de prueba), el logo de agencia, las liquidaciones de comisiones y
los usuarios que no son admin (`asesor`, `freelancer`).

**Dos fallos que solo existen con la barrera puesta**, y por eso solo salieron aquí:

### T3a · Las subidas daban 404 sobre recursos propios `[x]`

Voucher, avatar de usuario, avatar de cliente, check-in y logo. Todas usan `multer`, que lee el
request en callbacks de eventos: el `AsyncLocalStorage` se pierde, el handler corre sin empresa y la
política no deja ver ni la fila que se acaba de autenticar. El avatar del propio usuario respondía
`Usuario no encontrado`. Con `postgres` funcionaba, por eso nadie lo vio.

**Lo hecho:** `middleware/conservarContexto.js`, aplicado en `upload.js` y `uploadLogo.js` sin tocar
las rutas.

**Comprobado:** voucher y avatares propios 200 · ajenos 404 · sin sesión 401 · el otro tenant queda
sin avatar ni voucher.

**Un efecto lateral, anotado:** `multer` escribe el fichero a disco **antes** de que el handler
decida. Una subida rechazada (por ser de otra agencia) deja igualmente un fichero huérfano en
`uploads/`. No filtra nada, pero llena disco.

### T3b · Los 500 intermitentes en dashboard y estadísticas `[x]`

En la primera corrida fallaron `/sales`, `/config/all` y `/stats/attention`; en otra, `/stats/dashboard`
con `Transaction not found`. No se repetían al pedirlos en serie, y no había registro del servidor de
la primera vez. Medido después: la ida y vuelta al pooler desde esta máquina es de 0,8 a 1,2 s, y
`/stats/attention` falló 3 de 25 veces con `Unable to start a transaction in the given time`, con una
llamada de 49 s. Prisma da 2 s para abrir una transacción interactiva y 5 s para terminarla; el
dashboard abre una con seis consultas dentro.

**Lo hecho:** `transaccion()` pasa 10 s y 30 s por defecto (`plan.md`, decisión 5).

**Comprobado:** 25 llamadas seguidas a cada uno de los cuatro endpoints con transacción: 0 errores de
100, y el máximo de `/stats/attention` baja de 49 s a 1,4 s. Medianas: dashboard 2,0 s, atención
1,3 s, config 1,3 s, ventas 1,1 s.

## T4 · Ventas: campos que el asistente perdía `[~]`

`createSale` leía nombres de campo distintos de los que manda el formulario, y guardaba `null` o un
valor por defecto sin avisar. El endpoint suelto de cada categoría usaba los nombres correctos: el
fallo estaba solo en el camino del asistente. Es la misma familia que corrigió el commit `40661a3`,
con cinco casos que sobrevivieron.

| Categoría | Manda el formulario | Leía `createSale` | Efecto |
|---|---|---|---|
| Migración | `requestedDocType` | `tramiteType` | Trámite migratorio siempre `null` |
| Auto | `mainDriver` | `driverName` | Conductor principal `null` |
| Finca | `responsibleName` | `responsible` | Responsable `null` |
| Restaurante | `peopleCount`, `dietaryRestrictions` (lista) | `personsCount`, `dietRestrictions` | Comensales siempre 1, sin dieta |
| Convención | `requiredSpace`, `avEquipment`, `hasCatering` | `spaceRequired`, y los otros dos ni se leían | Sin espacio, equipo audiovisual ni catering |

**Comprobado:** `check:prisma` limpio · cada nombre contrastado con su formulario del frontend.

**Por confirmar:** no hay prueba automática de que una venta creada con cada categoría conserve todos
sus campos. **Las ventas ya guardadas con esos campos vacíos no se reparan.**

*Anotado sin arreglar:* el formulario de migración manda el número de documento como `docNumber`,
mientras el contrato de lectura y el endpoint suelto usan `passportNumber`. Cada camino es coherente
consigo mismo; conviene comprobar que el modal de edición no los cruza.

## T5 · Una sola copia de los catálogos de gestión interna `[~]`

Al crear una aerolínea en gestión interna no aparecía en el selector del tiquete. La pantalla de
configuración leía y escribía un `ConfigContext` con su propio estado, y el asistente de venta leía el
de `DataContext`: dos copias del mismo catálogo que nada mantenía en sincronía, hasta el siguiente
inicio de sesión. Es el patrón que ya se corrigió para ventas
(`docs/designs/retirar-rama-sales-datacontext.md`), sin aplicar todavía a configuración.

**Lo hecho:** `Config.tsx` usa `useData()`; se retiran `ConfigContext.tsx` y `hooks/useConfig.ts`, y
el tipo `ConfigData` que quedaba duplicado. Alcanza a los ocho catálogos, no solo a las aerolíneas. Los
paquetes no compartían el bug: el formulario de planes los pide fresco cada vez.

**Comprobado:** `tsc --noEmit` limpio · el backend devuelve las 18 aerolíneas a cualquier agencia
(catálogo compartido, sin RLS).

**Por confirmar:** el síntoma en pantalla. Tras el cambio se pidió un refresco fuerte del navegador
(`Ctrl+Shift+R`): un cambio en la raíz de los providers no siempre lo aplica el recarga en caliente.

## T6 · Rama y base al día `[x]`

`nexus-bd` tenía aplicadas dos migraciones de otra persona que `feat-dbmoon` no tenía:
`cerrar_la_api_rest_de_supabase` y `sin_permisos_para_anon_ni_authenticated`, que quitan a `anon` y
`authenticated` (la API REST pública de Supabase) todo acceso a la base. Las traía un commit de
`origin/main`.

**Lo hecho:** merge de `origin/main` en la rama. `CLAUDE.md` existía en las dos con contenido
distinto: se fusionó tomando de `main` las secciones de migraciones y tenencia, conservando las
convenciones de API y permisos de esta rama, y corrigiendo tres datos de `main` que no coincidían con
el código (la clave del token es `nexus_token`; el comodín `*.vercel.app` ya no está en el CORS; las
subcarpetas de `sales/`).

**Comprobado:** `prisma migrate status` → "Database schema is up to date", 14 migraciones · el aviso
de seguridad de Supabase sale vacío · `anon` y `authenticated` no pueden leer `ventas`.

**Cerrado el 2026-09-25:** los cambios de T1, T3a y T3b van en el commit `e697576`, ya en
`origin/feat-dbmoon`, y `feat-bayrol` está en ese mismo commit.

**Cómo se trabaja con dos ramas:** `feat-bayrol` y `feat-dbmoon` son las dos ramas de trabajo de
esta spec, una por persona, sobre la misma base `nexus-bd`. Cada una se pone al día con la otra
antes de tocar la base: una migración aplicada desde una rama que la otra no tiene deja
`migrate status` desincronizado para quien no la tiene, que es lo que obligó a hacer esta tarea.

---

## Pendientes

## T7 · El dinero de una venta `[x]`

Cuatro fallos de la auditoría de ventas, anteriores al multi-tenant, y un quinto, peor, que salió al
leer el código. Ninguno tiene nada que ver con la RLS.

- **Sobrepago sin control.** `registerPayment` solo limitaba el monto en la rama `isTotal`: un pago
  manual mayor que la deuda se aceptaba y dejaba lo pagado por encima del total. Lo mismo en el alta:
  los abonos de `createSale` no se comparaban con el total.
- **Carrera en "saldar todo".** El pendiente se leía sin bloqueo: dos pagos simultáneos con `isTotal`
  leían el mismo pendiente y se insertaban los dos.
- **Anular no liberaba la comisión.** El acumulado de comisionistas sumaba `monto_comision_neto` de
  todas las ventas con `comision_liquidada = false`, sin excluir anuladas ni borradas, y
  `createSettlement` no miraba el estado. En la base había una venta borrada sumando al acumulado.
- **La comisión al crear no se redondeaba.** `createSale` guardaba `Number(x) || 0`; `updateSale` sí
  pasaba por `aCentimos`.
- **Liquidar no liquidaba nada** (encontrado aquí). La pantalla manda `amount` y nunca `salesIds`, y
  el servicio solo marcaba las ventas de `salesIds`: la liquidación se guardaba sin ventas, ninguna
  pasaba a liquidada y el mismo acumulado se podía volver a pagar. El monto era el que llegara en el
  cuerpo. En la base no hay ninguna liquidación todavía, así que no hay datos que reparar.

**Lo hecho:**
- `bloquearVenta` (`saleTotals.js`): `SELECT … FOR UPDATE` sobre la venta antes de leer importes.
  `registerPayment` lo usa y rechaza con 400 un pago mayor que el pendiente, o sobre una venta ya
  pagada.
- `createSale` redondea la comisión y los abonos con `aCentimos`, y tras `recalcularVenta` rechaza
  (y deshace la venta) si los abonos superan el total.
- `voidSale` rechaza anular dos veces. No toca importes ni pagos: los pagos registran dinero que
  entró (devolverlo es otra operación) y una comisión ya liquidada se pagó y no se revierte.
- `commissions.service.js`: una sola definición, `VENTA_CON_COMISION_PENDIENTE` (no liquidada, no
  borrada, no anulada), compartida por el acumulado y la liquidación.
- `createSettlement` decide qué se paga: sin `salesIds`, todo lo pendiente; con `salesIds`, solo
  esas y todas pendientes (400 si no). Bloquea las ventas antes de sumar, calcula el monto, y si el
  `amount` recibido no coincide con esa suma responde 409. Comprueba el comisionista y el método de
  pago. `amount` pasa a ser opcional en el esquema.

**Comprobado** con el servidor real, `app_nexus` y una agencia `verif-t7-*` montada y desmontada
(27 comprobaciones, 0 fallos): la comisión se guarda en céntimos (100,456 → 100,46) · abonos por
encima del total: 400 y la venta no se crea · pago manual mayor que la deuda: 400 · **dos "saldar
todo" simultáneos: uno 200 y el otro 400 "La venta ya está pagada"**, con lo pagado igual al total y
dos pagos · pagar una venta pagada: 400 · anular dos veces: 400 · el acumulado excluye la anulada y
la borrada · liquidar con monto distinto: 409, con una venta anulada: 400, con un método de pago
inexistente: 400, y ningún rechazo deja liquidación · liquidar como la pantalla: 201, el monto lo
pone el servidor, marca A, B y C (no la anulada) y el acumulado vuelve a 0 · liquidar sin
pendientes: 400 · **dos liquidaciones simultáneas: una 201 y otra 400**, la venta se paga una vez.
`check:prisma` limpio. **B12 cumplido.**

El verificador vive en el scratchpad de la sesión, fuera del repo: pasarlo a `backend/tests/` es
parte de T11.

**Los mensajes de la liquidación** (2026-09-25). Ningún error de la pantalla de comisionistas llegaba
al usuario, no solo los de liquidar: `useCommissions` relanzaba cada error como
`new Error(err.message)`, que descarta la respuesta, y la página leía `response.data.message` en vez de
`response.data.error.message`. Crear, editar, borrar y liquidar enseñaban siempre el texto genérico.

- Cada rechazo de `POST /commissions/settlements` lleva su `code` y un mensaje escrito para quien
  liquida, con el nombre del comisionista y el número de venta que ve la agencia (antes salía el id
  interno): `SETTLEMENT_AMOUNT_CHANGED` (409), `NO_PENDING_COMMISSIONS`, `SALES_NOT_SETTLEABLE` y
  `PAYMENT_METHOD_NOT_FOUND` (400). `AppError` acepta `details`, que el manejador de errores devuelve
  en `error.details`; en el 409 y en "sin pendientes", `details` trae el acumulado actual en `value`.
- En pantalla, el rechazo se enseña dentro del modal, junto al botón. Con 409 o sin pendientes, el
  modal pasa a mostrar la cifra de la base y la lista se refresca; sin nada pendiente el botón se
  deshabilita. Un canal de pago que ya no existe marca su campo.
- El historial leía `data.commissionSettlements` de `DataContext`, una segunda copia que nadie
  refrescaba al liquidar: la liquidación recién hecha no aparecía. Pasa a la lista del hook, paginada.

**Comprobado en pantalla** con una agencia de prueba montada y desmontada: con el modal abierto se
añade una venta por detrás y confirmar da el 409 dentro del modal, con el monto actualizado de
$55.000 a $65.000; confirmar otra vez liquida y la liquidación aparece en el historial. Anulando por
detrás las ventas pendientes, confirmar da el 400 "no tiene comisiones pendientes", el monto pasa a
$0 y el botón queda deshabilitado. `tsc` limpio y el verificador por la API sigue en verde.

*Anotado sin arreglar:*
- Editar o borrar un producto por la API puede dejar el total por debajo de lo ya pagado. Ninguna
  pantalla lo permite (ver T8), así que hoy solo es alcanzable con una llamada directa.
- **La fecha de una liquidación sale un día antes.** Se elige el 25 y el historial dice el 24:
  `new Date('2026-09-25')` es medianoche UTC y `listSettlements` la formatea con la hora local del
  servidor (UTC-5).
- `DataContext` sigue cargando `commissionSettlements` con `fetchAllPages` al iniciar sesión, y ya
  no la lee nadie: una petición de más, y una copia que puede volver a usarse por error.

## T8 · Los tramos de un tiquete no se pueden editar `[ ]` — a replantear

El `update` de `products.controller.js` nunca lee `legs` ni escribe en `tramos_vuelo`: un `PUT` con
tramos modificados los ignora sin error. Al implementarlo hay que conservar `checkin_status` de cada
tramo, que hoy está protegido (la edición no lo toca). **Comprobación de cierre:** B13.

**Replanteo (2026-09-25):** en la aplicación **no se editan los productos de una venta**. `updateProduct`
existe en `api/sales.ts` pero ninguna pantalla lo usa, así que este fallo solo se alcanza por la API.
Hay que decidir si el `PUT`/`DELETE` de productos se retira o se mantiene como API sin pantalla (y
entonces se arregla). Lo que la pantalla llama "editar" una venta es **gestionar sus abonos**, y está
mal nombrado en el código: `SaleEditModal.tsx` (título "Gestión de Abonos y Pagos", con props
`editingSale`, `onUpdateSale`, `onAddSale`), `onEdit`/`canEditThis` en `SalesTable.tsx` (el botón dice
"Actualizar abonos") y `handleOpenModal`/`editingSale` en `Sales.tsx`.

## T9 · El producto y la venta no se validan entre sí `[ ]`

`delete` comprueba que la línea pertenezca a la venta de la URL; `update` y `uploadVoucher` no. Con
la RLS activa no es explotable entre agencias (verificado en T3: 404), pero dentro de una agencia se
puede operar sobre un producto de otra venta pasando el `saleId` propio. Igualar los tres.

## T10 · La aplicación no debe poder escribir el historial de migraciones `[ ]`

`app_nexus` tiene `SELECT`, `INSERT`, `UPDATE` y `DELETE` sobre `_prisma_migrations`, y no lo necesita:
las migraciones corren con `postgres`. Es una migración de una línea (`REVOKE ALL … FROM app_nexus`).
Se hace después de T6, porque toca la base compartida. **Comprobación de cierre:** B14.

## T11 · Convertir el verificador en prueba del repo `[ ]`

Hoy vive en una carpeta temporal, fuera del repositorio. Debería quedar como
`backend/tests/aislamiento-api.js`, con su script en `package.json`, para que A3 y A9 sean
comprobables en cada despliegue como pide la 001. Y ampliarlo con lo que no cubre: usuarios no admin,
liquidaciones de comisiones, y la suplantación con un superadmin de prueba.

## T12 · Despliegue `[ ]`

`DATABASE_URL` del hosting tiene que usar `app_nexus`; con la comprobación de T1, un despliegue que
siga con `postgres` **no arrancará**. Además, `backend/.env.production` apunta a otro proyecto de
Supabase, ajeno a `nexus-bd` y que ese acceso no lista: comprobar que ese entorno tiene el esquema
multi-tenant antes de desplegar esta rama.

## T13 · Un proyecto de Supabase sin el multi-tenant `[ ]`

`moon-travel`, creado el 2026-09-24, tiene las 47 tablas del esquema anterior con la RLS activada y
**cero políticas**, sin migraciones y sin rol `app_nexus`. El código actual no funciona contra él (le
faltan `empresas`, `empresa_id`, `numero` y las funciones `app_*`). Si va a ser un entorno, hay que
aplicar las migraciones y crear el rol; si no, borrarlo.

## T14 · Deuda menor `[ ]`

- **Coherencia de búsquedas:** unas 16 (persona por documento, rol por nombre, método de pago por
  nombre). La de método de pago en `createSale` usa `contains` insensible: ni siquiera es exacta.
- **Marca por agencia:** el texto legal del voucher (`VoucherPDF.tsx`) dice "DB Nexus", la marca de la
  casa parpadea mientras carga `/branding`, y el `<title>` es fijo.
- **Ruido en el registro:** el manejador de errores escribe con traza cada 404 de negocio (54 líneas
  por corrida del verificador).
- **`.env.example`:** tiene erratas de una edición a mano (`FRONTEND_URL` con el puerto cortado y una
  línea final corrupta: `L_FROM=""FROM=""`).
- **Ids no numéricos dan 500:** 24 `parseInt(req.params…)` en 6 controladores. Un id que no es un
  número llega a Prisma como `NaN` y responde 500 en vez de 400. Lo anotó el rediseño de la
  cartera; el arreglo es un middleware de validación en los routers, no 24 parches.

---

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-09-25 | T7 (mensajes) | Ningún error de comisionistas llegaba a la pantalla. Los rechazos de liquidar llevan código y un mensaje claro, se enseñan en el modal y el historial deja de leer una copia que no se refrescaba. Probado en pantalla. T8 queda a replantear: los productos no se editan desde ninguna pantalla. |
| 2026-09-25 | T7 | Cerrada, 27 comprobaciones por la API sin fallos. Tope y cerrojo en los cobros, comisiones sin anuladas ni borradas, liquidación decidida por el servidor. De paso: liquidar no marcaba ninguna venta, y el acumulado se podía pagar dos veces. |
| 2026-09-25 | Entorno | **La contraseña de `app_nexus` se restableció otra vez** (desde `feat-bayrol`, con el hash SCRAM generado en local: la contraseña no pasó por el MCP). La del 2026-09-24 deja de valer: el `.env` de `feat-dbmoon` y el hosting, si ya la usan, necesitan la nueva. |
| 2026-09-25 | T6, docs | T6 cerrada: el commit y el push estaban hechos en `e697576`. La prueba de aislamiento pasa de `backend/pruebas/` a `backend/tests/` (script y documentación al día). Las dos ramas de trabajo quedan anotadas. La spec 001 pasa a completada y el rediseño de la cartera, a terminado. |
| 2026-09-24 | T3 (T3a, T3b) | Verificación por la API: 80 comprobaciones sin fallos. Destapó dos fallos que solo existen con la barrera puesta: las subidas de archivos y los 500 intermitentes. |
| 2026-09-24 | T6 | Merge de `origin/main`. Las migraciones de seguridad que ya estaban en la base pasan a estar en la rama. `CLAUDE.md` fusionado. |
| 2026-09-24 | T5 | Al crear una aerolínea en gestión interna no llegaba al selector del asistente de venta: dos copias del catálogo. Una sola. |
| 2026-09-24 | T4 | Cinco categorías de producto perdían campos al crearse desde el asistente. |
| 2026-09-24 | T2 | Cuatro fallos en la suplantación, el más visible: el botón de salir no hacía nada porque `/auth/me` no traía `empresaId`. |
| 2026-09-24 | T1 | El servidor se niega a arrancar con un rol que salta la RLS. |
| 2026-09-24 | T0 | Descubierto que la barrera estaba inerte en una máquina de desarrollo: `DATABASE_URL` con `postgres`. |

---

## La prueba que se queda

Pendiente de T11. Mientras tanto, esto es lo que hace, para poder rehacerla:

1. Levanta un servidor propio en otro puerto con el rol de la aplicación y sin límite de login.
2. Crea dos agencias con el servicio real de altas y entra en cada una por el login.
3. Crea por la API, en cada agencia: dos clientes (uno con el mismo documento en las dos), un
   proveedor, un responsable, un comisionista y una venta a crédito con un producto.
4. **Controles positivos:** `GET` y `PUT` sobre cada recurso propio, todos 200.
5. Lee 24 listados, tres veces, desde cada agencia, y busca la marca única de la otra (sin distinguir
   mayúsculas: el servicio de comisionistas capitaliza los nombres). Comprueba también que cada una
   ve lo suyo.
6. Ataca por id los recursos de la otra: lectura, edición, borrado, pagos, cancelación, productos y
   subida de vouchers y avatares. Cuenta un 2xx como fuga y un 500 como aviso. Después compara los
   datos ajenos con una instantánea anterior.
7. Intenta altas con ids de la otra agencia y comprueba que el recuento de ventas no cambia.
8. Sesión y administración (401, 403), ficheros con y sin dueño, numeración con altas simultáneas,
   y que los permisos de cada agencia apuntan solo a sus roles.
9. Desmonta lo creado con el rol administrador, solo si el identificador empieza por `verif-aisl-`,
   y borra de `uploads/` los ficheros de prueba por su contenido exacto.
