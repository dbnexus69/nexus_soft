const prisma = require('../config/db');
const { NotFoundError, BadRequestError } = require('../errors/AppError');
const { buildMeta } = require('../utils/paginationHelper');
const emailService = require('../utils/emailService');

// Los includes, transforms y helpers de producto viven en el catálogo:
// una sola fuente de verdad para las 15 categorías.
const {
  CATALOG, SLUGS, CHILD_SLUGS,
  PRODUCT_INCLUDES, PRODUCT_TRANSFORMS,
  mapPassengers, mapLegs, labelOf
} = require('../catalog/products');

const { randomUUID: uuidv4 } = require('crypto');

// El selector de tamaño de mascota envía "pequeño" con eñe, pero el enum
// TamanoMascota de Postgres es `pequeno`. Un valor fuera del enum hace fallar
// el insert entero, así que se normaliza aquí.
const TAMANOS_MASCOTA = { pequeno: 'pequeno', 'pequeño': 'pequeno', mediano: 'mediano', grande: 'grande', gigante: 'gigante' };
function normalizarTamanoMascota(valor) {
  if (!valor) return null;
  return TAMANOS_MASCOTA[String(valor).trim().toLowerCase()] || null;
}

class SalesService {
  // Resuelve de una vez todos los catálogos que la venta va a necesitar
  // (proveedores, aerolíneas, aeropuertos y personas por documento).
  //
  // Estas consultas son solo lectura y antes vivían dentro de la transacción,
  // repetidas dentro de los bucles de producto. Con ~150 ms por consulta contra
  // Supabase, una venta con muchos productos superaba el timeout de 5 s de
  // Prisma y la transacción moría a media escritura:
  //   "Transaction not found ... refers to an old closed transaction".
  //
  // Sacarlas fuera deja dentro de la transacción solo las escrituras.
  async _precargarCatalogos(body) {
    const CAMPOS = [
      'ticketData', 'hotelData', 'insuranceData', 'planData', 'checkInData',
      'migrationData', 'simCardData', 'carRentalData', 'fincaData', 'tourData',
      'conventionData', 'restaurantData', 'visaData', 'passportData', 'petServiceData',
    ];
    const items = CAMPOS.flatMap(c => Array.isArray(body[c]) ? body[c] : []);

    const codigosIata = new Set();
    const documentos = new Set();
    for (const it of items) {
      for (const leg of [...(it.legs || []), ...(it.outboundStops || []),
                         ...(it.returnLeg ? [it.returnLeg] : []), ...(it.returnStops || [])]) {
        if (leg?.origin) codigosIata.add(leg.origin);
        if (leg?.destination) codigosIata.add(leg.destination);
      }
      for (const p of [...(it.passengers || []), ...(it.guests || []), ...(it.travelers || [])]) {
        if (p?.docNumber) documentos.add(String(p.docNumber));
      }
      if (it.docNumber) documentos.add(String(it.docNumber));
    }
    codigosIata.add('UNK'); // el comodín para tramos sin aeropuerto conocido

    const [proveedores, aerolineas, aeropuertos, personas] = await Promise.all([
      prisma.proveedores.findMany({ select: { id: true, nombre: true } }),
      prisma.aerolineas.findMany({ select: { id: true, nombre: true } }),
      prisma.aeropuertos.findMany({
        where: { codigo_iata: { in: [...codigosIata] } },
        select: { id: true, codigo_iata: true },
      }),
      documentos.size
        ? prisma.personas.findMany({
            where: { documento: { in: [...documentos] } },
            select: { id: true, documento: true },
          })
        : [],
    ]);

    return {
      proveedores,
      aerolineas,
      // Se indexan para que la búsqueda dentro de la transacción sea O(1).
      aeropuertos: new Map(aeropuertos.map(a => [a.codigo_iata, a.id])),
      personas: new Map(personas.map(p => [p.documento, p.id])),
    };
  }

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

        // Inject UUID for all items to enable linking
    const allDataFields = [
      'ticketData', 'hotelData', 'insuranceData', 'planData',
      'checkInData', 'migrationData', 'simCardData', 'carRentalData',
      'fincaData', 'tourData', 'conventionData', 'restaurantData',
      'visaData', 'passportData', 'petServiceData'
    ];
    for (const field of allDataFields) {
      if (Array.isArray(body[field])) {
        for (let item of body[field]) {
          if (item && Object.keys(item).length > 0) {
            item._generatedId = require('crypto').randomUUID();
          }
        }
      }
    }

