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

class SalesService {
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
      asesorId: venta.usuarioId,
      asesorName: `${venta.usuario.personas.nombres} ${venta.usuario.personas.apellidos}`,
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
      planData: resultMap.planes || []
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
    let newPaidAmount, newStatus;
    let metodo_pago_id = null;
    if (method) {
      const m = await prisma.metodosPago.findFirst({ where: { nombre: method } });
      if (m) metodo_pago_id = m.id;
    }

    if (saleTotal !== undefined && currentPaidAmount !== undefined) {
      newPaidAmount = isTotal ? saleTotal : (currentPaidAmount || 0) + amount;
      newStatus = (isTotal || newPaidAmount >= saleTotal) ? 'pagado' : 'abonado';
    } else {
      const venta = await prisma.ventas.findUnique({ where: { id }, select: { montoTotal: true, montoPagadoCredito: true } });
      if (!venta) throw new NotFoundError('Venta no encontrada');
      const currentPaid = venta.montoPagadoCredito || 0;
      newPaidAmount = isTotal ? venta.montoTotal : currentPaid + amount;
      newStatus = (isTotal || newPaidAmount >= venta.montoTotal) ? 'pagado' : 'abonado';
    }

    let newPayment;
    await prisma.$transaction(async (tx) => {
      newPayment = await tx.pagosVenta.create({
        data: { venta_id: id, monto: amount, metodo_pago_id, referencia: reference || null }
      });
      await tx.ventas.update({
        where: { id },
        data: { montoPagadoCredito: newPaidAmount, status: newStatus }
      });
    });

    return {
      creditPaidAmount: newPaidAmount,
      status: newStatus,
      payment: {
        id: newPayment.id,
        date: newPayment.fechaPago,
        amount: newPayment.monto,
        method: method || null
      }
    };
  }

  async deletePayment(saleId, paymentId, { currentPayments, saleTotal } = {}) {
    const payment = await prisma.pagosVenta.findUnique({
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
        prisma.pagosVenta.delete({ where: { id: paymentId } }),
        prisma.ventas.update({ where: { id: saleId }, data: { montoPagadoCredito: newPaidAmount, status: newStatus } })
      ]);
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.pagosVenta.delete({ where: { id: paymentId } });
        const remainingPayments = await tx.pagosVenta.findMany({ where: { venta_id: saleId }, select: { monto: true } });
        newPaidAmount = remainingPayments.reduce((sum, p) => sum + p.monto, 0);
        const venta = await tx.ventas.findUnique({ where: { id: saleId }, select: { montoTotal: true } });
        newStatus = newPaidAmount >= venta.montoTotal ? 'pagado' : newPaidAmount > 0 ? 'abonado' : 'credito';
        await tx.ventas.update({ where: { id: saleId }, data: { montoPagadoCredito: newPaidAmount, status: newStatus } });
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
