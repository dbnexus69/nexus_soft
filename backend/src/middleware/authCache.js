/**
 * La caché de autenticación, en su propio archivo.
 *
 * Vivía dentro del middleware, que la exportaba como efecto colateral
 * (`module.exports.AUTH_CACHE`), y quien necesitaba invalidarla tenía que
 * importar el middleware entero. Ahora el cierre de sesión y el cambio de
 * contraseña pueden olvidar lo que les toca sin arrastrar el middleware.
 *
 * **Se indexa por el hash del token, no por el id de usuario.** Con la clave
 * anterior las dos sesiones de una misma persona compartían entrada, así que
 * cerrar una cerraba la otra —y, peor, no se podía invalidar una sola—.
 *
 * Es memoria del proceso: con varias instancias detrás de un balanceador, cada
 * una tiene la suya y una revocación tarda en propagarse lo que dure el TTL.
 * Era ya así antes de esto; queda anotado porque es el límite real de esta
 * caché, no un descuido.
 */
const AUTH_CACHE = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function leer(hash) {
  const entrada = AUTH_CACHE.get(hash);
  if (!entrada) return null;
  if (entrada.expiresAt <= Date.now()) {
    AUTH_CACHE.delete(hash);
    return null;
  }
  return entrada.user;
}

function recordar(hash, user) {
  AUTH_CACHE.set(hash, { user, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Al cerrar una sesión: solo esa. */
function olvidarToken(hash) {
  AUTH_CACHE.delete(hash);
}

/**
 * Al dar de baja a alguien o cambiarle la contraseña: todas sus sesiones.
 *
 * Sin esto, desactivar un usuario le dejaba entrar hasta cinco minutos más,
 * porque el middleware no volvía a mirar la base mientras la entrada siguiera
 * viva. `users.service` ya importaba la caché para algo así y no la usaba.
 */
function olvidarUsuario(usuarioId) {
  for (const [hash, entrada] of AUTH_CACHE) {
    if (entrada.user?.id === usuarioId) AUTH_CACHE.delete(hash);
  }
}

/** Al cambiar los permisos de un rol, que afectan a todo el mundo. */
function olvidarTodo() {
  AUTH_CACHE.clear();
}

module.exports = { AUTH_CACHE, CACHE_TTL_MS, leer, recordar, olvidarToken, olvidarUsuario, olvidarTodo };
