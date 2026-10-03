# Tareas — Spec 008

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-03).** Hechas T1 a T4, por confirmar en pantalla. Queda subir los textos de 10 px a 12 px, viéndolos.

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

## T2 · `Combobox` conectado a su etiqueta `[~]`

`Combobox` (`Form.tsx`) ahora es un combobox ARIA: `role="combobox"`, `aria-expanded`,
`aria-controls` hacia su lista (`role="listbox"`, opciones con `role="option"` y `aria-selected`),
`aria-autocomplete="list"`, Escape cierra la lista, y recibe `id`, `aria-invalid` y `aria-describedby`
de `FormField` (registrado junto a `Input`, `Select`…). El foco usa `focus-visible`. **Límite:** solo
queda conectado con su etiqueta cuando es el hijo directo de un `FormField`; los que van envueltos en
un `<div>` con un icono (proveedor, tarjeta en los formularios de producto) siguen sin ella. Tampoco
tiene navegación con flechas: las opciones se alcanzan con Tab.

## T3 · Emojis usados como iconos `[x]`

Sustituidos por iconos de `lucide-react` (con `aria-hidden`, junto a un texto que ya dice lo mismo): el
⚠️ de los avisos de longitud mínima de siete formularios de producto y de `Config.tsx`, ✈️/🚌 del tipo
de transporte (`PlanForm`, `ConfigForms`; en el `<option>` solo el texto, porque un `<option>` no admite
iconos), 🔗 del paso 2. Sin emoji, porque el texto ya dice el resultado: ✅/❌ y ✉ de `Sales.tsx`, 📦 del
`title` de un vuelo de paquete ("Paquete: …"), y "Check-in ✓" pasa a "Check-in realizado". Quedan solo
las dos ★ del confeti (decorativas).

## T4 · Texto por debajo de 10 px `[~]`

Los 28 usos de `text-[8px]` y `text-[9px]` pasan a `text-[10px]`: ya no hay texto de menos de 10 px.
**No se subieron** los 108 de `text-[10px]` (etiquetas en mayúscula de pantallas densas) a los 12 px que
marca la guía: cambia el diseño y hay que verlo en pantalla antes. Pendiente de decidir viéndolo.

**Comprobado (T2–T4):** `tsc` limpio, `vite build` correcto. **Por ver en pantalla:** los avisos de los
formularios (el icono junto al texto), el tipo de transporte de un plan, y el calendario de vuelos con el
texto de 10 px (por si algún chip se desborda).

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-03 | T2–T4 | `Combobox` como combobox ARIA, emojis por iconos de lucide, y ni un texto por debajo de 10 px. |
| 2026-10-03 | T1 | Auditoría con la skill `ui-ux-pro-max`: campos conectados a su etiqueta y su error, 7 botones con nombre, foco visible por teclado, movimiento reducido global. |
