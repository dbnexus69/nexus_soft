const { Router } = require('express');
const router = Router();
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

// 15 endpoints de productos
router.post('/:saleId/products/ticket', authorize('sales', 'create'), productsController.createTicket);
router.put('/:saleId/products/ticket/:id', authorize('sales', 'edit'), productsController.updateTicket);
router.delete('/:saleId/products/ticket/:id', authorize('sales', 'delete'), productsController.deleteTicket);

router.post('/:saleId/products/hotel', authorize('sales', 'create'), productsController.createHotel);
router.put('/:saleId/products/hotel/:id', authorize('sales', 'edit'), productsController.updateHotel);
router.delete('/:saleId/products/hotel/:id', authorize('sales', 'delete'), productsController.deleteHotel);

router.post('/:saleId/products/insurance', authorize('sales', 'create'), productsController.createInsurance);
router.put('/:saleId/products/insurance/:id', authorize('sales', 'edit'), productsController.updateInsurance);
router.delete('/:saleId/products/insurance/:id', authorize('sales', 'delete'), productsController.deleteInsurance);

router.post('/:saleId/products/plan', authorize('sales', 'create'), productsController.createPlan);
router.put('/:saleId/products/plan/:id', authorize('sales', 'edit'), productsController.updatePlan);
router.delete('/:saleId/products/plan/:id', authorize('sales', 'delete'), productsController.deletePlan);

router.post('/:saleId/products/checkin', authorize('sales', 'create'), productsController.createCheckin);
router.put('/:saleId/products/checkin/:id', authorize('sales', 'edit'), productsController.updateCheckin);
router.delete('/:saleId/products/checkin/:id', authorize('sales', 'delete'), productsController.deleteCheckin);

router.post('/:saleId/products/migration', authorize('sales', 'create'), productsController.createMigration);
router.put('/:saleId/products/migration/:id', authorize('sales', 'edit'), productsController.updateMigration);
router.delete('/:saleId/products/migration/:id', authorize('sales', 'delete'), productsController.deleteMigration);

router.post('/:saleId/products/simcard', authorize('sales', 'create'), productsController.createSimcard);
router.put('/:saleId/products/simcard/:id', authorize('sales', 'edit'), productsController.updateSimcard);
router.delete('/:saleId/products/simcard/:id', authorize('sales', 'delete'), productsController.deleteSimcard);

router.post('/:saleId/products/car', authorize('sales', 'create'), productsController.createCarRental);
router.put('/:saleId/products/car/:id', authorize('sales', 'edit'), productsController.updateCarRental);
router.delete('/:saleId/products/car/:id', authorize('sales', 'delete'), productsController.deleteCarRental);

router.post('/:saleId/products/finca', authorize('sales', 'create'), productsController.createFinca);
router.put('/:saleId/products/finca/:id', authorize('sales', 'edit'), productsController.updateFinca);
router.delete('/:saleId/products/finca/:id', authorize('sales', 'delete'), productsController.deleteFinca);

router.post('/:saleId/products/tour', authorize('sales', 'create'), productsController.createTour);
router.put('/:saleId/products/tour/:id', authorize('sales', 'edit'), productsController.updateTour);
router.delete('/:saleId/products/tour/:id', authorize('sales', 'delete'), productsController.deleteTour);

router.post('/:saleId/products/convention', authorize('sales', 'create'), productsController.createConvention);
router.put('/:saleId/products/convention/:id', authorize('sales', 'edit'), productsController.updateConvention);
router.delete('/:saleId/products/convention/:id', authorize('sales', 'delete'), productsController.deleteConvention);

router.post('/:saleId/products/restaurant', authorize('sales', 'create'), productsController.createRestaurant);
router.put('/:saleId/products/restaurant/:id', authorize('sales', 'edit'), productsController.updateRestaurant);
router.delete('/:saleId/products/restaurant/:id', authorize('sales', 'delete'), productsController.deleteRestaurant);

router.post('/:saleId/products/visa', authorize('sales', 'create'), productsController.createVisa);
router.put('/:saleId/products/visa/:id', authorize('sales', 'edit'), productsController.updateVisa);
router.delete('/:saleId/products/visa/:id', authorize('sales', 'delete'), productsController.deleteVisa);

router.post('/:saleId/products/passport', authorize('sales', 'create'), productsController.createPassport);
router.put('/:saleId/products/passport/:id', authorize('sales', 'edit'), productsController.updatePassport);
router.delete('/:saleId/products/passport/:id', authorize('sales', 'delete'), productsController.deletePassport);

router.post('/:saleId/products/pet', authorize('sales', 'create'), productsController.createPetService);
router.put('/:saleId/products/pet/:id', authorize('sales', 'edit'), productsController.updatePetService);
router.delete('/:saleId/products/pet/:id', authorize('sales', 'delete'), productsController.deletePetService);

// Voucher upload
router.post('/:saleId/products/:category/:productId/voucher', authorize('sales', 'edit'), upload.single('file'), productsController.uploadVoucher);

module.exports = router;
