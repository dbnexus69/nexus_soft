const { Router } = require('express');
const router = Router();
const auth = require('../middleware/auth');
const { soloSuperadmin } = require('../middleware/soloSuperadmin');
const { paramsNumericos } = require('../middleware/numericParams');
const { validate } = require('../middleware/validate');
const paginate = require('../middleware/paginate');
const companiesController = require('../controllers/companies.controller');
const { createCompanySchema, updateCompanySchema, suplantacionSchema } = require('../schemas/companies.schema');
const { uploadLogo } = require('../middleware/uploadLogo');

router.use(auth);
// Administrar agencias no es un permiso de módulo que una empresa pueda
// delegar: es del sistema. Por eso no pasa por `authorize`, que resuelve
// permisos DENTRO de una empresa, sino por una guarda propia.
router.use(soloSuperadmin);
paramsNumericos(router, 'id');

router.get('/', paginate, companiesController.list);
// El historial de entradas de soporte. Va antes de `/:id` para que Express no lo
// tome por un identificador.
router.get('/impersonations', paginate, companiesController.listarSuplantaciones);
router.post('/', validate(createCompanySchema), companiesController.create);
router.get('/:id', companiesController.getById);
// PATCH y no PUT: la edición es parcial de verdad, y el slug no se cambia.
router.patch('/:id', validate(updateCompanySchema), companiesController.update);
// PUT y no POST: subir el logo reemplaza el que hubiera, así que repetirlo deja
// el mismo resultado. Es la definición de idempotente.
router.put('/:id/logo', uploadLogo.single('logo'), companiesController.setLogo);

// Entrar en una agencia es crear un recurso —la entrada queda registrada—, y
// salir es borrarlo. Igual que la anulación de una venta, que también es un
// recurso y no un verbo.
router.post('/:id/impersonations', validate(suplantacionSchema), companiesController.iniciarSuplantacion);
router.delete('/:id/impersonations/:suplantacionId', companiesController.terminarSuplantacion);

module.exports = router;
