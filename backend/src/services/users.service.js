const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { NotFoundError, BadRequestError } = require('../errors/AppError');
const { buildMeta } = require('../utils/paginationHelper');
const emailService = require('../utils/emailService');
const { olvidarUsuario } = require('../middleware/authCache');
const { formatName } = require('../utils/stringUtils');

class UsersService {
  async listUsers({ pagination, search, role, status }) {
    const { page, perPage, skip } = pagination;

    // UN solo `where`, compartido por el count y por las filas.
    //
    // Antes esto era SQL crudo que INTERPOLABA los valores en el texto de la
    // consulta y los escapaba a mano con `replace(/'/g, "''")`. El README lo
    // prohíbe expresamente ("Nunca interpolar valores en SQL"): el escapado
    // artesanal es exactamente lo que se acaba haciendo mal. Con el API de
    // objetos la parametrización es por construcción, no por disciplina.
    const where = { personas: { deleted_at: null } };

    if (search) {
      const como = { contains: search, mode: 'insensitive' };
      where.OR = [
        { personas: { nombres: como } },
        { personas: { apellidos: como } },
        { email: como },
      ];
    }
    if (role) where.roles = { nombre: role };
    if (status) where.status = status;

    const [total, filas] = await Promise.all([
      prisma.usuarios.count({ where }),
      prisma.usuarios.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { id: 'desc' },
        relationLoadStrategy: 'join',
        select: {
          id: true,
          email: true,
          status: true,
          ultimo_login: true,
          creado_at: true,
          personas: {
            select: {
              nombres: true, apellidos: true, telefono: true, documento: true,
              birth_date: true, avatar_url: true,
              tipos_documento: { select: { abreviatura: true } },
            },
          },
          roles: { select: { nombre: true } },
        },
      }),
    ]);

    const data = filas.map(u => ({
      id: u.id,
      name: `${u.personas.nombres} ${u.personas.apellidos}`,
      firstName: u.personas.nombres,
      lastName: u.personas.apellidos,
      email: u.email,
      role: u.roles?.nombre,
      phone: u.personas.telefono,
      docType: u.personas.tipos_documento?.abreviatura || null,
      docNumber: u.personas.documento,
      status: u.status,
      avatar: u.personas.avatar_url,
      birthDate: u.personas.birth_date,
      lastLogin: u.ultimo_login,
      creado_at: u.creado_at,
    }));

    return {
      data,
      meta: buildMeta(total, page, perPage),
    };
  }

  async getUserById(id) {
    // Además del usuario, el resumen de sus ventas como asesor: cuántas y
    // cuánto suman. El listado se pide aparte con GET /sales?asesorId=:id,
    // paginado, en vez de traerse todas para sumarlas en el navegador.
    const [usuario, resumenVentas] = await Promise.all([
      // `findFirst` con la persona vigente: un usuario dado de baja seguía
      // siendo legible por su id aunque no apareciera en el listado.
      prisma.usuarios.findFirst({
        where: { id, personas: { deleted_at: null } },
        include: {
          personas: { include: { tipos_documento: true } },
          roles: true,
        }
      }),
      prisma.ventas.aggregate({
        // `deleted_at: null`: sin él el resumen contaba las ventas eliminadas,
        // así que el detalle del usuario decía "10 ventas" mientras su propia
        // tabla listaba 5. Los agregados de clientes y responsables ya lo
        // filtraban; este se había quedado atrás.
        where: { usuario_id: id, deleted_at: null, status: { not: 'anulado' } },
        _count: { _all: true },
        _sum: { monto_total: true }
      })
    ]);

    if (!usuario) {
      throw new NotFoundError('Usuario no encontrado');
    }

    return {
      salesCount: resumenVentas._count._all,
      salesTotal: resumenVentas._sum.monto_total || 0,
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
      birthDate: usuario.personas.birth_date,
      lastLogin: usuario.ultimo_login,
      creado_at: usuario.creadoAt
    };
  }

  /**
   * Vuelve a poner en servicio a un usuario que se había dado de baja.
   *
   * Es lo que ocurre al "crear" un usuario cuya persona ya existía como usuario
   * inhabilitado. No es un alta nueva: mantiene el mismo id, así que sus ventas
   * y los clientes que creó siguen apuntando a él.
   */
  async reactivarUsuario(id, data, { password_hash, tipo_documento_id }) {
    const existente = await prisma.usuarios.findUnique({
      where: { id },
      select: { persona_id: true },
    });
    if (!existente) throw new NotFoundError('Usuario no encontrado');

    const rol = data.role
      ? await prisma.roles.findFirst({ where: { nombre: data.role } })
      : null;

    await prisma.transaccion(async (tx) => {
      await tx.personas.update({
        where: { id: existente.persona_id },
        data: {
          deleted_at: null,
          status: 'active',
          ...(data.firstName ? { nombres: data.firstName } : {}),
          ...(data.lastName ? { apellidos: data.lastName } : {}),
          ...(data.email ? { email: data.email } : {}),
          ...(data.phone ? { telefono: data.phone } : {}),
          ...(tipo_documento_id ? { tipo_documento_id } : {}),
        },
      });
      await tx.usuarios.update({
        where: { id },
        data: {
          status: data.status === 'inactive' ? 'inactive' : 'active',
          ...(rol ? { rol_id: rol.id } : {}),
          ...(password_hash ? { password_hash } : {}),
        },
      });
    });

    return this.getUserById(id);
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
        // Si la persona quedó como usuario dado de baja, se REVIVE esa fila en
        // vez de crear otra. `usuarios.persona_id` es `@unique`, así que crear
        // una nueva fallaba con un 409 sobre `persona_id` —un mensaje que no
        // decía nada útil—. Reactivar además conserva el historial: sus ventas
        // y los clientes que creó siguen teniendo autor.
        if (existingUser) {
          return this.reactivarUsuario(existingUser.id, data, { password_hash, tipo_documento_id });
        }
    }

    let persona;
    if (data.docNumber) {
      const existingPersona = await prisma.personas.findFirst({
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

    const roles = await prisma.roles.findFirst({ where: { nombre: data.role } });
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
    const usuario = await prisma.usuarios.findFirst({
      where: { id, personas: { deleted_at: null } },
      include: { personas: true },
    });
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
        const existingDoc = await prisma.personas.findFirst({
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
      const roles = await prisma.roles.findFirst({ where: { nombre: data.role } });
      if (!roles) throw new BadRequestError('Rol no válido');
      updateData.rol_id = roles.id;
    }
    if (data.status) updateData.status = data.status;

    // Cambiar la contraseña o inhabilitar a alguien tiene que cortarle las
    // sesiones abiertas. Antes no: el token seguía valiendo su plazo entero,
    // así que ni una cosa ni la otra surtían efecto hasta que caducara.
    if (updateData.password_hash || updateData.status === 'inactive') {
      await prisma.sesiones.deleteMany({ where: { usuario_id: id } });
      olvidarUsuario(id);
    }

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

  /**
   * Dar de baja a un usuario.
   *
   * Se borra de verdad cuando NO tiene historial, y se inhabilita cuando lo
   * tiene. Antes siempre se inhabilitaba dejando la fila de `usuarios`, y como
   * `persona_id` es `@unique`, volver a dar de alta a la misma persona fallaba
   * para siempre con un 409 sobre `persona_id`: se borraba a alguien y no se
   * podía volver a añadir. `createUser` ya intentaba permitirlo —comprueba si
   * la persona está borrada— pero chocaba con esa fila que nadie retiraba.
   *
   * El historial que impide el borrado real son las ventas que registró, los
   * clientes que creó y los paquetes que armó: son de otra gente y tienen que
   * seguir sabiendo quién las hizo. Las sesiones y el registro de accesos son
   * suyos y se van con él.
   */
  async removeUser(id, { requestedBy } = {}) {
    const usuario = await prisma.usuarios.findFirst({
      where: { id, personas: { deleted_at: null } },
      include: { personas: true, roles: true },
    });
    if (!usuario) {
      throw new NotFoundError('Usuario no encontrado');
    }

    // Nadie se borra a sí mismo: quedaría con una sesión abierta sobre una
    // cuenta inhabilitada, y si además es el único superadministrador se cierra
    // la puerta desde dentro.
    if (requestedBy && Number(requestedBy) === Number(id)) {
      throw new BadRequestError('No puedes dar de baja tu propia cuenta');
    }

    // Y no puede quedar la aplicación sin superadministrador: es el único rol
    // que puede reescribir los permisos, así que perderlo no tiene vuelta
    // desde la interfaz.
    if (usuario.roles.nombre === 'superadmin') {
      const otros = await prisma.usuarios.count({
        where: {
          id: { not: id },
          status: 'active',
          roles: { nombre: 'superadmin' },
          personas: { deleted_at: null },
        },
      });
      if (otros === 0) {
        throw new BadRequestError(
          'Es el único superadministrador activo. Asigna ese rol a otro usuario antes de darlo de baja.'
        );
      }
    }

    const [ventas, clientesCreados, paquetesCreados] = await Promise.all([
      prisma.ventas.count({ where: { usuario_id: id } }),
      prisma.clientes.count({ where: { creado_por_id: id } }),
      prisma.paquetes.count({ where: { creado_por_id: id } }),
    ]);
    const conHistorial = ventas + clientesCreados + paquetesCreados > 0;

    // La persona puede ser además cliente o comisionista: en ese caso sigue
    // viva aunque el usuario se vaya.
    const personaCompartida = Boolean(
      await prisma.clientes.findFirst({ where: { persona_id: usuario.persona_id } })
      || await prisma.comisionistas.findFirst({ where: { persona_id: usuario.persona_id } })
    );

    if (conHistorial) {
      await prisma.transaccion(async (tx) => {
        await tx.usuarios.update({ where: { id }, data: { status: 'inactive' } });
        // Inhabilitar sin cerrar la sesión abierta no inhabilita nada: el token
        // ya emitido seguía valiendo hasta caducar.
        await tx.sesiones.deleteMany({ where: { usuario_id: id } });
        if (!personaCompartida) {
          await tx.personas.update({
            where: { id: usuario.persona_id },
            data: { deleted_at: new Date(), status: 'inactive' },
          });
        }
      });
      olvidarUsuario(id);
      return {
        message: 'Usuario inhabilitado',
        deleted: false,
        reason: 'Tiene historial en el sistema, así que se conserva para no dejar sus registros sin autor.',
        history: { sales: ventas, clients: clientesCreados, packages: paquetesCreados },
      };
    }

    await prisma.transaccion(async (tx) => {
      await tx.sesiones.deleteMany({ where: { usuario_id: id } });
      await tx.logs_usuarios.deleteMany({ where: { usuario_id: id } });
      await tx.usuarios.delete({ where: { id } });
      if (!personaCompartida) await tx.personas.delete({ where: { id: usuario.persona_id } });
    });
    olvidarUsuario(id);

    return { message: 'Usuario eliminado', deleted: true };
  }

  async uploadAvatar(id, file) {
    if (!file) {
      throw new BadRequestError('Archivo requerido');
    }

    const usuario = await prisma.usuarios.findFirst({ where: { id, personas: { deleted_at: null } } });
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
