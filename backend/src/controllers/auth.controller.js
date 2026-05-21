const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { generateToken, getExpiryTime } = require('../utils/tokenUtils');
const { success, error } = require('../utils/apiResponse');

exports.login = async (req, res, next) => {
  try {
    const { email, password, remember } = req.body;

    if (!email || !password) {
      return error(res, 'Correo y contraseña requeridos', 400);
    }

    const usuario = await prisma.usuarios.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        persona: { include: { tipoDocumento: true } },
        rol: { include: { permisosRol: { include: { permiso: true } } } },
        permisosUsuario: { include: { permiso: true } }
      }
    });

    if (!usuario) {
      return error(res, 'Usuario no encontrado', 401);
    }

    const validPassword = await bcrypt.compare(password, usuario.passwordHash);
    if (!validPassword) {
      return error(res, 'Contraseña incorrecta', 401);
    }

    if (usuario.status === 'inactive') {
      return error(res, 'Usuario inactivo. Contacte al administrador', 401);
    }

    const token = generateToken({ userId: usuario.id, role: usuario.rol.nombre }, remember);
    const expiresAt = new Date(getExpiryTime(remember));

    await prisma.sesiones.create({
      data: {
        usuarioId: usuario.id,
        tokenHash: token,
        expiresAt,
        userAgent: req.headers['user-agent'] || null
      }
    });

    await prisma.usuarios.update({
      where: { id: usuario.id },
      data: { ultimoLogin: new Date() }
    });

    const permisos = usuario.rol.permisosRol.map(pr => ({
      modulo: pr.permiso.modulo, accion: pr.permiso.accion
    }));

    success(res, {
      user: {
        id: usuario.id,
        personaId: usuario.personaId,
        name: `${usuario.persona.nombres} ${usuario.persona.apellidos}`,
        firstName: usuario.persona.nombres,
        lastName: usuario.persona.apellidos,
        email: usuario.email,
        role: usuario.rol.nombre,
        avatar: usuario.persona.avatarUrl,
        phone: usuario.persona.telefono,
        status: usuario.status,
        docType: usuario.persona.tipoDocumento?.abreviatura || null,
        docNumber: usuario.persona.documento,
        lastLogin: usuario.ultimoLogin,
        permisos
      },
      token,
      expiresAt
    });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const token = header.split(' ')[1];
    await prisma.sesiones.deleteMany({ where: { tokenHash: token } });
    success(res, { message: 'Sesión cerrada' });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    const usuario = await prisma.usuarios.findUnique({
      where: { id: req.user.id },
      include: {
        persona: { include: { tipoDocumento: true } },
        rol: { include: { permisosRol: { include: { permiso: true } } } },
        permisosUsuario: { include: { permiso: true } }
      }
    });

    const permisos = usuario.rol.permisosRol.map(pr => ({
      modulo: pr.permiso.modulo, accion: pr.permiso.accion
    }));

    success(res, {
      id: usuario.id,
      personaId: usuario.personaId,
      name: `${usuario.persona.nombres} ${usuario.persona.apellidos}`,
      firstName: usuario.persona.nombres,
      lastName: usuario.persona.apellidos,
      email: usuario.email,
      role: usuario.rol.nombre,
      avatar: usuario.persona.avatarUrl,
      phone: usuario.persona.telefono,
      status: usuario.status,
      docType: usuario.persona.tipoDocumento?.abreviatura || null,
      docNumber: usuario.persona.documento,
      lastLogin: usuario.ultimoLogin,
      permisos
    });
  } catch (err) {
    next(err);
  }
};
