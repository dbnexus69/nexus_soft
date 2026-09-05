// Fuente de verdad de las 15 categorías de producto de una venta.
//
// Un mismo slug se usa en: el segmento de URL (/sales/:id/products/<slug>),
// el valor de detalle_venta.categoria en base de datos, y la clave del catálogo.
// El label y la clave de respuesta salen de aquí, no de mapas sueltos.

const PRODUCT_INCLUDES = {
  ticket: {
    prod_tiqueteria: {
      include: {
        tramos_vuelo: { 
          include: {
            aeropuertos_tramos_vuelo_aeropuerto_origen_idToaeropuertos: true,
            aeropuertos_tramos_vuelo_aeropuerto_destino_idToaeropuertos: true,
            aerolineas: true,
            politicas_equipaje: { include: { aerolineas: true } }
          },
          orderBy: { orden: 'asc' }
        },
        aerolineas: true,
        politicas_equipaje: true
      }
    }
  },
  hotel: { prod_hoteleria: true },
  insurance: { prod_seguros: true },
  plan: { prod_planes: { include: { paquetes: true, aerolineas: true } } },
  checkin: { prod_checkins: true },
  migration: { prod_migracion: true },
  simcard: { prod_simcards: true },
  car: { prod_autos: true },
  finca: { prod_fincas: true },
  tour: { prod_tours: true },
  convention: { prod_eventos: true },
  restaurant: { prod_restaurantes: true },
  visa: { prod_visas: true },
  passport: { prod_pasaportes: true },
  pet: { prod_mascotas: true }
};


function mapPassengers(detalle) {
  return (detalle.pasajeros_detalle || []).map(p => ({
    id: p.id,
    persona_id: p.persona_id,
    esTitular: p.es_titular,
    asiento: p.asiento,
    nombreCompleto: p.personas ? `${p.personas.nombres} ${p.personas.apellidos}` : null,
    tipos_documento: p.personas?.tipo_documento_id,
    nroDocumento: p.personas?.documento,
    nroReserva: p.nro_reserva,
    nroTiquete: p.nro_tiquete
  }));
}

const formatColombiaDate = (date) => {
  if (!date) return null;
  const formatter = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' });
  return formatter.format(date);
};

const formatColombiaTime = (date) => {
  if (!date) return null;
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour12: false, hour: '2-digit', minute: '2-digit' });
  return formatter.format(date);
};

function mapLegs(legs) {
  const sorted = [...(legs || [])].sort((a, b) => (a.orden || 0) - (b.orden || 0));
  return sorted.map(l => ({
    origin: l.aeropuertos_tramos_vuelo_aeropuerto_origen_idToaeropuertos?.codigo_iata || null,
    originCity: l.aeropuertos_tramos_vuelo_aeropuerto_origen_idToaeropuertos?.ciudad || null,
    originName: l.aeropuertos_tramos_vuelo_aeropuerto_origen_idToaeropuertos?.nombre || null,
    destination: l.aeropuertos_tramos_vuelo_aeropuerto_destino_idToaeropuertos?.codigo_iata || null,
    destinationCity: l.aeropuertos_tramos_vuelo_aeropuerto_destino_idToaeropuertos?.ciudad || null,
    destinationName: l.aeropuertos_tramos_vuelo_aeropuerto_destino_idToaeropuertos?.nombre || null,
    flightNumber: l.nro_vuelo_tramo,
    seat: l.asiento || null,
    ticketNumber: l.nro_tiquete || null,
    date: formatColombiaDate(l.salida),
    time: formatColombiaTime(l.salida),
    arrivalDate: formatColombiaDate(l.llegada),
    arrivalTime: formatColombiaTime(l.llegada),
    airline: l.aerolineas?.nombre || null,
    baggagePlan: l.politicas_equipaje ? `${l.politicas_equipaje.aerolineas?.nombre || l.aerolineas?.nombre || ''} - ${l.politicas_equipaje.tipo_tarifa}` : null,
    orden: l.orden
  }));
}

