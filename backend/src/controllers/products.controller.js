const prisma = require('../config/db');
const { success, noContent, error } = require('../utils/apiResponse');
const { randomUUID } = require('crypto');
// Fuente de verdad de las categorías: un slug, el mismo en URL y en base de datos.
const { CATALOG } = require('../catalog/products');
const { ForbiddenError } = require('../errors/AppError');
// El dinero de la venta lo deriva el servidor: misma regla que usa `createSale`.
const { recalcularVenta, precioProducto } = require('../services/saleTotals');
const { enHoraColombia } = require('../utils/fechas');
const { esquemaDeCategoria, comprobarColumnas } = require('../schemas/products.schema');
const { responderInvalido } = require('../middleware/validate');


async function findOrCreatePersona(tx, name, docType, docNumber, defaultPersonaId) {
  if (!name && !docNumber) {
    return defaultPersonaId || null;
  }
  
  if (docNumber) {
    const match = await tx.personas.findFirst({
      where: { documento: String(docNumber) }
    });
    if (match) return match.id;
  }

  const nameParts = (name || '').trim().split(/\s+/);
  const nombres = nameParts[0] || 'Pasajero';
  const apellidos = nameParts.slice(1).join(' ') || 'Temporal';

  let tipo_documento_id = null;
  if (docType) {
    const td = await tx.tipos_documento.findUnique({
      where: { abreviatura: String(docType) }
    });
    if (td) tipo_documento_id = td.id;
  }

  const newPersona = await tx.personas.create({
    data: {
      nombres,
      apellidos,
      tipo_documento_id,
      documento: docNumber ? String(docNumber) : null,
      status: 'active'
    }
  });
  return newPersona.id;
}

/**
 * La venta a la que se le van a tocar los productos.
 *
 * `deleted_at: null`: sin este filtro se podían añadir y borrar productos de
 * una venta eliminada, que no aparece en ningún listado.
 *
 * Y con el alcance de quien pide: si su permiso de ver ventas es 'own', no
 * puede añadir ni quitar productos de la venta de otro. El alcance solo se
 * aplicaba en los listados.
 */
async function getSale(saleId, req) {
  const id = parseInt(saleId);
  const venta = await prisma.ventas.findFirst({ where: { id, deleted_at: null } });
  if (!venta) return null;
  // El alcance de VER, no el de la acción: `create` y `edit` son booleanas y no
  // llevan alcance, así que con el de la acción esto no se cumplía nunca.
  if (req?.viewScope === 'own' && req.user && venta.usuario_id !== req.user.id) {
    throw new ForbiddenError('No puede modificar una venta de otro asesor');
  }
  return venta;
}

async function createDetalleProducto(tx, venta_id, categoria, data) {
  return tx.detalle_venta.create({
    data: {
      id: randomUUID(),
      venta_id,
      categoria,
      nombre_servicio: data.nombre_servicio || null,
      subtotal: precioProducto(data),
      ta: Number(data.ta) || 0,
      costo_proveedor: Number(data.supplierCost) || 0,
      proveedor_id: data.supplierId ? parseInt(data.supplierId) : null,
      metodo_pago_proveedor_id: data.supplierPaymentMethod ? parseInt(data.supplierPaymentMethod) : null,
      voucher_url: data.voucher_url || null,
      fecha_inicio_viaje: data.startDate ? new Date(data.startDate) : null,
      fecha_fin_viaje: data.endDate ? new Date(data.endDate) : null,
      origen: data.origin || null,
      destino: data.destination || null,
      observaciones: data.observations || null
    }
  });
}

/**
 * Las 30 rutas de producto (alta y baja de cada categoría) salen de aquí, así
 * que aquí va la validación.
 *
 * Los 15 POST no tenían ninguna: el cuerpo entraba entero al transform y de ahí
 * a Prisma. Ponerla en cada declaración de ruta habría sido quince sitios donde
 * olvidarla al añadir la categoría dieciséis; el esquema se resuelve por
 * `category`, que es lo que distingue a un handler de otro. Las reglas y el por
 * qué están en schemas/products.schema.js.
 *
 * No hay `update`: los productos de una venta no se editan desde ninguna
 * pantalla, y el PUT y el PATCH que existían solo se alcanzaban por la API, sin
 * tocar los tramos de un tiquete (T8 de la spec 002). Se retiraron.
 */
