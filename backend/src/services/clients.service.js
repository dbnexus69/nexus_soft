const prisma = require('../config/db');
const { NotFoundError, BadRequestError } = require('../errors/AppError');
const { buildMeta } = require('../utils/paginationHelper');

class ClientsService {
  /**
   * Obtener lista paginada y filtrada de clientes
   */
  async listClients({ pagination, search, status, permissionScope, user, sortBy, sortOrder }) {
    const { page, perPage, skip } = pagination;

    const where = {};
    if (permissionScope === 'own') {
      where.creado_por_id = user.id;
    }

    let searchCondition = '';
    if (search) {
      // Escapar comillas simples para seguridad SQL basica en raw query
      const cleanSearch = search.replace(/'/g, "''");
      searchCondition = `AND (p.nombres ILIKE '%${cleanSearch}%' OR p.apellidos ILIKE '%${cleanSearch}%' OR p.documento ILIKE '%${cleanSearch}%' OR p.email ILIKE '%${cleanSearch}%')`;
    }
    
    let statusCondition = '';
    if (status) {
      const cleanStatus = status.replace(/'/g, "''");
      statusCondition = `AND p.status = '${cleanStatus}'`;
    }
    
    let ownCondition = '';
    if (permissionScope === 'own') {
      ownCondition = `AND c.creado_por_id = ${user.id}`;
    }

    const sortFieldMapSQL = {
      'creadoAt': 'c.fecha_registro',
      'name': 'c.persona_id',
      'date': 'c.fecha_registro'
    };
    const sqlOrderBy = sortFieldMapSQL[sortBy] || 'c.fecha_registro';
    const orderDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';

    const [total, clientesRaw] = await Promise.all([
      prisma.clientes.count({ where }),
      prisma.$queryRawUnsafe(`
        SELECT 
          c.id,
          c.fecha_registro as "fecha_registro",
          c.creado_por_id as "creado_por_id",
          p.nombres as "firstName",
          p.apellidos as "lastName",
          p.documento as "docNumber",
          p.telefono as "phone",
          p.email,
          p.birth_date as "birthDate",
          p.status,
          p.avatar_url as "avatar",
          td.abreviatura as "docType"
        FROM clientes c
        JOIN personas p ON c.persona_id = p.id
        LEFT JOIN tipos_documento td ON p.tipo_documento_id = td.id
        WHERE 1=1 ${searchCondition} ${statusCondition} ${ownCondition}
        ORDER BY ${sqlOrderBy} ${orderDirection}
        LIMIT ${perPage} OFFSET ${skip}
      `)
    ]);

    const data = clientesRaw.map(c => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      name: `${c.firstName} ${c.lastName}`,
      docType: c.docType || null,
      docNumber: c.docNumber,
      phone: c.phone,
      email: c.email,
      birthDate: c.birthDate,
      status: c.status,
      avatar: c.avatar,
      registrationDate: c.fecha_registro,
      createdBy: c.creado_por_id
    }));

    return {
      data,
      meta: buildMeta(total, page, perPage)
    };
  }

  /**
   * Obtener cliente por ID
   */
  async getClientById(id, includeSales = false) {
    const cliente = await prisma.clientes.findUnique({
      where: { id },
      include: {
        personas: { include: { tipos_documento: true } },
        ventas: includeSales ? {
          include: { detalleVentas: true, usuario: { include: { personas: true } } },
          orderBy: { creadoAt: 'desc' },
          take: 50
        } : false
      }
    });

    if (!cliente) {
      throw new NotFoundError('Cliente no encontrado');
    }

    return {
      id: cliente.id,
      firstName: cliente.personas.nombres,
      lastName: cliente.personas.apellidos,
      name: `${cliente.personas.nombres} ${cliente.personas.apellidos}`,
      docType: cliente.personas.tipos_documento?.abreviatura || null,
      docNumber: cliente.personas.documento,
      phone: cliente.personas.telefono,
      email: cliente.personas.email,
      birthDate: cliente.personas.birth_date,
      status: cliente.personas.status,
      avatar: cliente.personas.avatar_url,
      registrationDate: cliente.fecha_registro,
      createdBy: cliente.creado_por_id,
      sales: includeSales ? cliente.ventas?.map(v => ({
        id: v.id,
        total: v.montoTotal,
        status: v.status,
        date: v.creadoAt,
        asesorName: v.usuario ? `${v.usuario.personas.nombres} ${v.usuario.personas.apellidos}` : null
      })) : undefined
    };
  }

