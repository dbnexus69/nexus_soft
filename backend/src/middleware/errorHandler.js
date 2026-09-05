const { randomUUID } = require('crypto');
const { error } = require('../utils/apiResponse');

/**
 * Manejador de errores.
 *
 * Regla: **al cliente solo va lo que se decidió contarle.** Los errores con
 * `statusCode` los lanza este código a propósito y su mensaje es para el
 * usuario; todo lo demás es un fallo no previsto y sale como un mensaje
 * genérico con una referencia.
 *
 * Antes la última rama devolvía `err.message + '\n' + err.stack` al cliente,
 * sin mirar el entorno. Una subida con extensión no permitida contestaba con la
 * traza completa y las rutas absolutas del servidor dentro. Con eso se regalan
 * el árbol de directorios, los nombres de los módulos y las versiones.
 *
 * No hay rama "si es desarrollo muestro más": esa condición es justo la que
 * acaba filtrando en producción cuando alguien despliega con NODE_ENV mal
 * puesto. La información completa está en el log del servidor, y la referencia
 * la une con lo que vio el usuario.
 */
function errorHandler(err, req, res, _next) {
  // Identificador corto: el usuario lo puede leer por teléfono y aparece
  // literal en el log del servidor.
  const referencia = randomUUID().slice(0, 8);

  console.error('[ERROR]', referencia, req.method, req.originalUrl,
    req.user ? `usuario=${req.user.id}` : 'sin sesión', '|', err.message || err);
  if (err.meta) console.error('[ERROR META]', referencia, JSON.stringify(err.meta));
  if (err.stack) console.error('[ERROR STACK]', referencia, err.stack);

  // ── Errores de Prisma que sí conviene traducir ──────────────────────────
  // Su mensaje describe qué hizo mal quien llamó, no cómo está hecho esto.

  if (err.code === 'P2002') {
    const target = err.meta?.target?.join(', ') || 'campo';
    return error(res, `Ya existe un registro con ese valor en: ${target}`, 409, 'DUPLICATE');
  }

  if (err.code === 'P2025') {
    return error(res, 'Registro no encontrado', 404, 'NOT_FOUND');
  }

  if (err.code === 'P2003') {
    const field = err.meta?.field_name || 'campo';
    return error(res, `Referencia inválida en campo: ${field}`, 400, 'FOREIGN_KEY_ERROR');
  }

  if (err.code === 'P2011') {
    const field = err.meta?.constraint || 'campo';
    return error(res, `Campo requerido nulo: ${field}`, 400, 'NULL_CONSTRAINT');
  }

  if (err.name === 'ZodError') {
    return error(res, 'Datos inválidos', 400, 'VALIDATION_ERROR');
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return error(res, 'El archivo es demasiado grande', 413, 'FILE_TOO_LARGE');
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    return error(res, 'Demasiados archivos', 413, 'TOO_MANY_FILES');
  }

  // ── Errores nuestros: el mensaje se escribió para el usuario ────────────
  if (err.statusCode) {
    return error(res, err.message, err.statusCode, err.code || 'BAD_REQUEST');
  }

  // ── Cualquier otra cosa: nada del error sale de aquí ────────────────────
  return error(
    res,
    `Error interno del servidor. Si el problema persiste, reporta la referencia ${referencia}.`,
    500,
    'INTERNAL_ERROR'
  );
}

module.exports = errorHandler;
