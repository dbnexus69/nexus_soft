const formatName = (str) => {
  if (!str || typeof str !== 'string') return str || '';
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

module.exports = {
  formatName
};
