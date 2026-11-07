const { Router } = require('express');
const router = Router();
const auth = require('../middleware/auth');
const { soloAdminDeLaEmpresa } = require('../middleware/soloAdminDeLaEmpresa');
const { validate } = require('../middleware/validate');
const { uploadLogo } = require('../middleware/uploadLogo');
const { updateCompanyProfileSchema } = require('../schemas/companyProfile.schema');
const controller = require('../controllers/companyProfile.controller');

// "Mi empresa" (spec 011): siempre la agencia del token, nunca un id en la URL.
router.use(auth);
router.get('/', controller.perfil);
router.patch('/', soloAdminDeLaEmpresa, validate(updateCompanyProfileSchema), controller.actualizar);
router.put('/logo', soloAdminDeLaEmpresa, uploadLogo.single('logo'), controller.subirLogo);
// Imágenes propias de encabezado/pie del voucher (a pedido de agencias con su propio diseño): mismo
// middleware que el logo, solo cambia el campo del formulario y a qué columna va.
router.put('/voucher-encabezado', soloAdminDeLaEmpresa, uploadLogo.single('imagen'), controller.subirImagenEncabezado);
router.put('/voucher-pie-imagen', soloAdminDeLaEmpresa, uploadLogo.single('imagen'), controller.subirImagenPie);
router.post('/voucher-preview', soloAdminDeLaEmpresa, validate(updateCompanyProfileSchema), controller.vistaPrevia);

module.exports = router;
