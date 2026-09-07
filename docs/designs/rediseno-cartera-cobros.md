# Rediseño de la gestión de créditos y cobros

Pestaña "Cartera" de Ventas (`CreditDashboard.tsx`, 278 líneas) y su endpoint
`GET /sales/credit`.

## Estado actual, medido

La cartera real hoy, con la consulta ya corregida (commit `63e7b52`):

| Tramo | Pendiente |
|---|---|
| Vencido | 4.600.000 |
| Próximos 7 días | 0 |
| Más adelante | 12.191.667 |
| **Sin fecha de vencimiento** | **1.250.000** (1 venta) |
| Total | 18.041.667 |

Mora máxima: **38 días**. Dos clientes en cartera.

Ese "sin fecha" es un hallazgo, no una curiosidad: una venta a crédito sin
`fecha_vence_credito` **no se puede cobrar por construcción**. No entra en
ningún tramo de antigüedad, no puede estar vencida, no aparece en ningún
filtro por urgencia y nunca sube a la parte alta de la lista. Son 1.250.000
que el sistema no sabe reclamar.

## Lo que ya está corregido

El commit `63e7b52` arregló los números, que estaban mal antes que el diseño:

- Cobro y vencimiento eran un solo enum, y `partial` se evaluaba antes que
  `overdue`: un abono parcial tapaba la fecha. 4.600.000 de mora se reportaban
  como cero y el cliente salía en naranja en vez de rojo.
- El filtro por estado se aplicaba sobre la página ya traída, así que
  `?status=overdue` devolvía cero filas diciendo `meta.total: 2`, y paginando
  de una en una **todas** las páginas salían vacías.
- Los contadores de los chips no sumaban el total: los clientes con
  vencimiento a más de 7 días no entraban en ninguno.
- `nextDueDate` era un `MIN` sobre todos los créditos, liquidados incluidos.
- `activeCredits` contaba los liquidados.

Esto es la base sobre la que se rediseña. Sin ello, cualquier pantalla nueva
mostraría bien unos números equivocados.

## El problema del diseño actual

No es que sea feo: es que **no responde a la pregunta que se le hace**. Quien
abre esta pantalla quiere saber *a quién llamo hoy y cuánto le pido*.

**Es un informe pasivo.** No se puede hacer nada desde aquí. Registrar un cobro
exige salir a la pestaña de lista, buscar la venta, abrir el modal de **edición**
y registrar el pago ahí (`Sales.tsx:624`). La pantalla de cobros no cobra.

**La fila no dice lo que hace falta para llamar.** Muestra el pendiente total y
una fecha. No dice cuánto está vencido —el número que se menciona en la
llamada—, ni cuántos días de mora lleva.

**Cuatro colores compiten.** Rojo, naranja, amarillo y el primario, todos
saturados y todos a la vez. Si todo está coloreado, nada es urgente. La mora,
que es lo único verdaderamente urgente, no destaca sobre lo demás.

**Decoración donde debería haber información.** Un icono `CreditCard` de 48px
en un cuadrado redondeado se repite idéntico en cada fila: el mismo icono para
todos los clientes, ocupando el lugar más visible de la fila y sin distinguir
nada.

**Dos modelos de scroll peleando.** La lista tiene `max-h-[500px]` con scroll
interno *y además* un paginador debajo.

**El panel lateral duplica la fila.** Al hacer clic aparece a la derecha una
segunda columna con cuatro cajas grises iguales que repiten cifras que ya
estaban en la fila, y obliga a mover la vista a otro sitio de la pantalla.

**Y es el kit de tarjetas SaaS.** Todo en tarjetas redondeadas con la misma
sombra suave, un degradado como adorno en el resumen, rótulos en
MAYÚSCULAS-espaciadas ("CARTERA TOTAL", "Total Pendiente", "Ventas a Crédito")
y metadatos unidos con puntos medios (`fecha · Vence: fecha`). Son los ajustes
por defecto, no decisiones tomadas para esta pantalla.

## Dirección de diseño

**El vocabulario de la cobranza es el del libro mayor y el informe de
antigüedad.** La contabilidad tiene un lenguaje visual propio y fuerte: cifras
alineadas a la derecha con numerales tabulares, filas regladas, tramos de
antigüedad en columnas. Es específico de esta materia y no se parece al kit de
tarjetas. De ahí sale la forma.

