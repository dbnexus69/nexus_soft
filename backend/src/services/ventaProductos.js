const { randomUUID: uuidv4 } = require('crypto');
const { enHoraColombia } = require('../utils/fechas');
const { datosFinancieros } = require('./saleTotals');
const { normalizarDocumento } = require('../utils/datosPersona');

// Lo que `createSale` escribe de los productos de una venta, agrupado por tabla.
//
// Antes cada línea, cada detalle, cada tramo y cada pasajero era su propio `create`: una ida y vuelta al
// pooler de Supabase (0,6–1,2 s) por fila, en serie y dentro de la transacción. Una venta de grupo tardaba
// ~40 s y hubo que subir el tope a 120 s (spec 004 T9). Todos los ids se generan aquí, así que no hay nada
// que leer entre una fila y otra: se acumulan las filas y se escribe UNA vez por tabla (`createMany`).
// El número de viajes ya no depende del tamaño de la venta (spec 010 T5).

// El selector de tamaño de mascota envía "pequeño" con eñe, pero el enum
// TamanoMascota de Postgres es `pequeno`. Un valor fuera del enum hace fallar
// el insert entero, así que se normaliza aquí.
const TAMANOS_MASCOTA = { pequeno: 'pequeno', 'pequeño': 'pequeno', mediano: 'mediano', grande: 'grande', gigante: 'gigante' };
function normalizarTamanoMascota(valor) {
  if (!valor) return null;
  return TAMANOS_MASCOTA[String(valor).trim().toLowerCase()] || null;
}

const fecha = (v) => (v ? new Date(v) : null);

// La reserva va por pasajero (spec 012): la del titular, o la de arriba en un borrador de antes del cambio.
const titularDe = (t) => (t.passengers || []).find(p => p?.esTitular) || (t.passengers || [])[0];
const reservaDelTitular = (t) => titularDe(t)?.nroReserva || t.reservationNumber || null;
const asientosDe = (p) => {
  const lista = (Array.isArray(p?.asientos) ? p.asientos : [])
    .filter(a => a && String(a.asiento || '').trim())
    .map(a => ({ tramo: Number(a.tramo), asiento: String(a.asiento).trim().toUpperCase() }));
  return lista.length ? lista : null;
};
const unaPersona = (name, docType, docNumber, extra = {}) => ({ name, docType, docNumber, extra });
const invitados = (lista) => (lista || []).map(g => unaPersona(g.name, g.docType, g.docNumber, { es_titular: false }));

