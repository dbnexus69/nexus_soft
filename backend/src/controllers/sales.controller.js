const prisma = require('../config/db');
const { success, error } = require('../utils/apiResponse');
const { buildMeta } = require('../utils/paginationHelper');
const emailService = require('../utils/emailService');

exports.list = async (req, res, next) => {
  try {
    const { page, perPage, skip } = req.pagination;
    const { search, sortBy, sortOrder } = req;
    const { status, asesorId, clientId, dateFrom, dateTo } = req.query;

    let searchCondition = '';
    if (search) searchCondition = `AND v.observaciones ILIKE '%${search}%'`;
    let statusCondition = '';
    if (status) statusCondition = `AND v.status = '${status}'`;
    let asesorCondition = '';
    if (asesorId) asesorCondition = `AND v.usuario_id = ${parseInt(asesorId)}`;
    let clientCondition = '';
    if (clientId) clientCondition = `AND v.cliente_id = ${parseInt(clientId)}`;
    let dateCondition = '';
    if (dateFrom) dateCondition += ` AND v.creado_at >= '${new Date(dateFrom).toISOString()}'`;
    if (dateTo) dateCondition += ` AND v.creado_at <= '${new Date(dateTo).toISOString()}'`;
    
    if (req.permissionScope === 'own') {
      asesorCondition += ` AND v.usuario_id = ${req.user.id}`;
    }

    const where = {};
    if (search) where.observaciones = { contains: search, mode: 'insensitive' };
    if (status) where.status = status;
    if (asesorId) where.usuarioId = parseInt(asesorId);
    if (clientId) where.clienteId = parseInt(clientId);
    if (dateFrom || dateTo) {
      where.creadoAt = {};
      if (dateFrom) where.creadoAt.gte = new Date(dateFrom);
      if (dateTo) where.creadoAt.lte = new Date(dateTo);
    }
    if (req.permissionScope === 'own') {
      where.usuarioId = req.user.id;
    }

    const sortFieldMap = { 'creadoAt': 'creadoAt', 'date': 'creadoAt', 'total': 'montoTotal', 'status': 'status', 'clientName': 'clienteId' };
    const effectiveSortBy = sortFieldMap[sortBy] || 'creadoAt';
    const sqlOrderBy = effectiveSortBy === 'montoTotal' ? 'v.monto_total' : (effectiveSortBy === 'status' ? 'v.status' : 'v.creado_at');

    const [total, ventasRaw] = await Promise.all([
      prisma.ventas.count({ where }),
      prisma.$queryRawUnsafe(`
        SELECT 
          v.id,
          v.cliente_id as "clienteId",
          v.usuario_id as "usuarioId",
          v.creado_at as "creadoAt",
          v.monto_total as "montoTotal",
          v.status,
          v.observaciones,
          v.es_credito as "esCredito",
          v.fecha_vence_credito as "fechaVenceCredito",
          v.monto_pagado_credito as "montoPagadoCredito",
          v.is_reviewed as "isReviewed",
          v.comisionista_id as "comisionistaId",
          v.monto_comision_bruto as "montoComisionBruto",
          v.monto_comision_neto as "montoComisionNeto",
          v.costo_proveedor_total as "costoProveedorTotal",
          v.ta_total as "taTotal",
          v.comision_liquidada as "comisionLiquidada",
          v.responsable_id as "responsableId",
          cp.nombres || ' ' || cp.apellidos as "clientName",
          cp.email as "clientEmail",
          cp.avatar_url as "clientAvatar",
          up.nombres || ' ' || up.apellidos as "asesorName",
          comp.nombres || ' ' || comp.apellidos as "commissionAgentName",
          
          COALESCE((
            SELECT json_agg(json_build_object(
              'id', p.id,
              'fechaPago', p.fecha_pago,
              'monto', p.monto,
              'metodoPago', (SELECT json_build_object('nombre', mp.nombre) FROM metodos_pago mp WHERE mp.id = p.metodo_pago_id)
            ))
            FROM pagos_venta p WHERE p.venta_id = v.id
          ), '[]'::json) as "pagosVenta",

          COALESCE((
            SELECT json_agg(json_build_object(
              'categoria', dv.categoria,
              'nombreServicio', dv.nombre_servicio,
              'origen', dv.origen,
              'destino', dv.destino,
              'pasajerosDetalle', COALESCE((
                SELECT json_agg(json_build_object(
                  'persona', (SELECT json_build_object('nombres', paxp.nombres, 'apellidos', paxp.apellidos) FROM personas paxp WHERE paxp.id = pd.persona_id)
                ))
                FROM pasajeros_detalle pd WHERE pd.detalle_venta_id = dv.id
              ), '[]'::json)
            ))
            FROM detalle_venta dv WHERE dv.venta_id = v.id
          ), '[]'::json) as "detalleVentas"

        FROM ventas v
        JOIN clientes c ON v.cliente_id = c.id
        JOIN personas cp ON c.persona_id = cp.id
        JOIN usuarios u ON v.usuario_id = u.id
        JOIN personas up ON u.persona_id = up.id
        LEFT JOIN comisionistas com ON v.comisionista_id = com.id
        LEFT JOIN personas comp ON com.persona_id = comp.id
        WHERE 1=1 ${searchCondition} ${statusCondition} ${asesorCondition} ${clientCondition} ${dateCondition}
        ORDER BY ${sqlOrderBy} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}
        LIMIT ${perPage} OFFSET ${skip}
      `)
    ]);

    const data = ventasRaw.map(v => {
      // Build a lightweight services summary from detalleVentas
      const servicesSummary = (v.detalleVentas || []).map(d => {
        const tipo = d.categoria;
        let label = tipo;
        let detail = null;

        const labelMap = {
          tiqueteria: 'Tiquetería',
          hoteleria: 'Hotelería',
          seguros: 'Seguro',
          planes: 'Plan',
          checkin: 'Check-in',
          migracion: 'Migración',
          simcard: 'SIM Card',
          autos: 'Renta de Auto',
          fincas: 'Finca',
          tours: 'Tour',
          eventos: 'Evento',
          restaurantes: 'Restaurante',
          visas: 'Visa',
          pasaportes: 'Pasaporte',
          mascotas: 'Mascota'
        };

        if (labelMap[tipo]) {
          label = labelMap[tipo];
        }

        // Build elegant detail based on generic fields
        const route = (d.origen && d.destino) ? `${d.origen}→${d.destino}` : null;
        const pax = d.pasajerosDetalle?.[0]?.persona;
        const paxName = pax ? `${pax.nombres} ${pax.apellidos}` : null;

        if (tipo === 'tiqueteria') {
          detail = [route, paxName].filter(Boolean).join(' · ');
        } else {
          // For other services, use nombreServicio if it's different from the generic label, or route/pax
          const hasCustomName = d.nombreServicio && d.nombreServicio !== label;
          detail = [
            hasCustomName ? d.nombreServicio : null,
            route,
            paxName
          ].filter(Boolean).join(' · ');
        }

        return { tipo, label, detail: detail || null };
      });

      return {
        id: v.id,
        clientId: v.clienteId,
        clientName: v.clientName,
        clientEmail: v.clientEmail,
        clientAvatar: v.clientAvatar,
        responsableId: v.responsableId,
        asesorId: v.usuarioId,
        asesorName: v.asesorName,
        date: v.creadoAt,
        total: v.montoTotal,
        status: v.status,
        observations: v.observaciones,
        isCredit: v.esCredito,
        creditDueDate: v.fechaVenceCredito,
        creditPaidAmount: v.montoPagadoCredito,
        isReviewed: v.isReviewed,
        commissionAgentId: v.comisionistaId,
        commissionAgentName: v.commissionAgentName,
        commissionAgentAmount: v.montoComisionBruto,
        commissionAgentNetPayment: v.montoComisionNeto,
        supplierCost: v.costoProveedorTotal,
        ta: v.taTotal,
        isSettled: v.comisionLiquidada,
        payments: (v.pagosVenta || []).map(p => ({
          id: p.id,
          date: p.fechaPago,
          amount: p.monto,
          method: p.metodoPago?.nombre || null
        })),
        servicesSummary,
      };
    });

    success(res, data, buildMeta(total, page, perPage));
  } catch (err) {
    next(err);
  }
};

/* ------------------------------------------------------------------ */
/*  Product includes & transform handlers (used by getById)           */
/* ------------------------------------------------------------------ */

const PRODUCT_INCLUDES = {
  tiqueteria: {
    prodTiqueteria: {
      include: {
        tramosVuelo: { 
          include: {
            aeropuertoOrigen: true,
            aeropuertoDestino: true,
            aerolinea: true,
            planEquipaje: { include: { aerolinea: true } }
          },
          orderBy: { orden: 'asc' }
        },
        aerolinea: true,
        planEquipaje: true
      }
    }
  },
  hoteleria: { prodHoteleria: true },
  seguros_viaje: { prodSeguros: true },
  planes: { prodPlanes: { include: { paquete: true, aerolinea: true } } },
  checkin: { prodCheckins: true },
  documentacion_migratoria: { prodMigracion: true },
  simcard: { prodSimcards: true },
  renta_vehiculos: { prodAutos: true },
  renta_fincas: { prodFincas: true },
  tours: { prodTours: true },
  centros_convencion: { prodEventos: true },
  restaurantes: { prodRestaurantes: true },
  visa: { prodVisas: true },
  pasaporte: { prodPasaportes: true },
  servicio_mascotas: { prodMascotas: true }
};

