const { Router } = require('express');
const router = Router();
const statsController = require('../controllers/stats.controller');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/dashboard', statsController.dashboard);
router.get('/sales-history', statsController.salesHistory);
router.get('/asesor-performance', statsController.asesorPerformance);
router.get('/top-clients', statsController.topClients);
router.get('/category-distribution', statsController.categoryDistribution);

module.exports = router;
