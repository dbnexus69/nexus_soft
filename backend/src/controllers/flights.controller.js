const flightsService = require('../services/flights.service');
const { success } = require('../utils/apiResponse');

exports.list = async (req, res, next) => {
  try {
    const result = await flightsService.listFlights({
      pagination: req.pagination,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      checkinStatus: req.query.checkinStatus,
      search: req.search,
      permissionScope: req.permissionScope,
      user: req.user
    });
    success(res, result.data, result.meta);
  } catch (err) {
    next(err);
  }
};

exports.listCheckins = async (req, res, next) => {
  try {
    const result = await flightsService.listCheckins({
      pagination: req.pagination,
      status: req.query.status,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      search: req.search,
      // Sin reenviar el ámbito, un asesor con view:'own' vería los check-ins
      // de todas las ventas, no solo de las suyas.
      permissionScope: req.permissionScope,
      user: req.user
    });
    success(res, result.data, result.meta);
  } catch (err) {
    next(err);
  }
};

exports.cancelCheckin = async (req, res, next) => {
  try {
    // req.validatedBody lo deja el middleware `validate`: ya viene con el
    // motivo recortado y comprobado (5-255 caracteres).
    const result = await flightsService.cancelCheckin(
      req.params.id,
      req.validatedBody,
      { permissionScope: req.permissionScope, user: req.user }
    );
    success(res, result);
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
    const result = await flightsService.updateCheckin(
      req.params.id,
      req.body,
      req.files,
      { permissionScope: req.permissionScope, user: req.user }
    );
    success(res, result);
  } catch (err) {
    next(err);
  }
};
