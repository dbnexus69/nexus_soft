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
          v.comisionista_id as "comisionistaId",
          v.monto_comision_bruto as "montoComisionBruto",
          v.monto_comision_neto as "montoComisionNeto",
          v.costo_proveedor_total as "costoProveedorTotal",
          v.ta_total as "taTotal",
          v.comision_liquidada as "comisionLiquidada",
          cp.nombres || ' ' || cp.apellidos as "clientName",
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
        asesorId: v.usuarioId,
        asesorName: v.asesorName,
        date: v.creadoAt,
        total: v.montoTotal,
        status: v.status,
        observations: v.observaciones,
        isCredit: v.esCredito,
        creditDueDate: v.fechaVenceCredito,
        creditPaidAmount: v.montoPagadoCredito,
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
        tramosVuelo: { include: { aeropuertoOrigen: true, aeropuertoDestino: true } },
        aerolinea: true
      }
    }
  },
  hoteleria: { prodHoteleria: true },
  seguros: { prodSeguros: true },
  planes: { prodPlanes: { include: { paquete: true, aerolinea: true } } },
  checkin: { prodCheckins: true },
  migracion: { prodMigracion: true },
  simcard: { prodSimcards: true },
  autos: { prodAutos: true },
  fincas: { prodFincas: true },
  tours: { prodTours: true },
  eventos: { prodEventos: true },
  restaurantes: { prodRestaurantes: true },
  visas: { prodVisas: true },
  pasaportes: { prodPasaportes: true },
  mascotas: { prodMascotas: true }
};

function mapPassengers(detalle) {
  return (detalle.pasajerosDetalle || []).map(p => ({
    id: p.id,
    personaId: p.personaId,
    esTitular: p.esTitular,
    asiento: p.asiento,
    nombreCompleto: p.persona ? `${p.persona.nombres} ${p.persona.apellidos}` : null,
    tipoDocumento: p.persona?.tipoDocumentoId,
    nroDocumento: p.persona?.documento
  }));
}

function mapLegs(legs) {
  return (legs || []).map(l => ({
    origin: l.aeropuertoOrigen?.codigoIata || null,
    destination: l.aeropuertoDestino?.codigoIata || null,
    flightNumber: l.nroVueloTramo,
    seat: l.asiento || null,
    date: l.salida?.toISOString() || null
  }));
}

