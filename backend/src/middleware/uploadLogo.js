const multer = require('multer');
const { AppError } = require('../errors/AppError');
const { conservarContexto } = require('./conservarContexto');

// El logo va al bucket `logos` de Supabase Storage (spec 011): se guarda en memoria y lo sube
// `perfilEmpresa.service.js`. Sin SVG: el bucket no lo admite y un SVG puede llevar scripts.
const TIPOS = ['image/png', 'image/jpeg', 'image/webp'];

const uploadLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (TIPOS.includes(file.mimetype)) return cb(null, true);
    cb(new AppError('El logo tiene que ser PNG, JPG o WebP', 422, 'VALIDATION_ERROR',
      [{ field: 'logo', message: 'El logo tiene que ser PNG, JPG o WebP' }]), false);
  },
});

module.exports = {
  uploadLogo: { single: (...args) => conservarContexto(uploadLogo.single(...args)) },
};
