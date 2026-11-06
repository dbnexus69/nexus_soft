import api from './client';
import type { Recurso } from './tipos';

export interface FlightAirportStop {
  name: string | null;
  id: string | null;
  date: string | null;
  time: string | null;
}

export interface FlightLegDetail {
  departureAirport: FlightAirportStop | null;
  arrivalAirport: FlightAirportStop | null;
  duration: number | null;
  airplane: string | null;
  airline: string | null;
  airlineLogo: string | null;
  travelClass: string | null;
  flightNumber: string | null;
  extensions: string[];
}

export interface FlightLayover {
  duration: number | null;
  name: string | null;
  id: string | null;
  isOvernight: boolean;
}

/** Una opción de la búsqueda (spec 039). La tarjeta usa lo básico; "Ver detalles" usa el resto, tal cual lo da SearchApi. */
export interface FlightSearchResult {
  airline: string | null;
  /** Minutos, de punta a punta (incluye escalas). */
  duration: number | null;
  stops: number;
  /** Pesos colombianos. */
  price: number | null;
  bookingToken: string | null;
  /** Solo en el primer paso de ida y vuelta: hay que volver a buscar con esto para ver las vueltas. */
  departureToken: string | null;
  type: string | null;
  extensions: string[];
  baggage: { carry_on_bag?: string; carry_on_bags_included?: number } | null;
  carbonEmissions: {
    this_flight?: number; typical_for_this_route?: number; difference_percent?: number; lowest_route?: number;
  } | null;
  layovers: FlightLayover[];
  legs: FlightLegDetail[];
}

export interface FlightPriceInsights {
  lowest_price?: number;
  price_level?: "low" | "typical" | "high" | string;
  typical_price_range?: { low_price: number; high_price: number };
  price_history?: { price: number; iso_date: string }[];
}

export interface FlightSearchResponse {
  results: FlightSearchResult[];
  priceInsights: FlightPriceInsights | null;
}

export type TravelClass = "economy" | "premium_economy" | "business" | "first";
export type TripType = "one_way" | "round_trip";

export interface FlightSearchParams {
  departureId: string;
  arrivalId: string;
  outboundDate: string;
  tripType?: TripType;
  returnDate?: string;
  /** Segundo paso de ida y vuelta (spec 039): el `departureToken` de la ida ya elegida. */
  departureToken?: string;
  adults?: number;
  travelClass?: TravelClass;
}

export async function searchFlights(params: FlightSearchParams) {
  const res = await api.post<Recurso<FlightSearchResponse>>('/flight-search', params);
  return res.data.data;
}

/** Un día del calendario, con su precio — como lo muestra Google Flights para ida sola. Sin `bookingToken`. */
export interface FlightCalendarEntry {
  departure: string | null;
  price: number | null;
  isLowestPrice: boolean;
}

export interface FlightCalendarParams {
  departureId: string;
  arrivalId: string;
  outboundDate: string;
}

export async function searchFlightCalendar(params: FlightCalendarParams) {
  const res = await api.post<Recurso<FlightCalendarEntry[]>>('/flight-search/calendar', params);
  return res.data.data;
}
