# Spec 037 — Facturación electrónica por agencia con su software contable

**Estado:** diseño aprobado (2026-11-01), sin implementar · **Rama:** `feat-bayrol` · **Toca la base compartida:** sí
(tablas nuevas, columnas nuevas en `proveedores`, módulo de permisos nuevo; todo aditivo) · **Relacionadas:** 001/002
(multiempresa), 003 (validación de documentos), 005 (IVA sobre la TA), 016 (se quitó el enlace a Siigo), 025/027/033
(permisos), 029 (configuración por agencia desde `/companies`), 030 (proveedores por agencia), 031 (Storage), 034
(respuesta mínima)

## Vocabulario

Para que nadie confunda los dos sentidos de «proveedor»:

| Término | Qué es |
|---|---|
| **Software contable** | el sistema donde la agencia lleva su contabilidad y emite la factura electrónica ante la DIAN: Siigo, Karing, World Office, Alegra, Helisa… |
| **Conector** | el código de Nexus que habla con **un** software contable (`services/facturacion/conectores/<software>.js`) |
| **Proveedor** | la aerolínea, el hotel, el operador: la tabla `proveedores`. En la factura es el **tercero** del ingreso para terceros |
| **Tercero** | una persona o empresa registrada en el software contable: el cliente y los proveedores |

## Por qué

Cada agencia factura en su propio software contable. Hoy el asesor registra la venta en Nexus y alguien la vuelve a
digitar allá para emitir la factura electrónica: doble trabajo y errores de transcripción. La spec 016 quitó el antiguo
botón «S» porque solo era un enlace a Siigo; nunca hubo integración real.

Se quiere que cada agencia conecte **su** cuenta de **su** software contable y facture una venta desde Nexus con un
botón. El diseño es general, para cualquier software contable con API, cada uno con sus reglas. Siigo es solo el primer
conector.

## Qué se quiere (confirmado con el usuario, brainstorming 2026-11-01)

1. **Módulo opcional por agencia.** Solo lo tienen las agencias a las que el **superadmin** se lo activa.
2. **El superadmin (el equipo de desarrollo) configura todo:** activa el módulo, elige el software contable, escribe las
   credenciales y el mapeo. La agencia no ve ni escribe credenciales.
3. **Un botón «Facturar»**, con ese texto genérico, sin nombrar el software. La factura se emite cuando alguien lo
   pulsa, no al registrar la venta.
4. **Se puede facturar una venta en `credito`, `abonado` o `pagado`.** Nunca una `anulado`.
5. **Contenido de la factura:** la **TA con su IVA (19%)** como ingreso propio y el **costo del proveedor como ingreso
   para terceros**.
6. **El ingreso para terceros se hace con el NIT del proveedor registrado en cada servicio de la venta.**
7. **Siempre a nombre del cliente de la venta.** Nunca otro pagador.
8. **Los terceros se registran en el software contable, no en Nexus.** Nexus los relaciona **por número de documento**,
   como la agencia ya lo hacía. El documento debe estar bien escrito en los dos lados. **Tanto el cliente como cada
   proveedor de la venta deben existir como terceros en el software contable.**
9. **La fecha de la factura es la de emisión.** La factura **siempre tiene fecha de vencimiento**; normalmente es a
   crédito.
10. **Nota crédito como capacidad aparte**, con su propio botón «Generar nota crédito». Solo aparece si el software la
    soporta **y** el superadmin la activó porque la agencia la pidió. La decide siempre el usuario.
11. **Reintentos:** si la factura falla, se intenta **una segunda vez según el tipo de error**. Si vuelve a fallar, la
    agencia avisa al equipo.
12. **Software contables en general**, no solo Siigo y Karing: vendrán muchos, cada uno con sus reglas. Se agregan uno
    a uno, con un conector cada uno.
13. **Credenciales protegidas:** la clave de cifrado vive solo en Render. El equipo pasará luego a BD locales con
    Docker; hasta entonces dev y prod comparten la BD de Supabase.
14. **Seguridad primero** y aislamiento total entre agencias.
15. **Proveedores con documento** (fase 0): tipo de documento y documento, con todas las validaciones, en `proveedores`.

## Fuera de alcance

- Facturar automáticamente al registrar una venta.
- Facturar por partes o por abono. Siempre es **una factura por el total de la venta**.
- Registrar abonos o recibos de caja en el software contable, o sincronizar pagos.
- Crear o editar terceros (clientes o proveedores) en el software contable.
- Más de un software contable activo por agencia.
- Las demás funciones de cada software (reservas en Karing, inventario en Siigo…).
- Nota crédito parcial. La nota crédito reversa la factura completa.
- Software contables sin API (importación de archivos): un conector siempre habla con una API.
- Que la agencia configure su integración por sí misma.

## Decisiones tomadas en el diseño (no las dijo el usuario; revisar)

- **D1. Proceso en segundo plano.** «Facturar» responde `202` en el acto y el envío ocurre por detrás. Validar ante la
  DIAN puede tardar decenas de segundos según el software (Siigo recomienda esperar 120 s). Ni el rewrite de Vercel ni
  una petición del navegador deben esperar eso.
- **D2. Una factura vigente por venta**, garantizada por un índice único parcial en la base.
- **D3. Vencimiento.** Venta `credito`/`abonado` → `ventas.fecha_vence_credito`, que el alta de una venta a crédito ya
  exige (`creditDueDate`). Si una venta antigua no la tiene, o ya pasó, → `422` en `creditDueDate` para que la
  actualicen antes de facturar. Venta `pagado` → contado, con vencimiento igual a la fecha de emisión.
