# Plan de implementación — Spec 037, facturación electrónica por agencia

> **Para quien ejecute:** usar `superpowers:executing-plans` (en esta sesión) o `superpowers:subagent-driven-development`
> **solo si el usuario autoriza subagentes** (regla del `CLAUDE.md` raíz). Los pasos usan casillas `- [ ]`. El estado
> real (hecho, verificado, pendiente) se lleva en `tasks.md`.

**Objetivo:** que cada agencia con el módulo activo facture una venta en su software contable con un botón «Facturar»,
con un núcleo común y un conector por software contable (Siigo es el primero; vendrán otros).

**Arquitectura:** núcleo en `backend/src/services/facturacion/` (arma, valida, estados, reintentos, bitácora), conectores
sin estado en `services/facturacion/conectores/`, configuración por agencia cifrada en `integraciones_facturacion`.
Todo bajo RLS y FKs compuestas como el resto de tablas de inquilino.

**Stack:** Express 5, Prisma 6 (CommonJS, JS), PostgreSQL/Supabase, `crypto` de Node (sin dependencias nuevas), `fetch`
nativo de Node; frontend React 19 + TS.

**Spec:** `docs/specs/037-facturacion-electronica/spec.md` (se leen juntos; este plan no repite sus tablas de errores ni
escenarios).

## Restricciones globales

- **Sin permiso expreso:** nada de migraciones, `db:generate`, pruebas con BD (`*-api.js`), levantar servidores ni
  navegador. Las tareas marcan esos pasos como **«con permiso»**.
- **Sin commit, push ni merge** salvo que el usuario lo pida. El paso «Commit» de cada tarea es «cuando el usuario lo
  pida».
- Comprobaciones permitidas sin permiso: `backend/`: `pnpm check:prisma`, `pnpm test:validaciones`,
  `pnpm test:reglas-espejo`, `pnpm test:facturacion` (nuevo, sin BD); `frontend/`: `pnpm build`.
- Migraciones: `prisma migrate diff` → leer el SQL → `migrate deploy` con permiso. Nunca `db push`. No editar migraciones
  aplicadas.
- Tenencia: nunca `where empresa_id` ni `empresa_id` en `create`; transacciones solo con `transaccion(fn)` de
  `config/db.js`; la empresa nunca sale de la URL salvo en `/companies/:id/...` bajo `soloSuperadmin` + `conEmpresa(id)`.
- Tablas nuevas: `empresa_id` con default `NULLIF(current_setting('app.empresa_id', true), '')::integer` (sin respaldo
  a otra agencia), FK compuestas, `ENABLE` + `FORCE ROW LEVEL SECURITY`, política `empresa_aislada`, permisos solo a
  `app_nexus` (patrón de `20261017120000_destinos_de_preferencia`).
- Comentarios y textos en español; `console.error/warn` ad hoc en inglés con etiqueta (`[INVOICE_SOFTWARE_FAILED]`,
  `[INVOICE_RESUMER_FAILED]`).
- Respuesta mínima (spec 034); `POST` 201/202, `DELETE` 204, validación 422 con `error.details: [{ field, message }]`.
- Vocabulario de la spec: *software contable* (Siigo, Karing…), *conector* (su código en Nexus), *proveedor* (aerolínea,
  hotel: la tabla `proveedores`, tercero del ingreso para terceros). El núcleo nunca nombra un software concreto; lo
  propio de cada software vive solo en su conector.
- Valores fijos de la spec: IVA desde `iva` guardado (`TASA_IVA` 19%); clave de idempotencia ≤ **30** alfanuméricos;
  tiempo de espera = `tiempoEsperaMs` del conector; **1** reintento automático para errores pasajeros; código de referencia
  `FAC-` + 6 caracteres `[A-Z0-9]` sin `0/O/1/I`; URL firmada de PDF **5 min**; motivo de nota crédito **5–255**;
  fecha de la factura = día de Bogotá de la emisión; vencimiento siempre presente; variable `FACTURACION_CLAVE_MAESTRA`
  (32 bytes en base64), solo en Render.

## Enfoque de revisión

Casos que la spec implica y que ningún criterio prueba directamente; cada uno tiene su prueba en la tarea dueña:
1. **Credenciales con espacios o saltos de línea pegados** desde un correo → se recortan antes de cifrar y la pista se
   calcula sobre el valor recortado (T8).
2. **Venta con montos `Float` como `0.1 + 0.2`** o TA con decimales → el armado en centavos no descuadra el invariante
   (T7).
3. **Clave maestra mal formada** (no son 32 bytes) → el módulo responde `503 FACTURACION_NO_DISPONIBLE` y el resto de
   la app arranca (T4).
4. **Respuesta del software que no es JSON** (HTML de un proxy, cuerpo vacío) → `ERROR_SOFTWARE`, nunca una excepción
   sin traducir (T12).
5. **El reanudador encuentra un documento cuya integración ya fue retirada** → el documento pasa a `fallida_pasajera`
   con `INTEGRACION_SIN_CONFIGURAR` y no se reintenta en bucle (T9).

---

