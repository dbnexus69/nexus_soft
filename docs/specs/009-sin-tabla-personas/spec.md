# Spec 009 — Quitar la tabla `personas`

**Estado:** diseño, pendiente de aprobación · **Rama:** `feat-bayrol` · **Toca la base compartida** `nexus-bd`
(la usa también `feat-dbmoon`) · **Relacionada:** [`003`](../003-validacion-de-datos-de-personas/spec.md)
(los datos de persona), [`002`](../002-estabilizacion-multi-tenant/spec.md) (tenancy, claves compuestas)

## Por qué

Clientes, usuarios, responsables y comisionistas guardan sus datos personales (nombre, documento, correo,
teléfono…) en una tabla aparte, `personas`, y se enganchan a ella con `persona_id`. La idea era tener una
identidad por documento, reutilizada entre roles. En la práctica cuesta más de lo que da:

- **Efecto cruzado peligroso.** Crear un cliente con un documento que ya es de un usuario encuentra esa
  `persona` y **le sobrescribe el nombre y el correo** (`createClient` hace `personas.update` sobre la fila
  existente). Nadie lo pidió y no hay aviso.
- **Ramas repetidas.** 32 caminos "ya existe la persona" en cuatro servicios, cada uno con su "revivir la
  persona dada de baja", su mensaje de duplicado y su transacción. ~270 referencias a `personas` o
  `persona_id` en 15 archivos de `backend/src`.
- **Un JOIN por listado** (y 5 claves ajenas compuestas, de las 54, solo para sostenerla).
- **Datos duplicados sin dueño:** `usuarios.email` y `personas.email` conviven y pueden discrepar;
  `personas.status` decide si un cliente está activo, mientras los otros tres roles tienen su propio `status`.

## Qué se quiere (confirmado con el usuario, 2026-10-03)

1. Las cuatro tablas llevan **sus propias columnas** de datos personales y **no se relacionan con `personas`**.
2. **Independientes:** quien es usuario y cliente a la vez son dos registros que no se enteran el uno del otro.
   Si cambia de teléfono, se cambia en cada uno.
3. **Camino híbrido, por fases** (expandir → cambiar el código → contraer): nada se rompe a mitad y se puede
   parar en cualquier fase hasta la última.
4. Los **pasajeros** de las ventas guardan una **copia** de su nombre y documento *tal como iban en esa venta*
   (`pasajeros_detalle` con columnas propias), no una referencia a otra tabla.

**Éxito:** lo que ve y manda el frontend no cambia; hay menos código y menos validaciones; ningún dato se pierde.

## Diseño

### Modelo destino

Columnas de persona, las mismas en las cuatro tablas (nombres en español y snake_case, como el resto):

| Columna | Tipo | Nota |
|---|---|---|
| `nombres`, `apellidos` | `String` | obligatorias |
| `tipo_documento_id` | `Int?` | clave ajena simple a `tipos_documento` |
| `documento` | `String?` | normalizado (mayúsculas, sin espacios) |
| `email`, `telefono` | `String?` | en `usuarios`, `email` ya existe y es el del login (obligatorio) |
| `birth_date` | `DateTime?` | |
| `avatar_url` | `String?` | |

- `clientes` gana `status` (`UserStatus`, por defecto `active`): hoy sale de `personas.status`. Los otros tres ya lo tienen.
- **Únicos por tabla y entre vivos:** `(empresa_id, documento) WHERE deleted_at IS NULL AND documento IS NOT NULL`,
  en cada una de las cuatro (índice parcial, en SQL crudo como los demás). El documento ya no es único *entre*
  roles: es lo que significa "independientes".
- Sin `persona_id`, sin la clave ajena compuesta a `personas`, y sin `nacionalidad` (la lee solo `prod_migracion`/`prod_visa`, que ya tienen la suya).
- `pasajeros_detalle`: `nombres`, `apellidos`, `tipo_documento_id`, `documento` (copia, sin único), y sin `persona_id`.

### Decisiones de comportamiento (se cambian a propósito)

1. **Adiós "revivir".** Dar de alta de nuevo un documento dado de baja crea una **fila nueva** (número nuevo);
   el historial sigue señalando a la vieja. Hoy se reutiliza la persona y se reactiva la fila. Es más simple y
   no mezcla historiales. Mismo criterio que ya aplican los números (`deleted_at`, no se reutilizan).
