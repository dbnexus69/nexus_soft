const companiesService = require('../services/companies.service');
const { success } = require('../utils/apiResponse');
const { COOKIE_SESION, COOKIE_ORIGINAL, opcionesCookie, tokenDe } = require('../utils/tokenUtils');

exports.list = async (req, res, next) => {
  try {
    const result = await companiesService.list({
      pagination: req.pagination,
      search: req.query.search,
      estado: req.query.estado,
    });
    success(res, result.data, result.meta);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    success(res, await companiesService.getById(req.params.id));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const empresa = await companiesService.create(req.validatedBody);
    // 201 con Location: quien la crea recibe dónde vive sin tener que componerla.
    res.set('Location', `/api/v1/companies/${empresa.id}`);
    success(res, empresa, null, 201);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    success(res, await companiesService.update(req.params.id, req.validatedBody));
  } catch (err) { next(err); }
};

exports.setLogo = async (req, res, next) => {
  try {
    success(res, await companiesService.setLogo(req.params.id, req.file));
  } catch (err) { next(err); }
};

exports.branding = async (req, res, next) => {
  try {
    success(res, await companiesService.brandingActual());
  } catch (err) { next(err); }
};

exports.iniciarSuplantacion = async (req, res, next) => {
  try {
    const { token, ...data } = await companiesService.iniciarSuplantacion(req.params.id, {
      motivo: req.validatedBody.motivo,
      // La empresa donde vive el superadministrador, no la que está visitando: estando ya dentro de una
      // agencia, `req.empresaId` es la visitada, y con ella la sesión y el token de la nueva suplantación
      // quedaban apuntando a una agencia a la que el superadministrador no pertenece (error de clave ajena).
      usuario: { id: req.user.id, empresaId: req.empresaOrigen ?? req.empresaId },
      ip: req.ip,
    });
    // El token de la suplantación sustituye a la cookie de sesión, y el del
    // superadministrador se guarda en la otra para volver al salir. Solo si no
    // hay uno guardado ya: entrar en una segunda agencia desde dentro de la
    // primera pisaría el original con el de la suplantación en curso.
    const actual = tokenDe(req);
    if (actual && !req.cookies?.[COOKIE_ORIGINAL]) res.cookie(COOKIE_ORIGINAL, actual, opcionesCookie());
    res.cookie(COOKIE_SESION, token, opcionesCookie());
    success(res, data, null, 201);
  } catch (err) { next(err); }
};

exports.terminarSuplantacion = async (req, res, next) => {
  try {
    const crypto = require('crypto');
    const token = tokenDe(req);
    const data = await companiesService.terminarSuplantacion(req.params.suplantacionId, {
      // La sesión suplantada vive en la empresa de ORIGEN, no en la que se está
      // trabajando: es la sesión del superadministrador. Buscarla en la de
      // destino no la encuentra, y el token seguiría valiendo.
      usuario: { id: req.user.id, empresaId: req.empresaOrigen },
      tokenHash: token ? crypto.createHash('sha256').update(token).digest('hex') : null,
    });
    // Vuelve la sesión del superadministrador; si no la hay, no queda ninguna.
    const original = req.cookies?.[COOKIE_ORIGINAL];
    if (original) res.cookie(COOKIE_SESION, original, opcionesCookie());
    else res.clearCookie(COOKIE_SESION, opcionesCookie());
    res.clearCookie(COOKIE_ORIGINAL, opcionesCookie());
    success(res, { ...data, restaurada: Boolean(original) });
  } catch (err) { next(err); }
};

exports.listarSuplantaciones = async (req, res, next) => {
  try {
    const r = await companiesService.listarSuplantaciones({ pagination: req.pagination });
    success(res, r.data, r.meta);
  } catch (err) { next(err); }
};