## Mapa de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `backend/prisma/migrations/2026MMDDhhmmss_documento_de_proveedores/migration.sql` | columnas e índice de proveedores | T1 |
| `backend/prisma/migrations/2026MMDDhhmmss_facturacion_electronica/migration.sql` | enums, 3 tablas, RLS, funciones, grants | T3 |
| `backend/src/schemas/config.schema.js` | `suppliers`: `docTypeId`, `docNumber` | T1 |
| `backend/src/services/config.service.js` | `suppliers.transform/reverseTransform` | T1 |
| `frontend/src/components/config/ConfigForms.tsx` | campos del proveedor | T2 |
| `backend/src/utils/cifradoCredenciales.js` | AES-256-GCM con AAD y versión | T4 |
| `backend/src/utils/alcancePermisos.js`, `services/roles.service.js`, `middleware/authorize.js`, `frontend/src/types/index.tsx` | módulo `facturacion` | T5 |
| `backend/src/services/facturacion/errores.js` | catálogo común, clases, `errorFacturacion` | T6 |
| `backend/src/services/facturacion/sanear.js` | quita secretos de cualquier objeto | T6 |
| `backend/src/services/facturacion/conectores/index.js` | registro de conectores | T6 |
| `backend/src/services/facturacion/conectores/falso.js` | conector de prueba con guion | T6 |
| `backend/src/services/facturacion/armarFactura.js` | venta → factura neutral (pura) | T7 |
| `backend/src/services/facturacion/estados.js` | transiciones (pura) | T8 |
| `backend/src/services/facturacion/contexto.js` | arma `ctx` y caché de token | T8 |
| `backend/src/services/facturacion/integracion.service.js` | configuración del superadmin | T8 |
| `backend/src/services/facturacion/emision.service.js` | facturar, procesar, reintentar, listar | T9 |
| `backend/src/services/facturacion/reanudador.js` | documentos pendientes | T9 |
| `backend/src/services/facturacion/notaCredito.service.js` | nota crédito | T10 |
| `backend/src/services/facturacion/conectores/siigo.js` | primer conector real (anexo A de la spec) | T12 |
| `backend/src/schemas/facturacion.schema.js` | Zod de todas las rutas | T8–T10 |
| `backend/src/controllers/facturacion.controller.js` | controladores | T8–T11 |
| `backend/src/routes/companies.routes.js`, `routes/sales.routes.js`, `routes/facturacion.routes.js` | rutas | T8–T11 |
| `backend/tests/facturacion.js` | pruebas sin BD (`pnpm test:facturacion`) | T4–T12 |
| `backend/tests/facturacion-api.js` | pruebas con BD y servidor (`pnpm test:facturacion-api`) | T8–T11 |
| `frontend/src/api/facturacion.ts`, `components/sales/detail/FacturacionSection.tsx`, `components/companies/FacturacionPanel.tsx` | interfaz | T13 |

`tests/facturacion.js` sigue el estilo de `tests/validaciones.js`: sin marco, función `comprobar(descripcion, condicion,
detalle)`, sale con código 1 si algo falla. Se añade a `package.json` como `"test:facturacion": "node tests/facturacion.js"`
y a `.github/workflows/ci.yml` junto a `test:validaciones` (no toca BD).

---

## Fase 0 — Documento en proveedores

### T1: Backend — tipo de documento y documento en `proveedores`

**Archivos:**
- Crear: migración `…_documento_de_proveedores/migration.sql`
- Modificar: `backend/prisma/schema.prisma` (`model proveedores`, `model tipos_documento`)
- Modificar: `backend/src/schemas/config.schema.js:51-58`
- Modificar: `backend/src/services/config.service.js:73-90`
- Probar: `backend/tests/validaciones.js`

**Interfaces:**
- Consume: `validarDocumento({ docTypeId, docNumber })` de `utils/tipoDocumento.js`; `normalizarDocumento` de
  `utils/datosPersona.js`.
- Produce: proveedor serializado con `docTypeId: number | null` y `docNumber: string | null`.

- [ ] **Paso 1: prueba que falla** (en `tests/validaciones.js`, sección «Proveedores»):

```js
const { ESQUEMAS } = require('../src/schemas/config.schema');
const prov = (d) => ESQUEMAS.suppliers.safeParse({ name: 'Avianca', ...d });
comprobar('proveedor sin documento es válido', prov({}).success);
comprobar('proveedor con tipo y número es válido', prov({ docTypeId: 3, docNumber: '900123456-8' }).success);
comprobar('tipo sin número → error en docNumber', prov({ docTypeId: 3 }).error?.issues[0].path[0] === 'docNumber');
comprobar('número sin tipo → error en docTypeId', prov({ docNumber: '900123456' }).error?.issues[0].path[0] === 'docTypeId');
comprobar('número se recorta', prov({ docTypeId: 3, docNumber: ' 900123456 ' }).data?.docNumber === '900123456');
```

- [ ] **Paso 2:** `cd backend && pnpm test:validaciones` → falla en esos casos.
- [ ] **Paso 3:** en `ESQUEMAS.suppliers` añadir `docTypeId` (entero positivo, `nullable().optional()`) y `docNumber`
  (texto ≤ 30, recortado, `nullable().optional()`), con un `superRefine` que exige los dos juntos y marca el que falta.
  `''` cuenta como ausente. Mantener `.passthrough()`.
- [ ] **Paso 4:** `pnpm test:validaciones` → pasa.
- [ ] **Paso 5:** `schema.prisma`: `proveedores.tipo_documento_id Int?` con relación a `tipos_documento` y
  `proveedores.documento String?`; en `tipos_documento` la relación inversa `proveedores proveedores[]`.
- [ ] **Paso 6:** migración: `ALTER TABLE "proveedores" ADD COLUMN "tipo_documento_id" INTEGER, ADD COLUMN "documento" TEXT`;
  FK a `tipos_documento(id)` `ON DELETE RESTRICT`; `CREATE UNIQUE INDEX "proveedores_empresa_id_documento_key" ON
  "proveedores"("empresa_id", "documento") WHERE "documento" IS NOT NULL`; `CHECK` de que ambos son nulos o ambos no
  nulos. Aditiva.
- [ ] **Paso 7:** `config.service.js` `suppliers`: `transform` añade `docTypeId: r.tipo_documento_id ?? null,
  docNumber: r.documento ?? null`. `reverseTransform` (ya es `async`): si `d.docTypeId` existe, normaliza con
  `normalizarDocumento(d.docNumber)`, llama `validarDocumento({ docTypeId: d.docTypeId, docNumber })` (el 422 nombra
  `docTypeId`/`docNumber`) y devuelve `tipo_documento_id`, `documento`. Si llegan como `null` explícito, los limpia. Si no
  vienen, no los toca.
