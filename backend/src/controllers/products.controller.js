const prisma = require('../config/db');
const { success, error } = require('../utils/apiResponse');

const CATEGORIES = {
  ticket: 'tiqueteria', hotel: 'hoteleria', insurance: 'seguros_viaje',
  plan: 'planes', checkin: 'checkin', migration: 'documentacion_migratoria',
  simcard: 'simcard', carRental: 'renta_vehiculos', finca: 'renta_fincas',
  tour: 'tours', convention: 'centros_convencion', restaurant: 'restaurantes',
  visa: 'visa', passport: 'pasaporte', petService: 'servicio_mascotas'
};

async function getSale(saleId) {
  const id = parseInt(saleId);
  return prisma.ventas.findUnique({ where: { id } });
}

async function createDetalleProducto(tx, ventaId, categoria, data) {
  return tx.detalleVenta.create({
    data: {
      ventaId,
      categoria,
      nombreServicio: data.nombreServicio || null,
      subtotal: data.subtotal || 0,
      ta: data.ta || 0,
      costoProveedor: data.supplierCost || 0,
      proveedorId: data.supplierId ? parseInt(data.supplierId) : null,
      metodoPagoProveedorId: data.supplierPaymentMethod ? parseInt(data.supplierPaymentMethod) : null,
      voucherUrl: data.voucherUrl || null,
      fechaInicioViaje: data.startDate ? new Date(data.startDate) : null,
      fechaFinViaje: data.endDate ? new Date(data.endDate) : null,
      origen: data.origin || null,
      destino: data.destination || null,
      observaciones: data.observations || null
    }
  });
}

