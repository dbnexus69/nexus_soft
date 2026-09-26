# Tareas — Spec 004

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-09-25).** Servidor y pantalla hechos; la pantalla sin probar en el navegador.

## T1 · Servidor de vuelos `[x]`
Rango en días de Bogotá, dirección deducida, aerolínea por tramo, planes terrestres fuera, `viewScope`, bloqueo de fila en el resumen, `search` normalizado. **Comprobado** con la API real: 63 comprobaciones, 0 fallos (la carrera de 4 check-ins simultáneos dio producto `realizado` 3 de 3 veces; antes 0 de 3).

## T2 · Alta de tiquetes validada `[x]`
Aeropuertos y plan de equipaje comprobados antes de la transacción; sin `UNK`. **Comprobado**: 422 con el campo, minúsculas aceptadas, plan por texto y por id guardado en producto y tramo.

## T3 · Detalle de la venta `[x]`
Plan con columnas reales, estado por tramo, ruta multidestino, paquete con vuelos y productos incluidos. `tsc --noEmit` limpio; el JSON del servidor lo comprobó la prueba de la API, el pintado no.

## T4 · Pantalla de itinerarios `[~]`
Ver decisión 9 del plan. `tsc` limpio. **Por confirmar en el navegador:** cambiar de mes (esqueleto), cortar la red (aviso y "Reintentar"), marcar/deshacer un check-in, cancelar con motivo, ver el detalle de un paquete.

## T5 · Catálogo compartido `[x]`
Tarifas 6, 7 y 15 de `politicas_equipaje` corregidas (antes `BÃƒÂ¡sica`, `Ãƒâ€œptima`, `EconÃƒÂ³mica`). Se buscó el mismo daño en aeropuertos, aerolíneas y el resto de columnas de tarifas: no hay más. El aeropuerto DXB, que se sospechaba, está bien.

## Pendientes

- **T6 · Cancelar vuelos de paquete** `[ ]` — exige columnas nuevas en `prod_planes` (migración; afecta a la otra rama).
- **T7 · `TOPE_PLANES` y estadísticas** `[ ]` — paginar los vuelos de paquete y contarlos en el panel.
- **T8 · Pasar la prueba de la API a `backend/tests/`** `[ ]` — hoy vive fuera del repo; montar agencias temporales exige `DIRECT_URL`.
- **T9 · Creación de ventas intermitente** `[ ]` — en 2 de 4 corridas una venta dio 500 o timeout, distinta cada vez (mensaje de Prisma de varias líneas, sin causa aún); cada venta tarda ~6 s contra esta base. Sin diagnosticar.

## La prueba que se queda

Pendiente de T8. Mientras tanto, esto es lo que hace, para poder rehacerla:

1. Levanta un servidor propio en otro puerto con el rol de la aplicación.
2. Crea dos agencias con el servicio real de altas (`verif-vue-a-…`, `verif-vue-b-…`) y entra en cada una.
3. Vende por `POST /sales`: plan de equipaje por texto y por id, uno inexistente, ida y vuelta simple, ida de 3 tramos y vuelta, aeropuerto inexistente y en minúsculas, salida en 30 horas (crítico), salida ayer, salida a las 23:30, paquete con vuelos, paquete con tiquete hijo, paquete terrestre y una venta en la otra agencia.
4. Lee `GET /flights` y `GET /flights/checkins`: dirección y ruta de cada tramo, día y hora de Bogotá, paquete terrestre ausente, filtros de un día y de un rango, contadores (`pendiente + realizado + cancelado = total`, `critico ≤ pendiente`), orden de pendientes.
5. Opera el check-in: registrar, adjuntar y servir el adjunto (con la sesión propia, sin sesión y con la de la otra agencia), revertir, cancelar (motivo corto → 422, con espacios en los bordes se mide recortado), no escribir `cancelado` ni `critico` por el `PUT`, cancelar un vuelo de paquete (400 con mensaje).
6. Lanza cuatro check-ins simultáneos sobre el mismo tiquete, tres veces, y mira el producto en la base.
7. Ataca por id desde la otra agencia (404), ids mal formados (400), estado inválido (400), `?search` doble (sin 500) y anula la venta (sus vuelos salen del calendario y de los contadores).
8. Desmonta lo creado solo si el identificador empieza por `verif-vue-` y borra de `uploads/` los ficheros de prueba por su contenido exacto.

Resultado de la última corrida: **63 correctas, 0 fallos.** Antes de los arreglos: 46 correctas, 11 fallos.

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-09-25 | T5 | Corregidas 3 tarifas corruptas del catálogo compartido. |
| 2026-09-25 | T4 | Pantalla: errores visibles, Bogotá, correo, deshacer check-in. |
| 2026-09-25 | T3 | Detalle: plan con datos reales, estado por tramo. |
| 2026-09-25 | T2 | Alta de tiquetes: 422 en vez de `UNK` y plan de equipaje resuelto. |
| 2026-09-25 | T1 | Servidor de vuelos: 63/63 por la API real. |
