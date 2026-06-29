const flightsService = require('../services/flights.service');
const { success } = require('../utils/apiResponse');

exports.list = async (req, res, next) => {
  try {
    const result = await flightsService.listFlights({
      pagination: req.pagination,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      permissionScope: req.permissionScope,
      user: req.user
    });
    success(res, result.data, result.meta);
  } catch (err) {
    next(err);
  }
};

exports.listAirlines = async (req, res, next) => {
  try {
    const data = await flightsService.listAirlines();
    success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.listAirports = async (req, res, next) => {
  try {
    const data = await flightsService.listAirports();
    success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    // const id = parseInt(req.params.id);
    // const data = await flightsService.getFlightById(id);
    success(res, { message: 'Flight getById placeholder' });
  } catch (err) {
    next(err);
  }
};

exports.updateCheckin = async (req, res, next) => {
  try {
    // const id = parseInt(req.params.id);
    // const result = await flightsService.updateCheckin(id, req.body, req.files);
    success(res, { message: 'Flight updateCheckin placeholder' });
  } catch (err) {
    next(err);
  }
};
