# El número que ve cada agencia

**Estado:** implementado · **Rama:** `feat-dbmoon` · Complementa a
[`spec 001`](../specs/001-multi-tenant/spec.md), criterio A4.

## Problema

El `id` es global y se pintaba tal cual. La agencia 1 veía sus clientes `#22` y `#23`;
la agencia 9, su único cliente, `#136`. Los huecos entre unos números y otros **son,
literalmente, lo que ha dado de alta la vecina**, y cualquiera con la pantalla delante
puede contarlos. En ventas ya se había resuelto con `ventas.numero`, pero el listado
principal —lo que más se mira— seguía pintando `sale.id`, así que en la práctica no
estaba resuelto en ninguna parte.

Hay además un problema comercial más simple: una agencia que abre hoy no quiere que su
primer cliente se llame `#136`.

## Objetivo

Toda tabla que enseñe un número lo enseña propio de la agencia, empezando en 1, y ese
número sirve para buscar: se puede decir por teléfono y llegar a la ficha.

## Fuera de alcance

- **El `id` sigue siendo la clave interna y la que viaja en la API.** Cambiarla tocaría
  los 112 endpoints y no aporta aislamiento: la RLS ya impide pedir lo de otra agencia.
  La contrapartida, dicha en voz alta: quien abra las herramientas del navegador seguirá
  viendo `id: 136` en el JSON.
- `personas`, las líneas de venta y los productos: o no se enseñan nunca, o su id es un
  UUID, que no delata nada.
- El número en la URL. No hay ids en las rutas del frontend; todo es modal.
- Los cuatro catálogos del sistema (aerolíneas, aeropuertos, tipos de documento,
  políticas de equipaje): ver abajo.

## Diseño

**Lo pone la base, no el código.** Una función `app_asignar_numero()` y un disparador
`BEFORE INSERT` en cada tabla numerada. Nueve tablas: las ocho que enseñan su id
—`clientes`, `usuarios`, `responsables`, `comisionistas`, `proveedores`, `metodos_pago`,
`paquetes`, `tarjetas_agencia`— y `ventas`, que se muda al mismo mecanismo.

El motivo es el que ya nos ha mordido varias veces en este repo: con nueve tablas, la
alternativa era repetir el cerrojo y el `MAX+1` en cada alta y confiar en que la décima se
acordara. Un disparador no se puede olvidar: ni el alta de hoy, ni la que se escriba
dentro de un año, ni un `INSERT` hecho a mano en una consola.

La función es `SECURITY DEFINER` a propósito: el máximo tiene que calcularse sobre TODAS
las filas de esa agencia, las vea quien las vea. Si dependiera de lo que deja pasar la
política de turno, una fila oculta daría un número repetido. El cerrojo lleva la tabla y
la empresa dentro y muere con la transacción, así que dos altas de la misma agencia se
ponen en fila y dos agencias distintas no se estorban.

**`MAX+1`, no un contador.** Un contador en una tabla aparte sería más barato y no
necesitaría cerrojo, pero un alta que falla se lleva el número con ella y la agencia ve
`#0003`, `#0005`. Con `MAX+1` dentro de la transacción, lo que se revierte libera su
número.

**Los catálogos del sistema pierden el `#id` de la pantalla.** Son los mismos para todas
las agencias, así que su id no delata nada; pero tampoco le sirve a nadie —nadie llama
por teléfono para hablar de la aerolínea #3— y darles un número por empresa sería
inventarse un dato: la misma aerolínea saldría con un número distinto en cada agencia y
dar soporte se volvería un acertijo. Se quedan con su nombre y su código IATA.

**Dar de baja deja de borrar.** `usuarios` y `comisionistas` eran las dos únicas tablas
numeradas que borraban de verdad, y eso reutiliza el número: se va el `#0004` y el
siguiente que entra vuelve a ser el `#0004`. Pasan a `deleted_at`, como clientes y
responsables. Para que eso no deje el correo ocupado para siempre, los únicos de
`usuarios.email`, `usuarios.persona_id` y `comisionistas.persona_id` pasan a ser
**parciales**: solo se aplican entre los vivos. Y `app_identidad_por_correo`, que es por
donde resuelve el login, filtra las bajas.

## Decisiones y alternativas

| Decisión | Elegimos | Descartamos | Por qué |
|---|---|---|---|
| Quién numera | Un disparador por tabla | Repetir el cerrojo en cada servicio | Nueve tablas y un alta en cada una: la décima no se acordaría |
| Cómo | `MAX(numero)+1` con cerrojo | Tabla de contadores | El contador deja huecos cuando un alta falla |
| Alcance de la función | `SECURITY DEFINER` | Con los permisos de quien llama | Una fila que la política oculte daría un número repetido |
| Catálogos del sistema | Sin número visible | Número por empresa | La misma aerolínea con dos números hace imposible el soporte |
| Bajas | `deleted_at` | Contador aparte para esas dos | Dos mecanismos en el mismo sistema, y el histórico seguía sin dueño |
| Correo de una baja | Se libera (único parcial) | Ocupado para siempre | Quien se va y vuelve tendría que inventarse otra dirección |
| El `id` en la API | Se queda | Sustituirlo por el número | 112 endpoints, y la RLS ya impide pedir lo ajeno |

## Riesgos, y cómo se detectan

| Riesgo | Cómo avisa |
|---|---|
| Que alguien tire los disparadores en un `migrate diff` y las altas dejen de numerarse | `pnpm test:aislamiento` cuenta los 9 |
| Que los únicos parciales se conviertan en totales y una baja bloquee su correo | La misma prueba cuenta los 3 |
| Que una agencia nueva no empiece por 1 | La prueba monta una agencia y comprueba cliente, usuario y venta |
| Que una baja siga entrando | Comprobado a mano: login de un usuario dado de baja, 401 |

## Qué se tocó

**Base** — `20260913000500_numero_propio_por_agencia` (función, columna, relleno por orden
de id, único `(empresa_id, numero)` y disparador en 9 tablas) y
`20260913001500_baja_sin_borrar_usuarios_y_comisionistas` (dos `deleted_at`, tres únicos
parciales y el filtro del login).

**Backend** — `createSale` suelta el cerrojo y el `MAX+1`; `users` y `commissions` dan de
baja en vez de borrar y filtran las bajas en listados y fichas; `clients`, `users`,
`responsables`, `commissions` y los cuatro catálogos de la agencia devuelven `numero`; y
los tres listados con buscador aceptan un término numérico como número de la agencia —en
el `OR` de la búsqueda, nunca en el `where`, para que el alcance `own` se siga aplicando.

**Frontend** — los seis sitios que pintaban un id global pintan el número; los cuatro
catálogos del sistema pierden la columna `#`.