const PRODUCT_TRANSFORMS = {
  tiqueteria(d, passengers, target) {
    const t = d.prodTiqueteria;
    target.push({
      id: t.id,
      airline: String(t.aerolineaId || ''),
      airlineName: t.aerolinea?.nombre || null,
      reservationNumber: t.nroReserva,
      flightNumber: t.nroVuelo,
      ticketNumber: t.nroTiquete,
      flightMode: t.modoVuelo,
      checkinStatus: t.checkinStatus,
      legs: mapLegs(t.tramosVuelo),
      passengerInfo: passengers.length > 0
        ? { name: passengers[0].nombreCompleto, docType: passengers[0].tipoDocumento, docNumber: passengers[0].nroDocumento }
        : null
    });
  },
  hoteleria(d, passengers, target) {
    const h = d.prodHoteleria;
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
    });
  },
  seguros(d, passengers, target) {
    const s = d.prodSeguros;
    target.push({
      id: s.id,
      insuranceType: s.tipoSeguro,
      coverageAmount: s.coberturaUsd,
      coverageDays: s.diasCobertura,
      contactName: s.contactoEmergencia,
      contactNumber: s.telefonoEmergencia,
      address: s.direccionAsegurado,
      members: passengers.map(p => ({ name: p.nombreCompleto, docType: String(p.tipoDocumento || ''), docNumber: p.nroDocumento || '' }))
    });
  },
  planes(d, passengers, target) {
    const p = d.prodPlanes;
    target.push({
      id: p.id,
      planName: p.nombrePlan,
      packageId: p.paqueteId,
      packageName: p.paquete?.nombre || null,
      airline: String(p.aerolineaId || ''),
      airlineName: p.aerolinea?.nombre || null,
      reservationNumber: p.nroReserva,
      ticketNumber: p.nroTiquete,
      startDate: p.fechaViajeInicio?.toISOString().split('T')[0] || null,
      endDate: p.fechaViajeFin?.toISOString().split('T')[0] || null,
      flightDepartureDate: p.fechaSalidaVuelo?.toISOString() || null,
      flightReturnDate: p.fechaRegresoVuelo?.toISOString() || null,
      adultsCount: p.adultosCount,
      childrenCount: p.menoresCount,
      confirmationNumber: p.numeroConfirmacion,
      observations: p.observaciones,
      guests: passengers.map(p => ({ name: p.nombreCompleto, docType: String(p.tipoDocumento || ''), docNumber: p.nroDocumento || '' }))
    });
  },
  checkin(d, passengers, target) {
    const c = d.prodCheckins;
    target.push({
      id: c.id,
      flightOrReservation: c.nroVueloReserva,
      travelDate: c.fechaViaje?.toISOString() || null,
      seat: c.asiento,
      baggage: c.maletasContadas,
      phone: c.telefonoContacto,
      specialNeeds: c.necesidadesEspeciales,
      needsWheelchair: c.usaSillaRuedas
    });
  },
  migracion(d, passengers, target) {
    const m = d.prodMigracion;
    target.push({
      id: m.id,
      requestedDocType: m.tipoTramiteMigratorio,
      nationality: m.nacionalidad,
      passportNumber: m.pasaporteNro,
      passportExpiry: m.pasaporteVence?.toISOString() || null,
      destinationCountry: m.paisDestino
    });
  },
  simcard(d, passengers, target) {
    const s = d.prodSimcards;
    target.push({
      id: s.id,
      destinationCountry: s.paisDestino,
      arrivalDate: s.fechaLlegada?.toISOString() || null,
      tripDuration: s.duracionViaje,
      dataPlan: s.planDatos,
      simType: s.tipoSim,
      deliveryMethod: s.metodoEntrega
    });
  },
  autos(d, passengers, target) {
    const a = d.prodAutos;
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
    });
  },
  fincas(d, passengers, target) {
    const f = d.prodFincas;
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
      additionalServices: f.serviciosExtra?.split(', ') || []
    });
  },
  tours(d, passengers, target) {
    const t = d.prodTours;
    target.push({
      id: t.id,
      selectedTour: t.tourNombre,
      preferredDate: t.fechaPreferida?.toISOString() || null,
      adultsCount: t.adultosCount,
      childrenCount: t.menoresCount,
      childrenAges: t.edadesMenores,
      guideLanguage: t.idiomaGuia,
      needsTransport: t.requiereTransporte,
      pickupPoint: t.puntoEncuentro,
      medicalConditions: t.condicionesMedicas,
      phone: t.telefonoContacto
    });
  },
  eventos(d, passengers, target) {
    const e = d.prodEventos;
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
      cateringNotes: e.notasCatering
    });
  },
  restaurantes(d, passengers, target) {
    const r = d.prodRestaurantes;
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
    });
  },
  visas(d, passengers, target) {
    const v = d.prodVisas;
    target.push({
      id: v.id,
      fullName: v.nombreCompleto,
      birthDate: v.fechaNacimiento?.toISOString() || null,
      nationality: v.nacionalidad,
      passportNumber: v.nroPasaporte,
      passportExpiration: v.vencimientoPasaporte?.toISOString() || null,
      countryApplying: v.paisAplicacion,
      visaType: v.tipoVisa,
      estimatedTravelDate: v.fechaEstimadaViaje?.toISOString() || null,
      email: v.emailContacto
    });
  },
  pasaportes(d, passengers, target) {
    const p = d.prodPasaportes;
    target.push({
      id: p.id,
      fullName: p.nombreCompleto,
      idNumber: p.nroDocumento,
      birthDate: p.fechaNacimiento?.toISOString() || null,
      residenceCity: p.ciudadResidencia,
      processType: p.tipoTramite,
      estimatedTravelDate: p.fechaEstimadaViaje?.toISOString() || null,
      phone: p.telefonoContacto
    });
  },
  mascotas(d, passengers, target) {
    const m = d.prodMascotas;
    target.push({
      id: m.id,
      ownerName: null,
      petName: m.mascotaNombre,
      species: m.especie,
      breed: m.raza,
      weight: m.pesoKg,
      size: m.tamanoMascota,
      travelType: m.transporteTipo,
      travelDate: m.fechaViaje?.toISOString() || null,
      destinationCountry: m.paisDestino,
      medicalConditions: m.condicionesMedicas,
      phone: m.telefonoContacto
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
        handler(d, passengers, (resultMap[d.categoria] = resultMap[d.categoria] || []));
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
      observations: venta.observaciones,
      isCredit: venta.esCredito,
      creditDueDate: venta.fechaVenceCredito,
      creditPaidAmount: venta.montoPagadoCredito,
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
      ticketData: resultMap.tiqueteria,
      hotelData: resultMap.hoteleria,
      insuranceData: resultMap.seguros,
      planData: resultMap.planes,
      checkInData: resultMap.checkin,
      migrationData: resultMap.migracion,
      simCardData: resultMap.simcard,
      carRentalData: resultMap.autos,
      fincaData: resultMap.fincas,
      tourData: resultMap.tours,
      conventionData: resultMap.eventos,
      restaurantData: resultMap.restaurantes,
      visaData: resultMap.visas,
      passportData: resultMap.pasaportes,
      petServiceData: resultMap.mascotas
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
      coberturaUsd: d.coverageAmount || 0,
      diasCobertura: d.coverageDays || 0,
      contactoEmergencia: d.contactName || null,
      telefonoEmergencia: d.contactNumber || null,
      direccionAsegurado: d.address || null
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
        nombrePlan: d.planName || null,
        aerolineaId,
        nroReserva: d.reservationNumber || null,
        nroTiquete: d.ticketNumber || null,
        fechaViajeInicio: d.startDate ? new Date(d.startDate) : null,
        fechaViajeFin: d.endDate ? new Date(d.endDate) : null,
        fechaSalidaVuelo: d.flightDepartureDate ? new Date(d.flightDepartureDate) : null,
        fechaRegresoVuelo: d.flightReturnDate ? new Date(d.flightReturnDate) : null,
        adultosCount: d.adultsCount || 0,
        menoresCount: d.childrenCount || 0,
        observaciones: d.observations || null
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
      pasaporteNro: d.passportNumber || null,
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
      tipoSeguro: d.insuranceType || null,
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
      serviciosExtra: d.additionalServices?.join(', ') || null
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
      telefonoContacto: d.phone || null
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
      notasCatering: d.cateringNotes || null
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
      nroPasaporte: d.passportNumber || null,
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
      tamanoMascota: d.size || null,
      transporteTipo: d.travelType || null,
      fechaViaje: d.travelDate ? new Date(d.travelDate) : null,
      paisDestino: d.destinationCountry || null,
      condicionesMedicas: d.medicalConditions || null,
      telefonoContacto: d.phone || null
    })
  }
};

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

        if (personaId && (item.passengerInfo || item.guests)) {
          const passengers = item.passengerInfo ? [item.passengerInfo] : (item.guests || []);
          for (const p of passengers) {
            await tx.pasajerosDetalle.create({
              data: {
                detalleVentaId: detalle.id,
                personaId,
                esTitular: true,
                asiento: item.seatNumber || null
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
            await tx.tramosVuelo.create({
              data: {
                prodTiqueteriaId: product.id,
                aeropuertoOrigenId: originAirportId,
                aeropuertoDestinoId: destAirportId,
                salida: leg.date ? new Date(leg.date) : new Date(),
                llegada: leg.date ? new Date(leg.date) : new Date(),
                nroVueloTramo: leg.flightNumber || null,
                asiento: leg.seat || null,
                orden: i + 1
              }
            });
          }

          if (item.returnLeg && item.returnLeg.origin && item.returnLeg.destination) {
            const rLeg = item.returnLeg;
            const rOriginId = await resolveAirportId(tx, rLeg.origin, memCache);
            const rDestId = await resolveAirportId(tx, rLeg.destination, memCache);
            if (rOriginId && rDestId) {
              await tx.tramosVuelo.create({
                data: {
                  prodTiqueteriaId: product.id,
                  aeropuertoOrigenId: rOriginId,
                  aeropuertoDestinoId: rDestId,
                  salida: rLeg.date ? new Date(rLeg.date) : new Date(),
                  llegada: rLeg.date ? new Date(rLeg.date) : new Date(),
                  nroVueloTramo: rLeg.flightNumber || null,
                  asiento: rLeg.seat || null,
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
      const personaId = cliente?.personaId;

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
          if (personaId && (item.passengerInfo || item.guests)) {
            const passengers = item.passengerInfo ? [item.passengerInfo] : (item.guests || []);
            for (const p of passengers) {
              pasajerosDetalleData.push({
                personaId,
                esTitular: true,
                asiento: item.seatNumber || null
              });
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
              const [originAirportId, destAirportId] = await Promise.all([
                leg.origin ? resolveAirportId(tx, leg.origin, memCache) : null,
                leg.destination ? resolveAirportId(tx, leg.destination, memCache) : null
              ]);
              if (originAirportId && destAirportId) {
                tramosVueloData.push({
                  aeropuertoOrigenId: originAirportId,
                  aeropuertoDestinoId: destAirportId,
                  salida: leg.date ? new Date(leg.date) : new Date(),
                  llegada: leg.date ? new Date(leg.date) : new Date(),
                  nroVueloTramo: leg.flightNumber || null,
                  asiento: leg.seat || null,
                  orden: i + 1
                });
              }
            }
            if (item.returnLeg && item.returnLeg.origin && item.returnLeg.destination) {
              const rLeg = item.returnLeg;
              const [rOriginId, rDestId] = await Promise.all([
                resolveAirportId(tx, rLeg.origin, memCache),
                resolveAirportId(tx, rLeg.destination, memCache)
              ]);
              if (rOriginId && rDestId) {
                tramosVueloData.push({
                  aeropuertoOrigenId: rOriginId,
                  aeropuertoDestinoId: rDestId,
                  salida: rLeg.date ? new Date(rLeg.date) : new Date(),
                  llegada: rLeg.date ? new Date(rLeg.date) : new Date(),
                  nroVueloTramo: rLeg.flightNumber || null,
                  asiento: rLeg.seat || null,
                  orden: (item.legs?.length || 0) + 1
                });
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
        cliente: { select: { persona: { select: { nombres: true, apellidos: true, email: true } } } },
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
          if (item.voucher && item.voucher.base64 && item.sendVoucher) {
            try {
              const base64Data = item.voucher.base64.split(',')[1] || item.voucher.base64;
              const buffer = Buffer.from(base64Data, 'base64');
              console.log(`[VOUCHER] Sending email to ${clientEmail} for ${handler.nombreServicio}...`);
              const result = await emailService.sendEmail({
                to: clientEmail,
                subject: `Tu voucher de ${handler.nombreServicio} - Curinoupel`,
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
                attachments: [
                  {
                    filename: item.voucher.name || 'voucher.pdf',
                    content: buffer
                  }
                ]
              });
              console.log(`[VOUCHER] sendEmail result:`, JSON.stringify(result));
            } catch (err) {
              console.error('[ERROR] Sending voucher email:', err.message);
            }
          }
        }
      }
    }

    success(res, {
      id: created.id,
      clientId: created.clienteId,
      clientName: `${created.cliente.persona.nombres} ${created.cliente.persona.apellidos}`,
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

          if (item.passengerInfo || item.guests) {
            const cliente = await tx.clientes.findUnique({
              where: { id: venta.clienteId },
              select: { personaId: true }
            });
            const pid = cliente?.personaId;
            if (pid) {
              const passengers = item.passengerInfo ? [item.passengerInfo] : (item.guests || []);
              for (const p of passengers) {
                await tx.pasajerosDetalle.create({
                  data: {
                    detalleVentaId: detalle.id,
                    personaId: pid,
                    esTitular: true,
                    asiento: item.seatNumber || null
                  }
                });
              }
            }
          }

          if (handler.table === 'prodTiqueteria' && item.legs && item.legs.length > 0) {
            for (let i = 0; i < item.legs.length; i++) {
              const leg = item.legs[i];
              const originAirport = leg.origin ? await tx.aeropuertos.findFirst({ where: { codigoIata: leg.origin } }) : null;
              const destAirport = leg.destination ? await tx.aeropuertos.findFirst({ where: { codigoIata: leg.destination } }) : null;
              if (!originAirport || !destAirport) continue;
              await tx.tramosVuelo.create({
                data: {
                  prodTiqueteriaId: product.id,
                  aeropuertoOrigenId: originAirport.id,
                  aeropuertoDestinoId: destAirport.id,
                  salida: leg.date ? new Date(leg.date) : new Date(),
                  llegada: leg.date ? new Date(leg.date) : new Date(),
                  nroVueloTramo: leg.flightNumber || null,
                  orden: i + 1
                }
              });
            }
          }

          if (handler.table === 'prodTiqueteria' && item.returnLeg && item.returnLeg.origin && item.returnLeg.destination) {
            const leg = item.returnLeg;
            const originAirport = await tx.aeropuertos.findFirst({ where: { codigoIata: leg.origin } });
            const destAirport = await tx.aeropuertos.findFirst({ where: { codigoIata: leg.destination } });
            if (originAirport && destAirport) {
              await tx.tramosVuelo.create({
                data: {
                  prodTiqueteriaId: product.id,
                  aeropuertoOrigenId: originAirport.id,
                  aeropuertoDestinoId: destAirport.id,
                  salida: leg.date ? new Date(leg.date) : new Date(),
                  llegada: leg.date ? new Date(leg.date) : new Date(),
                  nroVueloTramo: leg.flightNumber || null,
                  orden: (item.legs?.length || 0) + 1
                }
              });
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
