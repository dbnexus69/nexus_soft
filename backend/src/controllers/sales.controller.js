const prisma = require('../config/db');
const { success, error } = require('../utils/apiResponse');
const { buildMeta } = require('../utils/paginationHelper');

exports.list = async (req, res, next) => {
  try {
    const { page, perPage, skip } = req.pagination;
    const { search, sortBy, sortOrder } = req;
    const { status, asesorId, clientId, dateFrom, dateTo } = req.query;

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

    const [total, ventas] = await Promise.all([
      prisma.ventas.count({ where }),
      prisma.ventas.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { [effectiveSortBy]: sortOrder },
        include: {
          cliente: { select: { persona: { select: { nombres: true, apellidos: true } } } },
          usuario: { select: { persona: { select: { nombres: true, apellidos: true } } } },
          comisionista: { select: { persona: { select: { nombres: true, apellidos: true } } } },
        }
      })
    ]);

    const data = ventas.map(v => ({
      id: v.id,
      clientId: v.clienteId,
      clientName: `${v.cliente.persona.nombres} ${v.cliente.persona.apellidos}`,
      asesorId: v.usuarioId,
      asesorName: `${v.usuario.persona.nombres} ${v.usuario.persona.apellidos}`,
      date: v.creadoAt,
      total: v.montoTotal,
      status: v.status,
      observations: v.observaciones,
      isCredit: v.esCredito,
      creditDueDate: v.fechaVenceCredito,
      creditPaidAmount: v.montoPagadoCredito,
      commissionAgentId: v.comisionistaId,
      commissionAgentName: v.comisionista ? `${v.comisionista.persona.nombres} ${v.comisionista.persona.apellidos}` : null,
      commissionAgentAmount: v.montoComisionBruto,
      commissionAgentNetPayment: v.montoComisionNeto,
      supplierCost: v.costoProveedorTotal,
      ta: v.taTotal,
      isSettled: v.comisionLiquidada,
    }));

    success(res, data, buildMeta(total, page, perPage));
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const venta = await prisma.ventas.findUnique({
      where: { id },
      include: {
        cliente: { include: { persona: true } },
        usuario: { include: { persona: true } },
        comisionista: { include: { persona: true } },
        metodoPagoPrincipal: true,
        pagosVenta: { include: { metodoPago: true } },
        detalleVentas: {
          include: {
            pasajerosDetalle: { include: { persona: true } },
            prodTiqueteria: { include: { tramosVuelo: true, aerolinea: true } },
            prodHoteleria: true,
            prodSeguros: true,
            prodPlanes: { include: { paquete: true } },
            prodCheckins: true,
            prodMigracion: true,
            prodSimcards: true,
            prodAutos: true,
            prodFincas: true,
            prodTours: true,
            prodEventos: true,
            prodRestaurantes: true,
            prodVisas: true,
            prodPasaportes: true,
            prodMascotas: true,
            proveedor: true
          }
        }
      }
    });

    if (!venta) return error(res, 'Venta no encontrada', 404);
    success(res, venta);
  } catch (err) {
    next(err);
  }
};

