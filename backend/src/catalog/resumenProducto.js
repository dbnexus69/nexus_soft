/**
 * Una línea legible por categoría (spec 007): lo que se guarda en
 * `detalle_cotizacion.descripcion` y lo que ve el cliente en el PDF de la cotización.
 * No se escribe a mano — se deriva del `detalle` completo (el mismo objeto que ya usa
 * el asistente de venta) al guardar, para que la lista y el PDF no dependan de que
 * alguien la redacte bien.
 */

const ruta = (l) => (l?.origin && l?.destination ? `${l.origin} → ${l.destination}` : '');

const RESUMENES = {
  ticket: (d) => {
    const ida = ruta(d.legs?.[0]);
    const texto = d.flightMode === 'round_trip' && d.returnLeg && ida ? `${ida} (ida y vuelta)` : ida;
    return [texto, d.airline].filter(Boolean).join(' · ') || 'Tiquete aéreo';
  },
  hotel: (d) => [d.hotelName, d.destination].filter(Boolean).join(' · ') || 'Hotel',
  insurance: (d) => [d.insuranceType, d.coverageDays ? `${d.coverageDays} días` : null].filter(Boolean).join(' · ') || 'Seguro de viaje',
  plan: (d) => d.planName || d.packageName || 'Paquete',
  checkin: (d) => [d.passengerName, d.flightOrReservation].filter(Boolean).join(' · ') || 'Check-in',
  migration: (d) => [d.passengerName, d.requestedDocType].filter(Boolean).join(' · ') || 'Trámite migratorio',
  simcard: (d) => [d.destinationCountry, d.dataPlan].filter(Boolean).join(' · ') || 'SIM card',
  car: (d) => [d.vehicleCategory, d.mainDriver].filter(Boolean).join(' · ') || 'Renta de vehículo',
  finca: (d) => d.fincaName || 'Finca',
  tour: (d) => d.selectedTour || 'Tour',
  convention: (d) => d.placeName || d.organization || 'Convención',
  restaurant: (d) => d.reservationName || 'Restaurante',
  visa: (d) => [d.countryApplying, d.visaType].filter(Boolean).join(' · ') || 'Visa',
  passport: (d) => d.fullName || 'Pasaporte',
  pet: (d) => [d.petName, d.species].filter(Boolean).join(' · ') || 'Mascota',
};

function resumenDe(categoria, detalle) {
  const fn = RESUMENES[categoria];
  const texto = fn ? fn(detalle || {}) : null;
  return texto || categoria;
}

module.exports = { resumenDe };
