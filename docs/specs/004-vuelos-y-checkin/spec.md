# Spec 004 — Vuelos y check-in

**Estado:** en ejecución · **Rama:** `feat-dbmoon` · **Relacionada:** [`002-estabilizacion-multi-tenant`](../002-estabilizacion-multi-tenant/spec.md)

Qué tiene que pasar y cómo se comprueba. El *cómo* está en `plan.md`; lo hecho y lo pendiente, en `tasks.md`.

## Problema

Se pidió que el módulo de vuelos (calendario de ida y regreso) y el de check-in mostraran todo
correctamente. Una auditoría del código y una prueba de punta a punta por la API real encontraron:

- **Un aeropuerto que no existe se guardaba como `UNK`** y se creaba en el catálogo compartido; el vuelo salía "UNK - BOG".
- **El plan de equipaje se perdía.** El formulario manda el texto `"<aerolínea> - <tarifa>"` y el servidor lo convertía con `Number()`.
- **Los filtros de fecha se corrían.** El navegador mandaba el mes con `toISOString()` de fechas locales; un vuelo a las 23:30 de Bogotá caía en el día siguiente en UTC y salía al filtrar otro día (y el filtro de un solo día no devolvía nada).
- **La dirección ida/regreso estaba mal** en los multitramo: solo el último tramo era "regreso".
- **La aerolínea mostrada era la del producto**, no la de cada tramo.
- **Los planes terrestres aparecían como vuelos**, y el rango de fechas de los planes se aplicaba en memoria.
- **Carrera:** dos check-ins simultáneos en tramos del mismo tiquete dejaban el producto en `pendiente` con todos los tramos `realizado`.
- **`?search=a&search=b` daba 500.**
- **La pantalla escondía los fallos:** un error de red se veía como "no hay vuelos", el aviso de correo fallido se ignoraba, los avisos de cancelación no se cerraban, la página de pendientes podía quedar fuera de rango, el mes se calculaba con la hora del navegador.
- **El plan de la venta leía columnas que no existen** (`incluye_vuelo`, `regimen_alimenticio`…) y omitía las que sí (los cuatro vuelos, `nro_vuelo`, check-in de ida y regreso), así que el detalle del paquete salía vacío.
- **Tres tarifas del catálogo compartido tenían el texto corrupto** (`BÃƒÂ¡sica`).

## Qué será posible al terminar

1. Crear un tiquete solo con aeropuertos y planes de equipaje que existen; si no, 422 con el campo exacto.
2. Filtrar por un día o un mes y obtener exactamente los vuelos de esos días de Bogotá.
3. Ver cada tramo con su dirección, su aerolínea y su estado de check-in correctos, y el detalle del paquete con sus vuelos y los productos que incluye.
4. Que el estado del producto sea siempre el que resulta de sus tramos, aun con peticiones simultáneas.
5. Que un fallo de carga se vea como fallo (con "Reintentar") y que un correo no enviado se avise.

## Decisiones del equipo

- La dirección ida/regreso **se deduce al leer**; no hay columna nueva (sin tocar la base).
- Un aeropuerto desconocido **se rechaza** (422); ya no hay comodín.
- Se corrigieron las 3 tarifas corruptas del catálogo compartido, con evidencia antes/después.

## Criterios de aceptación

Los comprueba una prueba por la API real (agencias temporales que se montan y desmontan; 63 comprobaciones):
aeropuerto inexistente → 422 con `ticketData.N.legs.M.origin`; plan de equipaje por texto o por id queda guardado
en producto y tramo; inexistente → 422; minúsculas aceptadas; no se crea `UNK`; ida de 3 tramos y vuelta → `ida,ida,ida,regreso`;
23:30 sale con su día de Bogotá y solo en el día correcto; plan terrestre no aparece; `pendiente+realizado+cancelado=total`;
carrera de 4 check-ins simultáneos → producto `realizado` en 3 de 3 intentos; doble `search` no da 500; otra agencia no ve ni opera vuelos ajenos.

## Fuera de alcance / límites conocidos

- **Los vuelos de un paquete no se pueden cancelar** (`prod_planes` no tiene columnas de motivo/fecha); el servidor lo rechaza con un mensaje claro y la pantalla oculta el botón.
- **La dirección se deduce por el mayor hueco** entre tramos; falla solo si una escala dura más que la estancia.
- Los vuelos de paquete se leen con un tope (`TOPE_PLANES`) y el panel de estadísticas no los cuenta.
- La pantalla **no se ha probado en el navegador**.