**Estructura: una tabla de verdad.** Filas regladas con una sola línea
divisoria, sin tarjeta por fila, sin sombra, sin icono repetido. Numerales
tabulares (`font-variant-numeric: tabular-nums`) para que las columnas de
dinero se puedan comparar de un vistazo, que es el requisito tipográfico real
de una tabla de importes y justo lo que hoy falta.

**El elemento fuerte, uno solo: la barra de antigüedad.** Cada fila lleva una
barra fina segmentada en vencido / próximo / futuro / sin fecha, proporcional
al dinero. Codifica la forma del riesgo de ese cliente en un objeto que se lee
sin números. Todo lo demás se queda callado. Es el sitio donde se gasta la
audacia; nada más la gasta.

**Color: solo la mora.** El vencido es el único color saturado de la pantalla.
Próximo y futuro son grises con distinto peso. Un cliente en rojo se ve desde
la otra punta de la mesa.

**Tipografía: la que ya tiene la app.** Outfit para titulares y Plus Jakarta
Sans para el cuerpo, que es la identidad existente. Esta pantalla debe
pertenecer al producto, no anunciar que es nueva. Lo que cambia es el ajuste:
escala clara, numerales tabulares en dinero, y ni un rótulo en mayúsculas.

**La fila se despliega en su sitio.** En vez del panel lateral, la fila se abre
hacia abajo y muestra los créditos individuales del cliente. El ojo se queda
donde hizo clic. Es además el patrón del detalle de venta (`ServiceRow`), que
ya está en el producto y funcionando.

**La pantalla cobra.** Cada crédito del desplegable tiene su acción de cobro,
que abre el registro de pago sobre esa venta. Sin salir de la pantalla, sin
pasar por el modal de edición.

### Croquis

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Cartera            18.041.667 por cobrar        4.600.000 vencidos          │
│                     de 2 clientes                mora máxima 38 días         │
├──────────────────────────────────────────────────────────────────────────────┤
│  [buscar cliente, documento o venta]      Vencidos 1 · Próximos 0 · Al día 1 │
├──────────────────────────────────────────────────────────────────────────────┤
│ Cliente               Créditos      Vencido    Por vencer      Total   Mora  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Bayrol Muñoz                  5   4.600.000    9.920.000  14.520.000  38 d   │
│ ████████░░░░░░░░░░░░░░░░░░░░░░                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Dario Luna                    1           —    3.521.667   3.521.667    —    │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                                              │
└──────────────────────────────────────────────────────────────────────────────┘

Fila desplegada:

├──────────────────────────────────────────────────────────────────────────────┤
│ Bayrol Muñoz                  5   4.600.000    9.920.000  14.520.000  38 d   │
│ ████████░░░░░░░░░░░░░░░░░░░░░░                                              │
│                                                                              │
│   Venta 17   venció el 31 jul       3.700.000 de 4.000.000        [Cobrar]   │
│   Venta 18   venció el 31 jul         900.000 de 1.900.000        [Cobrar]   │
│   Venta 29   vence el 30 sep          470.000 de   470.000        [Cobrar]   │
│   Venta 38   vence el 30 ago 2027   8.200.000 de 14.650.000       [Cobrar]   │
│   Venta 39   sin fecha de vencimiento 1.250.000                   [Cobrar]   │
│              └ añadir fecha para poder reclamarla                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

Alineación: el nombre a la izquierda, todo el dinero a la derecha con numerales
tabulares. La cabecera lleva las dos cifras que importan y nada más; el resto
de los totales viven en la tabla, donde se pueden comparar.

La venta sin fecha se señala en el desplegable con la acción que la arregla.
Una pantalla de cobros que detecta una deuda que no puede reclamar debe decirlo
donde se puede corregir.

## Backend

`POST /sales/:id/payments` ya sirve para cobrar y ya es correcto (commit
`8006dfa`): no hace falta un endpoint nuevo para la acción. Lo que falta son
datos.

### 1. Tramos de antigüedad en la respuesta

La barra no se puede dibujar hoy: la fila trae `overdueAmount` y
`pendingAmount`, y falta el desglose intermedio. Añadir al CTE de
`getCreditPortfolio`:

