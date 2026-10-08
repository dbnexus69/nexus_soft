# Spec 016 — Filtros del módulo de ventas, sin Siigo

**Estado:** implementada · **Rama:** `feat-bayrol`

## Problema

- Cada venta registrada abría una modal que mandaba a facturar en Siigo, y la cabecera de Ventas tenía un
  botón "S" con un enlace a Siigo. La agencia no factura desde ahí.
- Los filtros del listado no se validaban:
  - Un estado fuera del enum (`?status=foo`) llegaba al SQL como `?::"SaleStatus"` y respondía **500**.
  - Una búsqueda no tenía tope, y cada tecla lanzaba una petición.
  - Las fechas no eran días de Bogotá: "desde" se leía como medianoche UTC (las 19:00 del día anterior en
    Bogotá) y "hasta" como `AAAA-MM-DDT23:59:59` en la zona del servidor. Una venta de las 22:00 del 7 salía
    al filtrar el 8.
  - Un rango al revés devolvía un 422 que la pantalla no enseñaba.

## Criterios de aceptación

| # | Criterio | Cómo se comprueba | Estado |
|---|---|---|---|
| C1 | Registrar una venta no abre ninguna modal de Siigo, y Ventas no tiene el botón "S" | En pantalla | hecho, falta confirmar en pantalla |
| C2 | Un filtro inválido es un 422 que nombra el campo | `test:ventas-filtros`: estado, búsqueda de 101, rango al revés, fecha inválida, id no numérico, orden fuera de lista, búsqueda de la cartera | cumplido |
| C3 | Las fechas son días de Bogotá, los dos incluidos | `test:ventas-filtros`: la venta de las 22:00 del 7 sale el 7 y no el 8 | cumplido |
| C4 | La pantalla no deja elegir un rango al revés y explica por qué | `DatePicker` con `min`/`max`, aviso debajo de las fechas con `aria-describedby` | hecho, falta confirmar en pantalla |
| C5 | La búsqueda espera a que se deje de escribir y no pasa de 100 caracteres | 350 ms de espera, `maxLength` 100 en el listado y la cartera | hecho, falta confirmar en pantalla |
