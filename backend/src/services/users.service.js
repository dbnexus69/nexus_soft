const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { NotFoundError, BadRequestError } = require('../errors/AppError');
const { buildMeta } = require('../utils/paginationHelper');
const emailService = require('../utils/emailService');
const { AUTH_CACHE } = require('../middleware/auth');
const { formatName } = require('../utils/stringUtils');

class UsersService {
  async listUsers({ pagination, search, role, status }) {
    const { page, perPage, skip } = pagination;

    let searchCondition = '';
    if (search) {
      const cleanSearch = search.replace(/'/g, "''");
      searchCondition = `AND (p.nombres ILIKE '%${cleanSearch}%' OR p.apellidos ILIKE '%${cleanSearch}%' OR u.email ILIKE '%${cleanSearch}%')`;
    }

    let roleCondition = '';
    if (role) roleCondition = `AND r.nombre = '${role.replace(/'/g, "''")}'`;

    let statusCondition = '';
    if (status) statusCondition = `AND u.status = '${status.replace(/'/g, "''")}'`;

    const where = {};
    if (search) {
      where.OR = [
        { personas: { nombres: { contains: search, mode: 'insensitive' } } },
        { personas: { apellidos: { contains: search, mode: 'insensitive' } } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (role) where.roles = { nombre: role };
    if (status) where.status = status;
    where.personas = { ...where.personas, deleted_at: null };

    const [total, usuariosRaw] = await Promise.all([
      prisma.usuarios.count({ where }),
      prisma.$queryRawUnsafe(`
        SELECT 
          u.id, 
          u.email, 
          u.status, 
          u.ultimo_login as "ultimo_login", 
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
      birth_date: u.birthDate,
      lastLogin: u.ultimo_login,
      creado_at: u.creadoAt,
      customPermissions: undefined
    }));

    return {
      data,
      meta: buildMeta(total, page, perPage)
    };
  }

  async getUserById(id) {
    const usuario = await prisma.usuarios.findUnique({
      where: { id },
      include: {
        personas: { include: { tipos_documento: true } },
        roles: true,
        permisos_usuario: { include: { permisos: true }, where: { permitido: true } }
      }
    });

    if (!usuario) {
      throw new NotFoundError('Usuario no encontrado');
    }

    return {
      id: usuario.id,
      name: `${usuario.personas.nombres} ${usuario.personas.apellidos}`,
      firstName: usuario.personas.nombres,
      lastName: usuario.personas.apellidos,
      email: usuario.email,
      role: usuario.roles.nombre,
      phone: usuario.personas.telefono,
      docType: usuario.personas.tipos_documento?.abreviatura || null,
      docNumber: usuario.personas.documento,
      status: usuario.status,
      avatar: usuario.personas.avatar_url,
      birth_date: usuario.personas.birth_date,
      lastLogin: usuario.ultimo_login,
      creado_at: usuario.creadoAt,
      customPermissions: usuario.permisos_usuario.length > 0 ? usuario.permisos_usuario.reduce((acc, pu) => {
        if (!acc[pu.permisos.modulo]) acc[pu.permisos.modulo] = {};
        const val = pu.valor || 'true';
        const isScopedView = pu.permisos.accion === 'view' && ['dashboard','sales','clients'].includes(pu.permisos.modulo);
        acc[pu.permisos.modulo][pu.permisos.accion] = isScopedView
          ? (val === 'own' || val === 'all' || val === 'none' ? val : 'all')
          : (val === 'true' || val === true);
        return acc;
      }, {}) : undefined
    };
  }

  async createUser(data) {
    const password_hash = await bcrypt.hash(data.password, 12);

    let tipo_documento_id = null;
    if (data.docType) {
      const dt = await prisma.tipos_documento.findUnique({ where: { abreviatura: data.docType } });
      if (dt) tipo_documento_id = dt.id;
    }

    if (data.docNumber) {
      // Solo bloquear si el usuario existente NO fue eliminado lógicamente
      const existingUser = await prisma.usuarios.findFirst({
        where: { personas: { documento: data.docNumber } },
        include: { personas: true }
      });
      if (existingUser && !existingUser.personas.deleted_at) {
        throw new BadRequestError('Este número de documento ya está registrado como usuario activo');
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
            tipo_documento_id: tipo_documento_id || existingPersona.tipo_documento_id,
            email: data.email || existingPersona.email,
            telefono: data.phone || existingPersona.telefono,
            birth_date: data.birthDate ? new Date(data.birthDate) : existingPersona.birth_date,
            avatar_url: data.avatar || existingPersona.avatar_url,
            status: data.status || 'active',
            deleted_at: null
          }
        });
      }
    }

    if (!persona) {
      persona = await prisma.personas.create({
        data: {
          nombres: formatName(data.firstName || data.name?.split(' ')[0] || ''),
          apellidos: formatName(data.lastName || data.name?.split(' ').slice(1).join(' ') || ''),
          tipo_documento_id,
          documento: data.docNumber || null,
          email: data.email,
          telefono: data.phone,
          birth_date: data.birthDate ? new Date(data.birthDate) : null,
          avatar_url: data.avatar || null,
          status: data.status || 'active'
        }
      });
    }

    const roles = await prisma.roles.findUnique({ where: { nombre: data.role } });
    if (!roles) {
      throw new BadRequestError('Rol no válido');
    }

    const usuario = await prisma.usuarios.create({
      data: {
        persona_id: persona.id,
        email: data.email,
        password_hash,
        rol_id: roles.id,
        status: data.status || 'active'
      },
      include: { personas: { include: { tipos_documento: true } }, roles: true }
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
    } catch (emailErr) {
      console.error('[ERROR] Sending welcome email:', emailErr.message);
    }

    return {
      id: usuario.id,
      name: `${usuario.personas.nombres} ${usuario.personas.apellidos}`,
      firstName: usuario.personas.nombres,
      lastName: usuario.personas.apellidos,
      email: usuario.email,
      role: usuario.roles.nombre,
      phone: usuario.personas.telefono,
      docType: usuario.personas.tipos_documento?.abreviatura || null,
      docNumber: usuario.personas.documento,
      status: usuario.status,
      birth_date: usuario.personas.birth_date,
      avatar: usuario.personas.avatar_url,
      creado_at: usuario.creadoAt,
      lastLogin: usuario.ultimo_login
    };
  }

  async updateUser(id, data) {
    const usuario = await prisma.usuarios.findUnique({ where: { id }, include: { personas: true } });
    if (!usuario) {
      throw new NotFoundError('Usuario no encontrado');
    }

    if (data.password) {
      data.password_hash = await bcrypt.hash(data.password, 12);
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
        if (existingDoc && existingDoc.id !== usuario.persona_id) {
          throw new BadRequestError('Este número de documento ya está asignado a otra persona en el sistema');
        }
      }
      personaUpdate.documento = data.docNumber;
    }

    if (data.birthDate) personaUpdate.birth_date = new Date(data.birthDate);
    if (data.avatar !== undefined) personaUpdate.avatar_url = data.avatar;
    if (data.email) personaUpdate.email = data.email;

    if (data.docType) {
      const dt = await prisma.tipos_documento.findUnique({ where: { abreviatura: data.docType } });
      if (dt) personaUpdate.tipo_documento_id = dt.id;
    }

    if (Object.keys(personaUpdate).length > 0) {
      personaUpdate.updated_at = new Date();
      await prisma.personas.update({
        where: { id: usuario.persona_id },
        data: personaUpdate
      });
    }

    const updateData = {};
    if (data.email) updateData.email = data.email;
    if (data.password_hash) updateData.password_hash = data.password_hash;
    if (data.role) {
      const roles = await prisma.roles.findUnique({ where: { nombre: data.role } });
      if (!roles) throw new BadRequestError('Rol no válido');
      updateData.rol_id = roles.id;
    }
    if (data.status) updateData.status = data.status;

    const updated = await prisma.usuarios.update({
      where: { id },
      data: updateData,
      include: { personas: { include: { tipos_documento: true } }, roles: true }
    });

    return {
      id: updated.id,
      name: `${updated.personas.nombres} ${updated.personas.apellidos}`,
      firstName: updated.personas.nombres,
      lastName: updated.personas.apellidos,
      email: updated.email,
      role: updated.roles.nombre,
      phone: updated.personas.telefono,
      docType: updated.personas.tipos_documento?.abreviatura || null,
      docNumber: updated.personas.documento,
      status: updated.status,
      birth_date: updated.personas.birth_date,
      avatar: updated.personas.avatar_url,
      creado_at: updated.creadoAt,
      lastLogin: updated.ultimo_login
    };
  }

  async removeUser(id) {
    const usuario = await prisma.usuarios.findUnique({ where: { id }, include: { personas: true } });
    if (!usuario) {
      throw new NotFoundError('Usuario no encontrado');
    }

    const hasActiveRelations = await prisma.clientes.findFirst({ where: { persona_id: usuario.persona_id } })
      || await prisma.comisionistas.findFirst({ where: { persona_id: usuario.persona_id } });

    await prisma.usuarios.update({
      where: { id },
      data: { status: 'inactive' }
    });

    if (!hasActiveRelations) {
      await prisma.personas.update({
        where: { id: usuario.persona_id },
        data: { deleted_at: new Date(), status: 'inactive' }
      });
    }

    return { message: 'Usuario eliminado' };
  }

  async updatePermissions(id, permissions) {
    await prisma.permisos_usuario.deleteMany({ where: { usuarioId: id } });

    for (const [modulo, accs] of Object.entries(permissions)) {
      for (const [accion, value] of Object.entries(accs)) {
        const encoded = value === 'all' || value === 'own' || value === 'none' ? value
          : value === true || value === 'true' ? 'true'
          : value === false || value === 'false' ? 'false'
          : String(value);

        let permisos = await prisma.permisos.findFirst({ where: { modulo, accion } });
        if (!permisos) {
          permisos = await prisma.permisos.create({
            data: { modulo, accion, descripcion: `${modulo} - ${accion}` }
          });
        }

        await prisma.permisos_usuario.create({
          data: { usuarioId: id, permiso_id: permisos.id, permitido: true, valor: encoded }
        });
      }
    }

    AUTH_CACHE.delete(id);
    return { message: 'Permisos actualizados' };
  }

  async uploadAvatar(id, file) {
    if (!file) {
      throw new BadRequestError('Archivo requerido');
    }

    const usuario = await prisma.usuarios.findUnique({ where: { id } });
    if (!usuario) {
      throw new NotFoundError('Usuario no encontrado');
    }

    const avatarUrl = `/uploads/${file.filename}`;
    await prisma.personas.update({
      where: { id: usuario.persona_id },
      data: { avatar_url: avatarUrl }
    });

    return { avatarUrl };
  }
}

module.exports = new UsersService();
