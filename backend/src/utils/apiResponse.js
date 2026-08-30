function success(res, data = null, meta = null, statusCode = 200) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

// Un DELETE que ha ido bien no tiene nada que devolver: 204 sin cuerpo.
function noContent(res) {
  return res.status(204).end();
}

function error(res, message, statusCode = 400, code = null, details = null) {
  const body = {
    success: false,
    error: { message },
  };
  if (code) body.error.code = code;
  // Errores de validación por campo: [{ field, message }]
  if (details) body.error.details = details;
  return res.status(statusCode).json(body);
}

module.exports = { success, noContent, error };
