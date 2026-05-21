const { Router } = require('express');
const router = Router();
const flightsController = require('../controllers/flights.controller');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const paginate = require('../middleware/paginate');

router.use(auth);

router.get('/', authorize('itineraries', 'view'), paginate, flightsController.list);
router.get('/:id', authorize('itineraries', 'view'), flightsController.getById);
router.put('/:id/checkin', authorize('itineraries', 'edit'), flightsController.updateCheckin);

module.exports = router;