const productHandler = (category, tableName, transformData) => ({
  create: async (req, res, next) => {
    try {
      const revisado = esquemaDeCategoria(category).safeParse(req.body);
      if (!revisado.success) return responderInvalido(res, revisado.error);

      const venta = await getSale(req.params.saleId, req);
      if (!venta) return error(res, 'Venta no encontrada', 404);

      const data = req.body;
      const result = await prisma.transaccion(async (tx) => {
        const detalle = await createDetalleProducto(tx, venta.id, category, data);
        const transformed = transformData ? transformData(data, detalle.id) : { detalle_venta_id: detalle.id, ...data };
        if (!transformed.id) transformed.id = randomUUID();
        comprobarColumnas(tableName, transformed);
        const product = await tx[tableName].create({ data: transformed });

        const pasajerosDetalleData = [];
        const cliente = await tx.clientes.findUnique({
          where: { id: venta.cliente_id },
          select: { persona_id: true }
        });
        const defaultPersonaId = cliente?.persona_id;

        if (data.passengers || data.passengerInfo || data.guests) {
          const passengers = data.passengers ? data.passengers : (data.passengerInfo ? [data.passengerInfo] : (data.guests || []));
          for (const p of passengers) {
            const resolvedPid = await findOrCreatePersona(tx, p.name || p.passengerName || p.fullName, p.docType, p.docNumber, defaultPersonaId);
            pasajerosDetalleData.push({
              persona_id: resolvedPid,
              es_titular: p.esTitular ?? true,
              asiento: p.asiento || p.seat || null,
              nro_reserva: p.nroReserva || null,
              nro_tiquete: p.nroTiquete || null
            });
          }
        } else {
          const passengerName = data.passengerName || data.mainDriver || data.responsibleName || data.ownerName || data.fullName || data.reservationName || data.contactName;
          const docType = data.docType;
          const docNumber = data.docNumber || data.licenseNumber || data.passportNumber || data.idNumber;
          
          if (passengerName || docNumber || ['checkin', 'migration', 'simcard', 'tour', 'pet', 'car'].includes(category)) {
            const resolvedPid = await findOrCreatePersona(tx, passengerName, docType, docNumber, defaultPersonaId);
            pasajerosDetalleData.push({
              persona_id: resolvedPid,
              es_titular: true,
              asiento: data.seat || data.seatNumber || null,
              nro_reserva: null,
              nro_tiquete: null
            });
          }
        }

        for (const passengerData of pasajerosDetalleData) {
          await tx.pasajeros_detalle.create({
            data: {
              id: randomUUID(),
              detalle_venta_id: detalle.id,
              persona_id: passengerData.persona_id,
              es_titular: passengerData.es_titular,
              asiento: passengerData.asiento,
              nro_reserva: passengerData.nro_reserva,
              nro_tiquete: passengerData.nro_tiquete
            }
          });
        }

        if (tableName === 'prod_tiqueteria') {
          const allLegs = [...(data.legs || [])];
          if (data.returnLeg) allLegs.push(data.returnLeg);
          for (let i = 0; i < allLegs.length; i++) {
            const leg = allLegs[i];
            if (!leg.origin || !leg.destination) continue;
            const originAirport = await tx.aeropuertos.findFirst({ where: { codigo_iata: leg.origin } });
            const destAirport = await tx.aeropuertos.findFirst({ where: { codigo_iata: leg.destination } });
            if (!originAirport || !destAirport) continue;

            let aerolinea_id = null;
            const legAirline = leg.airline || data.airline;
            if (legAirline) {
              const parsedId = parseInt(legAirline);
              if (!isNaN(parsedId)) {
                aerolinea_id = parsedId;
              } else {
                const match = await tx.aerolineas.findFirst({ where: { nombre: legAirline } });
                aerolinea_id = match?.id || null;
              }
            }

            let planEquipajeId = null;
            const legBaggagePlan = leg.baggagePlan || data.baggagePlan;
            if (legBaggagePlan) {
              const parsedId = parseInt(legBaggagePlan);
              if (!isNaN(parsedId)) {
                planEquipajeId = parsedId;
              } else {
                const parts = legBaggagePlan.split(' - ');
                if (parts.length >= 2) {
                  const airlineName = parts[0];
                  const fareType = parts.slice(1).join(' - ');
                  const match = await tx.politicas_equipaje.findFirst({
                    where: {
                      AND: [
                        { aerolineas: { nombre: airlineName } },
                        { tipo_tarifa: fareType }
                      ]
                    }
                  });
                  if (match) planEquipajeId = match.id;
                }
                if (!planEquipajeId) {
                  const match = await tx.politicas_equipaje.findFirst({ where: { tipo_tarifa: legBaggagePlan } });
                  planEquipajeId = match?.id || null;
                }
              }
            }

            const salidaTramo = enHoraColombia(leg.date, leg.departureTime || leg.time) || new Date();

            await tx.tramos_vuelo.create({
              data: {
                id: randomUUID(),
                prod_tiqueteria_id: product.id,
                aeropuerto_origen_id: originAirport.id,
                aeropuerto_destino_id: destAirport.id,
                // Mismo criterio que `createSale`: la hora se interpreta en
                // Colombia, no en la zona del proceso. Aquí, además, la hora se
                // perdía entera —ambas columnas guardaban `new Date(leg.date)`,
                // sin `departureTime`— y la llegada quedaba idéntica a la
                // salida, así que todo tramo dado de alta por este endpoint
                // salía a medianoche y con duración cero.
                salida: salidaTramo,
                llegada: enHoraColombia(leg.arrivalDate || leg.date, leg.arrivalTime)
                  || new Date(salidaTramo.getTime() + 3600000),
                nro_vuelo_tramo: leg.flightNumber || null,
                asiento: leg.seat || null,
                nro_tiquete: leg.ticketNumber || null,
                aerolinea_id,
                plan_equipaje_id: planEquipajeId,
                orden: i + 1
              }
            });
          }
        }

        // Añadir un producto cambia lo que debe el cliente. Sin esto la
        // cabecera se quedaba con el importe del día de la venta.
        await recalcularVenta(tx, venta.id);

        return { detalle, product };
      });

      success(res, result, null, 201);
    } catch (err) {
      next(err);
    }
  },
  delete: async (req, res, next) => {
    try {
      const id = req.params.productId;
      const product = await prisma[tableName].findUnique({ where: { id } });
      if (!product) return error(res, 'Producto no encontrado', 404);

      // El borrado no comprobaba la venta: ni que estuviera vigente ni de quién
      // era. Se llega a ella por el `:saleId` de la ruta, que es donde el
      // cliente dice a qué venta pertenece, y se comprueba que el producto sea
      // de esa venta: sin eso, el id de una venta propia serviría de llave para
      // borrar el producto de cualquier otra.
      const venta = await getSale(req.params.saleId, req);
      if (!venta) return error(res, 'Venta no encontrada', 404);
      const linea = await prisma.detalle_venta.findUnique({
        where: { id: product.detalle_venta_id },
        select: { venta_id: true },
      });
      if (linea?.venta_id !== venta.id) return error(res, 'Producto no encontrado', 404);

      await prisma.transaccion(async (tx) => {
        const detalle = await tx.detalle_venta.findUnique({
          where: { id: product.detalle_venta_id },
          select: { venta_id: true },
        });

        // Lo que cuelga del producto se borra antes que él. Sin esto la clave
        // foránea abortaba la transacción entera —comprobado: un DELETE de una
        // simcard con pasajero devolvía 400 con
        // `pasajeros_detalle_detalle_venta_id_fkey`—, así que un producto
        // creado por este endpoint no se podía borrar nunca.
        if (tableName === 'prod_tiqueteria') {
          await tx.tramos_vuelo.deleteMany({ where: { prod_tiqueteria_id: id } });
        }
        await tx.pasajeros_detalle.deleteMany({ where: { detalle_venta_id: product.detalle_venta_id } });

        await tx[tableName].delete({ where: { id } });
        await tx.detalle_venta.delete({ where: { id: product.detalle_venta_id } });
        if (detalle) await recalcularVenta(tx, detalle.venta_id);
      });

      noContent(res);
    } catch (err) {
      next(err);
    }
  }
});

