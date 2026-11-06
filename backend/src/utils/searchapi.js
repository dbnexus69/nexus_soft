const { AppError } = require('../errors/AppError');

/**
 * El único sitio que habla con SearchApi (spec 039): busca vuelos reales (Google Flights) con
 * una sola clave, que paga DBNEXUS y que nunca llega al frontend. Ninguna agencia trae la suya.
 */
const BASE_URL = 'https://www.searchapi.io/api/v1/search';

/**
 * `parametros` son los que acepta el motor elegido: `departure_id`, `arrival_id`, `outbound_date`...
 * `engine`: `google_flights` (precios y horarios de un día concreto) o `google_flights_calendar`
 * (una grilla de combinaciones ida/vuelta con su precio, en una sola llamada — exige ida Y vuelta,
 * no tiene modo solo ida).
 */
async function buscarVuelos(parametros, engine = 'google_flights') {
  const url = new URL(BASE_URL);
  url.searchParams.set('engine', engine);
  url.searchParams.set('api_key', process.env.SEARCHAPI_KEY);
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== '') url.searchParams.set(clave, valor);
  }

  let respuesta;
  try {
    respuesta = await fetch(url);
  } catch (error) {
    console.error('[SEARCHAPI_FAILED]', 'red', error?.message || error);
    throw new AppError('La búsqueda de vuelos no responde. Inténtalo de nuevo en un momento.', 502, 'SEARCHAPI_UNAVAILABLE');
  }

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok || !datos || datos.error) {
    console.error('[SEARCHAPI_FAILED]', respuesta.status, datos?.error || 'sin cuerpo');
    throw new AppError('La búsqueda de vuelos no responde. Inténtalo de nuevo en un momento.', 502, 'SEARCHAPI_UNAVAILABLE');
  }
  return datos;
}

module.exports = { buscarVuelos };
