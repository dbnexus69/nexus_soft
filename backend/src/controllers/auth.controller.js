const authService = require('../services/auth.service');
const { success } = require('../utils/apiResponse');

exports.login = async (req, res, next) => {
  try {
    const data = await authService.login({
      email: req.body.email,
      password: req.body.password,
      remember: req.body.remember,
      userAgent: req.headers['user-agent']
    });
    success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    // await authService.logout(req.user.id);
    success(res, { message: 'Logout exitoso' });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    const data = await authService.me(req.user.id);
    success(res, data.user);
  } catch (err) {
    next(err);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    success(res, { message: 'Instrucciones enviadas' });
  } catch (err) {
    next(err);
  }
};

exports.verifyCode = async (req, res, next) => {
  try {
    success(res, { message: 'Código verificado' });
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    success(res, { message: 'Contraseña actualizada' });
  } catch (err) {
    next(err);
  }
};
