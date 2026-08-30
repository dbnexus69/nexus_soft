function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  // 10 por página es el tamaño estándar de las tablas de la aplicación.
  // El tope de 100 protege de un ?perPage=99999.
  const perPage = Math.min(100, Math.max(1, parseInt(query.perPage, 10) || 10));
  const skip = (page - 1) * perPage;

  return { page, perPage, skip };
}

function buildMeta(total, page, perPage) {
  const totalPages = Math.ceil(total / perPage);
  return {
    page,
    perPage,
    total,
    totalPages,
    // El cliente no tiene que recalcular si hay más páginas en cada tabla.
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

module.exports = { parsePagination, buildMeta };
