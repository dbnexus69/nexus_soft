# Spec 010 — Calidad y rendimiento (auditoría del 2026-10-03)

**Estado:** en ejecución · **Rama:** `feat-bayrol` · **Origen:** auditoría de funcionalidades, diseño y
arquitectura hecha con la skill `ui-ux-pro-max` (solo lectura del código; sin navegador).

## Qué se quiere

Cerrar lo que la auditoría marcó como "debe arreglarse" (T1–T4, hechas) y ordenar lo que quedó como
"conviene mucho" (T5–T11) para atacarlo con su propia spec cuando toque.

## Cómo se comprueba

Por código: `tsc`, `vite build` (tamaño de los trozos), la integración continua nueva, y las suites existentes.
En pantalla: lo que cada tarea indica en "Por ver".

## Fuera de alcance

Partir `sales.service.js` y `NewSaleWizard.tsx` (T7), el contrato de tipos (T10) y la venta lenta (T5) son
refactores grandes: cada uno merece su spec.
