# Spec 008 — Accesibilidad e interacción de la interfaz

**Estado:** en ejecución · **Rama:** `feat-bayrol` · **Herramienta:** skill `ui-ux-pro-max`
(`.claude/skills/ui-ux-pro-max`, solo la skill principal; auditada el 2026-10-03: sin red, sin
ejecutables, solo Python estándar sobre sus CSV).

## Qué se quiere

Que la aplicación cumpla las reglas críticas de la guía de la skill —accesibilidad e interacción,
prioridades 1 y 2— sin cambiar su estilo visual: cada campo anuncia qué es y su error, cada botón
tiene nombre, el foco del teclado se ve, y quien pide "reducir movimiento" no recibe animaciones.

## Cómo se comprueba

Por código (sin navegador, regla de `CLAUDE.md`): `tsc`, `vite build`, y una búsqueda estática de
botones de solo icono sin nombre y de `outline-none` sin reemplazo. En pantalla, con teclado: Tab
recorre la app con el anillo visible; un lector de pantalla lee la etiqueta de cada campo y su error.

## Fuera de alcance

Rediseñar el estilo o la paleta; el sistema de diseño de la skill (`--design-system`) es para
productos nuevos, y la app ya tiene el suyo.
