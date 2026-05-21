const { error } = require('../utils/apiResponse');

function errorHandler(err, req, res, _next) {
  console.error('[ERROR]', err);

  if (err.code === 'P2002') {
    const target = err.meta?.target?.join(', ') || 'campo';
    return error(res, `Ya existe un registro con ese valor en: ${target}`, 409, 'DUPLICATE');
  }

  if (err.code === 'P2025') {
    return error(res, 'Registro no encontrado', 404, 'NOT_FOUND');
  }

  if (err.name === 'ZodError') {
    return error(res, 'Datos inválidos', 400, 'VALIDATION_ERROR');
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return error(res, 'El archivo es demasiado grande', 413, 'FILE_TOO_LARGE');
  }

  return error(res, 'Error interno del servidor', 500, 'INTERNAL_ERROR');
}

module.exports = errorHandler;
