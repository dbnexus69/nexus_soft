const clientsService = require('../services/clients.service');
const { success } = require('../utils/apiResponse');

exports.list = async (req, res, next) => {
  try {
    const result = await clientsService.listClients({
      pagination: req.pagination,
      search: req.search,
      status: req.query.status,
      permissionScope: req.permissionScope,
      user: req.user,
      sortBy: req.sortBy,
      sortOrder: req.sortOrder
    });
    success(res, result.data, result.meta);
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const includeSales = req.query.includeSales === 'true';
    const data = await clientsService.getClientById(id, includeSales);
    success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    // El id de quien actúa solo es válido como "creado por" si pertenece a
    // ESTA agencia. Suplantando, la fila del superadministrador vive en la
    // suya, no en la visitada: `creado_por_id` es la clave ajena compuesta
    // (id, empresa_id), y escribir su id ahí fallaba con un 400 de clave
    // ajena. Sin él, el cliente queda sin "creado por" de esta agencia, que
    // es lo correcto — nadie de su equipo lo creó; quién lo hizo de verdad
    // consta en `suplantaciones`.
    const data = await clientsService.createClient(req.validatedBody, req.suplantacion ? null : req.user.id);
    success(res, data, null, 201);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const result = await clientsService.updateClient(id, req.validatedBody);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.toggleStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const result = await clientsService.toggleClientStatus(id);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.uploadAvatar = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const result = await clientsService.uploadAvatar(id, req.file);
    success(res, result);
  } catch (err) {
    next(err);
  }
};
