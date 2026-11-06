const prisma = require('../config/db');
const { AppError } = require('../errors/AppError');
const { buscarVuelos: buscarEnSearchApi } = require('../utils/searchapi');

/**
 * Búsqueda de vuelos en vivo para armar una cotización (spec 039), con SearchApi (Google Flights)
 * detrás. Ida y vuelta es de DOS pasos, comprobado con llamadas reales: sin `departureToken`, cada
 * opción es una IDA con su propio `departureToken` en vez de `bookingToken` (y un precio de
 * referencia, no el final); con `departureToken`, las opciones son las VUELTAS para esa ida
 * concreta, ya con el precio real de la combinación completa y su `bookingToken`. El asesor elige
 * la ida primero, y esa elección dispara el segundo paso.
 */

const TOPE_DIARIO = 50;
const CACHE_MINUTOS = 10;

/**
 * Caché GLOBAL, no por agencia: el precio de un vuelo no es un dato de negocio de
 * ninguna agencia, es el mismo para cualquiera que busque el mismo origen, destino
 * y fecha. Cachear por esa clave ahorra más que una caché aislada por agencia, y
 * no hay nada que aislar (a diferencia del tope diario, que sí es por agencia).
 */
const cache = new Map();

function limpiarCache() {
  const ahora = Date.now();
  for (const [clave, entrada] of cache) {
    if (entrada.expira <= ahora) cache.delete(clave);
  }
}

/**
 * Cuenta esta búsqueda contra el tope del día de la agencia actual y corta si ya
 * lo pasó. El `UPSERT` es una sola ida y vuelta a la base, atómico: dos búsquedas
 * a la vez de la misma agencia no pueden las dos leer "49" y las dos pasar.
 */
async function contarYComprobarTope() {
  const [{ cantidad }] = await prisma.$queryRaw`
    INSERT INTO busquedas_vuelos_contador (fecha, cantidad)
    VALUES (CURRENT_DATE, 1)
    ON CONFLICT (empresa_id, fecha) DO UPDATE SET cantidad = busquedas_vuelos_contador.cantidad + 1
    RETURNING cantidad`;
  if (cantidad > TOPE_DIARIO) {
    throw new AppError(
      `Llegaste al límite de ${TOPE_DIARIO} búsquedas de vuelos por hoy. Volvé a intentarlo mañana.`,
      429, 'DAILY_LIMIT_REACHED',
    );
  }
}

/** Un tramo de `item.flights[]`, con sus mismos nombres en español. */
function transformarTramo(t) {
  return {
    departureAirport: t.departure_airport
      ? { name: t.departure_airport.name, id: t.departure_airport.id, date: t.departure_airport.date, time: t.departure_airport.time }
      : null,
    arrivalAirport: t.arrival_airport
      ? { name: t.arrival_airport.name, id: t.arrival_airport.id, date: t.arrival_airport.date, time: t.arrival_airport.time }
      : null,
    duration: t.duration ?? null,
    airplane: t.airplane ?? null,
    airline: t.airline ?? null,
    airlineLogo: t.airline_logo ?? null,
    travelClass: t.travel_class ?? null,
    flightNumber: t.flight_number ?? null,
    extensions: Array.isArray(t.extensions) ? t.extensions : [],
  };
}

/**
 * Una de las opciones de `best_flights`/`other_flights`. La tarjeta solo necesita
 * `airline`/`duration`/`stops`/`price`/`bookingToken`; el resto (tramos, equipaje,
 * emisiones, extras) es lo que pide "Ver detalles" — tal cual lo documenta SearchApi,
 * sin recortar nada.
 */
function transformarOpcion(item) {
  const tramos = Array.isArray(item.flights) ? item.flights : [];
  const aerolineas = [...new Set(tramos.map(t => t.airline).filter(Boolean))];
  return {
    airline: aerolineas.join(' + ') || null,
    duration: item.total_duration ?? null,
    stops: Array.isArray(item.layovers) ? item.layovers.length : 0,
    price: item.price ?? null,
    bookingToken: item.booking_token ?? null,
    // Solo en el primer paso de ida y vuelta: hay que volver a buscar con esto para ver las
    // vueltas (y recién ahí llega el `bookingToken` de la combinación completa).
    departureToken: item.departure_token ?? null,
    type: item.type ?? null,
    extensions: Array.isArray(item.extensions) ? item.extensions : [],
    baggage: item.baggage ?? null,
    carbonEmissions: item.carbon_emissions ?? null,
    layovers: (Array.isArray(item.layovers) ? item.layovers : []).map(l => ({
      duration: l.duration ?? null, name: l.name ?? null, id: l.id ?? null, isOvernight: Boolean(l.is_overnight),
    })),
    legs: tramos.map(transformarTramo),
  };
}

