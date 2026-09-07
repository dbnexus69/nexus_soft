const { Router } = require('express');
const router = Router();
const authController = require('../controllers/auth.controller');
const auth = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  loginSchema, forgotPasswordSchema, verifyCodeSchema, resetPasswordSchema,
} = require('../schemas/auth.schema');

// Los cuatro endpoints públicos validan el cuerpo. No lo hacía ninguno: el
// login leía `req.body.email` a pelo y los tres de recuperación no miraban
// siquiera si venía algo. El limitador por IP de estas rutas está en
// src/index.js (`authLimiter`), donde se monta la aplicación.
router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', auth, authController.logout);
router.get('/me', auth, authController.me);
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/verify-code', validate(verifyCodeSchema), authController.verifyCode);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

module.exports = router;