- [ ] **Paso 8:** `pnpm check:prisma` → sin hallazgos; `pnpm test:validaciones` → pasa.
- [ ] **Paso 9 (con permiso):** `migrate diff` → revisar SQL → `migrate deploy` → `db:generate`.
- [ ] **Paso 10:** Commit, cuando el usuario lo pida.

### T2: Frontend — campos del proveedor

**Archivos:** modificar `frontend/src/components/config/ConfigForms.tsx` (`case 'suppliers'`) y donde se valida el
formulario de catálogos antes de enviar.

**Interfaces:** consume `data.config.documentTypes` (`DataContext`) y `mensajeDocumento`/`normalizarDocumento` de
`frontend/src/utils/datosPersona.ts`; envía `docTypeId` y `docNumber`.

- [ ] **Paso 1:** añadir `Select` «Tipo de documento» (opciones de `data.config.documentTypes`, con «Sin documento») e
  `Input` «Documento», igual que `UserModal.tsx`.
- [ ] **Paso 2:** validación local: los dos juntos; número según la regla del tipo (abreviatura del tipo elegido).
- [ ] **Paso 3:** pintar `error.details` del 422 por campo y el `409 DUPLICATE` en `docNumber` («Ya existe un proveedor
  con ese documento»). El hook debe relanzar el error original (`frontend/CLAUDE.md`).
- [ ] **Paso 4:** `cd frontend && pnpm build` → sin errores.
- [ ] **Paso 5 (con permiso, en pantalla):** crear, editar, quitar documento y duplicar.
- [ ] **Paso 6:** Commit, cuando el usuario lo pida.

---

## Fase 1 — Núcleo

### T3: Migración de facturación

**Archivos:** crear `…_facturacion_electronica/migration.sql`; modificar `schema.prisma`.

**Produce (nombres que usan las demás tareas):**
- Enums: `SoftwareContable` (`siigo`), `EstadoIntegracion` (`sin_configurar`, `conectada`, `credenciales_invalidas`,
  `bloqueada_por_software`, `suspendida`), `TipoDocumentoFacturacion` (`factura`, `nota_credito`),
  `EstadoDocumentoFacturacion` (`en_proceso`, `pendiente_dian`, `emitida`, `rechazada_datos`, `rechazada_dian`,
  `fallida_pasajera`, `anulada_por_nota_credito`).
- Tablas `integraciones_facturacion`, `documentos_facturacion`, `eventos_facturacion` con las columnas de la spec
  («Modelo de datos»).
- Índices únicos: `integraciones_facturacion(empresa_id)`; `documentos_facturacion(codigo_referencia)`;
  `documentos_facturacion(venta_id) WHERE tipo='factura' AND estado IN ('en_proceso','pendiente_dian','emitida','fallida_pasajera')`;
  `documentos_facturacion(factura_id) WHERE tipo='nota_credito' AND estado IN (los mismos)`.
- FKs compuestas: `(venta_id, empresa_id) → ventas`, `(factura_id, empresa_id) → documentos_facturacion`,
  `(emitido_por_id, empresa_id) → usuarios`, `(documento_id, empresa_id)` e `(integracion_id, empresa_id)` desde
  `eventos_facturacion`.
- Grants: `app_nexus` con `SELECT, INSERT, UPDATE, DELETE` en las dos primeras; **solo `SELECT, INSERT`** en
  `eventos_facturacion`.
- Funciones `SECURITY DEFINER` (patrón de `app_identidad_por_correo`, `REVOKE ALL … FROM PUBLIC`, `GRANT EXECUTE` a
  `app_nexus`):
  - `app_facturacion_pendientes(p_limite int) RETURNS TABLE(documento_id int, empresa_id int)` →
    `estado IN ('en_proceso','pendiente_dian') AND proximo_intento_at <= now()`. No bloquea filas: la reserva la hace
    `procesarDocumento` (T9).
  - `app_facturacion_por_referencia(p_codigo text) RETURNS TABLE(documento_id int, empresa_id int)`.

- [ ] **Paso 1:** escribir el SQL y el modelo Prisma.
- [ ] **Paso 2:** `pnpm check:prisma` → sin hallazgos.
- [ ] **Paso 3 (con permiso):** `migrate diff` → revisar → `migrate deploy` → `db:generate`; asesores de seguridad de
  Supabase limpios.
- [ ] **Paso 4 (con permiso):** `pnpm test:aislamiento` → en verde.
- [ ] **Paso 5:** Commit, cuando el usuario lo pida.

### T4: Cifrado de credenciales

**Archivos:** crear `backend/src/utils/cifradoCredenciales.js`, `backend/tests/facturacion.js`; modificar `package.json`,
`backend/.env.example` (`FACTURACION_CLAVE_MAESTRA=` vacía), `render.yaml` (`sync: false`), `src/config/env.js`.

**Produce:**
- `cifrar(textoPlano: string, aad: string) → { cifrado: Buffer, iv: Buffer, tag: Buffer, version: number }`
- `descifrar({ cifrado, iv, tag, version }, aad: string) → string`
- `disponible() → boolean`
- `aadDe({ empresaId, software, integracionId }) → string` = `` `${empresaId}:${software}:${integracionId}` ``
- Las claves por versión salen de `FACTURACION_CLAVE_MAESTRA` (versión vigente) y de `FACTURACION_CLAVE_MAESTRA_V<n>`
  (versiones anteriores, para rotar). La vigente la fija `FACTURACION_CLAVE_VERSION` (por defecto 1).