// Helper para crear handlers para cada categoría
const H = productHandler;

// =========================================================
// Tiquetería
// =========================================================
const handlerTicket = H('ticket', 'prod_tiqueteria', (d, detalleId) => ({
  detalle_venta_id: detalleId,
  aerolineaId: d.airline ? parseInt(d.airline) : null,
  nro_reserva: d.reservationNumber || null,
  nro_vuelo: d.flightNumber || null,
  nro_tiquete: d.ticketNumber || null,
  modo_vuelo: d.flightMode || 'one_way',
  planEquipajeId: d.baggagePlan ? parseInt(d.baggagePlan) : null,
  checkin_status: 'pendiente'
}));
exports.createTicket = handlerTicket.create;
exports.deleteTicket = handlerTicket.delete;

// =========================================================
// Hotelería
// =========================================================
const handlerHotel = H('hotel', 'prod_hoteleria', (d, detalleId) => ({
  detalle_venta_id: detalleId,
  hotel_nombre: d.hotelName || null,
  tipo_hotel: d.hotelType || 'hotel',
  destino: d.destination || null,
  nro_reserva: d.reservationNumber || null,
  fecha_entrada: d.startDate ? new Date(d.startDate) : null,
  fecha_salida: d.endDate ? new Date(d.endDate) : null,
  observaciones: d.observations || null
}));
exports.createHotel = handlerHotel.create;
exports.deleteHotel = handlerHotel.delete;