    // Los catálogos se resuelven fuera: dentro de la transacción solo escrituras.
    const catalogos = await this._precargarCatalogos(body);

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
      // La búsqueda por documento ya viene resuelta; solo el alta toca la base.
      // El mapa se actualiza al crear, para que dos pasajeros con el mismo
      // documento en la misma venta reutilicen la persona en vez de duplicarla.
      const findOrCreatePersona = async (name, docType, docNumber) => {
        if (!name && !docNumber) return null;
        const doc = docNumber ? String(docNumber) : null;
        if (doc && catalogos.personas.has(doc)) return catalogos.personas.get(doc);

        const parts = (name || '').trim().split(' ');
        const nombres = parts.slice(0, Math.ceil(parts.length / 2)).join(' ') || name || '';
        const apellidos = parts.slice(Math.ceil(parts.length / 2)).join(' ') || '';
        const created = await tx.personas.create({
          data: { nombres, apellidos, documento: doc, tipo_documento_id: null }
        });
        if (doc) catalogos.personas.set(doc, created.id);
        return created.id;
      };

      // Del catálogo precargado, con el mismo criterio que antes:
      // igualdad de nombre sin distinguir mayúsculas.
      const findProveedorId = (nombre) => {
        if (!nombre) return null;
        const buscado = String(nombre).toLowerCase();
        const p = catalogos.proveedores.find(x => (x.nombre || '').toLowerCase() === buscado);
        return p ? p.id : null;
      };

      // Mismo criterio que el findFirst con `contains`, insensible a mayúsculas.
      const findAerolineaId = (nombre) => {
        if (!nombre) return null;
        const buscado = String(nombre).toLowerCase();
        const a = catalogos.aerolineas.find(x => (x.nombre || '').toLowerCase().includes(buscado));
        return a ? a.id : null;
      };

      const getParentDetalleId = (item) => {
        if (item && item.linkedToPlanIndex !== undefined && item.linkedToPlanIndex !== null) {
          const parentPlan = planData[item.linkedToPlanIndex];
          if (parentPlan && parentPlan._generatedId) {
            return parentPlan._generatedId;
          }
        }
        return null;
      };

