const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { generateToken, getExpiryTime } = require('../utils/tokenUtils');
const { UnauthorizedError, NotFoundError, BadRequestError } = require('../errors/AppError');
const emailService = require('../utils/emailService');
const crypto = require('crypto');

const resetCodes = new Map();

class AuthService {
  async login({ email, password, remember, userAgent }) {
    if (!email || !password) throw new BadRequestError('Correo y contraseña requeridos');

    const usuario = await prisma.usuarios.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        personas: { include: { tipos_documento: true } },
        roles: { include: { permisos_rol: { include: { permisos: true } } } },
        permisos_usuario: { include: { permisos: true } }
      }
    });

    if (!usuario) throw new UnauthorizedError('Usuario no encontrado');

    const validPassword = await bcrypt.compare(password, usuario.password_hash);
    if (!validPassword) throw new UnauthorizedError('Contraseña incorrecta');

    if (usuario.status === 'inactive') throw new UnauthorizedError('Usuario inactivo. Contacte al administrador');

    const token = generateToken({ userId: usuario.id, role: usuario.roles.nombre }, remember);
    const expiresAt = new Date(getExpiryTime(remember));

    await prisma.sesiones.create({
      data: { id: crypto.randomUUID(), usuario_id: usuario.id, token_hash: token, expires_at: expiresAt, user_agent: userAgent || null }
    });

    await prisma.usuarios.update({
      where: { id: usuario.id },
      data: { ultimo_login: new Date() }
    });

    return {
      token,
      user: {
        id: usuario.id,
        email: usuario.email,
        role: usuario.roles.nombre,
        firstName: usuario.personas.nombres,
        lastName: usuario.personas.apellidos,
        name: `${usuario.personas.nombres} ${usuario.personas.apellidos}`,
        docType: usuario.personas.tipos_documento?.abreviatura || null,
        docNumber: usuario.personas.documento,
        phone: usuario.personas.telefono,
        status: usuario.status,
        avatar: usuario.personas.avatar_url,
        birth_date: usuario.personas.birth_date,
        permisos: usuario.permisos_usuario.map(pu => ({ modulo: pu.permisos.modulo, accion: pu.permisos.accion, valor: pu.valor }))
      }
    };
  }

  async me(userId) {
    const usuario = await prisma.usuarios.findUnique({
      where: { id: userId },
      include: {
        personas: { include: { tipos_documento: true } },
        roles: { include: { permisos_rol: { include: { permisos: true } } } },
        permisos_usuario: { include: { permisos: true } }
      }
    });

    if (!usuario) throw new NotFoundError('Usuario no encontrado');

    const permisos = usuario.permisos_usuario.map(pu => ({
      modulo: pu.permisos.modulo,
      accion: pu.permisos.accion,
      valor: pu.valor
    }));

    return {
      user: {
        id: usuario.id,
        email: usuario.email,
        role: usuario.roles.nombre,
        firstName: usuario.personas.nombres,
        lastName: usuario.personas.apellidos,
        name: `${usuario.personas.nombres} ${usuario.personas.apellidos}`,
        docType: usuario.personas.tipos_documento?.abreviatura || null,
        docNumber: usuario.personas.documento,
        phone: usuario.personas.telefono,
        status: usuario.status,
        avatar: usuario.personas.avatar_url,
        birth_date: usuario.personas.birth_date,
        permisos
      }
    };
  }
}

module.exports = new AuthService();