- **D5. «Anulada con factura vigente» se deriva, no se guarda** (como `critico` en vuelos).
- **D6. Anular una venta facturada se permite**, con confirmación explícita y aviso.
- **D7. Tras una nota crédito, la venta se puede volver a facturar** si no está anulada.
- **D8. El PDF de la factura se copia a un bucket privado `facturas`**, por empresa. Sigue disponible aunque cambie el
  software o sus credenciales. Se sirve con URL firmada de 5 minutos.
- **D9. Correo al cliente:** si el software puede enviarlo, es una opción del mapeo por agencia, apagada por defecto.
- **D10. «Reintentar» manual** solo para fallos pasajeros, sin poder duplicar. Los errores de datos se corrigen y se
  vuelve a pulsar «Facturar».
- **D11. Moneda: COP.** Nexus no guarda moneda en las ventas.
- **D12. Código de referencia de soporte** aleatorio y global (`FAC-7K2Q9M`), no derivado de ids internos.

## Arquitectura

Tres piezas. El núcleo no sabe qué software contable hay detrás; el conector no sabe nada de ventas ni de permisos.

```
Venta ──► Núcleo de facturación ──► Conector del software ──► API del software contable
            │ arma, valida, estados,       │ traduce: autenticación,
            │ reintentos, bitácora         │ formato, redondeo, errores
            ▼                               ▼
   documentos_facturacion        catálogo común de errores
```

### 1. Núcleo (`services/facturacion/`)
- Construye la **factura neutral** desde la venta.
- Validación previa local, sin llamar al software.
- Máquina de estados, reintentos, reanudador, bitácora, PDF, permisos y alcance.
- Único que escribe en `documentos_facturacion` y `eventos_facturacion`.

### 2. Conector por software contable (`services/facturacion/conectores/<software>.js`)
Contrato fijo:

```js
module.exports = {
  id: 'siigo',                        // valor del enum SoftwareContable
  nombre: 'Siigo Nube',
  capacidades: {
    factura: true,
    notaCredito: true,
    dianAsincrona: true,              // el estado DIAN llega después de crear
    idempotencia: true,               // el software evita duplicados con una clave
  },
  tiempoEsperaMs: 120000,             // cuánto esperar al crear un documento
  conceptosNotaCredito: [...],        // los que acepta, si hay nota crédito
  esquemaCredenciales,                // Zod: qué pide (usuario, clave, token…)
  esquemaConfiguracion,               // Zod: el mapeo de la agencia en ese software
  async probarConexion(ctx),
  async validarConfiguracion(ctx),    // cada id del mapeo existe y está activo allá
  async buscarTercero(ctx, { tipoDocumento, documento }),   // cliente o proveedor; null si no existe
  async emitirFactura(ctx, factura, claveIdempotencia),
  async buscarPorClave(ctx, claveIdempotencia),             // obligatorio si idempotencia = false
  async consultarEstado(ctx, refExterna),
  async emitirNotaCredito(ctx, refFactura, { motivo, concepto }, claveIdempotencia),
  async descargarPdf(ctx, refExterna),
  traducirError(errorCrudo),          // → { codigo, clase, mensaje, detalleTecnico }
};
```

- `ctx` lleva las credenciales descifradas, la configuración, un `fetch` con el `tiempoEsperaMs` del conector y la
  caché de token **de esa integración**. El conector **no guarda estado propio** entre llamadas.
- La **URL base** es una constante del conector, nunca un dato configurable (anti-SSRF). Si un software usa un
  subdominio por cliente, el conector valida el subdominio contra un patrón fijo.
- Redondeos, normalización del documento, formato del payload, límites de peticiones y cualquier cabecera propia viven
  **solo** en el conector.
- **Idempotencia:** si el software no la ofrece, el conector implementa `buscarPorClave`. El núcleo, antes de reenviar
  un documento con resultado incierto, pregunta si ya existe. La clave viaja en un campo de referencia del documento
  (observaciones o similar).
- Una capacidad apagada lanza `NO_SOPORTADO`; el núcleo nunca la llama.
- Registro: `conectores/index.js` con un mapa `{ siigo, … }`. **Añadir un software = un archivo + una entrada en el
  mapa + un valor del enum** (migración), sin tocar el núcleo, las ventas ni el botón.

### 3. Configuración por agencia
Tabla `integraciones_facturacion`, escrita solo por el superadmin.

## Modelo de datos

Todas las tablas nuevas siguen el patrón de tenencia existente: `empresa_id NOT NULL` con el default de
`app.empresa_id`, política RLS, permisos solo para `app_nexus`, `@@unique([id, empresa_id])` y FKs compuestas. Nunca
`where empresa_id` a mano.

### `integraciones_facturacion` (una por agencia)
| Columna | Tipo | Nota |
|---|---|---|
| `id`, `empresa_id` | int | `empresa_id` **único**: una integración por agencia |
| `software` | enum `SoftwareContable` | crece con cada conector |
| `habilitado` | bool | el módulo encendido/apagado por el superadmin |
| `nota_credito_habilitada` | bool | la agencia la pidió; además el conector debe soportarla |
| `estado` | enum: `sin_configurar`, `conectada`, `credenciales_invalidas`, `bloqueada_por_software`, `suspendida` | |
| `credenciales_cifradas`, `credenciales_iv`, `credenciales_tag` | bytea | AES-256-GCM |
| `clave_version` | int | versión de la clave maestra usada |
| `credenciales_pista` | text | últimos 4 caracteres, para mostrar `••••a1f3` |
| `credenciales_version` | int | sube en cada cambio; invalida la caché de token |
| `configuracion` | jsonb | el mapeo, validado por `esquemaConfiguracion` del conector |
| `ultima_verificacion`, `ultimo_error` | timestamptz, text | |
| `creado_at`, `updated_at` | | |

