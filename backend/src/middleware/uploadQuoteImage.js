const multer = require('multer');
const { AppError } = require('../errors/AppError');
const { conservarContexto } = require('./conservarContexto');

// La foto de un servicio cotizado va al bucket `cotizacion-imagenes` de Supabase Storage
// (spec 021): se guarda en memoria y la sube `quotes.service.js`. Mismo patrón que
// `uploadLogo.js` (spec 011) — sin SVG, el bucket no lo admite y un SVG puede llevar scripts.
const TIPOS = ['image/png', 'image/jpeg', 'image/webp'];

const uploadQuoteImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (TIPOS.includes(file.mimetype)) return cb(null, true);
    cb(new AppError('La imagen tiene que ser PNG, JPG o WebP', 422, 'VALIDATION_ERROR',
      [{ field: 'image', message: 'La imagen tiene que ser PNG, JPG o WebP' }]), false);
  },
});

module.exports = {
  uploadQuoteImage: { single: (...args) => conservarContexto(uploadQuoteImage.single(...args)) },
};
