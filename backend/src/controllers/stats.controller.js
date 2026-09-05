const statsService = require('../services/stats.service');
const { success } = require('../utils/apiResponse');

/**
 * Los cuatro controladores reenvían el ámbito de permisos.
 *
 * Antes solo lo hacía `dashboard`: los demás pasaban `req.query` a secas y sus
 * rutas no tenían `authorize`, así que `req.permissionScope` llegaba undefined
 * y el servicio devolvía datos globales. Un asesor con `view: 'own'` veía el
 * rendimiento de todos los asesores y los mejores clientes de la agencia.
 */
const ambito = (req) => ({ permissionScope: req.permissionScope, user: req.user });

exports.dashboard = async (req, res, next) => {
  try {
    const data = await statsService.getDashboardStats({
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      ...ambito(req),
    });
    success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.attention = async (req, res, next) => {
  try {
    const data = await statsService.getAttention(ambito(req));
    success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.asesorPerformance = async (req, res, next) => {
  try {
    const data = await statsService.getAsesorPerformance({ ...ambito(req), limit: req.query.limit });
    success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.topClients = async (req, res, next) => {
  try {
    const data = await statsService.getTopClients({ ...ambito(req), limit: req.query.limit });
    success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.categoryDistribution = async (req, res, next) => {
  try {
    const data = await statsService.getCategoryDistribution({ ...ambito(req), limit: req.query.limit });
    success(res, data);
  } catch (err) {
    next(err);
  }
};
