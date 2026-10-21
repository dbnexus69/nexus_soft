const crypto = require('crypto');
const almacenamiento = require('../../utils/almacenamiento');
const { PLANTILLA_VERSION, generar } = require('./plantilla');
const { empresaYConfig, ciudades } = require('../voucher');
const quotesService = require('../quotes.service');

/**
 * Generar y guardar el PDF de una cotización (spec 007). Mismo mecanismo que el voucher de una
 * venta: caché por huella de contenido en Supabase Storage, URL firmada de 5 minutos.
 */
const DESCARGA_SEGUNDOS = 300;

/**
 * Las fotos de cada línea (spec 021), descargadas del bucket como Buffer y por ruta: pdfmake
 * necesita los bytes, no una URL. `cotizacion.lines[].detalle.images` son rutas crudas aquí
 * porque `obtenerPdf` pide la cotización con `resolverImagenes: false`.
 */
async function imagenesDeLineas(lines) {
  const rutas = lines.flatMap(l => Array.isArray(l.detalle?.images) ? l.detalle.images : []);
  if (!rutas.length) return {};
  const pares = await Promise.all(rutas.map(async (r) => [r, await almacenamiento.leer('cotizacion-imagenes', r)]));
  return Object.fromEntries(pares.filter(([, buffer]) => buffer));
}

async function generarCon(cotizacion, { config, logo }) {
  const tiquetes = cotizacion.lines.filter(l => l.categoria === 'ticket' && l.detalle).map(l => l.detalle);
  const [buffer, aeropuertos, imagenes] = await Promise.all([
    logo ? almacenamiento.leer('logos', logo) : null,
    ciudades(tiquetes),
    imagenesDeLineas(cotizacion.lines),
  ]);
  return generar(cotizacion, config, { logo: buffer, aeropuertos, imagenes });
}

/** El PDF guardado de la cotización (generándolo si hace falta): `{ nombre, huella, cotizacion, buffer? }`. */
async function obtenerPdf(quoteId, alcance) {
  // Rutas crudas de las imágenes, no URLs firmadas: el PDF las descarga directo con el service
  // role, no tiene sentido pasar por una URL que de todos modos habría que volver a bajar.
  const cotizacion = await quotesService.getQuoteById(quoteId, alcance, { resolverImagenes: false });
  const agencia = await empresaYConfig();
  const huella = crypto.createHash('sha256')
    .update(JSON.stringify({ v: PLANTILLA_VERSION, cotizacion, ...agencia }))
    .digest('hex');
  const nombre = `${cotizacion.id}/${huella}.pdf`;

  if (await almacenamiento.existe('quotes', nombre)) return { nombre, huella, cotizacion };
  const buffer = await generarCon(cotizacion, agencia);
  await almacenamiento.subir('quotes', nombre, buffer, 'application/pdf');
  return { nombre, huella, cotizacion, buffer };
}

async function urlDeDescarga(quoteId, alcance) {
  const { nombre, cotizacion } = await obtenerPdf(quoteId, alcance);
  const url = await almacenamiento.firmar('quotes', nombre, DESCARGA_SEGUNDOS, {
    descarga: `Cotizacion-${cotizacion.numero ?? cotizacion.id}.pdf`,
  });
  return { url, expiraEn: DESCARGA_SEGUNDOS };
}

module.exports = { obtenerPdf, urlDeDescarga };
