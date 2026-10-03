# Tareas — Spec 006

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-03).** Hechas T1–T4, vistas en el navegador (T1 con un arreglo por confirmar en pantalla).

---

## T1 · El calendario escapa del recorte de la modal `[x]`

`DatePicker` (`TicketForm.tsx`) pinta su zona activa y el calendario por un portal a
`document.body`, con la posición medida en pantalla (`useLayoutEffect`, corregida a los 350 ms, y
recalculada en resize/scroll). `.animate-scale-in` deja de usar `forwards`, de paso.

**Comprobado:** `tsc --noEmit` limpio · razonado el porqué de que el intento anterior (solo elegir
mejor la dirección) no bastaba — ver `docs/designs/calendario-escapa-del-recorte-de-la-modal.md` ·
confirmado que los dos sitios que ya forzaban `popoverDirection` (los filtros de fecha de
`Sales.tsx`, con `"down"`) siguen recibiendo exactamente ese valor sin pasar por el cálculo nuevo.

**Confirmado en el navegador (2026-10-03)**, en la modal de liquidar un comisionista con la ventana baja:
el calendario sale por fuera de la modal sin recortarse. **Salió un defecto previo:** se abría encima de su
propio campo y tapaba la fecha. El campo de la librería es `absolute` dentro de la zona activa
(`[&_input]:absolute`, desde antes de T1), así que no ocupa sitio y el calendario se pintaba desde el borde
de arriba de la zona. Ahora, cuando abre hacia abajo, `popupClassName` le añade `top-full` y arranca bajo el
campo; hacia arriba la librería ya pone `bottom-full`. `tsc` limpio; **por ver en pantalla** que ya no tape
el campo.

## T2 · Liquidar un comisionista: la misma tarjeta plana que el resto de la app `[x]`

`CommissionAgents.tsx`. Tarjeta de resumen con franja de color en vez de degradado con icono de
fondo; formulario en una sola tarjeta; resumen de confirmación en azul discreto; botones del pie
con los `variant` que ya existen en `Button.tsx`.

**Comprobado:** `tsc --noEmit` limpio · los mismos campos de antes (fecha, canal, referencia,
notas, resumen, error) siguen presentes, solo cambia su presentación.

## T3 · Agencias: la modal lleva la marca que está creando o editando `[x]`

`Companies.tsx`. Vista previa en vivo en el alta (reutiliza `Marca`); franja con el color de la
agencia detrás del logo en la ficha; selector de color en círculo, extraído a
`SelectorDeColores` compartido entre las dos modales.

**Comprobado:** `tsc --noEmit` limpio · `Marca` ajustado a los tres campos que usa
(`Pick<Empresa, …>`) sin romper su uso en la lista, que sigue pasando un `Empresa` completo
(estructuralmente compatible).

## T4 · El pie de una modal agrupa sus botones `[x]`

`FichaDeAgencia`: los cuatro botones en dos grupos (`justify-between`) en vez de un `mr-auto`
suelto. `Modal.tsx`: el contenedor del pie gana `flex-wrap`, para cualquier modal con varios
botones, no solo esta.

**Comprobado:** `tsc --noEmit` limpio. La modal de Agencias pasó de `size="md"` a `size="lg"` en el
mismo cambio, porque en `md` los cuatro botones no cabían ni agrupados.

---

## Pendiente

- ~~Probar en navegador las cuatro tareas~~ Hecho el 2026-10-03: T2 (liquidar), T3 y T4 (ficha de agencia) se ven como se diseñaron.
- **`UserModal.tsx`** (fecha de nacimiento, usuarios) y **las fechas de vuelo del asistente de
  venta** (`DateTimePicker.tsx`) comparten la librería y el mismo riesgo de recorte que T1
  resolvió, pero ninguno se reportó roto. Quedan fuera a propósito (ver spec.md, Fuera de
  alcance); revisar si alguna vez fallan.

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-01 | T4 | Los botones del pie de la ficha de una agencia, agrupados; `Modal.tsx` deja que el pie de cualquier modal baje a una segunda línea si no caben. |
| 2026-10-01 | T3 | Las modales de Agencias (crear y editar) llevan la marca que están creando o editando: vista previa en vivo, franja de color, selector de color en círculo. |
| 2026-10-01 | T2 | La modal de liquidar un comisionista, rediseñada con el mismo lenguaje visual que el resto de la app. |
| 2026-10-01 | T1 | El calendario de una fecha, dentro de cualquier modal, deja de quedar recortado por el scroll: se pinta por un portal, no por posición CSS relativa al campo. |
