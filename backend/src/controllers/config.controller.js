const configService = require('../services/config.service');
const { success } = require('../utils/apiResponse');

exports.getSection = async (req, res, next) => {
  try {
    const data = await configService.getSection(req.params.section);
    success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const data = await configService.getAll();
    success(res, data);
  } catch (err) { next(err); }
};

exports.createItem = async (req, res, next) => {
  try {
    const data = await configService.createItem(req.params.section, req.body);
    success(res, data, 'Item creado exitosamente', 201);
  } catch (err) { next(err); }
};

exports.updateItem = async (req, res, next) => {
  try {
    const data = await configService.updateItem(req.params.section, req.params.id, req.body);
    success(res, data, 'Item actualizado exitosamente');
  } catch (err) { next(err); }
};

exports.removeItem = async (req, res, next) => {
  try {
    await configService.deleteItem(req.params.section, req.params.id);
    success(res, { success: true }, 'Item eliminado exitosamente');
  } catch (err) { next(err); }
};