- [ ] **Paso 1: pruebas que fallan** en `tests/facturacion.js`, con una clave de prueba fijada en `process.env` antes del
  `require`:
  - `ida y vuelta`: `descifrar(cifrar('s3cr3t', 'A'), 'A') === 's3cr3t'`.
  - `AAD de otra agencia no descifra`: `descifrar(cifrar('s3cr3t', '1:siigo:5'), '2:siigo:7')` lanza.
  - `tag alterado no descifra`.
  - `IV distinto en cada cifrado`: dos `cifrar` iguales dan `iv` distinto.
  - `clave mal formada → no disponible`: con `FACTURACION_CLAVE_MAESTRA='corta'`, `disponible() === false` y `cifrar`
    lanza un `AppError` 503 con code `FACTURACION_NO_DISPONIBLE` (enfoque de revisión 3).
  - `rotación`: lo cifrado con versión 1 descifra cuando la vigente es 2 y existe `…_V1`.
- [ ] **Paso 2:** `pnpm test:facturacion` → falla.
- [ ] **Paso 3:** implementar con `crypto.createCipheriv('aes-256-gcm', clave, iv)`, IV aleatorio de 12 bytes,
  `setAAD(Buffer.from(aad))`. `env.js` lee las variables **sin** fallar el arranque si faltan.
- [ ] **Paso 4:** `pnpm test:facturacion` → pasa.
- [ ] **Paso 5:** Commit, cuando el usuario lo pida.

### T5: Permisos del módulo `facturacion`

**Archivos:** `backend/src/utils/alcancePermisos.js` (`SCOPED_ACTIONS.facturacion = ['view', 'create', 'credit_note']`),
`backend/src/services/roles.service.js` (`MODULE_ACTIONS`, `SCOPED_VIEW_MODULES`), `backend/src/middleware/authorize.js`
(`ADMIN_PERMISSIONS` y `SUPERADMIN_PERMISSIONS` todo `'all'`; `ROLE_DEFAULT_PERMISSIONS` asesor y freelancer `view: 'own'`, `create: 'none'`,
`credit_note: 'none'`), `frontend/src/types/index.tsx` (`RolePermissions`, las tres constantes, `SCOPED_ACTIONS`).

- [ ] **Paso 1: prueba que falla** en `tests/facturacion.js`: `leerValor('facturacion', 'create', 'own') === 'own'`;
  `tieneAlcance('facturacion', 'credit_note') === true`; los valores por defecto del asesor son los de arriba (leyendo
  `ROLE_DEFAULT_PERMISSIONS`).
- [ ] **Paso 2:** `pnpm test:facturacion` → falla. **Paso 3:** implementar. **Paso 4:** pasa; `cd frontend && pnpm build`.
- [ ] **Paso 5:** Commit, cuando el usuario lo pida.

### T6: Catálogo de errores, saneo, registro y conector falso

**Archivos:** crear `services/facturacion/errores.js`, `sanear.js`, `conectores/index.js`, `conectores/falso.js`.

**Produce:**
- `CLASES = { CONFIGURACION, CREDENCIALES, DATOS, PASAJERO, RESUELTO, DESCONOCIDO, INTERNO }`.
- `CODIGOS`: cada código de la tabla de la spec → `{ clase, mensaje }` (el mensaje en español de la columna «Qué ve el
  usuario», con `{documento}` y `{referencia}` como marcadores).
- `errorFacturacion(codigo, { detalleTecnico, datos } = {}) → ErrorFacturacion` (extiende `AppError`; status 422 para
  `DATOS`, 403 `FACTURACION_NO_HABILITADA`, 503 `FACTURACION_NO_DISPONIBLE`, 502 para el resto; lleva `codigo`, `clase`).
- `esReintentable(clase) → boolean`: solo `PASAJERO` y `DESCONOCIDO`.
- `sanear(valor) → valor` (copia profunda): reemplaza por `'[oculto]'` toda clave que case
  `/token|authorization|access_key|password|secret|clave|credencial/i`; recorta cadenas a 2000 caracteres.
- `obtenerConector(id) → Conector`: lanza `NO_SOPORTADO` si no existe. Si `process.env.FACTURACION_CONECTOR_FALSO`
  está definido, devuelve `falso` para ese id **solo si `NODE_ENV === 'test'`**; en cualquier otro entorno, el arranque
  lanza (`src/index.js` llama `comprobarConfiguracionFacturacion()` al iniciar).
- `falso`: cumple el contrato de la spec; su comportamiento lo fija `FACTURACION_FALSO_GUION` (JSON, p. ej.
  `["SOFTWARE_NO_DISPONIBLE","ok"]`). Con `FACTURACION_FALSO_IDEMPOTENCIA=1` (por defecto) simula idempotencia con un
  `Map` por clave; con `0`, declara `capacidades.idempotencia = false`, **duplica** si se reenvía la misma clave e
  implementa `buscarPorClave`. Así se prueban los dos modos del núcleo. `buscarTercero` responde según
  `FACTURACION_FALSO_TERCEROS` (lista de documentos existentes; por defecto, todos).

- [ ] **Paso 1: pruebas que fallan:**
  - `sanear oculta secretos anidados`: `{ headers: { Authorization: 'x' }, body: { access_key: 'y', ok: 1 } }` →
    ninguna aparición de `'x'` ni `'y'` en `JSON.stringify(resultado)`; `ok` intacto.
  - `cada código tiene clase y mensaje` (recorre `CODIGOS`).
  - `reintento`: `esReintentable(CLASES.DATOS) === false`, `esReintentable(CLASES.PASAJERO) === true`.
  - `falso fuera de test lanza`: con `NODE_ENV='production'` y la variable puesta, `comprobarConfiguracionFacturacion()`
    lanza.
  - `falso idempotente`: dos `emitirFactura` con la misma clave devuelven la misma `refExterna`.
  - `falso sin idempotencia`: con `FACTURACION_FALSO_IDEMPOTENCIA=0`, dos `emitirFactura` con la misma clave dan dos
    `refExterna` distintas y `buscarPorClave` encuentra la primera.
