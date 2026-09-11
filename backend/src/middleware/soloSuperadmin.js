const { error } = require('../utils/apiResponse');

/**
 * Deja pasar solo al superadministrador del sistema.
 *
 * El rol se comprueba contra `req.user`, que viene de la base, **no** del token.
 * El token también lo lleva —el middleware de autenticación lo usa para poner la
 * variable de sesión antes de hablar con la base—, pero un token es una foto del
 * momento en que se emitió: si a alguien le quitan el rol, su token sigue
 * diciendo lo que decía. Quien decide es la fila.
 */
function soloSuperadmin(req, res, next) {
  if (req.user?.role !== 'superadmin') {
    return error(res, 'Solo el superadministrador puede administrar empresas', 403, 'FORBIDDEN');
  }
  next();
}

module.exports = { soloSuperadmin };
