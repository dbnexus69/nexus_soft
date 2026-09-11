const companiesService = require('../services/companies.service');
const { success } = require('../utils/apiResponse');

exports.list = async (req, res, next) => {
  try {
    const result = await companiesService.list({
      pagination: req.pagination,
      search: req.query.search,
      estado: req.query.estado,
    });
    success(res, result.data, result.meta);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    success(res, await companiesService.getById(req.params.id));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const empresa = await companiesService.create(req.validatedBody);
    // 201 con Location: quien la crea recibe dónde vive sin tener que componerla.
    res.set('Location', `/api/v1/companies/${empresa.id}`);
    success(res, empresa, null, 201);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    success(res, await companiesService.update(req.params.id, req.validatedBody));
  } catch (err) { next(err); }
};

exports.setLogo = async (req, res, next) => {
  try {
    success(res, await companiesService.setLogo(req.params.id, req.file));
  } catch (err) { next(err); }
};

exports.branding = async (req, res, next) => {
  try {
    success(res, await companiesService.brandingActual());
  } catch (err) { next(err); }
};
