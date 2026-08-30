# Retirar la rama `sales` del DataContext

> **Estado: completado.** Los seis pasos se ejecutaron en orden. Al final de este
> documento está el resultado y lo que apareció por el camino.

## Problema

`DataContext.tsx` son 775 líneas con **32 referencias a ventas**: el array `data.sales`,
su `salesLoading`, su caché en localStorage y ocho funciones de mutación. Convive con
`SalesContext`, que hace lo mismo pero paginado y con filtros de servidor.

Dos fuentes de verdad para el mismo recurso. Ya ha costado dos fallos reales:

- El botón de refrescar de `Header`/`Sidebar` llamaba al `fetchSales` del **DataContext**
  mientras la tabla vive en **SalesContext**: en `/sales` el botón no refrescaba la tabla.
  (Corregido.)
- `CommissionAgents` sumaba los acumulados sobre `data.sales`, que solo traía una página.
  (Corregido moviendo el cálculo a SQL.)

Hoy la rama está **casi muerta**, y esa es la oportunidad:

| Pieza | Consumidores fuera del DataContext |
|---|---|
| `data.sales` | **0** |
| `fetchSales` | **0** |
| `salesLoading` | **0** |
| `updateSale`, `deleteSale`, `voidSale` | **0** |
| `registerCreditPayment`, `deleteSalePayment` | **0** |
| `updateSaleReviewStatus`, `settleCommissions` | **0** |
| `addSale` | **1** — `NewSaleWizard.tsx` |

Un solo consumidor vivo. Todo lo demás es código que se mantiene solo a sí mismo:
las mutaciones actualizan `prev.sales` para que nadie lo lea.

## Objetivo

- `SalesContext` es la única fuente de ventas del frontend.
- `DataContext` baja de 775 líneas y deja de exportar nada de ventas.
- Ningún componente puede volver a leer una lista global de ventas por accidente.

## Fuera de alcance

- **Los otros recursos del DataContext** (clients, users, flights, responsables,
  commissionAgents, config). Este trabajo toca solo la rama de ventas.
- **Sustituir los contexts por TanStack Query.** Sigue siendo otra conversación.
- **La caché de clientes.** Se toca solo lo imprescindible para desacoplarla (ver abajo).

## El nudo: la caché acoplada

`salesCache.ts` guarda ventas y clientes **en la misma operación**:

```
saveSalesAndClientsCache(sales, clients)   ← escribe las dos
loadSalesCache()      loadClientsCache()   ← lee cada una por su lado
```

Y `DataContext` la usa cruzada:

```js
// al traer ventas:  guarda las ventas y los clientes que ya tenía
saveSalesAndClientsCache(freshSales, prev.clients);   // línea 192
// al traer clientes: guarda las ventas que ya tenía y los clientes nuevos
saveSalesAndClientsCache(prev.sales, freshClients);   // línea 209
```

Si se borra la rama de ventas sin desacoplar esto, la llamada de la línea 209 pasaría
`undefined` como ventas y **corrompería la caché de clientes**. Es el único punto del
refactor donde un despiste rompe algo que hoy funciona.

## Diseño

Dividir la caché en dos funciones independientes y luego retirar la rama entera:

```
saveSalesAndClientsCache(sales, clients)
        ↓
saveClientsCache(clients)      ← se queda
saveSalesCache(sales)          ← se borra con la rama
```

`addSale` se migra a `SalesContext`, que ya tiene `handleCreateSale` haciendo lo mismo.
`NewSaleWizard` ya importa `useSalesContext` (lo usa para `fetchSales`), así que el
cambio es de una línea en su desestructuración.

## Decisiones y alternativas

| Decisión | Elegimos | Descartamos | Por qué |
|---|---|---|---|
| Dónde vive el estado de ventas | Solo `SalesContext` | Mantener las dos | Dos fuentes de verdad ya causaron dos bugs; la de DataContext no está paginada |
| `addSale` | Migrar a `handleCreateSale` de SalesContext | Dejarlo en DataContext | Es lo único que ata la rama; sin él, todo lo demás se borra sin tocar consumidores |
| La caché | Partirla en dos funciones | Borrarla entera | La de clientes sí se usa y funciona |
| Orden de trabajo | Desacoplar caché → migrar `addSale` → borrar | Borrar y arreglar lo que salte | Cada paso deja la aplicación funcionando y es reversible por separado |

## Riesgos y desconocidos

- **La caché de clientes** (ver el nudo). Se detecta si tras el paso 1 se recarga la
  página y los clientes siguen apareciendo desde caché.
- **`addSale` y `handleCreateSale` no son idénticos**: el del DataContext actualiza
  `prev.sales` y devuelve la venta creada; el de SalesContext refresca la lista con
  `fetchSales()`. Hay que comprobar que el wizard sigue recibiendo la venta creada,
  porque la usa para el mensaje de éxito y el voucher. **Es lo primero que verificar.**
- **`settleCommissions`** vive en la rama de ventas del DataContext pero pertenece a
  comisiones, y `useCommissions` ya tiene su propio `handleCreateSettlement`. Hay que
  confirmar cuál usa `CommissionAgents` antes de borrar nada.
