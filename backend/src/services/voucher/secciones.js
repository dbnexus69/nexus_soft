/**
 * Bloques de PDF por categoría de producto (spec 011/007), compartidos entre el voucher de una
 * venta y el PDF de una cotización: ambos describen el mismo objeto por categoría
 * (`TicketData`/`HotelData`...), así que el mapeo "qué campo se ve con qué etiqueta" vive en un
 * solo lugar. Añadir una categoría se hace aquí una vez, para los dos documentos a la vez.
 */
const { META } = require('../../catalog/products');

// ── Formatos (hora de Bogotá, como el resto de la aplicación)
const ZONA = 'America/Bogota';
// 'AAAA-MM-DD' ya es un día de calendario (así llegan las fechas de los tramos): se pinta tal cual.
// Pasarlo por `new Date` lo leía como medianoche UTC, que en Bogotá es el día anterior: todos los vuelos
// del voucher salían un día antes. Un instante (con hora) sí se convierte a la hora de Bogotá.
const fecha = (v) => {
  if (!v) return null;
  const dia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
  if (dia) return `${dia[3]}/${dia[2]}/${dia[1]}`;
  return new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(v));
};
const fechaHora = (v) => (v ? new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(v)) : null);
const dinero = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(v) || 0);
const nombres = (lista) => (lista || []).map(p => p?.name).filter(Boolean).join(', ');
const hora12 = (h) => {
  if (!h) return null;
  const [hh, mm] = String(h).split(':');
  const n = Number(hh);
  return `${((n + 11) % 12) + 1}:${mm} ${n >= 12 ? 'PM' : 'AM'}`;
};

// Un tour: va en su sección, o dentro del paquete al que pertenece.
const campoTour = (t) => [
  ['Tour / actividad', t.tourName], ['Fecha y hora', fechaHora(t.preferredDate)],
  ['Pasajeros', nombres(t.guests) || t.passengerName],
  ['Adultos', t.adultsCount], ['Niños', t.childrenCount], ['Punto de recogida', t.pickupPoint],
  ['Idioma guía', t.guideLanguage], ['Transporte', t.needsTransport ? 'Incluido' : 'No requiere'], ['Observaciones', t.observations],
];