- [ ] **Paso 2:** falla. **Paso 3:** implementar. **Paso 4:** pasa.
- [ ] **Paso 5:** Commit, cuando el usuario lo pida.

### T7: Armado de la factura neutral

**Archivos:** crear `backend/src/services/facturacion/armarFactura.js`; probar en `tests/facturacion.js`.

**Produce:** `armarFactura({ venta, detalles, cliente, hoy }) → FacturaNeutral` (forma exacta en la spec,
«Construcción de la factura»), con montos en **centavos enteros** (`Math.round(valor * 100)`). Reúne **todos** los
errores de datos en un solo `AppError` 422 con `error.details` (para que el usuario corrija todo de una vez):
`CLIENTE_SIN_DOCUMENTO` (field `client.docNumber`), `PROVEEDOR_SIN_ASIGNAR` (field `products.<i>.supplier`),
`PROVEEDOR_SIN_DOCUMENTO` (field `products.<i>.supplier`, mensaje con el nombre del proveedor),
`VENTA_SIN_VENCIMIENTO` (field `creditDueDate`), `SIN_LINEAS`. Aparte, `errorFacturacion('DATOS_VENTA_INCONSISTENTES')`
cuando la suma de líneas difiere de los totales de la venta en más de 50 centavos.

- `venta`: `{ id, numero, status, ta_total, iva_total, costo_proveedor_total, metodo_pago_principal_id,
  fecha_vence_credito }`; `detalles`: filas de `detalle_venta` con `categoria, ta, iva, costo_proveedor, proveedor`
  (proveedor con `tipo_documento`, `documento`, `nombre`, o null); `hoy`: `'AAAA-MM-DD'` de Bogotá (de `utils/fechas.js`).
- `fechaEmision = hoy`. `status === 'pagado'` → `formaPago { tipo: 'contado', metodoPagoId }` y
  `fechaVencimiento = hoy`. Si no → `formaPago { tipo: 'credito' }` y `fechaVencimiento` = día de Bogotá de
  `fecha_vence_credito`; nula o anterior a `hoy` → `VENTA_SIN_VENCIMIENTO`.
- Cada línea `terceros` lleva `tercero: { tipoDocumento, documento, nombre }` del proveedor del servicio, con el
  documento normalizado (`normalizarDocumento`).
- La descripción de la línea es la etiqueta de la categoría de `catalog/products.js`.

- [ ] **Paso 1: pruebas que fallan:**
  - `venta simple`: un tiquete `ta 100000, iva 19000, costo 500000` → 2 líneas; `totales.total === 61900000`.
  - `solo terceros`: `ta 0` → solo la línea `terceros`.
  - `sin líneas`: todo en 0 → lanza 422 `SIN_LINEAS`.
  - `plan con hijos`: plan + hotel hijo, cada uno con sus montos → cada uno aporta sus líneas una vez y cuadra con los
    totales.
  - `flotantes`: líneas `ta 0.1` y `ta 0.2`, total `0.3` → no lanza (enfoque de revisión 2).
  - `descuadre`: `ta_total` 1000 pesos mayor que la suma → lanza `DATOS_VENTA_INCONSISTENTES`.
  - `tercero del proveedor`: la línea `terceros` lleva `tercero.documento === '900123456'` para un proveedor con NIT
    `'900123456-8'` guardado así en Nexus, y su nombre.
  - `proveedor sin documento` → 422 con field `products.0.supplier` y el nombre del proveedor en el mensaje.
  - `servicio con costo sin proveedor` → 422 `PROVEEDOR_SIN_ASIGNAR`.
  - `crédito sin vencimiento` y `crédito vencido` (`fecha_vence_credito` ayer) → 422 en `creditDueDate`.
  - `pagada`: `fechaVencimiento === fechaEmision === hoy` y `formaPago.tipo === 'contado'`.
  - `varios errores a la vez`: cliente sin documento + proveedor sin documento → un solo 422 con los dos `details`.
  - `cliente sin documento` → 422 en `client.docNumber`.
- [ ] **Paso 2:** falla. **Paso 3:** implementar (función pura, sin Prisma). **Paso 4:** pasa.
- [ ] **Paso 5:** Commit, cuando el usuario lo pida.

---

## Fase 2 — Configuración, emisión y reanudación

### T8: Estados, contexto e integración del superadmin

**Archivos:** crear `estados.js`, `contexto.js`, `integracion.service.js`, `schemas/facturacion.schema.js`,
`controllers/facturacion.controller.js`, `tests/facturacion-api.js`; modificar `routes/companies.routes.js` y
`package.json` (`"test:facturacion-api": "node tests/facturacion-api.js"`).

**Produce:**
- `siguienteEstado(estado, resultado) → { estado, proximoIntentoAt | null, liberaIndice: boolean }`, donde `resultado`
  es `{ tipo: 'emitida' | 'pendiente_dian' | 'error', clase?, intentos }`. Reglas: error `DATOS` → `rechazada_datos`;
  error reintentable con `intentos < 2` → `en_proceso` con `proximoIntentoAt` en 30 s (60 s si es `LIMITE_PETICIONES`);
  error reintentable con `intentos >= 2` → `fallida_pasajera`; `CONFIGURACION`/`CREDENCIALES` → `fallida_pasajera`
  sin próximo intento.
- `construirContexto(integracion) → ctx`: descifra con `aadDe(...)`, arma `fetch` con `AbortSignal.timeout(conector.tiempoEsperaMs)` y
  `cacheToken` (un `Map` del módulo con clave `` `${integracion.id}:${integracion.credenciales_version}` ``).
  `olvidarToken(integracionId)` borra todas sus entradas.
