# Spec 006 — El calendario de fecha y el diseño de tres modales

**Estado:** en ejecución · **Rama:** `feat-dbmoon`

Qué tiene que pasar y cómo se comprueba. El *cómo* técnico está en `plan.md`; lo hecho y lo
pendiente, en `tasks.md`.

## Problema

Reportado con una captura: al abrir el calendario de una fecha dentro de la modal de liquidar un
comisionista, se veía cortado por arriba y montado sobre el resto del formulario — "queda por
debajo de la modal y no se ve completo". El mismo componente de fecha lo usan ocho módulos
(Clientes, Comisionistas, Responsables, los filtros de Ventas, y los formularios de Migración,
Pasaporte, Mascota y Visa), así que no era un defecto de una pantalla sino del componente
compartido.

Aparte, y sin relación técnica con lo anterior, se pidió mejorar el aspecto de tres sitios que se
veían inconsistentes con el resto de la aplicación:

- La modal de liquidar a un comisionista: una tarjeta degradada con un ícono gigante de fondo,
  texto enorme y un botón con animación, muy distinta a las demás modales de dinero de la app
  (`SalePaymentsModal`, `AgentDetailsModal`), que usan tarjetas planas con una franja de color.
- Las modales de Agencias (crear y editar): un formulario correcto pero sin relación visual con la
  marca que estaban creando o editando, en una pantalla cuya propia idea es "una lista de empresas
  es una lista de marcas".
- El pie de la modal de editar una agencia, con hasta cuatro botones: uno de ellos llevaba un
  `mr-auto` que lo separaba mucho de los demás, dejando un hueco grande en medio al ensanchar la
  modal.

## Qué será posible al terminar

1. El calendario de cualquier campo de fecha, dentro de cualquier modal, se ve completo, abra hacia
   donde abra.
2. La modal de liquidar un comisionista y las dos de Agencias usan el mismo lenguaje visual que el
   resto de la aplicación: tarjetas planas con una franja de color, no degradados ni iconos de
   fondo.
3. El pie de una modal con varios botones los agrupa por lo que hacen, y si no caben en una línea
   bajan a una segunda en vez de salirse del ancho de la modal.

## Criterios de aceptación

| # | Criterio | Cómo se comprueba |
|---|---|---|
| D1 | El calendario no queda recortado por el scroll de una modal | Abrir el selector de fecha en Clientes, Comisionistas (liquidar), Responsables y Agencias: el mes completo se ve, arriba o abajo |
| D2 | El calendario abre hacia el lado con más espacio real | Un campo de fecha cerca del borde superior de una modal corta abre hacia abajo, no hacia arriba |
| D3 | Nada deja de funcionar donde ya se forzaba una dirección | Los filtros de fecha de Ventas (`popoverDirection="down"` explícito) siguen abriendo hacia abajo |
| D4 | Las modales rediseñadas no pierden ningún dato ni acción | Liquidar un comisionista y crear/editar una agencia muestran y guardan exactamente los mismos campos que antes |
| D5 | Los botones del pie de una modal no se salen de su ancho | La ficha de una agencia activa, con sus cuatro botones, se ve completa sin desbordar en una modal `lg` |

## Fuera de alcance

- **Los otros dos sitios con el mismo componente de fecha cruda** (`UserModal.tsx`, que usa la
  librería directo en vez del componente compartido, y los selectores de fecha/hora de vuelo en el
  asistente de venta): comparten el riesgo de fondo, pero ninguno se reportó roto y tocarlos sin
  confirmación es más riesgo que beneficio en una zona ya muy probada (specs 002 y 004). Quedan
  anotados para revisar si alguna vez fallan.
- **Probar en un navegador real.** No hay uno disponible en esta sesión; todo se verificó leyendo
  el código, con `tsc --noEmit` y razonando la geometría CSS a mano.
