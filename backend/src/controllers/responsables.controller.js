const responsablesService = require('../services/responsables.service');
const { success } = require('../utils/apiResponse');

// Con alcance 'own' solo los que creó quien pide (spec 026).
const alcanceDe = (req) => ({ permissionScope: req.permissionScope, viewScope: req.viewScope, user: req.user });

exports.list = async (req, res, next) => {
  try {
    const result = await responsablesService.listResponsables({
      pagination: req.pagination,
      search: req.search,
      status: req.query.status,
      sortBy: req.sortBy,
      sortOrder: req.sortOrder,
      ...alcanceDe(req),
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
    const data = await responsablesService.getResponsableById(id, includeSales, alcanceDe(req));
    success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    // Suplantando, el creador queda vacío: `req.user.id` es de la agencia de origen y la
    // clave ajena compuesta lo rechazaría (spec 002, T19).
    const { aviso, ...result } = await responsablesService.createResponsable(req.validatedBody, req.suplantacion ? null : req.user.id);
    success(res, result, aviso ? { aviso } : null, 201);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const result = await responsablesService.updateResponsable(id, req.validatedBody, alcanceDe(req));
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.setStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    success(res, await responsablesService.setStatus(id, req.validatedBody.status, alcanceDe(req)));
  } catch (err) {
    next(err);
  }
};
