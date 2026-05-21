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

    const sortFieldMap = { 'creadoAt': 'fechaRegistro', 'name': 'personaId', 'date': 'fechaRegistro' };
    const effectiveSortBy = sortFieldMap[sortBy] || sortBy;

    const [total, clientes] = await Promise.all([
      prisma.clientes.count({ where }),
      prisma.clientes.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { [effectiveSortBy]: sortOrder },
        include: { persona: { include: { tipoDocumento: true } } }
      })
    ]);

    const data = clientes.map(c => ({
      id: c.id,
      firstName: c.persona.nombres,
      lastName: c.persona.apellidos,
      name: `${c.persona.nombres} ${c.persona.apellidos}`,
      docType: c.persona.tipoDocumento?.abreviatura || null,
      docNumber: c.persona.documento,
      phone: c.persona.telefono,
      email: c.persona.email,
      birthDate: c.persona.birthDate,
      status: c.persona.status,
      avatar: c.persona.avatarUrl,
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

    const persona = await prisma.personas.create({
      data: {
        nombres: data.firstName || '',
        apellidos: data.lastName || '',
        tipoDocumentoId: parseInt(data.docType) || null,
        documento: data.docNumber,
        email: data.email,
        telefono: data.phone,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        status: 'active'
      }
    });

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
      status: 'active',
      registrationDate: cliente.fechaRegistro
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
    if (data.docType) personaData.tipoDocumentoId = parseInt(data.docType);
    if (data.docNumber) personaData.documento = data.docNumber;
    if (data.email) personaData.email = data.email;
    if (data.phone) personaData.telefono = data.phone;
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
