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
    // En la empresa donde vive la fila de `sesiones`, no en la que se trabaja.
    //
    // Al suplantar no son la misma —la sesión es del superadministrador, así que
    // se guarda en su empresa de origen—, y el borrado corría bajo la empresa
    // visitada: la política no veía la fila y `deleteMany` borraba cero sin dar
    // error. Como la caché sí se olvidaba, la siguiente petición volvía a la
    // base, encontraba la fila intacta y revalidaba el token: cerrar sesión
    // durante una suplantación no cerraba nada.
    const data = await conEmpresa(req.empresaOrigen, () => authService.logout(token));
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
    // Las dos lecturas van en paralelo y en contextos distintos a propósito: la
    // ficha del usuario en su empresa de origen, la agencia en la que trabaja en
    // la suya. En serie costarían dos viajes al pooler en vez de uno.
    const [data, empresa] = await Promise.all([
      conEmpresa(req.empresaOrigen ?? req.user.empresaId, () => authService.me(req.user.id)),
      authService.empresaActiva(req.empresaId),
    ]);
    // La empresa donde se TRABAJA, que al suplantar no es la del usuario.
    //
    // `me` no las devolvía y `login` sí, así que tras la recarga que sigue a
    // entrar en una agencia el usuario quedaba sin `empresaId`. De ahí que el
    // botón de salir de la suplantación no hiciera nada: su manejador arranca
    // con `if (user.suplantacionId && user.empresaId)` y se iba sin pedir nada.
    data.user.empresaId = req.empresaId;
    data.user.empresaSlug = empresa?.slug ?? null;
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
