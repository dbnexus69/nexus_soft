const { Router } = require('express');
const { paramsNumericos } = require('../middleware/numericParams');
const router = Router();

// Un id no numérico es un 400, no el 500 que salía de `parseInt` -> NaN -> Prisma.
// El id del elemento del catálogo. `section` es texto y no se valida aquí.
paramsNumericos(router, 'id');
const configController = require('../controllers/config.controller');
const auth = require('../middleware/auth');
const paginate = require('../middleware/paginate');
const { authorize } = require('../middleware/authorize');

router.use(auth, authorize('config', 'view'));

router.get('/all', configController.getAll);
router.get('/:section', paginate, configController.getSection);
// Detalle de un elemento: el listado es ligero, el detalle se pide al elegirlo.
router.get('/:section/:id', configController.getItem);
router.post('/:section', authorize('config', 'edit'), configController.createItem);
router.put('/:section/:id', authorize('config', 'edit'), configController.updateItem);
router.delete('/:section/:id', authorize('config', 'edit'), configController.removeItem);

module.exports = router;