// =========================================================
// Seguros
// =========================================================
const handlerInsurance = H('insurance', 'prod_seguros', (d, detalleId) => ({
  detalle_venta_id: detalleId,
  tipo_seguro: d.insuranceType || 'basico',
  cobertura_usd: d.coverageAmount || 0,
  dias_cobertura: d.coverageDays || 0,
  // prod_seguros solo tiene telefono_contacto; no hay columna para nombre de
  // contacto ni dirección del asegurado, así que no se persisten.
  telefono_contacto: d.contactNumber || null,
  fecha_inicio_vigencia: d.startDate ? new Date(d.startDate) : null,
  fecha_fin_vigencia: d.endDate ? new Date(d.endDate) : null
}));
exports.createInsurance = handlerInsurance.create;
exports.deleteInsurance = handlerInsurance.delete;

// =========================================================
// Planes
// =========================================================
const handlerPlan = H('plan', 'prod_planes', (d, detalleId) => ({
  detalle_venta_id: detalleId,
  paqueteId: d.packageId ? parseInt(d.packageId) : null,
  nombre_plan: d.planName || null,
  aerolineaId: d.airline ? parseInt(d.airline) : null,
  nro_reserva: d.reservationNumber || null,
  nro_tiquete: d.ticketNumber || null,
  // El número de vuelo no se guardaba: el transform lo omitía y `createSale`
  // sí lo escribe, así que el mismo plan salía con número o sin él según se
  // vendiera de una vez o se añadiera después.
  nro_vuelo: d.flightNumber || null,
  fecha_viaje_inicio: d.startDate ? new Date(d.startDate) : null,
  fecha_viaje_fin: d.endDate ? new Date(d.endDate) : null,
  // En hora de Colombia y con las dos llegadas, que no se guardaban. Con
  // `new Date('2026-11-01')` el vuelo aparece el día anterior en cuanto el
  // servidor no está en Bogotá, que es el caso normal al desplegar.
  fecha_salida_vuelo: enHoraColombia(d.flightDepartureDate),
  fecha_llegada_vuelo: enHoraColombia(d.flightDepartureArrivalDate),
  fecha_regreso_vuelo: enHoraColombia(d.flightReturnDate),
  fecha_llegada_regreso_vuelo: enHoraColombia(d.flightReturnArrivalDate),
  nombre_hotel: d.hotelName || null,
  paquete_tarifa_id: d.packageRateId ? parseInt(d.packageRateId) : null,
  tipo_paquete: d.packageType || 'own',
  tipo_transporte: d.transportType || 'Aereo',
  adultos_count: d.adultsCount || 0,
  menores_count: d.childrenCount || 0,
  numero_confirmacion: d.confirmationNumber || null,
  observaciones: d.observations || null
}));
exports.createPlan = handlerPlan.create;
exports.deletePlan = handlerPlan.delete;

// =========================================================
// Check-in
// =========================================================
const handlerCheckin = H('checkin', 'prod_checkins', (d, detalleId) => ({
  detalle_venta_id: detalleId,
  nro_vuelo_reserva: d.flightOrReservation || null,
  fecha_viaje: d.travelDate ? new Date(d.travelDate) : null,
  asiento: d.seat || null,
  maletas_contadas: d.baggage || null,
  telefono_contacto: d.phone || null,
  necesidades_especiales: d.specialNeeds || null,
  usa_silla_ruedas: d.needsWheelchair || false
}));
exports.createCheckin = handlerCheckin.create;
exports.deleteCheckin = handlerCheckin.delete;

