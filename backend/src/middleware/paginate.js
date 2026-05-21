const { parsePagination } = require('../utils/paginationHelper');

function paginate(req, res, next) {
  const pagination = parsePagination(req.query);
  req.pagination = pagination;

  req.search = req.query.search || '';
  req.sortBy = req.query.sortBy || 'creadoAt';
  req.sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

  next();
}

module.exports = paginate;