function mapPassengers(detalle) {
  return (detalle.pasajerosDetalle || []).map(p => ({
    id: p.id,
    personaId: p.personaId,
    esTitular: p.esTitular,
    asiento: p.asiento,
    nombreCompleto: p.persona ? `${p.persona.nombres} ${p.persona.apellidos}` : null,
    tipoDocumento: p.persona?.tipoDocumentoId,
    nroDocumento: p.persona?.documento,
    nroReserva: p.nroReserva,
    nroTiquete: p.nroTiquete
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
  return sorted.map(l => {
    return {
      origin: l.aeropuertoOrigen?.codigoIata || null,
      originCity: l.aeropuertoOrigen?.ciudad || null,
      originName: l.aeropuertoOrigen?.nombre || null,
      destination: l.aeropuertoDestino?.codigoIata || null,
      destinationCity: l.aeropuertoDestino?.ciudad || null,
      destinationName: l.aeropuertoDestino?.nombre || null,
      flightNumber: l.nroVueloTramo,
      seat: l.asiento || null,
      ticketNumber: l.nroTiquete || null,
      date: formatColombiaDate(l.salida),
      time: formatColombiaTime(l.salida),
      arrivalDate: formatColombiaDate(l.llegada),
      arrivalTime: formatColombiaTime(l.llegada),
      airline: l.aerolinea?.nombre || null,
      baggagePlan: l.planEquipaje ? `${l.planEquipaje.aerolinea?.nombre || l.aerolinea?.nombre || ''} - ${l.planEquipaje.tipoTarifa}` : null,
      orden: l.orden
    };
  });
}

const PRODUCT_TRANSFORMS = {
  tiqueteria(d, passengers, target) {
    const t = d.prodTiqueteria;
    if (!t) return;
    target.push({
      id: t.id,
      airline: String(t.aerolineaId || ''),
      airlineName: t.aerolinea?.nombre || null,
      reservationNumber: t.nroReserva,
      flightNumber: t.nroVuelo,
      ticketNumber: t.nroTiquete,
      flightMode: t.modoVuelo,
      checkinStatus: t.checkinStatus,
      baggagePlan: t.planEquipaje ? `${t.planEquipaje.tipoTarifa}` : null,
      seatNumber: passengers.length > 0 ? passengers[0].asiento : null,
      supplier: d.proveedor?.nombre || null,
      supplierCost: d.costoProveedor || 0,
      ta: d.ta || 0,
      legs: mapLegs(t.tramosVuelo),
      passengers: passengers.map(p => ({
        name: p.nombreCompleto,
        docType: String(p.tipoDocumento || ''),
        docNumber: p.nroDocumento || '',
        esTitular: p.esTitular,
        asiento: p.asiento || '',
        nroReserva: p.nroReserva || '',
        nroTiquete: p.nroTiquete || ''
      }))
    });
  },
  hoteleria(d, passengers, target) {
    const h = d.prodHoteleria;
    if (!h) return;
    target.push({
      id: h.id,
      hotelName: h.hotelNombre,
      hotelType: h.tipoHotel,
      destination: h.destino,
      reservationNumber: h.nroReserva,
      startDate: h.fechaEntrada?.toISOString().split('T')[0] || null,
      endDate: h.fechaSalida?.toISOString().split('T')[0] || null,
      observations: h.observaciones,
      guests: passengers.map(p => ({ name: p.nombreCompleto, docType: String(p.tipoDocumento || ''), docNumber: p.nroDocumento || '' }))
    ,
      supplier: d.proveedor?.nombre || null,
      supplierCost: d.costoProveedor || 0,
      ta: d.ta || 0
    });
  },
  seguros_viaje(d, passengers, target, venta) {
    const s = d.prodSeguros;
    if (!s) return;
    const members = passengers.map(p => ({ name: p.nombreCompleto, docType: String(p.tipoDocumento || ''), docNumber: p.nroDocumento || '' }));
    if (!s) return;
    target.push({
      id: s.id,
      insuranceType: s.tipoSeguro,
      coverageAmount: s.coberturaUsd,
      coverageDays: s.diasCobertura,
      startDate: s.fechaInicioVigencia?.toISOString() || null,
      endDate: s.fechaFinVigencia?.toISOString() || null,
      phone: s.telefonoContacto,
      members: members.length > 0 ? members : (venta?.cliente?.persona ? [{ name: `${venta.cliente.persona.nombres} ${venta.cliente.persona.apellidos}`, docType: '', docNumber: venta.cliente.persona.documento || '' }] : [])
    ,
      supplier: d.proveedor?.nombre || null,
      supplierCost: d.costoProveedor || 0,
      ta: d.ta || 0
    });
  },
  planes(d, passengers, target) {
    const p = d.prodPlanes;
    if (!p) return;
    target.push({
      id: p.id,
      planName: p.nombrePlan,
      packageId: p.paqueteId,
      packageName: p.paquete?.nombre || null,
      hotelName: p.nombreHotel || null,
      airline: String(p.aerolineaId || ''),
      airlineName: p.aerolinea?.nombre || null,
      flightNumber: p.nroVuelo || null,
      reservationNumber: p.nroReserva,
      ticketNumber: p.nroTiquete,
      startDate: p.fechaViajeInicio?.toISOString() || null,
      endDate: p.fechaViajeFin?.toISOString() || null,
      flightDepartureDate: p.fechaSalidaVuelo?.toISOString() || null,
      flightDepartureArrivalDate: p.fechaLlegadaVuelo?.toISOString() || null,
      flightReturnDate: p.fechaRegresoVuelo?.toISOString() || null,
      flightReturnArrivalDate: p.fechaLlegadaRegresoVuelo?.toISOString() || null,
      adultsCount: p.adultosCount,
      childrenCount: p.menoresCount,
      confirmationNumber: p.numeroConfirmacion,
      observations: p.observaciones,
      guests: passengers.map(p => ({ name: p.nombreCompleto, docType: String(p.tipoDocumento || ''), docNumber: p.nroDocumento || '' })),
      packageType: p.tipoPaquete || 'own',
      supplier: d.proveedor?.nombre || null,
      supplierCost: d.costoProveedor || 0,
      ta: d.ta || 0
    });
  },
  checkin(d, passengers, target) {
    const c = d.prodCheckins;
    if (!c) return;
    target.push({
      id: c.id,
      passengerName: passengers.length > 0 ? passengers[0].nombreCompleto : null,
      docType: passengers.length > 0 ? passengers[0].tipoDocumento : null,
      docNumber: passengers.length > 0 ? passengers[0].nroDocumento : null,
      flightOrReservation: c.nroVueloReserva,
      travelDate: c.fechaViaje?.toISOString() || null,
      seat: c.asiento,
      baggage: c.maletasContadas,
      phone: c.telefonoContacto,
      specialNeeds: c.necesidadesEspeciales,
      needsWheelchair: c.usaSillaRuedas
    ,
      supplier: d.proveedor?.nombre || null,
      supplierCost: d.costoProveedor || 0,
      ta: d.ta || 0
    });
  },
  documentacion_migratoria(d, passengers, target) {
    const m = d.prodMigracion;
    if (!m) return;
    target.push({
      id: m.id,
      passengerName: passengers.length > 0 ? passengers[0].nombreCompleto : null,
      requestedDocType: m.tipoTramiteMigratorio,
      nationality: m.nacionalidad,
      docType: m.tipoDocumento || 'Pasaporte',
      docNumber: m.pasaporteNro,
      passportExpiry: m.pasaporteVence?.toISOString().split('T')[0] || null,
      destinationCountry: m.paisDestino,
      supplier: d.proveedor?.nombre || null,
      supplierCost: d.costoProveedor || 0,
      ta: d.ta || 0
    });
  },
  simcard(d, passengers, target) {
    const s = d.prodSimcards;
    if (!s) return;
    target.push({
      id: s.id,
      passengerName: passengers.length > 0 ? passengers[0].nombreCompleto : null,
      destinationCountry: s.paisDestino,
      arrivalDate: s.fechaLlegada?.toISOString() || null,
      tripDuration: s.duracionViaje,
      dataPlan: s.planDatos,
      simType: s.tipoSim,
      deliveryMethod: s.metodoEntrega
    ,
      supplier: d.proveedor?.nombre || null,
      supplierCost: d.costoProveedor || 0,
      ta: d.ta || 0
    });
  },
  renta_vehiculos(d, passengers, target) {
    const a = d.prodAutos;
    if (!a) return;
    target.push({
      id: a.id,
      mainDriver: a.conductorNombre,
      licenseNumber: a.licenciaNro,
      pickupDate: a.fechaRecogida?.toISOString() || null,
      returnDate: a.fechaDevolucion?.toISOString() || null,
      pickupLocation: a.lugarRecogida,
      vehicleCategory: a.categoriaAuto,
      additionalDrivers: a.conductoresAdicionales,
      insuranceType: a.tipoSeguro,
      guaranteeCreditCard: a.tarjetaGarantiaInfo
    ,
      supplier: d.proveedor?.nombre || null,
      supplierCost: d.costoProveedor || 0,
      ta: d.ta || 0
    });
  },
  renta_fincas(d, passengers, target) {
    const f = d.prodFincas;
    if (!f) return;
    target.push({
      id: f.id,
      responsibleName: f.responsableNombre,
      docNumber: f.documentoResponsable,
      checkInDate: f.fechaEntrada?.toISOString().split('T')[0] || null,
      checkOutDate: f.fechaSalida?.toISOString().split('T')[0] || null,
      adultsCount: f.adultosCount,
      childrenCount: f.ninosCount,
      hasPets: f.tieneMascotas,
      petType: f.tipoMascota,
      additionalServices: f.serviciosExtra?.split(', ') || [],
      fincaName: f.nombreFinca,
      fincaAddress: f.direccionFinca,
      fincaCity: f.ciudadPueblo,
      observations: f.observaciones
    ,
      supplier: d.proveedor?.nombre || null,
      supplierCost: d.costoProveedor || 0,
      ta: d.ta || 0
    });
  },
  tours(d, passengers, target) {
    const t = d.prodTours;
    if (!t) return;
    target.push({
      id: t.id,
      passengerName: passengers.length > 0 ? passengers[0].nombreCompleto : null,
      selectedTour: t.tourNombre,
      preferredDate: t.fechaPreferida?.toISOString() || null,
      adultsCount: t.adultosCount,
      childrenCount: t.menoresCount,
      childrenAges: t.edadesMenores,
      guideLanguage: t.idiomaGuia,
      needsTransport: t.requiereTransporte,
      pickupPoint: t.puntoEncuentro,
      medicalConditions: t.condicionesMedicas,
      phone: t.telefonoContacto,
      observations: t.observaciones,
      guests: passengers.map(p => ({
        name: p.nombreCompleto,
        docType: String(p.tipoDocumento || ''),
        docNumber: p.nroDocumento || ''
      })),
      supplier: d.proveedor?.nombre || null,
      supplierCost: d.costoProveedor || 0,
      ta: d.ta || 0
    });
  },
  centros_convencion(d, passengers, target) {
    const e = d.prodEventos;
    if (!e) return;
    target.push({
      id: e.id,
      organization: e.organizacion,
      contactName: e.nombreContacto,
      email: e.emailContacto,
      startDate: e.fechaInicio?.toISOString() || null,
      endDate: e.fechaFin?.toISOString() || null,
      estimatedAttendance: e.asistenciaEstimada,
      requiredSpace: e.espacioRequerido,
      eventType: e.tipoEvento,
      avEquipment: e.equiposAv?.split(', ') || [],
      hasCatering: e.requiereCatering,
      cateringNotes: e.notasCatering,
      city: e.ciudad || null,
      address: e.direccion || null,
      placeName: e.nombreLugar || null
    ,
      supplier: d.proveedor?.nombre || null,
      supplierCost: d.costoProveedor || 0,
      ta: d.ta || 0
    });
  },
  restaurantes(d, passengers, target) {
    const r = d.prodRestaurantes;
    if (!r) return;
    target.push({
      id: r.id,
      reservationName: r.nombreReserva,
      dateTime: r.fechaHoraReserva?.toISOString() || null,
      peopleCount: r.personasCount,
      tablePreference: r.preferenciaMesa,
      menuType: r.tipoMenu,
      dietaryRestrictions: r.restriccionesDieta?.split(', ') || [],
      specialOccasion: r.ocasionEspecial,
      phone: r.telefonoContacto
    ,
      supplier: d.proveedor?.nombre || null,
      supplierCost: d.costoProveedor || 0,
      ta: d.ta || 0
    });
  },
  visa(d, passengers, target) {
    const v = d.prodVisas;
    if (!v) return;
    target.push({
      id: v.id,
      fullName: v.nombreCompleto,
      birthDate: v.fechaNacimiento?.toISOString().split('T')[0] || null,
      nationality: v.nacionalidad,
      docType: v.tipoDocumento || 'Pasaporte',
      docNumber: v.nroPasaporte,
      passportExpiration: v.vencimientoPasaporte?.toISOString().split('T')[0] || null,
      countryApplying: v.paisAplicacion,
      visaType: v.tipoVisa,
      estimatedTravelDate: v.fechaEstimadaViaje?.toISOString() || null,
      email: v.emailContacto
    ,
      supplier: d.proveedor?.nombre || null,
      supplierCost: d.costoProveedor || 0,
      ta: d.ta || 0
    });
  },
  pasaporte(d, passengers, target) {
    const p = d.prodPasaportes;
    if (!p) return;
    target.push({
      id: p.id,
      fullName: p.nombreCompleto,
      idNumber: p.nroDocumento,
      birthDate: p.fechaNacimiento?.toISOString() || null,
      residenceCity: p.ciudadResidencia,
      processType: p.tipoTramite,
      estimatedTravelDate: p.fechaEstimadaViaje?.toISOString() || null,
      phone: p.telefonoContacto
    ,
      supplier: d.proveedor?.nombre || null,
      supplierCost: d.costoProveedor || 0,
      ta: d.ta || 0
    });
  },
  servicio_mascotas(d, passengers, target) {
    const m = d.prodMascotas;
    if (!m) return;
    target.push({
      id: m.id,
      ownerName: passengers.length > 0 ? passengers[0].nombreCompleto : null,
      petName: m.mascotaNombre,
      species: m.especie,
      breed: m.raza,
      weight: m.pesoKg,
      size: m.tamanoMascota === "pequeno" ? "pequeño" : m.tamanoMascota,
      travelType: m.transporteTipo,
      travelDate: m.fechaViaje?.toISOString() || null,
      destinationCountry: m.paisDestino,
      medicalConditions: m.condicionesMedicas,
      phone: m.telefonoContacto,
      transportCompany: m.empresaTransporte,
      observations: m.observaciones
    ,
      supplier: d.proveedor?.nombre || null,
      supplierCost: d.costoProveedor || 0,
      ta: d.ta || 0
    });
  }
};

/* ------------------------------------------------------------------ */
/*  getById — optimized with selective includes                        */
/* ------------------------------------------------------------------ */

exports.getById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    // 1. Ejecutar en paralelo la consulta de cabecera de la venta y los detalles base
    const [venta, detalleVentasBase] = await Promise.all([
      prisma.ventas.findUnique({
        where: { id },
        include: {
          cliente: { include: { persona: true } },
          usuario: { include: { persona: true } },
          comisionista: { include: { persona: true } },
          responsable: { include: { persona: true } },
          metodoPagoPrincipal: true,
          pagosVenta: { include: { metodoPago: true } }
        }
      }),
      prisma.detalleVenta.findMany({
        where: { ventaId: id },
        include: {
          pasajerosDetalle: { include: { persona: true } },
          proveedor: true
        }
      })
    ]);

    if (!venta) return error(res, 'Venta no encontrada', 404);

    // 2. Consultar en paralelo únicamente los detalles específicos de productos presentes
    const detalleVentas = await Promise.all(
      detalleVentasBase.map(async (d) => {
        const tipo = d.categoria;
        if (PRODUCT_INCLUDES[tipo]) {
          const relationKey = Object.keys(PRODUCT_INCLUDES[tipo])[0]; // ej: 'prodTiqueteria'
          const includeConfig = PRODUCT_INCLUDES[tipo][relationKey];
          
          const queryOptions = {
            where: { detalleVentaId: d.id }
          };
          if (includeConfig && typeof includeConfig === 'object' && includeConfig.include) {
            queryOptions.include = includeConfig.include;
          }
          
          const productData = await prisma[relationKey].findUnique(queryOptions);
          return {
            ...d,
            [relationKey]: productData
          };
        }
        return d;
      })
    );

    const resultMap = {};
    for (const d of detalleVentas) {
      const passengers = mapPassengers(d);
      const handler = PRODUCT_TRANSFORMS[d.categoria];
      if (handler) {
        handler(d, passengers, (resultMap[d.categoria] = resultMap[d.categoria] || []), venta);
      }
    }

    success(res, {
      id: venta.id,
      clientId: venta.clienteId,
      clientName: `${venta.cliente.persona.nombres} ${venta.cliente.persona.apellidos}`,
      asesorId: venta.usuarioId,
      asesorName: `${venta.usuario.persona.nombres} ${venta.usuario.persona.apellidos}`,
      date: venta.creadoAt,
      total: venta.montoTotal,
      paymentMethod: venta.metodoPagoPrincipal?.nombre || null,
      status: venta.status,
      servicesSummary: (detalleVentas || []).map(d => {
        const tipo = d.categoria;
        let label = tipo;
        const labelMap = {
          tiqueteria: 'Tiquetería',
          hoteleria: 'Hotelería',
          seguros: 'Seguro',
          planes: 'Plan',
          checkin: 'Check-in',
          migracion: 'Migración',
          simcard: 'SIM Card',
          autos: 'Renta de Auto',
          fincas: 'Finca',
          tours: 'Tour',
          eventos: 'Evento',
          restaurantes: 'Restaurante',
          visas: 'Visa',
          pasaportes: 'Pasaporte',
          mascotas: 'Mascota'
        };
        if (labelMap[tipo]) {
          label = labelMap[tipo];
        }
        return { tipo, label };
      }),
      observations: venta.observaciones,
      isCredit: venta.esCredito,
      creditDueDate: venta.fechaVenceCredito,
      creditPaidAmount: venta.montoPagadoCredito,
      isReviewed: venta.isReviewed,
      commissionAgentId: venta.comisionistaId,
      commissionAgentName: venta.comisionista ? `${venta.comisionista.persona.nombres} ${venta.comisionista.persona.apellidos}` : null,
      commissionAgentAmount: venta.montoComisionBruto,
      commissionAgentRetentionPercentage: venta.porcentajeRetencionComision,
      commissionAgentNetPayment: venta.montoComisionNeto,
      supplierCost: venta.costoProveedorTotal,
      ta: venta.taTotal,
      isSettled: venta.comisionLiquidada,
      payments: venta.pagosVenta.map(p => ({
        id: p.id,
        date: p.fechaPago,
        amount: p.monto,
        method: p.metodoPago?.nombre || null
      })),
      ticketData: resultMap.tiqueteria || [],
      hotelData: resultMap.hoteleria || [],
      insuranceData: resultMap.seguros_viaje || [],
      planData: resultMap.planes || [],
      checkInData: resultMap.checkin || [],
      migrationData: resultMap.documentacion_migratoria || [],
      simCardData: resultMap.simcard || [],
      carRentalData: resultMap.renta_vehiculos || [],
      fincaData: resultMap.renta_fincas || [],
      tourData: resultMap.tours || [],
      conventionData: resultMap.centros_convencion || [],
      restaurantData: resultMap.restaurantes || [],
      visaData: resultMap.visa || [],
      passportData: resultMap.pasaporte || [],
      petServiceData: resultMap.servicio_mascotas || []
    });
  } catch (err) {
    next(err);
  }
};

const PRODUCT_HANDLERS = {
  ticketData: {
    category: 'tiqueteria', table: 'prodTiqueteria',
    nombreServicio: 'Tiquetería',
    transform: async (d, detalleId, tx) => {
      const [aerolineaId, planEquipajeId] = await Promise.all([
        resolveAirlineId(tx, d.airline),
        resolveBaggagePlanId(tx, d.baggagePlan)
      ]);
      return {
        detalleVentaId: detalleId,
        aerolineaId,
        nroReserva: d.reservationNumber || null,
        nroVuelo: d.flightNumber || null,
        nroTiquete: d.ticketNumber || null,
        modoVuelo: d.flightMode || 'one_way',
        planEquipajeId,
        checkinStatus: 'pendiente'
      };
    }
  },
  hotelData: {
    category: 'hoteleria', table: 'prodHoteleria',
    nombreServicio: 'Hotelería',
    transform: (d, detalleId) => ({
      detalleVentaId: detalleId,
      hotelNombre: d.hotelName || null,
      tipoHotel: d.hotelType || 'hotel',
      destino: d.destination || null,
      nroReserva: d.reservationNumber || null,
      fechaEntrada: d.startDate ? new Date(d.startDate) : null,
      fechaSalida: d.endDate ? new Date(d.endDate) : null,
      observaciones: d.observations || null
    })
  },
  insuranceData: {
    category: 'seguros_viaje', table: 'prodSeguros',
    nombreServicio: 'Seguros de Viaje',
    transform: (d, detalleId) => ({
      detalleVentaId: detalleId,
      tipoSeguro: d.insuranceType || 'basico',
      coberturaUsd: Number(d.coverageAmount) || 0,
      diasCobertura: Number(d.coverageDays) || 0,
      fechaInicioVigencia: d.startDate ? new Date(d.startDate) : null,
      fechaFinVigencia: d.endDate ? new Date(d.endDate) : null,
      telefonoContacto: d.phone || null
    })
  },
  planData: {
    category: 'planes', table: 'prodPlanes',
    nombreServicio: 'Planes',
    transform: async (d, detalleId, tx) => {
      const aerolineaId = await resolveAirlineId(tx, d.airline);
      return {
        detalleVentaId: detalleId,
        paqueteId: d.packageId ? (parseInt(d.packageId) || null) : null,
        paqueteTarifaId: d.packageRateId ? (parseInt(d.packageRateId) || null) : null,
        nombrePlan: d.planName || null,
        nombreHotel: d.hotelName || null,
        aerolineaId,
        nroVuelo: d.flightNumber || null,
        nroReserva: d.reservationNumber || null,
        nroTiquete: d.ticketNumber || null,
        fechaViajeInicio: d.startDate ? new Date(d.startDate) : null,
        fechaViajeFin: d.endDate ? new Date(d.endDate) : null,
        fechaSalidaVuelo: d.flightDepartureDate ? new Date(d.flightDepartureDate) : null,
        fechaLlegadaVuelo: d.flightDepartureArrivalDate ? new Date(d.flightDepartureArrivalDate) : null,
        fechaRegresoVuelo: d.flightReturnDate ? new Date(d.flightReturnDate) : null,
        fechaLlegadaRegresoVuelo: d.flightReturnArrivalDate ? new Date(d.flightReturnArrivalDate) : null,
        adultosCount: d.adultsCount || 0,
        menoresCount: d.childrenCount || 0,
        numeroConfirmacion: d.confirmationNumber || null,
        observaciones: d.observations || null,
        tipoPaquete: d.packageType || 'own'
      };
    }
  },
  checkInData: {
    category: 'checkin', table: 'prodCheckins',
    nombreServicio: 'Check-in',
    transform: (d, detalleId) => ({
      detalleVentaId: detalleId,
      nroVueloReserva: d.flightOrReservation || null,
      fechaViaje: d.travelDate ? new Date(d.travelDate) : null,
      asiento: d.seat || null,
      maletasContadas: d.baggage || null,
      telefonoContacto: d.phone || null,
      necesidadesEspeciales: d.specialNeeds || null,
      usaSillaRuedas: d.needsWheelchair || false
    })
  },
  migrationData: {
    category: 'documentacion_migratoria', table: 'prodMigracion',
    nombreServicio: 'Documentación Migratoria',
    transform: (d, detalleId) => ({
      detalleVentaId: detalleId,
      tipoTramiteMigratorio: d.requestedDocType || null,
      nacionalidad: d.nationality || null,
      tipoDocumento: d.docType || 'Pasaporte',
      pasaporteNro: d.docNumber || null,
      pasaporteVence: d.passportExpiry ? new Date(d.passportExpiry) : null,
      paisDestino: d.destinationCountry || null
    })
  },
  simCardData: {
    category: 'simcard', table: 'prodSimcards',
    nombreServicio: 'SIM Card',
    transform: (d, detalleId) => ({
      detalleVentaId: detalleId,
      paisDestino: d.destinationCountry || null,
      fechaLlegada: d.arrivalDate ? new Date(d.arrivalDate) : null,
      duracionViaje: d.tripDuration || null,
      planDatos: d.dataPlan || null,
      tipoSim: d.simType || null,
      metodoEntrega: d.deliveryMethod || null
    })
  },
  carRentalData: {
    category: 'renta_vehiculos', table: 'prodAutos',
    nombreServicio: 'Renta de Vehículos',
    transform: (d, detalleId) => ({
      detalleVentaId: detalleId,
      conductorNombre: d.mainDriver || null,
      licenciaNro: d.licenseNumber || null,
      fechaRecogida: d.pickupDate ? new Date(d.pickupDate) : null,
      fechaDevolucion: d.returnDate ? new Date(d.returnDate) : null,
      lugarRecogida: d.pickupLocation || null,
      categoriaAuto: d.vehicleCategory || null,
      conductoresAdicionales: d.additionalDrivers || 0,
      tipoSeguro: d.insuranceType === 'basic' ? 'basico' : (d.insuranceType === 'all_risk' ? 'todo_riesgo' : null),
      tarjetaGarantiaInfo: d.guaranteeCreditCard || null
    })
  },
  fincaData: {
    category: 'renta_fincas', table: 'prodFincas',
    nombreServicio: 'Renta de Fincas',
    transform: (d, detalleId) => ({
      detalleVentaId: detalleId,
      responsableNombre: d.responsibleName || null,
      documentoResponsable: d.docNumber || null,
      fechaEntrada: d.checkInDate ? new Date(d.checkInDate) : null,
      fechaSalida: d.checkOutDate ? new Date(d.checkOutDate) : null,
      adultosCount: d.adultsCount || 0,
      ninosCount: d.childrenCount || 0,
      tieneMascotas: d.hasPets || false,
      tipoMascota: d.petType || null,
      serviciosExtra: d.additionalServices?.join(', ') || null,
      nombreFinca: d.fincaName || null,
      direccionFinca: d.fincaAddress || null,
      ciudadPueblo: d.fincaCity || null,
      observaciones: d.observations || null
    })
  },
  tourData: {
    category: 'tours', table: 'prodTours',
    nombreServicio: 'Tours',
    transform: (d, detalleId) => ({
      detalleVentaId: detalleId,
      tourNombre: d.selectedTour || null,
      fechaPreferida: d.preferredDate ? new Date(d.preferredDate) : null,
      adultosCount: d.adultsCount || 1,
      menoresCount: d.childrenCount || 0,
      edadesMenores: d.childrenAges || null,
      idiomaGuia: d.guideLanguage || null,
      requiereTransporte: d.needsTransport || false,
      puntoEncuentro: d.pickupPoint || null,
      condicionesMedicas: d.medicalConditions || null,
      telefonoContacto: d.phone || null,
      observaciones: d.observations || null
    })
  },
  conventionData: {
    category: 'centros_convencion', table: 'prodEventos',
    nombreServicio: 'Centros de Convención',
    transform: (d, detalleId) => ({
      detalleVentaId: detalleId,
      organizacion: d.organization || null,
      nombreContacto: d.contactName || null,
      emailContacto: d.email || null,
      fechaInicio: d.startDate ? new Date(d.startDate) : null,
      fechaFin: d.endDate ? new Date(d.endDate) : null,
      asistenciaEstimada: d.estimatedAttendance || 0,
      espacioRequerido: d.requiredSpace || null,
      tipoEvento: d.eventType || null,
      equiposAv: d.avEquipment?.join(', ') || null,
      requiereCatering: d.hasCatering || false,
      notasCatering: d.cateringNotes || null,
      ciudad: d.city || null,
      direccion: d.address || null,
      nombreLugar: d.placeName || null
    })
  },
  restaurantData: {
    category: 'restaurantes', table: 'prodRestaurantes',
    nombreServicio: 'Restaurantes',
    transform: (d, detalleId) => ({
      detalleVentaId: detalleId,
      nombreReserva: d.reservationName || null,
      fechaHoraReserva: d.dateTime ? new Date(d.dateTime) : null,
      personasCount: d.peopleCount || 0,
      preferenciaMesa: d.tablePreference || null,
      tipoMenu: d.menuType || null,
      restriccionesDieta: d.dietaryRestrictions?.join(', ') || null,
      ocasionEspecial: d.specialOccasion || null,
      telefonoContacto: d.phone || null
    })
  },
  visaData: {
    category: 'visa', table: 'prodVisas',
    nombreServicio: 'Visa',
    transform: (d, detalleId) => ({
      detalleVentaId: detalleId,
      nombreCompleto: d.fullName || null,
      fechaNacimiento: d.birthDate ? new Date(d.birthDate) : null,
      nacionalidad: d.nationality || null,
      tipoDocumento: d.docType || 'Pasaporte',
      nroPasaporte: d.docNumber || null,
      vencimientoPasaporte: d.passportExpiration ? new Date(d.passportExpiration) : null,
      paisAplicacion: d.countryApplying || null,
      tipoVisa: d.visaType || null,
      fechaEstimadaViaje: d.estimatedTravelDate ? new Date(d.estimatedTravelDate) : null,
      emailContacto: d.email || null
    })
  },
  passportData: {
    category: 'pasaporte', table: 'prodPasaportes',
    nombreServicio: 'Pasaporte',
    transform: (d, detalleId) => ({
      detalleVentaId: detalleId,
      nombreCompleto: d.fullName || null,
      nroDocumento: d.idNumber || null,
      fechaNacimiento: d.birthDate ? new Date(d.birthDate) : null,
      ciudadResidencia: d.residenceCity || null,
      tipoTramite: d.processType || null,
      fechaEstimadaViaje: d.estimatedTravelDate ? new Date(d.estimatedTravelDate) : null,
      telefonoContacto: d.phone || null
    })
  },
  petServiceData: {
    category: 'servicio_mascotas', table: 'prodMascotas',
    nombreServicio: 'Servicio de Mascotas',
    transform: (d, detalleId) => ({
      detalleVentaId: detalleId,
      mascotaNombre: d.petName || null,
      especie: d.species || null,
      raza: d.breed || null,
      pesoKg: d.weight || 0,
      tamanoMascota: d.size === "pequeño" ? "pequeno" : (d.size || null),
      transporteTipo: d.travelType || null,
      fechaViaje: d.travelDate ? new Date(d.travelDate) : null,
      paisDestino: d.destinationCountry || null,
      condicionesMedicas: d.medicalConditions || null,
      telefonoContacto: d.phone || null,
      empresaTransporte: d.transportCompany || null,
      observaciones: d.observations || null
    })
  }
};

async function findOrCreatePersona(tx, name, docType, docNumber, defaultPersonaId) {
  if (!name && !docNumber) {
    return defaultPersonaId || null;
  }
  
  if (docNumber) {
    const match = await tx.personas.findUnique({
      where: { documento: String(docNumber) }
    });
    if (match) return match.id;
  }

  const nameParts = (name || '').trim().split(/\s+/);
  const nombres = nameParts[0] || 'Pasajero';
  const apellidos = nameParts.slice(1).join(' ') || 'Temporal';

  let tipoDocumentoId = null;
  if (docType) {
    const td = await tx.tiposDocumento.findUnique({
      where: { abreviatura: String(docType) }
    });
    if (td) tipoDocumentoId = td.id;
  }

  const newPersona = await tx.personas.create({
    data: {
      nombres,
      apellidos,
      tipoDocumentoId,
      documento: docNumber ? String(docNumber) : null,
      status: 'active'
    }
  });
  return newPersona.id;
}

async function resolvePaymentMethodId(prisma, paymentMethod, cache) {
  if (!paymentMethod) return null;
  const id = parseInt(paymentMethod);
  if (!isNaN(id)) return id;
  if (cache && cache.paymentMethods && cache.paymentMethods.has(paymentMethod)) return cache.paymentMethods.get(paymentMethod);
  
  // Try metodosPago first (by name)
  const method = await prisma.metodosPago.findFirst({ where: { nombre: paymentMethod } });
  if (method) {
    if (cache && cache.paymentMethods) cache.paymentMethods.set(paymentMethod, method.id);
    return method.id;
  }
  // Try tarjetasAgencia (by name) — return associated metodoPago id
  const card = await prisma.tarjetasAgencia.findFirst({
    where: { nombre: paymentMethod },
    include: { metodoPago: true }
  });
  const resId = card?.metodoPago?.id || null;
  if (cache && cache.paymentMethods) cache.paymentMethods.set(paymentMethod, resId);
  return resId;
}

async function resolveAirlineId(prisma, airline) {
  if (!airline) return null;
  const id = parseInt(airline);
  if (!isNaN(id)) return id;
  const match = await prisma.aerolineas.findFirst({ where: { nombre: airline } });
  return match?.id || null;
}

async function resolveSupplierId(prisma, supplier, cache) {
  if (!supplier) return null;
  const id = parseInt(supplier);
  if (!isNaN(id)) return id;
  if (cache && cache.suppliers && cache.suppliers.has(supplier)) return cache.suppliers.get(supplier);

  const match = await prisma.proveedores.findFirst({ where: { nombre: supplier } });
  const resId = match?.id || null;
  if (cache && cache.suppliers) cache.suppliers.set(supplier, resId);
  return resId;
}

async function resolveAirportId(prisma, iata, cache) {
  if (!iata) return null;
  if (cache && cache.airports && cache.airports.has(iata)) return cache.airports.get(iata);
  
  const parsedId = parseInt(iata);
  if (!isNaN(parsedId)) {
    const match = await prisma.aeropuertos.findUnique({ where: { id: parsedId } });
    if (match) {
      if (cache && cache.airports) cache.airports.set(iata, match.id);
      return match.id;
    }
  }

  const match = await prisma.aeropuertos.findFirst({ where: { codigoIata: iata } });
  const resId = match?.id || null;
  if (cache && cache.airports) cache.airports.set(iata, resId);
  return resId;
}

async function resolveBaggagePlanId(prisma, baggagePlan) {
  if (!baggagePlan) return null;
  const id = parseInt(baggagePlan);
  if (!isNaN(id)) return id;
  
  const parts = baggagePlan.split(' - ');
  if (parts.length >= 2) {
    const airlineName = parts[0];
    const fareType = parts.slice(1).join(' - ');
    const match = await prisma.politicasEquipaje.findFirst({
      where: {
        AND: [
          { aerolinea: { nombre: airlineName } },
          { tipoTarifa: fareType }
        ]
      }
    });
    if (match) return match.id;
  }
  
  const match = await prisma.politicasEquipaje.findFirst({ where: { tipoTarifa: baggagePlan } });
  return match?.id || null;
}

async function createProductItems(tx, ventaId, clienteId, data) {
  const memCache = {
    suppliers: new Map(),
    paymentMethods: new Map(),
    airports: new Map()
  };

  const cliente = await tx.clientes.findUnique({
    where: { id: clienteId },
    select: { personaId: true }
  });
  const personaId = cliente?.personaId;

  for (const [field, handler] of Object.entries(PRODUCT_HANDLERS)) {
    const items = Array.isArray(data[field]) ? data[field] : [];
    for (const item of items) {
      if (!item || Object.keys(item).length === 0) continue;

      try {
        const resolvedSupplierId = await resolveSupplierId(tx, item.supplier, memCache);
        const resolvedSupplierPaymentMethodId = await resolvePaymentMethodId(tx, item.supplierPaymentMethod, memCache);

        const detalle = await tx.detalleVenta.create({
          data: {
            ventaId,
            categoria: handler.category,
            nombreServicio: handler.nombreServicio,
            subtotal: (item.supplierCost || 0) + (item.ta || 0),
            costoProveedor: item.supplierCost || 0,
            ta: item.ta || 0,
            proveedorId: resolvedSupplierId,
            metodoPagoProveedorId: resolvedSupplierPaymentMethodId,
            origen: item.legs?.[0]?.origin || item.pickupLocation || null,
            destino: item.destination || item.destinationCountry || item.legs?.[0]?.destination || null,
            fechaInicioViaje: item.startDate ? new Date(item.startDate) : item.departureDate ? new Date(item.departureDate) : item.pickupDate ? new Date(item.pickupDate) : null,
            fechaFinViaje: item.endDate ? new Date(item.endDate) : item.arrivalDate ? new Date(item.arrivalDate) : item.returnDate ? new Date(item.returnDate) : null,
            observaciones: item.observations || null
          }
        });

        const productData = await handler.transform(item, detalle.id, tx);
        const product = await tx[handler.table].create({ data: productData });

        const passengersList = item.passengerInfo ? [item.passengerInfo] : (item.guests || item.members || []);
        if (passengersList.length > 0) {
          for (const p of passengersList) {
            let pId = personaId;
            if (!item.passengerInfo && p.name) {
              pId = await findOrCreatePersona(tx, p.name || p.fullName, p.docType, p.docNumber, personaId);
            }
            await tx.pasajerosDetalle.create({
              data: {
                detalleVentaId: detalle.id,
                personaId: pId,
                esTitular: pId === personaId,
                asiento: item.seatNumber || p.seat || null,
                nroReserva: p.nroReserva || item.reservationNumber || null,
                nroTiquete: p.nroTiquete || item.ticketNumber || null
              }
            });
          }
        }

        if (handler.table === 'prodTiqueteria' && item.legs && item.legs.length > 0) {
          for (let i = 0; i < item.legs.length; i++) {
            const leg = item.legs[i];
            if (!leg.origin && !leg.destination) continue;
            const originAirportId = leg.origin ? await resolveAirportId(tx, leg.origin, memCache) : null;
            const destAirportId = leg.destination ? await resolveAirportId(tx, leg.destination, memCache) : null;
            if (!originAirportId || !destAirportId) {
              console.warn(`[WARN] tramosVuelo leg ${i}: aeropuerto no encontrado (origin=${leg.origin}, dest=${leg.destination}) - saltando`);
              continue;
            }
            const legAirlineId = (leg.airline || item.airline) ? await resolveAirlineId(tx, leg.airline || item.airline) : null;
            const legBaggagePlanId = (leg.baggagePlan || item.baggagePlan) ? await resolveBaggagePlanId(tx, leg.baggagePlan || item.baggagePlan) : null;
            await tx.tramosVuelo.create({
              data: {
                prodTiqueteriaId: product.id,
                aeropuertoOrigenId: originAirportId,
                aeropuertoDestinoId: destAirportId,
                salida: leg.date ? new Date(leg.date) : new Date(),
                llegada: leg.arrivalDate ? new Date(leg.arrivalDate) : (leg.date ? new Date(leg.date) : new Date()),
                nroVueloTramo: leg.flightNumber || null,
                asiento: leg.seat || null,
                nroTiquete: leg.ticketNumber || null,
                aerolineaId: legAirlineId,
                planEquipajeId: legBaggagePlanId,
                orden: i + 1
              }
            });
          }

          if (item.returnLeg && item.returnLeg.origin && item.returnLeg.destination) {
            const rLeg = item.returnLeg;
            const rOriginId = await resolveAirportId(tx, rLeg.origin, memCache);
            const rDestId = await resolveAirportId(tx, rLeg.destination, memCache);
            if (rOriginId && rDestId) {
              const rAirlineId = (rLeg.airline || item.airline) ? await resolveAirlineId(tx, rLeg.airline || item.airline) : null;
              const rBaggagePlanId = (rLeg.baggagePlan || item.baggagePlan) ? await resolveBaggagePlanId(tx, rLeg.baggagePlan || item.baggagePlan) : null;
              await tx.tramosVuelo.create({
                data: {
                  prodTiqueteriaId: product.id,
                  aeropuertoOrigenId: rOriginId,
                  aeropuertoDestinoId: rDestId,
                  salida: rLeg.date ? new Date(rLeg.date) : new Date(),
                  llegada: rLeg.arrivalDate ? new Date(rLeg.arrivalDate) : (rLeg.date ? new Date(rLeg.date) : new Date()),
                  nroVueloTramo: rLeg.flightNumber || null,
                  asiento: rLeg.seat || null,
                  aerolineaId: rAirlineId,
                  planEquipajeId: rBaggagePlanId,
                  orden: (item.legs?.length || 0) + 1
                }
              });
            } else {
              console.warn(`[WARN] returnLeg: aeropuerto no encontrado (origin=${rLeg.origin}, dest=${rLeg.destination}) - saltando`);
            }
          }
        }

      } catch (itemErr) {
        console.error(`[ERROR] createProductItems field=${field}:`, itemErr.message, itemErr.meta || '');
        throw itemErr;
      }
    }
  }
}

exports.create = async (req, res, next) => {
  try {
    const data = req.body;
    console.log('[CREATE VENTA] Received data keys:', Object.keys(data));
    console.log('[CREATE VENTA] clientId:', data.clientId, 'paymentMethod:', data.paymentMethod);
    if (data.ticketData) {
      console.log('[CREATE VENTA] ticketData count:', data.ticketData.length);
      data.ticketData.forEach((t, i) => {
        console.log(`[CREATE VENTA] ticket[${i}] flightMode=${t.flightMode} legs=${JSON.stringify(t.legs)} returnLeg=${JSON.stringify(t.returnLeg)}`);
      });
    }

    const metodoPagoId = await resolvePaymentMethodId(prisma, data.paymentMethod);

    const result = await prisma.$transaction(async (tx) => {
      const memCache = {
        suppliers: new Map(),
        paymentMethods: new Map(),
        airports: new Map(),
        airlines: new Map()
      };

      const cliente = await tx.clientes.findUnique({
        where: { id: data.clientId },
        select: { personaId: true }
      });
      if (!cliente) {
        const err = new Error('El cliente seleccionado no existe o fue eliminado');
        err.statusCode = 400;
        err.code = 'CLIENT_NOT_FOUND';
        throw err;
      }
      const personaId = cliente.personaId;

      if (data.commissionAgentId) {
        const comisionista = await tx.comisionistas.findUnique({
          where: { id: data.commissionAgentId }
        });
        if (!comisionista) {
          const err = new Error('El comisionista seleccionado no existe o fue eliminado');
          err.statusCode = 400;
          err.code = 'COMMISSION_AGENT_NOT_FOUND';
          throw err;
        }
      }

      const detalleVentasData = [];

      for (const [field, handler] of Object.entries(PRODUCT_HANDLERS)) {
        const items = Array.isArray(data[field]) ? data[field] : [];
        for (const item of items) {
          if (!item || Object.keys(item).length === 0) continue;

          const [resolvedSupplierId, resolvedSupplierPaymentMethodId] = await Promise.all([
            resolveSupplierId(tx, item.supplier, memCache),
            resolvePaymentMethodId(tx, item.supplierPaymentMethod, memCache)
          ]);

          const productData = await handler.transform(item, undefined, tx);
          delete productData.detalleVentaId; // Omit foreign key for nested create

           const pasajerosDetalleData = [];
          if (personaId) {
            const hasPassengerInfo = item.passengers || item.passengerInfo || item.guests || item.passengerName || item.ownerName ||
              ['checkin', 'documentacion_migratoria', 'simcard', 'tours', 'servicio_mascotas', 'renta_vehiculos'].includes(handler.category);
            
            if (hasPassengerInfo) {
              const passengers = item.passengers ? item.passengers : (item.passengerInfo ? [item.passengerInfo] : (item.guests || [{}]));
              for (const p of passengers) {
                const pid = await findOrCreatePersona(tx, p.name || p.passengerName || p.fullName || item.passengerName || item.ownerName || item.mainDriver, p.docType || item.docType, p.docNumber || item.docNumber || item.licenseNumber || item.passportNumber || item.idNumber, personaId);
                pasajerosDetalleData.push({
                  personaId: pid,
                  esTitular: p.esTitular ?? true,
                  asiento: p.asiento || item.seatNumber || item.seat || null,
                  nroReserva: p.nroReserva || item.reservationNumber || null,
                  nroTiquete: p.nroTiquete || item.ticketNumber || null
                });
              }
            }
          }

          const detalleObj = {
            categoria: handler.category,
            nombreServicio: handler.nombreServicio,
            subtotal: (item.supplierCost || 0) + (item.ta || 0),
            costoProveedor: item.supplierCost || 0,
            ta: item.ta || 0,
            proveedorId: resolvedSupplierId,
            metodoPagoProveedorId: resolvedSupplierPaymentMethodId,
            origen: item.legs?.[0]?.origin || item.pickupLocation || null,
            destino: item.destination || item.destinationCountry || item.legs?.[0]?.destination || null,
            fechaInicioViaje: item.startDate ? new Date(item.startDate) : item.departureDate ? new Date(item.departureDate) : item.pickupDate ? new Date(item.pickupDate) : null,
            fechaFinViaje: item.endDate ? new Date(item.endDate) : item.arrivalDate ? new Date(item.arrivalDate) : item.returnDate ? new Date(item.returnDate) : null,
            observaciones: item.observations || null,
            [handler.table]: {
              create: productData
            }
          };

          if (pasajerosDetalleData.length > 0) {
            detalleObj.pasajerosDetalle = {
              create: pasajerosDetalleData
            };
          }

          if (handler.table === 'prodTiqueteria' && item.legs && item.legs.length > 0) {
            const tramosVueloData = [];
            for (let i = 0; i < item.legs.length; i++) {
              const leg = item.legs[i];
              if (!leg.origin && !leg.destination) continue;
              const [originAirportId, destAirportId, legAirlineId, legBaggagePlanId] = await Promise.all([
                leg.origin ? resolveAirportId(tx, leg.origin, memCache) : null,
                leg.destination ? resolveAirportId(tx, leg.destination, memCache) : null,
                (leg.airline || item.airline) ? resolveAirlineId(tx, leg.airline || item.airline) : null,
                (leg.baggagePlan || item.baggagePlan) ? resolveBaggagePlanId(tx, leg.baggagePlan || item.baggagePlan) : null
              ]);
              if (originAirportId && destAirportId) {
                tramosVueloData.push({
                  aeropuertoOrigenId: originAirportId,
                  aeropuertoDestinoId: destAirportId,
                  salida: leg.date ? new Date(leg.date) : new Date(),
                  llegada: leg.arrivalDate ? new Date(leg.arrivalDate) : (leg.date ? new Date(leg.date) : new Date()),
                  nroVueloTramo: leg.flightNumber || null,
                  asiento: leg.seat || null,
                  nroTiquete: leg.ticketNumber || null,
                  aerolineaId: legAirlineId,
                  planEquipajeId: legBaggagePlanId,
                  orden: i + 1
                });
              }
            }
            if (item.hasStops && item.outboundStops && item.outboundStops.length > 0) {
              for (const stop of item.outboundStops) {
                if (!stop.origin && !stop.destination) continue;
                const [sOriginId, sDestId, stopAirlineId, stopBaggagePlanId] = await Promise.all([
                  stop.origin ? resolveAirportId(tx, stop.origin, memCache) : null,
                  stop.destination ? resolveAirportId(tx, stop.destination, memCache) : null,
                  (stop.airline || item.airline) ? resolveAirlineId(tx, stop.airline || item.airline) : null,
                  (stop.baggagePlan || item.baggagePlan) ? resolveBaggagePlanId(tx, stop.baggagePlan || item.baggagePlan) : null
                ]);
                if (sOriginId && sDestId) {
                  tramosVueloData.push({
                    aeropuertoOrigenId: sOriginId,
                    aeropuertoDestinoId: sDestId,
                    salida: stop.date ? new Date(stop.date) : new Date(),
                    llegada: stop.arrivalDate ? new Date(stop.arrivalDate) : (stop.date ? new Date(stop.date) : new Date()),
                    nroVueloTramo: stop.flightNumber || null,
                    asiento: stop.seat || null,
                    nroTiquete: stop.ticketNumber || null,
                    aerolineaId: stopAirlineId,
                    planEquipajeId: stopBaggagePlanId,
                    orden: tramosVueloData.length + 1
                  });
                }
              }
            }

            if (item.returnLeg && item.returnLeg.origin && item.returnLeg.destination) {
              const rLeg = item.returnLeg;
              const [rOriginId, rDestId, rAirlineId, rBaggagePlanId] = await Promise.all([
                resolveAirportId(tx, rLeg.origin, memCache),
                resolveAirportId(tx, rLeg.destination, memCache),
                (rLeg.airline || item.airline) ? resolveAirlineId(tx, rLeg.airline || item.airline) : null,
                (rLeg.baggagePlan || item.baggagePlan) ? resolveBaggagePlanId(tx, rLeg.baggagePlan || item.baggagePlan) : null
              ]);
              if (rOriginId && rDestId) {
                tramosVueloData.push({
                  aeropuertoOrigenId: rOriginId,
                  aeropuertoDestinoId: rDestId,
                  salida: rLeg.date ? new Date(rLeg.date) : new Date(),
                  llegada: rLeg.arrivalDate ? new Date(rLeg.arrivalDate) : (rLeg.date ? new Date(rLeg.date) : new Date()),
                  nroVueloTramo: rLeg.flightNumber || null,
                  asiento: rLeg.seat || null,
                  nroTiquete: rLeg.ticketNumber || null,
                  aerolineaId: rAirlineId,
                  planEquipajeId: rBaggagePlanId,
                  orden: tramosVueloData.length + 1
                });
              }
            }

            if (item.returnHasStops && item.returnStops && item.returnStops.length > 0) {
              for (const stop of item.returnStops) {
                if (!stop.origin && !stop.destination) continue;
                const [sOriginId, sDestId, stopAirlineId, stopBaggagePlanId] = await Promise.all([
                  stop.origin ? resolveAirportId(tx, stop.origin, memCache) : null,
                  stop.destination ? resolveAirportId(tx, stop.destination, memCache) : null,
                  (stop.airline || item.airline) ? resolveAirlineId(tx, stop.airline || item.airline) : null,
                  (stop.baggagePlan || item.baggagePlan) ? resolveBaggagePlanId(tx, stop.baggagePlan || item.baggagePlan) : null
                ]);
                if (sOriginId && sDestId) {
                  tramosVueloData.push({
                    aeropuertoOrigenId: sOriginId,
                    aeropuertoDestinoId: sDestId,
                    salida: stop.date ? new Date(stop.date) : new Date(),
                    llegada: stop.arrivalDate ? new Date(stop.arrivalDate) : (stop.date ? new Date(stop.date) : new Date()),
                    nroVueloTramo: stop.flightNumber || null,
                    asiento: stop.seat || null,
                    nroTiquete: stop.ticketNumber || null,
                    aerolineaId: stopAirlineId,
                    planEquipajeId: stopBaggagePlanId,
                    orden: tramosVueloData.length + 1
                  });
                }
              }
            }

            if (tramosVueloData.length > 0) {
              detalleObj.prodTiqueteria.create.tramosVuelo = {
                create: tramosVueloData
              };
            }
          }

          detalleVentasData.push(detalleObj);
        }
      }

      const metodoPagoId = await resolvePaymentMethodId(tx, data.paymentMethod, memCache);

      const ventaCreateData = {
        clienteId: data.clientId,
        usuarioId: req.user.id,
        montoTotal: data.total || 0,
        costoProveedorTotal: data.supplierCost || 0,
        taTotal: data.ta || 0,
        comisionistaId: data.commissionAgentId || null,
        responsableId: data.responsableId || null,
        montoComisionBruto: data.commissionAgentAmount || 0,
        porcentajeRetencionComision: data.commissionAgentRetentionPercentage || 0,
        montoComisionNeto: data.commissionAgentNetPayment || 0,
        metodoPagoPrincipalId: metodoPagoId,
        status: data.status || 'credito',
        esCredito: data.isCredit || false,
        fechaVenceCredito: data.creditDueDate ? new Date(data.creditDueDate) : null,
        montoPagadoCredito: data.creditPaidAmount || 0,
        observaciones: data.observations || ''
      };

      if (data.payments && data.payments.length > 0) {
        ventaCreateData.pagosVenta = {
          create: data.payments.map(p => ({
            monto: p.amount,
            metodoPagoId: parseInt(p.method) || null,
            referencia: p.reference || null
          }))
        };
      }

      if (detalleVentasData.length > 0) {
        ventaCreateData.detalleVentas = {
          create: detalleVentasData
        };
      }

      // SINGLE NESTED WRITE
      const venta = await tx.ventas.create({
        data: ventaCreateData
      });

      return venta.id;
    }, {
      maxWait: 15000, // 15s
      timeout: 30000  // 30s
    });

    const created = await prisma.ventas.findUnique({
      where: { id: result },
      include: {
        cliente: { select: { persona: { select: { nombres: true, apellidos: true, email: true, avatarUrl: true } } } },
        usuario: { select: { persona: { select: { nombres: true, apellidos: true } } } },
        comisionista: { select: { persona: { select: { nombres: true, apellidos: true } } } },
        metodoPagoPrincipal: true
      }
    });

    const clientEmail = created.cliente?.persona?.email;
    const clientName = `${created.cliente.persona.nombres} ${created.cliente.persona.apellidos}`;

    // Send vouchers emails
    console.log('[VOUCHER] clientEmail:', clientEmail);
    if (clientEmail) {
      for (const [field, handler] of Object.entries(PRODUCT_HANDLERS)) {
        const items = Array.isArray(data[field]) ? data[field] : [];
        console.log(`[VOUCHER] field=${field} items=${items.length}`);
        for (const item of items) {
          console.log(`[VOUCHER] item.sendVoucher=${item.sendVoucher} item.voucher=${JSON.stringify(item.voucher)?.substring(0, 80)}`);
          if (item.sendVoucher) {
            const attachments = [];
            
            // Single voucher (standard)
            if (item.voucher && item.voucher.base64) {
              const base64Data = item.voucher.base64.split(',')[1] || item.voucher.base64;
              attachments.push({
                filename: item.voucher.name || 'voucher.pdf',
                content: Buffer.from(base64Data, 'base64')
              });
            }
            
            // Multiple vouchers (tours or other)
            if (Array.isArray(item.vouchers)) {
              for (const v of item.vouchers) {
                if (v && v.base64) {
                  const base64Data = v.base64.split(',')[1] || v.base64;
                  attachments.push({
                    filename: v.name || 'voucher.pdf',
                    content: Buffer.from(base64Data, 'base64')
                  });
                }
              }
            }

            if (attachments.length > 0) {
              try {
                console.log(`[VOUCHER] Sending email to ${clientEmail} for ${handler.nombreServicio} with ${attachments.length} attachments...`);
                const result = await emailService.sendEmail({
                  to: clientEmail,
                  subject: `Tu voucher de ${handler.nombreServicio} - iTea Travel`,
                  html: `
                    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaec; border-radius: 8px; overflow: hidden;">
                      <div style="background-color: #0f172a; padding: 20px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">¡Tu voucher está listo!</h1>
                      </div>
                      <div style="padding: 30px;">
                        <p style="font-size: 16px;">Hola <strong>${clientName}</strong>,</p>
                        <p style="font-size: 16px;">Adjunto a este correo encontrarás el comprobante correspondiente a tu servicio de <strong>${handler.nombreServicio}</strong>.</p>
                        <p style="font-size: 16px; margin-top: 20px;">Gracias por confiar en nosotros.</p>
                      </div>
                    </div>
                  `,
                  attachments: attachments
                });
                console.log(`[VOUCHER] sendEmail result:`, JSON.stringify(result));
              } catch (err) {
                console.error('[ERROR] Sending voucher email:', err.message);
              }
            }
          }
        }
      }
    }

    success(res, {
      id: created.id,
      clientId: created.clienteId,
      clientName: `${created.cliente.persona.nombres} ${created.cliente.persona.apellidos}`,
      clientEmail: created.cliente.persona.email || null,
      clientAvatar: created.cliente.persona.avatarUrl || null,
      asesorId: created.usuarioId,
      asesorName: `${created.usuario.persona.nombres} ${created.usuario.persona.apellidos}`,
      date: created.creadoAt,
      total: created.montoTotal,
      paymentMethod: created.metodoPagoPrincipal?.nombre || null,
      status: created.status,
      observations: created.observaciones,
      isCredit: created.esCredito,
      creditDueDate: created.fechaVenceCredito,
      creditPaidAmount: created.montoPagadoCredito,
      commissionAgentId: created.comisionistaId,
      commissionAgentName: created.comisionista ? `${created.comisionista.persona.nombres} ${created.comisionista.persona.apellidos}` : null,
      commissionAgentAmount: created.montoComisionBruto,
      commissionAgentRetentionPercentage: created.porcentajeRetencionComision,
      commissionAgentNetPayment: created.montoComisionNeto,
      supplierCost: created.costoProveedorTotal,
      ta: created.taTotal,
      isSettled: created.comisionLiquidada,
      ticketData: data.ticketData,
      hotelData: data.hotelData,
      insuranceData: data.insuranceData,
      planData: data.planData,
      checkInData: data.checkInData,
      migrationData: data.migrationData,
      simCardData: data.simCardData,
      carRentalData: data.carRentalData,
      fincaData: data.fincaData,
      tourData: data.tourData,
      conventionData: data.conventionData,
      restaurantData: data.restaurantData,
      visaData: data.visaData,
      passportData: data.passportData,
      petServiceData: data.petServiceData
    }, null, 201);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const data = req.body;

    const venta = await prisma.ventas.findUnique({ where: { id } });
    if (!venta) return error(res, 'Venta no encontrada', 404);

    if (data.commissionAgentId) {
      const comisionista = await prisma.comisionistas.findUnique({
        where: { id: data.commissionAgentId }
      });
      if (!comisionista) {
        return error(res, 'El comisionista seleccionado no existe o fue eliminado', 400, 'COMMISSION_AGENT_NOT_FOUND');
      }
    }

    const updateData = {};
    if (data.total !== undefined) updateData.montoTotal = data.total;
    if (data.supplierCost !== undefined) updateData.costoProveedorTotal = data.supplierCost;
    if (data.ta !== undefined) updateData.taTotal = data.ta;
    if (data.status) updateData.status = data.status;
    if (data.observations !== undefined) updateData.observaciones = data.observations;
    if (data.isCredit !== undefined) updateData.esCredito = data.isCredit;
    if (data.creditDueDate) updateData.fechaVenceCredito = new Date(data.creditDueDate);
    if (data.paymentMethod) updateData.metodoPagoPrincipalId = await resolvePaymentMethodId(prisma, data.paymentMethod);
    if (data.commissionAgentId !== undefined) updateData.comisionistaId = data.commissionAgentId || null;
    if (data.responsableId !== undefined) updateData.responsableId = data.responsableId || null;
    if (data.commissionAgentAmount !== undefined) updateData.montoComisionBruto = data.commissionAgentAmount;
    if (data.commissionAgentRetentionPercentage !== undefined) updateData.porcentajeRetencionComision = data.commissionAgentRetentionPercentage;
    if (data.commissionAgentNetPayment !== undefined) updateData.montoComisionNeto = data.commissionAgentNetPayment;

    await prisma.$transaction(async (tx) => {
      await tx.ventas.update({ where: { id }, data: updateData });

      if (data.payments) {
        const existingPayments = await tx.pagosVenta.findMany({ where: { ventaId: id } });
        const existingIds = new Set(existingPayments.map(p => String(p.id)));
        const incomingIds = new Set(data.payments.map(p => String(p.id)).filter(id => id !== 'NaN'));

        for (const p of data.payments) {
          const pid = String(p.id);
          if (!existingIds.has(pid)) {
            await tx.pagosVenta.create({
              data: {
                ventaId: id,
                monto: p.amount,
                metodoPagoId: await resolvePaymentMethodId(prisma, p.method),
                referencia: p.reference || null
              }
            });
          }
        }

        for (const existing of existingPayments) {
          if (!incomingIds.has(String(existing.id))) {
            await tx.pagosVenta.delete({ where: { id: existing.id } });
          }
        }

        const totalPaid = data.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalSale = data.total || venta.montoTotal;
        const newStatus = totalPaid >= totalSale ? 'pagado' : totalPaid > 0 ? 'abonado' : 'credito';
        await tx.ventas.update({
          where: { id },
          data: { montoPagadoCredito: totalPaid, status: newStatus }
        });
      }

      const productFields = ['ticketData', 'hotelData', 'insuranceData', 'planData',
        'checkInData', 'migrationData', 'simCardData', 'carRentalData',
        'fincaData', 'tourData', 'conventionData', 'restaurantData',
        'visaData', 'passportData', 'petServiceData'];

      for (const field of productFields) {
        if (data[field] === undefined) continue;
        const handler = PRODUCT_HANDLERS[field];
        if (!handler) continue;

        const incoming = Array.isArray(data[field]) ? data[field] : [];

        const existingDetails = await tx.detalleVenta.findMany({
          where: { ventaId: id, categoria: handler.category },
          select: { id: true }
        });

        for (const item of incoming) {
          if (item.id) {
            const existing = await tx[handler.table].findUnique({ where: { id: item.id } });
            if (existing) continue;
          }
          const resolvedSupplierId = await resolveSupplierId(tx, item.supplier);
          const resolvedSupplierPaymentMethodId = await resolvePaymentMethodId(tx, item.supplierPaymentMethod);

          const detalle = await tx.detalleVenta.create({
            data: {
              ventaId: id,
              categoria: handler.category,
              nombreServicio: handler.nombreServicio,
              subtotal: (item.supplierCost || 0) + (item.ta || 0),
              costoProveedor: item.supplierCost || 0,
              ta: item.ta || 0,
              proveedorId: resolvedSupplierId,
              metodoPagoProveedorId: resolvedSupplierPaymentMethodId,
              origen: item.legs?.[0]?.origin || item.pickupLocation || null,
              destino: item.destination || item.destinationCountry || item.legs?.[0]?.destination || null,
              fechaInicioViaje: item.startDate ? new Date(item.startDate) : item.departureDate ? new Date(item.departureDate) : item.pickupDate ? new Date(item.pickupDate) : null,
              fechaFinViaje: item.endDate ? new Date(item.endDate) : item.arrivalDate ? new Date(item.arrivalDate) : item.returnDate ? new Date(item.returnDate) : null,
              observaciones: item.observations || null
            }
          });
          const productData = await handler.transform(item, detalle.id, tx);
          const product = await tx[handler.table].create({ data: productData });

          const pid = personaId;
          const passengersToCreate = [];
          if (item.passengerInfo || item.guests) {
            const passengers = item.passengerInfo ? [item.passengerInfo] : (item.guests || []);
            for (const p of passengers) {
              const resolvedPid = await findOrCreatePersona(tx, p.name || p.passengerName || p.fullName, p.docType, p.docNumber, pid);
              passengersToCreate.push({
                personaId: resolvedPid,
                esTitular: p.esTitular ?? true,
                asiento: p.asiento || item.seatNumber || item.seat || null
              });
            }
          } else {
            const passengerName = item.passengerName || item.mainDriver || item.responsibleName || item.ownerName || item.fullName || item.reservationName || item.contactName;
            const docType = item.docType;
            const docNumber = item.docNumber || item.licenseNumber || item.passportNumber || item.idNumber;
            if (passengerName || docNumber || ['checkin', 'documentacion_migratoria', 'simcard', 'tours', 'servicio_mascotas', 'renta_vehiculos'].includes(handler.category)) {
              const resolvedPid = await findOrCreatePersona(tx, passengerName, docType, docNumber, pid);
              passengersToCreate.push({
                personaId: resolvedPid,
                esTitular: true,
                asiento: item.seat || item.seatNumber || null
              });
            }
          }

          for (const passengerData of passengersToCreate) {
            await tx.pasajerosDetalle.create({
              data: {
                detalleVentaId: detalle.id,
                personaId: passengerData.personaId,
                esTitular: passengerData.esTitular,
                asiento: passengerData.asiento
              }
            });
          }

          if (handler.table === 'prodTiqueteria') {
            let currentOrden = 1;
            
            if (item.legs && item.legs.length > 0) {
              for (let i = 0; i < item.legs.length; i++) {
                const leg = item.legs[i];
                if (!leg.origin && !leg.destination) continue;
                const originAirportId = leg.origin ? await resolveAirportId(tx, leg.origin) : null;
                const destAirportId = leg.destination ? await resolveAirportId(tx, leg.destination) : null;
                if (!originAirportId || !destAirportId) continue;
                const legAirlineId = (leg.airline || item.airline) ? await resolveAirlineId(tx, leg.airline || item.airline) : null;
                const legBaggagePlanId = (leg.baggagePlan || item.baggagePlan) ? await resolveBaggagePlanId(tx, leg.baggagePlan || item.baggagePlan) : null;
                await tx.tramosVuelo.create({
                  data: {
                    prodTiqueteriaId: product.id,
                    aeropuertoOrigenId: originAirportId,
                    aeropuertoDestinoId: destAirportId,
                    salida: leg.date ? new Date(leg.date) : new Date(),
                    llegada: leg.arrivalDate ? new Date(leg.arrivalDate) : (leg.date ? new Date(leg.date) : new Date()),
                    nroVueloTramo: leg.flightNumber || null,
                    asiento: leg.seat || null,
                    nroTiquete: leg.ticketNumber || null,
                    aerolineaId: legAirlineId,
                    planEquipajeId: legBaggagePlanId,
                    orden: currentOrden++
                  }
                });
              }
            }

            if (item.hasStops && item.outboundStops && item.outboundStops.length > 0) {
              for (const stop of item.outboundStops) {
                if (!stop.origin && !stop.destination) continue;
                const sOriginId = stop.origin ? await resolveAirportId(tx, stop.origin) : null;
                const sDestId = stop.destination ? await resolveAirportId(tx, stop.destination) : null;
                if (!sOriginId || !sDestId) continue;
                const stopAirlineId = (stop.airline || item.airline) ? await resolveAirlineId(tx, stop.airline || item.airline) : null;
                const stopBaggagePlanId = (stop.baggagePlan || item.baggagePlan) ? await resolveBaggagePlanId(tx, stop.baggagePlan || item.baggagePlan) : null;
                await tx.tramosVuelo.create({
                  data: {
                    prodTiqueteriaId: product.id,
                    aeropuertoOrigenId: sOriginId,
                    aeropuertoDestinoId: sDestId,
                    salida: stop.date ? new Date(stop.date) : new Date(),
                    llegada: stop.arrivalDate ? new Date(stop.arrivalDate) : (stop.date ? new Date(stop.date) : new Date()),
                    nroVueloTramo: stop.flightNumber || null,
                    asiento: stop.seat || null,
                    nroTiquete: stop.ticketNumber || null,
                    aerolineaId: stopAirlineId,
                    planEquipajeId: stopBaggagePlanId,
                    orden: currentOrden++
                  }
                });
              }
            }

            if (item.returnLeg && item.returnLeg.origin && item.returnLeg.destination) {
              const rLeg = item.returnLeg;
              const rOriginId = await resolveAirportId(tx, rLeg.origin);
              const rDestId = await resolveAirportId(tx, rLeg.destination);
              if (rOriginId && rDestId) {
                const rAirlineId = (rLeg.airline || item.airline) ? await resolveAirlineId(tx, rLeg.airline || item.airline) : null;
                const rBaggagePlanId = (rLeg.baggagePlan || item.baggagePlan) ? await resolveBaggagePlanId(tx, rLeg.baggagePlan || item.baggagePlan) : null;
                await tx.tramosVuelo.create({
                  data: {
                    prodTiqueteriaId: product.id,
                    aeropuertoOrigenId: rOriginId,
                    aeropuertoDestinoId: rDestId,
                    salida: rLeg.date ? new Date(rLeg.date) : new Date(),
                    llegada: rLeg.arrivalDate ? new Date(rLeg.arrivalDate) : (rLeg.date ? new Date(rLeg.date) : new Date()),
                    nroVueloTramo: rLeg.flightNumber || null,
                    asiento: rLeg.seat || null,
                    nroTiquete: rLeg.ticketNumber || null,
                    aerolineaId: rAirlineId,
                    planEquipajeId: rBaggagePlanId,
                    orden: currentOrden++
                  }
                });
              }
            }

            if (item.returnHasStops && item.returnStops && item.returnStops.length > 0) {
              for (const stop of item.returnStops) {
                if (!stop.origin && !stop.destination) continue;
                const sOriginId = stop.origin ? await resolveAirportId(tx, stop.origin) : null;
                const sDestId = stop.destination ? await resolveAirportId(tx, stop.destination) : null;
                if (!sOriginId || !sDestId) continue;
                const stopAirlineId = (stop.airline || item.airline) ? await resolveAirlineId(tx, stop.airline || item.airline) : null;
                const stopBaggagePlanId = (stop.baggagePlan || item.baggagePlan) ? await resolveBaggagePlanId(tx, stop.baggagePlan || item.baggagePlan) : null;
                await tx.tramosVuelo.create({
                  data: {
                    prodTiqueteriaId: product.id,
                    aeropuertoOrigenId: sOriginId,
                    aeropuertoDestinoId: sDestId,
                    salida: stop.date ? new Date(stop.date) : new Date(),
                    llegada: stop.arrivalDate ? new Date(stop.arrivalDate) : (stop.date ? new Date(stop.date) : new Date()),
                    nroVueloTramo: stop.flightNumber || null,
                    asiento: stop.seat || null,
                    nroTiquete: stop.ticketNumber || null,
                    aerolineaId: stopAirlineId,
                    planEquipajeId: stopBaggagePlanId,
                    orden: currentOrden++
                  }
                });
              }
            }
          }
        }

        if (incoming.length === 0 && existingDetails.length > 0) {
          for (const d of existingDetails) {
            await tx.pasajerosDetalle.deleteMany({ where: { detalleVentaId: d.id } });
            const product = await tx[handler.table].findFirst({ where: { detalleVentaId: d.id } });
            if (product) {
              if (handler.table === 'prodTiqueteria') {
                await tx.tramosVuelo.deleteMany({ where: { prodTiqueteriaId: product.id } });
              }
              await tx[handler.table].delete({ where: { id: product.id } });
            }
            await tx.detalleVenta.delete({ where: { id: d.id } });
          }
        }
      }
    }, {
      maxWait: 15000,
      timeout: 30000
    });

    success(res, { message: 'Venta actualizada' });
  } catch (err) {
    next(err);
  }
};

exports.voidSale = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ status: 'error', message: 'Debe proporcionar un motivo para anular la venta' });
    }

    const venta = await prisma.ventas.findUnique({ where: { id } });
    if (!venta) {
      return res.status(404).json({ status: 'error', message: 'Venta no encontrada' });
    }

    const newObservaciones = venta.observaciones 
      ? `${venta.observaciones}\n[ANULADA] Motivo: ${reason}` 
      : `[ANULADA] Motivo: ${reason}`;

    await prisma.ventas.update({
      where: { id },
      data: { 
        status: 'anulado',
        observaciones: newObservaciones
      }
    });
    
    success(res, { message: 'Venta anulada correctamente' });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.ventas.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    success(res, { message: 'Venta eliminada' });
  } catch (err) {
    next(err);
  }
};