// =========================================================
// Migración
// =========================================================
const handlerMigration = H('migration', 'prod_migracion', (d, detalleId) => ({
  detalle_venta_id: detalleId,
  tipo_tramite_migratorio: d.requestedDocType || null,
  nacionalidad: d.nationality || null,
  pasaporte_nro: d.passportNumber || null,
  pasaporte_vence: d.passportExpiry ? new Date(d.passportExpiry) : null,
  pais_destino: d.destinationCountry || null
}));
exports.createMigration = handlerMigration.create;
exports.deleteMigration = handlerMigration.delete;

// =========================================================
// SIM Card
// =========================================================
const handlerSimcard = H('simcard', 'prod_simcards', (d, detalleId) => ({
  detalle_venta_id: detalleId,
  pais_destino: d.destinationCountry || null,
  fecha_llegada: d.arrivalDate ? new Date(d.arrivalDate) : null,
  duracion_viaje: d.tripDuration || null,
  plan_datos: d.dataPlan || null,
  tipo_sim: d.simType || null,
  metodo_entrega: d.deliveryMethod || null
}));
exports.createSimcard = handlerSimcard.create;
exports.deleteSimcard = handlerSimcard.delete;

// =========================================================
// Renta de Autos
// =========================================================
const handlerCarRental = H('car', 'prod_autos', (d, detalleId) => ({
  detalle_venta_id: detalleId,
  conductor_nombre: d.mainDriver || null,
  licencia_nro: d.licenseNumber || null,
  fecha_recogida: d.pickupDate ? new Date(d.pickupDate) : null,
  fecha_devolucion: d.returnDate ? new Date(d.returnDate) : null,
  lugar_recogida: d.pickupLocation || null,
  categoria_auto: d.vehicleCategory || null,
  conductores_adicionales: d.additionalDrivers || 0,
  tipo_seguro: d.insuranceType || null,
  tarjeta_garantia_info: d.guaranteeCreditCard || null
}));
exports.createCarRental = handlerCarRental.create;
exports.deleteCarRental = handlerCarRental.delete;

// =========================================================
// Fincas
// =========================================================
const handlerFinca = H('finca', 'prod_fincas', (d, detalleId) => ({
  detalle_venta_id: detalleId,
  responsable_nombre: d.responsibleName || null,
  documento_responsable: d.docNumber || null,
  fecha_entrada: d.checkInDate ? new Date(d.checkInDate) : null,
  fecha_salida: d.checkOutDate ? new Date(d.checkOutDate) : null,
  adultos_count: d.adultsCount || 0,
  ninos_count: d.childrenCount || 0,
  tiene_mascotas: d.hasPets || false,
  tipo_mascota: d.petType || null,
  servicios_extra: d.additionalServices?.join(', ') || null
}));
exports.createFinca = handlerFinca.create;
exports.deleteFinca = handlerFinca.delete;

// =========================================================
// Tours
// =========================================================
const handlerTour = H('tour', 'prod_tours', (d, detalleId) => ({
  detalle_venta_id: detalleId,
  tour_nombre: d.selectedTour || null,
  fecha_preferida: d.preferredDate ? new Date(d.preferredDate) : null,
  adultos_count: d.adultsCount || 1,
  menores_count: d.childrenCount || 0,
  edades_menores: d.childrenAges || null,
  idioma_guia: d.guideLanguage || null,
  requiere_transporte: d.needsTransport || false,
  punto_encuentro: d.pickupPoint || null,
  condiciones_medicas: d.medicalConditions || null,
  telefono_contacto: d.phone || null
}));
exports.createTour = handlerTour.create;
exports.deleteTour = handlerTour.delete;

// =========================================================
// Centros de Convención
// =========================================================
const handlerConvention = H('convention', 'prod_eventos', (d, detalleId) => ({
  detalle_venta_id: detalleId,
  organizacion: d.organization || null,
  nombre_contacto: d.contactName || null,
  email_contacto: d.email || null,
  fechaInicio: d.startDate ? new Date(d.startDate) : null,
  fechaFin: d.endDate ? new Date(d.endDate) : null,
  asistencia_estimada: d.estimatedAttendance || 0,
  espacio_requerido: d.requiredSpace || null,
  tipo_evento: d.eventType || null,
  equipos_av: d.avEquipment?.join(', ') || null,
  requiere_catering: d.hasCatering || false,
  notas_catering: d.cateringNotes || null
}));
exports.createConvention = handlerConvention.create;
exports.deleteConvention = handlerConvention.delete;