```
dueSoonAmount    -- vence en los próximos 7 días
futureAmount     -- vence más adelante
undatedAmount    -- sin fecha de vencimiento
daysOverdue      -- días de mora del crédito más atrasado
```

Invariante que debe cumplirse y conviene comprobar:
`overdueAmount + dueSoonAmount + futureAmount + undatedAmount == pendingAmount`.

Trampa comprobada: `fecha_vence_credito` es `DateTime?`, así que
`CURRENT_DATE - fecha_vence_credito` da un `interval` y no castea a integer.
Hay que escribir `CURRENT_DATE - fecha_vence_credito::date`.

### 2. `GET /sales/credit/:clientId`

El desplegable necesita los créditos de un cliente. Hoy el panel lateral llama
a `listSales({ clientId, perPage: 50 })` y filtra en el navegador
(`CreditDashboard.tsx:79`): se trae la venta entera con todos sus productos
para leer cuatro campos, y se corta a 50 sin mirar `meta.totalPages`.

Colección e ítem del mismo recurso, que es lo que corresponde: `/sales/credit`
devuelve el resumen por cliente y `/sales/credit/:clientId` el detalle de uno,
con sus créditos ya clasificados por el **mismo** SQL que la lista. Una sola
definición del estado, no dos.

Ojo con el orden de declaración: la ruta literal `/credit` ya existe
(`sales.routes.js:20`) y `/credit/:clientId` debe ir junto a ella, antes de
`/:id`.

### 3. Ordenación

Hoy es fija (`overdueAmount DESC, nextDueDate ASC`). Una tabla con columnas de
dinero invita a ordenar por ellas: `?sortBy=overdue|pending|dueDate|name`
con lista blanca, como ya hace `listSales`.

### 4. Fuera de alcance, anotado

`GET /sales/:id` hace `parseInt` del parámetro y con un id no numérico devuelve
**500** en vez de 400. Lo encontré al equivocarme de ruta: `/sales/credit-portfolio`
cae en `/:id`, `parseInt` da `NaN` y Prisma revienta. Son **24 sitios** en 6
controladores, así que el arreglo correcto es un middleware de validación
aplicado en los routers, y eso es un trabajo con su propio alcance.

## Fases

**Fase 1 — datos que faltan.** Los cuatro tramos y `daysOverdue` en
`getCreditPortfolio`, con la comprobación del invariante contra la base.
Sin frontend todavía. *Verificable:* los cuatro tramos suman el pendiente en
los dos clientes, y `daysOverdue` da 38 para Bayrol.

**Fase 2 — `GET /sales/credit/:clientId`.** El detalle de un cliente con sus
créditos, clasificados por el mismo SQL, paginado. *Verificable:* devuelve las
5 ventas de Bayrol con sus estados, y un cliente sin crédito da 404.

**Fase 3 — la tabla.** Sustituir la lista de tarjetas por la tabla reglada con
numerales tabulares y la barra de antigüedad. Un solo modelo de scroll: se
quita el `max-h-[500px]` y manda el paginador. *Verificable:* la mora se
distingue a un metro de la pantalla, y las columnas de dinero se alinean.

**Fase 4 — el desplegable y el cobro.** La fila se abre en su sitio con los
créditos del cliente y el botón de cobro sobre `POST /sales/:id/payments`.
Al cobrar, la fila y la cabecera se refrescan. *Verificable:* se registra un
cobro sin salir de la pantalla y las cifras se mueven.

**Fase 5 — ordenación y el aviso de las ventas sin fecha.**

## Decisiones que hacen falta antes de la fase 3

1. **Los tramos.** Propongo vencido / 7 días / más adelante, que es lo que ya
   usan los filtros. La cobranza suele trabajar con 30/60/90 días de mora. ¿Con
   cuáles trabajas?
2. **Las ventas sin fecha de vencimiento.** ¿Se corrigen poniéndole fecha a la
   venta 39, o el aviso permanente en la pantalla es suficiente? Si un crédito
   puede nacer sin fecha, conviene decidir si eso debería impedirse al vender.
3. **Quién cobra.** `POST /sales/:id/payments` pide `sales.edit`. ¿Debe poder
   cobrar quien no puede editar una venta? Hoy son el mismo permiso.
