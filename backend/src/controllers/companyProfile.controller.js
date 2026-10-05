const perfilEmpresa = require('../services/perfilEmpresa.service');
const { empresaActual } = require('../config/tenant');
const { success } = require('../utils/apiResponse');

exports.perfil = async (req, res, next) => {
  try {
    success(res, await perfilEmpresa.perfil());
  } catch (err) { next(err); }
};

exports.actualizar = async (req, res, next) => {
  try {
    success(res, await perfilEmpresa.actualizar(req.validatedBody));
  } catch (err) { next(err); }
};

exports.subirLogo = async (req, res, next) => {
  try {
    await perfilEmpresa.guardarLogo(empresaActual(), req.file);
    success(res, await perfilEmpresa.perfil());
  } catch (err) { next(err); }
};

exports.vistaPrevia = async (req, res, next) => {
  try {
    const pdf = await require('../services/voucher').vistaPrevia(req.validatedBody);
    res.type('application/pdf').set('Content-Disposition', 'inline; filename="vista-previa.pdf"').send(pdf);
  } catch (err) { next(err); }
};
