# Tareas — Spec 030

Leyenda: `[x]` hecho · `[ ]` pendiente

**Estado (2026-10-25).** Implementada y sembrada en las 4 agencias que ya existían
(`Test-agency`, `moon travel co`, `soultrip`, `DB Nexus`): +35 proveedores cada una.

## T1 · Lista + alta de agencia nueva `[x]`

`PROVEEDORES_INICIALES` (21 aerolíneas + 14 cadenas hoteleras) en
`companies.service.js`, sembrada en `create()` junto a los métodos de pago.
`node --check` y `check:prisma` en verde.

## T2 · Script para las agencias que ya existen `[x]`

`prisma/seed-proveedores-iniciales.js` (`pnpm db:seed:proveedores`): entra en el
contexto de cada agencia y agrega los que falten por nombre. Corrido contra la
base: las 4 agencias existentes recibieron los 35, sin duplicar nada.

---

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-25 | — | El usuario pidió alimentar Proveedores con aerolíneas y hoteles. Se consideró hacer la tabla global (como `aerolineas`/`aeropuertos`) porque casi todas las agencias usan los mismos nombres; se descartó por `/brainstorming` — el contacto de un proveedor es la relación comercial de cada agencia, no un hecho objetivo, y cada agencia agrega proveedores propios que no deben verse en las demás. Se optó por una lista inicial propia de cada agencia, mismo patrón que los métodos de pago. |
| 2026-10-25 | T1-T2 | Implementado: lista + alta de agencia nueva, y el script de respaldo para las que ya existen. `node --check` y `check:prisma` en verde; el script no corrido todavía contra la base. |
