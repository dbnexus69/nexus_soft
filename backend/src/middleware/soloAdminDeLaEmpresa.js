const { error } = require('../utils/apiResponse');

/**
 * Solo el admin de la agencia (o el superadministrador, que entra suplantándola) cambia su perfil y su marca
 * (spec 011). Rol fijo, sin módulo en `permisos_rol`: un asesor no tiene por qué cambiar la marca de la agencia.
 */
function soloAdminDeLaEmpresa(req, res, next) {
  if (!['admin', 'superadmin'].includes(req.user?.role)) {
    return error(res, 'Solo el administrador de la agencia puede cambiar su perfil', 403, 'FORBIDDEN');
  }
  next();
}

module.exports = { soloAdminDeLaEmpresa };
