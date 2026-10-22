# Spec 028 — El freelancer y los costos de proveedor

**Estado:** decidida (2026-10-22): sin código nuevo; se cierra con una prueba. Las preguntas de abajo ya están respondidas · **Rama:** `feat-bayrol` · **Relacionadas:**
[`026`](../026-rol-freelancer/spec.md) (la dejó fuera), [`027`](../027-permisos-coherentes/spec.md)

## Por qué

El freelancer es un vendedor externo. Hoy ve el costo de proveedor de sus ventas, es decir, el margen con el que trabaja
la agencia con cada proveedor. El usuario quiere poder ocultárselo.

## Lo que hay hoy (medido 2026-10-22)

- **El freelancer escribe el costo.** El asistente de venta lo pide en cada producto (`supplierCost`, obligatorio en una
  venta), y el total sale de costo + TA (`useSaleCalculations.ts`, `saleTotals.js`). Ocultarlo no es solo quitar
  columnas: alguien tiene que ponerlo.
- **Dónde aparece:**
  - Asistente: los formularios de las 15 categorías (`components/sales/forms/*`, `VoucherField.tsx`), `Step2Products`,
    `Step3Payment`, `NewSaleWizard`, `wizardData.ts` y `validarPaso.ts`.
  - Detalle y cobros: `SaleDetailModal`, `detail/ServiceRow`, `SalePaymentsModal`.
  - Dashboard: `suppliersTotal` y `creditProveedores` (`stats.service.js`, `useDashboardStats.ts`).
  - API: `sales.service.js`, `ventasListado.js` y `quotes.service.js` lo devuelven.
- El voucher y el PDF de la cotización **no** lo muestran (spec 007/011).

## Preguntas abiertas (para el usuario)

1. **¿Quién pone el costo en una venta del freelancer?** (a) El freelancer da el precio total y la TA, y el costo sale
   de restar; (b) lo completa después el admin, y la venta queda pendiente de costo hasta entonces; (c) otra.
2. **¿Es un permiso configurable** (p. ej. `sales.costs`, que el admin da o quita por rol en el panel) **o una regla
   fija** del freelancer?
3. **¿Qué ve el freelancer en lugar del costo?** Nada, o solo su TA y el total.
4. **¿Aplica también a las cotizaciones** (el costo es opcional ahí) **y al dashboard** (total de proveedores)?
5. **¿Y al asesor?** ¿Solo el freelancer, o cualquier rol al que se le quite el permiso?

## Respuestas (del usuario, 2026-10-22)

1. El costo lo pone el freelancer, como hoy.
2. Regla fija, no un permiso nuevo.
3. El freelancer normalmente ve solo lo que él registra: sus ventas, con sus costos.
4. Aplica también a cotizaciones y dashboard.
5. El asesor y el freelancer se manejan con los permisos que les dé el admin de la agencia (más o menos).

**Lo que implican:** con los valores por defecto (ventas, cotizaciones y dashboard en `own`; el dashboard de un no
admin nunca pasa de `own`) ya se cumple: el freelancer solo ve los costos de lo suyo. **Queda una pregunta (2 frente a
5):** si el admin le da ventas o cotizaciones en `all`, ¿ve los costos de las ajenas? (a) **recomendada:** sí, lo decide
el admin, igual que con el asesor; la 028 se cierra con una prueba, sin código; (b) no, regla fija: el servidor quita el
costo de lo ajeno al freelancer, aunque el panel diga `all`.
**Elegida: (a)** (2026-10-22): lo decide el admin con los permisos del rol; no hay regla fija.

## Qué se hace

Nada en el código. Una prueba en `test:aislamiento-api`: con ventas en `own`, el freelancer no ve (404) la venta de otro
ni su costo, y no lo suma en su dashboard (`suppliersTotal`). Con ventas en `all`, ve el costo, como el asesor.

## Cómo se comprobará

Se escribe con el diseño. Como mínimo: la API no devuelve el costo a quien no debe verlo (no basta con ocultarlo en
pantalla) y una venta del freelancer sigue cuadrando (total = costo + TA).
