const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { success, error } = require('../utils/apiResponse');
const { buildMeta } = require('../utils/paginationHelper');

exports.list = async (req, res, next) => {
  try {
    const { page, perPage, skip } = req.pagination;
    const { search, sortBy, sortOrder } = req;
    const { role, status } = req.query;

    const where = {};
    if (search) {
      where.OR = [
        { persona: { nombres: { contains: search, mode: 'insensitive' } } },
        { persona: { apellidos: { contains: search, mode: 'insensitive' } } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (role) where.rol = { nombre: role };
    if (status) where.status = status;

    const [total, usuarios] = await Promise.all([
      prisma.usuarios.count({ where }),
      prisma.usuarios.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { [sortBy]: sortOrder },
        include: {
          persona: { include: { tipoDocumento: true } },
          rol: true,
          permisosUsuario: { include: { permiso: true }, where: { permitido: true } }
        }
      })
    ]);

    const data = usuarios.map(u => ({
      id: u.id,
      name: `${u.persona.nombres} ${u.persona.apellidos}`,
      firstName: u.persona.nombres,
      lastName: u.persona.apellidos,
      email: u.email,
      role: u.rol.nombre,
      phone: u.persona.telefono,
      docType: u.persona.tipoDocumento?.abreviatura || null,
      docNumber: u.persona.documento,
      status: u.status,
      avatar: u.persona.avatarUrl,
      birthDate: u.persona.birthDate,
      lastLogin: u.ultimoLogin,
      createdAt: u.creadoAt,
      customPermissions: u.permisosUsuario.length > 0 ? u.permisosUsuario.reduce((acc, pu) => {
        acc[pu.permiso.modulo] = { [pu.permiso.accion]: true };
        return acc;
      }, {}) : undefined
    }));

    success(res, data, buildMeta(total, page, perPage));
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const usuario = await prisma.usuarios.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { persona: true, rol: true, permisosUsuario: { include: { permiso: true } } }
    });
    if (!usuario) return error(res, 'Usuario no encontrado', 404);
    success(res, usuario);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = req.body;
    const passwordHash = await bcrypt.hash(data.password, 12);

    const persona = await prisma.personas.create({
      data: {
        nombres: data.firstName || data.name?.split(' ')[0] || '',
        apellidos: data.lastName || data.name?.split(' ').slice(1).join(' ') || '',
        tipoDocumentoId: data.docType ? parseInt(data.docType) : null,
        documento: data.docNumber,
        email: data.email,
        telefono: data.phone,
        status: data.status || 'active'
      }
    });

    const rol = await prisma.roles.findUnique({ where: { nombre: data.role } });
    const usuario = await prisma.usuarios.create({
      data: {
        personaId: persona.id,
        email: data.email,
        passwordHash,
        rolId: rol.id,
        status: data.status || 'active'
      },
      include: { persona: { include: { tipoDocumento: true } }, rol: true }
    });

    success(res, {
      id: usuario.id,
      name: `${usuario.persona.nombres} ${usuario.persona.apellidos}`,
      firstName: usuario.persona.nombres,
      lastName: usuario.persona.apellidos,
      email: usuario.email,
      role: usuario.rol.nombre,
      phone: usuario.persona.telefono,
      docType: usuario.persona.tipoDocumento?.abreviatura || null,
      docNumber: usuario.persona.documento,
      status: usuario.status,
      birthDate: usuario.persona.birthDate,
      avatar: usuario.persona.avatarUrl,
      createdAt: usuario.creadoAt,
      lastLogin: usuario.ultimoLogin
    }, null, 201);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const data = req.body;

    const usuario = await prisma.usuarios.findUnique({ where: { id }, include: { persona: true } });
    if (!usuario) return error(res, 'Usuario no encontrado', 404);

    if (data.password) {
      data.passwordHash = await bcrypt.hash(data.password, 12);
      delete data.password;
    }

    if (data.firstName || data.lastName) {
      await prisma.personas.update({
        where: { id: usuario.personaId },
        data: {
          nombres: data.firstName || usuario.persona.nombres,
          apellidos: data.lastName || usuario.persona.apellidos
        }
      });
    }

    const updateData = {};
    if (data.email) updateData.email = data.email;
    if (data.passwordHash) updateData.passwordHash = data.passwordHash;
    if (data.role) {
      const rol = await prisma.roles.findUnique({ where: { nombre: data.role } });
      updateData.rolId = rol.id;
    }
    if (data.status) updateData.status = data.status;

    const updated = await prisma.usuarios.update({
      where: { id },
      data: updateData,
      include: { persona: { include: { tipoDocumento: true } }, rol: true }
    });

    success(res, {
      id: updated.id,
      name: `${updated.persona.nombres} ${updated.persona.apellidos}`,
      firstName: updated.persona.nombres,
      lastName: updated.persona.apellidos,
      email: updated.email,
      role: updated.rol.nombre,
      phone: updated.persona.telefono,
      docType: updated.persona.tipoDocumento?.abreviatura || null,
      docNumber: updated.persona.documento,
      status: updated.status,
      birthDate: updated.persona.birthDate,
      avatar: updated.persona.avatarUrl,
      createdAt: updated.creadoAt,
      lastLogin: updated.ultimoLogin
    });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const usuario = await prisma.usuarios.findUnique({ where: { id }, include: { persona: true } });
    if (!usuario) return error(res, 'Usuario no encontrado', 404);

    await prisma.usuarios.delete({ where: { id } });
    await prisma.personas.update({
      where: { id: usuario.personaId },
      data: { deletedAt: new Date(), status: 'inactive' }
    });

    success(res, { message: 'Usuario eliminado' });
  } catch (err) {
    next(err);
  }
};

exports.updatePermissions = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { permissions } = req.body;

    await prisma.permisosUsuario.deleteMany({ where: { usuarioId: id } });

    for (const [modulo, accs] of Object.entries(permissions)) {
      for (const [accion, value] of Object.entries(accs)) {
        if (value === true || value === 'all' || value === 'own') {
          const permiso = await prisma.permisos.findFirst({
            where: { modulo, accion }
          });
          if (permiso) {
            await prisma.permisosUsuario.create({
              data: { usuarioId: id, permisoId: permiso.id, permitido: true }
            });
          }
        }
      }
    }

    success(res, { message: 'Permisos actualizados' });
  } catch (err) {
    next(err);
  }
};

exports.uploadAvatar = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (!req.file) return error(res, 'Archivo requerido', 400);

    const usuario = await prisma.usuarios.findUnique({ where: { id } });
    if (!usuario) return error(res, 'Usuario no encontrado', 404);

    const avatarUrl = `/uploads/${req.file.filename}`;
    await prisma.personas.update({
      where: { id: usuario.personaId },
      data: { avatarUrl }
    });

    success(res, { avatarUrl });
  } catch (err) {
    next(err);
  }
};
