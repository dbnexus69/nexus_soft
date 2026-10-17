# Plan — Spec 018

| Paso | Dónde | Qué |
|---|---|---|
| 1 | `backend/src/services/ventasCartera.js` | `numero`, asesor y último abono en los créditos del cliente; `phone` del cliente en cartera y créditos |
| 2 | `frontend/src/components/sales/credit/ClientCreditRow.tsx`, `CollectPaymentDialog.tsx`, `CreditDashboard.tsx` | Barra de contacto, asesor (oculto con `own`), último abono, `#numero` en la fila y en el título del cobro |
| 3 | `backend/tests/ventas-filtros-api.js` | Cuatro comprobaciones de los créditos del cliente |
