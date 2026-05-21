const { Router } = require('express');
const router = Router();
const commissionsController = require('../controllers/commissions.controller');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const paginate = require('../middleware/paginate');

router.use(auth);

// Agentes
router.get('/agents', paginate, commissionsController.listAgents);
router.post('/agents', commissionsController.createAgent);
router.put('/agents/:id', commissionsController.updateAgent);
router.delete('/agents/:id', commissionsController.deleteAgent);

// Liquidaciones
router.get('/settlements', paginate, commissionsController.listSettlements);
router.post('/settlements', commissionsController.createSettlement);

module.exports = router;
