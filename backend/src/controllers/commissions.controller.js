const commissionsService = require('../services/commissions.service');
const { success } = require('../utils/apiResponse');

exports.listAgents = async (req, res, next) => {
  try {
    const result = await commissionsService.listAgents({
      pagination: req.pagination,
      search: req.query.search,
      status: req.query.status
    });
    success(res, result.data, result.meta);
  } catch (err) {
    next(err);
  }
};

exports.createAgent = async (req, res, next) => {
  try {
    const data = await commissionsService.createAgent(req.body);
    success(res, data, null, 201);
  } catch (err) {
    next(err);
  }
};

exports.updateAgent = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const result = await commissionsService.updateAgent(id, req.body);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.deleteAgent = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const result = await commissionsService.deleteAgent(id);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.listSettlements = async (req, res, next) => {
  try {
    const result = await commissionsService.listSettlements({
      pagination: req.pagination,
      agentId: req.query.agentId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
    });
    success(res, result.data, result.meta);
  } catch (err) {
    next(err);
  }
};

exports.createSettlement = async (req, res, next) => {
  try {
    const result = await commissionsService.createSettlement(req.body);
    success(res, result, null, 201);
  } catch (err) {
    next(err);
  }
};
