const PdfPrinter = require('pdfmake');
const vfsFuentes = require('pdfmake/build/vfs_fonts.js');
const TERMINOS_POR_DEFECTO = require('./terminosPorDefecto');

/**
 * El voucher en PDF (spec 011): venta + configuración de la agencia → definición de `pdfmake` → Buffer.
 *
 * Reproduce lo que mostraba `VoucherPDF.tsx` en el navegador, con la marca de la agencia (logo, colores, datos de
 * contacto, términos y pie). Cada categoría de producto es una entrada de `SECCIONES`: título y pares
 * etiqueta/valor; un valor vacío no se pinta. Subir `PLANTILLA_VERSION` cuando cambie el diseño invalida la caché.
 */
const PLANTILLA_VERSION = 2;

const vfs = (vfsFuentes.pdfMake && vfsFuentes.pdfMake.vfs) || vfsFuentes.vfs || vfsFuentes;
const fuente = (archivo) => Buffer.from(vfs[archivo], 'base64');
const impresora = new PdfPrinter({
  Roboto: {
    normal: fuente('Roboto-Regular.ttf'), bold: fuente('Roboto-Medium.ttf'),
    italics: fuente('Roboto-Italic.ttf'), bolditalics: fuente('Roboto-MediumItalic.ttf'),
  },
});

// ── Formatos (hora de Bogotá, como el resto de la aplicación)
const ZONA = 'America/Bogota';
const fecha = (v) => (v ? new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(v)) : null);
const fechaHora = (v) => (v ? new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(v)) : null);
const dinero = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(v) || 0);
const nombres = (lista) => (lista || []).map(p => p?.name).filter(Boolean).join(', ');
const hora12 = (h) => {
  if (!h) return null;
  const [hh, mm] = String(h).split(':');
  const n = Number(hh);
  return `${((n + 11) % 12) + 1}:${mm} ${n >= 12 ? 'PM' : 'AM'}`;
};

