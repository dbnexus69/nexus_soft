# Spec 020 — Editar y borrar con alcance propio (Todos · Solo los suyos · Ninguno)

**Estado:** completada (2026-10-21), confirmada en pantalla por el usuario (2026-10-21, spec 022 T2) · **Rama:** `feat-bayrol` · **No toca el
esquema** (`permisos_rol.valor` ya es texto) · **Relacionadas:** [`019`](../019-alcance-al-escribir-clientes/spec.md)
(alcance al escribir clientes), `ventasAlcance.js`, `quotesAlcance.js`

## Por qué

Hoy "Ver" tiene alcance (`all`/`own`/`none`) y "Editar"/"Borrar" son sí/no: sobre qué registros se edita lo decide
"Ver". No se puede dar a un asesor "ver todos los clientes, pero modificar solo los suyos". El usuario lo pide como
necesario (2026-10-17).

## Qué se quiere (confirmado con el usuario)

1. **Editar y Borrar** con alcance propio — **Todos · Solo los suyos · Ninguno** — en los módulos donde "Ver" ya lo
   tiene y la acción existe:

   | Módulo | Editar | Borrar | "Suyo" |
   |---|---|---|---|
   | Ventas (`sales`) | ✓ (incluye cobrar, anular, productos, voucher) | ✓ | `ventas.usuario_id` |
   | Cotizaciones (`quotes`) | ✓ (enviar, responder, convertir, enlazar) | ✓ | `cotizaciones.usuario_id` |
   | Clientes (`clients`) | ✓ (incluye estado y avatar) | — | `clientes.creado_por_id` |
   | Vuelos (`itineraries`) | ✓ (check-in) | — | la venta del vuelo es suya |

2. **Nunca más amplio que Ver.** El alcance efectivo de editar/borrar es el más estrecho entre "Ver" y la acción
   (`none` < `own` < `all`). En el panel, las opciones más amplias que "Ver" se desactivan con el aviso "No puede ser
   más amplio que Ver"; bajar "Ver" baja "Editar" y "Borrar".
3. **Compatibilidad:** un valor guardado `true` se lee como `all` y `false` como `none`. Con el tope de "Ver", el
   comportamiento de hoy no cambia para nadie.
4. **Respuestas:** 404 si no lo puede ver; 403 si lo ve pero su alcance de la acción no lo cubre.
5. **Pantalla:** los botones de editar, borrar, cobrar o check-in de un registro ajeno no se muestran cuando el
   alcance de la acción es `own` (el servidor responde 403 igualmente).

Fuera de alcance: "Crear" sigue siendo sí/no (lo creado siempre es suyo); admin y superadmin siguen fijos en `all`;
el resto de módulos sigue sí/no; permisos por usuario (no existen, a propósito).

## Diseño

### Servidor

- `services/roles.service.js`: `SCOPED_ACTIONS` — por módulo, qué acciones llevan alcance (`view` en los cinco de
  hoy; `edit` en `sales`, `quotes`, `clients`, `itineraries`; `delete` en `sales`, `quotes`). `parseValor` y el
  esquema que describe el panel (`type: 'scope'`) usan esa lista; `true`/`false` se aceptan y se leen como
  `all`/`none`. `PUT /roles/:rol/permissions` recorta a "Ver" una acción más amplia (plan, decisión 3).
- `middleware/authorize.js`: las plantillas por defecto pasan esas acciones a `all`/`own`/`none` (asesor y
  freelancer, `own` donde hoy tienen `true` con `view: 'own'`); el solapado de la base acepta los tres valores en las
  acciones con alcance; y `authorize` deja en `req.permissionScope` el **alcance efectivo** de la acción (el más
  estrecho con `view`) y en `req.viewScope` el de ver, como hoy.
- Comprobaciones de propiedad (`ventasAlcance.js`, `quotesAlcance.js`, `clients.service.js`, `flights.service.js`):
  al **leer** usan el alcance de ver (404); al **escribir**, el de la acción (403). Hoy las de escribir miran
  `viewScope || permissionScope`; pasan a mirar el de la acción.

### Pantalla

- `types/index.tsx`: `edit`/`delete` de esos módulos pasan a `"all" | "own" | "none"`, con los valores por defecto.
- `components/users/PermissionsGrid.tsx`: selector de alcance para las acciones con `type: 'scope'`; opciones más
  amplias que "Ver" desactivadas con su aviso; al bajar "Ver" se bajan las demás.
- `context/PermissionsContext.tsx`: `scopeOf(module, action)` además de `canEdit`/`canDelete`; las listas que pintan
  botones por fila (ventas, cotizaciones, clientes, vuelos) los ocultan si el alcance es `own` y el registro es de
  otro.

## Cómo se comprueba

- `pnpm test:aislamiento-api`, con el rol `asesor` puesto por la API a "Ver: todos · Editar: solo los suyos · Borrar:
  ninguno" en ventas y clientes: ve la venta y el cliente del admin (200); editarlos → 403; borrar la venta → 403;
  edita los suyos (200). Con "Editar: todos" edita la del admin. Un `PUT` de permisos con "Ver: solo los suyos ·
  Editar: todos" queda guardado como `own`.
- Las suites de hoy (`test:aislamiento-api`, `test:vuelos-api`, `test:ventas-filtros`, `test:clientes-destinos`) en
  verde **sin cambiarles nada**: los valores por defecto se comportan igual.
- `check:prisma`, `test:validaciones`, `tsc`. En pantalla: el panel (opciones desactivadas, bajar "Ver") y los
  botones por fila con un asesor `own`.

## Riesgos

- **Tres sitios de permisos** (`roles.service.js`, `authorize.js`, `types/index.tsx`): si uno no acepta `own` en una
  acción, el valor se guarda y se ignora en silencio (la trampa que ya documenta el `CLAUDE.md`).
- **Valores viejos en la base:** `true`/`false` siguen valiendo; no hace falta migración.
- **Vuelos:** "suyo" sale de la venta del vuelo; hay que comprobarlo en el check-in de un vuelo de paquete.
