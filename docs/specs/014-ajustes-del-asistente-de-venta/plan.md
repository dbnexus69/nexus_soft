# Plan técnico — Spec 014

## Decisiones

### 1. Copia del borrador en memoria, con la misma clave que `localStorage`

`NewSaleWizard.tsx` guarda el borrador en un `Map` de módulo (`borradoresEnMemoria`) además
de en `localStorage`. El `Map` sobrevive a que el asistente se desmonte al cambiar de módulo,
porque el módulo JavaScript no se recarga. La clave es la misma que la del `localStorage`
(`nexus_new_sale_draft_<empresa>_<usuario>`), así que cada agencia y cada usuario tienen la
suya.

Si `localStorage.setItem` falla (cupo), se borra la clave: una versión vieja restaurada al
recargar sería peor que no tener borrador.

### 2. El tipo de documento de SIM y finca sale de la configuración

Mismo origen que el hotel: `data.config.documentTypes`, pasado como prop
`documentTypes` desde `ProductFormsModal`. El valor guardado es la abreviatura (`CC`, `PA`…),
que es lo que compara `documentoDePersonaInvalido`. Por defecto, el tipo del cliente.

### 3. Tour: nombre y fecha en el formulario, validación en `validarPaso`

- `selectedTour` (nombre) y `preferredDate` (fecha y hora) existían en `TourData`, pero el
  formulario no los pedía.
- Se usa `DateTimePicker` (el de tiquetes y SIM), con `min` = ahora en hora local.
- `validarPaso` añade "Nombre del Tour (requerido)" y "Fecha y hora del tour (requerida)".

### 4. Resumen de la venta

`Step2Products.tsx`: la tarjeta pasa de banner oscuro a tarjeta clara con la venta total
arriba y, debajo, costo proveedor, ganancia e IVA, que suman el total (`useSaleCalculations`).

`Step3Payment.tsx`: el resumen financiero añade la celda de IVA (`form.iva`) y pasa a cinco
columnas en pantallas medianas y grandes.

### 5. Finca: nombres de campo

`ventaProductos.js` leía `f.city` y `f.address`. El formulario guarda `fincaCity` y
`fincaAddress`. Se corrige la lectura; no hay cambio de esquema.

## Archivos

| Archivo | Cambio |
|---|---|
| `frontend/src/components/sales/NewSaleWizard.tsx` | copia en memoria, cerrar no borra |
| `frontend/src/components/sales/forms/SimCardForm.tsx`, `FincaForm.tsx` | selector de tipo de documento |
| `frontend/src/components/sales/forms/TourForm.tsx` | nombre y fecha y hora |
| `frontend/src/components/sales/wizard/validarPaso.ts` | validación de tour |
| `frontend/src/components/sales/wizard/ProductFormsModal.tsx` | `documentTypes`; sin botones duplicados |
| `frontend/src/components/sales/wizardData.ts`, `frontend/src/types/index.tsx` | `docType` en SIM y finca |
| `frontend/src/components/sales/steps/Step2Products.tsx`, `Step3Payment.tsx` | resumen y IVA |
| `backend/src/services/ventaProductos.js` | `fincaCity`, `fincaAddress` |

## Verificación

- `tsc` del frontend sin errores (después de cada bloque de cambios).
- `node --check` de los archivos del backend tocados.
- `pnpm test:voucher` y `pnpm test:vuelos-api`: sin fallos (ver spec 015 para el voucher).
- **No probado en el navegador.** El proyecto pide permiso expreso para abrirlo.
