const rolesService = require('../services/roles.service');
const { success } = require('../utils/apiResponse');

// El esquema de permisos, para que la pantalla no lleve su propia lista de
// módulos. Va antes de '/:role/permissions' en el router.
exports.getSchema = async (req, res, next) => {
  try {
    success(res, rolesService.getSchema());
  } catch (err) {
    next(err);
  }
};

exports.getPermissions = async (req, res, next) => {
  try {
    const data = await rolesService.getPermissions(req.params.role);
    success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.updatePermissions = async (req, res, next) => {
  try {
    const result = await rolesService.updatePermissions(req.params.role, req.body.permissions);
    success(res, result);
  } catch (err) {
    next(err);
  }
};
