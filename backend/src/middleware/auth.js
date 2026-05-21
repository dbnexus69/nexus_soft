const { verifyToken } = require('../utils/tokenUtils');
const prisma = require('../config/db');
const { error } = require('../utils/apiResponse');

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return error(res, 'Token de autenticación requerido', 401, 'AUTH_REQUIRED');
    }

    const token = header.split(' ')[1];
    const decoded = verifyToken(token);

    const usuario = await prisma.usuarios.findUnique({
      where: { id: decoded.userId },
      include: {
        persona: true,
        rol: {
          include: {
            permisosRol: { include: { permiso: true } }
          }
        },
        permisosUsuario: { include: { permiso: true } }
      }
    });

    if (!usuario || usuario.status === 'inactive') {
      return error(res, 'Usuario no encontrado o inactivo', 401, 'USER_INACTIVE');
    }

    req.user = {
      id: usuario.id,
      personaId: usuario.personaId,
      email: usuario.email,
      nombre: `${usuario.persona.nombres} ${usuario.persona.apellidos}`,
      avatarUrl: usuario.persona.avatarUrl,
      role: usuario.rol.nombre,
      permisosRol: usuario.rol.permisosRol.map(pr => ({
        modulo: pr.permiso.modulo,
        accion: pr.permiso.accion
      })),
      permisosUsuario: usuario.permisosUsuario.filter(pu => pu.permitido).map(pu => ({
        modulo: pu.permiso.modulo,
        accion: pu.permiso.accion
      }))
    };

    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return error(res, 'Token inválido o expirado', 401, 'INVALID_TOKEN');
    }
    next(err);
  }
}

module.exports = auth;
