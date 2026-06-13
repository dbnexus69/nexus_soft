const prisma = require('../config/db');
const { success, error } = require('../utils/apiResponse');
const { buildMeta } = require('../utils/paginationHelper');

exports.list = async (req, res, next) => {
  try {
    const { page, perPage, skip } = req.pagination;
    const { search, sortBy, sortOrder } = req;
    const { status } = req.query;

    const where = {};
    if (search) {
      where.persona = {
        OR: [
          { nombres: { contains: search, mode: 'insensitive' } },
          { apellidos: { contains: search, mode: 'insensitive' } },
          { documento: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      };
    }
    if (status) where.persona = { ...where.persona, status };

    if (req.permissionScope === 'own') {
      where.creadoPorId = req.user.id;
    }

    let searchCondition = '';
    if (search) searchCondition = `AND (p.nombres ILIKE '%${search}%' OR p.apellidos ILIKE '%${search}%' OR p.documento ILIKE '%${search}%' OR p.email ILIKE '%${search}%')`;
    
    let statusCondition = '';
    if (status) statusCondition = `AND p.status = '${status}'`;
    
    let ownCondition = '';
    if (req.permissionScope === 'own') ownCondition = `AND c.creado_por_id = ${req.user.id}`;

    const sortFieldMapSQL = { 'creadoAt': 'c.fecha_registro', 'name': 'c.persona_id', 'date': 'c.fecha_registro' };
    const sqlOrderBy = sortFieldMapSQL[sortBy] || 'c.fecha_registro';

    const [total, clientesRaw] = await Promise.all([
      prisma.clientes.count({ where }),
      prisma.$queryRawUnsafe(`
        SELECT 
          c.id,
          c.fecha_registro as "fechaRegistro",
          c.creado_por_id as "creadoPorId",
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
        ORDER BY ${sqlOrderBy} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}
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
      registrationDate: c.fechaRegistro,
      createdBy: c.creadoPorId
    }));

    success(res, data, buildMeta(total, page, perPage));
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const includeSales = req.query.includeSales === 'true';

    const cliente = await prisma.clientes.findUnique({
      where: { id },
      include: {
        persona: { include: { tipoDocumento: true } },
        ventas: includeSales ? {
          include: { detalleVentas: true, usuario: { include: { persona: true } } },
          orderBy: { creadoAt: 'desc' },
          take: 50
        } : false
      }
    });

    if (!cliente) return error(res, 'Cliente no encontrado', 404);

    const data = {
      id: cliente.id,
      firstName: cliente.persona.nombres,
      lastName: cliente.persona.apellidos,
      name: `${cliente.persona.nombres} ${cliente.persona.apellidos}`,
      docType: cliente.persona.tipoDocumento?.abreviatura || null,
      docNumber: cliente.persona.documento,
      phone: cliente.persona.telefono,
      email: cliente.persona.email,
      birthDate: cliente.persona.birthDate,
      status: cliente.persona.status,
      avatar: cliente.persona.avatarUrl,
      registrationDate: cliente.fechaRegistro,
      createdBy: cliente.creadoPorId,
      sales: includeSales ? cliente.ventas?.map(v => ({
        id: v.id,
        total: v.montoTotal,
        status: v.status,
        date: v.creadoAt,
        asesorName: v.usuario ? `${v.usuario.persona.nombres} ${v.usuario.persona.apellidos}` : null
      })) : undefined
    };

    success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = req.body;
    let tipoDocumentoId = null;

    if (data.docType) {
      const tipoDoc = await prisma.tiposDocumento.findUnique({
        where: { abreviatura: data.docType }
      });
      if (tipoDoc) tipoDocumentoId = tipoDoc.id;
    }

    // Check if client with this document already exists
    if (data.docNumber) {
      const existingClient = await prisma.clientes.findFirst({
        where: { persona: { documento: data.docNumber } }
      });
      if (existingClient) {
        return error(res, 'Este número de documento ya está registrado como cliente', 400);
      }
    }

    let persona;
    if (data.docNumber) {
      const existingPersona = await prisma.personas.findUnique({
        where: { documento: data.docNumber }
      });
      if (existingPersona) {
        // Reuse existing persona and update details
        persona = await prisma.personas.update({
          where: { id: existingPersona.id },
          data: {
            nombres: data.firstName || existingPersona.nombres,
            apellidos: data.lastName || existingPersona.apellidos,
            tipoDocumentoId: tipoDocumentoId || existingPersona.tipoDocumentoId,
            email: data.email || existingPersona.email,
            telefono: data.phone || existingPersona.telefono,
            avatarUrl: data.avatar || existingPersona.avatarUrl,
            birthDate: data.birthDate ? new Date(data.birthDate) : existingPersona.birthDate,
            status: 'active',
            deletedAt: null
          }
        });
      }
    }

    if (!persona) {
      persona = await prisma.personas.create({
        data: {
          nombres: data.firstName || '',
          apellidos: data.lastName || '',
          tipoDocumentoId,
          documento: data.docNumber || null,
          email: data.email,
          telefono: data.phone,
          avatarUrl: data.avatar || null,
          birthDate: data.birthDate ? new Date(data.birthDate) : null,
          status: 'active'
        }
      });
    }

    const cliente = await prisma.clientes.create({
      data: { personaId: persona.id, creadoPorId: req.user.id },
      include: { persona: true }
    });

    success(res, {
      id: cliente.id,
      firstName: persona.nombres,
      lastName: persona.apellidos,
      name: `${persona.nombres} ${persona.apellidos}`,
      docType: data.docType,
      docNumber: data.docNumber,
      phone: data.phone,
      email: data.email,
      birthDate: data.birthDate,
      avatar: persona.avatarUrl,
      status: 'active',
      registrationDate: cliente.fechaRegistro,
      createdBy: cliente.creadoPorId
    }, null, 201);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const data = req.body;

    const cliente = await prisma.clientes.findUnique({ where: { id }, include: { persona: true } });
    if (!cliente) return error(res, 'Cliente no encontrado', 404);

    const personaData = {};
    if (data.firstName) personaData.nombres = data.firstName;
    if (data.lastName) personaData.apellidos = data.lastName;
    
    if (data.docType) {
      const tipoDoc = await prisma.tiposDocumento.findUnique({
        where: { abreviatura: data.docType }
      });
      if (tipoDoc) personaData.tipoDocumentoId = tipoDoc.id;
    }

    if (data.docNumber) {
      const existingDoc = await prisma.personas.findUnique({
        where: { documento: data.docNumber }
      });
      if (existingDoc && existingDoc.id !== cliente.personaId) {
        return error(res, 'Este número de documento ya está asignado a otra persona en el sistema', 400);
      }
      personaData.documento = data.docNumber;
    }

    if (data.email) personaData.email = data.email;
    if (data.phone) personaData.telefono = data.phone;
    if (data.avatar) personaData.avatarUrl = data.avatar;
    if (data.birthDate) personaData.birthDate = new Date(data.birthDate);

    if (Object.keys(personaData).length > 0) {
      personaData.updatedAt = new Date();
      await prisma.personas.update({
        where: { id: cliente.personaId },
        data: personaData
      });
    }

    success(res, { message: 'Cliente actualizado' });
  } catch (err) {
    next(err);
  }
};

exports.toggleStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const cliente = await prisma.clientes.findUnique({ where: { id }, include: { persona: true } });
    if (!cliente) return error(res, 'Cliente no encontrado', 404);

    const newStatus = cliente.persona.status === 'active' ? 'inactive' : 'active';
    await prisma.personas.update({
      where: { id: cliente.personaId },
      data: { status: newStatus, updatedAt: new Date() }
    });

    success(res, { status: newStatus });
  } catch (err) {
    next(err);
  }
};

exports.uploadAvatar = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (!req.file) return error(res, 'Archivo requerido', 400);

    const cliente = await prisma.clientes.findUnique({ where: { id } });
    if (!cliente) return error(res, 'Cliente no encontrado', 404);

    const avatarUrl = `/uploads/${req.file.filename}`;
    await prisma.personas.update({
      where: { id: cliente.personaId },
      data: { avatarUrl }
    });

    success(res, { avatarUrl });
  } catch (err) {
    next(err);
  }
};
