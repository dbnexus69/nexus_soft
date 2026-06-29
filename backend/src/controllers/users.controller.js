const usersService = require('../services/users.service');
const { success } = require('../utils/apiResponse');

exports.list = async (req, res, next) => {
  try {
    const result = await usersService.listUsers({
      pagination: req.pagination,
      search: req.search,
      role: req.query.role,
      status: req.query.status
    });
    success(res, result.data, result.meta);
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const data = await usersService.getUserById(id);
    success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = await usersService.createUser(req.body);
    success(res, data, null, 201);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const data = await usersService.updateUser(id, req.body);
    success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const result = await usersService.removeUser(id);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.updatePermissions = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const result = await usersService.updatePermissions(id, req.body.permissions);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.uploadAvatar = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const result = await usersService.uploadAvatar(id, req.file);
    success(res, result);
  } catch (err) {
    next(err);
  }
};
