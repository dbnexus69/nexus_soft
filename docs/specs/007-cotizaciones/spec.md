# Spec 007 — Cotizaciones

**Estado:** implementada · **Rama:** `feat-dbmoon`

Este documento dice **qué** tiene que pasar y **cómo se comprueba**. El *cómo* técnico
está en `plan.md`; el reparto en tareas, en `tasks.md`.

> Esta versión reemplaza por completo la del 2026-10-11. Se replanificó una segunda vez
> porque, al verla, el usuario pidió que cotizar un servicio pidiera **los mismos datos
> que venderlo** (origen/destino, ida o ida y vuelta, fecha, hora, pasajeros...), no una
> línea genérica de "categoría + descripción libre + costo + ganancia". El resto
> (cotizar, editar, duplicar, enviar, convertir en venta) se reafirmó con el mismo
> criterio de antes.
>
> **Ajuste del mismo día (2026-10-12):** una cotización no es una venta, así que
> ningún campo es obligatorio en ella — ni el cliente, ni el costo del proveedor, ni
> la reserva del titular de un tiquete. Esos mismos campos siguen siendo obligatorios
> al convertirla en venta, con la validación normal de `POST /sales`, sin cambios.
> (Antes de esto se probó, y se revirtió a pedido del usuario, una versión con
> formularios simplificados y sin selector de cliente — ver el registro en
> `tasks.md`; esta vuelta no toca ni los formularios ni el selector, solo afloja la
> validación.)

## Problema

Hoy, antes de que un cliente compre, no hay forma de dejarle una propuesta de precio
por escrito. El asesor cotiza de palabra o por fuera del sistema (WhatsApp, una hoja
aparte); si el cliente tarda en decidir o pide un cambio, hay que rehacer la cuenta
desde cero, y si otro cliente pide algo parecido a lo que ya se cotizó, tampoco hay
cómo reutilizarlo. El sistema hoy solo sabe de ventas ya cerradas, armadas de una vez
en el asistente (`POST /sales`); no hay ningún estado intermedio.

## Qué será posible al terminar

1. El asesor arma una cotización para un cliente con **la misma pantalla de productos
   que usa una venta**: elige la categoría (tiquete, hotel, seguro, paquete...) y
   llena el mismo formulario — para un tiquete, de dónde a dónde, ida o ida y vuelta,
   fecha y hora, pasajeros; para un hotel, fechas y huéspedes; etc. — con costo de
   proveedor y ganancia por servicio. El IVA se calcula solo (19% sobre la ganancia,
   igual que en una venta) y el total se ve en vivo.
2. **La descripción de cada línea se genera sola**, a partir de ese detalle (p. ej.
   "BOG → CTG (ida y vuelta)", "Hotel Caribe · Cartagena") — nadie la escribe a mano.
3. **Editar**: la misma cotización se puede modificar mientras esté en borrador o ya
   enviada, para cuando el cliente pide un cambio.
4. **Duplicar**: una copia independiente de una cotización existente, con el detalle
   completo de cada línea copiado tal cual, para cotizar algo parecido a otro cliente
   sin empezar de cero. Editar la copia no toca el original.
5. **Enviar**: marca la cotización como enviada y deja descargar su PDF; el sistema no
   manda ningún correo, el asesor comparte el documento por su cuenta.
6. El PDF tiene la marca de la agencia (igual que el voucher de una venta) y muestra el
   **precio por servicio** de cada línea — nunca el costo de proveedor ni la ganancia.
7. **Convertir en venta**: al aceptar, un botón abre el asistente de venta con **el
   detalle completo de cada servicio ya puesto** (los mismos tramos, pasajeros, fechas
   que se cotizaron, no solo el costo y la ganancia), listo para revisar y terminar la
   venta por el camino normal. Si la cotización tenía cliente, lo trae puesto; si no,
   el asistente lo pide en su primer paso, como en cualquier venta nueva. La venta
   resultante queda enlazada a la cotización.
8. Cada agencia decide, por rol, quién puede ver (todo o solo lo propio), crear, editar
   o borrar cotizaciones — el mismo sistema de permisos que ya rige todo lo demás.
