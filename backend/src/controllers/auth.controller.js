const authService = require('../services/auth.service');
const { success } = require('../utils/apiResponse');

exports.login = async (req, res, next) => {
  try {
    const { email, password, remember } = req.validatedBody;
    const data = await authService.login({
      email,
      password,
      remember,
      userAgent: req.headers['user-agent']
    });
    success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    // El token del encabezado, que es lo que identifica a ESTA sesión: cerrar
    // la del móvil no debe cerrar la del ordenador.
    const token = (req.headers.authorization || '').split(' ')[1];
    const data = await authService.logout(token);
    success(res, data);
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
    success(res, await authService.forgotPassword(req.validatedBody));
  } catch (err) {
    next(err);
  }
};

exports.verifyCode = async (req, res, next) => {
  try {
    success(res, await authService.verifyCode(req.validatedBody));
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    success(res, await authService.resetPassword(req.validatedBody));
  } catch (err) {
    next(err);
  }
};
