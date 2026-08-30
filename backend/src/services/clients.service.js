const prisma = require('../config/db');
const { NotFoundError, BadRequestError } = require('../errors/AppError');
const { buildMeta } = require('../utils/paginationHelper');

class ClientsService {
  /**
   * Obtener lista paginada y filtrada de clientes
   */
  async listClients({ pagination, search, status, permissionScope, user, sortBy, sortOrder }) {
    const { page, perPage, skip } = pagination;

    // Un solo constructor de filtros para el count y para el SQL. Antes el
    // count ignoraba el search: una búsqueda sin resultados seguía diciendo
    // que había N clientes, y la paginación salía mal.
    const filtros = [];
    const params = [];
    const push = (sql, ...valores) => {
      filtros.push(sql.replace(/\?/g, () => `$${params.push(valores.shift())}`));
    };

    const where = {};
    if (permissionScope === 'own') {
      push('c.creado_por_id = ?', user.id);
      where.creado_por_id = user.id;
    }
    if (search) {
      const q = `%${search}%`;
      push('(p.nombres ILIKE ? OR p.apellidos ILIKE ? OR p.documento ILIKE ? OR p.email ILIKE ?)', q, q, q, q);
      const como = { contains: search, mode: 'insensitive' };
      where.personas = {
        ...(where.personas || {}),
        OR: [{ nombres: como }, { apellidos: como }, { documento: como }, { email: como }]
      };
    }
    if (status) {
      push('p.status = ?::"UserStatus"', status);
      where.personas = { ...(where.personas || {}), status };
    }

    const whereSql = filtros.length ? 'AND ' + filtros.join(' AND ') : '';

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
        WHERE 1=1 ${whereSql}
        ORDER BY ${sqlOrderBy} ${orderDirection}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, ...params, perPage, skip)
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
    // includeSales ya no arrastra las ventas: devuelve solo el resumen
    // (cuántas y cuánto suman). El historial se pide paginado con
    // GET /sales?clientId=:id, que es donde vive ese listado.
    const [cliente, resumen] = await Promise.all([
      prisma.clientes.findUnique({
        where: { id },
        include: { personas: { include: { tipos_documento: true } } }
      }),
      includeSales
        ? prisma.ventas.aggregate({
            where: { cliente_id: id, status: { not: 'anulado' } },
            _count: { _all: true },
            _sum: { monto_total: true }
          })
        : null
    ]);

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
      salesCount: resumen ? resumen._count._all : undefined,
      salesTotal: resumen ? (resumen._sum.monto_total || 0) : undefined
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