const PRODUCT_HANDLERS = {
  ticketData: {
    category: 'tiqueteria', table: 'prodTiqueteria',
    nombreServicio: 'Tiquetería',
    transform: (d, detalleId) => ({
      detalleVentaId: detalleId,
      aerolineaId: d.airline ? parseInt(d.airline) : null,
      nroReserva: d.reservationNumber || null,
      nroVuelo: d.flightNumber || null,
      nroTiquete: d.ticketNumber || null,
      modoVuelo: d.flightMode || 'one_way',
      planEquipajeId: d.baggagePlan ? parseInt(d.baggagePlan) : null,
      checkinStatus: 'pendiente'
    })
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
    transform: (d, detalleId) => ({
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
      observaciones: d.observations || null
    })
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

async function resolvePaymentMethodId(prisma, paymentMethod) {
  if (!paymentMethod) return null;
  const id = parseInt(paymentMethod);
  if (!isNaN(id)) return id;
  const method = await prisma.metodosPago.findFirst({ where: { nombre: paymentMethod } });
  return method?.id || null;
}

async function createProductItems(tx, ventaId, data) {
  for (const [field, handler] of Object.entries(PRODUCT_HANDLERS)) {
    const items = Array.isArray(data[field]) ? data[field] : [];
    for (const item of items) {
      if (!item || Object.keys(item).length === 0) continue;
      const detalle = await tx.detalleVenta.create({
        data: {
          ventaId,
          categoria: handler.category,
          nombreServicio: handler.nombreServicio,
          subtotal: (item.supplierCost || 0) + (item.ta || 0),
          costoProveedor: item.supplierCost || 0,
          ta: item.ta || 0,
          proveedorId: item.supplier ? parseInt(item.supplier) : null,
          metodoPagoProveedorId: item.supplierPaymentMethod ? parseInt(item.supplierPaymentMethod) : null,
          origen: item.legs?.[0]?.origin || item.pickupLocation || null,
          destino: item.destination || item.destinationCountry || item.legs?.[0]?.destination || null,
          fechaInicioViaje: item.startDate ? new Date(item.startDate) : item.departureDate ? new Date(item.departureDate) : item.pickupDate ? new Date(item.pickupDate) : null,
          fechaFinViaje: item.endDate ? new Date(item.endDate) : item.arrivalDate ? new Date(item.arrivalDate) : item.returnDate ? new Date(item.returnDate) : null,
          observaciones: item.observations || null
        }
      });

      const productData = handler.transform(item, detalle.id);
      await tx[handler.table].create({ data: productData });

      if (item.passengerInfo || item.guests) {
        const passengers = item.passengerInfo ? [item.passengerInfo] : (item.guests || []);
        for (const p of passengers) {
          await tx.pasajerosDetalle.create({
            data: {
              detalleVentaId: detalle.id,
              esTitular: true,
              asiento: item.seatNumber || null
            }
          });
        }
      }
    }
  }
}

exports.create = async (req, res, next) => {
  try {
    const data = req.body;

    const metodoPagoId = await resolvePaymentMethodId(prisma, data.paymentMethod);

    const result = await prisma.$transaction(async (tx) => {
      const venta = await tx.ventas.create({
        data: {
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
        }
      });

      if (data.payments && data.payments.length > 0) {
        for (const p of data.payments) {
          await tx.pagosVenta.create({
            data: {
              ventaId: venta.id,
              monto: p.amount,
              metodoPagoId: parseInt(p.method) || null,
              referencia: p.reference || null
            }
          });
        }
      }

      await createProductItems(tx, venta.id, data);

      return venta;
    });

    success(res, { id: result.id, ...data }, null, 201);
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
    if (data.status) updateData.status = data.status;
    if (data.observations !== undefined) updateData.observaciones = data.observations;
    if (data.isCredit !== undefined) updateData.esCredito = data.isCredit;
    if (data.creditDueDate) updateData.fechaVenceCredito = new Date(data.creditDueDate);
    if (data.paymentMethod) updateData.metodoPagoPrincipalId = await resolvePaymentMethodId(prisma, data.paymentMethod);

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
    });

    success(res, { message: 'Venta actualizada' });
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
    const { amount, isTotal, method, reference } = req.body;

    const venta = await prisma.ventas.findUnique({ where: { id } });
    if (!venta) return error(res, 'Venta no encontrada', 404);

    const currentPaid = venta.montoPagadoCredito || 0;
    const newPaidAmount = isTotal ? venta.montoTotal : currentPaid + amount;
    const newStatus = (isTotal || newPaidAmount >= venta.montoTotal) ? 'pagado' : 'abonado';
    const metodoPagoId = await resolvePaymentMethodId(prisma, method);

    let newPayment;

    await prisma.$transaction(async (tx) => {
      newPayment = await tx.pagosVenta.create({
        data: {
          ventaId: id,
          monto: amount,
          metodoPagoId,
          referencia: reference || null
        }
      });

      await tx.ventas.update({
        where: { id },
        data: {
          montoPagadoCredito: newPaidAmount,
          status: newStatus
        }
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

    const payment = await prisma.pagosVenta.findUnique({ where: { id: paymentId } });
    if (!payment) return error(res, 'Pago no encontrado', 404);
    if (payment.ventaId !== saleId) return error(res, 'El pago no pertenece a esta venta', 400);

    await prisma.$transaction(async (tx) => {
      await tx.pagosVenta.delete({ where: { id: paymentId } });

      const remainingPayments = await tx.pagosVenta.findMany({ where: { ventaId: saleId } });
      const totalPaid = remainingPayments.reduce((sum, p) => sum + p.monto, 0);
      const venta = await tx.ventas.findUnique({ where: { id: saleId } });
      const newStatus = totalPaid >= venta.montoTotal ? 'pagado' : totalPaid > 0 ? 'abonado' : 'credito';

      await tx.ventas.update({
        where: { id: saleId },
        data: { montoPagadoCredito: totalPaid, status: newStatus }
      });
    });

    success(res, { message: 'Pago eliminado' });
  } catch (err) {
    next(err);
  }
};
