# Plan — Spec 034

1. **Inventario (T1).** Por cada ruta de escritura (`routes/*.js`: `post`/`put`/`patch`), anotar qué devuelve hoy el
   servicio, qué lee la pantalla de esa respuesta (`src/api/*.ts` → contexto/hook → componente) y qué sobra. Sale una
   tabla en `tasks.md`; nada se cambia en esta tarea.
2. **Un ayudante, no uno por servicio.** Si el inventario confirma el patrón de la 033 (`CAMPOS_DE_RESPUESTA` en
   `responsables.service.js`), sacarlo a `utils/respuestaMinima.js`: `soloLoPedido(ficha, cuerpo, mapa)` → `{ id, …}`.
   Solo si lo usan al menos dos servicios; si no, se queda en cada uno.
3. **Recurso por recurso (T2…).** En cada uno, en este orden: el servicio responde lo mínimo; el tipo de `src/api/*.ts`
   pasa a `Partial<…> & { id }`; el contexto o hook mezcla con la fila; una prueba compara las claves. Primero los que
   llevan datos personales: usuarios, clientes, comisionistas.
4. **Pruebas con base** (`test:aislamiento-api`, `test:clientes-destinos`, `test:voucher`, `test:vuelos-api`), las corre
   el usuario.