### `documentos_facturacion` (cada factura o nota crédito)
| Columna | Tipo | Nota |
|---|---|---|
| `id`, `empresa_id` | int | |
| `venta_id` | int | FK compuesta `(venta_id, empresa_id) → ventas` |
| `tipo` | enum `factura`, `nota_credito` | |
| `factura_id` | int? | en una nota crédito, la factura que reversa (FK compuesta) |
| `software` | enum | el software con que se emitió (la integración puede cambiar) |
| `estado` | enum, ver «Estados» | |
| `clave_idempotencia` | text | ≤ 30 alfanuméricos, fija para la vida del documento |
| `codigo_referencia` | text | `FAC-XXXXXX`, único global |
| `intentos` | int | |
| `ref_externa`, `numero_externo`, `cufe` | text? | lo que devuelve el software |
| `estado_dian` | text? | tal cual lo informa el software |
| `fecha_emision`, `fecha_vencimiento` | date | días de Bogotá |
| `pdf_ruta` | text? | ruta en el bucket `facturas` |
| `motivo`, `concepto` | text? | obligatorios en nota crédito |
| `error_codigo`, `error_mensaje` | text? | del catálogo común |
| `error_tecnico` | jsonb? | respuesta del software **saneada** |
| `snapshot` | jsonb | la factura neutral enviada |
| `emitido_por_id` | int? | FK compuesta a `usuarios`; `null` si actuó el superadmin suplantando |
| `proximo_intento_at` | timestamptz? | reserva y próximo intento del reanudador |
| `creado_at`, `updated_at` | | |

- **Índice único parcial**: una sola `factura` por venta con `estado` en (`en_proceso`, `pendiente_dian`, `emitida`,
  `fallida_pasajera`). Igual para `nota_credito` por `factura_id`.

### `eventos_facturacion` (bitácora inmutable)
`id, empresa_id, documento_id?, integracion_id?, tipo, actor_usuario_id?, actor_es_superadmin, detalle jsonb (saneado),
creado_at`. `app_nexus` tiene solo `INSERT` y `SELECT`: no se puede editar ni borrar desde la aplicación.

### `proveedores` (fase 0)
`tipo_documento_id int?` (FK a `tipos_documento`) y `documento text?`. Ver «Fase 0».

### Funciones de apoyo (`SECURITY DEFINER`, como `app_identidad_por_correo`)
- `app_facturacion_pendientes(p_limite)` → `(documento_id, empresa_id)` de documentos en curso con
  `proximo_intento_at` vencido. El reanudador procesa cada uno dentro de `conEmpresa(empresa_id)`.
- `app_facturacion_por_referencia(p_codigo)` → `(documento_id, empresa_id)` para soporte.

### Permisos (módulo nuevo `facturacion`)
| Acción | Qué permite | Alcance |
|---|---|---|
| `view` | ver el estado de facturación de una venta y descargar el PDF | `all`/`own`/`none` |
| `create` | «Facturar» y «Reintentar» | `all`/`own`/`none` |
| `credit_note` | «Generar nota crédito» | `all`/`own`/`none` |

Admin y superadmin: todo. Asesor y freelancer: configurables, por defecto `view: own` y el resto `none`. Se tocan
`roles.service.js`, `authorize.js`, `frontend/src/types/index.tsx` y `SCOPED_ACTIONS` en los dos lados
(`utils/alcancePermisos.js` y `types/index.tsx`). Con el módulo apagado, los `POST` responden
`403 FACTURACION_NO_HABILITADA` aunque el rol tenga el permiso. Los `GET` siguen mostrando lo emitido.

## Construcción de la factura (neutral)

```js
{
  venta: { id, numero },
  cliente: { tipoDocumento, documento },                 // normalizado
  fechaEmision: 'AAAA-MM-DD',                            // día de Bogotá en que se emite
  fechaVencimiento: 'AAAA-MM-DD',                        // D3: siempre presente
  formaPago: { tipo: 'credito' | 'contado', metodoPagoId? },
  lineas: [
    { tipo: 'propio',   categoria, descripcion, base: ta, iva },
    { tipo: 'terceros', categoria, descripcion, base: costo_proveedor, iva: 0,
      tercero: { tipoDocumento, documento, nombre } },   // el proveedor del servicio, por su NIT
  ],
  totales: { propio, iva, terceros, total },
  observaciones: 'Venta Nexus #<numero>',
}
```

- Sale de `detalle_venta`: una línea `propio` por servicio con `ta > 0` y una línea `terceros` por servicio con
  `costo_proveedor > 0`. Los servicios hijos de un plan (`parentDetalleId`) entran una sola vez, con sus montos.
- **Cada línea de terceros lleva el documento de su proveedor** (`detalle_venta.proveedor_id → proveedores`). Un
  servicio con costo sin proveedor → `422 PROVEEDOR_SIN_ASIGNAR`; con proveedor sin documento →
  `422 PROVEEDOR_SIN_DOCUMENTO`, nombrando el servicio y el proveedor, para completarlo en Configuración.
- **Invariante antes de enviar:** la suma de líneas cuadra con `ventas.ta_total`, `iva_total` y
  `costo_proveedor_total` (tolerancia: 50 centavos). Si no → `DATOS_VENTA_INCONSISTENTES` y no se envía nada.
- Montos en **centavos enteros** antes de sumar (la base los guarda como `Float`). El redondeo propio de cada software
  lo aplica su conector.
- El IVA es el `iva` guardado en cada línea (`saleTotals.js`); nunca se recalcula distinto.

