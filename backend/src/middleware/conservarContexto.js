const { conEmpresa } = require('../config/tenant');

// multer lee el request en callbacks de eventos y ahí se pierde el AsyncLocalStorage: sin esto el handler corre sin empresa y la RLS no le deja ver ninguna fila.
function conservarContexto(middleware) {
  return (req, res, next) => middleware(req, res, (err) => {
    if (err) return next(err);
    return conEmpresa(req.empresaId, () => next(), { esSuperadmin: req.user?.role === 'superadmin' });
  });
}

module.exports = { conservarContexto };