exports.registerPayment = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { amount, isTotal, method, reference, currentPaidAmount, saleTotal } = req.body;

    // If client sends totals, we can skip the findUnique — faster path
    let newPaidAmount, newStatus;
    const metodoPagoId = await resolvePaymentMethodId(prisma, method);

    if (saleTotal !== undefined && currentPaidAmount !== undefined) {
      newPaidAmount = isTotal ? saleTotal : (currentPaidAmount || 0) + amount;
      newStatus = (isTotal || newPaidAmount >= saleTotal) ? 'pagado' : 'abonado';
    } else {
      // Fallback: fetch the venta
      const venta = await prisma.ventas.findUnique({ where: { id }, select: { montoTotal: true, montoPagadoCredito: true } });
      if (!venta) return error(res, 'Venta no encontrada', 404);
      const currentPaid = venta.montoPagadoCredito || 0;
      newPaidAmount = isTotal ? venta.montoTotal : currentPaid + amount;
      newStatus = (isTotal || newPaidAmount >= venta.montoTotal) ? 'pagado' : 'abonado';
    }

    let newPayment;
    await prisma.$transaction(async (tx) => {
      newPayment = await tx.pagosVenta.create({
        data: { ventaId: id, monto: amount, metodoPagoId, referencia: reference || null }
      });
      await tx.ventas.update({
        where: { id },
        data: { montoPagadoCredito: newPaidAmount, status: newStatus }
      });
    });

    success(res, {
      creditPaidAmount: newPaidAmount,
      status: newStatus,
      payment: {
        id: newPayment.id,
        date: newPayment.fechaPago,
        amount: newPayment.monto,
        method: method || null
      }
    });
  } catch (err) {
    next(err);
  }
};


