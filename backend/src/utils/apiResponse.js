function success(res, data = null, meta = null, statusCode = 200) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

function error(res, message, statusCode = 400, code = null) {
  const body = {
    success: false,
    error: { message },
  };
  if (code) body.error.code = code;
  return res.status(statusCode).json(body);
}

module.exports = { success, error };
