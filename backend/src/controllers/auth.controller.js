const authService = require('../services/auth.service');
const { conEmpresa } = require('../config/tenant');
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
    // En la empresa donde vive su fila, no en la que está trabajando.
    //
    // Al suplantar no son la misma, y esto buscaba al superadministrador dentro
    // de la agencia visitada: 404. Como el aviso de "estás operando en nombre
    // de" y el botón de salir se dibujan con el `suplantacionId` que devuelve
    // este endpoint, la consecuencia no era cosmética — no había forma de
    // abandonar la suplantación desde la pantalla. El middleware ya resuelve
    // esto igual; aquí faltaba.
    const data = await conEmpresa(req.empresaOrigen ?? req.user.empresaId, () => authService.me(req.user.id));
    if (req.suplantacion) {
      data.user.suplantacionId = req.suplantacion;
    }
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
