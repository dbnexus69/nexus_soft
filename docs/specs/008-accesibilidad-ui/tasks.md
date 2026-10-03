# Tareas — Spec 008

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-03).** Hecha T1 (por confirmar en pantalla). Pendientes T2 a T4.

## T1 · Lo crítico: campos, nombres, foco y movimiento `[~]`

Auditoría estática contra las reglas de prioridad 1–2 de la skill, y arreglo en los componentes
compartidos (un sitio por regla, no pantalla por pantalla):

- **Campos** (`components/ui/Form.tsx`, `FormField`, 314 usos): la etiqueta no estaba conectada a su
  campo y el error no se anunciaba. Ahora `htmlFor`/`id` (con `useId`), `aria-invalid`,
  `aria-describedby` hacia el error y `role="alert"` en el error. Solo con los controles que pasan el
  `id` al elemento nativo (`Input`, `CurrencyInput`, `Select`, `Textarea`, nativos); `Combobox` queda
  como estaba (ver T2).
- **Botones de solo icono sin nombre:** de 142 botones, 7 no tenían nombre accesible: cerrar de
  `Modal.tsx` (todas las modales), abrir y cerrar el menú, cerrar el asistente de venta, modo oscuro
  (×2) y cerrar sesión (los tres últimos solo con `title`). Ahora llevan `aria-label`.
- **Foco visible:** los botones (`Button.tsx`) mostraban un halo de 4 px al 15 % de opacidad —o gris
  claro al 50 %—, por debajo del 3:1 que pide la guía. Ahora un anillo sólido de 2 px separado del
  botón, solo con teclado (`focus-visible`), en el color de la marca (`highlight` en oscuro). Y tres
  campos quitaban el contorno sin reemplazo (`Itineraries.tsx` ×2, `Companies.tsx`).
- **Movimiento reducido:** una regla global en `index.css` (`prefers-reduced-motion: reduce`) anula
  animaciones, transiciones y escalados; antes solo 9 componentes lo respetaban.

**Comprobado:** `tsc` limpio, `vite build` correcto. **Por ver en pantalla:** recorrer con Tab (el
anillo se ve en botones, no al hacer clic), y pulsar la etiqueta de un campo (lleva al campo).

## T2 · `Combobox` conectado a su etiqueta `[ ]`

No recibe `id` ni atributos ARIA; los selectores de proveedor, tarjeta, aerolínea… siguen sin
etiqueta conectada. Hay que pasarle `id`, `aria-describedby` y el patrón `combobox` (`role`,
`aria-expanded`, `aria-controls`).

## T3 · Emojis usados como iconos `[ ]`

~30 sitios: ⚠️ en los avisos de los formularios de producto, ✈️/🚌 en el tipo de transporte del plan
y en gestión interna, ✅/❌ en los avisos de `Sales.tsx`, 🔗 en el paso 2. La guía pide iconos SVG
(la app ya usa `lucide-react`): se ven distinto según el sistema y los lectores de pantalla los leen
("señal de advertencia").

## T4 · Texto por debajo de 10 px `[ ]`

28 usos de `text-[8px]`/`text-[9px]` (sobre todo `TicketForm.tsx`, `Step2Products.tsx` y el
calendario de `Itineraries.tsx`), y 108 de `text-[10px]`. La guía marca menos de 12 px como
antipatrón para texto que hay que leer. Subirlos cambia el diseño de pantallas densas: hay que
verlo en pantalla antes, por eso no se hizo junto con T1.

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-03 | T1 | Auditoría con la skill `ui-ux-pro-max`: campos conectados a su etiqueta y su error, 7 botones con nombre, foco visible por teclado, movimiento reducido global. |
