const { PrismaClient } = require('@prisma/client');
const { empresaActual, enTransaccion, dentroDeTransaccion } = require('./tenant');

const base = new PrismaClient();

/** El nombre de la variable de sesión que leerán las políticas de la base. */
const VAR_EMPRESA = 'app.empresa_id';

/**
 * Fija la empresa para el resto de la transacción en curso.
 *
 * `set_config(..., true)` es el equivalente a `SET LOCAL`: muere con la
 * transacción. La variante de sesión NO sirve aquí y la diferencia no es
 * estética — comprobado contra esta base: una variable de sesión sobrevive entre
 * consultas sueltas, y como el pooler reparte la conexión entre peticiones, la
 * empresa de una podría quedarse puesta para la de otro.
 */
const fijarEmpresa = (cliente, empresaId) =>
  cliente.$executeRawUnsafe(`SELECT set_config('${VAR_EMPRESA}', $1, true)`, String(empresaId));

/**
 * El cliente de Prisma, con la empresa activa metida en cada consulta.
 *
 * **Por qué la forma de lote y no una transacción interactiva.** La forma obvia
 * —abrir `$transaction(async tx => { await tx.$executeRaw(SET LOCAL); return
 * query(args) })`— no funciona: `query(args)` no se ejecuta dentro de esa
 * transacción, sino en otra conexión. Probado: el `current_setting` llegaba
 * vacío. Y vacío no es inofensivo, porque con las políticas puestas `''::int`
 * lanza excepción: se habrían caído los 30 sitios de SQL crudo —cartera,
 * estadísticas, comisiones y responsables— en vez de filtrar.
 *
 * Lo que sí funciona es el lote: `query(args)` es una `PrismaPromise` perezosa,
 * así que metida en el array viaja con el `set_config` en la MISMA transacción.
 *
 * **Cuándo no hace nada.** Si no hay empresa en el contexto —el login, una tarea
 * de mantenimiento, o todo el sistema mientras la RLS aún no está activa— la
 * operación pasa tal cual, sin transacción y sin coste. Y si ya estamos dentro
 * de una transacción, tampoco: esa transacción ya fijó el contexto al abrirse.
 */
const prisma = base.$extends({
  query: {
    $allOperations({ args, query }) {
      const empresa = empresaActual();
      if (empresa === null || enTransaccion()) return query(args);

      return base
        .$transaction([fijarEmpresa(base, empresa), query(args)])
        .then(([, resultado]) => resultado);
    },
  },
});

/**
 * Una transacción con la empresa fijada una sola vez.
 *
 * Sustituye a `prisma.$transaction(async tx => ...)` en todo el repo, y la
 * diferencia importa: sin esto, cada operación de dentro pasaría por la
 * extensión y abriría su PROPIA transacción en otra conexión. Dos consecuencias,
 * las dos silenciosas —comprobado que ocurre, no es teoría—:
 *
 * - Lo que falla a mitad deja de revertirse entero. `createSale` tiene 48
 *   operaciones dentro; un fallo en la 30 dejaría las 29 anteriores escritas.
 * - Riesgo de bloquearse consigo misma: la transacción externa tiene filas
 *   bloqueadas y la interna, desde otra conexión, espera a que se suelten.
 *
 * Se marca el ámbito para que la extensión deje pasar todo lo de dentro, y el
 * `SET LOCAL` se hace una vez, al abrir.
 */
function transaccion(fn, opciones) {
  const empresa = empresaActual();
  return prisma.$transaction(
    (tx) =>
      // La marca se pone ANTES del `set_config`, no después: si no, esa misma
      // sentencia pasa por la extensión, que la envuelve en una transacción
      // aparte y la manda a otra conexión. El contexto se fijaría en una
      // transacción que nadie usa y `tx` seguiría sin empresa. Comprobado: con
      // el orden inverso, `current_setting` dentro de la transacción daba "".
      dentroDeTransaccion(async () => {
        if (empresa !== null) await fijarEmpresa(tx, empresa);
        return fn(tx);
      }),
    opciones,
  );
}

/**
 * **No usar `prisma.$transaction([a, b, c])`.** La forma de lote deja de ser
 * atómica en cuanto la extensión está activa, y lo hace en silencio.
 *
 * Probado contra esta base: un lote de dos operaciones, la segunda imposible a
 * propósito, dejó **la primera escrita**. El motivo es que cada elemento del
 * array pasa por la extensión y se envuelve en su propia transacción antes de
 * que el lote llegue a existir, así que la primera confirma por su cuenta.
 *
 * Dónde dolía: borrar un usuario (sesiones, logs, usuario y persona), y
 * restablecer una contraseña (cambiarla, quemar el código y cerrar sesiones).
 * Los 7 sitios que usaban esta forma están convertidos a `transaccion`.
 */
module.exports = prisma;
module.exports.transaccion = transaccion;
module.exports.VAR_EMPRESA = VAR_EMPRESA;
