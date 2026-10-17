const { Router } = require('express');
const { paramsNumericos } = require('../middleware/numericParams');
const router = Router();

// Un id no numérico es un 400, no el 500 que salía de `parseInt` -> NaN -> Prisma.
// El id del cliente.
paramsNumericos(router, 'id');
const clientsController = require('../controllers/clients.controller');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const paginate = require('../middleware/paginate');
const upload = require('../middleware/upload');
const { validate, validateQuery } = require('../middleware/validate');
const {
  createClientSchema, updateClientSchema, listClientsQuerySchema, destinationsQuerySchema,
} = require('../schemas/clients.schema');

router.use(auth);

router.get('/', authorize('clients', 'view'), validateQuery(listClientsQuerySchema), paginate, clientsController.list);
// Antes de `/:id`: "destinations" no es un id. Sugerencias de toda la agencia, sin
// alcance por asesor (spec 017): solo nombres de destino, nunca el cliente.
router.get('/destinations', authorize('clients', 'view'), validateQuery(destinationsQuerySchema), clientsController.destinations);
router.get('/:id', authorize('clients', 'view'), clientsController.getById);
router.post('/', authorize('clients', 'create'), validate(createClientSchema), clientsController.create);
router.put('/:id', authorize('clients', 'edit'), validate(updateClientSchema), clientsController.update);
router.patch('/:id/toggle-status', authorize('clients', 'edit'), clientsController.toggleStatus);
router.put('/:id/avatar', authorize('clients', 'edit'), upload.single('avatar'), clientsController.uploadAvatar);

module.exports = router;
