# El calendario de una fecha escapa del recorte de la modal

**Estado:** implementado · **Rama:** `feat-dbmoon` · Detalle de ejecución en
[`spec 006`](../specs/006-calendario-y-modales/spec.md).

## Problema

Reportado con una captura: al abrir el calendario de una fecha dentro de "Validación de
Liquidación" (Comisionistas), el mes se veía cortado por arriba, montado sobre el resto del
formulario. El componente (`DatePicker`, envoltorio propio sobre `react-tailwindcss-datepicker`)
lo usan ocho módulos — Clientes, Comisionistas, Responsables, los filtros de Ventas y cuatro
formularios de producto —, así que no era un defecto de una pantalla.

## Primer intento, insuficiente

La librería decide hacia qué lado abrir comparando con `window.screen.height` — el alto **físico**
de la pantalla, no el de la ventana del navegador. En una ventana no maximizada (lo normal en un
monitor grande) siempre cree que sobra espacio debajo y nunca voltea el calendario hacia arriba.

El primer arreglo midió la posición real con `getBoundingClientRect` y `window.innerHeight`, y
forzó siempre una dirección explícita (nunca dejar que la librería decidiera con su propia cuenta).
Mejora la elección del lado, pero **no resuelve el problema de fondo**: el calendario se pinta
`position: absolute`, como hijo de su campo, que vive dentro del cuerpo con scroll de la modal
(`Modal.tsx`, `overflow-y-auto`). Un `overflow` recorta a **todos** sus descendientes,
independientemente de su `position` y de hacia qué lado abran. Si el calendario (un mes completo,
~340 px de alto) es más alto que el espacio disponible en CUALQUIERA de las dos direcciones dentro
del área visible de la modal, queda cortado igual — solo cambia qué parte se corta.

## Por qué no basta con `position: fixed`

`position: fixed` sí puede escapar de un `overflow: hidden/auto` ancestro, **siempre que su
contenedor de bloque sea el viewport** (ningún ancestro con `transform`/`filter`/`perspective`
distinto de `none`). La animación de entrada de la modal (`animate-scale-in`,
`animation: scale-in 0.3s ease-out forwards`) deja, por culpa de `forwards`, un `transform:
scale(1)` aplicado al panel **para siempre** después de terminar — visualmente un no-operación,
pero un `transform` no-`none` al fin, que convierte al panel en el contenedor de bloque de
cualquier `position: fixed` de dentro, atrapándolo de nuevo.

Pero incluso arreglando eso, la librería posiciona su calendario con clases relativas (`bottom-full`,
`right-0`, calculadas como porcentaje del contenedor), pensadas para `position: absolute` respecto
a un ancla pequeña. Cambiar esa clase a `fixed` rompe esa aritmética: `bottom: 100%` en un elemento
`fixed` es "100 % desde el fondo del viewport", no desde el campo. No hay forma de aprovechar las
clases de la librería tal cual con `fixed`.

## El arreglo: un portal, no una posición CSS

`DatePicker` pinta la zona activa de 32×32 que abre el calendario —y, dentro de ella, el
calendario entero, intacto, con las mismas clases relativas de siempre— por un `createPortal`
directo a `document.body`, la misma técnica que ya usa `Modal.tsx` para la propia ventana. Al
salir del árbol de la modal, ningún `overflow` ancestro lo recorta, sin tener que pelear con la
aritmética interna de la librería.

Su posición en pantalla se calcula aparte, a mano, porque ya no vive donde el usuario lo ve:

- Se mide una vez al montar (`useLayoutEffect`, antes del primer pintado).
- Se corrige a los 350 ms: la modal tarda 300 ms en su animación de entrada
  (`transform: scale()`), y medir durante ella da una posición equivocada (el panel, a medio
  escalar, no está en su sitio final).
- Se recalcula en cada `resize` y en cada `scroll` (en captura, para enterarse también del scroll
  del cuerpo de la modal, que no burbujea hasta `window`).

El icono decorativo que se ve siempre (`<Calendar size={15}/>`) se queda exactamente donde
estaba — no era lo que fallaba. Solo la zona interactiva (invisible, superpuesta encima de ese
icono) y el calendario que abre viajan al portal.

De paso, `.animate-scale-in` deja de usar `forwards`: al terminar, el elemento vuelve a su estilo
sin animar, que aquí es visualmente idéntico (`scale(1)` y `none` se ven igual), pero ya no deja un
`transform` colgado para siempre. No hacía falta para el portal elegido (que escapa del DOM entero,
no depende del `position`), pero cierra la misma trampa para cualquier otro elemento de posición
fija que alguien añada dentro de una modal más adelante.

## Qué no cubre

- `UserModal.tsx` (fecha de nacimiento, Usuarios) usa la librería directo, sin pasar por
  `DatePicker`: mismo riesgo, sin confirmar que falle.
- Las fechas y horas de vuelo del asistente de venta (`DateTimePicker.tsx`) comparten el mismo
  patrón y el mismo riesgo, en una zona ya muy probada (specs 002 y 004) que no se tocó sin
  confirmación.
- No se probó en un navegador real.
