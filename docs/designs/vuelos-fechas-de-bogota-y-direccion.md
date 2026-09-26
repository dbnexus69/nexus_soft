# Vuelos: días de Bogotá, dirección deducida y alta validada

**Estado:** implementado · **Rama:** `feat-dbmoon` · Detalle de ejecución en
[`spec 004`](../specs/004-vuelos-y-checkin/spec.md).

## Problema

Tres decisiones de diseño estaban mal o sin tomar, y las tres se veían igual en pantalla —"el
vuelo no está donde debería"—:

1. **Qué es "un día" para un vuelo.** Las salidas se guardan como instantes (`timestamptz`) y la
   agencia trabaja en Bogotá (UTC-5, sin horario de verano). El navegador mandaba el mes como
   `toISOString()` de fechas locales; un vuelo a las 23:30 de Bogotá es del día siguiente en UTC, así
   que aparecía al filtrar otro día y desaparecía del suyo. El filtro de un solo día
   (`dateFrom = dateTo`) devolvía cero filas porque el fin era el mismo instante que el inicio.
2. **Cuál tramo es ida y cuál regreso.** No hay columna: se suponía que solo el último tramo de un
   `round_trip` era regreso. Con una ida de 3 tramos y una vuelta de 1 salía `ida, ida, regreso,
   regreso`.
3. **Qué se acepta al vender.** Un aeropuerto desconocido se guardaba como `UNK` (creado en el
   catálogo compartido, visible para todas las agencias) y un plan de equipaje enviado como texto
   se perdía.

## Decisiones

### Los días son de Bogotá, con fin exclusivo

`rangoDeDias` convierte `AAAA-MM-DD` (o un instante, tomando su día de Bogotá) en `[desde, hasta)`:
`desde` es la medianoche de Bogotá del primer día y `hasta` la del día siguiente al último. El
filtro es `salida >= desde AND salida < hasta`. Con fin exclusivo no hay que inventar "el último
milisegundo del día", y un día suelto es un rango de 24 horas. El frontend manda días, no
instantes: el mes visible se identifica con dos cadenas y no depende de la zona de quien mira.

### La dirección se deduce al leer

Se pidió no tocar la base. La regla: en un `round_trip`, ordenar los tramos por salida y cortar en
el **mayor hueco** entre la llegada de un tramo y la salida del siguiente; lo anterior es ida y
lo posterior es regreso. Las escalas duran horas; la estancia, días.

Descartado:
- **Columna `sentido` en `tramos_vuelo`.** Es lo correcto a largo plazo (elimina la heurística) pero
  es una migración en una base compartida por dos ramas, y exige rellenar lo ya vendido con esta misma
  heurística. Queda como salida si aparece el caso que la rompe.
- **"El último tramo es el regreso".** Es lo que había; solo vale para ida y vuelta simples.
- **Pedir al vendedor que marque el sentido de cada tramo.** El asistente ya distingue `legs` y
  `returnLeg`; la información existe al vender, pero no se guardaba.

**Límite conocido:** falla si una escala dura más que la estancia en destino (p. ej. 3 días de
escala y 2 de estancia). Es raro y el error es solo de etiqueta.

### El alta rechaza lo que no existe

`_validarTiquetes` comprueba, antes de abrir la transacción y contra los catálogos ya precargados,
cada aeropuerto (código en mayúsculas) y cada plan de equipaje (`"<aerolínea> - <tarifa>"` sin
distinguir mayúsculas, o el id). Responde 422 con `details` por campo
(`ticketData.0.legs.1.origin`). Se eligió rechazar antes que guardar un comodín porque el comodín
convertía un error de tecleo en un dato falso que nadie corrige, y porque escribía en una tabla que
comparten todas las agencias.

### El resumen del producto se recalcula bajo bloqueo

`prod_tiqueteria.checkin_status` es un agregado de sus tramos. Dos check-ins simultáneos en tramos
distintos leían cada uno el estado del otro **antes** de que se confirmara, y ambos concluían
"falta uno". `recalcularProducto` empieza con `SELECT … FOR UPDATE` sobre la fila del producto,
así que la segunda transacción espera a la primera y ve su resultado. Medido: con cuatro tramos
del mismo tiquete y cuatro peticiones a la vez, el producto quedó `realizado` en 3 de 3 intentos
(antes, en 0 de 3).

## Qué no cubre

- Cancelar el vuelo de un paquete: `prod_planes` no tiene columnas de motivo ni fecha.
- Más de `TOPE_PLANES` paquetes en el rango: se leen con tope y el panel de estadísticas no los
  cuenta.