## Estados de un documento

```
            ┌──────────── error de datos ────────────► rechazada_datos (final; corregir y «Facturar» de nuevo)
            │
en_proceso ─┼── OK, DIAN síncrona ─────────────────────► emitida
            │
            ├── OK, DIAN asíncrona ──► pendiente_dian ─┬► emitida
            │                                          └► rechazada_dian (final)
            │
            └── error pasajero ──► (1 reintento automático) ──► fallida_pasajera
                                                                  │  «Reintentar» (misma clave)
                                                                  └──► en_proceso
emitida ── nota crédito emitida ──► anulada_por_nota_credito
```

- `fallida_pasajera` **no libera** el índice único: el resultado real es incierto, así que el siguiente intento reusa
  la clave (con idempotencia del software, o `buscarPorClave` antes de reenviar).
- `rechazada_datos` y `rechazada_dian` sí lo liberan.
- Solo `emitida` cuenta como «facturada».

## Flujos

### Activar y configurar (superadmin, en `/companies/:id`)
1. Elige el software contable y enciende el módulo → `estado = sin_configurar`.
2. Escribe las credenciales (formulario generado desde `esquemaCredenciales`). El servidor las cifra; **nunca las
   devuelve**, solo `pista` y `estado`.
3. «Probar conexión». OK → `conectada`; falla → `credenciales_invalidas` con el motivo.
4. Carga el mapeo. Al guardar, `validarConfiguracion` comprueba contra el software que cada id exista y esté activo.
5. Activa o no la nota crédito (solo si el conector la soporta).
Cada paso deja un evento en la bitácora.

### Facturar (usuario de la agencia)
1. `POST /api/v1/sales/:id/invoices` → `auth`, módulo activo, `authorize('facturacion', 'create')` con alcance.
2. Validación previa local, sin llamar al software (no gasta peticiones ni suma errores allá):
   - integración `conectada`;
   - venta no `anulado` y sin factura vigente;
   - cliente con tipo de documento y documento válidos;
   - cada servicio con costo tiene proveedor con documento válido;
   - vencimiento presente y no anterior a hoy (D3);
   - invariante de montos; al menos una línea.
   Cualquier fallo → `422` con `error.details` por campo.
3. En una `transaccion`: inserta el documento (`en_proceso`, clave, código de referencia, `snapshot`, fechas) y su
   evento. El índice único resuelve la carrera entre dos clics.
4. Responde `202 { id, estado, codigoReferencia }`.
5. Después del commit: descifra credenciales → `buscarTercero` del cliente y de cada proveedor (si alguno no existe →
   `rechazada_datos` con `TERCERO_NO_EXISTE_EN_SOFTWARE`, diciendo cuál) → `emitirFactura` con la clave → guarda el
   resultado → copia el PDF.
6. La pantalla consulta el estado cada pocos segundos mientras esté en curso, con un tope de tiempo y luego un botón
   «Actualizar».

### Reanudador
- Al arrancar el servidor y cada minuto: toma de `app_facturacion_pendientes()` los documentos con
  `proximo_intento_at` vencido y **reserva** cada uno con un `UPDATE` condicional que corre `proximo_intento_at` unos
  minutos (si no actualiza ninguna fila, otro proceso lo tiene). No hay bloqueos de fila mientras se espera al software:
  una transacción abierta durante la espera ocuparía una conexión del pooler.
- Casos: un `en_proceso` huérfano (Render se durmió o reinició a mitad) → reenvío con la misma clave; `pendiente_dian`
  → `consultarEstado`.
- Mientras Render free duerme no corre nada; al despertar se pone al día. Aceptable con facturación manual.

### Nota crédito
- Solo si `nota_credito_habilitada` **y** `capacidades.notaCredito` **y** permiso `facturacion.credit_note`.
- `POST /api/v1/sales/:id/invoices/:documentoId/credit-note` con `motivo` (5–255) y `concepto` (de los que declara el
  conector). Mismo flujo asíncrono, estados y reintentos. Al quedar `emitida`, la factura pasa a
  `anulada_por_nota_credito`.

### Anular una venta facturada
- La modal de anulación muestra el aviso: «Esta venta tiene la factura electrónica FV-1-123 en tu software contable.
  Anularla aquí **no** la anula allá», con confirmación explícita.
- Si la nota crédito está disponible, ofrece el botón «Generar nota crédito» ahí mismo. No se encadena sola.
- La venta queda en el filtro derivado «Anulada con factura vigente».
- Con un documento en curso, la anulación responde `409` («Hay una factura en curso; espera a que termine»).

### Cambios de la integración
- **Cambiar credenciales:** sube `credenciales_version` → la caché de token se invalida. Lo que esté en curso se
  reintenta con las nuevas.
- **Apagar el módulo:** se ocultan los botones y los `POST` responden `403`. Lo emitido sigue visible. Lo que esté en
  curso termina su ciclo.
- **Cambiar de software:** las facturas viejas conservan su `software`. Credenciales y mapeo se borran. La nota crédito
  de una factura vieja solo se emite con el software original; si ya no está configurado →
  `NOTA_CREDITO_SOFTWARE_DISTINTO`, se hace a mano allá.
- **Retirar la integración:** se destruyen credenciales y caché. Hoy no existe borrado de agencias; si se añade, debe
  retirar la integración.

## Catálogo común de errores

Cada conector traduce los errores de su software a estos códigos. La **clase** decide el reintento.

