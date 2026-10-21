const quotesService = require('../services/quotes.service');
const quotesPdf = require('../services/quotes');
const { success, noContent } = require('../utils/apiResponse');
const { BadRequestError } = require('../errors/AppError');

const alcanceDe = (req) => ({
  permissionScope: req.permissionScope,
  viewScope: req.viewScope,
  user: req.user,
  suplantando: !!req.suplantacion,
});

exports.list = async (req, res, next) => {
  try {
    const result = await quotesService.listQuotes({
      pagination: req.pagination,
      search: req.search,
      status: req.query.status,
      alcance: alcanceDe(req),
    });
    success(res, result.data, result.meta);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = await quotesService.createQuote(req.validatedBody, alcanceDe(req));
    success(res, data, null, 201);
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    success(res, await quotesService.getQuoteById(parseInt(req.params.id), alcanceDe(req)));
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    success(res, await quotesService.updateQuote(parseInt(req.params.id), req.validatedBody, alcanceDe(req)));
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await quotesService.deleteQuote(parseInt(req.params.id), alcanceDe(req));
    noContent(res);
  } catch (err) {
    next(err);
  }
};

exports.duplicate = async (req, res, next) => {
  try {
    success(res, await quotesService.duplicateQuote(parseInt(req.params.id), alcanceDe(req)), null, 201);
  } catch (err) {
    next(err);
  }
};

exports.send = async (req, res, next) => {
  try {
    success(res, await quotesService.sendQuote(parseInt(req.params.id), alcanceDe(req)));
  } catch (err) {
    next(err);
  }
};

exports.respond = async (req, res, next) => {
  try {
    success(res, await quotesService.respondQuote(parseInt(req.params.id), req.validatedBody, alcanceDe(req)));
  } catch (err) {
    next(err);
  }
};

exports.convertToSale = async (req, res, next) => {
  try {
    success(res, await quotesService.convertToSale(parseInt(req.params.id), alcanceDe(req)));
  } catch (err) {
    next(err);
  }
};

exports.linkSale = async (req, res, next) => {
  try {
    success(res, await quotesService.linkSale(parseInt(req.params.id), req.validatedBody, alcanceDe(req)));
  } catch (err) {
    next(err);
  }
};

exports.pdfUrl = async (req, res, next) => {
  try {
    success(res, await quotesPdf.urlDeDescarga(parseInt(req.params.id), alcanceDe(req)));
  } catch (err) {
    next(err);
  }
};

exports.addLineImage = async (req, res, next) => {
  try {
    if (!req.file) throw new BadRequestError('Falta la imagen (campo "image")');
    const data = await quotesService.addLineImage(parseInt(req.params.id), req.params.lineId, req.file, alcanceDe(req));
    success(res, data, null, 201);
  } catch (err) {
    next(err);
  }
};

exports.removeLineImage = async (req, res, next) => {
  try {
    const data = await quotesService.removeLineImage(parseInt(req.params.id), req.params.lineId, req.params.indice, alcanceDe(req));
    success(res, data);
  } catch (err) {
    next(err);
  }
};
