const prisma = require('../config/db');
const { NotFoundError, BadRequestError } = require('../errors/AppError');
const { buildMeta } = require('../utils/paginationHelper');
const emailService = require('../utils/emailService');

// Helpers y maps de transformación de productos
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
    persona_id: p.persona_id,
    esTitular: p.esTitular,
    asiento: p.asiento,
    nombreCompleto: p.persona ? `${p.personas.nombres} ${p.personas.apellidos}` : null,
    tipos_documento: p.persona?.tipo_documento_id,
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
  return sorted.map(l => ({
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
  }));
}

const PRODUCT_TRANSFORMS = {
  tiqueteria(d, passengers, target) {
    const t = d.prodTiqueteria;
    if (!t) return;
    target.push({
      id: t.id,
      airline: String(t.aerolinea_id || ''),
      airlineName: t.aerolinea?.nombre || null,
      reservationNumber: t.nroReserva || '',
      flightNumber: t.nroVuelo || '',
      ticketNumber: t.nroTiquete || '',
      flightMode: t.modoVuelo || 'one_way',
      baggagePlan: String(t.planEquipajeId || ''),
      baggagePlanName: t.planEquipaje ? `${t.planEquipaje.aerolinea?.nombre || t.aerolinea?.nombre || ''} - ${t.planEquipaje.tipoTarifa}` : null,
      checkinStatus: t.checkinStatus || 'pendiente',
      passengers,
      legs: mapLegs(t.tramosVuelo),
      supplier: d.proveedor?.nombre || null,
      supplierCost: d.costoProveedor || 0,
      ta: d.ta || 0
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
      startDate: h.fechaEntrada?.toISOString() || null,
      endDate: h.fecha_salida?.toISOString() || null,
      roomType: h.tipoHabitacion,
      roomCount: h.cantidadHabitaciones,
      mealPlan: h.regimenAlimenticio,
      guests: passengers.map(p => ({
        name: p.nombreCompleto,
        docType: String(p.tipos_documento || ''),
        docNumber: p.nroDocumento || ''
      })),
      supplier: d.proveedor?.nombre || null,
      supplierCost: d.costoProveedor || 0,
      ta: d.ta || 0
    });
  },
  seguros_viaje(d, passengers, target) {
    const s = d.prodSeguros;
    if (!s) return;
    target.push({
      id: s.id,
      insurer: s.aseguradora,
      planName: s.nombrePlan,
      destination: s.destino,
      coverage: s.cobertura,
      policyNumber: s.nroPoliza,
      startDate: s.fechaInicio?.toISOString() || null,
      endDate: s.fechaFin?.toISOString() || null,
      beneficiaries: passengers.map(p => ({
        name: p.nombreCompleto,
        docType: String(p.tipos_documento || ''),
        docNumber: p.nroDocumento || ''
      })),
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
      packageName: p.paquete?.nombre || p.nombrePaquetePersonalizado,
      destination: p.destino,
      startDate: p.fecha_salida?.toISOString() || null,
      endDate: p.fechaRegreso?.toISOString() || null,
      travelersCount: p.cantidadPasajeros,
      includesFlight: p.incluyeVuelo,
      airline: p.aerolinea?.nombre || null,
      includesHotel: p.incluyeHotel,
      hotelName: p.nombreHotel,
      mealPlan: p.regimenAlimenticio,
      includesTransfers: p.incluyeTraslados,
      includesTours: p.incluyeTours,
      includesAssistance: p.incluyeAsistencia,
      packageId: p.paqueteId,
      travelers: passengers.map(pax => ({
        name: pax.nombreCompleto,
        docType: String(pax.tipos_documento || ''),
        docNumber: pax.nroDocumento || ''
      })),
      supplier: d.proveedor?.nombre || null,
      supplierCost: d.costoProveedor || 0,
      ta: d.ta || 0
    });
  }
};

const { randomUUID: uuidv4 } = require('crypto');