| Código Nexus | Clase | Ejemplo típico del software | Reintento | Qué ve el usuario | Quién actúa |
|---|---|---|---|---|---|
| `FACTURACION_NO_HABILITADA` | configuración | — | no | «La facturación electrónica no está activa para tu agencia» | superadmin |
| `INTEGRACION_SIN_CONFIGURAR` | configuración | — | no | «Falta configurar la facturación. Contacta a soporte» | superadmin |
| `CREDENCIALES_INVALIDAS` | credenciales | HTTP 401, token vencido | 1 vez renovando el token; si persiste, no | «No pudimos conectar con tu software contable. Contacta a soporte (FAC-…)» | superadmin |
| `USUARIO_BLOQUEADO_SOFTWARE` | credenciales | el software suspendió el usuario de API | no | igual; la integración pasa a `bloqueada_por_software` | superadmin con el software |
| `PERMISO_SOFTWARE` | credenciales | HTTP 403 | no | «El usuario del software contable no tiene permiso para facturar» | agencia/superadmin |
| `CLIENTE_SIN_DOCUMENTO` | datos (local) | — | no | campo señalado | usuario |
| `PROVEEDOR_SIN_ASIGNAR` | datos (local) | — | no | «El servicio X tiene costo pero no tiene proveedor» | usuario |
| `PROVEEDOR_SIN_DOCUMENTO` | datos (local) | — | no | «El proveedor Y no tiene NIT. Complétalo en Configuración» | admin de la agencia |
| `VENTA_SIN_VENCIMIENTO` | datos (local) | — | no | campo `creditDueDate` señalado | usuario |
| `TERCERO_NO_EXISTE_EN_SOFTWARE` | datos | la búsqueda por documento no encuentra | no | «El {cliente/proveedor} con documento X no está registrado en tu software contable. Regístralo con el mismo documento y vuelve a facturar» | agencia |
| `MAPEO_INVALIDO` | configuración | un producto, impuesto o forma de pago del mapeo ya no existe | no | «Hay un dato de configuración que ya no existe en tu software. Contacta a soporte (FAC-…)» | superadmin |
| `DATOS_RECHAZADOS` | datos | HTTP 400/422 por un campo | no | mensaje traducido + referencia | soporte (suele ser un bug del conector) |
| `DATOS_VENTA_INCONSISTENTES` | datos (local) | — | no | «Los montos de la venta no cuadran. Contacta a soporte (FAC-…)» | soporte |
| `DOCUMENTO_DUPLICADO` | resuelto | «ya existe» | — | no se muestra: se toma el documento existente | — |
| `RECHAZO_DIAN` | datos | estado DIAN rechazado | no | motivo de la DIAN traducido + referencia | agencia/soporte |
| `LIMITE_PETICIONES` | pasajero | HTTP 429 | 1 vez, con espera creciente | «Tu software contable está ocupado; reintentando…» | — |
| `SOFTWARE_NO_DISPONIBLE` | pasajero | HTTP 502/503/504, red caída, mantenimiento | 1 vez | «No hubo respuesta de tu software contable» + «Reintentar» | usuario; si persiste, soporte |
| `TIEMPO_AGOTADO` | pasajero (resultado incierto) | sin respuesta en `tiempoEsperaMs` | 1 vez, **misma clave** | igual | — |
| `NO_SOPORTADO` | configuración | — | no | la acción no se ofrece | — |
| `NOTA_CREDITO_SOFTWARE_DISTINTO` | configuración | — | no | «Esta factura se emitió con otro software; haz la nota crédito allá» | agencia |
| `ERROR_SOFTWARE` | desconocido | HTTP 500, respuesta no JSON | 1 vez | «Error del software contable. Contacta a soporte (FAC-…)» | soporte |
| `ERROR_INTERNO` | interno | bug de Nexus | no | mensaje genérico + referencia | soporte |

Reglas:
- **Los errores de datos y configuración nunca se reintentan solos.** Repetirlos solo suma errores, y algunos software
  penalizan tasas altas de error suspendiendo el usuario de API (Siigo lo hace si superan el 80% en 7 días).
- **Corte por agencia:** un `CREDENCIALES_INVALIDAS` persistente o un bloqueo cambian el `estado` de la integración.
  Desde ahí el botón queda deshabilitado con el aviso, **sin llamar al software**, hasta que el superadmin pruebe la
  conexión de nuevo.
- Tras el reintento automático fallido, el documento queda `fallida_pasajera` con el código de referencia visible.
- El mensaje al usuario es en español y sin detalles técnicos; el detalle técnico va a `error_tecnico` y a la bitácora.

## Escenarios y cómo se manejan

