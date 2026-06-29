const { Router } = require('express');
const router = Router();
const usersController = require('../controllers/users.controller');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const paginate = require('../middleware/paginate');
const upload = require('../middleware/upload');
const { validate } = require('../middleware/validate');
const { createUserSchema, updateUserSchema } = require('../schemas/users.schema');

router.use(auth);

router.get('/', authorize('users', 'view'), paginate, usersController.list);
router.get('/:id', authorize('users', 'view'), usersController.getById);
router.post('/', authorize('users', 'create'), validate(createUserSchema), usersController.create);
router.put('/:id', authorize('users', 'edit'), validate(updateUserSchema), usersController.update);
router.delete('/:id', authorize('users', 'delete'), usersController.remove);
router.put('/:id/permissions', authorize('users', 'edit'), usersController.updatePermissions);
router.put('/:id/avatar', authorize('users', 'edit'), upload.single('avatar'), usersController.uploadAvatar);

module.exports = router;