class SalesService {
  async createSale(body) {
    const {
      clientId, asesorId, total, paymentMethod, payments = [],
      status = 'credito', isCredit = false, creditDueDate,
      observations, products = [], responsableId,
      commissionAgentId, commissionAgentAmount, commissionAgentRetentionPercentage, commissionAgentNetPayment,
      ta = 0, supplierCost = 0,
      ticketData = [], hotelData = [], insuranceData = [], planData = [],
      checkInData = [], migrationData = [], simCardData = [], carRentalData = [],
      fincaData = [], tourData = [], conventionData = [], restaurantData = [],
      visaData = [], passportData = [], petServiceData = []
    } = body;

    // Resolve payment method principal id
    let metodo_pago_principal_id = null;
    if (paymentMethod) {
      const mp = await prisma.metodos_pago.findFirst({ where: { nombre: { contains: paymentMethod, mode: 'insensitive' } } });
      if (mp) metodo_pago_principal_id = mp.id;
    }

    const created = await prisma.$transaction(async (tx) => {
      // 1. Create sale record
      const venta = await tx.ventas.create({
        data: {
          cliente_id: Number(clientId),
          usuario_id: Number(asesorId),
          monto_total: Number(total) || 0,
          costo_proveedor_total: Number(supplierCost) || 0,
          ta_total: Number(ta) || 0,
          comisionista_id: commissionAgentId ? Number(commissionAgentId) : null,
          monto_comision_bruto: Number(commissionAgentAmount) || 0,
          porcentaje_retencion_comision: Number(commissionAgentRetentionPercentage) || 0,
          monto_comision_neto: Number(commissionAgentNetPayment) || 0,
          comision_liquidada: false,
          metodo_pago_principal_id,
          status,
          es_credito: Boolean(isCredit),
          fecha_vence_credito: creditDueDate ? new Date(creditDueDate) : null,
          monto_pagado_credito: payments.reduce((s, p) => s + Number(p.amount || 0), 0),
          observaciones: observations || null,
          responsable_id: responsableId ? Number(responsableId) : null,
        }
      });

      const ventaId = venta.id;

      // Helper: find or create persona
      const findOrCreatePersona = async (name, docType, docNumber) => {
        if (!name && !docNumber) return null;
        const parts = (name || '').trim().split(' ');
        const nombres = parts.slice(0, Math.ceil(parts.length / 2)).join(' ') || name || '';
        const apellidos = parts.slice(Math.ceil(parts.length / 2)).join(' ') || '';
        const existing = docNumber ? await tx.personas.findFirst({ where: { documento: docNumber } }) : null;
        if (existing) return existing.id;
        const created = await tx.personas.create({
          data: { nombres, apellidos, documento: docNumber || null, tipo_documento_id: null }
        });
        return created.id;
      };

      // 2. Create detalle_venta for each product type
      const createDetalle = async (categoria, serviceData, prodFn) => {
        for (const item of (serviceData || [])) {
          const detalleId = uuidv4();
          const detalle = await tx.detalle_venta.create({
            data: {
              id: detalleId,
              venta_id: ventaId,
              categoria,
              subtotal: Number(item.total || item.subtotal || 0),
              ta: Number(item.ta || 0),
              costo_proveedor: Number(item.supplierCost || 0),
              observaciones: item.observations || null,
            }
          });
          await prodFn(tx, detalle.id, item);
        }
      };

      // ── TIQUETERÍA ──
      for (const t of ticketData) {
        const detalleId = uuidv4();
        await tx.detalle_venta.create({
          data: {
            id: detalleId, venta_id: ventaId, categoria: 'tiqueteria',
            subtotal: Number(t.total || t.subtotal || 0),
            ta: Number(t.ta || 0),
            costo_proveedor: Number(t.supplierCost || 0),
            observaciones: t.observations || null,
            origen: t.legs?.[0]?.origin || null,
            destino: t.legs?.[t.legs.length - 1]?.destination || null,
          }
        });
        const ticketId = uuidv4();
        let airlineId = null;
        if (t.airline) {
          const al = await tx.aerolineas.findFirst({ where: { nombre: { contains: t.airline, mode: 'insensitive' } } });
          if (al) airlineId = al.id;
        }
        await tx.prod_tiqueteria.create({
          data: {
            id: ticketId, detalle_venta_id: detalleId,
            aerolineaId: airlineId,
            nro_reserva: t.reservationNumber || null,
            nro_vuelo: t.flightNumber || null,
            nro_tiquete: t.passengers?.[0]?.nroTiquete || null,
            modo_vuelo: t.flightMode || 'one_way',
            checkin_status: 'pendiente',
          }
        });
        // Tramos de vuelo
        const allLegs = [];
        if (t.legs) allLegs.push(...t.legs);
        if (t.outboundStops) allLegs.push(...t.outboundStops);
        if (t.returnLeg) allLegs.push(t.returnLeg);
        if (t.returnStops) allLegs.push(...t.returnStops);

        for (let i = 0; i < allLegs.length; i++) {
          const leg = allLegs[i];
          if (!leg || !leg.origin || !leg.destination) continue;

          let origAirport = await tx.aeropuertos.findFirst({ where: { codigo_iata: leg.origin } });
          let destAirport = await tx.aeropuertos.findFirst({ where: { codigo_iata: leg.destination } });
          if (!origAirport) origAirport = await tx.aeropuertos.create({ data: { codigo_iata: leg.origin || 'UNK', nombre: leg.origin || 'Desconocido', ciudad: '' } });
          if (!destAirport) destAirport = await tx.aeropuertos.create({ data: { codigo_iata: leg.destination || 'UNK', nombre: leg.destination || 'Desconocido', ciudad: '' } });
          
          let salidaDt = new Date();
          if (leg.date) {
            if (leg.date.includes('T')) {
              salidaDt = new Date(leg.date);
            } else {
              salidaDt = new Date(`${leg.date}T${leg.departureTime || leg.time || '00:00'}:00`);
            }
          }
          
          let llegadaDt = new Date(salidaDt.getTime() + 3600000);
          if (leg.arrivalDate) {
            if (leg.arrivalDate.includes('T')) {
              llegadaDt = new Date(leg.arrivalDate);
            } else {
              llegadaDt = new Date(`${leg.arrivalDate}T${leg.arrivalTime || '00:00'}:00`);
            }
          }

          let legAirlineId = airlineId;
          if (leg.airline && leg.airline !== t.airline) {
            const al2 = await tx.aerolineas.findFirst({ where: { nombre: { contains: leg.airline, mode: 'insensitive' } } });
            if (al2) legAirlineId = al2.id;
          }
          await tx.tramos_vuelo.create({
            data: {
              id: uuidv4(), prod_tiqueteria_id: ticketId,
              aeropuerto_origen_id: origAirport.id,
              aeropuerto_destino_id: destAirport.id,
              salida: salidaDt, llegada: llegadaDt,
              nro_vuelo_tramo: leg.flightNumber || null,
              asiento: leg.seat || null,
              orden: i + 1,
              nro_tiquete: leg.ticketNumber || null,
              aerolinea_id: legAirlineId,
            }
          });
        }
        // Pasajeros
        for (const pax of (t.passengers || [])) {
          const personaId = await findOrCreatePersona(pax.name, pax.docType, pax.docNumber);
          if (personaId) {
            await tx.pasajeros_detalle.create({
              data: {
                id: uuidv4(), detalle_venta_id: detalleId,
                persona_id: personaId, es_titular: pax.esTitular || false,
                nro_reserva: pax.nroReserva || null, nro_tiquete: pax.nroTiquete || null,
              }
            });
          }
        }
      }

      // ── HOTELERÍA ──
      for (const h of hotelData) {
        const detalleId = uuidv4();
        await tx.detalle_venta.create({
          data: {
            id: detalleId, venta_id: ventaId, categoria: 'hoteleria',
            subtotal: Number(h.total || h.subtotal || 0),
            ta: Number(h.ta || 0), costo_proveedor: Number(h.supplierCost || 0),
            destino: h.destination || null,
          }
        });
        await tx.prod_hoteleria.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            hotel_nombre: h.hotelName || null, tipo_hotel: h.hotelType || 'hotel',
            destino: h.destination || null, nro_reserva: h.reservationNumber || null,
            fecha_entrada: h.startDate ? new Date(h.startDate) : null,
            fecha_salida: h.endDate ? new Date(h.endDate) : null,
            observaciones: h.observations || null,
          }
        });
        for (const g of (h.guests || [])) {
          const personaId = await findOrCreatePersona(g.name, g.docType, g.docNumber);
          if (personaId) await tx.pasajeros_detalle.create({ data: { id: uuidv4(), detalle_venta_id: detalleId, persona_id: personaId, es_titular: false } });
        }
      }

