function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(query.perPage, 10) || 20));
  const skip = (page - 1) * perPage;

  return { page, perPage, skip };
}

function buildMeta(total, page, perPage) {
  return {
    page,
    perPage,
    total,
    totalPages: Math.ceil(total / perPage),
  };
}

module.exports = { parsePagination, buildMeta };
