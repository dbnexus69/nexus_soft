# Plan — Spec 016

**1. Siigo fuera.** Sin modal tras el alta ni botón en la cabecera de `Sales.tsx`; nada más dependía de ello.

**2. Una sola definición de "día de Bogotá".** `rangoDeDias` y `diaDeColombia` pasan de `flights.service.js` a
`utils/fechas.js` y los usan vuelos y el listado de ventas (`ventasListado.js`: `creado_at >= desde AND <
hasta`). El frontend manda "hasta" como `AAAA-MM-DD`; el formato anterior con hora se sigue aceptando.

**3. Validación por query en el backend** (`schemas/sales.schema.js`, guía de diseño de API): `listSalesQuerySchema`
en `GET /sales` (búsqueda ≤ 100, estado del enum, fechas válidas y desde ≤ hasta comparadas como días de Bogotá,
ids numéricos, `sortBy`/`sortOrder` de una lista) y `creditQuerySchema` en `GET /sales/credit` (búsqueda ≤ 100;
estado, tramo y orden ya los valida su servicio). Un parámetro vacío es "sin filtro". Error: 422 con
`error.details: [{ field, message }]`.

**4. Validación en la pantalla** (guía de UI): el error, debajo del campo y enlazado con `aria-describedby`; la
búsqueda espera 350 ms y se recorta; el selector y la búsqueda llevan etiqueta accesible; un rango al revés no
se pide; el error de la API se enseña sobre la tabla en vez de "Request failed".
