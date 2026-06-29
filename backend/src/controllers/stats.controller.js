const statsService = require('../services/stats.service');
const { success } = require('../utils/apiResponse');

exports.dashboard = async (req, res, next) => {
  try {
    const data = await statsService.getDashboardStats({
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      permissionScope: req.permissionScope,
      user: req.user
    });
    success(res, data);
  } catch (err) {
    next(err);
  }
};
exports.salesHistory = async (req, res, next) => {
  try {
    success(res, { message: 'stats salesHistory placeholder' });
  } catch (err) { next(err); }
};

exports.asesorPerformance = async (req, res, next) => {
  try {
    const data = await statsService.getAsesorPerformance(req.query);
    success(res, data);
  } catch (err) { next(err); }
};

exports.topClients = async (req, res, next) => {
  try {
    const data = await statsService.getTopClients(req.query);
    success(res, data);
  } catch (err) { next(err); }
};

exports.categoryDistribution = async (req, res, next) => {
  try {
    const data = await statsService.getCategoryDistribution(req.query);
    success(res, data);
  } catch (err) { next(err); }
};
