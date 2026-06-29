const rolesService = require('../services/roles.service');
const { success } = require('../utils/apiResponse');

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