| # | Escenario | Manejo |
|---|---|---|
| E1 | Doble clic en «Facturar» o dos pestañas a la vez | El índice único deja pasar uno; el otro recibe el documento existente |
| E2 | El servidor se reinicia o duerme a mitad del envío | Queda `en_proceso`; el reanudador reenvía con la misma clave |
| E3 | Tiempo agotado, pero el software sí creó la factura | Reintento con la misma clave (o `buscarPorClave`) → se toma la existente → `emitida` |
| E4 | El software responde OK pero la DIAN tarda | `pendiente_dian`; el reanudador y la pantalla consultan el estado |
| E5 | La DIAN rechaza | `rechazada_dian` con el motivo traducido; se libera para corregir y volver a facturar |
| E6 | El cliente no existe en el software contable | `rechazada_datos` con instrucción clara |
| E7 | Un proveedor de la venta no existe como tercero en el software | Igual que E6, nombrando al proveedor |
| E8 | El documento está escrito distinto en los dos lados | El conector normaliza (sin puntos, guiones ni espacios; NIT sin DV si el software lo guarda así). Si aun así no casa → E6/E7 |
| E9 | El cliente de la venta no tiene documento | Validación local → `422` |
| E10 | Un servicio con costo no tiene proveedor, o el proveedor no tiene NIT | Validación local → `422` nombrando servicio y proveedor |
| E11 | Venta a crédito sin vencimiento, o con el vencimiento ya pasado | `422` en `creditDueDate` (D3) |
| E12 | Credenciales revocadas o cambiadas en el software | `CREDENCIALES_INVALIDAS` → corte por agencia → soporte |
| E13 | El software suspendió el usuario de API por exceso de errores | `bloqueada_por_software`; nada se envía hasta que el superadmin lo resuelva |
| E14 | Límite de peticiones | Un reintento con espera |
| E15 | Mantenimiento o caída del software | Reintento; luego `fallida_pasajera` + «Reintentar» + referencia |
| E16 | Borraron en el software un producto o impuesto del mapeo | `MAPEO_INVALIDO` → soporte reconfigura |
| E17 | Los montos de la venta no cuadran con sus líneas | `DATOS_VENTA_INCONSISTENTES` antes de enviar |
| E18 | Venta con plan y servicios hijos | Cada servicio aporta sus líneas una vez; el invariante lo verifica |
| E19 | Venta sin TA (solo terceros) o sin costo (solo propio) | Se facturan solo las líneas con monto; sin ninguna → `422` |
| E20 | Se intenta anular una venta con factura en curso | `409` |
| E21 | Se anula una venta ya facturada | Aviso + confirmación; nota crédito opcional; filtro derivado |
| E22 | Abonos registrados después de facturar a crédito | No tocan la factura (fuera de alcance) |
| E23 | El superadmin apaga el módulo con documentos en curso | Terminan su ciclo; lo emitido sigue visible |
| E24 | El superadmin cambia credenciales con documentos en curso | La caché se invalida por versión; los reintentos usan las nuevas |
| E25 | La agencia cambia de software contable | Las facturas viejas conservan su software; nota crédito de una vieja → a mano |
| E26 | El superadmin factura suplantando a la agencia | `emitido_por_id = null`; la bitácora marca `actor_es_superadmin` |
| E27 | Un asesor con alcance `own` intenta facturar la venta de otro | `403` (o `404` si ni la ve) |
| E28 | Una agencia intenta facturar o ver documentos de otra | RLS no devuelve la fila → `404`; la FK compuesta impide referenciarla |
| E29 | El software cambia su API | Aparece como `DATOS_RECHAZADOS`/`ERROR_SOFTWARE` con referencia; se corrige solo su conector |
| E30 | Factura emitida, pero el PDF no se pudo copiar | Sigue `emitida`; el PDF se reintenta en el reanudador y al pedirlo |
| E31 | Se intenta facturar una venta ya facturada | `409` con la factura existente |
| E32 | Un software sin idempotencia y un resultado incierto | `buscarPorClave` antes de reenviar; si ya existe, se toma |

## Seguridad (primero)

### Aislamiento entre agencias
- RLS + default de `empresa_id` + FKs compuestas en las tablas nuevas: un bug en el código no basta para cruzar datos.
- Las credenciales **solo** se leen dentro de `conEmpresa(...)` de la agencia de la venta.
- **Conectores sin estado.** Cada operación recibe un `ctx` armado para esa integración. La caché de tokens tiene como
  clave `integracion_id + credenciales_version`; no existe un cliente HTTP compartido con un token adentro.
- La configuración solo se escribe por `/api/v1/companies/:id/invoicing…` con `soloSuperadmin` y `conEmpresa(id)`, el
  patrón de logo y suplantación. Es el **único** lugar donde la empresa viene de la URL.
- La clave de idempotencia es aleatoria por documento, nunca reutilizable entre agencias.

### Credenciales
- **AES-256-GCM** con `crypto` de Node. **Dato autenticado (AAD) = `empresa_id:software:integracion_id`**: un secreto
  copiado a la fila de otra agencia **no descifra**.
- Clave maestra `FACTURACION_CLAVE_MAESTRA` (32 bytes en base64) **solo en Render**. Nadie la tiene en su `.env` local
  mientras dev y prod compartan la BD. Con BD locales en Docker, cada entorno tiene la suya.
- `clave_version` permite rotarla: un script (con permiso) re-cifra; mientras tanto el servidor acepta las dos.
- Sin clave maestra válida, el módulo responde `503 FACTURACION_NO_DISPONIBLE` y el resto de la app funciona igual.
- **Solo escritura:** ninguna respuesta incluye credenciales, ni para el superadmin; solo `pista`.
- Se destruyen al retirar la integración.

### Hacia el software contable
- URL base fija en el conector (anti-SSRF). Solo HTTPS. Tiempo de espera explícito.
- Se envía solo lo que la factura necesita.

### Registros
- Nunca se registran tokens, cabeceras de autorización, credenciales ni cuerpos completos. `error_tecnico` y la
  bitácora guardan la respuesta **saneada** por una función única de saneo.
- Logs ad hoc en inglés con etiqueta (`[INVOICE_SOFTWARE_FAILED]`, `[INVOICE_RESUMER_FAILED]`), con
  `codigo_referencia`, sin datos personales.
- `eventos_facturacion` es solo inserción para `app_nexus`.

### Autorización
- Permisos `facturacion.view/create/credit_note` con alcance, aplicados por `authorize` en el servidor.
- Rate limit propio en los `POST` de facturar y nota crédito.
- Respuesta mínima (spec 034): el `GET` de la agencia no devuelve `snapshot` ni `error_tecnico`; solo el superadmin los
  ve, para soporte.

