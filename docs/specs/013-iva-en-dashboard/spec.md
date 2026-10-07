# Spec 013 — IVA del periodo en el dashboard

**Estado:** implementada (2026-10-06), pendiente de probar en pantalla · **Rama:** `feat-dbmoon`

Este documento dice **qué** tiene que pasar y **cómo se comprueba**. El *cómo* está en
`plan.md`; el reparto en tareas, en `tasks.md`.

## Problema

El IVA de cada venta se calcula y se guarda (19% sobre la ganancia, `saleTotals.js`), pero
ninguna pantalla lo suma. Para saber cuánto IVA se ha causado en un periodo había que
sumar ventas a mano. El dashboard ya tiene un calendario de rango y una modal de detalle
("Por cobrar"), así que el IVA tiene que vivir ahí, con el mismo rango.

## Qué será posible

1. En el dashboard, una cifra **"IVA del periodo"** que sigue el calendario: al cambiar el
   rango, cambia el IVA.
2. Al hacer clic en esa cifra, una modal con el total de IVA del periodo, el número de
   ventas, el total vendido y la lista de esas ventas con su IVA, paginada.
3. Un asesor con alcance `own` ve solo el IVA de sus ventas.

## Criterios de aceptación

| # | Criterio | Cómo se comprueba |
|---|---|---|
| C1 | El IVA del rango es la suma del `iva_total` de las ventas vigentes del rango | Prueba por la API contra la base: 3 ventas de 95 = 285 |
| C2 | Las ventas anuladas y borradas no suman | Anular una venta; no aparece en el total ni en la lista |
| C3 | La lista se pagina y los totales son del rango entero, no de la página | `page=2&perPage=2` devuelve 1 fila y `meta.totals` no cambia |
| C4 | Un rango sin ventas devuelve 0 y una lista vacía | Rango de 2020 |
| C5 | Un asesor con alcance `own` solo ve sus ventas | Su total es el IVA de su única venta |
| C6 | Sin sesión, 401 | Petición sin token |
| C7 | La cifra del dashboard y la de la modal salen del mismo rango | Ambas reciben `dateFrom`/`dateTo` de `paramsDeFecha()` |

## Decisión tomada

Cuentan **todas las ventas vigentes del rango**, pagadas o no: el IVA se causa al registrar
la venta. La alternativa (solo lo cobrado) se descartó a propósito; si el contador necesita
el IVA por cobrar, es un endpoint aparte.

## Fuera de alcance

- Refrescar la cifra con el intervalo de 5 minutos del dashboard (hoy se recarga al cambiar
  el rango o al recargar la página).
- Exportar la lista a Excel o PDF.
- Desglosar el IVA por categoría de producto.