- `integracion.service`: `obtener(empresaId)`, `guardar(empresaId, { software, habilitado, notaCreditoHabilitada,
  configuracion })` (valida `configuracion` con `esquemaConfiguracion` del conector y luego `validarConfiguracion`),
  `guardarCredenciales(empresaId, credenciales)` (recorta cada valor, valida con `esquemaCredenciales`, cifra, sube
  `credenciales_version`, `olvidarToken`, pone `estado = sin_configurar`), `probarConexion(empresaId)`,
  `retirar(empresaId)` (borra credenciales y configuración, `habilitado = false`). `guardar` con un `software` distinto
  del actual borra credenciales y configuración (`estado = sin_configurar`). Hoy no existe borrado de agencias; si se
  añade, debe llamar `retirar`. Todas dentro de
  `conEmpresa(empresaId)` y cada una escribe un `eventos_facturacion`. **Ninguna devuelve credenciales**: la vista
  pública es `{ software, habilitado, notaCreditoHabilitada, estado, pista, configuracion, ultimaVerificacion,
  ultimoError, capacidades }`.
- Rutas en `companies.routes.js` (el router ya aplica `auth` + `soloSuperadmin`): `GET/PUT/DELETE /:id/invoicing`,
  `PUT /:id/invoicing/credentials`, `POST /:id/invoicing/test`.

- [ ] **Paso 1: pruebas sin BD que fallan:** tabla de `siguienteEstado` (un caso por regla); `pista` de `'  abcd1234 \n'`
  es `'••••1234'` (enfoque de revisión 1).
- [ ] **Paso 2:** falla. **Paso 3:** implementar. **Paso 4:** pasa; `pnpm check:prisma`.
- [ ] **Paso 5 (con permiso):** `tests/facturacion-api.js` sobre `tests/montaje.js`, con `NODE_ENV=test` y
  `FACTURACION_CONECTOR_FALSO=siigo` en el servidor de prueba:
  - superadmin guarda credenciales → la respuesta no contiene el valor; ningún `GET` lo contiene (C2);
  - admin de agencia → `403` en todas las rutas `/companies/...`;
  - agencia B no ve la integración de A (C4).
- [ ] **Paso 6:** Commit, cuando el usuario lo pida.

### T9: Facturar, procesar, reintentar y reanudar

**Archivos:** crear `emision.service.js`, `reanudador.js`, `routes/facturacion.routes.js` (`GET /invoicing/status`);
modificar `routes/sales.routes.js`, `routes/index.js`, `src/index.js` (arranca el reanudador después de `listen`).

**Interfaces:**
- Consume: `armarFactura` (T7), `siguienteEstado`, `construirContexto` (T8), `obtenerConector`, `errorFacturacion`,
  `sanear` (T6), `ventaVisible(id, alcance, { paraEscribir })` de `ventasAlcance.js`, `transaccion` de `config/db.js`.
- Produce:
  - `solicitarFactura(ventaId, alcance, actor) → { id, estado, codigoReferencia }`: validación previa (orden de la spec,
    «Facturar», paso 2) → `transaccion` que inserta el documento (`clave_idempotencia` = `nx` + 28 caracteres
    aleatorios alfanuméricos, generada una vez; `proximo_intento_at = now() + tiempoEsperaMs + 30 s`, la reserva del
    primer intento;
    `emitido_por_id = null` y `actor_es_superadmin` en el evento si `actor` suplanta) y su evento; si choca el índice único (`P2002`), devuelve el documento
    vigente con `409 YA_FACTURADA` cuando está `emitida`, o el mismo documento si está en curso. Después del commit,
    `setImmediate(() => procesarDocumento(id, empresaId))`.
  - `procesarDocumento(documentoId, empresaId) → void`: dentro de `conEmpresa(empresaId)`; **reserva** el documento con un
    `UPDATE … SET proximo_intento_at = now() + (tiempoEsperaMs + 30 s) WHERE id = $1 AND proximo_intento_at <= now()`
    (0 filas → otro proceso lo tiene, sale). Nunca mantiene una transacción abierta mientras espera al software (el
    pooler de Supabase es de transacciones); si la integración no está `conectada` o no existe →
    `INTEGRACION_SIN_CONFIGURAR` (enfoque de revisión 5); `buscarTercero` del cliente y de cada `tercero` de las líneas
    (el primero que falte → `rechazada_datos` con `TERCERO_NO_EXISTE_EN_SOFTWARE` y `datos: { rol: 'cliente' |
    'proveedor', documento, nombre }`); si `intentos > 0` y el conector no tiene idempotencia, `buscarPorClave` primero
    (si encuentra, toma ese documento sin reenviar); `emitirFactura(ctx, snapshot, clave)` →
    aplica `siguienteEstado`; guarda `error_tecnico = sanear(...)`; si el error es `CREDENCIALES_INVALIDAS` persistente
    o `USUARIO_BLOQUEADO_SOFTWARE`, cambia el `estado` de la integración (corte por agencia).
  - `reintentar(documentoId, ventaId, alcance, actor)`: solo desde `fallida_pasajera` con clase reintentable → vuelve a
    `en_proceso` con la misma clave.
  - `listarDeVenta(ventaId, alcance) → Documento[]`: sin `snapshot` ni `error_tecnico`.
  - `iniciarReanudador({ intervaloMs = 60000 })`: corre una vez al arrancar y luego por intervalo; lee
    `app_facturacion_pendientes(20)` y llama `procesarDocumento` para cada uno; un error de un documento se registra
    (`[INVOICE_RESUMER_FAILED]`) y no detiene a los demás.
- Rutas: `POST /sales/:id/invoices` (`authorize('facturacion', 'create')`, rate limit propio: 10/min por usuario),
  `GET /sales/:id/invoices` (`authorize('facturacion', 'view')`), `POST /sales/:id/invoices/:docId/retry`
  (`authorize('facturacion', 'create')`); `GET /invoicing/status` → `{ habilitado, capacidades }`. Un middleware
  `moduloFacturacionActivo` responde `403 FACTURACION_NO_HABILITADA` antes del controlador, **solo en los `POST`**: con
  el módulo apagado, los documentos emitidos y sus PDF siguen visibles por `GET`.