const PRODUCT_TRANSFORMS = {
  ticket(d, passengers, target) {
    const t = d.prod_tiqueteria;
    if (!t) return;
    target.push({
      id: t.id,
      airline: String(t.aerolineaId || ''),
      airlineName: t.aerolineas?.nombre || null,
      reservationNumber: t.nro_reserva || '',
      flightNumber: t.nro_vuelo || '',
      ticketNumber: t.nro_tiquete || '',
      flightMode: t.modo_vuelo || 'one_way',
      baggagePlan: String(t.planEquipajeId || ''),
      baggagePlanName: t.politicas_equipaje ? `${t.politicas_equipaje.aerolineas?.nombre || t.aerolineas?.nombre || ''} - ${t.politicas_equipaje.tipo_tarifa}` : null,
      checkinStatus: t.checkin_status || 'pendiente',
      passengers,
      legs: mapLegs(t.tramos_vuelo),
      supplier: d.proveedores?.nombre || null,
      supplierCost: d.costo_proveedor || 0,
      ta: d.ta || 0,
      // Precio del producto. Se expone porque `ta + costo` no siempre lo
      // reconstruye: hay productos guardados con un total explícito y sin
      // desglose de costo, donde esa suma da cero.
      subtotal: d.subtotal || 0,
      parentDetalleId: d.parentDetalleId
    });
  },
  hotel(d, passengers, target) {
    const h = d.prod_hoteleria;
    if (!h) return;
    target.push({
      id: h.id,
      hotelName: h.hotel_nombre,
      hotelType: h.tipo_hotel,
      destination: h.destino,
      reservationNumber: h.nro_reserva,
      startDate: h.fecha_entrada?.toISOString() || null,
      endDate: h.fecha_salida?.toISOString() || null,
      roomType: h.tipo_habitacion,
      roomCount: h.cantidad_habitaciones,
      mealPlan: h.regimen_alimenticio,
      guests: passengers.map(p => ({
        name: p.nombreCompleto,
        docType: String(p.tipos_documento || ''),
        docNumber: p.nroDocumento || ''
      })),
      supplier: d.proveedores?.nombre || null,
      supplierCost: d.costo_proveedor || 0,
      ta: d.ta || 0,
      // Precio del producto. Se expone porque `ta + costo` no siempre lo
      // reconstruye: hay productos guardados con un total explícito y sin
      // desglose de costo, donde esa suma da cero.
      subtotal: d.subtotal || 0,
      parentDetalleId: d.parentDetalleId
    });
  },
  insurance(d, passengers, target) {
    const s = d.prod_seguros;
    if (!s) return;
    target.push({
      id: s.id,
      insuranceType: s.tipo_seguro,
      coverageAmount: s.cobertura_usd,
      coverageDays: s.dias_cobertura,
      startDate: s.fecha_inicio_vigencia?.toISOString() || null,
      endDate: s.fecha_fin_vigencia?.toISOString() || null,
      contactNumber: s.telefono_contacto,
      passengers,
      supplier: d.proveedores?.nombre || null,
      supplierCost: d.costo_proveedor || 0,
      ta: d.ta || 0,
      // Precio del producto. Se expone porque `ta + costo` no siempre lo
      // reconstruye: hay productos guardados con un total explícito y sin
      // desglose de costo, donde esa suma da cero.
      subtotal: d.subtotal || 0,
      parentDetalleId: d.parentDetalleId
    });
  },
  plan(d, passengers, target) {
    const p = d.prod_planes;
    if (!p) return;
    target.push({
      id: p.id,
      packageName: p.paquetes?.nombre || p.nombre_paquete_personalizado,
      destination: p.destino,
      startDate: p.fecha_viaje_inicio?.toISOString() || null,
      endDate: p.fecha_viaje_fin?.toISOString() || null,
      travelersCount: p.adultos_count ? (p.adultos_count + (p.menores_count || 0)) : null,
      includesFlight: p.incluye_vuelo,
      airline: p.aerolineas?.nombre || null,
      includesHotel: p.incluye_hotel,
      hotelName: p.nombre_hotel,
      mealPlan: p.regimen_alimenticio,
      includesTransfers: p.incluye_traslados,
      includesTours: p.incluye_tours,
      includesAssistance: p.incluye_asistencia,
      packageId: p.paqueteId,
      travelers: passengers.map(pax => ({
        name: pax.nombreCompleto,
        docType: String(pax.tipos_documento || ''),
        docNumber: pax.nroDocumento || ''
      })),
      supplier: d.proveedores?.nombre || null,
      supplierCost: d.costo_proveedor || 0,
      ta: d.ta || 0,
      // Precio del producto. Se expone porque `ta + costo` no siempre lo
      // reconstruye: hay productos guardados con un total explícito y sin
      // desglose de costo, donde esa suma da cero.
      subtotal: d.subtotal || 0,
      parentDetalleId: d.parentDetalleId
    });
  },
  checkin(d, passengers, target) {
    const c = d.prod_checkins;
    if (!c) return;
    target.push({
      id: c.id,
      flightOrReservation: c.nro_vuelo_reserva,
      travelDate: c.fecha_viaje?.toISOString() || null,
      seat: c.asiento,
      baggage: c.maletas_contadas,
      phone: c.telefono_contacto,
      specialNeeds: c.necesidades_especiales,
      usesWheelchair: c.usa_silla_ruedas,
      passengers,
      supplier: d.proveedores?.nombre || null,
      supplierCost: d.costo_proveedor || 0,
      ta: d.ta || 0,
      // Precio del producto. Se expone porque `ta + costo` no siempre lo
      // reconstruye: hay productos guardados con un total explícito y sin
      // desglose de costo, donde esa suma da cero.
      subtotal: d.subtotal || 0,
      parentDetalleId: d.parentDetalleId
    });
  },
  migration(d, passengers, target) {
    const m = d.prod_migracion;
    if (!m) return;
    target.push({
      id: m.id,
      requestedDocType: m.tipo_tramite_migratorio,
      nationality: m.nacionalidad,
      docType: m.tipo_documento,
      passportNumber: m.pasaporte_nro,
      passportExpiry: m.pasaporte_vence?.toISOString() || null,
      destinationCountry: m.pais_destino,
      passengers,
      supplier: d.proveedores?.nombre || null,
      supplierCost: d.costo_proveedor || 0,
      ta: d.ta || 0,
      // Precio del producto. Se expone porque `ta + costo` no siempre lo
      // reconstruye: hay productos guardados con un total explícito y sin
      // desglose de costo, donde esa suma da cero.
      subtotal: d.subtotal || 0,
      parentDetalleId: d.parentDetalleId
    });
  },
  simcard(d, passengers, target) {
    const s = d.prod_simcards;
    if (!s) return;
    target.push({
      id: s.id,
      destinationCountry: s.pais_destino,
      arrivalDate: s.fecha_llegada?.toISOString() || null,
      tripDuration: s.duracion_viaje,
      dataPlan: s.plan_datos,
      simType: s.tipo_sim,
      deliveryMethod: s.metodo_entrega,
      passengers,
      supplier: d.proveedores?.nombre || null,
      supplierCost: d.costo_proveedor || 0,
      ta: d.ta || 0,
      // Precio del producto. Se expone porque `ta + costo` no siempre lo
      // reconstruye: hay productos guardados con un total explícito y sin
      // desglose de costo, donde esa suma da cero.
      subtotal: d.subtotal || 0,
      parentDetalleId: d.parentDetalleId
    });
  },
  car(d, passengers, target) {
    const a = d.prod_autos;
    if (!a) return;
    target.push({
      id: a.id,
      mainDriver: a.conductor_nombre,
      licenseNumber: a.licencia_nro,
      pickupDate: a.fecha_recogida?.toISOString() || null,
      returnDate: a.fecha_devolucion?.toISOString() || null,
      pickupLocation: a.lugar_recogida,
      vehicleCategory: a.categoria_auto,
      additionalDrivers: a.conductores_adicionales,
      insuranceType: a.tipo_seguro,
      guaranteeCreditCard: a.tarjeta_garantia_info,
      passengers,
      supplier: d.proveedores?.nombre || null,
      supplierCost: d.costo_proveedor || 0,
      ta: d.ta || 0,
      // Precio del producto. Se expone porque `ta + costo` no siempre lo
      // reconstruye: hay productos guardados con un total explícito y sin
      // desglose de costo, donde esa suma da cero.
      subtotal: d.subtotal || 0,
      parentDetalleId: d.parentDetalleId
    });
  },
  finca(d, passengers, target) {
    const f = d.prod_fincas;
    if (!f) return;
    target.push({
      id: f.id,
      fincaName: f.nombre_finca,
      city: f.ciudad_pueblo,
      address: f.direccion_finca,
      responsibleName: f.responsable_nombre,
      docNumber: f.documento_responsable,
      checkInDate: f.fecha_entrada?.toISOString() || null,
      checkOutDate: f.fecha_salida?.toISOString() || null,
      adultsCount: f.adultos_count,
      childrenCount: f.ninos_count,
      hasPets: f.tiene_mascotas,
      petType: f.tipo_mascota,
      additionalServices: f.servicios_extra,
      observations: f.observaciones,
      passengers,
      supplier: d.proveedores?.nombre || null,
      supplierCost: d.costo_proveedor || 0,
      ta: d.ta || 0,
      // Precio del producto. Se expone porque `ta + costo` no siempre lo
      // reconstruye: hay productos guardados con un total explícito y sin
      // desglose de costo, donde esa suma da cero.
      subtotal: d.subtotal || 0,
      parentDetalleId: d.parentDetalleId
    });
  },
  tour(d, passengers, target) {
    const t = d.prod_tours;
    if (!t) return;
    target.push({
      id: t.id,
      tourName: t.tour_nombre,
      preferredDate: t.fecha_preferida?.toISOString() || null,
      adultsCount: t.adultos_count,
      childrenCount: t.menores_count,
      childrenAges: t.edades_menores,
      guideLanguage: t.idioma_guia,
      needsTransport: t.requiere_transporte,
      pickupPoint: t.punto_encuentro,
      medicalConditions: t.condiciones_medicas,
      phone: t.telefono_contacto,
      observations: t.observaciones,
      guests: passengers,
      // El detalle muestra un "Nombre Pasajero": se toma el titular, y si no
      // hay ninguno marcado, el primero de la lista.
      passengerName: (passengers.find(p => p.esTitular) || passengers[0])?.nombreCompleto || null,
      supplier: d.proveedores?.nombre || null,
      supplierCost: d.costo_proveedor || 0,
      ta: d.ta || 0,
      // Precio del producto. Se expone porque `ta + costo` no siempre lo
      // reconstruye: hay productos guardados con un total explícito y sin
      // desglose de costo, donde esa suma da cero.
      subtotal: d.subtotal || 0,
      parentDetalleId: d.parentDetalleId
    });
  },
  convention(d, passengers, target) {
    const e = d.prod_eventos;
    if (!e) return;
    target.push({
      id: e.id,
      organization: e.organizacion,
      contactName: e.nombre_contacto,
      email: e.email_contacto,
      startDate: e.fechaInicio?.toISOString() || null,
      endDate: e.fechaFin?.toISOString() || null,
      estimatedAttendance: e.asistencia_estimada,
      requiredSpace: e.espacio_requerido,
      eventType: e.tipo_evento,
      avEquipment: e.equipos_av,
      hasCatering: e.requiere_catering,
      cateringNotes: e.notas_catering,
      venueName: e.nombre_lugar,
      city: e.ciudad,
      address: e.direccion,
      passengers,
      supplier: d.proveedores?.nombre || null,
      supplierCost: d.costo_proveedor || 0,
      ta: d.ta || 0,
      // Precio del producto. Se expone porque `ta + costo` no siempre lo
      // reconstruye: hay productos guardados con un total explícito y sin
      // desglose de costo, donde esa suma da cero.
      subtotal: d.subtotal || 0,
      parentDetalleId: d.parentDetalleId
    });
  },
  restaurant(d, passengers, target) {
    const r = d.prod_restaurantes;
    if (!r) return;
    target.push({
      id: r.id,
      reservationName: r.nombre_reserva,
      dateTime: r.fecha_hora_reserva?.toISOString() || null,
      peopleCount: r.personas_count,
      tablePreference: r.preferencia_mesa,
      menuType: r.tipo_menu,
      dietaryRestrictions: r.restricciones_dieta,
      specialOccasion: r.ocasion_especial,
      phone: r.telefono_contacto,
      passengers,
      supplier: d.proveedores?.nombre || null,
      supplierCost: d.costo_proveedor || 0,
      ta: d.ta || 0,
      // Precio del producto. Se expone porque `ta + costo` no siempre lo
      // reconstruye: hay productos guardados con un total explícito y sin
      // desglose de costo, donde esa suma da cero.
      subtotal: d.subtotal || 0,
      parentDetalleId: d.parentDetalleId
    });
  },
  visa(d, passengers, target) {
    const v = d.prod_visas;
    if (!v) return;
    target.push({
      id: v.id,
      fullName: v.nombre_completo,
      birthDate: v.fecha_nacimiento?.toISOString() || null,
      nationality: v.nacionalidad,
      docType: v.tipo_documento,
      passportNumber: v.nro_pasaporte,
      passportExpiry: v.vencimiento_pasaporte?.toISOString() || null,
      countryApplying: v.pais_aplicacion,
      visaType: v.tipo_visa,
      estimatedTravelDate: v.fecha_estimada_viaje?.toISOString() || null,
      email: v.email_contacto,
      passengers,
      supplier: d.proveedores?.nombre || null,
      supplierCost: d.costo_proveedor || 0,
      ta: d.ta || 0,
      // Precio del producto. Se expone porque `ta + costo` no siempre lo
      // reconstruye: hay productos guardados con un total explícito y sin
      // desglose de costo, donde esa suma da cero.
      subtotal: d.subtotal || 0,
      parentDetalleId: d.parentDetalleId
    });
  },
  passport(d, passengers, target) {
    const p = d.prod_pasaportes;
    if (!p) return;
    target.push({
      id: p.id,
      fullName: p.nombre_completo,
      idNumber: p.nro_documento,
      birthDate: p.fecha_nacimiento?.toISOString() || null,
      residenceCity: p.ciudad_residencia,
      // El modal de detalle lee processType; se mantiene tramiteType por si
      // algún consumidor antiguo lo espera.
      processType: p.tipo_tramite,
      tramiteType: p.tipo_tramite,
      estimatedTravelDate: p.fecha_estimada_viaje?.toISOString() || null,
      phone: p.telefono_contacto,
      passengers,
      supplier: d.proveedores?.nombre || null,
      supplierCost: d.costo_proveedor || 0,
      ta: d.ta || 0,
      // Precio del producto. Se expone porque `ta + costo` no siempre lo
      // reconstruye: hay productos guardados con un total explícito y sin
      // desglose de costo, donde esa suma da cero.
      subtotal: d.subtotal || 0,
      parentDetalleId: d.parentDetalleId
    });
  },
  pet(d, passengers, target) {
    const m = d.prod_mascotas;
    if (!m) return;
    target.push({
      id: m.id,
      petName: m.mascota_nombre,
      species: m.especie,
      breed: m.raza,
      weight: m.peso_kg,
      size: m.tamanoMascota,
      // El modal lee travelType (cómo viaja); transportType queda como alias.
      travelType: m.transporte_tipo,
      transportType: m.transporte_tipo,
      travelDate: m.fecha_viaje?.toISOString() || null,
      destinationCountry: m.pais_destino,
      medicalConditions: m.condiciones_medicas,
      phone: m.telefono_contacto,
      transportCompany: m.empresa_transporte,
      observations: m.observaciones,
      passengers,
      supplier: d.proveedores?.nombre || null,
      supplierCost: d.costo_proveedor || 0,
      ta: d.ta || 0,
      // Precio del producto. Se expone porque `ta + costo` no siempre lo
      // reconstruye: hay productos guardados con un total explícito y sin
      // desglose de costo, donde esa suma da cero.
      subtotal: d.subtotal || 0,
      parentDetalleId: d.parentDetalleId
    });
  }
};

