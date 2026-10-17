# Tareas — Spec 019

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

### T1 · Alcance en el servicio y el controlador `[x]`
Pasos 1–2. **Comprobado:** `check:prisma`.

### T2 · Prueba `[x]`
Paso 3. **Comprobado:** `pnpm test:aislamiento-api` en verde con 7 casos nuevos (cliente ajeno 404 al leer, 403 al
editar, al cambiar destinos y al desactivar; el propio 200 al leer y al editar; el admin sigue leyendo el del asesor).

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-17 | — | Spec escrita tras la auditoría de las specs 017/018. |
| 2026-10-17 | T1–T2 | `soloLosSuyos` + `comprobarQueEsSuyo`, como en ventas: 404 al leer, 403 al escribir; `test:aislamiento-api` en verde. |
