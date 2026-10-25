const multer = require('multer');
const { BadRequestError } = require('../errors/AppError');
const { conservarContexto } = require('./conservarContexto');
const path = require('path');

// En memoria: el fichero va al bucket `adjuntos` (spec 031), nunca al disco.
const storage = multer.memoryStorage();

/** El nombre con que se guarda en el bucket: no se puede adivinar y conserva la extensión. */
const nombreUnico = (file) =>
  `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname).toLowerCase()}`;

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    // Un Error pelado no lleva statusCode, así que el manejador lo trataba como
    // un fallo no previsto: 500 y, antes, con la traza dentro. Es un dato malo
    // del cliente, o sea un 400 con un mensaje que dice cómo arreglarlo.
    cb(new BadRequestError(`Tipo de archivo no permitido: ${ext || 'sin extensión'}. Se aceptan ${allowed.join(', ')}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = {
  single: (...args) => conservarContexto(upload.single(...args)),
  array: (...args) => conservarContexto(upload.array(...args)),
  nombreUnico,
};
