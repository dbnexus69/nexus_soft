# Tareas — Spec 017

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-17).** Código escrito en servidor y pantalla; migración aplicada; pruebas por la API y de
aislamiento en verde. Falta probar en pantalla (T6–T8).

### T1 · Migración `[x]`
`20261017120000_destinos_de_preferencia`: tabla `cliente_destinos` (RLS `FORCE`, `empresa_id` sin respaldo, clave
ajena simple y compuesta con `ON DELETE CASCADE`, `CHECK orden 1..5`, único `(cliente_id, orden)`, permisos solo
`app_nexus`) y columna `clientes.destino_reciente`; modelo en `schema.prisma`. **Comprobado:** `prisma validate`;
`migrate diff` contra la base trae para esto solo la tabla, sus índices, sus claves y la columna (el resto del diff es
el ruido de siempre). Aplicada por el usuario (`migrate deploy`) y cliente regenerado (`db:generate`), 2026-10-17;
`check:prisma` sin hallazgos. **De paso:** `check:prisma` llamaba a `find`, que en PowerShell es el `find.exe` de
Windows ("Access denied - SRC"); ahora lista con `fs.readdirSync(..., { recursive: true })`.

### T2 · Reglas y validación `[x]`
`utils/destinos.js` (`normalizarDestinos`) y `destinations` en `clients.schema.js` (alta y edición), más
`listClientsQuerySchema` y `destinationsQuerySchema`. **Comprobado:** `test:validaciones` (143, con 8 casos nuevos:
recorte, repetido por la última aparición, 5 sí y 6 no, 6 con repetido pasan, largo, campo `destinations.1`).

### T3 · Escritura y lectura `[x]`
`escribirDestinos` (borrar + `createMany` + `destino_reciente`, en una `transaccion`) en alta y edición;
`destinations` y `recentDestination` en lista, detalle y alta. **Comprobado:** `test:clientes-destinos`.

### T4 · Filtro y sugerencias `[x]`
`destination`/`destinationAll` en `listClients` (mismo `where`); `GET /clients/destinations` antes de `/:id`, con
`groupBy` por destino (los más usados primero, 10). **Comprobado:** `test:clientes-destinos`.

### T5 · Pruebas por la API y aislamiento `[x]`
`tests/clientes-destinos-api.js` (`pnpm test:clientes-destinos`, 20 comprobaciones) y `tests/aislamiento.js` (el
destino ajeno no se ve, colgar uno de un cliente ajeno se rechaza, claves compuestas 60 → 61). **Comprobado:** las dos
en verde, corridas por el usuario (2026-10-17).

### T6 · Formulario del cliente `[~]`
`DestinosField.tsx` en `ClientModal.tsx`: sugerencias (`AsyncCombobox`, ahora con `ariaLabel`), "+" y Enter, elegir
una sugerencia la añade, etiquetas con "Quitar X", reciente primero y marcado, contador `n/5`, tope con aviso, 422 de
`destinations*` junto al campo. **Comprobado:** `tsc`. **En pantalla:** añadir, quitar, repetido que pasa a reciente,
tope de 5.

### T7 · Detalle del cliente `[~]`
"Destino de preferencia" en `ClientDetailModal.tsx`: el reciente, "+N" con `aria-expanded` que despliega la lista
numerada (más nuevo primero); "Sin destinos de preferencia" si no hay. **Comprobado:** `tsc`. **En pantalla.**

### T8 · Filtro en la lista `[~]`
`Clients.tsx` + `useClients.ts`: filtro "Destino de preferencia" con sugerencias y espera de 350 ms, y casilla
"Incluir destinos anteriores"; va al servidor. **Comprobado:** `tsc`. **En pantalla.** **Aviso (previo a esta spec):**
la pantalla de clientes pide solo la primera página (10) y filtra el resto en el navegador; el filtro de destino sí
va al servidor, pero también muestra solo los 10 primeros resultados.

### T9 · Documentación `[x]`
`CLAUDE.md` (`test:clientes-destinos`), `backend/CLAUDE.md` (destinos de preferencia), README (lista de specs),
estado de la spec y este archivo.

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-17 | — | Diseño aprobado (texto libre, hasta 5, reciente = último, filtro A, sugerencias de toda la agencia, tabla `cliente_destinos` + `destino_reciente`); spec, plan y tareas escritos. |
| 2026-10-17 | T1 | Migración de datos `20261017130000_unificar_destinos_de_preferencia`: cada destino toma, dentro de su agencia, la escritura limpia de su fila más antigua; repetidos en un mismo cliente se quedan en su última aparición y se renumera `orden`; `destino_reciente` recalculado. Escrita, sin aplicar. |
| 2026-10-17 | T4 | Al probar: "Pereira" salía dos veces en las sugerencias del filtro. `groupBy` agrupa por el texto exacto, así que dos escrituras distintas (mayúsculas, o un carácter invisible de copiar y pegar) eran dos filas. Ahora las sugerencias se juntan por `claveDestino` (sin mayúsculas, NFC, sin caracteres invisibles `\p{Cf}`), y `normalizarDestinos` limpia lo mismo al guardar. `test:validaciones` en verde; sin confirmar contra los datos reales. |
| 2026-10-17 | T3 | Al probar: "pEreira" en otro cliente quedaba como destino distinto de "Pereira". Ahora `escribirDestinos` toma la escritura que la agencia ya tiene (la más antigua, sin mayúsculas). Caso nuevo en `test:clientes-destinos` (20 comprobaciones). |
| 2026-10-17 | T1, T3–T5 | Migración aplicada; `check:prisma`, `test:clientes-destinos` y `test:aislamiento` en verde. |
| 2026-10-17 | T1–T9 | Implementada. `test:validaciones` y `tsc` en verde. Sin aplicar la migración ni correr las pruebas con BD (el clasificador de permisos frenó `migrate deploy`). |
