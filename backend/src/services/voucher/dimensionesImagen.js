/**
 * Ancho y alto reales de una imagen PNG/JPEG/WebP, leídos de su cabecera (sin decodificar los
 * píxeles). Lo usa `plantilla.js` para que la imagen de encabezado/pie del voucher ocupe el ancho
 * completo de la página sin adivinar su alto a ojo: con un alto fijo, una imagen más baja que ese
 * cálculo (la mayoría) quedaba angosta en vez de a todo lo ancho (bug reportado el 2026-11-07).
 *
 * Nunca lanza: una imagen que no se pueda leer (formato raro, archivo corrupto) devuelve `null` y
 * quien llama cae a un alto por defecto — esto es solo para el tamaño del recuadro, no crítico.
 */

function png(buf) {
  if (buf.length < 24 || buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function jpeg(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marcador = buf[i + 1];
    // SOFn lleva alto/ancho; DHT (C4), JPG (C8) y DAC (CC) no son SOF aunque caigan en el rango.
    if (marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc) {
      if (i + 9 > buf.length) return null;
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    if (marcador === 0xd8 || marcador === 0xd9) { i += 2; continue; }
    const largo = buf.readUInt16BE(i + 2);
    i += 2 + largo;
  }
  return null;
}

function webp(buf) {
  if (buf.length < 30 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const fourcc = buf.toString('ascii', 12, 16);
  if (fourcc === 'VP8X') {
    return { width: (buf.readUIntLE(24, 3)) + 1, height: (buf.readUIntLE(27, 3)) + 1 };
  }
  if (fourcc === 'VP8 ') {
    // Frame tag (3) + start code (3) antes del ancho/alto, los dos de 14 bits.
    return {
      width: (buf.readUInt16LE(26)) & 0x3fff,
      height: (buf.readUInt16LE(28)) & 0x3fff,
    };
  }
  if (fourcc === 'VP8L') {
    if (buf[20] !== 0x2f) return null;
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

/** `{ width, height } | null`. */
function dimensiones(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  try {
    const d = png(buffer) || jpeg(buffer) || webp(buffer);
    return d && d.width > 0 && d.height > 0 ? d : null;
  } catch {
    return null;
  }
}

module.exports = { dimensiones };