// ── Secciones por categoría: [clave de la venta, título, (producto) => [[etiqueta, valor], …]]
const SECCIONES = [
  ['hotelData', 'ALOJAMIENTO', (h) => [
    ['Hotel', h.hotelName], ['Destino', h.destination], ['Tipo', h.hotelType],
    ['Check-in', fechaHora(h.startDate)], ['Check-out', fechaHora(h.endDate)],
    ['N° reserva', h.reservationNumber || 'Pendiente'], ['Huéspedes', nombres(h.guests)], ['Observaciones', h.observations],
  ]],
  ['tourData', 'ACTIVIDADES Y TOURS', campoTour],
  ['planData', 'PAQUETES', (p) => {
    const terrestre = p.transportType === 'Terrestre';
    if (p.packageType === 'supplier') {
      return [['Plan', p.planName || p.packageName], ['Proveedor / operador', p.supplier], ['Tipo de paquete', 'Por proveedor'],
        ['Pasajeros', nombres(p.guests)], ['Observaciones', p.observations]];
    }
    return [
      ['Plan', p.planName || p.packageName], ['Hotel incluido', p.hotelName], ['Proveedor', p.supplier],
      ['Check-in (hotel)', fechaHora(p.startDate)], ['Check-out (hotel)', fechaHora(p.endDate)],
      ['Pasajeros (resumen)', `${p.adultsCount ?? 0} adulto(s) / ${p.childrenCount ?? 0} niño(s)`],
      [terrestre ? 'Empresa de transporte' : 'Aerolínea', p.airline], [terrestre ? 'Placa / vehículo' : 'N° vuelo', p.flightNumber],
      ['Localizador / reserva', p.reservationNumber], [terrestre ? 'Tiquete / puesto' : 'N° tiquete', p.ticketNumber],
      ['N° confirmación', p.confirmationNumber],
      [terrestre ? 'Salida (ida)' : 'Salida vuelo (ida)', fechaHora(p.flightDepartureDate)],
      [terrestre ? 'Llegada destino (ida)' : 'Llegada vuelo (ida)', fechaHora(p.flightDepartureArrivalDate)],
      [terrestre ? 'Salida (regreso)' : 'Salida vuelo (regreso)', fechaHora(p.flightReturnDate)],
      [terrestre ? 'Llegada origen (regreso)' : 'Llegada vuelo (regreso)', fechaHora(p.flightReturnArrivalDate)],
      ['Pasajeros', nombres(p.guests)], ['Observaciones', p.observations],
    ];
  }],
  ['insuranceData', 'SEGURO MÉDICO / ASISTENCIA', (s) => [
    ['Tipo de seguro', s.insuranceType], ['Teléfono', s.phone], ['Proveedor', s.supplier], ['Asegurados', nombres(s.members)],
  ]],
  ['carRentalData', 'RENTA DE VEHÍCULOS', (c) => [
    ['Conductor principal', c.mainDriver], ['N° licencia', c.licenseNumber], ['Categoría', c.vehicleCategory],
    ['Recogida', fecha(c.pickupDate)], ['Devolución', fecha(c.returnDate)], ['Lugar de recogida', c.pickupLocation],
    ['Tipo de seguro', c.insuranceType === 'all_risk' ? 'Todo riesgo' : (c.insuranceType ? 'Básico' : null)],
    ['Conductores adicionales', c.additionalDrivers], ['Tarjeta de garantía', c.guaranteeCreditCard],
  ]],
  ['visaData', 'TRÁMITE DE VISAS', (v) => [
    ['Solicitante', v.fullName], ['Nacionalidad', v.nationality], ['N° pasaporte', v.docNumber],
    ['País al que aplica', v.countryApplying], ['Tipo de visa', v.visaType], ['Viaje estimado', fecha(v.estimatedTravelDate)],
  ]],
  ['fincaData', 'ALOJAMIENTO (FINCAS)', (f) => [
    ['Finca', f.fincaName], ['Ciudad / destino', f.fincaCity], ['Responsable', f.responsibleName], ['Documento', f.docNumber],
    ['Check-in', fecha(f.checkInDate)], ['Check-out', fecha(f.checkOutDate)], ['Adultos', f.adultsCount], ['Niños', f.childrenCount],
    ['Mascotas', f.hasPets ? `Sí${f.petType ? ` - ${f.petType}` : ''}` : 'No'],
  ]],
  ['migrationData', 'TRÁMITES MIGRATORIOS', (m) => [
    ['Pasajero', m.passengerName], ['Nacionalidad', m.nationality], ['Trámite / documento', m.requestedDocType],
    ['N° pasaporte', m.docNumber], ['Vencimiento', fecha(m.passportExpiry)], ['País destino', m.destinationCountry],
  ]],
  ['simCardData', 'SIM CARDS / CONECTIVIDAD', (s) => [
    ['Pasajero', s.passengerName], ['País destino', s.destinationCountry], ['Llegada', fecha(s.arrivalDate)],
    ['Plan de datos', s.dataPlan], ['Tipo de SIM', s.simType], ['Método de entrega', s.deliveryMethod],
  ]],
  ['conventionData', 'EVENTOS Y CONVENCIONES', (c) => [
    ['Organización / evento', c.organization], ['Contacto', c.contactName], ['Tipo de evento', c.eventType],
    ['Inicio', fecha(c.startDate)], ['Fin', fecha(c.endDate)], ['Asistentes', c.estimatedAttendance],
    ['Espacio requerido', c.requiredSpace], ['Catering', c.hasCatering ? `Sí${c.cateringNotes ? ` - ${c.cateringNotes}` : ''}` : 'No'],
  ]],
  ['passportData', 'TRÁMITE DE PASAPORTES', (p) => [
    ['Titular', p.fullName], ['N° identificación', p.idNumber], ['Ciudad de residencia', p.residenceCity],
    ['Tipo de trámite', p.processType], ['Viaje estimado', fecha(p.estimatedTravelDate)], ['Teléfono', p.phone],
  ]],
  ['petServiceData', 'TRANSPORTE DE MASCOTAS', (m) => [
    ['Dueño', m.ownerName], ['Mascota', m.petName], ['Especie / raza', [m.species, m.breed].filter(Boolean).join(' / ')],
    ['Peso / tamaño', [m.weight != null ? `${m.weight} kg` : null, m.size].filter(Boolean).join(' - ')],
    ['Tipo de viaje', m.travelType], ['Ruta / destino', m.destinationCountry], ['Fecha', fecha(m.travelDate)],
  ]],
  ['checkInData', 'ASISTENCIA CHECK-IN', (c) => [
    ['Pasajero', c.passengerName], ['Documento', c.docType && c.docNumber ? `${c.docType}: ${c.docNumber}` : c.docNumber],
    ['Vuelo / reserva', c.flightOrReservation], ['Fecha de viaje', fecha(c.travelDate)], ['Silla', c.seat],
    ['Equipaje', c.baggage], ['Necesidades especiales', c.specialNeeds],
  ]],
  ['restaurantData', 'RESERVAS DE RESTAURANTES', (r) => [
    ['Reserva a nombre', r.reservationName], ['Fecha y hora', fechaHora(r.dateTime)], ['N° personas', r.peopleCount],
    ['Mesa preferida', r.tablePreference], ['Tipo de menú', r.menuType],
    ['Restricciones', Array.isArray(r.dietaryRestrictions) ? r.dietaryRestrictions.join(', ') : r.dietaryRestrictions],
    ['Ocasión especial', r.specialOccasion],
  ]],
];

