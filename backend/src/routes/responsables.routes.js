const { Router } = require('express');
const router = Router();
const controller = require('../controllers/responsables.controller');
const auth = require('../middleware/auth');
const paginate = require('../middleware/paginate');
const { validate } = require('../middleware/validate');
const { createResponsableSchema, updateResponsableSchema } = require('../schemas/responsables.schema');

const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ success: false, error: 'Acceso denegado: Solo administradores' });
};

router.use(auth);
router.use(requireAdmin);

router.get('/', paginate, controller.list);
router.post('/', validate(createResponsableSchema), controller.create);
router.get('/:id', controller.getById);
router.put('/:id', validate(updateResponsableSchema), controller.update);
router.delete('/:id', controller.delete);

module.exports = router;