- [ ] **Paso 1 (con permiso): pruebas API que fallan** en `tests/facturacion-api.js`:
  - `módulo apagado → 403` (C1).
  - `doble POST simultáneo → un solo documento` (`Promise.all` de dos POST; C5).
  - guion `["SOFTWARE_NO_DISPONIBLE","SOFTWARE_NO_DISPONIBLE"]` → termina en `fallida_pasajera` con
    `codigoReferencia` (C6).
  - guion `["DATOS_RECHAZADOS"]` → `rechazada_datos` y un nuevo POST crea otro documento (C7).
  - guion `["TIEMPO_AGOTADO","ok"]` → `emitida` y el falso registró una sola factura para esa clave (C8), en los dos
    modos: con idempotencia y con `FACTURACION_FALSO_IDEMPOTENCIA=0` (el núcleo usa `buscarPorClave`, E32).
  - `FACTURACION_FALSO_TERCEROS` sin el NIT del proveedor → `rechazada_datos` con `TERCERO_NO_EXISTE_EN_SOFTWARE` y
    `rol: 'proveedor'` (E7).
  - documento insertado en `en_proceso` con `proximo_intento_at` vencido + reanudador → `emitida` (C9).
  - dos `procesarDocumento` simultáneos sobre el mismo documento → el falso recibe una sola llamada.
  - documento pendiente cuya integración se retiró → `fallida_pasajera` con `INTEGRACION_SIN_CONFIGURAR` y
    `proximo_intento_at` nulo (enfoque de revisión 5).
  - superadmin suplantando factura → `emitido_por_id` nulo y evento con `actor_es_superadmin` (E26).
  - asesor `own` factura la venta de otro → `403`/`404` (C11); agencia B factura la venta de A → `404` (C4).
- [ ] **Paso 2:** falla. **Paso 3:** implementar. **Paso 4 (con permiso):** pasa; `pnpm check:prisma`,
  `pnpm test:facturacion`.
- [ ] **Paso 5:** Commit, cuando el usuario lo pida.

### T10: Nota crédito y anulación de una venta facturada

**Archivos:** crear `notaCredito.service.js`; modificar `services/sales.service.js` (`voidSale`, línea 594),
`services/ventasListado.js`, `schemas/sales.schema.js` (`listSalesQuerySchema`), `routes/sales.routes.js`.

**Produce:**
- `solicitarNotaCredito(documentoFacturaId, ventaId, { motivo, concepto }, alcance, actor) → { id, estado,
  codigoReferencia }`: exige `nota_credito_habilitada`, `capacidades.notaCredito` y factura `emitida` con el mismo
  `software` de la integración actual (si no → `NOTA_CREDITO_SOFTWARE_DISTINTO`). Reusa `procesarDocumento` (T9), que
  llama `emitirNotaCredito` cuando `tipo === 'nota_credito'`. Al quedar `emitida`, la factura pasa a
  `anulada_por_nota_credito`.
- Ruta `POST /sales/:id/invoices/:docId/credit-note` con `authorize('facturacion', 'credit_note')`; Zod: `motivo`
  5–255 recortado (como `voidSaleSchema`), `concepto` del enum que declare el conector.
- `voidSale`: si la venta tiene un documento `en_proceso` o `pendiente_dian` → `409 FACTURA_EN_CURSO`.
- `listSalesQuerySchema` añade `invoicing: z.enum(['sin_facturar', 'emitida', 'con_error', 'anulada_con_factura'])`
  opcional; `ventasListado.js` lo traduce a un `where` con `documentos_facturacion: { some / none }` usado **igual** por
  filas y `count`. `anulada_con_factura` = `status 'anulado'` + alguna factura `emitida` (D5).
- `GET /sales/:id` añade `facturaVigente: { numeroExterno } | null` para que la modal de anulación muestre el aviso.

- [ ] **Paso 1 (con permiso): pruebas API que fallan:** anular con factura en curso → `409`; filtro
  `anulada_con_factura` devuelve la venta y su `meta.total` coincide con las filas; nota crédito sin
  `nota_credito_habilitada` → `403`; nota crédito con guion `["ok"]` → factura `anulada_por_nota_credito` y la venta se
  puede facturar de nuevo (D7).
- [ ] **Paso 2:** falla. **Paso 3:** implementar. **Paso 4:** pasa (con permiso); `pnpm check:prisma`.
- [ ] **Paso 5:** Commit, cuando el usuario lo pida.

### T11: PDF y soporte del superadmin

**Archivos:** modificar `utils/almacenamiento.js` (`BUCKETS.facturas`: privado, 5 MB, `application/pdf`),
`emision.service.js`, `routes/sales.routes.js`, `routes/companies.routes.js`.

**Produce:**
- `guardarPdf(documentoId) → void`: `descargarPdf` del conector → `almacenamiento.subir('facturas', …)` → `pdf_ruta`.
  Se llama al pasar a `emitida`; si falla, el documento sigue `emitida` y se reintenta al pedir el PDF (E30).
- `GET /sales/:id/invoices/:docId/pdf` (`facturacion.view`) → `{ url }` firmada de 5 min.
- `GET /companies/invoicing/documents?ref=FAC-XXXXXX` → `app_facturacion_por_referencia` → lee con
  `conEmpresa(empresa_id)` → documento completo (incluye `error_tecnico` saneado y eventos).
- El bucket `facturas` se crea a mano en Supabase Storage (anotar en `tasks.md`).

