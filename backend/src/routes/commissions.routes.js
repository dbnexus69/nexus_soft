const { Router } = require('express');
const router = Router();
const commissionsController = require('../controllers/commissions.controller');
const auth = require('../middleware/auth');
const paginate = require('../middleware/paginate');
const { validate } = require('../middleware/validate');
const { createAgentSchema, updateAgentSchema, createSettlementSchema } = require('../schemas/commissions.schema');

router.use(auth);

// Agentes
router.get('/agents', paginate, commissionsController.listAgents);
router.post('/agents', validate(createAgentSchema), commissionsController.createAgent);
router.put('/agents/:id', validate(updateAgentSchema), commissionsController.updateAgent);
router.delete('/agents/:id', commissionsController.deleteAgent);

// Liquidaciones
router.get('/settlements', paginate, commissionsController.listSettlements);
router.post('/settlements', validate(createSettlementSchema), commissionsController.createSettlement);

module.exports = router;
