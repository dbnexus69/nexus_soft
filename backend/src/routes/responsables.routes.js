const { Router } = require('express');
const router = Router();
const controller = require('../controllers/responsables.controller');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const paginate = require('../middleware/paginate');
const { validate } = require('../middleware/validate');
const { createResponsableSchema, updateResponsableSchema } = require('../schemas/responsables.schema');

router.use(auth);

// Antes había aquí un `requireAdmin` escrito a mano que comparaba
// `req.user.role === 'admin'` y devolvía `{ error: 'Acceso denegado...' }` como
// cadena, con un formato distinto al del resto de la API.
//
// Estaba cerrado, pero saltaba el sistema de permisos: no existía el módulo
// `responsables` como permiso, así que no se podía delegar a nadie ni ver en la
// interfaz —aunque el tipo `RolePermissions` del frontend ya lo declaraba—.
// Ahora va por `authorize`, con los valores por defecto en admin nada más.
router.get('/', authorize('responsables', 'view'), paginate, controller.list);
router.post('/', authorize('responsables', 'create'), validate(createResponsableSchema), controller.create);
router.get('/:id', authorize('responsables', 'view'), controller.getById);
router.put('/:id', authorize('responsables', 'edit'), validate(updateResponsableSchema), controller.update);
router.delete('/:id', authorize('responsables', 'delete'), controller.delete);

module.exports = router;
