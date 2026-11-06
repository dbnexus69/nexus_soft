const flightSearchService = require('../services/flightSearch.service');
const { success } = require('../utils/apiResponse');

exports.search = async (req, res, next) => {
  try {
    const resultados = await flightSearchService.buscarVuelos(req.validatedBody);
    success(res, resultados);
  } catch (err) {
    next(err);
  }
};

exports.calendar = async (req, res, next) => {
  try {
    const resultados = await flightSearchService.buscarCalendario(req.validatedBody);
    success(res, resultados);
  } catch (err) {
    next(err);
  }
};