// Una entrada por categoría, en el orden en que se escriben (los planes primero: sus hijos se cuelgan de ellos).
//  - `proveedor`: el campo del cuerpo que trae el nombre del proveedor (tiquete, hotel, seguro y plan usan `supplier`).
//  - `linea`: columnas extra de `detalle_venta`.   - `fila(x, c)`: la fila de la tabla propia de la categoría.
//  - `personas(x)`: quién viaja o se hospeda.   - `tramos(x, id, c)`: solo los tiquetes.
const CATEGORIAS = [
  {
    campo: 'planData', categoria: 'plan', tabla: 'prod_planes', proveedor: 'supplier', sinPadre: true,
    fila: (p, c) => ({
      nombre_plan: p.planName || null, nombre_hotel: p.hotelName || null,
      aerolineaId: c.aerolineaId(p.airline),
      nro_vuelo: p.flightNumber || null, nro_reserva: p.reservationNumber || null,
      nro_tiquete: p.ticketNumber || null,
      fecha_viaje_inicio: fecha(p.startDate),
      fecha_viaje_fin: fecha(p.endDate),
      // Las cuatro fechas de vuelo se perdían aquí. El asistente las exige —no deja continuar sin la de ida y la
      // de vuelta—, y un plan vendido sin ellas nacía sin vuelos: ni en el itinerario, ni en los check-ins, ni en
      // el detalle. En hora de Colombia, igual que los tramos: con `new Date('2026-11-01')` el vuelo se muestra el
      // día anterior en cuanto el servidor no está en Bogotá.
      fecha_salida_vuelo: enHoraColombia(p.flightDepartureDate),
      fecha_llegada_vuelo: enHoraColombia(p.flightDepartureArrivalDate),
      fecha_regreso_vuelo: enHoraColombia(p.flightReturnDate),
      fecha_llegada_regreso_vuelo: enHoraColombia(p.flightReturnArrivalDate),
      paquete_tarifa_id: p.packageRateId ? Number(p.packageRateId) : null,
      paqueteId: p.packageId ? Number(p.packageId) : null,
      numero_confirmacion: p.confirmationNumber || null,
      tipo_paquete: p.packageType || 'own',
      tipo_transporte: p.transportType || 'Aereo',
      adultos_count: Number(p.adultsCount || 1),
      menores_count: Number(p.childrenCount || 0),
      observaciones: p.observations || null,
    }),
    personas: (p) => invitados(p.guests),
  },
  {
    campo: 'ticketData', categoria: 'ticket', tabla: 'prod_tiqueteria', proveedor: 'supplier',
    linea: (t) => ({
      observaciones: t.observations || null,
      origen: t.legs?.[0]?.origin || null,
      destino: t.legs?.[t.legs.length - 1]?.destination || null,
    }),
    fila: (t, c) => ({
      aerolineaId: c.aerolineaId(t.airline),
      nro_reserva: reservaDelTitular(t),
      nro_vuelo: t.flightNumber || null,
      nro_tiquete: t.passengers?.[0]?.nroTiquete || null,
      modo_vuelo: t.flightMode || 'one_way',
      checkin_status: 'pendiente',
      planEquipajeId: c.planEquipajeId(t.baggagePlan),
    }),
    personas: (t) => (t.passengers || []).map(pax => unaPersona(pax.name, pax.docType, pax.docNumber, {
      es_titular: pax.esTitular || false,
      // Sin reserva propia, la del titular: casi siempre van en la misma.
      nro_reserva: pax.nroReserva || reservaDelTitular(t),
      nro_tiquete: pax.nroTiquete || null,
      asientos: asientosDe(pax) ?? undefined,
    })),
    tramos: (t, ticketId, c) => {
      const todos = [...(t.legs || []), ...(t.outboundStops || []), ...(t.returnLeg ? [t.returnLeg] : []), ...(t.returnStops || [])];
      const aerolineaDelTiquete = c.aerolineaId(t.airline);
      const filas = [];
      todos.forEach((leg, i) => {
        if (!leg || !leg.origin || !leg.destination) return;
        // `enHoraColombia` en vez de `new Date('...T06:40:00')`: esa forma, sin designador de zona, se interpreta
        // como hora LOCAL DEL PROCESO, así que el instante guardado dependía de dónde corriera el servidor. En un
        // servidor UTC los vuelos se corrían cinco horas y los de madrugada cambiaban de día.
        const salida = enHoraColombia(leg.date, leg.departureTime || leg.time) || new Date();
        // Sin hora de llegada se asume una hora de vuelo, como antes.
        const llegada = enHoraColombia(leg.arrivalDate, leg.arrivalTime) || new Date(salida.getTime() + 3600000);
        filas.push({
          id: uuidv4(), prod_tiqueteria_id: ticketId,
          // Del mapa precargado; que existan ya se comprobó en `_validarTiquetes`.
          aeropuerto_origen_id: c.aeropuertoId(leg.origin),
          aeropuerto_destino_id: c.aeropuertoId(leg.destination),
          salida, llegada,
          nro_vuelo_tramo: leg.flightNumber || null,
          // El asiento es de cada pasajero en cada tramo (spec 012, `pasajeros_detalle.asientos`).
          orden: i + 1,
          nro_tiquete: leg.ticketNumber || null,
          aerolinea_id: leg.airline && leg.airline !== t.airline ? (c.aerolineaId(leg.airline) ?? aerolineaDelTiquete) : aerolineaDelTiquete,
          plan_equipaje_id: c.planEquipajeId(leg.baggagePlan) ?? c.planEquipajeId(t.baggagePlan),
        });
      });
      return filas;
    },
  },
  {
    campo: 'hotelData', categoria: 'hotel', tabla: 'prod_hoteleria', proveedor: 'supplier',
    linea: (h) => ({ destino: h.destination || null }),
    fila: (h) => ({
      hotel_nombre: h.hotelName || null, tipo_hotel: h.hotelType === 'finca' ? 'fincas' : (h.hotelType || 'hotel'),
      destino: h.destination || null, nro_reserva: h.reservationNumber || null,
      fecha_entrada: fecha(h.startDate), fecha_salida: fecha(h.endDate),
      observaciones: h.observations || null,
    }),
    personas: (h) => invitados(h.guests),
  },
  {
    campo: 'insuranceData', categoria: 'insurance', tabla: 'prod_seguros', proveedor: 'supplier',
    fila: (s) => ({
      tipo_seguro: s.insuranceType || null,
      cobertura_usd: Number(s.coverage || 0),
      dias_cobertura: Number(s.coverageDays || 0),
      fecha_inicio_vigencia: fecha(s.startDate), fecha_fin_vigencia: fecha(s.endDate),
      telefono_contacto: s.phone || null,
    }),
    personas: (s) => invitados(s.members),
  },
  {
    campo: 'checkInData', categoria: 'checkin', tabla: 'prod_checkins',
    fila: (c) => ({
      nro_vuelo_reserva: c.flightOrReservation || null, fecha_viaje: fecha(c.travelDate),
      asiento: c.seat || null, maletas_contadas: c.baggage || null,
      telefono_contacto: c.phone || null, necesidades_especiales: c.specialNeeds || null,
    }),
    personas: (c) => (c.passengerName ? [unaPersona(c.passengerName, c.docType, c.docNumber, { es_titular: true })] : []),
  },
  {
    campo: 'migrationData', categoria: 'migration', tabla: 'prod_migracion',
    fila: (m) => ({
      tipo_tramite_migratorio: m.requestedDocType || null, nacionalidad: m.nationality || null,
      tipo_documento: m.docType || 'Pasaporte', pasaporte_nro: m.docNumber || null,
      pasaporte_vence: fecha(m.passportExpiry), pais_destino: m.destinationCountry || null,
    }),
  },
  {
    campo: 'simCardData', categoria: 'simcard', tabla: 'prod_simcards',
    fila: (s) => ({
      pais_destino: s.destinationCountry || null, fecha_llegada: fecha(s.arrivalDate),
      duracion_viaje: s.tripDuration ? String(s.tripDuration) : null,
      plan_datos: s.dataPlan || null, tipo_sim: s.simType || null, metodo_entrega: s.deliveryMethod || null,
    }),
  },
  {
    campo: 'carRentalData', categoria: 'car', tabla: 'prod_autos',
    fila: (c) => ({
      conductor_nombre: c.mainDriver || null, licencia_nro: c.licenseNumber || null,
      fecha_recogida: fecha(c.pickupDate), fecha_devolucion: fecha(c.returnDate),
      lugar_recogida: c.pickupLocation || null, categoria_auto: c.vehicleCategory || null,
      conductores_adicionales: Number(c.additionalDrivers || 0),
      tipo_seguro: c.insuranceType || null, tarjeta_garantia_info: c.guaranteeCreditCard || null,
    }),
  },
  {
    campo: 'fincaData', categoria: 'finca', tabla: 'prod_fincas',
    fila: (f) => ({
      nombre_finca: f.fincaName || null, ciudad_pueblo: f.city || null, direccion_finca: f.address || null,
      responsable_nombre: f.responsibleName || null, documento_responsable: f.docNumber || null,
      fecha_entrada: fecha(f.checkInDate), fecha_salida: fecha(f.checkOutDate),
      adultos_count: Number(f.adultsCount || 1), ninos_count: Number(f.childrenCount || 0),
      tiene_mascotas: Boolean(f.hasPets), tipo_mascota: f.petType || null,
      observaciones: f.observations || null,
    }),
  },
  {
    campo: 'tourData', categoria: 'tour', tabla: 'prod_tours',
    fila: (t) => ({
      tour_nombre: t.selectedTour || null, fecha_preferida: fecha(t.preferredDate),
      adultos_count: Number(t.adultsCount || 1), menores_count: Number(t.childrenCount || 0),
      edades_menores: t.childrenAges || null, idioma_guia: t.guideLanguage || null,
      requiere_transporte: t.needsTransport ?? false, punto_encuentro: t.pickupPoint || null,
      condiciones_medicas: t.medicalConditions || null, observaciones: t.observations || null,
      telefono_contacto: t.phone || null,
    }),
    personas: (t) => invitados(t.guests),
  },
  {
    campo: 'conventionData', categoria: 'convention', tabla: 'prod_eventos',
    fila: (c) => ({
      organizacion: c.organization || null, nombre_contacto: c.contactName || null,
      email_contacto: c.email || null,
      fechaInicio: fecha(c.startDate), fechaFin: fecha(c.endDate),
      asistencia_estimada: Number(c.estimatedAttendance || 0),
      espacio_requerido: c.requiredSpace || null, tipo_evento: c.eventType || null,
      equipos_av: c.avEquipment?.join(', ') || null,
      requiere_catering: c.hasCatering || false, notas_catering: c.cateringNotes || null,
      nombre_lugar: c.venueName || null, ciudad: c.city || null, direccion: c.address || null,
    }),
  },
  {
    campo: 'restaurantData', categoria: 'restaurant', tabla: 'prod_restaurantes',
    fila: (r) => ({
      nombre_reserva: r.reservationName || null, fecha_hora_reserva: fecha(r.dateTime),
      personas_count: Number(r.peopleCount || 1), preferencia_mesa: r.tablePreference || null,
      tipo_menu: r.menuType || null, restricciones_dieta: r.dietaryRestrictions?.join(', ') || null,
      ocasion_especial: r.specialOccasion || null, telefono_contacto: r.phone || null,
    }),
  },
  {
    campo: 'visaData', categoria: 'visa', tabla: 'prod_visas',
    fila: (v) => ({
      nombre_completo: v.fullName || null, nacionalidad: v.nationality || null,
      tipo_documento: v.docType || 'Pasaporte', nro_pasaporte: v.docNumber || null,
      vencimiento_pasaporte: fecha(v.passportExpiration),
      pais_aplicacion: v.countryApplying || null, tipo_visa: v.visaType || null,
      fecha_estimada_viaje: fecha(v.estimatedTravelDate), email_contacto: v.email || null,
    }),
  },
  {
    campo: 'passportData', categoria: 'passport', tabla: 'prod_pasaportes',
    fila: (p) => ({
      nombre_completo: p.fullName || null,
      // El formulario envía idNumber y processType; se aceptan ambos nombres.
      nro_documento: p.idNumber || p.docNumber || null,
      ciudad_residencia: p.residenceCity || null,
      tipo_tramite: p.processType || p.tramiteType || null,
      fecha_nacimiento: fecha(p.birthDate), fecha_estimada_viaje: fecha(p.estimatedTravelDate),
      telefono_contacto: p.phone || null,
    }),
  },
  {
    campo: 'petServiceData', categoria: 'pet', tabla: 'prod_mascotas',
    fila: (m) => ({
      mascota_nombre: m.petName || null, especie: m.species || null,
      raza: m.breed || null, peso_kg: Number(m.weight || 0),
      // tamanoMascota es un enum de Postgres sin eñe y el formulario envía "pequeño": hay que normalizarlo.
      tamanoMascota: normalizarTamanoMascota(m.size),
      // travelType es cómo viaja (cabina/bodega/terrestre) y transportCompany la empresa: dos columnas distintas.
      transporte_tipo: m.travelType || null, empresa_transporte: m.transportCompany || null,
      fecha_viaje: fecha(m.travelDate), pais_destino: m.destinationCountry || null,
      condiciones_medicas: m.medicalConditions || null, observaciones: m.observations || null,
      telefono_contacto: m.phone || null,
    }),
  },
];

