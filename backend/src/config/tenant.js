const { AsyncLocalStorage } = require('async_hooks');

/**
 * La empresa activa de la petición en curso.
 *
 * No se pasa por parámetro a través de los 270 puntos de consulta: viaja en un
 * `AsyncLocalStorage`, que es memoria atada al contexto asíncrono y no una
 * variable global. Dos peticiones simultáneas de empresas distintas tienen cada
 * una la suya, sin tocarse.
 *
 * Aquí NO se filtra nada. Este módulo solo sabe *en nombre de qué empresa* se
 * está trabajando; quien separa los datos es Postgres con sus políticas. Si
 * además filtráramos aquí habría dos verdades sobre lo mismo, y la del código es
 * la que se olvida —ya pasó en este repo con el alcance `own`, aplicado en los
 * listados y ausente en quince mutaciones—.
 */
const almacen = new AsyncLocalStorage();

/**
 * Ejecuta `fn` en nombre de una empresa.
 *
 * Lo llama el middleware de autenticación una vez por petición. Todo lo que
 * ocurra dentro —incluidos los `await` encadenados— ve esta empresa.
 *
 * **Por qué el ámbito se abre con `async () => fn()` y no con `fn`.**
 *
 * Las operaciones de Prisma son perezosas: `prisma.x.findFirst(...)` no consulta
 * nada, devuelve una promesa que se ejecuta cuando alguien la espera. Si el
 * ámbito se abre con `almacen.run(store, fn)` y `fn` devuelve esa promesa sin
 * esperarla, el ámbito se cierra ANTES de que la consulta arranque: la consulta
 * corre sin empresa.
 *
 * No es teórico: el login devolvía "correo o contraseña incorrectos" con la
 * contraseña correcta, porque `conEmpresa(id, () => prisma.usuarios.findFirst())`
 * leía sin contexto y la política no dejaba ver ni al propio usuario.
 *
 * Con `async () => fn()`, la promesa se crea Y se encadena dentro del ámbito, y
 * da igual cómo escriba su callback quien llame. Lo mismo vale para `sinEmpresa`
 * y `dentroDeTransaccion`.
 */
function conEmpresa(empresaId, fn) {
  return almacen.run({ empresaId: empresaId ?? null, enTransaccion: false }, async () => fn());
}

/**
 * Ejecuta `fn` explícitamente SIN empresa.
 *
 * Para lo que es de la aplicación y no de un inquilino: el login (que todavía no
 * sabe quién entra), las tareas de mantenimiento y el superadmin mientras
 * administra empresas sin haber entrado en ninguna. Es explícito a propósito: un
 * hueco sin contexto debe ser una decisión escrita, no un olvido.
 */
function sinEmpresa(fn) {
  return almacen.run({ empresaId: null, enTransaccion: false }, async () => fn());
}

/** La empresa activa, o null si se trabaja fuera de toda empresa. */
function empresaActual() {
  return almacen.getStore()?.empresaId ?? null;
}

/**
 * ¿Estamos ya dentro de una transacción que fijó el contexto?
 *
 * Lo consulta la extensión de Prisma para NO envolver una operación que ya vive
 * dentro de una transacción. Sin esto, cada operación interna abriría su propia
 * transacción en otra conexión —comprobado: distinto `pg_backend_pid`—, y las 88
 * operaciones que viven dentro de las 18 transacciones del repo dejarían de
 * revertirse juntas. Una venta que falla a mitad quedaría escrita a medias.
 */
function enTransaccion() {
  return almacen.getStore()?.enTransaccion === true;
}

/**
 * Marca el ámbito de `fn` como "ya dentro de una transacción".
 *
 * Abre un ámbito NUEVO en lugar de mutar el actual: si mutara, dos consultas
 * hermanas lanzadas en paralelo dentro de la misma petición compartirían la
 * marca, y la que no está en la transacción se quedaría sin contexto.
 */
function dentroDeTransaccion(fn) {
  const actual = almacen.getStore();
  return almacen.run({ empresaId: actual?.empresaId ?? null, enTransaccion: true }, async () => fn());
}

module.exports = {
  conEmpresa,
  sinEmpresa,
  empresaActual,
  enTransaccion,
  dentroDeTransaccion,
};
