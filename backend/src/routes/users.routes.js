const { Router } = require('express');
const { paramsNumericos } = require('../middleware/numericParams');
const router = Router();

// Un id no numérico es un 400, no el 500 que salía de `parseInt` -> NaN -> Prisma.
// El id del usuario.
paramsNumericos(router, 'id');
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
router.put('/:id/avatar', authorize('users', 'edit'), upload.single('avatar'), usersController.uploadAvatar);

module.exports = router;