const vacio = (v) => v === null || v === undefined || v === '' || v === '—';

/** Pares etiqueta/valor en una rejilla de dos columnas. */
function rejilla(pares, c) {
  const celdas = pares.filter(([, v]) => !vacio(v)).map(([etiqueta, valor]) => ({
    stack: [{ text: etiqueta.toUpperCase(), style: 'etiqueta', color: c.tenue }, { text: String(valor), style: 'valor' }],
    margin: [0, 0, 8, 6],
  }));
  if (!celdas.length) return null;
  if (celdas.length % 2) celdas.push({ text: '' });
  const filas = [];
  for (let i = 0; i < celdas.length; i += 2) filas.push([celdas[i], celdas[i + 1]]);
  return { table: { widths: ['*', '*'], body: filas }, layout: 'noBorders' };
}

const titulo = (texto, c) => ({ text: texto, style: 'seccion', color: c.acento, margin: [0, 14, 0, 6] });
const tarjeta = (contenido, c) => ({
  table: { widths: ['*'], body: [[{ stack: contenido, margin: [8, 8, 8, 2] }]] },
  layout: { hLineColor: () => c.borde, vLineColor: () => c.borde, hLineWidth: () => 0.6, vLineWidth: () => 0.6 },
  margin: [0, 0, 0, 6],
});

// La flecha "→" no está en la Roboto que incrusta pdfmake: se perdía y el voucher decía "MDE CTG12B".
// La raya (–) sí está.
const ruta = (l) => `${l.origin} – ${l.destination}`;

