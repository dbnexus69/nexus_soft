const responsablesService = require('../services/responsables.service');
const { success } = require('../utils/apiResponse');

exports.list = async (req, res, next) => {
  try {
    const result = await responsablesService.listResponsables({
      pagination: req.pagination,
      search: req.search,
      status: req.query.status,
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
    const data = await responsablesService.getResponsableById(id, includeSales);
    success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const result = await responsablesService.createResponsable(req.body);
    success(res, result, null, 201);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const result = await responsablesService.updateResponsable(id, req.body);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const result = await responsablesService.deleteResponsable(id);
    success(res, result);
  } catch (err) {
    next(err);
  }
};
