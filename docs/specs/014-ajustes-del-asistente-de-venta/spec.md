# Spec 014 — Ajustes del asistente de venta

**Estado:** implementada (2026-10-06), pendiente de probar en pantalla · **Rama:** `feat-dbmoon`

Este documento dice **qué** tiene que pasar y **cómo se comprueba**. El *cómo* está en
`plan.md`; el reparto en tareas, en `tasks.md`. Recoge una serie de ajustes que salieron al
usar el asistente de venta con una venta completa de todos los servicios.

## Problemas que se atacan

1. **Se perdía el trabajo al cambiar de módulo.** Un borrador a medias se borraba al cerrar
   con X o "Cancelar", y al navegar entre módulos la copia en `localStorage` fallaba en
   silencio cuando la venta traía vouchers grandes (base64, cupo de unos 5 MB).
2. **"Falta el tipo de documento" sin ver el campo.** La SIM card y la finca precargan el
   número de documento del cliente, pero su formulario no tenía selector de tipo. Al pasar a
   pagar, la validación pedía un tipo que no se podía elegir.
3. **El tour no pedía ni fecha ni nombre.** El formulario no tenía campo de fecha ni de
   nombre; el backend los guardaba vacíos.
4. **El resumen de la venta se veía mal** (banner oscuro, cifras diminutas) y el paso de
   pago no mostraba el IVA.
5. **Botones repetidos.** El formulario de producto tenía "Cancelar" y "Guardar Servicio"
   arriba y abajo.
6. **La finca perdía su ciudad y su dirección** al guardarse: el servicio leía `f.city` y
   `f.address`, y el formulario manda `fincaCity` y `fincaAddress`.

## Qué será posible al terminar

1. Cerrar el asistente con X o "Cancelar" no borra el borrador. Se conserva al cambiar de
   módulo dentro de la misma sesión, separado por agencia y por usuario.
2. La SIM card y la finca piden el tipo de documento, con las opciones de la configuración
   de la agencia (el mismo origen que el hotel), precargado con el tipo del cliente.
3. El tour pide **nombre** y **fecha y hora**. Ambos son obligatorios al pasar del paso de
   productos.
4. El resumen de la venta (paso de productos) muestra la venta total y su composición:
   costo de proveedor, ganancia e IVA.
5. El paso de pago muestra el IVA en su resumen financiero.
6. El formulario de producto tiene sus botones solo en la barra inferior.
7. La finca guarda ciudad y dirección.

## Criterios de aceptación

| # | Criterio | Cómo se comprueba |
|---|---|---|
| C1 | Cerrar el asistente no borra el borrador | Cerrar con X y reabrir: los datos siguen |
| C2 | Un voucher que no cabe en `localStorage` no se pierde al cambiar de módulo | Copia en memoria por clave `empresa + usuario` |
| C3 | Si falla la escritura en `localStorage`, no se restaura una versión vieja | Se borra la clave al fallar |
| C4 | SIM y finca muestran "Tipo de Documento" antes del número | Revisión en el formulario; `tsc` |
| C5 | El tour exige nombre y fecha y hora | `validarPaso` añade los dos errores |
| C6 | La finca guarda `ciudad_pueblo` y `direccion_finca` | Lectura del código; `node --check` |
| C7 | El paso de pago muestra el IVA | Revisión del código; `tsc` |

## Decisiones tomadas

- **Cerrar no descarta.** Antes X y "Cancelar" borraban el borrador. Ahora solo lo borra
  registrar la venta, para que cerrar por error no cueste trabajo.
- **Tipo de documento en SIM y finca, no un cambio en la validación.** La regla que fallaba
  (`documentosDeLaVenta.ts`) es correcta: un número sin tipo no se puede validar. El fallo
  era de pantalla, que no dejaba corregirlo.
- **Un solo campo de fecha y hora para el tour.** La columna `fecha_preferida` del backend
  ya es `DateTime`; se pidió un campo y no dos.
- **El nombre del tour se guarda en `selectedTour`** (que el backend mapea a `tour_nombre`),
  sin cambiar el esquema.

## Pendiente

- **Descartar borrador.** Ya no hay forma de vaciar el borrador sin registrar la venta. Falta
  decidir si se añade un botón "Descartar borrador".
- **Recargar la página** (F5) pierde un borrador con vouchers grandes: la copia en memoria
  desaparece y `localStorage` no cabe. La solución real es IndexedDB o un borrador en el
  servidor.
- **Error 500 al registrar una venta con todos los servicios.** Sin la referencia del aviso ni
  la línea `[ERROR]` del backend no se puede diagnosticar. Ver `tasks.md`.

## Fuera de alcance

- Cambiar el esquema de SIM card o finca para guardar el documento en la base.