9. **Una cotización no es una venta: nada en ella es obligatorio.** Ni el cliente, ni
   el costo de proveedor de un servicio, ni la reserva del titular de un tiquete — se
   puede cotizar con la información que haya en ese momento, aunque sea incompleta.
   Lo que sí se manda se sigue validando (un aeropuerto o un tipo de hotel que no
   existen se rechazan igual que en una venta), pero nada fuerza a completarlo
   mientras se cotiza. Esos mismos campos vuelven a ser obligatorios al convertir en
   venta, con la validación de siempre de `POST /sales` — así "convertir en venta"
   solo avanza cuando los datos ya están completos.

## Criterios de aceptación

| # | Criterio | Cómo se comprueba |
|---|---|---|
| C1 | El total de una cotización es costo + ganancia + IVA de sus líneas, igual fórmula que una venta | Comparar contra `datosFinancieros`/`calcularIva` (`saleTotals.js`) sobre los mismos números |
| C2 | Una cotización se puede editar en borrador y en enviada, pero no en aceptada ni rechazada | `PUT /quotes/:id` da 400 sobre una cerrada |
| C3 | Duplicar crea una cotización independiente, en borrador, con el mismo detalle por línea | Editar la copia no cambia el original; el original conserva su estado y su número |
| C4 | El número visible de una cotización es propio de la agencia, no el id global | Dos agencias cotizando a la vez: cada una numera desde 1, como `ventas.numero` |
| C5 | El PDF de una cotización muestra el precio y la descripción autogenerada de cada línea, nunca el costo de proveedor ni la ganancia | Generar el PDF y revisar su contenido |
| C6 | Lo que SÍ se manda en un producto de cotización se valida igual que en una venta (aeropuertos, enums), pero nada se exige por estar ausente — ni siquiera el costo de proveedor | `POST /quotes` con un aeropuerto inexistente da 422; el mismo cuerpo sin `supplierCost` ni cliente da 201 |
| C7 | Convertir una cotización aceptada en venta no pierde cliente (si lo tenía) ni detalle de ningún servicio, y la venta queda enlazada | El asistente abre con el detalle completo (p. ej. tramos de un tiquete) ya puesto, y con el cliente si la cotización tenía uno; tras crear la venta, `cotizaciones.venta_id` queda con su id |
| C8 | Los permisos se respetan como en cualquier otro módulo | Un rol sin `quotes.create` recibe 403 al intentar `POST /quotes` |
| C9 | Ninguna agencia ve cotizaciones de otra | La prueba de aislamiento (`pnpm test:aislamiento`) pasa a incluir `cotizaciones` y `detalle_cotizacion` |
| C10 | Una cotización se crea y se edita sin cliente, sin costo de proveedor y con un tiquete sin reserva del titular | `POST`/`PUT /quotes` con ese cuerpo responde 201/200, no 422 |
| C11 | `POST /sales` sigue exigiendo el costo del proveedor y la reserva del titular exactamente igual que antes — no se relajó nada del lado de la venta | `pnpm test:vuelos-api` en verde, en particular "titular sin reserva: 422" |

## Fuera de alcance de esta entrega

- **Tarifas de proveedor.** Se descartó en la primera replanificación: el costo de cada
  servicio se escribe a mano, sin catálogo ni selector.
- **Enviar por correo desde el sistema.** "Enviar" solo cambia el estado y genera el
  PDF; el asesor lo comparte por su cuenta (WhatsApp, correo, lo que use).
- Vencimiento automático por un proceso programado (cron). Se deriva al leer,
  comparando `fecha_vencimiento` con la fecha de hoy — el mismo patrón que ya usa
  `critico` en vuelos (spec 004).
- Un sistema de "plantillas" separado de las cotizaciones normales: duplicar cubre ese
  caso de uso sin una entidad nueva.
- Más de una moneda real (conversión, tipo de cambio).
- Vouchers/archivos adjuntos por servicio dentro de una cotización (sí existen en una
  venta): cotizar no sube ningún archivo, solo datos.