function transformarRespuesta(datos) {
  const todas = [...(datos.best_flights || []), ...(datos.other_flights || [])];
  return {
    results: todas.map(transformarOpcion),
    // `{ lowest_price, price_level, typical_price_range: { low_price, high_price }, price_history:
    // [{ price, iso_date }] }`, confirmado con una llamada real — viene en la MISMA búsqueda, sin
    // costo aparte (a diferencia de la cuadrícula de precios por día, que es otro producto).
    priceInsights: datos.price_insights ?? null,
  };
}

/**
 * `departureId`/`arrivalId`: código IATA de 3 letras (los mismos aeropuertos sembrados, spec 039
 * T0). `departureToken` es el segundo paso de ida y vuelta (ver cabecera del archivo): con él, el
 * resultado deja de ser la lista de idas y pasa a ser la de vueltas para esa ida.
 */
async function buscarVuelos({ departureId, arrivalId, outboundDate, tripType, returnDate, departureToken, adults, travelClass }) {
  limpiarCache();
  const esIdaYVuelta = tripType === 'round_trip';
  const clave = [
    departureId, arrivalId, outboundDate,
    esIdaYVuelta ? returnDate : 'solo-ida',
    departureToken || '-',
    adults || 1, travelClass || 'economy',
  ].join('|');
  const enCache = cache.get(clave);
  if (enCache) return enCache.resultado;

  await contarYComprobarTope();

  const datos = await buscarEnSearchApi({
    departure_id: departureId,
    arrival_id: arrivalId,
    outbound_date: outboundDate,
    return_date: esIdaYVuelta ? returnDate : undefined,
    flight_type: esIdaYVuelta ? 'round_trip' : 'one_way',
    departure_token: departureToken,
    currency: 'COP',
    adults,
    travel_class: travelClass,
  });

  const resultado = transformarRespuesta(datos);
  cache.set(clave, { resultado, expira: Date.now() + CACHE_MINUTOS * 60 * 1000 });
  return resultado;
}

/**
 * El calendario de precios, un día por columna (spec 039) — como lo muestra Google Flights para
 * ida sola: un precio por día, de a 7 en 7 a partir de `outboundDate`. Sin `return_date`: con
 * `flight_type=one_way` explícito, SearchApi lo honra y devuelve la grilla de un solo sentido
 * (comprobado con una llamada real; sin ese parámetro, lo da por ida y vuelta y pide `return_date`,
 * que fue el primer intento). No trae `booking_token` —nadie lo necesita acá—, es puro para elegir
 * una fecha barata: el asesor la usa después en `buscarVuelos`. Una sola llamada a SearchApi, no
 * una por día, así que cuenta UNA vez contra el tope diario, como cualquier otra búsqueda.
 */
async function buscarCalendario({ departureId, arrivalId, outboundDate }) {
  limpiarCache();
  const clave = `cal:${departureId}|${arrivalId}|${outboundDate}`;
  const enCache = cache.get(clave);
  if (enCache) return enCache.resultado;

  await contarYComprobarTope();

  const datos = await buscarEnSearchApi({
    departure_id: departureId,
    arrival_id: arrivalId,
    outbound_date: outboundDate,
    flight_type: 'one_way',
    currency: 'COP',
  }, 'google_flights_calendar');

  const resultado = (Array.isArray(datos.calendar) ? datos.calendar : []).map(c => ({
    departure: c.departure ?? null,
    price: c.price ?? null,
    isLowestPrice: Boolean(c.is_lowest_price),
  }));
  cache.set(clave, { resultado, expira: Date.now() + CACHE_MINUTOS * 60 * 1000 });
  return resultado;
}

module.exports = { buscarVuelos, buscarCalendario };
