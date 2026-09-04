const { Router } = require('express');
const router = Router();
const statsController = require('../controllers/stats.controller');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { validateQuery } = require('../middleware/validate');
const { dateRangeSchema } = require('../schemas/common.schema');

router.use(auth);

router.get('/dashboard', authorize('dashboard', 'view'), validateQuery(dateRangeSchema), statsController.dashboard);
router.get('/sales-history', statsController.salesHistory);
router.get('/asesor-performance', statsController.asesorPerformance);
router.get('/top-clients', statsController.topClients);
router.get('/category-distribution', statsController.categoryDistribution);

module.exports = router;
