const { Router } = require('express');
const router = Router();
const auth = require('../middleware/auth');
const companiesController = require('../controllers/companies.controller');

/**
 * La marca de la empresa activa.
 *
 * Sin id en la ruta: la empresa sale del token. No lleva permiso de módulo
 * porque no hay nada que restringir — el nombre, el logo y los colores de tu
 * propia agencia los ve cualquiera que haya entrado, incluso quien no puede ver
 * ni una venta.
 */
router.get('/', auth, companiesController.branding);

module.exports = router;
