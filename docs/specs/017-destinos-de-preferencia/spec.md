# Spec 017 — Destinos de preferencia del cliente

**Estado:** implementada (2026-10-17), probada por la API; falta probar en pantalla · **Rama:** `feat-bayrol` · **Toca la base
compartida** (una tabla y una columna nuevas, aditivas) · **Relacionadas:** [`003`](../003-validacion-de-datos-de-personas/spec.md)
(datos del cliente), [`009`](../009-sin-tabla-personas/spec.md) (diseño, no cambia esto: la tabla nueva cuelga de
`clientes`, no de `personas`)

## Por qué

La agencia quiere saber a dónde le gusta viajar a cada cliente para ofrecerle planes, y poder filtrar la lista de
clientes por ese destino. Hoy `clientes` no guarda nada parecido.

## Qué se quiere (confirmado con el usuario)

1. **Texto libre**, no un catálogo: un campo donde se escribe el destino y un botón "+" que lo añade al cliente.
2. **Hasta 5 destinos por cliente**, guardados en el orden en que se añadieron. El **último añadido es el
   reciente**, el que se muestra y por el que se filtra por defecto.
3. **Sugerencias al escribir** (en el formulario y en el filtro): los destinos que la agencia ya usó en cualquiera
   de sus clientes, **de toda la agencia** aunque el asesor solo vea los suyos (solo se ve el nombre del destino,
   nunca el cliente). Se puede escribir uno nuevo.
4. **Filtro de la lista de clientes:** por defecto busca en el **destino reciente**; la casilla **"Incluir destinos
   anteriores"** busca en los 5. Coincidencia parcial y sin mayúsculas ("carta" encuentra "Cartagena").
5. **Detalle del cliente:** el destino reciente con una insignia **"+N"** cuando hay más, y un **desplegable** con
   todos, del más nuevo al más viejo.
6. En registrar, editar y ver detalle del cliente.

## Fuera de alcance

- Catálogo de destinos administrable, o relación con `aeropuertos`/`paquetes.destino`.
- Corregir erratas ("Cartajena" no aparece al filtrar "Cartagena"); las sugerencias solo las reducen.
- Destinos en la ficha de otros módulos (ventas, cotizaciones) o en estadísticas.

## Diseño

### Datos

- Tabla nueva **`cliente_destinos`**: `id`, `cliente_id`, `destino` (texto), `orden` (1–5), `creado_at`,
  `empresa_id`. Como toda tabla de inquilino: `empresa_id` por defecto desde `app.empresa_id` **sin respaldo** a otra
  agencia, RLS `empresa_aislada` con `FORCE`, clave ajena compuesta `(cliente_id, empresa_id) → clientes(id,
  empresa_id)` con borrado en cascada, permisos solo para `app_nexus`, índice por `empresa_id` y por `cliente_id`, y
  único `(cliente_id, orden)`.
- Columna nueva **`clientes.destino_reciente`** (texto, nula): copia del destino de mayor `orden`, escrita por el
  servicio en la misma transacción que las filas. Existe para filtrar y listar sin subconsulta por fila.
- Clientes existentes: sin destinos (`destino_reciente` nula). Sin relleno.

### Reglas (servidor, autoritativas)

- Cada destino: se recortan espacios y se colapsan los dobles; 2–60 caracteres; se guarda como se escribió (no se
  cambia a mayúsculas).
- Repetidos en el mismo cliente (sin distinguir mayúsculas ni espacios de más; las tildes sí cuentan): se queda **la última
  aparición** (volver a añadir "Cartagena" la convierte en la reciente).
- **Un destino que la agencia ya tiene** (en cualquier cliente) escrito con otras mayúsculas toma la escritura
  existente, la más antigua: "pEreira" se guarda como "Pereira" si ya existe. Así el destino es uno solo en el filtro
  y en las sugerencias (pedido del usuario al probar, 2026-10-17).
- Más de 5 tras quitar repetidos → 422 en `destinations`. Un destino inválido → 422 en `destinations.<i>`.

### API

- `POST /clients` y `PUT /clients/:id`: `destinations: string[]` opcional, en orden de alta (el último es el
  reciente). En `PUT`, si llega, **reemplaza** la lista entera (borrar y crear en una `transaccion`); si no llega, no
  se toca.
- `GET /clients/:id` y `GET /clients`: devuelven `destinations: string[]` (del más viejo al más nuevo) y
  `recentDestination`.
- `GET /clients?destination=<texto>`: filtra por `destino_reciente`; con `&destinationAll=true`, por cualquiera de
  los destinos del cliente. Mismo `where` para la fila y la cuenta (objeto de Prisma: `contains`, `mode:
  'insensitive'`, `some`). `destination` > 60 caracteres → 422.
- `GET /clients/destinations?search=<texto>`: hasta 10 destinos distintos de la agencia que contengan el texto,
  ordenados por uso. Permiso `clients.view`; **sin alcance por asesor** (decisión 3).

### Pantalla

- **Formulario (`ClientModal.tsx`):** campo "Destinos de preferencia" con sugerencias y botón "+" (también Enter).
  Los añadidos se ven como etiquetas con botón para quitarlas; la reciente marcada. A los 5, el campo y el "+" se
  desactivan con el aviso "Máximo 5 destinos". Un repetido no se duplica: pasa a ser el reciente.
- **Detalle (`ClientDetailModal.tsx`):** el reciente y, si hay más, la insignia "+N" que abre un desplegable con
  todos (más nuevo primero). Sin destinos: "Sin destinos de preferencia".
- **Lista (`Clients.tsx`):** filtro "Destino" con sugerencias y la casilla "Incluir destinos anteriores"; espera de
  350 ms como la búsqueda de ventas.
- Accesible según `ui-ux-pro-max`: etiqueta visible, botones con nombre ("Añadir destino", "Quitar Cartagena"),
  desplegable por teclado, error junto al campo.

## Cómo se comprueba

- Prueba por la API (nueva, mismo arnés que `tests/montaje.js`): crear con 3 destinos (reciente = el último);
  editar a 5; un sexto → 422; repetido con otras mayúsculas → no duplica y pasa a reciente; filtro por el reciente;
  filtro con `destinationAll` encuentra uno anterior; sugerencias de un asesor `own` incluyen destinos de clientes
  de otro asesor; destino de 1 carácter → 422.
- `test:aislamiento`: la tabla nueva no deja ver ni apuntar a filas de otra agencia.
- `check:prisma`, `tsc`.
- En pantalla (usuario): añadir, quitar y reordenar por repetición; el "+N" y el desplegable del detalle; el filtro
  con y sin la casilla.

## Riesgos

- **`destino_reciente` es una copia:** si algo escribe `cliente_destinos` sin pasar por el servicio, se desincroniza.
  Mitigación: un solo sitio escribe ambos, en la misma transacción.
- **Texto libre:** variantes de escritura parten el filtro; las sugerencias y la coincidencia parcial lo reducen.
  Las tildes cuentan: "Bogota" no encuentra "Bogotá" (`mode: 'insensitive'` no ignora tildes). Ignorarlas pediría
  la extensión `unaccent` y SQL crudo; no se hace salvo que se pida.
- **Base compartida:** tabla y columna aditivas y nulas; la rama de Darío no se entera.
