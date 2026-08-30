const configService = require('../services/config.service');
const { success, noContent } = require('../utils/apiResponse');

exports.getSection = async (req, res, next) => {
  try {
    const data = await configService.getSection(req.params.section, req.pagination, req.search);
    if (data && data.meta) {
      success(res, data.data, data.meta);
    } else {
      success(res, data);
    }
  } catch (err) {
    next(err);
  }
};

// Solo los catálogos del arranque. Se puede acotar más con ?sections=a,b
exports.getAll = async (req, res, next) => {
  try {
    const sections = req.query.sections ? String(req.query.sections).split(',').map(s => s.trim()) : null;
    const data = await configService.getAll({ sections });
    success(res, data);
  } catch (err) { next(err); }
};

// Detalle completo de un elemento, para cuando el usuario elige uno del listado.
exports.getItem = async (req, res, next) => {
  try {
    const data = await configService.getItem(req.params.section, req.params.id);
    success(res, data);
  } catch (err) { next(err); }
};

exports.createItem = async (req, res, next) => {
  try {
    const data = await configService.createItem(req.params.section, req.body);
    success(res, data, null, 201);
  } catch (err) { next(err); }
};

exports.updateItem = async (req, res, next) => {
  try {
    const data = await configService.updateItem(req.params.section, req.params.id, req.body);
    success(res, data);
  } catch (err) { next(err); }
};

exports.removeItem = async (req, res, next) => {
  try {
    await configService.deleteItem(req.params.section, req.params.id);
    noContent(res);
  } catch (err) { next(err); }
};
