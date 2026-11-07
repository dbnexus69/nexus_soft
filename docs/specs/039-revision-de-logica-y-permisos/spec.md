# Spec 039 — Revisión de lógica, permisos y dinero (2026-11-07)

**Estado:** hallazgos documentados; correcciones pendientes de las decisiones del usuario · **Rama:** `feat-bayrol` ·
**Toca la base compartida:** no (ninguna migración prevista) · **Origen:** revisión del 2026-11-07 (multitenencia,
autenticación, permisos por módulo, dinero y frontend) · **Relacionadas:**
[`025`](../025-auditoria-de-permisos/spec.md), [`027`](../027-permisos-coherentes/spec.md),
[`028`](../028-costos-de-proveedor-y-freelancer/spec.md), [`029`](../029-limite-de-usuarios-por-plan/spec.md),
[`033`](../033-revision-de-la-rama/spec.md), [`036`](../036-deuda-tecnica-de-la-revision/spec.md)

## Por qué

Se leyeron el núcleo de tenencia (`config/db.js`, `config/tenant.js`, `middleware/auth.js`, `authorize.js`), la
suplantación, usuarios, el ciclo de dinero de una venta (alta, cobros, anulación, borrado, revisión) y las
comisiones. El mecanismo de tenencia (`SET LOCAL` por transacción, marca de "ya en transacción") y el alcance
`own`/`all` de ventas están bien cerrados. Los huecos están en **quién puede asignar qué rol** y en **qué cifras de
dinero se aceptan del cliente sin contrastarlas**.

**Cómo se comprobó.** «Reproducido» = confirmado por la API contra la base local en Docker (spec 038), con un script
sobre `tests/montaje.js` que monta y desmonta sus propias agencias (2026-11-07, todo en verde). «Lectura» = visto en
el código, no ejecutado. Producción: el usuario confirma que en la agencia del superadministrador **no hay otros
admins**, así que H1 hoy es latente.

## Hallazgos

| # | Gravedad | Qué | Dónde | Cómo se comprobó |
|---|---|---|---|---|
| H1 | 🔴 crítica (latente) | **Escalada a superadministrador.** `role` es `z.string()` libre y se resuelve por nombre sin restricción. En la agencia donde vive el superadmin existe la fila de rol `superadmin`, así que cualquier usuario con `users.create`/`users.edit` allí puede crear un superadmin, ascenderse, o **cambiar la contraseña/correo del superadmin real** y entrar como él. Con eso administra todas las agencias. | `schemas/users.schema.js:13,30`; `services/users.service.js:179,293,409` (`updateUser` no mira a quién edita) | Reproducido: `POST /users {role:'superadmin'}` 201; `PUT /users/<super> {password}` 200 y login con la clave nueva 200; autoascenso 200 y `GET /companies` 200. |
| H2 | 🟠 alta | **Cambiar el rol no corta la sesión ni la caché.** Solo contraseña e inactivar revocan. Un admin bajado a asesor sigue con permisos de admin hasta que caduca su entrada de `authCache` (≤ 5 min). | `services/users.service.js:416-422` | Reproducido: tras bajarlo, su token sigue en `GET /users` 200. |
| H3 | 🟡 media | **`updateUser` no es atómico.** `personas` se escribe fuera de la transacción y antes del control de cupo: reactivar con el plan lleno da 422 pero el nombre/documento ya cambió. La comprobación de documento duplicado también va fuera (carrera → error de único). | `services/users.service.js:381-403, 426` | Lectura. |
| H4 | 🟡 media | **Auditoría de suplantación que no cierra.** Si el token caduca sin pulsar "salir", `terminada_at` queda nulo para siempre. `terminarSuplantacion` no comprueba que la suplantación sea de la empresa de la URL ni del superadmin que pide (relevante si hay más de uno). | `services/companies.service.js:385-402` | Lectura. |
| H5 | 🔵 a decidir | **Suspender una agencia no corta una suplantación abierta en ella** (esa sesión vive en la agencia de origen). | `services/companies.service.js:309-316` | Lectura. |
| H6 | 🟠 alta | **`total` explícito por producto desacopla precio, TA e IVA.** `products.schema.js` acepta `total`/`subtotal` y `precioProducto` lo usa tal cual si es > 0. Por la API, un asesor registra costo 1.000.000 + TA 500.000 cobrando 1: la venta queda "pagada" con 1 y el IVA declarado (95.000) no cuadra con lo cobrado. El asistente no envía ese campo: solo es alcanzable por la API. | `schemas/products.schema.js:109-110`; `services/saleTotals.js:48-53` | Reproducido: `monto_total=1, ta_total=500000, iva_total=95000`. |
| H7 | 🟠 alta | **Comisión neta sin relación con bruto y retención.** Bruto, % de retención y neto llegan los tres del cliente y se guardan sin contrastar; la liquidación paga el **neto**. La pantalla además deja escribir el neto a mano (`Step3Payment.tsx`, «Neto a Pagar al Comisionista»). | `services/sales.service.js:335-341` (alta) y `CAMPOS_EDITABLES` (edición) | Reproducido: bruto 100 + 10 % → neto 999.999 guardado y liquidado por 999.999. |
| H8 | 🔵 a decidir | **Se liquida la comisión de ventas que el cliente no ha pagado.** `VENTA_CON_COMISION_PENDIENTE` no mira el estado de cobro: una venta a crédito sin un abono ya se puede liquidar. | `services/commissions.service.js:33-37` | Reproducido (201 sobre una venta en `credito`). |
| H9 | 🟠 alta | **Borrar un pago de una venta revisada la deja revisada y con deuda**, y sin forma de cambiarlo (`updateReviewStatus` rechaza tocar una revisada). | `services/sales.service.js:694-714, 828` | Reproducido: `status=credito, is_reviewed=true`. |
| H10 | 🔵 a decidir | **Se elimina (borrado lógico) una venta pagada, revisada o con comisión ya liquidada.** Desaparece de cartera y estadísticas; la liquidación sigue apuntándola. Anular sí conserva los pagos; eliminar no tiene ninguna guarda. | `services/sales.service.js:615-619` | Reproducido (204 en los dos casos). |
| H11 | 🟡 media | **`deletePayment` no bloquea la venta** (`registerPayment` sí): un cobro y un borrado simultáneos pueden dejar `monto_pagado_credito`/`status` calculados con datos viejos. | `services/sales.service.js:698-709` | Lectura. |
| H12 | 🟡 baja | **`registerPayment` con un id de método que no existe guarda el pago sin método en silencio**; el alta de venta lo rechaza con 400 (`sales.service.js:283`). Las dos reglas discrepan. | `services/sales.service.js:630-633` | Lectura. |
| H13 | 🔵 baja | **Mensaje que apunta a una ruta que no existe:** `NO_EDITABLES` dice «los productos se editan en `/sales/:saleId/products/:categoria`», retirada en la spec 002. | `services/sales.service.js:73, 81` | Lectura. |
| H14 | 🔵 a decidir | **Los borradores de venta y cotización sobreviven al cierre de sesión** en `localStorage`, con datos personales de pasajeros (documento, nacimiento, pasaporte). Es deliberado para la caducidad por inactividad; en el cierre explícito, en un equipo compartido, quedan para el siguiente. | `context/AuthContext.tsx:97-118`; `NewSaleWizard.tsx:150,308`; `Quotes.tsx:290,309` | Lectura. |

