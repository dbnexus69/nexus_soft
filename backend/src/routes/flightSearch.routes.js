const { Router } = require('express');
const router = Router();
const auth = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { searchFlightsSchema, flightCalendarSchema } = require('../schemas/flightSearch.schema');
const controller = require('../controllers/flightSearch.controller');

/**
 * Búsqueda de vuelos en vivo (spec 039). Solo `auth`: no es un dato de negocio ni lo
 * modifica, es una consulta de solo lectura a un servicio externo. El control real
 * es el tope diario por agencia, dentro del servicio.
 */
router.use(auth);
router.post('/', validate(searchFlightsSchema), controller.search);
router.post('/calendar', validate(flightCalendarSchema), controller.calendar);

module.exports = router;