### Soporte del equipo
- `GET /api/v1/companies/invoicing/documents?ref=FAC-XXXXXX` (solo superadmin) ubica el documento en cualquier agencia
  con `app_facturacion_por_referencia` y lo lee con `conEmpresa` de la agencia dueña.

## Interfaz

Se diseña con `ui-ux-pro-max` al construir. Lo mínimo:
- **Detalle de venta:** sección «Facturación electrónica» (módulo activo y `facturacion.view`): estado, número, CUFE,
  fechas de emisión y vencimiento, PDF, mensaje y código de referencia cuando falla; botones «Facturar», «Reintentar»,
  «Generar nota crédito» según estado y permisos.
- **Listado de ventas:** filtro «Facturación» (sin facturar, emitida, con error, anulada con factura vigente).
- **Modal de anulación:** el aviso de E21.
- **Panel del superadmin (`/companies/:id`):** software contable, módulo, credenciales (solo escritura, con `pista`),
  «Probar conexión», mapeo (formulario según el conector), nota crédito y últimos eventos.
- **Proveedores (Configuración):** tipo de documento y documento (fase 0).

## API (resumen)

| Método y ruta | Quién | Respuesta |
|---|---|---|
| `GET /companies/:id/invoicing` | superadmin | integración sin secretos |
| `PUT /companies/:id/invoicing` | superadmin | software, habilitado, nota crédito, configuración |
| `PUT /companies/:id/invoicing/credentials` | superadmin | `{ estado, pista }` |
| `POST /companies/:id/invoicing/test` | superadmin | `{ estado, ultimoError }` |
| `DELETE /companies/:id/invoicing` | superadmin | `204`, destruye credenciales |
| `GET /companies/invoicing/documents?ref=` | superadmin | soporte |
| `GET /invoicing/status` | agencia | `{ habilitado, capacidades }` |
| `POST /sales/:id/invoices` | `facturacion.create` | `202` |
| `GET /sales/:id/invoices` | `facturacion.view` | documentos de la venta |
| `POST /sales/:id/invoices/:docId/retry` | `facturacion.create` | `202` |
| `GET /sales/:id/invoices/:docId/pdf` | `facturacion.view` | URL firmada de 5 min |
| `POST /sales/:id/invoices/:docId/credit-note` | `facturacion.credit_note` | `202` |

Todas bajo `/api/v1`, con Zod en `schemas/facturacion.schema.js` y `422` por campo.

## Fase 0 — Tipo de documento y documento en proveedores

Va primero: es **requisito** del ingreso para terceros (punto 6) y útil por sí sola.

- Columnas `proveedores.tipo_documento_id` (FK a `tipos_documento`) y `proveedores.documento`, **opcionales** en la
  base: los 35 proveedores sembrados por agencia (spec 030) no tienen documento. Se exigen **al facturar** (E10), no al
  crear el proveedor.
- **Mismas reglas que las personas**, sin duplicarlas: `utils/datosPersona.js` (`REGLAS_DOCUMENTO`,
  `normalizarDocumento`, `mensajeDocumento`) y `utils/tipoDocumento.js` para resolver `docTypeId`; en el frontend, el
  espejo `utils/datosPersona.ts`. Un NIT vale por su base de 9–10 dígitos, con el DV opcional (spec 003).
- Tipo y documento van **juntos**: uno sin el otro → `422` en el campo que falta.
- Único por agencia cuando hay documento: índice único parcial `(empresa_id, documento)`. Duplicado → `409 DUPLICATE`
  (manejo de `P2002` de `errorHandler.js`), pintado en el campo.
- `schemas/config.schema.js` → `suppliers` declara los dos campos.
- Pantalla de proveedores en Configuración: selector de tipo (la lista de la BD) y campo documento, con errores por campo.

## Cómo incorporar un software contable nuevo

1. Responder con su documentación o su soporte, y anotarlo en un anexo de esta spec (o en una spec nueva si es grande):
   1. ¿Cómo autentica? ¿Cuánto dura el token? ¿Qué credenciales hay que pedir?
   2. ¿Tiene idempotencia? Si no, ¿cómo se busca un documento por una referencia propia (`buscarPorClave`)?
   3. ¿La DIAN responde en la misma petición o después? ¿Cómo se consulta el estado?
   4. ¿Formato de errores, códigos, límites de peticiones y políticas de suspensión?
   5. ¿Cómo se busca un tercero por documento? ¿Cómo guarda el NIT (con o sin DV)?
   6. ¿Cómo se registra el ingreso para terceros con el NIT del proveedor?
   7. ¿Soporta nota crédito? ¿Con qué conceptos?
   8. ¿Reglas de redondeo y de cuadre de pagos?
   9. ¿Tiene ambiente de pruebas?
   10. ¿Cómo se obtiene el PDF?
2. Escribir el conector con el contrato, sus pruebas con `fetch` simulado y su `esquemaConfiguracion`.
3. Migración: un valor nuevo en `SoftwareContable`.
4. Probar en el ambiente de pruebas del software con una agencia de prueba.

## Cómo se comprueba