/**
 * Escribe todos los productos de la venta, a razón de una inserción por tabla.
 * Pone en cada producto del cuerpo su `_generatedId` (la línea de `detalle_venta`), que la respuesta devuelve
 * para subir los vouchers. Dentro de la transacción de `createSale`.
 */
async function escribirProductos(tx, { ventaId, body, catalogos, tarjetaDe, planEquipajeId, tipoDocumento }) {
  const norm = (v) => String(v).trim().toUpperCase();
  const ctx = {
    planEquipajeId,
    aeropuertoId: (codigo) => catalogos.aeropuertos.get(norm(codigo)),
    // Del catálogo precargado: igualdad de nombre sin distinguir mayúsculas.
    aerolineaId: (nombre) => {
      if (!nombre) return null;
      const buscado = String(nombre).toLowerCase();
      return catalogos.aerolineas.find(x => (x.nombre || '').toLowerCase().includes(buscado))?.id ?? null;
    },
  };
  const proveedorId = (nombre) => {
    if (!nombre) return null;
    const buscado = String(nombre).toLowerCase();
    return catalogos.proveedores.find(x => (x.nombre || '').toLowerCase() === buscado)?.id ?? null;
  };

  const filas = { detalle_venta: [], tramos_vuelo: [], pasajeros_detalle: [] };
  const personas = new Map(); // clave -> persona por crear; las ya conocidas están en `ids`
  const ids = new Map([...catalogos.personas].map(([doc, id]) => [`d:${doc}`, id]));

  // La clave de una persona: su documento, o una única si no tiene. Dos pasajeros con el mismo documento en la
  // misma venta comparten la persona en vez de duplicarla.
  const clavePersona = (name, docType, docNumber) => {
    if (!name && !docNumber) return null;
    const doc = docNumber ? normalizarDocumento(docNumber) : null;
    const clave = doc ? `d:${doc}` : `n:${personas.size}`;
    if (!ids.has(clave) && !personas.has(clave)) {
      const partes = (name || '').trim().split(' ');
      personas.set(clave, {
        nombres: partes.slice(0, Math.ceil(partes.length / 2)).join(' ') || name || '',
        apellidos: partes.slice(Math.ceil(partes.length / 2)).join(' ') || '',
        documento: doc,
        tipo_documento_id: tipoDocumento(docType)?.id ?? null,
      });
    }
    return clave;
  };

  for (const cat of CATEGORIAS) {
    const lista = Array.isArray(body[cat.campo]) ? body[cat.campo] : [];
    if (cat.tabla) filas[cat.tabla] = [];
    for (const x of lista) {
      const detalleId = uuidv4();
      x._generatedId = detalleId;
      // Los hijos de un plan (`linkedToPlanIndex`) se cuelgan de su línea; los planes se escriben antes.
      const padre = cat.sinPadre ? undefined : body.planData?.[x?.linkedToPlanIndex]?._generatedId;
      filas.detalle_venta.push({
        id: detalleId, venta_id: ventaId, categoria: cat.categoria, tarjeta_proveedor_id: tarjetaDe(x),
        ...(cat.sinPadre ? {} : { parentDetalleId: padre ?? null }),
        ...datosFinancieros(x),
        ...(cat.linea ? cat.linea(x) : {}),
        proveedor_id: proveedorId(x[cat.proveedor || 'supplierName']),
      });
      const propioId = uuidv4();
      filas[cat.tabla].push({ id: propioId, detalle_venta_id: detalleId, ...cat.fila(x, ctx) });
      if (cat.tramos) filas.tramos_vuelo.push(...cat.tramos(x, propioId, ctx));
      for (const p of (cat.personas ? cat.personas(x) : [])) {
        const clave = clavePersona(p.name, p.docType, p.docNumber);
        if (clave) filas.pasajeros_detalle.push({ id: uuidv4(), detalle_venta_id: detalleId, _persona: clave, ...p.extra });
      }
    }
  }

  // Las personas nuevas. Con documento: `skipDuplicates` (ON CONFLICT DO NOTHING) y una lectura después, que es
  // lo que hacía el `upsert` —si alguien la creó entre la precarga y aquí, se reutiliza en vez de reventar la
  // venta con un 409—. Sin documento no hay con qué identificarla, así que se crea y se leen los ids.
  const nuevas = [...personas];
  const conDoc = nuevas.filter(([, p]) => p.documento);
  const sinDoc = nuevas.filter(([, p]) => !p.documento);
  if (conDoc.length) {
    await tx.personas.createMany({ data: conDoc.map(([, p]) => p), skipDuplicates: true });
    const halladas = await tx.personas.findMany({
      where: { documento: { in: conDoc.map(([, p]) => p.documento) } },
      select: { id: true, documento: true },
    });
    for (const h of halladas) ids.set(`d:${h.documento}`, h.id);
  }
  if (sinDoc.length) {
    const creadas = await tx.personas.createManyAndReturn({ data: sinDoc.map(([, p]) => p), select: { id: true } });
    sinDoc.forEach(([clave], i) => ids.set(clave, creadas[i].id));
  }
  for (const f of filas.pasajeros_detalle) {
    f.persona_id = ids.get(f._persona);
    delete f._persona;
  }

  // En el orden de las claves ajenas: la línea, luego lo que cuelga de ella.
  const orden = ['detalle_venta', ...CATEGORIAS.map(c => c.tabla), 'tramos_vuelo', 'pasajeros_detalle'];
  for (const tabla of orden) {
    if (filas[tabla]?.length) await tx[tabla].createMany({ data: filas[tabla] });
  }
}

module.exports = { escribirProductos };