- **Ventana de regresión invisible**: al no haber pruebas automáticas, la comprobación
  es manual. Los cuatro flujos a repasar están en el paso 5.

## Plan de implementación

Cada paso deja la aplicación funcionando y se puede parar ahí.

1. **Partir la caché.** En `salesCache.ts`, añadir `saveClientsCache(clients)` y
   `saveSalesCache(sales)`; dejar `saveSalesAndClientsCache` como envoltorio que llama a
   las dos. En `DataContext`, sustituir las dos llamadas cruzadas (líneas 192 y 209) por
   la función que corresponda.
   *Verificable:* recargar la app con la pestaña Red desactivada y comprobar que
   clientes y ventas siguen apareciendo desde caché.

2. **Comprobar la equivalencia de `addSale`.** Comparar qué devuelve `addSale`
   (DataContext) con `handleCreateSale` (SalesContext) y qué hace el wizard con ese
   valor en `NewSaleWizard.tsx:1272` y alrededores.
   *Verificable:* es un paso de lectura; el resultado decide si el paso 3 necesita
   ajustar `handleCreateSale` antes de migrar.

3. **Migrar `addSale`.** `NewSaleWizard` pasa a usar `handleCreateSale` de
   `useSalesContext` en vez de `addSale` de `useData`.
   *Verificable:* crear una venta por el wizard; aparece en la tabla, sale el mensaje de
   éxito y el voucher se genera.

4. **Borrar la rama.** De `DataContext`: `sales` del estado, `salesLoading`, `fetchSales`,
   `addSale`, `updateSale`, `deleteSale`, `voidSale`, `registerCreditPayment`,
   `deleteSalePayment`, `updateSaleReviewStatus`, `settleCommissions` (si el paso previo
   confirma que no se usa), sus entradas en el tipo del contexto y en el `value`, y los
   imports de `loadSalesCache`/`invalidateSalesCache`.
   *Verificable:* `tsc --noEmit` limpio — cualquier consumidor olvidado sale como error
   de tipos, que es justo la red de seguridad que da TypeScript aquí.

5. **Repaso manual de los cuatro flujos que tocaban esas funciones:**
   crear una venta, editarla, anularla, y registrar y borrar un pago.
   *Verificable:* los cuatro terminan y la tabla queda coherente tras cada uno.

6. **Limpieza final.** Borrar `saveSalesCache` y `loadSalesCache` de `salesCache.ts`, y
   el envoltorio `saveSalesAndClientsCache` si ya no lo llama nadie. Renombrar el archivo
   a `clientsCache.ts`, que es lo único que le queda.
   *Verificable:* `tsc --noEmit` limpio y build limpio.

## Estimación

Los pasos 1–4 son mecánicos y los guía el compilador. El grueso del riesgo está en el
paso 2 (leer y comparar dos funciones) y en el paso 5 (comprobación manual, sin pruebas
automáticas que la cubran).

---

## Resultado

`DataContext.tsx`: **781 → 613 líneas**. Cero referencias a ventas salvo `recentSales`,
que pertenece al dashboard.

Se retiraron el estado `sales`, `salesLoading`, `fetchSales` y las ocho mutaciones
(`addSale`, `updateSale`, `deleteSale`, `voidSale`, `registerCreditPayment`,
`deleteSalePayment`, `updateSaleReviewStatus`, `settleCommissions`), más `AppData.sales`.
`salesCache.ts` pasa a `clientsCache.ts`, que es lo único que le quedaba.

### El nudo de la caché

Se resolvió como estaba previsto, y era peor de lo anticipado: `invalidateSalesCache()`
borraba **también** la caché de clientes. Tras partirla, comprobado que invalidar una
deja la otra intacta en ambos sentidos.

### `addSale` no era equivalente a `handleCreateSale`

El paso 2 encontró tres diferencias. Dos resultaron irrelevantes y una no:

| | Importaba |
|---|---|
| `prev.sales` actualizado | No: nadie lo leía |
| `fetchFlights()` | No: `data.flights` ya no tiene consumidores |
| `invalidateDashboardCache()` + `setDashboardData(null)` | **Sí**: `Dashboard.tsx` lee `dashboardData` |

Por eso `DataContext` expone ahora `invalidateDashboard()`, que el wizard llama tras
crear la venta.

### Dos bugs preexistentes que destapó el repaso del paso 5

- **`listPayments` usaba `prisma.pagosVenta`**, con `fechaPago` y `metodoPago`. El modelo
  es `pagos_venta` con `fecha_pago` y `metodos_pago`: `GET /sales/:id/payments` estaba
  roto. Es el mismo patrón camelCase que ya apareció en `products.controller.js`,
  `getClientById` y `updatePermissions`.
- **`ADMIN_PERMISSIONS` no tenía `sales.delete`**, así que un administrador recibía 403
  al anular una venta. Faltaban también los `delete` de clients, itineraries y config.

### Verificación

Los cuatro flujos del paso 5, contra la API real:

```
1. crear venta      201
2. editar           200
3. registrar pago   200 · listar 200 (1 pago) · borrar 200 con estado recalculado
4. anular           200
tabla coherente     filas 6 / total 6
limpieza            5 ventas antes, 5 después
```
