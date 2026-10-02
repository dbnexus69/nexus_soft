# Plan técnico — Spec 006

El razonamiento completo del arreglo del calendario (por qué el intento de "elegir mejor la
dirección" no bastaba, y por qué el portal sí) está en
[`docs/designs/calendario-escapa-del-recorte-de-la-modal.md`](../../designs/calendario-escapa-del-recorte-de-la-modal.md).
Aquí solo las decisiones, resumidas.

## Decisiones

### 1. El calendario se pinta por un portal, no por posición CSS

**Primer intento, insuficiente:** medir el espacio real con `getBoundingClientRect` (la librería
usaba `window.screen.height`, el alto físico de la pantalla, no el de la ventana) y forzar siempre
una dirección explícita. Mejora la elección de lado, pero no evita el recorte: el calendario se
pinta como hijo de su campo, que vive dentro del cuerpo con scroll de la modal
(`overflow-y-auto`), y un `overflow` recorta a sus hijos sin importar su `position` ni hacia dónde
abran. Si el calendario es más alto que el espacio disponible en CUALQUIER dirección, queda
cortado igual.

**El arreglo de fondo:** `DatePicker` (`frontend/src/components/sales/forms/TicketForm.tsx`) pinta
la zona activa de 32×32 que abre el calendario —y, dentro de ella, el calendario mismo— por un
`createPortal` directo a `document.body`, la misma técnica que ya usa `Modal.tsx` para la propia
ventana. Al salir del árbol de la modal, ningún `overflow` ancestro lo recorta. Su posición en
pantalla se mide una vez al montar (`useLayoutEffect`), se corrige a los 350 ms (la modal tarda
300 ms en su animación de entrada, y medir durante ella da una posición equivocada) y se
recalcula en cada resize o scroll. El icono decorativo visible se queda donde estaba —no es lo que
fallaba—; solo la zona interactiva y su calendario viajan al portal, superpuestos exactamente
encima del icono.

De paso, `.animate-scale-in` (`index.css`) deja de usar `forwards` como modo de relleno: con él,
el panel de la modal queda con un `transform` aplicado para siempre (aunque sea `scale(1)`, un
no-operación visual), que convierte a cualquier `position: fixed` de dentro en relativo a ESE panel
en vez de al viewport. Sin `forwards`, al terminar la animación el elemento vuelve a su estilo sin
animar, que aquí es visualmente idéntico. No era estrictamente necesario para el portal elegido
(que escapa del DOM entero, no solo del `position`), pero cierra una trampa latente para cualquier
otro elemento de posición fija que se añada dentro de una modal en el futuro.

### 2. Liquidar un comisionista: la misma tarjeta plana que ya usa el resto de la app

`CommissionAgents.tsx`, modal "Validación de Liquidación". Se sustituye la tarjeta degradada con
icono de fondo por el patrón que ya usan `SalePaymentsModal` y `AgentDetailsModal`: tarjeta
`bg-gray-50` con una franja de color a la izquierda, un círculo con la inicial del comisionista, el
monto en una línea separada por un borde en vez de un titular gigante. El formulario (fecha, canal,
referencia, notas) se agrupa en una sola tarjeta con un encabezado pequeño con icono, en vez de dos
secciones con su propia franja de color cada una. El resumen de confirmación pasa de verde vivo a
azul discreto (el mismo tono que usa `SalePaymentsModal` para sus avisos). Los botones del pie usan
`variant="success"`/`variant="outline"` de `Button.tsx`, que ya existen y usa el resto de la app, en
vez de clases hechas a mano con sombra y animación propias.

### 3. Agencias: la modal lleva la marca que está creando o editando

`Companies.tsx`. La pantalla ya declara en su propio comentario que "una lista de empresas es una
lista de MARCAS"; las modales de crear y editar no lo seguían.

- **Alta:** una vista previa en vivo arriba del formulario, reutilizando el mismo componente
  `Marca` que pinta cada fila de la lista, mostrando cómo va a quedar la agencia mientras se
  escribe el nombre y se eligen los colores.
- **Ficha (editar):** el logo se pinta sobre una franja con el propio `colorPrimario` de la agencia
  al 5 % de opacidad (`${color}0d` en hex), para que lo primero que se vea al abrir sea su marca.
- **El selector de color**, en las dos: pasa de un `<input type="color">` diminuto con una etiqueta
  al lado a un círculo grande que ES el color (el input real sigue encima, invisible, para abrir el
  selector del sistema al tocarlo). Se extrajo a un componente compartido,
  `SelectorDeColores`, porque antes el mismo bloque estaba copiado letra por letra en las dos
  modales.
- `Marca` pasa a aceptar solo los tres campos que de verdad usa (`Pick<Empresa, 'nombre' |
  'logoUrl' | 'colorPrimario'>`) en vez de un `Empresa` completo, para poder reutilizarlo en la
  vista previa del alta, que no tiene una agencia real todavía.

### 4. El pie de una modal agrupa sus botones, no los esparce

Dos cambios, uno en la modal de Agencias y otro en el componente compartido:

- `FichaDeAgencia` (editar): los cuatro botones (Suspender/Reactivar, Entrar, Cancelar, Guardar)
  llevaban un `mr-auto` en el primero que lo empujaba al extremo izquierdo. En la modal `md`
  angosta casi no se notaba; al ensancharla a `lg` (necesaria porque los botones se salían del
  ancho en `md`) dejaba un hueco enorme en el medio. Se agrupan en dos bloques con
  `justify-between`: a la izquierda lo que cambia el estado de la agencia, a la derecha la acción
  del formulario.
- `Modal.tsx`, el contenedor del pie: gana `flex-wrap`. Con pocos botones nunca se usa (siempre
  caben en una línea); con varios en una modal angosta, antes se salían del ancho — ahora bajan a
  una segunda línea.

## Superficie de cambio

No hay cambios de API ni de base de datos; todo es frontend. Un único componente (`DatePicker`)
resuelve el arreglo del calendario en los ocho módulos que lo usan, sin tocarlos uno por uno.
