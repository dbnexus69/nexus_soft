const { Router } = require('express');
const router = Router();
const commissionsController = require('../controllers/commissions.controller');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const paginate = require('../middleware/paginate');
const { validate } = require('../middleware/validate');
const { createAgentSchema, updateAgentSchema, createSettlementSchema } = require('../schemas/commissions.schema');
const { validateQuery } = require('../middleware/validate');
const { dateRangeSchema } = require('../schemas/common.schema');

router.use(auth);

// Las seis rutas iban solo con `auth`: comprobaban que el token fuese válido y
// nada más. La base decía `commissions.* = false` para asesor y aun así podía
// leer, crear, editar y BORRAR comisionistas y liquidaciones, que es dinero.
// Los 404/422 que devolvían lo delataban: llegaban al manejador.

// Agentes
router.get('/agents', authorize('commissions', 'view'), paginate, commissionsController.listAgents);
router.post('/agents', authorize('commissions', 'create'), validate(createAgentSchema), commissionsController.createAgent);
router.put('/agents/:id', authorize('commissions', 'edit'), validate(updateAgentSchema), commissionsController.updateAgent);
router.delete('/agents/:id', authorize('commissions', 'delete'), commissionsController.deleteAgent);

// Liquidaciones
router.get('/settlements', authorize('commissions', 'view'), validateQuery(dateRangeSchema), paginate, commissionsController.listSettlements);
router.post('/settlements', authorize('commissions', 'create'), validate(createSettlementSchema), commissionsController.createSettlement);

module.exports = router;
