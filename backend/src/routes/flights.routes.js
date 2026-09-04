const { Router } = require('express');
const router = Router();
const flightsController = require('../controllers/flights.controller');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const paginate = require('../middleware/paginate');
// El middleware compartido guarda en disco, filtra por extensión y topa en
// 5MB. El `multer()` que había aquí era en memoria, sin filtro y sin límite.
const upload = require('../middleware/upload');
const { validate, validateQuery } = require('../middleware/validate');
const { cancelCheckinSchema } = require('../schemas/flights.schema');
const { dateRangeSchema } = require('../schemas/common.schema');

router.use(auth);

// Las rutas literales van ANTES de las paramétricas: Express resuelve en orden
// de declaración, así que un `/:id` por encima capturaría `checkins` como id.
router.get('/checkins', authorize('itineraries', 'view'), validateQuery(dateRangeSchema), paginate, flightsController.listCheckins);

router.get('/', authorize('itineraries', 'view'), validateQuery(dateRangeSchema), paginate, flightsController.list);
router.get('/:id', authorize('itineraries', 'view'), flightsController.getById);
router.put('/:id/checkin', authorize('itineraries', 'edit'), upload.array('files', 5), flightsController.updateCheckin);

// La cancelación es un recurso, no un verbo, igual que POST /sales/:id/cancellation.
// Endpoint propio para que el motivo sea obligatorio por construcción en vez de
// un campo opcional validado a mano según el estado que se pida.
router.post('/:id/checkin/cancellation', authorize('itineraries', 'edit'), validate(cancelCheckinSchema), flightsController.cancelCheckin);

module.exports = router;