exports.deletePayment = async (req, res, next) => {
  try {
    const saleId = parseInt(req.params.saleId);
    const paymentId = req.params.paymentId;
    const { currentPayments, saleTotal } = req.body || {};

    // Validate ownership quickly
    const payment = await prisma.pagosVenta.findUnique({
      where: { id: paymentId },
      select: { id: true, ventaId: true, monto: true }
    });
    if (!payment) return error(res, 'Pago no encontrado', 404);
    if (payment.ventaId !== saleId) return error(res, 'El pago no pertenece a esta venta', 400);

    let newPaidAmount = 0;
    let newStatus = 'credito';

    // If client sends current state, compute without extra DB query inside transaction
    if (Array.isArray(currentPayments) && saleTotal !== undefined) {
      newPaidAmount = currentPayments
        .filter(p => p.id !== paymentId)
        .reduce((sum, p) => sum + p.amount, 0);
      newStatus = newPaidAmount >= saleTotal ? 'pagado' : newPaidAmount > 0 ? 'abonado' : 'credito';

      await prisma.$transaction([
        prisma.pagosVenta.delete({ where: { id: paymentId } }),
        prisma.ventas.update({
          where: { id: saleId },
          data: { montoPagadoCredito: newPaidAmount, status: newStatus }
        })
      ]);
    } else {
      // Fallback path
      await prisma.$transaction(async (tx) => {
        await tx.pagosVenta.delete({ where: { id: paymentId } });
        const remainingPayments = await tx.pagosVenta.findMany({ where: { ventaId: saleId }, select: { monto: true } });
        newPaidAmount = remainingPayments.reduce((sum, p) => sum + p.monto, 0);
        const venta = await tx.ventas.findUnique({ where: { id: saleId }, select: { montoTotal: true } });
        newStatus = newPaidAmount >= venta.montoTotal ? 'pagado' : newPaidAmount > 0 ? 'abonado' : 'credito';
        await tx.ventas.update({
          where: { id: saleId },
          data: { montoPagadoCredito: newPaidAmount, status: newStatus }
        });
      });
    }

    success(res, { message: 'Pago eliminado', creditPaidAmount: newPaidAmount, status: newStatus });
  } catch (err) {
    next(err);
  }
};

