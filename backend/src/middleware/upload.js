const multer = require('multer');
const { BadRequestError } = require('../errors/AppError');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

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

module.exports = upload;