### Segunda tanda (2026-11-07): configuración, estadísticas, cotizaciones, vuelos, esquema/RLS y frontend

| # | Gravedad | Qué | Dónde | Cómo se comprobó |
|---|---|---|---|---|
| H15 | 🔴 alta | **Un admin de agencia escribe en los catálogos compartidos de todas.** La decisión de multitenencia dice que aerolíneas, aeropuertos, políticas de equipaje y tipos de documento solo los edita el superadmin, pero: (a) `/config` solo exige `config.edit`, que tiene todo admin; (b) esas tablas (y `permisos`) no tienen RLS y `app_nexus` tiene `INSERT/UPDATE/DELETE`. Una agencia puede crear, renombrar o borrar una aerolínea, un aeropuerto o un tipo de documento que usan todas las demás (el borrado lo frena solo el recuento de `usos` si ya está en uso). | `routes/config.routes.js:23-30`; `services/config.service.js` (secciones `airlines`, `airports`, `baggage`, `document-types`); sin política en la base | Reproducido en local: A crea, renombra y borra aerolínea, aeropuerto y tipo de documento, y B ve la aerolínea de A. **En producción depende de los `GRANT` dados a mano** (`.claude/rules/database.md`): hay que comprobarlos. |
| H16 | 🟠 alta | **Un asesor borra abonos de sus ventas por la API.** `DELETE /sales/:id/payments/:id` solo exige `sales.edit` (el asesor lo tiene en `own`); la pantalla solo ofrece el botón al admin y con la venta no pagada (`SalePaymentsModal.tsx:528`, por `isAdmin`, contra la regla de la spec 025). Borrar el registro de dinero que entró queda al alcance de quien lo cobró. | `routes/sales.routes.js:39`; `services/sales.service.js:694` | Reproducido: el asesor borra el abono de su venta (200) y desaparece. |
| H17 | 🟡 media | **Editar o borrar un paquete no es atómico.** Se borran sus hoteles, vuelos, tarifas, asistencia y proveedores y después se escribe el paquete, fuera de una transacción: si la escritura falla (validación, clave ajena), el paquete queda vacío. | `services/config.service.js:413-420, 444-450` | Lectura. |
| H18 | 🟡 media | **El dashboard filtra por días de la zona del navegador, no de Bogotá.** `Dashboard.tsx` manda `toISOString()` del inicio/fin del día local, que es justo lo que la spec 004 prohíbe; `stats.service.js` hace `new Date(...)` sin `rangoDeDias`. Fuera de Colombia (o con el reloj en otra zona), las cifras del dashboard no cuadran con el listado de ventas del mismo rango. | `frontend/src/pages/Dashboard.tsx:146-151`; `services/stats.service.js:39-40, 88-89, 194-195, 479-480` | Lectura. |
| H19 | 🔵 baja | **Convertir una cotización en venta.** `linkSale` acepta cualquier venta vigente de la agencia (también la de otro asesor que quien enlaza no puede ver) sin exigir que la cotización esté `aceptada`. Y dos conversiones simultáneas (dos pestañas) crean dos ventas: la segunda no se enlaza y queda duplicada. | `services/quotes.service.js:375-407`; `NewSaleWizard.tsx` (enlace tras el 201) | Lectura. |
| H20 | 🔵 baja | **Check-in enviado y no guardado.** El correo al cliente sale antes de la transacción; si esta falla, el cliente recibió el check-in, el tramo sigue pendiente y los adjuntos se borran del bucket. Reintentar lo reenvía. | `services/flights.service.js:880-905` | Lectura. |
| H21 | 🔵 baja | **Alta de agencia: errores y pruebas.** El botón no exige apellidos ni largo mínimo y el servidor responde en inglés («String must contain at least 2 character(s)»: `min(2)` sin mensaje en `admin.firstName/lastName`). Las suites crean agencias por el servicio con `sinEmpresa`, nunca por `POST /companies` con la sesión del superadmin: el flujo real no está cubierto (probado a mano el 2026-11-07: funciona). | `schemas/companies.schema.js:73-74`; `pages/Companies.tsx:249`; `tests/montaje.js:123-135` | Lectura + prueba por la API. |

