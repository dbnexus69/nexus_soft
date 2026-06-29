const { Router } = require('express');
const router = Router();
const clientsController = require('../controllers/clients.controller');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const paginate = require('../middleware/paginate');
const upload = require('../middleware/upload');
const { validate } = require('../middleware/validate');
const { createClientSchema, updateClientSchema } = require('../schemas/clients.schema');

router.use(auth);

router.get('/', authorize('clients', 'view'), paginate, clientsController.list);
router.get('/:id', authorize('clients', 'view'), clientsController.getById);
router.post('/', authorize('clients', 'create'), validate(createClientSchema), clientsController.create);
router.put('/:id', authorize('clients', 'edit'), validate(updateClientSchema), clientsController.update);
router.patch('/:id/toggle-status', authorize('clients', 'edit'), clientsController.toggleStatus);
router.put('/:id/avatar', authorize('clients', 'edit'), upload.single('avatar'), clientsController.uploadAvatar);

module.exports = router;
