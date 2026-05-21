const { Router } = require('express');
const router = Router();
const rolesController = require('../controllers/roles.controller');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

router.use(auth);

router.get('/:role/permissions', rolesController.getPermissions);
router.put('/:role/permissions', authorize('config', 'edit'), rolesController.updatePermissions);

module.exports = router;