const productHandler = (category, tableName, transformData) => ({
  create: async (req, res, next) => {
    try {
      const venta = await getSale(req.params.saleId);
      if (!venta) return error(res, 'Venta no encontrada', 404);

      const data = req.body;
      const result = await prisma.$transaction(async (tx) => {
        const detalle = await createDetalleProducto(tx, venta.id, category, data);
        const transformed = transformData ? transformData(data, detalle.id) : { detalleVentaId: detalle.id, ...data };
        const product = await tx[tableName].create({ data: transformed });

        if (data.passengers && data.passengers.length > 0) {
          for (const p of data.passengers) {
            await tx.pasajerosDetalle.create({
              data: {
                detalleVentaId: detalle.id,
                personaId: parseInt(p.personaId) || null,
                esTitular: p.esTitular || false,
                asiento: p.asiento || null
              }
            });
          }
        }

        return { detalle, product };
      });

      success(res, result, null, 201);
    } catch (err) {
      next(err);
    }
  },
  update: async (req, res, next) => {
    try {
      const ventaId = parseInt(req.params.saleId);
      const id = req.params.id;

      const venta = await getSale(ventaId);
      if (!venta) return error(res, 'Venta no encontrada', 404);

      const data = req.body;
      const product = await prisma[tableName].update({
        where: { id },
        data: transformData ? transformData(data) : data
      });

      success(res, product);
    } catch (err) {
      next(err);
    }
  },
  delete: async (req, res, next) => {
    try {
      const id = req.params.id;
      const product = await prisma[tableName].findUnique({ where: { id } });
      if (!product) return error(res, 'Producto no encontrado', 404);

      await prisma.$transaction(async (tx) => {
        await tx[tableName].delete({ where: { id } });
        await tx.detalleVenta.delete({ where: { id: product.detalleVentaId } });
      });

      success(res, { message: 'Producto eliminado' });
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
exports.createTicket = H(CATEGORIES.ticket, 'prodTiqueteria', (d, detalleId) => ({
  detalleVentaId: detalleId,
  aerolineaId: d.airline ? parseInt(d.airline) : null,
  nroReserva: d.reservationNumber || null,
  nroVuelo: d.flightNumber || null,
  nroTiquete: d.ticketNumber || null,
  modoVuelo: d.flightMode || 'one_way',
  planEquipajeId: d.baggagePlan ? parseInt(d.baggagePlan) : null,
  checkinStatus: 'pendiente'
})).create;

exports.updateTicket = H(CATEGORIES.ticket, 'prodTiqueteria').update;
exports.deleteTicket = H(CATEGORIES.ticket, 'prodTiqueteria').delete;

// =========================================================
// Hotelería
// =========================================================
exports.createHotel = H(CATEGORIES.hotel, 'prodHoteleria', (d, detalleId) => ({
  detalleVentaId: detalleId,
  hotelNombre: d.hotelName || null,
  tipoHotel: d.hotelType || 'hotel',
  destino: d.destination || null,
  nroReserva: d.reservationNumber || null,
  fechaEntrada: d.startDate ? new Date(d.startDate) : null,
  fechaSalida: d.endDate ? new Date(d.endDate) : null,
  observaciones: d.observations || null
})).create;

exports.updateHotel = H(CATEGORIES.hotel, 'prodHoteleria').update;
exports.deleteHotel = H(CATEGORIES.hotel, 'prodHoteleria').delete;

// =========================================================
// Seguros
// =========================================================
exports.createInsurance = H(CATEGORIES.insurance, 'prodSeguros', (d, detalleId) => ({
  detalleVentaId: detalleId,
  tipoSeguro: d.insuranceType || 'basico',
  coberturaUsd: d.coverageAmount || 0,
  diasCobertura: d.coverageDays || 0,
  contactoEmergencia: d.contactName || null,
  telefonoEmergencia: d.contactNumber || null,
  direccionAsegurado: d.address || null
})).create;

exports.updateInsurance = H(CATEGORIES.insurance, 'prodSeguros').update;
exports.deleteInsurance = H(CATEGORIES.insurance, 'prodSeguros').delete;

// =========================================================
// Planes
// =========================================================
exports.createPlan = H(CATEGORIES.plan, 'prodPlanes', (d, detalleId) => ({
  detalleVentaId: detalleId,
  paqueteId: d.packageId ? parseInt(d.packageId) : null,
  nombrePlan: d.planName || null,
  aerolineaId: d.airline ? parseInt(d.airline) : null,
  nroReserva: d.reservationNumber || null,
  nroTiquete: d.ticketNumber || null,
  fechaViajeInicio: d.startDate ? new Date(d.startDate) : null,
  fechaViajeFin: d.endDate ? new Date(d.endDate) : null,
  fechaSalidaVuelo: d.flightDepartureDate ? new Date(d.flightDepartureDate) : null,
  fechaRegresoVuelo: d.flightReturnDate ? new Date(d.flightReturnDate) : null,
  adultosCount: d.adultsCount || 0,
  menoresCount: d.childrenCount || 0,
  numeroConfirmacion: d.confirmationNumber || null,
  observaciones: d.observations || null
})).create;

exports.updatePlan = H(CATEGORIES.plan, 'prodPlanes').update;
exports.deletePlan = H(CATEGORIES.plan, 'prodPlanes').delete;

// =========================================================
// Check-in
// =========================================================
exports.createCheckin = H(CATEGORIES.checkin, 'prodCheckins', (d, detalleId) => ({
  detalleVentaId: detalleId,
  nroVueloReserva: d.flightOrReservation || null,
  fechaViaje: d.travelDate ? new Date(d.travelDate) : null,
  asiento: d.seat || null,
  maletasContadas: d.baggage || null,
  telefonoContacto: d.phone || null,
  necesidadesEspeciales: d.specialNeeds || null,
  usaSillaRuedas: d.needsWheelchair || false
})).create;

exports.updateCheckin = H(CATEGORIES.checkin, 'prodCheckins').update;
exports.deleteCheckin = H(CATEGORIES.checkin, 'prodCheckins').delete;

// =========================================================
// Migración
// =========================================================
exports.createMigration = H(CATEGORIES.migration, 'prodMigracion', (d, detalleId) => ({
  detalleVentaId: detalleId,
  tipoTramiteMigratorio: d.requestedDocType || null,
  nacionalidad: d.nationality || null,
  pasaporteNro: d.passportNumber || null,
  pasaporteVence: d.passportExpiry ? new Date(d.passportExpiry) : null,
  paisDestino: d.destinationCountry || null
})).create;

exports.updateMigration = H(CATEGORIES.migration, 'prodMigracion').update;
exports.deleteMigration = H(CATEGORIES.migration, 'prodMigracion').delete;

// =========================================================
// SIM Card
// =========================================================
exports.createSimcard = H(CATEGORIES.simcard, 'prodSimcards', (d, detalleId) => ({
  detalleVentaId: detalleId,
  paisDestino: d.destinationCountry || null,
  fechaLlegada: d.arrivalDate ? new Date(d.arrivalDate) : null,
  duracionViaje: d.tripDuration || null,
  planDatos: d.dataPlan || null,
  tipoSim: d.simType || null,
  metodoEntrega: d.deliveryMethod || null
})).create;

exports.updateSimcard = H(CATEGORIES.simcard, 'prodSimcards').update;
exports.deleteSimcard = H(CATEGORIES.simcard, 'prodSimcards').delete;

// =========================================================
// Renta de Autos
// =========================================================
exports.createCarRental = H(CATEGORIES.carRental, 'prodAutos', (d, detalleId) => ({
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
})).create;

exports.updateCarRental = H(CATEGORIES.carRental, 'prodAutos').update;
exports.deleteCarRental = H(CATEGORIES.carRental, 'prodAutos').delete;

// =========================================================
// Fincas
// =========================================================
exports.createFinca = H(CATEGORIES.finca, 'prodFincas', (d, detalleId) => ({
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
})).create;

exports.updateFinca = H(CATEGORIES.finca, 'prodFincas').update;
exports.deleteFinca = H(CATEGORIES.finca, 'prodFincas').delete;

// =========================================================
// Tours
// =========================================================
exports.createTour = H(CATEGORIES.tour, 'prodTours', (d, detalleId) => ({
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
})).create;

exports.updateTour = H(CATEGORIES.tour, 'prodTours').update;
exports.deleteTour = H(CATEGORIES.tour, 'prodTours').delete;

// =========================================================
// Centros de Convención
// =========================================================
exports.createConvention = H(CATEGORIES.convention, 'prodEventos', (d, detalleId) => ({
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
})).create;

exports.updateConvention = H(CATEGORIES.convention, 'prodEventos').update;
exports.deleteConvention = H(CATEGORIES.convention, 'prodEventos').delete;

// =========================================================
// Restaurantes
// =========================================================
exports.createRestaurant = H(CATEGORIES.restaurant, 'prodRestaurantes', (d, detalleId) => ({
  detalleVentaId: detalleId,
  nombreReserva: d.reservationName || null,
  fechaHoraReserva: d.dateTime ? new Date(d.dateTime) : null,
  personasCount: d.peopleCount || 0,
  preferenciaMesa: d.tablePreference || null,
  tipoMenu: d.menuType || null,
  restriccionesDieta: d.dietaryRestrictions?.join(', ') || null,
  ocasionEspecial: d.specialOccasion || null,
  telefonoContacto: d.phone || null
})).create;

exports.updateRestaurant = H(CATEGORIES.restaurant, 'prodRestaurantes').update;
exports.deleteRestaurant = H(CATEGORIES.restaurant, 'prodRestaurantes').delete;

// =========================================================
// Visa
// =========================================================
exports.createVisa = H(CATEGORIES.visa, 'prodVisas', (d, detalleId) => ({
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
})).create;

exports.updateVisa = H(CATEGORIES.visa, 'prodVisas').update;
exports.deleteVisa = H(CATEGORIES.visa, 'prodVisas').delete;

// =========================================================
// Pasaporte
// =========================================================
exports.createPassport = H(CATEGORIES.passport, 'prodPasaportes', (d, detalleId) => ({
  detalleVentaId: detalleId,
  nombreCompleto: d.fullName || null,
  nroDocumento: d.idNumber || null,
  fechaNacimiento: d.birthDate ? new Date(d.birthDate) : null,
  ciudadResidencia: d.residenceCity || null,
  tipoTramite: d.processType || null,
  fechaEstimadaViaje: d.estimatedTravelDate ? new Date(d.estimatedTravelDate) : null,
  telefonoContacto: d.phone || null
})).create;

exports.updatePassport = H(CATEGORIES.passport, 'prodPasaportes').update;
exports.deletePassport = H(CATEGORIES.passport, 'prodPasaportes').delete;

// =========================================================
// Servicio de Mascotas
// =========================================================
exports.createPetService = H(CATEGORIES.petService, 'prodMascotas', (d, detalleId) => ({
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
})).create;

exports.updatePetService = H(CATEGORIES.petService, 'prodMascotas').update;
exports.deletePetService = H(CATEGORIES.petService, 'prodMascotas').delete;

// =========================================================
// Voucher Upload
// =========================================================
exports.uploadVoucher = async (req, res, next) => {
  try {
    const { saleId, category, productId } = req.params;
    if (!req.file) return error(res, 'Archivo requerido', 400);

    const productTables = {
      ticket: 'prodTiqueteria', hotel: 'prodHoteleria', insurance: 'prodSeguros',
      plan: 'prodPlanes', checkin: 'prodCheckins', migration: 'prodMigracion',
      simcard: 'prodSimcards', carRental: 'prodAutos', finca: 'prodFincas',
      tour: 'prodTours', convention: 'prodEventos', restaurant: 'prodRestaurantes',
      visa: 'prodVisas', passport: 'prodPasaportes', petService: 'prodMascotas'
    };

    const tableName = productTables[category];
    if (!tableName) return error(res, 'Categoría inválida', 400);

    const product = await prisma[tableName].findUnique({ where: { id: productId } });
    if (!product) return error(res, 'Producto no encontrado', 404);
    const voucherUrl = `/uploads/${req.file.filename}`;

    await prisma.detalleVenta.update({
      where: { id: product.detalleVentaId },
      data: { voucherUrl }
    });

    success(res, { voucherUrl });
  } catch (err) {
    next(err);
  }
};
