const fs = require('fs');
const path = require('path');

/**
 * Lee el logo de Samtur y retorna su representación base64
 * para embeber directamente en el HTML del correo.
 * Resend no soporta CID inline images, por lo que se usa data URI.
 */
function getSamturLogoBase64() {
  try {
    const logoPath = path.join(__dirname, '../assets/logo.png');
    const logoBuffer = fs.readFileSync(logoPath);
    return `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch (e) {
    console.error('[EMAIL] No se pudo cargar el logo de Samtur:', e.message);
    return null;
  }
}

module.exports = { getSamturLogoBase64 };
