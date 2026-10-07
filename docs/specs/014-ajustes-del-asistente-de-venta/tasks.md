# Tareas — Spec 014

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-06).** Implementada en el código, verificada con `tsc`. Ninguna parte se
ha probado en el navegador.

---

## T1 · Borrador que sobrevive a cambiar de módulo `[~]`

Copia en memoria por empresa y usuario; cerrar con X o "Cancelar" ya no borra; si falla el
`localStorage` se borra la copia vieja. Ver `plan.md` decisión 1.

Pendiente: decidir si se añade "Descartar borrador" (hoy solo lo borra registrar la venta) y
resolver que una recarga pierde los borradores con vouchers grandes (IndexedDB o servidor).

## T2 · Tipo de documento en SIM card y finca `[~]`

Selector "Tipo de Documento" antes del número, con las opciones de la configuración de la
agencia. La causa del aviso "Elija primero el tipo de documento" era que
`documentosDeLaVenta.ts` exige el tipo cuando hay número, y el formulario no lo pedía. Se
revisaron todos los formularios de venta: era el único caso (SIM y finca).

Pendiente: probar en pantalla que el selector precarga el tipo del cliente.

## T3 · Nombre y fecha y hora del tour `[~]`

Dos campos obligatorios al pasar del paso de productos. El backend ya guardaba `tour_nombre`
y `fecha_preferida`; faltaba la pantalla. Las ventas de tours ya guardadas no tienen nombre y
hay que volver a capturarlo.

## T4 · Resumen de la venta y IVA en el pago `[~]`

Tarjeta de resumen rediseñada (paso de productos) y celda de IVA en el resumen financiero
(paso de pago).

## T5 · Botones duplicados del formulario de producto `[x]`

Se quitan "Cancelar" y "Guardar Servicio" de la cabecera; quedan los de la barra inferior,
que llaman a la misma función.

## T6 · Ciudad y dirección de la finca `[~]`

`ventaProductos.js` leía `f.city` y `f.address`; ahora `f.fincaCity` y `f.fincaAddress`.
Verificado por lectura del código y `node --check`. Falta comprobarlo con una venta real de
finca.

## T7 · Error 500 al registrar una venta con todos los servicios `[ ]`

Reportado en el chat. El aviso da una referencia de 8 caracteres y el servidor registra la
causa en la consola del backend (`[ERROR] <referencia> POST /api/v1/sales …`). Falta esa
línea para diagnosticar. Mientras tanto, revisado: las columnas de `prod_fincas` y
`prod_simcards` existen en el esquema, así que no es un problema de columnas.

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-06 | T1 | Copia en memoria del borrador; `tsc` sin errores. Sin probar en el navegador. |
| 2026-10-06 | T2 | Selector de documento en SIM y finca; `tsc` sin errores. |
| 2026-10-06 | T3 | Nombre y fecha y hora del tour, obligatorios; `tsc` sin errores. |
| 2026-10-06 | T4 | Resumen rediseñado e IVA en el pago; `tsc` sin errores. |
| 2026-10-06 | T5 | Botones duplicados quitados; `tsc` sin errores. |
| 2026-10-06 | T6 | Finca: ciudad y dirección; `node --check`. |
| 2026-10-06 | T7 | Pendiente de la referencia del 500. |
