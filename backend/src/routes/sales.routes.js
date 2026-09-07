const { Router } = require('express');
const { paramsNumericos, paramsUuid } = require('../middleware/numericParams');
const router = Router();

// Un id no numérico es un 400, no el 500 que salía de `parseInt` -> NaN -> Prisma.
// `paymentId` y `productId` quedan fuera a propósito: son uuid.
paramsNumericos(router, 'id', 'saleId', 'clientId');
// Los productos y los pagos tienen id uuid. Con nombres distintos de `id`, que
// es lo que hace que las dos comprobaciones puedan convivir en un router.
paramsUuid(router, 'productId', 'paymentId');
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
// Simétricos con los POST/PUT/DELETE de producto de más abajo.
router.get('/:id/products', authorize('sales', 'view'), salesController.getProducts);
router.get('/:id/products/:category', authorize('sales', 'view'), salesController.getProductsByCategory);
router.post('/:id/send-voucher', authorize('sales', 'view'), salesController.sendVoucher);

// 15 endpoints de productos.
//
// El id del producto es `:productId`, no `:id`, y no es cosmético: los
// productos tienen id uuid y `paramsNumericos` de arriba se aplica a TODO el
// router, así que con `:id` el uuid se rechazaba con un 400 y ni el PUT ni el
// DELETE de ninguna categoría funcionaban. Igual que en la ruta del voucher.
router.post('/:saleId/products/ticket', authorize('sales', 'create'), productsController.createTicket);
router.put('/:saleId/products/ticket/:productId', authorize('sales', 'edit'), productsController.updateTicket);
router.delete('/:saleId/products/ticket/:productId', authorize('sales', 'delete'), productsController.deleteTicket);

router.post('/:saleId/products/hotel', authorize('sales', 'create'), productsController.createHotel);
router.put('/:saleId/products/hotel/:productId', authorize('sales', 'edit'), productsController.updateHotel);
router.delete('/:saleId/products/hotel/:productId', authorize('sales', 'delete'), productsController.deleteHotel);

router.post('/:saleId/products/insurance', authorize('sales', 'create'), productsController.createInsurance);
router.put('/:saleId/products/insurance/:productId', authorize('sales', 'edit'), productsController.updateInsurance);
router.delete('/:saleId/products/insurance/:productId', authorize('sales', 'delete'), productsController.deleteInsurance);

router.post('/:saleId/products/plan', authorize('sales', 'create'), productsController.createPlan);
router.put('/:saleId/products/plan/:productId', authorize('sales', 'edit'), productsController.updatePlan);
router.delete('/:saleId/products/plan/:productId', authorize('sales', 'delete'), productsController.deletePlan);

router.post('/:saleId/products/checkin', authorize('sales', 'create'), productsController.createCheckin);
router.put('/:saleId/products/checkin/:productId', authorize('sales', 'edit'), productsController.updateCheckin);
router.delete('/:saleId/products/checkin/:productId', authorize('sales', 'delete'), productsController.deleteCheckin);

router.post('/:saleId/products/migration', authorize('sales', 'create'), productsController.createMigration);
router.put('/:saleId/products/migration/:productId', authorize('sales', 'edit'), productsController.updateMigration);
router.delete('/:saleId/products/migration/:productId', authorize('sales', 'delete'), productsController.deleteMigration);

router.post('/:saleId/products/simcard', authorize('sales', 'create'), productsController.createSimcard);
router.put('/:saleId/products/simcard/:productId', authorize('sales', 'edit'), productsController.updateSimcard);
router.delete('/:saleId/products/simcard/:productId', authorize('sales', 'delete'), productsController.deleteSimcard);

router.post('/:saleId/products/car', authorize('sales', 'create'), productsController.createCarRental);
router.put('/:saleId/products/car/:productId', authorize('sales', 'edit'), productsController.updateCarRental);
router.delete('/:saleId/products/car/:productId', authorize('sales', 'delete'), productsController.deleteCarRental);

router.post('/:saleId/products/finca', authorize('sales', 'create'), productsController.createFinca);
router.put('/:saleId/products/finca/:productId', authorize('sales', 'edit'), productsController.updateFinca);
router.delete('/:saleId/products/finca/:productId', authorize('sales', 'delete'), productsController.deleteFinca);

router.post('/:saleId/products/tour', authorize('sales', 'create'), productsController.createTour);
router.put('/:saleId/products/tour/:productId', authorize('sales', 'edit'), productsController.updateTour);
router.delete('/:saleId/products/tour/:productId', authorize('sales', 'delete'), productsController.deleteTour);

router.post('/:saleId/products/convention', authorize('sales', 'create'), productsController.createConvention);
router.put('/:saleId/products/convention/:productId', authorize('sales', 'edit'), productsController.updateConvention);
router.delete('/:saleId/products/convention/:productId', authorize('sales', 'delete'), productsController.deleteConvention);

router.post('/:saleId/products/restaurant', authorize('sales', 'create'), productsController.createRestaurant);
router.put('/:saleId/products/restaurant/:productId', authorize('sales', 'edit'), productsController.updateRestaurant);
router.delete('/:saleId/products/restaurant/:productId', authorize('sales', 'delete'), productsController.deleteRestaurant);

router.post('/:saleId/products/visa', authorize('sales', 'create'), productsController.createVisa);
router.put('/:saleId/products/visa/:productId', authorize('sales', 'edit'), productsController.updateVisa);
router.delete('/:saleId/products/visa/:productId', authorize('sales', 'delete'), productsController.deleteVisa);

router.post('/:saleId/products/passport', authorize('sales', 'create'), productsController.createPassport);
router.put('/:saleId/products/passport/:productId', authorize('sales', 'edit'), productsController.updatePassport);
router.delete('/:saleId/products/passport/:productId', authorize('sales', 'delete'), productsController.deletePassport);

router.post('/:saleId/products/pet', authorize('sales', 'create'), productsController.createPetService);
router.put('/:saleId/products/pet/:productId', authorize('sales', 'edit'), productsController.updatePetService);
router.delete('/:saleId/products/pet/:productId', authorize('sales', 'delete'), productsController.deletePetService);

// PATCH de producto, uno para las quince categorías. Mismo manejador que el
// PUT de arriba: escribe solo los campos que llegan, que es lo que significa
// PATCH. Va DESPUÉS de los PUT literales y no interfiere: es otro verbo.
router.patch('/:saleId/products/:categoria/:productId', authorize('sales', 'edit'), productsController.patchProducto);

// Voucher upload
router.post('/:saleId/products/:category/:productId/voucher', authorize('sales', 'edit'), upload.single('file'), productsController.uploadVoucher);

module.exports = router;
