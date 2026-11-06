const { z } = require('zod');

const codigoIata = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Código IATA de 3 letras');
const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha en formato AAAA-MM-DD');

/**
 * Ida y vuelta es de dos pasos (spec 039): SearchApi no da el `booking_token` de la combinación
 * completa en una sola llamada. El primer paso (sin `departureToken`) trae los vuelos de IDA, cada
 * uno con su `departureToken` en vez de `bookingToken`; el segundo paso (con ese `departureToken`)
 * trae los de VUELTA para esa ida, ya con el precio real de la combinación y su `bookingToken`.
 */
const searchFlightsSchema = z.object({
  departureId: codigoIata,
  arrivalId: codigoIata,
  outboundDate: fechaISO,
  tripType: z.enum(['one_way', 'round_trip']).optional(),
  returnDate: fechaISO.optional(),
  /** Solo en el segundo paso de ida y vuelta: el `departureToken` de la ida ya elegida. */
  departureToken: z.string().optional(),
  adults: z.coerce.number().int().min(1).max(9).optional(),
  travelClass: z.enum(['economy', 'premium_economy', 'business', 'first']).optional(),
}).strict().superRefine((val, ctx) => {
  if (val.tripType === 'round_trip' && !val.returnDate) {
    ctx.addIssue({ code: 'custom', path: ['returnDate'], message: 'La fecha de regreso es obligatoria para ida y vuelta' });
  }
});

/**
 * El calendario de precios (spec 039), un día por columna, de a 7 a partir de `outboundDate` —
 * como lo muestra Google Flights para ida sola. Sin `returnDate`: con `flight_type=one_way`
 * explícito, SearchApi da la grilla de un solo sentido en vez de pedir vuelta (confirmado con una
 * llamada real).
 */
const flightCalendarSchema = z.object({
  departureId: codigoIata,
  arrivalId: codigoIata,
  outboundDate: fechaISO,
}).strict();

module.exports = { searchFlightsSchema, flightCalendarSchema };
