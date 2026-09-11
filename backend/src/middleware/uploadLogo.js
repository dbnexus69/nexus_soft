const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { BadRequestError } = require('../errors/AppError');

/**
 * El logo de una agencia, con su propia carpeta y sus propias reglas.
 *
 * Va separado de `upload.js` por dos motivos que no son de organización:
 *
 * - **Vive en una carpeta pública.** Los vouchers y los documentos de check-in
 *   pasan a pedir sesión; un logo no puede, porque lo carga una etiqueta `<img>`
 *   —incluida la del voucher en PDF, que lo rasteriza con `crossOrigin`— y una
 *   etiqueta no manda cabeceras de autenticación. Un logo es la marca pública de
 *   la agencia: no hay nada que proteger.
 * - **Solo imágenes, y pequeñas.** Un logo de más de 2 MB no es un logo.
 */
const CARPETA = path.join(__dirname, '../../uploads/logos');
const EXTENSIONES = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];

const almacenamiento = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(CARPETA, { recursive: true });
    cb(null, CARPETA);
  },
  filename: (req, file, cb) => {
    // El id de la empresa en el nombre hace que el fichero se pueda rastrear
    // hasta su dueña sin consultar nada; el sufijo evita que el navegador sirva
    // el logo anterior de su caché al cambiarlo.
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `empresa-${req.params.id}-${Date.now()}${ext}`);
  },
});

const uploadLogo = multer({
  storage: almacenamiento,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (EXTENSIONES.includes(ext)) return cb(null, true);
    cb(new BadRequestError(`Un logo tiene que ser una imagen: ${EXTENSIONES.join(', ')}`), false);
  },
});

module.exports = { uploadLogo, CARPETA_LOGOS: CARPETA };