exports.deleteSale = async (req, res, next) => {
  try {
    const saleId = parseInt(req.params.id);

    await prisma.ventas.delete({
      where: { id: saleId }
    });

    success(res, null, 'Venta eliminada exitosamente.');
  } catch (err) {
    next(err);
  }
};

exports.updateReviewStatus = async (req, res, next) => {
  try {
    const saleId = parseInt(req.params.id);
    const { isReviewed } = req.body;

    const sale = await prisma.ventas.findUnique({ where: { id: saleId } });
    if (!sale) return error(res, 'Venta no encontrada', 404);
    if (sale.status !== 'pagado') return error(res, 'La venta debe estar pagada para ser revisada', 400);
    if (sale.isReviewed) return error(res, 'Esta venta ya fue revisada y no se puede modificar su estado', 400);

    const updatedSale = await prisma.ventas.update({
      where: { id: saleId },
      data: { isReviewed }
    });

    success(res, updatedSale, 'Estado de revisión actualizado');
  } catch (err) {
    next(err);
  }
};

exports.listPayments = async (req, res, next) => {
  try {
    const saleId = parseInt(req.params.id);
    const payments = await prisma.pagosVenta.findMany({
      where: { ventaId: saleId },
      select: {
        id: true,
        fechaPago: true,
        monto: true,
        metodoPago: { select: { nombre: true } }
      },
      orderBy: { fechaPago: 'asc' }
    });

    const formatted = payments.map(p => ({
      id: p.id,
      date: p.fechaPago,
      amount: p.monto,
      method: p.metodoPago?.nombre || null
    }));

    success(res, formatted);
  } catch (err) {
    next(err);
  }
};