- [ ] **Paso 1 (con permiso): pruebas API que fallan:** el PDF responde una URL firmada; la búsqueda por referencia la
  hace solo el superadmin (`403` para un admin) y encuentra el documento de cualquier agencia.
- [ ] **Paso 2:** falla. **Paso 3:** implementar. **Paso 4:** pasa (con permiso).
- [ ] **Paso 5:** Commit, cuando el usuario lo pida.

---

## Fase 3 — Proveedores reales e interfaz

### T12: Primer conector real — Siigo

Cada software contable nuevo (Karing, World Office, Alegra…) es **una tarea igual a esta**, con su anexo en la spec
(«Cómo incorporar un software contable nuevo»). Esta es la primera; los valores de Siigo salen del **anexo A** de la
spec y viven solo en `conectores/siigo.js`.

**Bloqueada hasta:** tener la empresa de pruebas de Siigo y confirmar los puntos «por confirmar» del anexo A.

**Archivos:** crear `conectores/siigo.js`; registrar en `conectores/index.js`; probar en `tests/facturacion.js` con un
`fetch` simulado.

**Produce:** el contrato completo del conector, con `capacidades = { factura: true, notaCredito: true, dianAsincrona:
<según confirmación>, idempotencia: true }` y `tiempoEsperaMs = 120000`. Lo propio de Siigo (URL base, `Partner-Id`,
`Idempotency-Key`, redondeo por ítem, traducción de errores) es exactamente lo que dice el anexo A.
`esquemaConfiguracion`: `{ documentoFacturaId, documentoNotaCreditoId?, productoPropioCodigo, productoTercerosCodigo,
impuestoIvaId, vendedorId, centroCostoId?, formasPago: { [metodoPagoIdNexus]: idSiigo }, formaPagoCreditoId,
enviarCorreoCliente: boolean }`, ajustado a lo que se confirme en el ambiente de pruebas (incluido cómo va el NIT del
proveedor en la línea de terceros).

- [ ] **Paso 1: pruebas que fallan** (fetch simulado): `Partner-Id` e `Idempotency-Key` van en el POST; la clave nunca
  supera 30 caracteres; cada fila de la traducción de errores del anexo A; un cuerpo HTML con 502 da `ERROR_SOFTWARE`
  (enfoque de revisión 4); `'900.123.456-8'` se busca como `'900123456'`; los `payments` suman exactamente el total con
  líneas `0.1 + 0.2`; la línea de terceros lleva el NIT del proveedor; el token se pide una vez para dos facturas
  seguidas con la misma `credenciales_version`.
- [ ] **Paso 2:** falla. **Paso 3:** implementar. **Paso 4:** pasa.
- [ ] **Paso 5 (con permiso, C13):** factura real en la empresa de pruebas de Siigo: emitida, aceptada, PDF guardado.
- [ ] **Paso 6:** Commit, cuando el usuario lo pida.

### T13: Interfaz

**Archivos:** crear `frontend/src/api/facturacion.ts`, `components/sales/detail/FacturacionSection.tsx`,
`components/companies/FacturacionPanel.tsx`; modificar el detalle de venta (`SaleDetailModal`), el filtro del listado
de `pages/Sales.tsx`, la modal de anulación y `pages/Companies.tsx`. Diseñar con `ui-ux-pro-max`.

**Interfaces:** consume las rutas de T8–T11 y los permisos `facturacion.*` vía `scopeOf`/`canView`.

- [ ] **Paso 1:** `FacturacionSection`: chip de estado, número, CUFE, PDF, mensaje y `codigoReferencia` cuando falla;
  botones según estado y permisos; consulta cada 3 s mientras esté `en_proceso`/`pendiente_dian`, con tope de 2 minutos
  y luego un botón «Actualizar».
- [ ] **Paso 2:** filtro «Facturación» del listado (4 valores de T10).
- [ ] **Paso 3:** aviso y confirmación en la modal de anulación cuando `facturaVigente` no es nulo; botón «Generar nota
  crédito» si aplica.
- [ ] **Paso 4:** `FacturacionPanel` en `/companies`: software contable, módulo, credenciales de solo escritura con
  `pista`, «Probar conexión», mapeo (formulario generado desde `esquemaConfiguracion` del conector), nota crédito, últimos
  eventos.
- [ ] **Paso 5:** `cd frontend && pnpm build` → sin errores.
- [ ] **Paso 6 (con permiso, en pantalla):** recorrer E1, E6, E10, E15 y E21 con el conector falso en local.
- [ ] **Paso 7:** Commit, cuando el usuario lo pida.

### T14: Cierre — aislamiento, documentación y CI

**Archivos:** `backend/tests/aislamiento-api.js`, `README.md`, `backend/CLAUDE.md`, `.claude/rules/security.md`,
`.claude/rules/testing.md`, `docs/architecture/overview.md`, `.github/workflows/ci.yml`.

- [ ] **Paso 1:** ampliar `aislamiento-api.js` con los casos de C4 que aún no cubra `facturacion-api.js` (documentos,
  PDF y búsqueda por referencia entre agencias).
- [ ] **Paso 2:** C14: prueba que siembra una credencial conocida, fuerza errores con el falso y busca el valor en
  `error_tecnico`, `eventos_facturacion.detalle` y la salida del servidor de prueba → cero apariciones.
- [ ] **Paso 3:** documentos de la lista de la spec («Documentos a actualizar»); `test:facturacion` en CI.
- [ ] **Paso 4 (con permiso):** `test:aislamiento-api` y `test:facturacion-api` en verde.
- [ ] **Paso 5:** Commit, cuando el usuario lo pida.

## Fuera de este plan

- **Conector Karing y los demás software contables:** se planifica en cuanto Karing entregue su documentación, respondiendo primero la lista de 10
  preguntas de la spec. Añade un valor al enum `SoftwareContable` (migración) y un archivo en `conectores/`.
- Migrar montos de `Float` a `Decimal`.
