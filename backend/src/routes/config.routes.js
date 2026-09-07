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
const { validateBySection } = require('../middleware/validate');
const { ESQUEMAS } = require('../schemas/config.schema');

router.use(auth, authorize('config', 'view'));

router.get('/all', configController.getAll);
router.get('/:section', paginate, configController.getSection);
// Detalle de un elemento: el listado es ligero, el detalle se pide al elegirlo.
router.get('/:section/:id', configController.getItem);
// Las escrituras se validan con el esquema de su catálogo. Antes no se
// validaba nada: un cuerpo vacío creaba un registro llamado "Sin nombre".
router.post('/:section', authorize('config', 'edit'), validateBySection(ESQUEMAS), configController.createItem);
// PATCH y PUT, el mismo manejador: `updateItem` escribe solo los campos que
// llegan (`updateData = { ...data }`), o sea que su semántica siempre fue la de
// PATCH. Se añade el verbo que la describe y se mantiene PUT, que es el que
// usan el frontend y cualquier cliente ya escrito.
router.put('/:section/:id', authorize('config', 'edit'), validateBySection(ESQUEMAS), configController.updateItem);
router.patch('/:section/:id', authorize('config', 'edit'), validateBySection(ESQUEMAS), configController.updateItem);
router.delete('/:section/:id', authorize('config', 'edit'), configController.removeItem);

module.exports = router;
