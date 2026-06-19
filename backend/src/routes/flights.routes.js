const { Router } = require('express');
const router = Router();
const flightsController = require('../controllers/flights.controller');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const paginate = require('../middleware/paginate');

router.use(auth);

const multer = require('multer');
const upload = multer();

router.get('/', authorize('itineraries', 'view'), paginate, flightsController.list);
router.get('/:id', authorize('itineraries', 'view'), flightsController.getById);
router.put('/:id/checkin', authorize('itineraries', 'edit'), upload.array('files'), flightsController.updateCheckin);

module.exports = router;