// ── Secciones por categoría: [clave de la venta, título, (producto) => [[etiqueta, valor], …]]
const SECCIONES = [
  ['hotelData', 'ALOJAMIENTO', (h) => [
    ['Hotel', h.hotelName], ['Destino', h.destination], ['Tipo', h.hotelType],
    ['Check-in', fechaHora(h.startDate)], ['Check-out', fechaHora(h.endDate)],
    ['N° reserva', h.reservationNumber || 'Pendiente'], ['Huéspedes', nombres(h.guests)], ['Observaciones', h.observations],
  ]],
  ['tourData', 'ACTIVIDADES Y TOURS', (t) => [
    ['Tour / actividad', t.selectedTour], ['Pasajeros', nombres(t.guests) || t.passengerName],
    ['Adultos', t.adultsCount], ['Niños', t.childrenCount], ['Punto de recogida', t.pickupPoint],
    ['Idioma guía', t.guideLanguage], ['Transporte', t.needsTransport ? 'Incluido' : 'No requiere'], ['Observaciones', t.observations],
  ]],
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

function bloqueTiquete(t, aeropuertos, c) {
  const tramos = (t.legs?.length ? [...t.legs, ...(t.outboundStops || []), ...(t.returnLeg ? [t.returnLeg] : []), ...(t.returnStops || [])] : []);
  const ciudad = (codigo) => (aeropuertos[codigo] ? ` (${aeropuertos[codigo]})` : '');
  const filas = tramos.map(l => [
    { text: `${l.origin}${ciudad(l.origin)} → ${l.destination}${ciudad(l.destination)}`, bold: true },
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
    // El asiento de cada pasajero en cada tramo (spec 012); en ventas anteriores, el del tramo.
    const asientosDe = (p) => tramos.map((l, k) => {
      const propio = (p.asientos || []).find(a => Number(a.tramo) === k + 1)?.asiento;
      const asiento = propio || l.seat;
      return asiento ? `${l.origin}→${l.destination} ${asiento}` : null;
    }).filter(Boolean).join('  ·  ') || '—';
    contenido.push({
      table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto', '*'],
        body: [['Pasajero', 'Documento', 'Reserva', 'Tiquete', 'Asientos'].map(h => ({ text: h, style: 'cabecera', fillColor: c.fondo })),
          ...t.passengers.map(p => [
            `${p.name || p.nombreCompleto || '—'}${p.esTitular ? ' (titular)' : ''}`,
            p.docNumber || p.nroDocumento || '—', p.nroReserva || '—', p.nroTiquete || '—', asientosDe(p),
          ])] },
      layout: 'lightHorizontalLines', fontSize: 8, margin: [0, 0, 0, 6],
    });
  }
  return tarjeta(contenido.filter(Boolean), c);
}

/**
 * La definición del documento.
 * @param venta   la venta como la devuelve `getSaleById` + `getSaleProducts`
 * @param config  { nombre, nit, direccion, telefono, emailContacto, sitioWeb, colores: { primario, acento, realce }, pie, terminos }
 * @param extra   { logo: Buffer|null, aeropuertos: { BOG: 'Bogotá' } , hoy: Date }
 */
function definicion(venta, config, { logo = null, aeropuertos = {}, hoy = new Date() } = {}) {
  const c = {
    primario: config.colores?.primario || '#1e293b',
    acento: config.colores?.acento || '#2563eb',
    realce: config.colores?.realce || '#f59e0b',
    tenue: '#64748b', borde: '#e2e8f0', fondo: '#f1f5f9',
  };
  const agencia = config.nombre || 'Agencia';
  const contacto = [config.nit && `NIT ${config.nit}`, config.direccion, config.telefono, config.emailContacto, config.sitioWeb]
    .filter(Boolean).join('  ·  ');
  const pagado = (venta.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const terminos = (Array.isArray(config.terminos) ? config.terminos : TERMINOS_POR_DEFECTO)
    .map(t => ({ titulo: t.titulo, texto: String(t.texto).replaceAll('{agencia}', agencia) }));

  const cuerpo = [];
  if (venta.ticketData?.length) {
    cuerpo.push(titulo('ITINERARIO DE VUELO', c), ...venta.ticketData.map(t => bloqueTiquete(t, aeropuertos, c)));
  }
  for (const [clave, nombre, campos] of SECCIONES) {
    const items = (venta[clave] || []).map(x => rejilla(campos(x), c)).filter(Boolean);
    if (items.length) cuerpo.push(titulo(nombre, c), ...items.map(i => tarjeta([i], c)));
  }

  return {
    pageSize: 'LETTER',
    pageMargins: [36, 36, 36, 48],
    info: { title: `Voucher ${venta.numero ?? venta.id} - ${agencia}`, author: agencia },
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#0f172a' },
    styles: {
      seccion: { fontSize: 10, bold: true, characterSpacing: 0.5 },
      etiqueta: { fontSize: 7, bold: true },
      valor: { fontSize: 9 },
      cabecera: { fontSize: 7, bold: true, color: '#334155' },
    },
    ...(venta.status === 'anulado' ? { watermark: { text: 'ANULADA', color: '#dc2626', opacity: 0.15, bold: true } } : {}),
    footer: (pagina, total) => ({
      columns: [
        { text: config.pie || `© ${hoy.getFullYear()} ${agencia}. Documento generado electrónicamente.`, fontSize: 7, color: c.tenue },
        { text: `${pagina} / ${total}`, alignment: 'right', fontSize: 7, color: c.tenue },
      ],
      margin: [36, 16, 36, 0],
    }),
    content: [
      // Cabecera con el color principal de la agencia.
      {
        table: { widths: [logo ? 90 : 0, '*'], body: [[
          logo ? { image: logo, fit: [80, 50], margin: [6, 6, 0, 6] } : { text: '' },
          { stack: [
            { text: agencia.toUpperCase(), fontSize: 16, bold: true, color: '#ffffff' },
            { text: 'CONFIRMACIÓN DE SERVICIOS', fontSize: 8, color: '#ffffff', characterSpacing: 1 },
            ...(contacto ? [{ text: contacto, fontSize: 7, color: '#ffffff', margin: [0, 4, 0, 0] }] : []),
          ], margin: [8, 8, 8, 8] },
        ]] },
        layout: { fillColor: () => c.primario, hLineWidth: () => 0, vLineWidth: () => 0 },
      },
      {
        columns: [
          { stack: [{ text: 'PASAJERO PRINCIPAL', style: 'etiqueta', color: c.tenue }, { text: venta.clientName || '—', bold: true }] },
          { stack: [{ text: 'FECHA DE EMISIÓN', style: 'etiqueta', color: c.tenue }, { text: fecha(hoy) }] },
          { stack: [{ text: 'ORDEN', style: 'etiqueta', color: c.tenue },
            { text: [{ text: `#${venta.numero ?? venta.id}  `, bold: true, color: c.acento },
              { text: String(venta.status || '').toUpperCase(), color: c.realce, bold: true, fontSize: 8 }] }] },
        ],
        margin: [0, 10, 0, 4],
      },
      ...cuerpo,
      titulo('RESUMEN DE PAGO', c),
      tarjeta([rejilla([
        ['Método de pago', venta.paymentMethod || ((venta.payments || []).length > 1 ? 'Mixto' : venta.payments?.[0]?.method)],
        ['Emisor', agencia],
        ['Valor total', dinero(venta.total)],
        ['IVA incluido (sobre la ganancia)', Number(venta.iva) > 0 ? dinero(venta.iva) : null],
        ['Abonado', dinero(pagado)],
        ['Saldo', dinero(Math.max(0, (Number(venta.total) || 0) - pagado))],
      ], c)], c),
      titulo('CONDICIONES DEL SERVICIO', c),
      ...terminos.map(t => ({ text: [{ text: `${t.titulo}: `, bold: true }, t.texto], fontSize: 8, margin: [0, 0, 0, 4] })),
    ],
  };
}

/** El PDF como Buffer. */
function generar(venta, config, extra) {
  return new Promise((resolver, rechazar) => {
    const doc = impresora.createPdfKitDocument(definicion(venta, config, extra));
    const partes = [];
    doc.on('data', p => partes.push(p));
    doc.on('end', () => resolver(Buffer.concat(partes)));
    doc.on('error', rechazar);
    doc.end();
  });
}

module.exports = { PLANTILLA_VERSION, definicion, generar, SECCIONES };
