const { Router } = require('express');
const router = Router();

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./users.routes'));
router.use('/roles', require('./roles.routes'));
router.use('/clients', require('./clients.routes'));
router.use('/sales', require('./sales.routes'));
router.use('/flights', require('./flights.routes'));
router.use('/commissions', require('./commissions.routes'));
router.use('/config', require('./config.routes'));
router.use('/stats', require('./stats.routes'));

module.exports = router;