function bloqueTiquete(t, aeropuertos, c) {
  const tramos = (t.legs?.length ? [...t.legs, ...(t.outboundStops || []), ...(t.returnLeg ? [t.returnLeg] : []), ...(t.returnStops || [])] : []);
  const ciudad = (codigo) => (aeropuertos[codigo] ? ` (${aeropuertos[codigo]})` : '');
  const filas = tramos.map(l => [
    { text: `${l.origin}${ciudad(l.origin)} – ${l.destination}${ciudad(l.destination)}`, bold: true },
    l.flightNumber || '—',
    [fecha(l.date), hora12(l.time)].filter(Boolean).join(' ') || '—',
    [fecha(l.arrivalDate || l.date), hora12(l.arrivalTime)].filter(Boolean).join(' ') || '—',
    l.airline || t.airlineName || '—',
  ]);
  const contenido = [
    rejilla([['Reserva', t.reservationNumber], ['Aerolínea', t.airlineName], ['Equipaje', t.baggagePlanName]], c),
  ];
  if (filas.length) {
    contenido.push({
      table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto', 'auto'],
        body: [['Ruta', 'Vuelo', 'Salida', 'Llegada', 'Aerolínea'].map(h => ({ text: h, style: 'cabecera', fillColor: c.fondo })), ...filas] },
      layout: 'lightHorizontalLines', fontSize: 8, margin: [0, 2, 0, 6],
    });
  }
  if (t.passengers?.length) {
    // El asiento de cada pasajero en cada tramo (spec 012), emparejado por el `orden` del tramo, que es lo
    // que guarda `asientos[].tramo`. En ventas anteriores: el del tramo, o el del pasajero en el primero.
    // Una línea por tramo, con la ruta en gris y el asiento en negrita; con un solo tramo, solo el asiento.
    const asientosDe = (p) => {
      const lineas = tramos.map((l, k) => {
        const propio = (Array.isArray(p.asientos) ? p.asientos : [])
          .find(a => Number(a.tramo) === Number(l.orden ?? k + 1))?.asiento;
        const asiento = propio || l.seat || (k === 0 ? p.asiento : null);
        if (!asiento) return null;
        return tramos.length === 1
          ? { text: asiento, bold: true }
          : { text: [{ text: `${ruta(l)}  `, color: c.tenue }, { text: asiento, bold: true }], noWrap: true };
      }).filter(Boolean);
      return lineas.length ? { stack: lineas } : '—';
    };
    // La reserva es de cada pasajero; sin la suya (ventas anteriores), la del titular o la del tiquete,
    // igual que al guardar (`ventaProductos.js`).
    const titular = t.passengers.find(p => p.esTitular) || t.passengers[0];
    const reservaDe = (p) => p.nroReserva || titular?.nroReserva || t.reservationNumber || '—';
    contenido.push({
      table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto', 'auto'],
        body: [['Pasajero', 'Documento', 'Reserva', 'Tiquete', tramos.length === 1 ? 'Asiento' : 'Asientos'].map(h => ({ text: h, style: 'cabecera', fillColor: c.fondo })),
          ...t.passengers.map(p => [
            `${p.name || p.nombreCompleto || '—'}${p.esTitular ? ' (titular)' : ''}`,
            p.docNumber || p.nroDocumento || '—', reservaDe(p), p.nroTiquete || '—', asientosDe(p),
          ])] },
      layout: 'lightHorizontalLines', fontSize: 8, margin: [0, 0, 0, 6],
    });
  }
  return tarjeta(contenido.filter(Boolean), c);
}

// Lo que cuelga de un paquete (`includedProducts`, por slug): cada servicio con el formato de su sección.
function bloquesDeHijos(plan, aeropuertos, c) {
  const bloques = [];
  for (const [slug, lista] of Object.entries(plan.includedProducts || {})) {
    if (!lista?.length) continue;
    const { label, responseKey } = META[slug];
    const seccion = SECCIONES.find(([clave]) => clave === responseKey);
    const items = slug === 'ticket'
      ? lista.map(t => bloqueTiquete(t, aeropuertos, c))
      : lista.map(x => rejilla(seccion[2](x), c)).filter(Boolean).map(i => tarjeta([i], c));
    if (items.length) bloques.push(titulo(`${label} incluido en ${plan.planName || plan.packageName || 'el paquete'}`, c), ...items);
  }
  return bloques;
}

module.exports = {
  fecha, fechaHora, dinero, nombres, hora12,
  SECCIONES, vacio, rejilla, titulo, tarjeta, ruta, bloqueTiquete, bloquesDeHijos,
};
