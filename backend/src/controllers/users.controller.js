const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { success, error } = require('../utils/apiResponse');
const { buildMeta } = require('../utils/paginationHelper');
const emailService = require('../utils/emailService');
const { AUTH_CACHE } = require('../middleware/auth');
const { formatName } = require('../utils/stringUtils');

exports.list = async (req, res, next) => {
  try {
    const { page, perPage, skip } = req.pagination;
    const { search, sortBy, sortOrder } = req;
    const { role, status } = req.query;

    let searchCondition = '';
    if (search) {
      searchCondition = `AND (p.nombres ILIKE '%${search}%' OR p.apellidos ILIKE '%${search}%' OR u.email ILIKE '%${search}%')`;
    }
    
    let roleCondition = '';
    if (role) roleCondition = `AND r.nombre = '${role}'`;
    
    let statusCondition = '';
    if (status) statusCondition = `AND u.status = '${status}'`;

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
    where.persona = { ...where.persona, deletedAt: null };

    // Ejecución paralela: Conteo (Prisma) y Búsqueda (SQL Puro)
    const [total, usuariosRaw] = await Promise.all([
      prisma.usuarios.count({ where }),
      prisma.$queryRawUnsafe(`
        SELECT 
          u.id, 
          u.email, 
          u.status, 
          u.ultimo_login as "ultimoLogin", 
          u.creado_at as "creadoAt",
          p.nombres as "firstName", 
          p.apellidos as "lastName", 
          p.telefono as "phone", 
          p.documento as "docNumber", 
          p.birth_date as "birthDate", 
          p.avatar_url as "avatar",
          td.abreviatura as "docType",
          r.nombre as "role"
        FROM usuarios u
        JOIN personas p ON u.persona_id = p.id
        LEFT JOIN tipos_documento td ON p.tipo_documento_id = td.id
        JOIN roles r ON u.rol_id = r.id
        WHERE p.deleted_at IS NULL ${searchCondition} ${roleCondition} ${statusCondition}
        ORDER BY u.id DESC
        LIMIT ${perPage} OFFSET ${skip}
      `)
    ]);

    const data = usuariosRaw.map(u => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      phone: u.phone,
      docType: u.docType || null,
      docNumber: u.docNumber,
      status: u.status,
      avatar: u.avatar,
      birthDate: u.birthDate,
      lastLogin: u.ultimoLogin,
      createdAt: u.creadoAt,
      customPermissions: undefined // Se omiten para la tabla general para maximizar la velocidad
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
      include: {
        persona: { include: { tipoDocumento: true } },
        rol: true,
        permisosUsuario: { include: { permiso: true }, where: { permitido: true } }
      }
    });
    if (!usuario) return error(res, 'Usuario no encontrado', 404);
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
      avatar: usuario.persona.avatarUrl,
      birthDate: usuario.persona.birthDate,
      lastLogin: usuario.ultimoLogin,
      createdAt: usuario.creadoAt,
      
      customPermissions: usuario.permisosUsuario.length > 0 ? usuario.permisosUsuario.reduce((acc, pu) => {
        if (!acc[pu.permiso.modulo]) acc[pu.permiso.modulo] = {};
        const val = pu.valor || 'true';
        const isScopedView = pu.permiso.accion === 'view' && ['dashboard','sales','clients'].includes(pu.permiso.modulo);
        acc[pu.permiso.modulo][pu.permiso.accion] = isScopedView
          ? (val === 'own' || val === 'all' || val === 'none' ? val : 'all')
          : (val === 'true' || val === true);
        return acc;
      }, {}) : undefined
    });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = req.body;
    const passwordHash = await bcrypt.hash(data.password, 12);

    let tipoDocumentoId = null;
    if (data.docType) {
      const dt = await prisma.tiposDocumento.findUnique({ where: { abreviatura: data.docType } });
      if (dt) tipoDocumentoId = dt.id;
    }

    // Check if user with this document already exists
    if (data.docNumber) {
      const existingUser = await prisma.usuarios.findFirst({
        where: { persona: { documento: data.docNumber } }
      });
      if (existingUser) {
        return error(res, 'Este número de documento ya está registrado como usuario', 400);
      }
    }

    let persona;
    if (data.docNumber) {
      const existingPersona = await prisma.personas.findUnique({
        where: { documento: data.docNumber }
      });
      if (existingPersona) {
        persona = await prisma.personas.update({
          where: { id: existingPersona.id },
          data: {
            nombres: formatName(data.firstName || data.name?.split(' ')[0] || existingPersona.nombres),
            apellidos: formatName(data.lastName || data.name?.split(' ').slice(1).join(' ') || existingPersona.apellidos),
            tipoDocumentoId: tipoDocumentoId || existingPersona.tipoDocumentoId,
            email: data.email || existingPersona.email,
            telefono: data.phone || existingPersona.telefono,
            birthDate: data.birthDate ? new Date(data.birthDate) : existingPersona.birthDate,
            avatarUrl: data.avatar || existingPersona.avatarUrl,
            status: data.status || 'active',
            deletedAt: null
          }
        });
      }
    }

    if (!persona) {
      persona = await prisma.personas.create({
        data: {
          nombres: formatName(data.firstName || data.name?.split(' ')[0] || ''),
          apellidos: formatName(data.lastName || data.name?.split(' ').slice(1).join(' ') || ''),
          tipoDocumentoId,
          documento: data.docNumber || null,
          email: data.email,
          telefono: data.phone,
          birthDate: data.birthDate ? new Date(data.birthDate) : null,
          avatarUrl: data.avatar || null,
          status: data.status || 'active'
        }
      });
    }

    const rol = await prisma.roles.findUnique({ where: { nombre: data.role } });
    if (!rol) return error(res, 'Rol no válido', 400);

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

    try {
      await emailService.sendEmail({
        to: data.email,
        subject: '¡Bienvenido a Samtur Travel - Cuenta Creada!',
        html: `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaec; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #0f172a; padding: 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">¡Bienvenido a Samtur Travel!</h1>
            </div>
            <div style="padding: 30px;">
              <p style="font-size: 16px;">Hola <strong>${persona.nombres}</strong>,</p>
              <p style="font-size: 16px;">Tu cuenta ha sido creada exitosamente en nuestro sistema.</p>
              <p style="font-size: 16px;"><strong>Tus credenciales de acceso temporal son:</strong></p>
              <ul style="font-size: 16px; background: #f8fafc; padding: 15px 30px; border-radius: 6px;">
                <li><strong>Correo:</strong> ${data.email}</li>
                <li><strong>Contraseña:</strong> ${data.password}</li>
              </ul>
              <p style="font-size: 16px; margin-top: 20px;">Te recomendamos cambiar tu contraseña una vez inicies sesión por motivos de seguridad.</p>
            </div>
          </div>
        `
      });
      console.log(`[USER CREATE] Welcome email sent successfully to ${data.email}`);
    } catch (emailErr) {
      console.error('[ERROR] Sending welcome email:', emailErr.message);
    }

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

    const personaUpdate = {};
    if (data.firstName) personaUpdate.nombres = formatName(data.firstName);
    if (data.lastName) personaUpdate.apellidos = formatName(data.lastName);
    if (data.phone !== undefined) personaUpdate.telefono = data.phone;
    
    if (data.docNumber !== undefined) {
      if (data.docNumber) {
        const existingDoc = await prisma.personas.findUnique({
          where: { documento: data.docNumber }
        });
        if (existingDoc && existingDoc.id !== usuario.personaId) {
          return error(res, 'Este número de documento ya está asignado a otra persona en el sistema', 400);
        }
      }
      personaUpdate.documento = data.docNumber;
    }

    if (data.birthDate) personaUpdate.birthDate = new Date(data.birthDate);
    if (data.avatar !== undefined) personaUpdate.avatarUrl = data.avatar;
    if (data.email) personaUpdate.email = data.email;

    if (data.docType) {
      const dt = await prisma.tiposDocumento.findUnique({ where: { abreviatura: data.docType } });
      if (dt) personaUpdate.tipoDocumentoId = dt.id;
    }

    if (Object.keys(personaUpdate).length > 0) {
      personaUpdate.updatedAt = new Date();
      await prisma.personas.update({
        where: { id: usuario.personaId },
        data: personaUpdate
      });
    }

    const updateData = {};
    if (data.email) updateData.email = data.email;
    if (data.passwordHash) updateData.passwordHash = data.passwordHash;
    if (data.role) {
      const rol = await prisma.roles.findUnique({ where: { nombre: data.role } });
      if (!rol) return error(res, 'Rol no válido', 400);
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

    const hasActiveRelations = await prisma.clientes.findFirst({ where: { personaId: usuario.personaId } })
      || await prisma.comisionistas.findFirst({ where: { personaId: usuario.personaId } });

    await prisma.usuarios.update({
      where: { id },
      data: { status: 'inactive' }
    });

    if (!hasActiveRelations) {
      await prisma.personas.update({
        where: { id: usuario.personaId },
        data: { deletedAt: new Date(), status: 'inactive' }
      });
    }

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
        const encoded = value === 'all' || value === 'own' || value === 'none' ? value
          : value === true || value === 'true' ? 'true'
          : value === false || value === 'false' ? 'false'
          : String(value);

        // Buscar o crear el registro en el catálogo de permisos
        let permiso = await prisma.permisos.findFirst({ where: { modulo, accion } });
        if (!permiso) {
          permiso = await prisma.permisos.create({
            data: { modulo, accion, descripcion: `${modulo} - ${accion}` }
          });
        }

        await prisma.permisosUsuario.create({
          data: { usuarioId: id, permisoId: permiso.id, permitido: true, valor: encoded }
        });
      }
    }

    // Invalidar caché de autenticación del usuario para que en la próxima petición
    // se recarguen sus permisos actualizados desde la BD
    AUTH_CACHE.delete(id);

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