      // ── PLANES (Se procesan primero para generar IDs de vínculo) ──
      for (const p of planData) {
        const detalleId = uuidv4();
        p._generatedId = detalleId;
        const proveedorId = await findProveedorId(p.supplier);
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'plan', subtotal: Number(p.total || p.subtotal || 0), ta: Number(p.ta || 0), costo_proveedor: Number(p.supplierCost || 0), proveedor_id: proveedorId } });
        let planAirlineId = null;
        if (p.airline) {
          const al = findAerolineaId(p.airline) ? { id: findAerolineaId(p.airline) } : null;
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

      // ── TIQUETERÍA ──
      for (const t of ticketData) {
        const parentDetalleId = getParentDetalleId(t);
        const detalleId = uuidv4();
        const proveedorId = await findProveedorId(t.supplier);
        await tx.detalle_venta.create({
          data: { id: detalleId, venta_id: ventaId, categoria: 'ticket', parentDetalleId: parentDetalleId,
            subtotal: Number(t.total || t.subtotal || 0),
            ta: Number(t.ta || 0),
            costo_proveedor: Number(t.supplierCost || 0),
            observaciones: t.observations || null,
            proveedor_id: proveedorId,
            origen: t.legs?.[0]?.origin || null,
            destino: t.legs?.[t.legs.length - 1]?.destination || null,
          }
        });
        const ticketId = uuidv4();
        let airlineId = null;
        if (t.airline) {
          const al = findAerolineaId(t.airline) ? { id: findAerolineaId(t.airline) } : null;
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
            planEquipajeId: t.baggagePlan ? Number(t.baggagePlan) : null,
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

          // Del mapa precargado. Si el aeropuerto no existe se usa el comodín
          // UNK, que solo se crea la primera vez que hace falta.
          const idComodin = async () => {
            if (catalogos.aeropuertos.has('UNK')) return catalogos.aeropuertos.get('UNK');
            const creado = await tx.aeropuertos.create({
              data: { codigo_iata: 'UNK', nombre: 'Desconocido', ciudad: '' }
            });
            catalogos.aeropuertos.set('UNK', creado.id);
            return creado.id;
          };
          const origAirport = { id: catalogos.aeropuertos.get(leg.origin) ?? await idComodin() };
          const destAirport = { id: catalogos.aeropuertos.get(leg.destination) ?? await idComodin() };
          
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
            const al2 = findAerolineaId(leg.airline) ? { id: findAerolineaId(leg.airline) } : null;
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
              plan_equipaje_id: leg.baggagePlan ? Number(leg.baggagePlan) : null,
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
        const parentDetalleId = getParentDetalleId(h);
        const detalleId = uuidv4();
        const proveedorId = await findProveedorId(h.supplier);
        await tx.detalle_venta.create({
          data: { id: detalleId, venta_id: ventaId, categoria: 'hotel', parentDetalleId: parentDetalleId,
            subtotal: Number(h.total || h.subtotal || 0),
            ta: Number(h.ta || 0), costo_proveedor: Number(h.supplierCost || 0),
            destino: h.destination || null,
            proveedor_id: proveedorId,
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
        const parentDetalleId = getParentDetalleId(s);
        const detalleId = uuidv4();
        const proveedorId = await findProveedorId(s.supplier);
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'insurance', parentDetalleId: parentDetalleId, subtotal: Number(s.total || s.subtotal || 0), ta: Number(s.ta || 0), costo_proveedor: Number(s.supplierCost || 0), proveedor_id: proveedorId } });
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

      // ── CHECK-IN ──
      for (const c of checkInData) {
        const parentDetalleId = getParentDetalleId(c);
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'checkin', parentDetalleId: parentDetalleId, subtotal: Number(c.total || c.subtotal || 0), ta: Number(c.ta || 0), costo_proveedor: Number(c.supplierCost || 0) } });
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
        const parentDetalleId = getParentDetalleId(m);
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'migration', parentDetalleId: parentDetalleId, subtotal: Number(m.total || m.subtotal || 0), ta: Number(m.ta || 0), costo_proveedor: Number(m.supplierCost || 0) } });
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
        const parentDetalleId = getParentDetalleId(s);
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'simcard', parentDetalleId: parentDetalleId, subtotal: Number(s.total || s.subtotal || 0), ta: Number(s.ta || 0), costo_proveedor: Number(s.supplierCost || 0) } });
        await tx.prod_simcards.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            pais_destino: s.destinationCountry || null,
            fecha_llegada: s.arrivalDate ? new Date(s.arrivalDate) : null,
            duracion_viaje: s.tripDuration ? String(s.tripDuration) : null,
            plan_datos: s.dataPlan || null, tipo_sim: s.simType || null,
            metodo_entrega: s.deliveryMethod || null,
          }
        });
      }

      // ── RENTA DE VEHÍCULOS ──
      for (const c of carRentalData) {
        const parentDetalleId = getParentDetalleId(c);
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'car', parentDetalleId: parentDetalleId, subtotal: Number(c.total || c.subtotal || 0), ta: Number(c.ta || 0), costo_proveedor: Number(c.supplierCost || 0) } });
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
        const parentDetalleId = getParentDetalleId(f);
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'finca', parentDetalleId: parentDetalleId, subtotal: Number(f.total || f.subtotal || 0), ta: Number(f.ta || 0), costo_proveedor: Number(f.supplierCost || 0) } });
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
        const parentDetalleId = getParentDetalleId(t);
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'tour', parentDetalleId: parentDetalleId, subtotal: Number(t.total || t.subtotal || 0), ta: Number(t.ta || 0), costo_proveedor: Number(t.supplierCost || 0) } });
        await tx.prod_tours.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            tour_nombre: t.selectedTour || null,
            fecha_preferida: t.preferredDate ? new Date(t.preferredDate) : null,
            adultos_count: Number(t.adultsCount || 1),
            menores_count: Number(t.childrenCount || 0),
            edades_menores: t.childrenAges || null,
            idioma_guia: t.guideLanguage || null,
            requiere_transporte: t.needsTransport ?? false,
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
        const parentDetalleId = getParentDetalleId(c);
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'convention', parentDetalleId: parentDetalleId, subtotal: Number(c.total || c.subtotal || 0), ta: Number(c.ta || 0), costo_proveedor: Number(c.supplierCost || 0) } });
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
        const parentDetalleId = getParentDetalleId(r);
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'restaurant', parentDetalleId: parentDetalleId, subtotal: Number(r.total || r.subtotal || 0), ta: Number(r.ta || 0), costo_proveedor: Number(r.supplierCost || 0) } });
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
        const parentDetalleId = getParentDetalleId(v);
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'visa', parentDetalleId: parentDetalleId, subtotal: Number(v.total || v.subtotal || 0), ta: Number(v.ta || 0), costo_proveedor: Number(v.supplierCost || 0) } });
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
        const parentDetalleId = getParentDetalleId(p);
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'passport', parentDetalleId: parentDetalleId, subtotal: Number(p.total || p.subtotal || 0), ta: Number(p.ta || 0), costo_proveedor: Number(p.supplierCost || 0) } });
        await tx.prod_pasaportes.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            nombre_completo: p.fullName || null,
            // El formulario envía idNumber y processType; se aceptan ambos nombres.
            nro_documento: p.idNumber || p.docNumber || null,
            ciudad_residencia: p.residenceCity || null,
            tipo_tramite: p.processType || p.tramiteType || null,
            fecha_nacimiento: p.birthDate ? new Date(p.birthDate) : null,
            fecha_estimada_viaje: p.estimatedTravelDate ? new Date(p.estimatedTravelDate) : null,
            telefono_contacto: p.phone || null,
          }
        });
      }

      // ── MASCOTAS ──
      for (const m of petServiceData) {
        const parentDetalleId = getParentDetalleId(m);
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'pet', parentDetalleId: parentDetalleId, subtotal: Number(m.total || m.subtotal || 0), ta: Number(m.ta || 0), costo_proveedor: Number(m.supplierCost || 0) } });
        await tx.prod_mascotas.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            mascota_nombre: m.petName || null, especie: m.species || null,
            raza: m.breed || null, peso_kg: Number(m.weight || 0),
            // tamanoMascota es un enum de Postgres sin eñe y el formulario envía
            // "pequeño": hay que normalizarlo antes de guardar.
            tamanoMascota: normalizarTamanoMascota(m.size),
            // travelType es cómo viaja (cabina/bodega/terrestre) y transportCompany
            // la empresa: son dos columnas distintas.
            transporte_tipo: m.travelType || null,
            empresa_transporte: m.transportCompany || null,
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
    }, {
      // Con los catálogos ya resueltos, una venta grande cabe de sobra en este
      // margen. Se deja explícito porque el defecto de Prisma son 5 s y una
      // venta con muchos productos los rozaba.
      timeout: 30000,
      maxWait: 10000,
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

  async listSales({ pagination, search, status, asesorId, clientId, responsableId, commissionAgentId, dateFrom, dateTo, permissionScope, user, sortBy, sortOrder }) {
    const { page, perPage, skip } = pagination;

    // Un solo constructor de filtros para las dos consultas: el count de Prisma
    // y el SQL del listado. Los valores van como parámetros, nunca interpolados.
    const filtros = [];
    const params = [];
    // Cada '?' del fragmento consume un valor y se convierte en $1, $2, ...
    const push = (sql, ...valores) => {
      const resuelto = sql.replace(/\?/g, () => `$${params.push(valores.shift())}`);
      filtros.push(resuelto);
    };

    const where = {};
    if (search) {
      // La búsqueda cubre lo mismo que cubría el filtro en cliente: cliente,
      // asesor, comisionista, número de venta y observaciones.
      const q = `%${search}%`;
      const como = { contains: search, mode: 'insensitive' };
      // Si el término es un número, se interpreta como número de venta exacto.
      // Ambas consultas usan la misma regla para que el total nunca discrepe.
      const comoId = /^\d+$/.test(search.trim()) ? parseInt(search.trim(), 10) : null;

      push(`(
        v.observaciones ILIKE ?
        OR (cp.nombres || ' ' || cp.apellidos) ILIKE ?
        OR (up.nombres || ' ' || up.apellidos) ILIKE ?
        OR (comp.nombres || ' ' || comp.apellidos) ILIKE ?
        ${comoId !== null ? 'OR v.id = ?' : ''}
      )`, ...(comoId !== null ? [q, q, q, q, comoId] : [q, q, q, q]));

      where.OR = [
        { observaciones: como },
        { clientes: { personas: { OR: [{ nombres: como }, { apellidos: como }] } } },
        { usuarios: { personas: { OR: [{ nombres: como }, { apellidos: como }] } } },
        { comisionistas: { personas: { OR: [{ nombres: como }, { apellidos: como }] } } },
        ...(comoId !== null ? [{ id: comoId }] : []),
      ];
    }
    if (status) {
      push('v.status = ?::"SaleStatus"', status);
      where.status = status;
    }
    if (clientId) {
      push('v.cliente_id = ?', parseInt(clientId));
      where.cliente_id = parseInt(clientId);
    }
    if (responsableId) {
      push('v.responsable_id = ?', parseInt(responsableId));
      where.responsable_id = parseInt(responsableId);
    }
    if (commissionAgentId) {
      push('v.comisionista_id = ?', parseInt(commissionAgentId));
      where.comisionista_id = parseInt(commissionAgentId);
    }
    if (dateFrom) {
      push('v.creado_at >= ?', new Date(dateFrom));
      where.creado_at = { ...(where.creado_at || {}), gte: new Date(dateFrom) };
    }
    if (dateTo) {
      push('v.creado_at <= ?', new Date(dateTo));
      where.creado_at = { ...(where.creado_at || {}), lte: new Date(dateTo) };
    }
    // El alcance 'own' manda sobre el filtro de asesor que venga por query.
    const asesorEfectivo = permissionScope === 'own' ? user.id : (asesorId ? parseInt(asesorId) : null);
    if (asesorEfectivo !== null) {
      push('v.usuario_id = ?', asesorEfectivo);
      where.usuario_id = asesorEfectivo;
    }

    const whereSql = filtros.length ? 'AND ' + filtros.join(' AND ') : '';

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
          v.porcentaje_retencion_comision as "porcentajeRetencionComision",
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
        WHERE 1=1 ${whereSql}
        ORDER BY ${sqlOrderBy} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, ...params, perPage, skip)
    ]);

    const data = ventasRaw.map(v => {
      const servicesSummary = (v.detalleVentas || []).map(d => {
        const tipo = d.categoria;
        const label = labelOf(tipo);
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
        commissionAgentRetentionPercentage: v.porcentajeRetencionComision || 0,
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

  // Cartera de crédito agrupada por cliente.
  //
  // Antes esto se calculaba en el navegador recorriendo la lista de ventas, que
  // viene paginada: la cartera salía calculada sobre una página. Aquí se agrupa
  // en SQL sobre todas las ventas a crédito del cliente.
  //
  // Reglas (las mismas que aplicaba creditUtils):
  //   venta a crédito = es_credito OR status IN ('credito','abonado')
  //   pagada  -> pagado >= total
  //   parcial -> pagado > 0          (tiene prioridad sobre vencida)
  //   vencida -> vence < hoy
  //   pendiente en cualquier otro caso
  async getCreditPortfolio({ pagination, search, status, permissionScope, user }) {
    const { page, perPage, skip } = pagination;

    const filtros = [];
    const params = [];
    const push = (sql, ...valores) => {
      filtros.push(sql.replace(/\?/g, () => `$${params.push(valores.shift())}`));
    };

    if (permissionScope === 'own' && user) push('v.usuario_id = ?', user.id);
    if (search) {
      const q = `%${search}%`;
      push(`((cp.nombres || ' ' || cp.apellidos) ILIKE ? OR cp.documento ILIKE ? OR CAST(v.id AS TEXT) ILIKE ?)`, q, q, q);
    }
    const extraSql = filtros.length ? 'AND ' + filtros.join(' AND ') : '';

    // Estado de cada venta, resuelto una sola vez y reutilizado por los agregados.
    const baseSql = `
      WITH creditos AS (
        SELECT
          v.cliente_id,
          v.monto_total,
          COALESCE(v.monto_pagado_credito, 0) AS pagado,
          v.monto_total - COALESCE(v.monto_pagado_credito, 0) AS pendiente,
          v.fecha_vence_credito,
          CASE
            WHEN COALESCE(v.monto_pagado_credito, 0) >= v.monto_total THEN 'paid'
            WHEN COALESCE(v.monto_pagado_credito, 0) > 0 THEN 'partial'
            WHEN v.fecha_vence_credito IS NOT NULL AND v.fecha_vence_credito < CURRENT_DATE THEN 'overdue'
            ELSE 'pending'
          END AS estado
        FROM ventas v
        JOIN clientes c ON v.cliente_id = c.id
        JOIN personas cp ON c.persona_id = cp.id
        WHERE v.deleted_at IS NULL
          AND v.status <> 'anulado'
          AND (v.es_credito = true OR v.status IN ('credito', 'abonado'))
          ${extraSql}
      ),
      por_cliente AS (
        SELECT
          cliente_id,
          SUM(monto_total)::float                                                   AS "totalCredit",
          SUM(pagado)::float                                                        AS "paidAmount",
          SUM(CASE WHEN estado <> 'paid' THEN pendiente ELSE 0 END)::float          AS "pendingAmount",
          SUM(CASE WHEN estado = 'overdue' THEN pendiente ELSE 0 END)::float        AS "overdueAmount",
          COUNT(*)::int                                                             AS "activeCredits",
          MIN(fecha_vence_credito)                                                  AS "nextDueDate",
          BOOL_OR(estado = 'overdue')                                               AS "tieneVencida"
        FROM creditos
        GROUP BY cliente_id
      )`;

    const [filas, totales] = await Promise.all([
      prisma.$queryRawUnsafe(`
        ${baseSql}
        SELECT
          pc.*,
          cp.nombres || ' ' || cp.apellidos AS "clientName",
          cp.documento  AS "clientDocNumber",
          cp.email      AS "clientEmail",
          cp.avatar_url AS "clientAvatar"
        FROM por_cliente pc
        JOIN clientes c ON pc.cliente_id = c.id
        JOIN personas cp ON c.persona_id = cp.id
        ORDER BY pc."overdueAmount" DESC, pc."nextDueDate" ASC NULLS LAST
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, ...params, perPage, skip),

      // Totales de TODA la cartera, no de la página.
      prisma.$queryRawUnsafe(`
        ${baseSql}
        SELECT
          COUNT(*)::int                                                     AS "clientsCount",
          COALESCE(SUM("pendingAmount"), 0)::float                          AS "totalPending",
          COALESCE(SUM("overdueAmount"), 0)::float                          AS "totalOverdue",
          COALESCE(SUM(CASE WHEN NOT "tieneVencida"
                             AND "nextDueDate" IS NOT NULL
                             AND "nextDueDate" <= CURRENT_DATE + INTERVAL '3 days'
                        THEN "pendingAmount" ELSE 0 END), 0)::float         AS "totalUrgent",
          -- Desglose por estado, para los contadores de los filtros.
          COUNT(*) FILTER (WHERE "tieneVencida")::int                       AS "countOverdue",
          COUNT(*) FILTER (WHERE NOT "tieneVencida"
                             AND "nextDueDate" IS NOT NULL
                             AND "nextDueDate" <= CURRENT_DATE + INTERVAL '3 days')::int AS "countUrgent",
          COUNT(*) FILTER (WHERE NOT "tieneVencida"
                             AND "nextDueDate" IS NOT NULL
                             AND "nextDueDate" >  CURRENT_DATE + INTERVAL '3 days'
                             AND "nextDueDate" <= CURRENT_DATE + INTERVAL '7 days')::int AS "countPending"
        FROM por_cliente
      `, ...params),
    ]);

    const total = totales[0]?.clientsCount || 0;

    const data = filas.map(f => {
      const dias = f.nextDueDate
        ? Math.ceil((new Date(f.nextDueDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000)
        : null;
      let estadoCliente = 'ok';
      if (f.tieneVencida) estadoCliente = 'overdue';
      else if (dias !== null && dias <= 3) estadoCliente = 'urgent';
      else if (dias !== null && dias <= 7) estadoCliente = 'pending';

      return {
        client: {
          id: f.cliente_id,
          name: f.clientName,
          docNumber: f.clientDocNumber,
          email: f.clientEmail,
          avatar: f.clientAvatar,
        },
        totalCredit: f.totalCredit,
        paidAmount: f.paidAmount,
        pendingAmount: f.pendingAmount,
        overdueAmount: f.overdueAmount,
        activeCredits: f.activeCredits,
        nextDueDate: f.nextDueDate,
        status: estadoCliente,
      };
    });

    const filtrada = status && status !== 'all' ? data.filter(d => d.status === status) : data;

    return {
      data: filtrada,
      meta: {
        ...buildMeta(total, page, perPage),
        totals: {
          clientsCount: total,
          totalPending: totales[0]?.totalPending || 0,
          totalOverdue: totales[0]?.totalOverdue || 0,
          totalUrgent: totales[0]?.totalUrgent || 0,
          countOverdue: totales[0]?.countOverdue || 0,
          countUrgent: totales[0]?.countUrgent || 0,
          countPending: totales[0]?.countPending || 0,
        },
      },
    };
  }

  // Campos de cabecera de una venta, sin productos.
  _saleHeader(venta) {
    return {
      id: venta.id,
      clientId: venta.cliente_id,
      clientName: `${venta.clientes.personas.nombres} ${venta.clientes.personas.apellidos}`,
      clientDocType: venta.clientes.personas.tipo_documento || null,
      clientDocNumber: venta.clientes.personas.documento || null,
      clientEmail: venta.clientes.personas.email || null,
      clientPhone: venta.clientes.personas.telefono || null,
      asesorId: venta.usuario_id,
      asesorName: `${venta.usuarios.personas.nombres} ${venta.usuarios.personas.apellidos}`,
      responsableId: venta.responsable_id || null,
      responsableName: venta.responsables ? `${venta.responsables.personas.nombres} ${venta.responsables.personas.apellidos}` : null,
      date: venta.creado_at,
      total: venta.monto_total,
      paymentMethod: venta.metodos_pago?.nombre || null,
      status: venta.status,
      observations: venta.observaciones,
      isCredit: venta.es_credito,
      creditDueDate: venta.fecha_vence_credito,
      creditPaidAmount: venta.monto_pagado_credito,
      isReviewed: venta.is_reviewed,
      commissionAgentId: venta.comisionista_id,
      commissionAgentName: venta.comisionistas ? `${venta.comisionistas.personas.nombres} ${venta.comisionistas.personas.apellidos}` : null,
      commissionAgentAmount: venta.monto_comision_bruto,
      commissionAgentRetentionPercentage: venta.porcentaje_retencion_comision || 0,
      commissionAgentNetPayment: venta.monto_comision_neto,
      supplierCost: venta.costo_proveedor_total,
      ta: venta.ta_total,
      isSettled: venta.comision_liquidada,
      payments: venta.pagos_venta.map(p => ({
        id: p.id,
        date: p.fecha_pago,
        amount: p.monto,
        method: p.metodos_pago?.nombre || null
      }))
    };
  }

  // Carga los detalles de venta indicados y los pasa por el transform de su categoría.
  // Devuelve { [slug]: [productos...] }.
  async _loadProducts(where) {
    const base = await prisma.detalle_venta.findMany({
      where,
      include: { pasajeros_detalle: { include: { personas: true } }, proveedores: true }
    });

    const detalles = await Promise.all(base.map(async (d) => {
      const entry = CATALOG[d.categoria];
      if (!entry) return d;
      const inner = entry.include[entry.relationKey];
      const queryOptions = { where: { detalle_venta_id: d.id } };
      if (inner && typeof inner === 'object' && inner.include) queryOptions.include = inner.include;
      const productData = await prisma[entry.relationKey].findUnique(queryOptions);
      return { ...d, [entry.relationKey]: productData };
    }));

    const byCategory = {};
    for (const d of detalles) {
      const entry = CATALOG[d.categoria];
      if (!entry) continue;
      const arr = byCategory[d.categoria] = byCategory[d.categoria] || [];
      // El transform emite el id del prod_*, no el del detalle_venta. El vínculo
      // padre-hijo va por detalle_venta, así que lo sellamos aquí.
      const desde = arr.length;
      entry.transform(d, mapPassengers(d), arr);
      for (let i = desde; i < arr.length; i++) arr[i].detalleId = d.id;
    }
    return byCategory;
  }

  // Cabecera de la venta, sin los datos de los productos.
  // Los productos se piden aparte con getSaleProducts / getSaleProductsByCategory.
  async getSaleById(id) {
    const [venta, inventario] = await Promise.all([
      prisma.ventas.findUnique({
        where: { id },
        include: {
          clientes: { include: { personas: true } },
          usuarios: { include: { personas: true } },
          comisionistas: { include: { personas: true } },
          responsables: { include: { personas: true } },
          metodos_pago: true,
          pagos_venta: { include: { metodos_pago: true } }
        }
      }),
      // Inventario: solo productos de primer nivel. Los hijos de un plan
      // se cuentan dentro de su plan, no como entradas propias.
      prisma.detalle_venta.groupBy({
        by: ['categoria'],
        where: { venta_id: id, parentDetalleId: null },
        _count: { _all: true }
      })
    ]);

    if (!venta) throw new NotFoundError('Venta no encontrada');

    return {
      ...this._saleHeader(venta),
      products: inventario
        .filter(r => CATALOG[r.categoria])
        .map(r => ({ category: r.categoria, label: labelOf(r.categoria), count: r._count._all }))
    };
  }

  // Todos los productos de la venta. Lo usa el voucher, que necesita la venta entera.
  async getSaleProducts(id) {
    const venta = await prisma.ventas.findUnique({ where: { id }, select: { id: true } });
    if (!venta) throw new NotFoundError('Venta no encontrada');

    const byCategory = await this._loadProducts({ venta_id: id, parentDetalleId: null });
    const children = await this._loadProducts({ venta_id: id, parentDetalleId: { not: null } });
    this._attachChildren(byCategory, children);

    const out = {};
    for (const slug of SLUGS) out[CATALOG[slug].responseKey] = byCategory[slug] || [];
    return out;
  }

  // Una sola categoría. Un producto hijo de un plan no sale aquí:
  // solo aparece dentro del GET de su plan.
  async getSaleProductsByCategory(id, category) {
    const entry = CATALOG[category];
    if (!entry) throw new NotFoundError(`Categoría de producto desconocida: ${category}`);

    const venta = await prisma.ventas.findUnique({ where: { id }, select: { id: true } });
    if (!venta) throw new NotFoundError('Venta no encontrada');

    const byCategory = await this._loadProducts({
      venta_id: id, categoria: category, parentDetalleId: null
    });

    if (category === 'plan') {
      const children = await this._loadProducts({
        venta_id: id, parentDetalleId: { not: null }
      });
      this._attachChildren(byCategory, children);
    }

    return byCategory[category] || [];
  }

  // Cuelga cada producto hijo bajo el plan al que pertenece.
  _attachChildren(byCategory, children) {
    const planes = byCategory.plan || [];
    if (!planes.length) return;
    const porId = new Map(planes.map(p => [p.detalleId, p]));
    for (const slug of CHILD_SLUGS) {
      for (const child of children[slug] || []) {
        const padre = porId.get(child.parentDetalleId);
        if (!padre) continue;
        padre.includedProducts = padre.includedProducts || {};
        padre.includedProducts[slug] = padre.includedProducts[slug] || [];
        padre.includedProducts[slug].push(child);
      }
    }
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
        method: method || null,
        reference: newPayment.referencia
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
    const payments = await prisma.pagos_venta.findMany({
      where: { venta_id: saleId },
      select: { id: true, fecha_pago: true, monto: true, metodos_pago: { select: { nombre: true } } },
      orderBy: { fecha_pago: 'asc' }
    });

    return payments.map(p => ({
      id: p.id,
      date: p.fecha_pago,
      amount: p.monto,
      method: p.metodos_pago?.nombre || null
    }));
  }

  async sendVoucher(saleId, pdfBase64) {
    if (!pdfBase64) throw new BadRequestError('El PDF es requerido (base64)');
    const venta = await prisma.ventas.findUnique({
      where: { id: saleId },
      include: { clientes: { include: { personas: true } }, usuarios: { include: { personas: true } } }
    });

    if (!venta) throw new NotFoundError('Venta no encontrada');
    const clientEmail = venta.clientes.personas.email;
    if (!clientEmail) throw new BadRequestError('El cliente no tiene correo electrónico registrado');

    const clientName = `${venta.clientes.personas.nombres} ${venta.clientes.personas.apellidos}`;
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
