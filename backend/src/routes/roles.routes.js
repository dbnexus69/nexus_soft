const { Router } = require('express');
const router = Router();
const rolesController = require('../controllers/roles.controller');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

router.use(auth);

// `permissions`, no `config`: la llave de editar el catálogo (aerolíneas,
// proveedores) no debe servir además para reescribir los permisos de todos los
// roles. Solo `superadmin` tiene `permissions.edit`.

router.get('/:role/permissions', authorize('permissions', 'view'), rolesController.getPermissions);
router.put('/:role/permissions', authorize('permissions', 'edit'), rolesController.updatePermissions);

module.exports = router;
