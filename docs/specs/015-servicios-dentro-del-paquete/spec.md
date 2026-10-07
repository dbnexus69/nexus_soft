# Spec 015 — Servicios dentro del paquete en el voucher

**Estado:** implementada (2026-10-06), pendiente de probar el PDF en pantalla · **Rama:** `feat-dbmoon`

Este documento dice **qué** tiene que pasar y **cómo se comprueba**. El *cómo* está en
`plan.md`; el reparto en tareas, en `tasks.md`.

## Problema

En el asistente, un servicio se puede vincular a un paquete de la misma venta ("Vincular a
Paquete"). El vínculo se guarda (`detalle_venta.parentDetalleId`), pero la lectura de la
venta solo colgaba del paquete las categorías marcadas como hijos (`canBeChild`), que eran
tiquetes, hoteles y seguros. Los demás vinculados **no salían en ningún sitio**: ni dentro del
paquete ni como servicio suelto, ni en el voucher ni en el detalle de la venta.

Caso que lo mostró: en la venta 603 de DB Nexus (paquete y dos tours), los tours estaban
guardados pero no aparecían en el voucher.

## Qué será posible al terminar

1. Un servicio vinculado a un paquete sale **dentro de ese paquete** en el voucher, en la
   sección de su categoría (y con su bloque de vuelo, si es un tiquete).
2. Vale para las **catorce** categorías que el asistente deja vincular: todas salvo el propio
   paquete.
3. Un servicio sin vincular sigue saliendo en su sección, como antes.
4. Los tours muestran nombre y fecha y hora.

## Criterios de aceptación

| # | Criterio | Cómo se comprueba |
|---|---|---|
| C1 | Un tour vinculado sale debajo de su paquete | Venta 603: la definición del voucher contiene "Tour incluido en" con los dos tours |
| C2 | Cada una de las 14 categorías vinculadas sale debajo de su paquete | Prueba con datos ficticios: un hijo por categoría, 14/14 |
| C3 | Un servicio sin paquete no cambia de sitio | `pnpm test:voucher` sin fallos |
| C4 | Los vuelos no se alteran por el cambio del catálogo | `pnpm test:vuelos-api` sin fallos |
| C5 | El PDF guardado en caché no sobrevive al cambio de diseño | `PLANTILLA_VERSION` sube (ver decisión 3) |

## Decisiones tomadas

- **Todo es hijo del paquete, salvo el paquete.** Se alinea el catálogo con lo que el
  asistente permite. La alternativa (limitar el vínculo solo a tiquetes, hoteles y seguros)
  se descartó: el asesor puede vincular cualquiera, y lo que se guarda tiene que leerse.
- **Los hijos no salen en su lista de primer nivel.** Un tour vinculado no aparece en
  "tours sueltos". Es el mismo criterio que ya tenían los vuelos y hoteles de un paquete.
- **La versión de la plantilla sube a 4.** El caché del voucher se indexa por el contenido de
  la venta, que no cambia al cambiar el diseño. Sin subir la versión se servía el PDF viejo.

## Pendiente

- **PDF visto en pantalla.** Las pruebas comprueban la definición del documento, no el PDF
  impreso.
- **Tours de la venta 603 sin nombre.** Se guardaron antes del campo de nombre. Hay que
  volver a capturarlos para que el voucher los nombre.
- **Detalle de la venta.** No se ha comprobado que la pantalla de detalle muestre los hijos
  dentro del paquete con el nuevo catálogo.

## Fuera de alcance

- Mover un servicio de un paquete a otro desde la venta ya registrada (hoy solo se define en el
  asistente).