2. **Duplicado = error del índice**, no una consulta previa: `P2002` sobre el documento se traduce en un solo
   sitio a `400 DUPLICATE_DOCUMENT` con `details` en `docNumber`, igual para los cuatro.
3. **Un cliente nuevo ya no toca a nadie más.** Se acabó el `personas.update` sobre la fila de otro rol.

### Lo que NO cambia

La API: mismos campos de entrada y de salida (`firstName`, `docTypeId`, `docType`, `docNumber`, `phone`,
`birthDate`, `avatar`…). **Única excepción:** desaparece `persona_id`/`personaId` de las respuestas (se
comprobó que el frontend no lo usa más que como tipo opcional; tarea T10). La tenancy (RLS, `empresa_id`,
`numero`) tampoco cambia: las cuatro tablas ya la tienen.

## Cómo se hace sin romper nada (expandir → cambiar → contraer)

1. **Expandir** (aditivo, reversible): columnas nuevas, *nullable*, copiadas desde `personas`. El código
   viejo sigue funcionando.
2. **Cambiar** el código módulo por módulo a las columnas propias. Al terminar, ya nadie escribe en `personas`.
3. **Contraer:** primero `personas` se renombra a `personas_respaldo` y se le quitan los permisos de la
   aplicación (reversible); una versión después se borra. Las columnas pasan a `NOT NULL` aquí, no antes.

**Coordinación con Darío.** La base es compartida: entre la fase 1 y la 5, su rama (código viejo) puede crear
filas que escriben solo en `personas` y dejan las columnas nuevas vacías. Por eso las columnas son *nullable*
hasta el final, hay un script **idempotente** de resincronización (copia lo que falte desde `personas`) que se
corre antes del corte y antes de contraer, y el cambio de código debe llegar a su rama (merge) antes de la fase 5.

## Criterios de aceptación

| # | Criterio | Se comprueba con |
|---|---|---|
| A1 | Tras expandir, cada fila de las cuatro tablas tiene en sus columnas lo mismo que su `persona` (campo a campo) | `tests/personas-migracion.js` |
| A2 | Con el código nuevo, las pruebas existentes siguen verdes sin cambiar sus expectativas de API | `test:aislamiento-api` (82), `test:vuelos-api` (35), `test:validaciones` (119), `test:reglas-espejo` |
| A3 | Crear un cliente con el documento de un usuario **no modifica** al usuario | prueba nueva en `aislamiento-api` |
| A4 | Un documento repetido dentro de la misma tabla da `400 DUPLICATE_DOCUMENT` con `details.docNumber`, igual en los cuatro módulos | prueba nueva |
| A5 | Dar de baja y volver a dar de alta el mismo documento crea una fila nueva y conserva el historial | prueba nueva |
| A6 | Un pasajero conserva el nombre y documento de su venta aunque el cliente cambie después | prueba nueva |
| A7 | Durante la ventana, ninguna escritura nueva en `personas` tras el corte | consulta de verificación (T11) |
| A8 | Tras contraer: sin tabla `personas`, 49 claves compuestas (54 − 5), `migrate status` al día y `check:prisma` limpio | `test:aislamiento` ajustado |
| A9 | El frontend no cambia salvo el tipo `personaId` | `tsc` + revisión de T10 |

## Fuera de alcance

- Fusionar identidades entre roles (un enlace usuario↔cliente). Se descartó con el usuario: serían dos registros independientes.
- Cambiar la API o las pantallas.
- La spec 007 (cotizaciones, de Darío): sus clientes seguirán siendo `clientes`.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Migración con copia de datos en la base **compartida**, difícil de deshacer en la fase 5 | Fases reversibles hasta el final; `personas_respaldo` una versión; copia de seguridad (punto de restauración de Supabase) antes del corte y antes de contraer; verificador campo a campo |
| La rama de Darío escribe en `personas` durante la ventana | Columnas *nullable* + resincronización idempotente + aviso previo y merge antes de la fase 5 (A7 lo comprueba) |
| ~270 referencias: una consulta olvidada sigue leyendo `personas` | Contraer es lo último; renombrar la tabla hace fallar de golpe cualquier lector olvidado (en pruebas, no en producción); `check:prisma` |
| Cambio de comportamiento "ya no se revive" sorprende a alguien | Documentado en esta spec y en el aviso de cada módulo; la prueba A5 lo fija |
| Datos viejos con documentos en minúscula o con espacios | La resincronización normaliza al copiar; el verificador compara ya normalizado |