| # | Criterio | Cómo |
|---|---|---|
| C0 | Proveedor con tipo y documento válidos se guarda; inválido o incompleto → `422` por campo; duplicado → `409` | `test:validaciones` + pantalla |
| C1 | Agencia sin módulo: no ve botones y los `POST` responden `403` | prueba API |
| C2 | Las credenciales nunca salen en ninguna respuesta, ni al superadmin | prueba API |
| C3 | Un secreto copiado a la fila de otra agencia no descifra | prueba del cifrado |
| C4 | La agencia B no ve la integración ni los documentos de A, ni factura ventas de A | `test:aislamiento-api` ampliado |
| C5 | Doble «Facturar» simultáneo → un solo documento | prueba API concurrente |
| C6 | Error pasajero → un reintento automático; luego `fallida_pasajera` con referencia | conector falso |
| C7 | Error de datos → sin reintento, mensaje claro, se libera para volver a facturar | conector falso |
| C8 | Reintento tras tiempo agotado no duplica (con idempotencia y con `buscarPorClave`) | conector falso, en los dos modos |
| C9 | Documento huérfano en `en_proceso` se reanuda al arrancar | prueba del reanudador |
| C10 | Montos que no cuadran, proveedor sin NIT o venta sin vencimiento → no se envía | prueba del armado |
| C11 | Asesor `own` no factura ventas ajenas | prueba API |
| C12 | Anular con factura en curso → `409`; con factura emitida → aviso y filtro derivado | prueba API + pantalla |
| C13 | Factura real en el ambiente de pruebas del primer software, emitida y aceptada | manual, con permiso |
| C14 | Logs y bitácora sin tokens ni credenciales | prueba que busca el secreto |

Las pruebas del núcleo usan un **conector falso** (solo en pruebas) que simula cada clase de error, con y sin
idempotencia. Casi todo se prueba sin red y sin tocar la base.

## Riesgos

- **BD compartida dev/prod** mientras no haya Docker: migraciones y pruebas con base requieren permiso. La clave
  maestra no debe existir fuera de Render.
- **Software que suspenden por errores:** la validación previa y no reintentar errores de datos son obligatorios.
- **Montos en `Float`:** riesgo de descuadre por redondeo, mitigado con centavos enteros e invariante. Migrar a
  `Decimal` queda fuera.
- **Render free duerme:** reintentos y DIAN asíncrona esperan a que despierte.
- **Proveedores sin NIT:** las agencias tendrán que completar el documento de sus proveedores antes de facturar; los 35
  sembrados no lo traen.
- **Software sin documentación pública** (Karing): su conector depende de lo que entregue.
- **El bucket `facturas` se crea a mano** en Supabase Storage, como los demás.

## Pendientes externos (cuando se decida aplicar)

No hay preguntas abiertas de diseño. El proyecto está en preparación; lo siguiente llegará cuando se decida construir
cada conector:
- Documentación de la API de cada software (Karing la entregará; no es pública).
- Cuenta y ambiente de pruebas del primer software (para Siigo: empresa de pruebas y `Partner-Id`).

## Documentos a actualizar al construir

`README.md` (permisos: módulo nuevo; Storage: bucket `facturas`), `backend/CLAUDE.md` (convención de facturación),
`.claude/rules/security.md` (módulo y clave maestra), `.claude/rules/testing.md` (pruebas nuevas),
`docs/architecture/overview.md`, `backend/.env.example` (`FACTURACION_CLAVE_MAESTRA`, sin valor) y `render.yaml`
(variable `sync: false`).

---

## Anexo A — Primer conector: Siigo

Fuente: [developers.siigo.com](https://developers.siigo.com/docs/siigoapi/) (consultado 2026-11-01). Lo que aquí se
dice aplica **solo** a `conectores/siigo.js`.

- Endpoints: `/v1/invoices`, `/v1/credit-notes`, `/v1/customers`, `/v1/products`, entre otros.
- **Idempotencia:** cabecera `Idempotency-Key`, alfanumérica, ≤ 30 caracteres (la página de errores dice 32: se usan
  30), en `POST` de facturas y notas crédito. Si se repite, devuelve el documento ya creado → `capacidades.idempotencia
  = true`.
- **Errores:** `{ Status, Errors: [{ Code, Message, Params, Detail }] }`. Traducción: `requests_limit`/429 →
  `LIMITE_PETICIONES`; 503/504/408/`request_timeout`/`service_unavailable` → `SOFTWARE_NO_DISPONIBLE`; 401/`unauthorized`
  → `CREDENCIALES_INVALIDAS`; 403 → `PERMISO_SOFTWARE`; `not_found` sobre un id del mapeo → `MAPEO_INVALIDO`;
  `duplicated_document`/`already_exists` → `DOCUMENTO_DUPLICADO`; `parameter_required`/`invalid_date`/
  `invalid_total_payments`/demás `invalid_*` → `DATOS_RECHAZADOS`; 500/`unhandled_error` o cuerpo no JSON →
  `ERROR_SOFTWARE`.
- **Límite:** 100 peticiones/min por empresa en producción, 10 en la empresa de pruebas.
- **Tiempo de espera:** ≥ 120 s al crear comprobantes → `tiempoEsperaMs = 120000`.
- **Suspensión:** si los errores superan el 80% de las peticiones en 7 días, bloquea al usuario hasta corregirlo.
- **`Partner-Id`** obligatorio en toda petición: 3–100 alfanuméricos, sin espacios, el mismo para todas las empresas →
  constante `NexusSoft` dentro del conector.
- **Redondeo:** total por ítem = base redondeada + IVA redondeado; `payments` debe sumar exactamente el total.
- La factura puede enviarse a la DIAN y por correo desde su creación.

**Por confirmar en el ambiente de pruebas:** endpoint y duración del token; campos para enviar a la DIAN y por correo;
si el estado DIAN llega en la misma petición o después; dónde viene el CUFE; cómo se consultan los rechazos; cómo se
registra el ingreso para terceros con el NIT del proveedor; payload y conceptos de la nota crédito.

## Anexo B — Karing (pendiente)

Karing tiene API según el usuario, pero no está documentada públicamente. Su conector se escribe cuando Karing entregue
la información, siguiendo «Cómo incorporar un software contable nuevo».