**Revisado y sin hallazgo:** fijar la empresa por transacción y la marca de "ya en transacción"; `authorize`
(escritura nunca más amplia que ver); alcance `own` en todas las rutas de ventas (`ventaVisible`, cartera, listado,
voucher de producto); cobro con cerrojo y tope; recálculo de cabecera desde productos y pagos; liquidación con
`FOR UPDATE` y 409 si cambia la cifra; revocación al cerrar sesión y al suspender; claves de caché del navegador con
empresa y usuario. En la segunda tanda: alcance `own` en las siete consultas de estadísticas, en todas las rutas de
cotizaciones (incluidos PDF, imágenes y duplicar) y en vuelos/check-in (también los de paquete); RLS activa, forzada y
con política en las 47 tablas con `empresa_id` (consulta a la base local); `SCOPED_ACTIONS` igual en los dos lados.

## Decisiones del usuario (antes de implementar)

1. **H1:** ¿el rol `superadmin` deja de poder asignarse por `/users` (solo por script/BD), y un usuario superadmin
   solo lo puede editar otro superadmin? *(Recomendado: sí a las dos.)*
2. **H2:** ¿basta con invalidar la caché al cambiar el rol (la sesión sigue y el rol nuevo vale en la siguiente
   petición), o se cierran sus sesiones como al cambiar la contraseña? *(Recomendado: invalidar caché.)*
3. **H6:** ¿se quitan `total`/`subtotal` del esquema de producto (el precio siempre = costo + TA + IVA)? *(Recomendado:
   sí; nadie los usa.)*
4. **H7:** el neto a mano en la pantalla, ¿es una función querida (ajuste manual) o un descuido? Si es descuido, el
   servidor deriva el neto de bruto × (1 − retención). Si es querido, ¿se exige al menos neto ≤ bruto?
5. **H8:** ¿la comisión se puede liquidar antes de que el cliente pague, o solo con la venta `pagado` (o
   proporcional a lo cobrado)? Es regla de negocio.
6. **H9:** al borrar un pago de una venta revisada, ¿se rechaza, o se quita la marca de revisada?
7. **H10:** ¿se permite eliminar ventas con pagos, revisadas o con comisión liquidada, o solo anularlas?
8. **H5 y H14:** ¿se dejan como están (intencionales) o se corrigen?
9. **H15:** ¿se cierran los catálogos compartidos en las dos capas — guarda en `/config` para esas cuatro secciones
   (solo superadmin) y RLS en la base (leer todos, escribir solo con `app_es_superadmin()`)? *(Recomendado: las dos;
   un `REVOKE` a secas impediría también al superadmin, que entra con el mismo rol.)* Antes, con tu orden, una consulta
   de solo lectura en producción (`has_table_privilege('app_nexus', 'aerolineas', 'INSERT')`) dice si hoy está abierto
   allí.
10. **H16:** ¿quién puede borrar un abono: solo el admin (editar ventas en `all`), o una acción propia en la matriz de
    permisos? *(Recomendado: editar en `all`, como marcar revisada.)*

## Fuera de alcance

- Importes en `Float` en la base (`aCentimos` lo contiene; pasar a `Decimal` es una migración aparte).
- Revisión línea a línea de los ~150 componentes del frontend: se miró sesión, cachés, permisos, el asistente de venta
  y el dashboard.
