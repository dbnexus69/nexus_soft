const { Router } = require('express');
const router = Router();
const authController = require('../controllers/auth.controller');
const auth = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/logout', auth, authController.logout);
router.get('/me', auth, authController.me);

module.exports = router;