  /**
   * Crear nuevo cliente
   */
  async createClient(data, userId) {
    let tipo_documento_id = null;

    if (data.docType) {
      const tipoDoc = await prisma.tipos_documento.findUnique({
        where: { abreviatura: data.docType }
      });
      if (tipoDoc) tipo_documento_id = tipoDoc.id;
    }

    if (data.docNumber) {
      const existingClient = await prisma.clientes.findFirst({
        where: { personas: { documento: data.docNumber } },
        include: { personas: true }
      });
      if (existingClient && !existingClient.personas.deleted_at) {
        throw new BadRequestError('Este número de documento ya está registrado como cliente activo');
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
            nombres: data.firstName || existingPersona.nombres,
            apellidos: data.lastName || existingPersona.apellidos,
            tipo_documento_id: tipo_documento_id || existingPersona.tipo_documento_id,
            email: data.email || existingPersona.email,
            telefono: data.phone || existingPersona.telefono,
            avatar_url: data.avatar || existingPersona.avatar_url,
            birth_date: data.birthDate && !isNaN(new Date(data.birthDate).getTime()) ? new Date(data.birthDate) : existingPersona.birth_date,
            status: 'active',
            deleted_at: null
          }
        });
      }
    }

    const parsedBirthDate = data.birthDate && !isNaN(new Date(data.birthDate).getTime()) ? new Date(data.birthDate) : null;

    if (!persona) {
      persona = await prisma.personas.create({
        data: {
          nombres: data.firstName || '',
          apellidos: data.lastName || '',
          tipo_documento_id,
          documento: data.docNumber || null,
          email: data.email,
          telefono: data.phone,
          avatar_url: data.avatar || null,
          birth_date: parsedBirthDate,
          status: 'active'
        }
      });
    }

    const cliente = await prisma.clientes.create({
      data: { persona_id: persona.id, creado_por_id: userId },
      include: { personas: true }
    });

    return {
      id: cliente.id,
      firstName: persona.nombres,
      lastName: persona.apellidos,
      name: `${persona.nombres} ${persona.apellidos}`,
      docType: data.docType,
      docNumber: data.docNumber,
      phone: data.phone,
      email: data.email,
      birthDate: data.birthDate,
      avatar: persona.avatar_url,
      status: 'active',
      registrationDate: cliente.fecha_registro,
      createdBy: cliente.creado_por_id
    };
  }

  /**
   * Actualizar cliente existente
   */
  async updateClient(id, data) {
    const cliente = await prisma.clientes.findUnique({
      where: { id },
      include: { personas: true }
    });

    if (!cliente) {
      throw new NotFoundError('Cliente no encontrado');
    }

    const personaData = {};
    if (data.firstName) personaData.nombres = data.firstName;
    if (data.lastName) personaData.apellidos = data.lastName;

    if (data.docType) {
      const tipoDoc = await prisma.tipos_documento.findUnique({
        where: { abreviatura: data.docType }
      });
      if (tipoDoc) personaData.tipo_documento_id = tipoDoc.id;
    }

    if (data.docNumber) {
      const existingDoc = await prisma.personas.findUnique({
        where: { documento: data.docNumber }
      });
      if (existingDoc && existingDoc.id !== cliente.persona_id) {
        throw new BadRequestError('Este número de documento ya está asignado a otra persona en el sistema');
      }
      personaData.documento = data.docNumber;
    }

    if (data.email) personaData.email = data.email;
    if (data.phone) personaData.telefono = data.phone;
    if (data.avatar) personaData.avatar_url = data.avatar;
    if (data.birthDate && !isNaN(new Date(data.birthDate).getTime())) personaData.birth_date = new Date(data.birthDate);

    if (Object.keys(personaData).length > 0) {
      personaData.updated_at = new Date();
      await prisma.personas.update({
        where: { id: cliente.persona_id },
        data: personaData
      });
    }

    return { message: 'Cliente actualizado' };
  }

  /**
   * Cambiar estado activo/inactivo
   */
  async toggleClientStatus(id) {
    const cliente = await prisma.clientes.findUnique({
      where: { id },
      include: { personas: true }
    });

    if (!cliente) {
      throw new NotFoundError('Cliente no encontrado');
    }

    const newStatus = cliente.personas.status === 'active' ? 'inactive' : 'active';
    await prisma.personas.update({
      where: { id: cliente.persona_id },
      data: { status: newStatus, updated_at: new Date() }
    });

    return { status: newStatus };
  }

  /**
   * Actualizar avatar de cliente
   */
  async uploadAvatar(id, file) {
    if (!file) {
      throw new BadRequestError('Archivo requerido');
    }

    const cliente = await prisma.clientes.findUnique({ where: { id } });
    if (!cliente) {
      throw new NotFoundError('Cliente no encontrado');
    }

    const avatarUrl = `/uploads/${file.filename}`;
    await prisma.personas.update({
      where: { id: cliente.persona_id },
      data: { avatarUrl }
    });

    return { avatarUrl };
  }
}

module.exports = new ClientsService();
