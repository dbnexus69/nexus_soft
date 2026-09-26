const { parsePagination } = require('../utils/paginationHelper');

function paginate(req, res, next) {
  const pagination = parsePagination(req.query);
  req.pagination = pagination;

  // `?search=a&search=b` llega como arreglo; se toma el último valor en vez de romper con un 500.
  const buscado = Array.isArray(req.query.search) ? req.query.search[req.query.search.length - 1] : req.query.search;
  req.search = typeof buscado === 'string' ? buscado : '';
  req.sortBy = req.query.sortBy || 'creadoAt';
  req.sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

  next();
}

module.exports = paginate;
