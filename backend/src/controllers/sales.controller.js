const salesService = require('../services/sales.service');
const { success } = require('../utils/apiResponse');

exports.list = async (req, res, next) => {
  try {
    const result = await salesService.listSales({
      pagination: req.pagination,
      search: req.search,
      status: req.query.status,
      asesorId: req.query.asesorId,
      clientId: req.query.clientId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
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
    const data = await salesService.getSaleById(id);
    success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.voidSale = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const result = await salesService.voidSale(id, req.body.reason);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const result = await salesService.removeSale(id);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.registerPayment = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const result = await salesService.registerPayment(id, req.body);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.deletePayment = async (req, res, next) => {
  try {
    const saleId = parseInt(req.params.saleId);
    const paymentId = req.params.paymentId;
    const result = await salesService.deletePayment(saleId, paymentId, req.body);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.updateReviewStatus = async (req, res, next) => {
  try {
    const saleId = parseInt(req.params.id);
    const result = await salesService.updateReviewStatus(saleId, req.body.isReviewed);
    success(res, result, 'Estado de revisión actualizado');
  } catch (err) {
    next(err);
  }
};

exports.listPayments = async (req, res, next) => {
  try {
    const saleId = parseInt(req.params.id);
    const data = await salesService.listPayments(saleId);
    success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.sendVoucher = async (req, res, next) => {
  try {
    const saleId = parseInt(req.params.id);
    const result = await salesService.sendVoucher(saleId, req.body.pdfBase64);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    // const result = await salesService.createSale(req.body, req.user);
    success(res, { message: 'Sale created placeholder' });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    // const id = parseInt(req.params.id);
    // const result = await salesService.updateSale(id, req.body, req.user);
    success(res, { message: 'Sale updated placeholder' });
  } catch (err) {
    next(err);
  }
};
