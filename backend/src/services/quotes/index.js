const crypto = require('crypto');
const almacenamiento = require('../../utils/almacenamiento');
const { PLANTILLA_VERSION, generar } = require('./plantilla');
const { empresaYConfig } = require('../voucher');
const quotesService = require('../quotes.service');

/**
 * Generar y guardar el PDF de una cotización (spec 007). Mismo mecanismo que el voucher de una
 * venta: caché por huella de contenido en Supabase Storage, URL firmada de 5 minutos.
 */
const DESCARGA_SEGUNDOS = 300;

async function generarCon(cotizacion, { config, logo }) {
  const buffer = logo ? await almacenamiento.leer('logos', logo) : null;
  return generar(cotizacion, config, { logo: buffer });
}

/** El PDF guardado de la cotización (generándolo si hace falta): `{ nombre, huella, cotizacion, buffer? }`. */
async function obtenerPdf(quoteId, alcance) {
  const cotizacion = await quotesService.getQuoteById(quoteId, alcance);
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
