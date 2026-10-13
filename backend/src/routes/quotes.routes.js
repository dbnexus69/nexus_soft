const { Router } = require('express');
const router = Router();

// El id del controlador. Las sub-rutas (`/duplicate`, `/send`...) comparten el mismo
// nombre de parámetro, así que una sola declaración basta para todas.
const { paramsNumericos } = require('../middleware/numericParams');
paramsNumericos(router, 'id');

const controller = require('../controllers/quotes.controller');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const paginate = require('../middleware/paginate');
const { validate, validateQuery } = require('../middleware/validate');
const {
  createQuoteSchema, updateQuoteSchema, respondSchema, linkSaleSchema, listQuotesQuerySchema,
} = require('../schemas/quotes.schema');

router.use(auth);

router.get('/', authorize('quotes', 'view'), validateQuery(listQuotesQuerySchema), paginate, controller.list);
router.post('/', authorize('quotes', 'create'), validate(createQuoteSchema), controller.create);
router.get('/:id', authorize('quotes', 'view'), controller.getById);
router.put('/:id', authorize('quotes', 'edit'), validate(updateQuoteSchema), controller.update);
router.delete('/:id', authorize('quotes', 'delete'), controller.remove);

// Duplicar crea una cotización, por eso pide el mismo permiso que crear.
router.post('/:id/duplicate', authorize('quotes', 'create'), controller.duplicate);
router.post('/:id/send', authorize('quotes', 'edit'), controller.send);
router.post('/:id/respond', authorize('quotes', 'edit'), validate(respondSchema), controller.respond);
router.post('/:id/convert-to-sale', authorize('quotes', 'edit'), controller.convertToSale);
router.patch('/:id/link-sale', authorize('quotes', 'edit'), validate(linkSaleSchema), controller.linkSale);
router.get('/:id/pdf', authorize('quotes', 'view'), controller.pdfUrl);

module.exports = router;
