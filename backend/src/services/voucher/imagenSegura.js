const zlib = require('zlib');
const { dimensiones } = require('./dimensionesImagen');

/**
 * ¿Se le puede entregar esta imagen al motor del PDF sin riesgo?
 *
 * El motor (pdfkit, debajo de pdfmake) solo entiende PNG y JPG. Y un PNG con transparencia lo descomprime
 * en un callback de zlib: si los datos están dañados, el error salta ahí, ningún `try/catch` lo alcanza y
 * se lleva el proceso entero —comprobado: una sola imagen dañada tumbaba el servidor para todas las
 * agencias—. Por eso los datos del PNG se revisan aquí, de forma síncrona, ANTES de que el motor los vea.
 *
 * No se admite PNG entrelazado: comprobar sus filtros exige recorrer sus siete pasadas, y es un formato raro
 * en imágenes exportadas para un documento.
 */

// Lo que ocupa una imagen de 16 megapíxeles con transparencia. Un PNG de 2 MB puede declarar dimensiones
// que al descomprimirse pesen gigas, y el backend corre con poca memoria.
const MAX_DESCOMPRIMIDO = 64 * 1024 * 1024;
const CANALES_POR_TIPO = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

const esPng = (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
const esJpeg = (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8;

function pngSano(buf) {
  let cabecera = null;
  const datos = [];
  let i = 8;
  while (i + 12 <= buf.length) {
    const largo = buf.readUInt32BE(i);
    const tipo = buf.toString('ascii', i + 4, i + 8);
    if (i + 12 + largo > buf.length) return false;
    const cuerpo = buf.subarray(i + 8, i + 8 + largo);
    if (tipo === 'IHDR' && largo === 13) {
      cabecera = { ancho: cuerpo.readUInt32BE(0), alto: cuerpo.readUInt32BE(4), bits: cuerpo[8], tipoColor: cuerpo[9], entrelazado: cuerpo[12] };
    } else if (tipo === 'IDAT') {
      datos.push(cuerpo);
    } else if (tipo === 'IEND') {
      break;
    }
    i += 12 + largo;
  }
  if (!cabecera || !datos.length || !cabecera.ancho || !cabecera.alto || cabecera.entrelazado !== 0) return false;
  const canales = CANALES_POR_TIPO[cabecera.tipoColor];
  if (!canales) return false;

  const porFila = 1 + Math.ceil((cabecera.ancho * canales * cabecera.bits) / 8);
  const total = porFila * cabecera.alto;
  if (total > MAX_DESCOMPRIMIDO) return false;

  let crudo;
  try {
    crudo = zlib.inflateSync(Buffer.concat(datos), { maxOutputLength: MAX_DESCOMPRIMIDO });
  } catch {
    return false;
  }
  if (crudo.length !== total) return false;
  // El primer byte de cada fila dice qué filtro lleva; uno que no exista también revienta en el callback.
  for (let fila = 0; fila < cabecera.alto; fila++) {
    if (crudo[fila * porFila] > 4) return false;
  }
  return true;
}

/** `true` si los bytes son un PNG o JPG que el motor puede abrir sin reventar. Nunca lanza. */
function imagenSana(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return false;
  try {
    if (esPng(buffer)) return pngSano(buffer);
    return esJpeg(buffer) && dimensiones(buffer) !== null;
  } catch {
    return false;
  }
}

module.exports = { imagenSana };
