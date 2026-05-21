const { Router } = require('express');
const router = Router();
const clientsController = require('../controllers/clients.controller');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const paginate = require('../middleware/paginate');
const upload = require('../middleware/upload');

router.use(auth);

router.get('/', authorize('clients', 'view'), paginate, clientsController.list);
router.get('/:id', authorize('clients', 'view'), clientsController.getById);
router.post('/', authorize('clients', 'create'), clientsController.create);
router.put('/:id', authorize('clients', 'edit'), clientsController.update);
router.patch('/:id/toggle-status', authorize('clients', 'edit'), clientsController.toggleStatus);
router.put('/:id/avatar', authorize('clients', 'edit'), upload.single('avatar'), clientsController.uploadAvatar);

module.exports = router;