// =========================================================
// Restaurantes
// =========================================================
const handlerRestaurant = H('restaurant', 'prod_restaurantes', (d, detalleId) => ({
  detalle_venta_id: detalleId,
  nombre_reserva: d.reservationName || null,
  fecha_hora_reserva: d.dateTime ? new Date(d.dateTime) : null,
  personas_count: d.peopleCount || 0,
  preferencia_mesa: d.tablePreference || null,
  tipo_menu: d.menuType || null,
  restricciones_dieta: d.dietaryRestrictions?.join(', ') || null,
  ocasion_especial: d.specialOccasion || null,
  telefono_contacto: d.phone || null
}));
exports.createRestaurant = handlerRestaurant.create;
exports.deleteRestaurant = handlerRestaurant.delete;

// =========================================================
// Visa
// =========================================================
const handlerVisa = H('visa', 'prod_visas', (d, detalleId) => ({
  detalle_venta_id: detalleId,
  nombre_completo: d.fullName || null,
  fecha_nacimiento: d.birthDate ? new Date(d.birthDate) : null,
  nacionalidad: d.nationality || null,
  nro_pasaporte: d.passportNumber || null,
  vencimiento_pasaporte: d.passportExpiration ? new Date(d.passportExpiration) : null,
  pais_aplicacion: d.countryApplying || null,
  tipo_visa: d.visaType || null,
  fecha_estimada_viaje: d.estimatedTravelDate ? new Date(d.estimatedTravelDate) : null,
  email_contacto: d.email || null
}));
exports.createVisa = handlerVisa.create;
exports.deleteVisa = handlerVisa.delete;

// =========================================================
// Pasaporte
// =========================================================
const handlerPassport = H('passport', 'prod_pasaportes', (d, detalleId) => ({
  detalle_venta_id: detalleId,
  nombre_completo: d.fullName || null,
  nro_documento: d.idNumber || null,
  fecha_nacimiento: d.birthDate ? new Date(d.birthDate) : null,
  ciudad_residencia: d.residenceCity || null,
  tipo_tramite: d.processType || null,
  fecha_estimada_viaje: d.estimatedTravelDate ? new Date(d.estimatedTravelDate) : null,
  telefono_contacto: d.phone || null
}));
exports.createPassport = handlerPassport.create;
exports.deletePassport = handlerPassport.delete;

// =========================================================
// Servicio de Mascotas
// =========================================================
const handlerPetService = H('pet', 'prod_mascotas', (d, detalleId) => ({
  detalle_venta_id: detalleId,
  mascota_nombre: d.petName || null,
  especie: d.species || null,
  raza: d.breed || null,
  peso_kg: d.weight || 0,
  tamanoMascota: d.size === "pequeño" ? "pequeno" : (d.size || null),
  transporte_tipo: d.travelType || null,
  fecha_viaje: d.travelDate ? new Date(d.travelDate) : null,
  pais_destino: d.destinationCountry || null,
  condiciones_medicas: d.medicalConditions || null,
  telefono_contacto: d.phone || null
}));
exports.createPetService = handlerPetService.create;
exports.deletePetService = handlerPetService.delete;

// =========================================================
// Voucher Upload
// =========================================================
exports.uploadVoucher = async (req, res, next) => {
  try {
    const { saleId, category, productId } = req.params;
    if (!req.file) return error(res, 'Archivo requerido', 400);

    const productTables = {
      ticket: 'prod_tiqueteria', hotel: 'prod_hoteleria', insurance: 'prod_seguros',
      plan: 'prod_planes', checkin: 'prod_checkins', migration: 'prod_migracion',
      simcard: 'prod_simcards', carRental: 'prod_autos', finca: 'prod_fincas',
      tour: 'prod_tours', convention: 'prod_eventos', restaurant: 'prod_restaurantes',
      visa: 'prod_visas', passport: 'prod_pasaportes', petService: 'prod_mascotas'
    };

    const tableName = productTables[category];
    if (!tableName) return error(res, 'Categoría inválida', 400);

    const product = await prisma[tableName].findUnique({ where: { id: productId } });
    if (!product) return error(res, 'Producto no encontrado', 404);
    const voucher_url = `/uploads/${req.file.filename}`;

    await prisma.detalle_venta.update({
      where: { id: product.detalle_venta_id },
      data: { voucher_url }
    });

    success(res, { voucher_url });
  } catch (err) {
    next(err);
  }
};
