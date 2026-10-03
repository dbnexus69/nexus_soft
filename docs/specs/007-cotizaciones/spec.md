# Spec 007 — Cotizaciones

**Estado:** en diseño, sin implementar · **Rama:** `feat-dbmoon`

Este documento dice **qué** tiene que pasar y **cómo se comprueba**. El *cómo* técnico
está en `plan.md`; el reparto en tareas, en `tasks.md`. A diferencia de las specs
anteriores, ninguna parte de esta todavía existe en el código: es el punto de partida,
no el registro de un trabajo hecho.

## Problema

Hoy, antes de que un cliente compre, no hay forma de dejarle una propuesta de precio
por escrito. El asesor cotiza de palabra o por fuera del sistema (WhatsApp, una hoja
aparte), y si el cliente tarda en decidir o pide ajustes, hay que rehacer la cuenta
desde cero. Dos cosas faltan, y están conectadas:

1. **Una propuesta de precio que se pueda guardar y mostrar al cliente**, antes de que
   sea una venta de verdad —el sistema hoy solo sabe de ventas ya cerradas, armadas de
   una vez en el asistente (`POST /sales`, spec 002). No hay ningún estado intermedio.
2. **Las tarifas que da cada proveedor** (un hotel, una aerolínea) tampoco se guardan en
   ningún sitio reutilizable. Cada vez que se cotiza algo, el costo de proveedor se
   escribe de memoria o se vuelve a pedir, aunque sea la misma tarifa de la semana
   pasada.

## Qué será posible al terminar

1. El asesor arma una cotización para un cliente: varios conceptos, cada uno con su
   categoría, su costo de proveedor y su TA, y ve el total igual que vería el de una
   venta.
2. Al elegir un proveedor en una línea, puede traer una tarifa ya guardada en vez de
   escribir el costo a mano.
3. La cotización se guarda, se puede volver a abrir, editar y duplicar para un cliente
   parecido u otra fecha.
4. El cliente recibe un documento con la marca de la agencia, igual que ya recibe el
   voucher de una venta.
5. Cuando el cliente acepta, la cotización se convierte en el punto de partida de una
   venta real, sin volver a escribir el cliente ni los totales desde cero.
6. Cada agencia decide, por rol, quién puede ver, crear, editar o borrar cotizaciones y
   tarifas de proveedor — el mismo sistema de permisos que ya rige todo lo demás.

## Criterios de aceptación

| # | Criterio | Cómo se comprueba |
|---|---|---|
| C1 | Una tarifa de proveedor se guarda con su vigencia | Crear una tarifa con `vigencia_hasta` en el pasado; al elegir ese proveedor en una cotización, no aparece entre las vigentes |
| C2 | Una cotización suma lo mismo que sumaría la misma lista de productos en una venta | Comparar el total de una cotización con `precioProducto`/`datosFinancieros` (`saleTotals.js`) sobre los mismos datos |
| C3 | Duplicar una cotización crea una independiente, en borrador | Editar la copia no cambia el original; el original conserva su estado y su número |
| C4 | El número visible de una cotización es propio de la agencia, no el id global | Dos agencias cotizando a la vez: cada una ve sus cotizaciones numeradas desde 1, como ya pasa con `ventas.numero` |
| C5 | Convertir una cotización aceptada en venta no pierde cliente ni totales | El asistente de venta abre con el cliente y los montos de la cotización ya puestos |
| C6 | Los permisos se respetan como en cualquier otro módulo | Un rol sin `quotes.create` recibe 403 al intentar `POST /quotes`, igual que hoy pasa con `users`/`clients` (ver spec 002, T20) |
| C7 | Ninguna agencia ve cotizaciones ni tarifas de otra | La misma prueba de aislamiento que ya corre para el resto de tablas de inquilino (`pnpm test:aislamiento`) pasa a incluir `cotizaciones`, `detalle_cotizacion` y `tarifas_proveedor` |

## Decisión abierta, para confirmar antes de implementar

**¿Una línea de cotización reutiliza las 15 tablas `prod_*` de ventas (tramos de vuelo,
pasajeros con nombre, etc.), o es un concepto más simple (categoría + descripción +
precio), sin ese detalle?** El `plan.md` explica las dos opciones y por qué se
recomienda la simple; es la decisión que más cambia el tamaño del trabajo, y el resto
de este spec da por hecho que se eligió esa.

## Fuera de alcance de esta primera entrega

- Vencimiento automático de una cotización por un proceso programado (cron). Se deriva
  al leer, comparando `fecha_vencimiento` con la fecha de hoy — el mismo patrón que ya
  usa `critico` en vuelos (spec 004), que tampoco se guarda, se calcula.
- Enviar la cotización por correo desde el sistema. Se descarga o se imprime, igual que
  el voucher hoy.
- Más de una moneda real (conversión, tipo de cambio). Un campo de moneda es solo
  informativo.
- Reutilizar el detalle fino de los productos de venta (tramos, pasajeros, equipaje) en
  una cotización — ver la decisión abierta de arriba.
- Un sistema de "plantillas" separado de las cotizaciones normales: duplicar una
  cotización existente cubre ese caso de uso sin una entidad nueva.
