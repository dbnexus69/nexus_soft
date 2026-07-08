const { error } = require('../utils/apiResponse');

function errorHandler(err, req, res, _next) {
  console.error('[ERROR]', err.message || err);
  if (err.meta) console.error('[ERROR META]', JSON.stringify(err.meta));
  if (err.stack) console.error('[ERROR STACK]', err.stack);

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

  if (err.statusCode) {
    return error(res, err.message, err.statusCode, err.code || 'BAD_REQUEST');
  }

  const msg = err.stack ? `${err.message || err}\n${err.stack}` : `Error interno: ${err.message || err}`;
  return error(res, msg, 500, 'INTERNAL_ERROR');
}

module.exports = errorHandler;
