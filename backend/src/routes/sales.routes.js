const { Router } = require('express');
const { paramsNumericos, paramsUuid } = require('../middleware/numericParams');
const router = Router();

// Un id no numérico es un 400, no el 500 que salía de `parseInt` -> NaN -> Prisma.
// `paymentId` y `detalleId` quedan fuera a propósito: son uuid.
paramsNumericos(router, 'id', 'saleId', 'clientId');
// Los productos y los pagos tienen id uuid. Con nombres distintos de `id`, que
// es lo que hace que las dos comprobaciones puedan convivir en un router.
paramsUuid(router, 'detalleId', 'paymentId');
const salesController = require('../controllers/sales.controller');
const productsController = require('../controllers/products.controller');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const paginate = require('../middleware/paginate');
const upload = require('../middleware/upload');
const { validate, validateQuery } = require('../middleware/validate');
const { dateRangeSchema } = require('../schemas/common.schema');
const {
  createSaleSchema, updateSaleSchema, registerPaymentSchema,
  voidSaleSchema, reviewStatusSchema
} = require('../schemas/sales.schema');

router.use(auth);

router.get('/', authorize('sales', 'view'), validateQuery(dateRangeSchema), paginate, salesController.list);
// Va antes de /:id para que 'credit' no se interprete como un id de venta.
router.get('/credit', authorize('sales', 'view'), paginate, salesController.creditPortfolio);
// Colección e ítem del mismo recurso. Va antes de '/:id': Express resuelve en
// orden de declaración y '/:id' capturaría 'credit' como si fuera un id.
router.get('/credit/:clientId', authorize('sales', 'view'), paginate, salesController.creditByClient);
router.get('/:id', authorize('sales', 'view'), salesController.getById);
router.post('/', authorize('sales', 'create'), validate(createSaleSchema), salesController.create);
router.put('/:id', authorize('sales', 'edit'), validate(updateSaleSchema), salesController.update);
router.patch('/:id/review-status', authorize('sales', 'edit'), validate(reviewStatusSchema), salesController.updateReviewStatus);
// La anulación es un sub-recurso, no un verbo en la URL.
router.post('/:id/cancellation', authorize('sales', 'delete'), validate(voidSaleSchema), salesController.voidSale);
router.delete('/:id', authorize('sales', 'delete'), salesController.remove);
router.post('/:id/payments', authorize('sales', 'edit'), validate(registerPaymentSchema), salesController.registerPayment);
router.delete('/:saleId/payments/:paymentId', authorize('sales', 'edit'), salesController.deletePayment);
router.get('/:id/payments', authorize('sales', 'view'), salesController.listPayments);

// Lectura de productos: la colección completa (la usa el voucher) y una categoría suelta.
router.get('/:id/products', authorize('sales', 'view'), salesController.getProducts);
router.get('/:id/products/:category', authorize('sales', 'view'), salesController.getProductsByCategory);
router.post('/:id/send-voucher', authorize('sales', 'view'), salesController.sendVoucher);

// Los productos se crean con la venta (POST /sales) y no se editan ni se borran
// sueltos: los POST, PUT, PATCH y DELETE de producto no los usaba ninguna
// pantalla y se retiraron (T8, spec 002).
//
// El voucher de un producto es un archivo y no viaja en el JSON de la venta: el
// navegador lo sube tras el 201, a la línea (`detalleId`) que devuelve POST
// /sales. Pide `create`, no `edit`: completa el alta, y hay agencias donde el
// freelancer puede crear ventas pero no editarlas.
router.put('/:saleId/products/:detalleId/voucher', authorize('sales', 'create'), upload.single('file'), productsController.uploadVoucher);

module.exports = router;