// ── Metadatos de cada categoría ─────────────────────────────────────────────
// canBeChild: puede ir dentro de un plan (vuelos, hotelería y seguros).
const META = {
  ticket:     { label: 'Tiquetería',    responseKey: 'ticketData',      canBeChild: true  },
  hotel:      { label: 'Hotelería',     responseKey: 'hotelData',       canBeChild: true  },
  insurance:  { label: 'Seguro',        responseKey: 'insuranceData',   canBeChild: true  },
  plan:       { label: 'Plan',          responseKey: 'planData',        canBeChild: false },
  checkin:    { label: 'Check-in',      responseKey: 'checkInData',     canBeChild: false },
  migration:  { label: 'Migración',     responseKey: 'migrationData',   canBeChild: false },
  simcard:    { label: 'SIM Card',      responseKey: 'simCardData',     canBeChild: false },
  car:        { label: 'Renta de Auto', responseKey: 'carRentalData',   canBeChild: false },
  finca:      { label: 'Finca',         responseKey: 'fincaData',       canBeChild: false },
  tour:       { label: 'Tour',          responseKey: 'tourData',        canBeChild: false },
  convention: { label: 'Evento',        responseKey: 'conventionData',  canBeChild: false },
  restaurant: { label: 'Restaurante',   responseKey: 'restaurantData',  canBeChild: false },
  visa:       { label: 'Visa',          responseKey: 'visaData',        canBeChild: false },
  passport:   { label: 'Pasaporte',     responseKey: 'passportData',    canBeChild: false },
  pet:        { label: 'Mascota',       responseKey: 'petServiceData',  canBeChild: false }
};

// ── Catálogo unificado ──────────────────────────────────────────────────────
const CATALOG = {};
for (const slug of Object.keys(META)) {
  const include = PRODUCT_INCLUDES[slug];
  CATALOG[slug] = {
    slug,
    ...META[slug],
    include,
    relationKey: Object.keys(include)[0],
    transform: PRODUCT_TRANSFORMS[slug]
  };
}

const SLUGS = Object.keys(CATALOG);
const CHILD_SLUGS = SLUGS.filter(s => CATALOG[s].canBeChild);

function get(slug) { return CATALOG[slug] || null; }
function labelOf(slug) { return CATALOG[slug] ? CATALOG[slug].label : slug; }

module.exports = {
  CATALOG, SLUGS, CHILD_SLUGS, META,
  PRODUCT_INCLUDES, PRODUCT_TRANSFORMS,
  get, labelOf,
  mapPassengers, mapLegs
};
