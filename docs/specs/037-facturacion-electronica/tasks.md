# Tareas — Spec 037

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente · `[!]` bloqueada

**Estado (2026-11-01).** Diseño y plan escritos; nada implementado. Queda guardado hasta que se decida aplicarlo. Los
pasos de cada tarea están en `plan.md`.

## Fase 0 — Documento en proveedores

## T1 · Backend: tipo de documento y documento en `proveedores` `[ ]`
Columnas opcionales, índice único parcial por agencia, `ESQUEMAS.suppliers` con los dos campos juntos, `reverseTransform`
con `validarDocumento`. Comprobar: `test:validaciones`, `check:prisma`. Con permiso: migración.

## T2 · Frontend: campos del proveedor `[ ]`
Selector de tipo y documento en `ConfigForms.tsx`, errores por campo y `409` de duplicado. Comprobar: `pnpm build`. Con
permiso: en pantalla.

## Fase 1 — Núcleo

## T3 · Migración de facturación `[ ]`
Enums, `integraciones_facturacion`, `documentos_facturacion`, `eventos_facturacion` (solo inserción), RLS, FKs
compuestas, índices únicos parciales, `app_facturacion_pendientes` y `app_facturacion_por_referencia`. Con permiso:
migración y `test:aislamiento`.

## T4 · Cifrado de credenciales `[ ]`
`utils/cifradoCredenciales.js` (AES-256-GCM con AAD y versión), `FACTURACION_CLAVE_MAESTRA` solo en Render. Comprobar:
`test:facturacion` (nuevo, sin BD).

## T5 · Permisos `facturacion` `[ ]`
`view`/`create`/`credit_note` con alcance en los tres sitios + `SCOPED_ACTIONS`. Comprobar: `test:facturacion`,
`pnpm build`.

## T6 · Catálogo de errores, saneo, registro y conector falso `[ ]`
Comprobar: `test:facturacion`.

## T7 · Armado de la factura neutral `[ ]`
Función pura, centavos enteros, invariante contra los totales de la venta, terceros con el NIT del proveedor de cada
servicio, fecha de emisión y vencimiento siempre presente. Comprobar: `test:facturacion`.

## Fase 2 — Configuración, emisión y reanudación

## T8 · Estados, contexto e integración del superadmin `[ ]`
Rutas `/companies/:id/invoicing…`. Comprobar: `test:facturacion`, `check:prisma`. Con permiso: `test:facturacion-api`.

## T9 · Facturar, procesar, reintentar y reanudar `[ ]`
`202` inmediato, reserva por `UPDATE` condicional, reanudador al arrancar y cada minuto. Con permiso:
`test:facturacion-api` (C1, C4–C9, C11).

## T10 · Nota crédito y anulación de una venta facturada `[ ]`
`409` al anular con factura en curso, filtro `invoicing` del listado, `facturaVigente` en el detalle. Con permiso:
`test:facturacion-api` (C12).

## T11 · PDF y soporte del superadmin `[ ]`
Bucket `facturas` (**se crea a mano en Supabase Storage**), URL firmada de 5 min, búsqueda por `FAC-…`. Con permiso:
`test:facturacion-api`.

## Fase 3 — Proveedores reales e interfaz

## T12 · Primer conector real: Siigo `[!]`
Cada software contable nuevo repite esta tarea con su anexo en la spec. Bloqueada hasta tener la empresa de pruebas de
Siigo, su `Partner-Id` y los puntos «por confirmar» del anexo A. Comprobar:
`test:facturacion` con `fetch` simulado. Con permiso: factura real en pruebas (C13).

## T13 · Interfaz `[ ]`
Sección en el detalle de venta, filtro del listado, aviso al anular, panel del superadmin. Con `ui-ux-pro-max`.
Comprobar: `pnpm build`. Con permiso: en pantalla.

## T14 · Cierre: aislamiento, documentación y CI `[ ]`
`aislamiento-api` ampliado, prueba de que ningún secreto aparece en logs ni bitácora (C14), documentos y CI.

## Pendiente fuera del plan
- Conector Karing (y los demás software contables): esperar su documentación y responder las 10 preguntas de «Cómo
  incorporar un software contable nuevo».
- Pendientes externos (cuando se decida aplicar): documentación de cada software y cuenta de pruebas del primero.

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-11-01 | — | Diseño completo vía `/brainstorming` con el usuario: módulo por agencia activado por el superadmin, botón genérico «Facturar», factura con TA+IVA propio y costo del proveedor como ingreso para terceros, cliente relacionado por documento con el software contable, nota crédito opcional por agencia, un reintento según el error, seguridad primero. Se investigó la API oficial de Siigo (idempotencia, límites, bloqueo por errores, `Partner-Id`); Karing no tiene documentación pública. Spec y plan escritos; nada implementado; sin commit. |
| 2026-11-01 | — | Ajustes del usuario: el diseño es para software contables en general, no solo Siigo (vocabulario fijo software contable / conector / proveedor; Siigo pasa al anexo A como primer conector; conectores con y sin idempotencia); el ingreso para terceros va con el NIT del proveedor de cada servicio (la fase 0 pasa a ser requisito); la fecha de la factura es la de emisión y siempre lleva vencimiento. Resueltas tres preguntas abiertas. Spec, plan y tareas actualizados; nada implementado; sin commit. |
| 2026-11-01 | — | El usuario confirma que el proveedor también debe existir como tercero en el software contable (deja de ser decisión de diseño). La documentación y la cuenta de pruebas pasan a «pendientes externos»: el proyecto está en preparación. |
