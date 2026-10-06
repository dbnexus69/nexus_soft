# Tareas — Spec 007

Cada tarea deja el sistema funcionando. Ninguna se da por hecha sin su comprobación.

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-03).** Solo existe el diseño (`spec.md`, `plan.md`). Nada implementado
todavía. **T0 bloquea todo lo demás.**

---

## T0 · Confirmar la decisión abierta `[ ]`

Antes de escribir una sola migración: ¿la línea de una cotización es simple
(categoría + descripción + precio, la recomendada en `plan.md`) o reutiliza las 15
tablas `prod_*` de ventas con su detalle completo? El resto de las tareas de abajo da
por hecho que se eligió la simple; si no, hay que replantear T2, T3 y T6 antes de
seguir.

## T1 · Migración: `tarifas_proveedor` `[ ]`

Tabla nueva con su RLS, su `empresa_id` por defecto y su índice. Sin tocar ninguna
tabla existente — puramente aditiva.

## T2 · Migración: `cotizaciones` y `detalle_cotizacion` `[ ]`

Las dos tablas de `plan.md`, con sus claves ajenas compuestas y su número visible
(extender el disparador `app_asignar_numero()` a `cotizaciones`, como ya cubre a las
nueve tablas numeradas existentes).

## T3 · Backend: tarifas de proveedor `[ ]`

`services/supplierRates.service.js` y su controlador/rutas: CRUD paginado, filtro por
proveedor y categoría vigentes. Permiso `supplierRates` en las tres piezas de
`authorize.js`/`roles.service.js`/`types/index.tsx`.

## T4 · Backend: cotizaciones `[ ]`

`services/quotes.service.js`: crear (con sus líneas, en una transacción, como una
venta), leer, editar, borrar (baja lógica), duplicar, enviar, responder, convertir a
venta (sin escribir la venta — solo arma el borrador que el asistente precarga).
Permiso `quotes` en las tres piezas.

## T5 · Frontend: catálogo de tarifas de proveedor `[ ]`

Pantalla de listar/crear/editar, mismo patrón visual que las demás pantallas de
catálogo (`Config.tsx` u otra, por decidir cuando se diseñe la pantalla).

## T6 · Frontend: cotizaciones `[ ]`

Lista, formulario de línea (categoría, descripción, proveedor opcional con selector de
tarifa vigente, costo, TA), ver totales en vivo (mismo cálculo que ya usa
`useSaleCalculations.ts`, si se puede compartir). Botones: guardar, enviar, marcar
aceptada/rechazada, duplicar, convertir en venta, descargar PDF.

## T7 · Plantilla PDF de la cotización (servidor) `[ ]`

El documento que recibe el cliente, generado en el servidor con `pdfmake` y la
marca de la agencia, igual que el voucher (`services/voucher/`, spec 011). No hay
`VoucherPDF.tsx` en el navegador: se eliminó en la rama de Bayrol.

## T8 · Convertir en venta, de punta a punta `[ ]`

Que "Convertir en venta" realmente deje al asesor en el asistente con el cliente y los
totales puestos, y que terminar esa venta la deje enlazada a la cotización
(`cotizaciones.venta_id`).

## T9 · Verificación `[ ]`

Por la API real, con una agencia de prueba desechable (mismo patrón que el resto de
specs): crear tarifas, crear una cotización que las use, duplicarla, convertirla en
venta, y los controles de permisos (un rol sin `quotes.create` da 403). `pnpm
check:prisma` y `pnpm test:aislamiento` (extendido para las tablas nuevas) en verde.

---

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-03 | — | Diseño inicial: `spec.md` y `plan.md` escritos a partir de lo que pidió el usuario (cotizaciones al cliente + tarifas de proveedor, conectadas). Pendiente de confirmar T0 antes de empezar. |
