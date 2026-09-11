const { Router } = require('express');
const router = Router();
const auth = require('../middleware/auth');
const { soloSuperadmin } = require('../middleware/soloSuperadmin');
const { paramsNumericos } = require('../middleware/numericParams');
const { validate } = require('../middleware/validate');
const paginate = require('../middleware/paginate');
const companiesController = require('../controllers/companies.controller');
const { createCompanySchema, updateCompanySchema } = require('../schemas/companies.schema');
const { uploadLogo } = require('../middleware/uploadLogo');

router.use(auth);
// Administrar agencias no es un permiso de módulo que una empresa pueda
// delegar: es del sistema. Por eso no pasa por `authorize`, que resuelve
// permisos DENTRO de una empresa, sino por una guarda propia.
router.use(soloSuperadmin);
paramsNumericos(router, 'id');

router.get('/', paginate, companiesController.list);
router.post('/', validate(createCompanySchema), companiesController.create);
router.get('/:id', companiesController.getById);
// PATCH y no PUT: la edición es parcial de verdad, y el slug no se cambia.
router.patch('/:id', validate(updateCompanySchema), companiesController.update);
// PUT y no POST: subir el logo reemplaza el que hubiera, así que repetirlo deja
// el mismo resultado. Es la definición de idempotente.
router.put('/:id/logo', uploadLogo.single('logo'), companiesController.setLogo);

module.exports = router;