      // ── SEGUROS DE VIAJE ──
      for (const s of insuranceData) {
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'seguros_viaje', subtotal: Number(s.total || s.subtotal || 0), ta: Number(s.ta || 0), costo_proveedor: Number(s.supplierCost || 0) } });
        await tx.prod_seguros.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            tipo_seguro: s.insuranceType || null,
            cobertura_usd: Number(s.coverage || 0),
            dias_cobertura: Number(s.coverageDays || 0),
            fecha_inicio_vigencia: s.startDate ? new Date(s.startDate) : null,
            fecha_fin_vigencia: s.endDate ? new Date(s.endDate) : null,
            telefono_contacto: s.phone || null,
          }
        });
        for (const m of (s.members || [])) {
          const personaId = await findOrCreatePersona(m.name, m.docType, m.docNumber);
          if (personaId) await tx.pasajeros_detalle.create({ data: { id: uuidv4(), detalle_venta_id: detalleId, persona_id: personaId, es_titular: false } });
        }
      }

      // ── PLANES ──
      for (const p of planData) {
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'planes', subtotal: Number(p.total || p.subtotal || 0), ta: Number(p.ta || 0), costo_proveedor: Number(p.supplierCost || 0) } });
        let planAirlineId = null;
        if (p.airline) {
          const al = await tx.aerolineas.findFirst({ where: { nombre: { contains: p.airline, mode: 'insensitive' } } });
          if (al) planAirlineId = al.id;
        }
        await tx.prod_planes.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            nombre_plan: p.planName || null, nombre_hotel: p.hotelName || null,
            aerolineaId: planAirlineId,
            nro_vuelo: p.flightNumber || null, nro_reserva: p.reservationNumber || null,
            nro_tiquete: p.ticketNumber || null,
            fecha_viaje_inicio: p.startDate ? new Date(p.startDate) : null,
            fecha_viaje_fin: p.endDate ? new Date(p.endDate) : null,
            adultos_count: Number(p.adultsCount || 1),
            menores_count: Number(p.childrenCount || 0),
            observaciones: p.observations || null,
          }
        });
        for (const g of (p.guests || [])) {
          const personaId = await findOrCreatePersona(g.name, g.docType, g.docNumber);
          if (personaId) await tx.pasajeros_detalle.create({ data: { id: uuidv4(), detalle_venta_id: detalleId, persona_id: personaId, es_titular: false } });
        }
      }

      // ── CHECK-IN ──
      for (const c of checkInData) {
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'checkin', subtotal: Number(c.total || c.subtotal || 0), ta: Number(c.ta || 0), costo_proveedor: Number(c.supplierCost || 0) } });
        await tx.prod_checkins.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            nro_vuelo_reserva: c.flightOrReservation || null,
            fecha_viaje: c.travelDate ? new Date(c.travelDate) : null,
            asiento: c.seat || null,
            maletas_contadas: c.baggage || null,
            telefono_contacto: c.phone || null,
            necesidades_especiales: c.specialNeeds || null,
          }
        });
        if (c.passengerName) {
          const personaId = await findOrCreatePersona(c.passengerName, c.docType, c.docNumber);
          if (personaId) await tx.pasajeros_detalle.create({ data: { id: uuidv4(), detalle_venta_id: detalleId, persona_id: personaId, es_titular: true } });
        }
      }

      // ── MIGRACIÓN ──
      for (const m of migrationData) {
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'documentacion_migratoria', subtotal: Number(m.total || m.subtotal || 0), ta: Number(m.ta || 0), costo_proveedor: Number(m.supplierCost || 0) } });
        await tx.prod_migracion.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            tipo_tramite_migratorio: m.tramiteType || null, nacionalidad: m.nationality || null,
            tipo_documento: m.docType || 'Pasaporte', pasaporte_nro: m.docNumber || null,
            pasaporte_vence: m.passportExpiry ? new Date(m.passportExpiry) : null,
            pais_destino: m.destinationCountry || null,
          }
        });
      }

      // ── SIM CARD ──
      for (const s of simCardData) {
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'simcard', subtotal: Number(s.total || s.subtotal || 0), ta: Number(s.ta || 0), costo_proveedor: Number(s.supplierCost || 0) } });
        await tx.prod_simcards.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            pais_destino: s.destinationCountry || null,
            fecha_llegada: s.arrivalDate ? new Date(s.arrivalDate) : null,
            duracion_viaje: s.tripDuration ? String(s.tripDuration) : null,
            plan_datos: s.dataPlan || null, tipo_sim: s.simType || null,
          }
        });
      }

      // ── RENTA DE VEHÍCULOS ──
      for (const c of carRentalData) {
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'renta_vehiculos', subtotal: Number(c.total || c.subtotal || 0), ta: Number(c.ta || 0), costo_proveedor: Number(c.supplierCost || 0) } });
        await tx.prod_autos.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            conductor_nombre: c.driverName || null, licencia_nro: c.licenseNumber || null,
            fecha_recogida: c.pickupDate ? new Date(c.pickupDate) : null,
            fecha_devolucion: c.returnDate ? new Date(c.returnDate) : null,
            lugar_recogida: c.pickupLocation || null, categoria_auto: c.vehicleCategory || null,
            conductores_adicionales: Number(c.additionalDrivers || 0),
            tipo_seguro: c.insuranceType || null, tarjeta_garantia_info: c.guaranteeCreditCard || null,
          }
        });
      }

      // ── RENTA DE FINCAS ──
      for (const f of fincaData) {
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'renta_fincas', subtotal: Number(f.total || f.subtotal || 0), ta: Number(f.ta || 0), costo_proveedor: Number(f.supplierCost || 0) } });
        await tx.prod_fincas.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            nombre_finca: f.fincaName || null, ciudad_pueblo: f.city || null,
            direccion_finca: f.address || null,
            responsable_nombre: f.responsible || null,
            documento_responsable: f.docNumber || null,
            fecha_entrada: f.checkInDate ? new Date(f.checkInDate) : null,
            fecha_salida: f.checkOutDate ? new Date(f.checkOutDate) : null,
            adultos_count: Number(f.adultsCount || 1), ninos_count: Number(f.childrenCount || 0),
            tiene_mascotas: Boolean(f.hasPets), tipo_mascota: f.petType || null,
            observaciones: f.observations || null,
          }
        });
      }

      // ── TOURS ──
      for (const t of tourData) {
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'tours', subtotal: Number(t.total || t.subtotal || 0), ta: Number(t.ta || 0), costo_proveedor: Number(t.supplierCost || 0) } });
        await tx.prod_tours.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            tour_nombre: t.selectedTour || null,
            fecha_preferida: t.preferredDate ? new Date(t.preferredDate) : null,
            adultos_count: Number(t.adultsCount || 1),
            menores_count: Number(t.childrenCount || 0),
            edades_menores: t.childrenAges || null,
            punto_encuentro: t.pickupPoint || null,
            condiciones_medicas: t.medicalConditions || null,
            observaciones: t.observations || null,
            telefono_contacto: t.phone || null,
          }
        });
        for (const g of (t.guests || [])) {
          const personaId = await findOrCreatePersona(g.name, g.docType, g.docNumber);
          if (personaId) await tx.pasajeros_detalle.create({ data: { id: uuidv4(), detalle_venta_id: detalleId, persona_id: personaId, es_titular: false } });
        }
      }

      // ── CENTROS DE CONVENCIÓN ──
      for (const c of conventionData) {
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'centros_convencion', subtotal: Number(c.total || c.subtotal || 0), ta: Number(c.ta || 0), costo_proveedor: Number(c.supplierCost || 0) } });
        await tx.prod_eventos.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            organizacion: c.organization || null, nombre_contacto: c.contactName || null,
            email_contacto: c.email || null,
            fechaInicio: c.startDate ? new Date(c.startDate) : null,
            fechaFin: c.endDate ? new Date(c.endDate) : null,
            asistencia_estimada: Number(c.estimatedAttendance || 0),
            espacio_requerido: c.spaceRequired || null, tipo_evento: c.eventType || null,
            notas_catering: c.cateringNotes || null,
            nombre_lugar: c.venueName || null, ciudad: c.city || null, direccion: c.address || null,
          }
        });
      }

      // ── RESTAURANTES ──
      for (const r of restaurantData) {
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'restaurantes', subtotal: Number(r.total || r.subtotal || 0), ta: Number(r.ta || 0), costo_proveedor: Number(r.supplierCost || 0) } });
        await tx.prod_restaurantes.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            nombre_reserva: r.reservationName || null,
            fecha_hora_reserva: r.dateTime ? new Date(r.dateTime) : null,
            personas_count: Number(r.personsCount || 1),
            preferencia_mesa: r.tablePreference || null,
            tipo_menu: r.menuType || null,
            restricciones_dieta: r.dietRestrictions || null,
            ocasion_especial: r.specialOccasion || null,
            telefono_contacto: r.phone || null,
          }
        });
      }

      // ── VISAS ──
      for (const v of visaData) {
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'visa', subtotal: Number(v.total || v.subtotal || 0), ta: Number(v.ta || 0), costo_proveedor: Number(v.supplierCost || 0) } });
        await tx.prod_visas.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            nombre_completo: v.fullName || null, nacionalidad: v.nationality || null,
            tipo_documento: v.docType || 'Pasaporte', nro_pasaporte: v.docNumber || null,
            vencimiento_pasaporte: v.passportExpiration ? new Date(v.passportExpiration) : null,
            pais_aplicacion: v.countryApplying || null, tipo_visa: v.visaType || null,
            fecha_estimada_viaje: v.estimatedTravelDate ? new Date(v.estimatedTravelDate) : null,
            email_contacto: v.email || null,
          }
        });
      }

      // ── PASAPORTES ──
      for (const p of passportData) {
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'pasaporte', subtotal: Number(p.total || p.subtotal || 0), ta: Number(p.ta || 0), costo_proveedor: Number(p.supplierCost || 0) } });
        await tx.prod_pasaportes.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            nombre_completo: p.fullName || null, nro_documento: p.docNumber || null,
            ciudad_residencia: p.residenceCity || null, tipo_tramite: p.tramiteType || null,
            fecha_nacimiento: p.birthDate ? new Date(p.birthDate) : null,
            fecha_estimada_viaje: p.estimatedTravelDate ? new Date(p.estimatedTravelDate) : null,
            telefono_contacto: p.phone || null,
          }
        });
      }

      // ── MASCOTAS ──
      for (const m of petServiceData) {
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'servicio_mascotas', subtotal: Number(m.total || m.subtotal || 0), ta: Number(m.ta || 0), costo_proveedor: Number(m.supplierCost || 0) } });
        await tx.prod_mascotas.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            mascota_nombre: m.petName || null, especie: m.species || null,
            raza: m.breed || null, peso_kg: Number(m.weight || 0),
            transporte_tipo: m.transportCompany || null,
            fecha_viaje: m.travelDate ? new Date(m.travelDate) : null,
            pais_destino: m.destinationCountry || null,
            condiciones_medicas: m.medicalConditions || null,
            observaciones: m.observations || null,
            telefono_contacto: m.phone || null,
          }
        });
      }

      // 3. Payments
      const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
      for (const p of payments) {
        let mpId = null;
        if (p.method) {
          const mp = await tx.metodos_pago.findUnique({ where: { id: Number(p.method) } });
          if (mp) mpId = mp.id;
        }
        await tx.pagos_venta.create({
          data: {
            id: uuidv4(), venta_id: ventaId,
            monto: Number(p.amount),
            metodo_pago_id: mpId,
            referencia: p.reference || null,
          }
        });
      }

      return venta;
    });

    // Return the new sale in the same format used by listSales
    return {
      id: created.id,
      clientId: created.cliente_id,
      asesorId: created.usuario_id,
      date: created.creado_at,
      total: created.monto_total,
      status: created.status,
      observations: created.observaciones,
      isCredit: created.es_credito,
      payments: [],
      servicesSummary: [],
    };
  }

  async listSales({ pagination, search, status, asesorId, clientId, dateFrom, dateTo, permissionScope, user, sortBy, sortOrder }) {
    const { page, perPage, skip } = pagination;

    let searchCondition = search ? `AND v.observaciones ILIKE '%${search.replace(/'/g, "''")}%'` : '';
    let statusCondition = status ? `AND v.status = '${status.replace(/'/g, "''")}'` : '';
    let asesorCondition = asesorId ? `AND v.usuario_id = ${parseInt(asesorId)}` : '';
    let clientCondition = clientId ? `AND v.cliente_id = ${parseInt(clientId)}` : '';
    let dateCondition = '';
    if (dateFrom) dateCondition += ` AND v.creado_at >= '${new Date(dateFrom).toISOString()}'`;
    if (dateTo) dateCondition += ` AND v.creado_at <= '${new Date(dateTo).toISOString()}'`;

    if (permissionScope === 'own') {
      asesorCondition += ` AND v.usuario_id = ${user.id}`;
    }

    const where = {};
    if (search) where.observaciones = { contains: search, mode: 'insensitive' };
    if (status) where.status = status;
    if (asesorId) where.usuario_id = parseInt(asesorId);
    if (clientId) where.cliente_id = parseInt(clientId);
    if (dateFrom || dateTo) {
      where.creado_at = {};
      if (dateFrom) where.creado_at.gte = new Date(dateFrom);
      if (dateTo) where.creado_at.lte = new Date(dateTo);
    }
    if (permissionScope === 'own') {
      where.usuario_id = user.id;
    }

    const sortFieldMap = { 'creadoAt': 'creadoAt', 'date': 'creadoAt', 'total': 'montoTotal', 'status': 'status', 'clientName': 'cliente_id' };
    const effectiveSortBy = sortFieldMap[sortBy] || 'creadoAt';
    const sqlOrderBy = effectiveSortBy === 'montoTotal' ? 'v.monto_total' : (effectiveSortBy === 'status' ? 'v.status' : 'v.creado_at');

    const [total, ventasRaw] = await Promise.all([
      prisma.ventas.count({ where }),
      prisma.$queryRawUnsafe(`
        SELECT 
          v.id,
          v.cliente_id as "cliente_id",
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
          v.comision_liquidada as "comision_liquidada",
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
      const servicesSummary = (v.detalleVentas || []).map(d => {
        const tipo = d.categoria;
        let label = tipo;
        const labelMap = {
          tiqueteria: 'Tiquetería', hoteleria: 'Hotelería', seguros: 'Seguro', planes: 'Plan',
          checkin: 'Check-in', migracion: 'Migración', simcard: 'SIM Card', autos: 'Renta de Auto',
          fincas: 'Finca', tours: 'Tour', eventos: 'Evento', restaurantes: 'Restaurante',
          visas: 'Visa', pasaportes: 'Pasaporte', mascotas: 'Mascota'
        };
        if (labelMap[tipo]) label = labelMap[tipo];
        const route = (d.origen && d.destino) ? `${d.origen}→${d.destino}` : null;
        const pax = d.pasajerosDetalle?.[0]?.persona;
        const paxName = pax ? `${pax.nombres} ${pax.apellidos}` : null;
        const hasCustomName = d.nombreServicio && d.nombreServicio !== label;
        const detail = [hasCustomName ? d.nombreServicio : null, route, paxName].filter(Boolean).join(' · ');
        return { tipo, label, detail: detail || null };
      });

      return {
        id: v.id,
        clientId: v.cliente_id,
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
        isSettled: v.comision_liquidada,
        payments: (v.pagosVenta || []).map(p => ({
          id: p.id,
          date: p.fechaPago,
          amount: p.monto,
          method: p.metodoPago?.nombre || null
        })),
        servicesSummary
      };
    });

    return { data, meta: buildMeta(total, page, perPage) };
  }

  async getSaleById(id) {
    const [venta, detalleVentasBase] = await Promise.all([
      prisma.ventas.findUnique({
        where: { id },
        include: {
          cliente: { include: { personas: true } },
          usuario: { include: { personas: true } },
          comisionista: { include: { personas: true } },
          responsable: { include: { personas: true } },
          metodoPagoPrincipal: true,
          pagosVenta: { include: { metodoPago: true } }
        }
      }),
      prisma.detalleVenta.findMany({
        where: { venta_id: id },
        include: { pasajerosDetalle: { include: { personas: true } }, proveedor: true }
      })
    ]);

    if (!venta) throw new NotFoundError('Venta no encontrada');

    const detalleVentas = await Promise.all(
      detalleVentasBase.map(async (d) => {
        const tipo = d.categoria;
        if (PRODUCT_INCLUDES[tipo]) {
          const relationKey = Object.keys(PRODUCT_INCLUDES[tipo])[0];
          const includeConfig = PRODUCT_INCLUDES[tipo][relationKey];
          const queryOptions = { where: { detalleVentaId: d.id } };
          if (includeConfig && typeof includeConfig === 'object' && includeConfig.include) {
            queryOptions.include = includeConfig.include;
          }
          const productData = await prisma[relationKey].findUnique(queryOptions);
          return { ...d, [relationKey]: productData };
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

    return {
      id: venta.id,
      clientId: venta.cliente_id,
      clientName: `${venta.cliente.personas.nombres} ${venta.cliente.personas.apellidos}`,
      clientDocType: venta.cliente.personas.tipoDocumento || null,
      clientDocNumber: venta.cliente.personas.documento || null,
      clientEmail: venta.cliente.personas.email || null,
      clientPhone: venta.cliente.personas.celular || null,
      asesorId: venta.usuarioId,
      asesorName: `${venta.usuario.personas.nombres} ${venta.usuario.personas.apellidos}`,
      responsableId: venta.responsable_id || null,
      responsableName: venta.responsable ? `${venta.responsable.personas.nombres} ${venta.responsable.personas.apellidos}` : null,
      date: venta.creadoAt,
      total: venta.montoTotal,
      paymentMethod: venta.metodoPagoPrincipal?.nombre || null,
      status: venta.status,
      observations: venta.observaciones,
      isCredit: venta.esCredito,
      creditDueDate: venta.fechaVenceCredito,
      creditPaidAmount: venta.montoPagadoCredito,
      isReviewed: venta.isReviewed,
      commissionAgentId: venta.comisionistaId,
      commissionAgentName: venta.comisionista ? `${venta.comisionista.personas.nombres} ${venta.comisionista.personas.apellidos}` : null,
      commissionAgentAmount: venta.montoComisionBruto,
      commissionAgentNetPayment: venta.montoComisionNeto,
      supplierCost: venta.costoProveedorTotal,
      ta: venta.taTotal,
      isSettled: venta.comision_liquidada,
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
      migrationData: resultMap.migracion || [],
      simCardData: resultMap.simcard || [],
      carRentalData: resultMap.renta_vehiculos || [],
      fincaData: resultMap.renta_fincas || [],
      tourData: resultMap.tours || [],
      conventionData: resultMap.centros_convencion || [],
      restaurantData: resultMap.restaurantes || [],
      visaData: resultMap.visa || [],
      passportData: resultMap.pasaporte || [],
      petServiceData: resultMap.mascotas || []
    };
  }

  async voidSale(id, reason) {
    if (!reason) throw new BadRequestError('Debe proporcionar un motivo para anular la venta');
    const venta = await prisma.ventas.findUnique({ where: { id } });
    if (!venta) throw new NotFoundError('Venta no encontrada');

    const newObservaciones = venta.observaciones ? `${venta.observaciones}\n[ANULADA] Motivo: ${reason}` : `[ANULADA] Motivo: ${reason}`;
    await prisma.ventas.update({
      where: { id },
      data: { status: 'anulado', observaciones: newObservaciones }
    });

    return { message: 'Venta anulada correctamente' };
  }

  async removeSale(id) {
    await prisma.ventas.update({ where: { id }, data: { deleted_at: new Date() } });
    return { message: 'Venta eliminada' };
  }

  async registerPayment(id, { amount, isTotal, method, reference, currentPaidAmount, saleTotal }) {
    const { randomUUID } = require('crypto');
    let newPaidAmount, newStatus;
    let metodo_pago_id = null;
    if (method) {
      const m = await prisma.metodos_pago.findFirst({ where: { nombre: method } });
      if (m) metodo_pago_id = m.id;
    }

    if (saleTotal !== undefined && currentPaidAmount !== undefined) {
      newPaidAmount = isTotal ? saleTotal : (currentPaidAmount || 0) + Number(amount);
      newStatus = (isTotal || newPaidAmount >= saleTotal) ? 'pagado' : 'abonado';
    } else {
      const venta = await prisma.ventas.findUnique({ where: { id }, select: { monto_total: true, monto_pagado_credito: true } });
      if (!venta) throw new NotFoundError('Venta no encontrada');
      const currentPaid = venta.monto_pagado_credito || 0;
      newPaidAmount = isTotal ? venta.monto_total : currentPaid + Number(amount);
      newStatus = (isTotal || newPaidAmount >= venta.monto_total) ? 'pagado' : 'abonado';
    }

    let newPayment;
    await prisma.$transaction(async (tx) => {
      newPayment = await tx.pagos_venta.create({
        data: { id: randomUUID(), venta_id: id, monto: Number(amount), metodo_pago_id, referencia: reference || null }
      });
      await tx.ventas.update({
        where: { id },
        data: { monto_pagado_credito: newPaidAmount, status: newStatus }
      });
    });

    return {
      creditPaidAmount: newPaidAmount,
      status: newStatus,
      payment: {
        id: newPayment.id,
        date: newPayment.fecha_pago,
        amount: newPayment.monto,
        method: method || null
      }
    };
  }

  async deletePayment(saleId, paymentId, { currentPayments, saleTotal } = {}) {
    const payment = await prisma.pagos_venta.findUnique({
      where: { id: paymentId },
      select: { id: true, venta_id: true, monto: true }
    });
    if (!payment) throw new NotFoundError('Pago no encontrado');
    if (payment.venta_id !== saleId) throw new BadRequestError('El pago no pertenece a esta venta');

    let newPaidAmount = 0;
    let newStatus = 'credito';

    if (Array.isArray(currentPayments) && saleTotal !== undefined) {
      newPaidAmount = currentPayments.filter(p => p.id !== paymentId).reduce((sum, p) => sum + p.amount, 0);
      newStatus = newPaidAmount >= saleTotal ? 'pagado' : newPaidAmount > 0 ? 'abonado' : 'credito';
      await prisma.$transaction([
        prisma.pagos_venta.delete({ where: { id: paymentId } }),
        prisma.ventas.update({ where: { id: saleId }, data: { monto_pagado_credito: newPaidAmount, status: newStatus } })
      ]);
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.pagos_venta.delete({ where: { id: paymentId } });
        const remainingPayments = await tx.pagos_venta.findMany({ where: { venta_id: saleId }, select: { monto: true } });
        newPaidAmount = remainingPayments.reduce((sum, p) => sum + p.monto, 0);
        const venta = await tx.ventas.findUnique({ where: { id: saleId }, select: { monto_total: true } });
        newStatus = newPaidAmount >= venta.monto_total ? 'pagado' : newPaidAmount > 0 ? 'abonado' : 'credito';
        await tx.ventas.update({ where: { id: saleId }, data: { monto_pagado_credito: newPaidAmount, status: newStatus } });
      });
    }

    return { message: 'Pago eliminado', creditPaidAmount: newPaidAmount, status: newStatus };
  }

  async updateReviewStatus(saleId, isReviewed) {
    const sale = await prisma.ventas.findUnique({ where: { id: saleId } });
    if (!sale) throw new NotFoundError('Venta no encontrada');
    if (sale.status !== 'pagado') throw new BadRequestError('La venta debe estar pagada para ser revisada');
    if (sale.isReviewed) throw new BadRequestError('Esta venta ya fue revisada y no se puede modificar su estado');

    const updatedSale = await prisma.ventas.update({
      where: { id: saleId },
      data: { isReviewed }
    });

    return updatedSale;
  }

  async listPayments(saleId) {
    const payments = await prisma.pagosVenta.findMany({
      where: { venta_id: saleId },
      select: { id: true, fechaPago: true, monto: true, metodoPago: { select: { nombre: true } } },
      orderBy: { fechaPago: 'asc' }
    });

    return payments.map(p => ({
      id: p.id,
      date: p.fechaPago,
      amount: p.monto,
      method: p.metodoPago?.nombre || null
    }));
  }

  async sendVoucher(saleId, pdfBase64) {
    if (!pdfBase64) throw new BadRequestError('El PDF es requerido (base64)');
    const venta = await prisma.ventas.findUnique({
      where: { id: saleId },
      include: { cliente: { include: { personas: true } }, usuario: { include: { personas: true } } }
    });

    if (!venta) throw new NotFoundError('Venta no encontrada');
    const clientEmail = venta.cliente.personas.email;
    if (!clientEmail) throw new BadRequestError('El cliente no tiene correo electrónico registrado');

    const clientName = `${venta.cliente.personas.nombres} ${venta.cliente.personas.apellidos}`;
    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const pdfBuffer = Buffer.from(base64Data, 'base64');

    await emailService.sendEmail({
      to: clientEmail,
      subject: `Voucher de Servicio - Reserva #${saleId} - Samtur Travel`,
      html: `<p>Hola <strong>${clientName}</strong>,</p><p>Adjunto encontrarás tu voucher de reserva.</p>`,
      attachments: [{ filename: `Voucher_Reserva_${saleId}.pdf`, content: pdfBuffer }]
    });

    return { message: `Voucher enviado exitosamente a ${clientEmail}` };
  }
}

module.exports = new SalesService();