exports.sendVoucher = async (req, res, next) => {
  try {
    const saleId = parseInt(req.params.id);
    const { pdfBase64 } = req.body;

    if (!pdfBase64) {
      return error(res, 'El PDF es requerido (base64)', 400);
    }

    // Obtener datos de la venta con cliente y asesor
    const venta = await prisma.ventas.findUnique({
      where: { id: saleId },
      include: {
        cliente: {
          include: { persona: true }
        },
        usuario: {
          include: { persona: true }
        },
        detalleVentas: true
      }
    });

    if (!venta) {
      return error(res, 'Venta no encontrada', 404);
    }

    const clientEmail = venta.cliente.persona.email;
    if (!clientEmail) {
      return error(res, 'El cliente no tiene correo electrónico registrado', 400);
    }

    const clientName = `${venta.cliente.persona.nombres} ${venta.cliente.persona.apellidos}`;
    const asesorName = `${venta.usuario.persona.nombres} ${venta.usuario.persona.apellidos}`;

    // Construir lista de servicios para el cuerpo del correo
    const serviciosMap = {
      tiqueteria: 'Tiquetería Aérea',
      hoteleria: 'Hotelería',
      seguros_viaje: 'Seguro de Viaje',
      planes: 'Paquete Turístico',
      checkin: 'Servicio de Check-in',
      documentacion_migratoria: 'Documentación Migratoria',
      simcard: 'SIM Card Internacional',
      renta_vehiculos: 'Renta de Vehículo',
      renta_fincas: 'Renta de Finca',
      tours: 'Tour',
      centros_convencion: 'Centro de Convención',
      restaurantes: 'Reserva en Restaurante',
      visa: 'Trámite de Visa',
      pasaporte: 'Trámite de Pasaporte',
      servicio_mascotas: 'Transporte de Mascotas'
    };

    const serviciosIncluidos = [...new Set(venta.detalleVentas.map(d => serviciosMap[d.categoria] || d.categoria))];
    const serviciosHtml = serviciosIncluidos.length > 0
      ? serviciosIncluidos.map(s => `<li style="margin-bottom:6px;">✅ ${s}</li>`).join('')
      : '<li>Servicio de viaje contratado</li>';

    const fechaEmision = new Date().toLocaleDateString('es-CO', {
      day: '2-digit', month: 'long', year: 'numeric'
    });

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Voucher de Viaje - iTea Travel Agency</title>
      </head>
      <body style="margin:0;padding:0;background:#f4f7fb;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

                <!-- HEADER -->
                <tr>
                  <td style="background:linear-gradient(135deg,#032650 0%,#0b396b 60%,#021a36 100%);padding:32px 40px;text-align:center;">
                    <div style="font-size:32px;font-weight:900;color:#ffffff;letter-spacing:3px;font-family:'Montserrat',sans-serif;">
                      i<span style="color:#07818e;">T</span>ea
                    </div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.55);letter-spacing:4px;text-transform:uppercase;margin-top:4px;">
                      Travel Agency
                    </div>
                  </td>
                </tr>

                <!-- GREETING -->
                <tr>
                  <td style="padding:36px 40px 24px;">
                    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#032650;">
                      ¡Hola, ${clientName}! 👋
                    </h1>
                    <p style="margin:0;font-size:15px;color:#475569;line-height:1.7;">
                      Nos complace confirmar tu reserva. Adjunto a este correo encontrarás tu 
                      <strong style="color:#032650;">voucher oficial de viaje</strong> correspondiente a la 
                      <strong style="color:#07818e;">Orden #${saleId}</strong>.
                    </p>
                  </td>
                </tr>

                <!-- DIVIDER -->
                <tr>
                  <td style="padding:0 40px;">
                    <hr style="border:none;border-top:2px solid #e2e8f0;margin:0;">
                  </td>
                </tr>

                <!-- SERVICES SECTION -->
                <tr>
                  <td style="padding:28px 40px;">
                    <h2 style="margin:0 0 16px;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#032650;border-left:4px solid #07818e;padding-left:12px;">
                      Servicios Incluidos en tu Orden
                    </h2>
                    <ul style="margin:0;padding-left:20px;color:#334155;font-size:14px;line-height:1.9;">
                      ${serviciosHtml}
                    </ul>
                  </td>
                </tr>

                <!-- INFO BOX -->
                <tr>
                  <td style="padding:0 40px 28px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:20px;">
                      <tr>
                        <td style="padding:16px 20px;">
                          <p style="margin:0 0 10px;font-size:13px;color:#0369a1;font-weight:700;text-transform:uppercase;letter-spacing:1px;">
                            📋 Detalle de tu Reserva
                          </p>
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding:5px 0;font-size:13px;color:#64748b;width:140px;">Orden N°:</td>
                              <td style="padding:5px 0;font-size:13px;font-weight:700;color:#032650;">#${saleId}</td>
                            </tr>
                            <tr>
                              <td style="padding:5px 0;font-size:13px;color:#64748b;">Pasajero:</td>
                              <td style="padding:5px 0;font-size:13px;font-weight:700;color:#032650;">${clientName}</td>
                            </tr>
                            <tr>
                              <td style="padding:5px 0;font-size:13px;color:#64748b;">Asesor:</td>
                              <td style="padding:5px 0;font-size:13px;font-weight:600;color:#032650;">${asesorName}</td>
                            </tr>
                            <tr>
                              <td style="padding:5px 0;font-size:13px;color:#64748b;">Fecha de emisión:</td>
                              <td style="padding:5px 0;font-size:13px;color:#032650;">${fechaEmision}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- NOTE -->
                <tr>
                  <td style="padding:0 40px 28px;">
                    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.7;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;">
                      ⚠️ <strong style="color:#92400e;">Importante:</strong> Recuerda reconfirmar el horario de tus vuelos y servicios 
                      entre <strong>24 y 48 horas antes</strong> de la salida. Verifica que cuentes con todos los 
                      documentos necesarios para viajar.
                    </p>
                  </td>
                </tr>

                <!-- DIVIDER -->
                <tr>
                  <td style="padding:0 40px;">
                    <hr style="border:none;border-top:2px solid #e2e8f0;margin:0;">
                  </td>
                </tr>

                <!-- CLOSING -->
                <tr>
                  <td style="padding:28px 40px 36px;">
                    <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.7;">
                      El voucher completo con todos los detalles de tu reserva se encuentra adjunto en este correo en formato PDF.
                    </p>
                    <p style="margin:0;font-size:14px;color:#475569;line-height:1.7;">
                      Gracias por confiar en <strong style="color:#032650;">iTea Travel Agency</strong>. 
                      ¡Te deseamos un excelente viaje! ✈️
                    </p>
                  </td>
                </tr>

                <!-- FOOTER -->
                <tr>
                  <td style="background:linear-gradient(135deg,#021a36 0%,#032650 50%,#0b396b 100%);border-top:4px solid #07818e;padding:20px 40px;text-align:center;">
                    <p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.55);letter-spacing:1px;">
                      iTea Travel Agency &nbsp;|&nbsp; Carrera 65A 13-157, Aeropuerto Olaya Herrera, Medellín
                    </p>
                    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.45);">
                      info@itea.com.co &nbsp;|&nbsp; +57 (312) 875 15 89
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Convertir base64 a Buffer para adjuntar
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const fileName = `Voucher_iTea_Orden_${saleId}_${clientName.replace(/\s+/g, '_')}.pdf`;

    const emailResult = await emailService.sendEmail({
      to: clientEmail,
      subject: `✈ Tu Voucher de Viaje - Orden #${saleId} | iTea Travel Agency`,
      html,
      attachments: [
        {
          filename: fileName,
          content: pdfBuffer
        }
      ]
    });

    if (!emailResult.success) {
      const errMsg = emailResult.error?.message || 'Error al enviar el correo. Intenta de nuevo.';
      return error(res, errMsg, 500);
    }

    success(res, { message: `Voucher enviado a ${clientEmail}`, email: clientEmail });
  } catch (err) {
    next(err);
  }
};
