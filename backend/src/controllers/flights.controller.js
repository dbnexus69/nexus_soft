const prisma = require('../config/db');
const { success, error } = require('../utils/apiResponse');
const { buildMeta } = require('../utils/paginationHelper');

exports.list = async (req, res, next) => {
  try {
    const { page, perPage, skip } = req.pagination;
    const { dateFrom, dateTo } = req.query;

    const where = {};
    if (dateFrom || dateTo) {
      where.salida = {};
      if (dateFrom) where.salida.gte = new Date(dateFrom);
      if (dateTo) where.salida.lte = new Date(dateTo);
    }

    if (req.permissionScope === 'own') {
      where.prodTiqueteria = {
        detalleVenta: {
          venta: {
            usuarioId: req.user.id
          }
        }
      };
    }

    const [total, tramos] = await Promise.all([
      prisma.tramosVuelo.count({ where }),
      prisma.tramosVuelo.findMany({
        where,
        skip,
        take: perPage,
        include: {
          prodTiqueteria: {
            include: {
              detalleVenta: { 
                include: { 
                  venta: { include: { cliente: { include: { persona: true } } } },
                  pasajerosDetalle: { include: { persona: true } } 
                } 
              },
              aerolinea: true
            }
          },
          aeropuertoOrigen: true,
          aeropuertoDestino: true
        },
        orderBy: { salida: 'asc' }
      })
    ]);

    const formatLocalDate = (dt) => {
      if (!dt) return null;
      const formatter = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' });
      return formatter.format(dt);
    };

    const formatLocalTime = (dt) => {
      if (!dt) return null;
      const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour12: false, hour: '2-digit', minute: '2-digit' });
      return formatter.format(dt);
    };

    const filteredTramos = tramos.filter(t => {
      const venta = t.prodTiqueteria?.detalleVenta?.venta;
      return venta && !venta.deletedAt && venta.status !== 'anulado';
    });

    // Group by product to determine ida/regreso correctly for round_trip with stops
    const productTramos = {};
    for (const t of filteredTramos) {
      const pid = t.prodTiqueteriaId;
      if (!productTramos[pid]) productTramos[pid] = [];
      productTramos[pid].push(t);
    }
    const tramoType = {};
    for (const ptramos of Object.values(productTramos)) {
      const modo = ptramos[0]?.prodTiqueteria?.modoVuelo;
      ptramos.sort((a, b) => a.orden - b.orden);
      if (modo === 'round_trip') {
        const dates = [...new Set(ptramos.map(t => formatLocalDate(t.salida)))];
        if (dates.length >= 2) {
          const firstDate = dates[0];
          for (const t of ptramos) {
            tramoType[t.id] = formatLocalDate(t.salida) === firstDate ? 'ida' : 'regreso';
          }
        } else {
          for (const t of ptramos) {
            tramoType[t.id] = t.orden === 1 ? 'ida' : 'regreso';
          }
        }
      } else {
        for (const t of ptramos) {
          tramoType[t.id] = t.orden === 1 ? 'ida' : 'regreso';
        }
      }
    }

    const data = [];
    for (const t of filteredTramos) {
      const detalleVenta = t.prodTiqueteria?.detalleVenta;
      const venta = detalleVenta?.venta;
      
      const route = `${t.aeropuertoOrigen?.codigoIata || '?'} - ${t.aeropuertoDestino?.codigoIata || '?'}`;
      const airline = t.prodTiqueteria?.aerolinea?.nombre || '';
      const date = formatLocalDate(t.salida);
      const time = formatLocalTime(t.salida);
      const type = tramoType[t.id] || 'ida';
      const checkin = t.checkinStatus || t.prodTiqueteria?.checkinStatus || 'pendiente';
      const flightNumber = t.nroVueloTramo;
      const reservationNumber = t.prodTiqueteria?.nroReserva || '';
      const ticketNumber = t.nroTiquete || t.prodTiqueteria?.nroTiquete || null;
      
      let passengersToMap = [];
      if (detalleVenta?.pasajerosDetalle && detalleVenta.pasajerosDetalle.length > 0) {
        passengersToMap = detalleVenta.pasajerosDetalle.map(p => ({
           idSuffix: `p-${p.id}`,
           name: p.persona ? `${p.persona.nombres || ''} ${p.persona.apellidos || ''}`.trim() : 'Desconocido',
           pasajeroId: p.id,
           email: p.persona?.email || null
        }));
      } else {
        passengersToMap = [{
           idSuffix: 'main',
           name: venta?.cliente?.persona
             ? `${venta.cliente.persona.nombres} ${venta.cliente.persona.apellidos}`
             : 'Desconocido',
           pasajeroId: null,
           email: venta?.cliente?.persona?.email || null
        }];
      }

      for (const p of passengersToMap) {
        data.push({
          id: `${t.id}__${p.idSuffix}`,
          originalTramoId: t.id,
          pasajeroId: p.pasajeroId,
          passenger: p.name,
          email: p.email,
          route,
          airline,
          date,
          time,
          type,
          checkin,
          flightNumber,
          seat: null,
          reservationNumber,
          ticketNumber,
          source: 'ticket'
        });
      }
    }

    // === Also include flights from packages/plans (prodPlanes) ===
    const planWhere = {
      OR: [
        { fechaSalidaVuelo: { not: null } },
        { fechaRegresoVuelo: { not: null } }
      ],
      detalleVenta: {
        venta: {
          deletedAt: null,
          status: { not: 'anulado' },
          ...(req.permissionScope === 'own' ? { usuarioId: req.user.id } : {})
        }
      }
    };

    const planes = await prisma.prodPlanes.findMany({
      where: planWhere,
      include: {
        aerolinea: true,
        detalleVenta: {
          include: {
            pasajerosDetalle: { include: { persona: true } },
            venta: {
              include: {
                cliente: {
                  include: { persona: true }
                }
              }
            }
          }
        }
      }
    });

    for (const p of planes) {
      const venta = p.detalleVenta?.venta;
      if (!venta) continue;

      const passengerName = venta.cliente?.persona
        ? `${venta.cliente.persona.nombres} ${venta.cliente.persona.apellidos}`
        : 'Desconocido';
      const airlineName = p.aerolinea?.nombre || '';
      const planLabel = p.nombrePlan || 'Paquete';
      let passengersToMap = [];
      if (p.detalleVenta?.pasajerosDetalle && p.detalleVenta.pasajerosDetalle.length > 0) {
        passengersToMap = p.detalleVenta.pasajerosDetalle.map(pas => ({
           idSuffix: `p-${pas.id}`,
           name: pas.persona ? `${pas.persona.nombres || ''} ${pas.persona.apellidos || ''}`.trim() : 'Desconocido',
           pasajeroId: pas.id,
           email: pas.persona?.email || null
        }));
      } else {
        passengersToMap = [{
           idSuffix: 'main',
           name: passengerName,
           pasajeroId: null,
           email: venta.cliente?.persona?.email || null
        }];
      }

      // Ida flight (departure)
      if (p.fechaSalidaVuelo) {
        const depDate = p.fechaSalidaVuelo;
        // Apply date filter if provided
        if (dateFrom && depDate < new Date(dateFrom)) { /* skip */ }
        else if (dateTo && depDate > new Date(dateTo)) { /* skip */ }
        else {
          for (const pas of passengersToMap) {
            data.push({
              id: `plan-ida-${p.id}__${pas.idSuffix}`,
              originalTramoId: `plan-ida-${p.id}`,
              pasajeroId: pas.pasajeroId,
              passenger: pas.name,
              email: pas.email,
              route: `${planLabel}`,
              airline: airlineName,
              date: formatLocalDate(depDate),
              time: formatLocalTime(depDate),
              type: 'ida',
              checkin: p.checkinStatusIda || 'pendiente',
              flightNumber: p.nroVuelo || '',
              seat: null,
              reservationNumber: p.nroReserva || '',
              source: 'plan'
            });
          }
        }
      }

      // Regreso flight (return)
      if (p.fechaRegresoVuelo) {
        const retDate = p.fechaRegresoVuelo;
        if (dateFrom && retDate < new Date(dateFrom)) { /* skip */ }
        else if (dateTo && retDate > new Date(dateTo)) { /* skip */ }
        else {
          for (const pas of passengersToMap) {
            data.push({
              id: `plan-ret-${p.id}__${pas.idSuffix}`,
              originalTramoId: `plan-ret-${p.id}`,
              pasajeroId: pas.pasajeroId,
              passenger: pas.name,
              email: pas.email,
              route: `${planLabel}`,
              airline: airlineName,
              date: formatLocalDate(retDate),
              time: formatLocalTime(retDate),
              type: 'regreso',
              checkin: p.checkinStatusRegreso || 'pendiente',
              flightNumber: p.nroVuelo || '',
              seat: null,
              reservationNumber: p.nroReserva || '',
              source: 'plan'
            });
          }
        }
      }
    }

    // Sort all flights by date and time
    data.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

    success(res, data, buildMeta(data.length, page, perPage));
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const id = req.params.id;
    const tramo = await prisma.tramosVuelo.findUnique({
      where: { id },
      include: {
        prodTiqueteria: { include: { aerolinea: true, detalleVenta: { include: { venta: true } } } },
        aeropuertoOrigen: true,
        aeropuertoDestino: true
      }
    });
    if (!tramo) return error(res, 'Vuelo no encontrado', 404);

    if (req.permissionScope === 'own' && tramo.prodTiqueteria?.detalleVenta?.venta?.usuarioId !== req.user.id) {
      return error(res, 'No tiene permiso para ver este vuelo', 403);
    }

    success(res, tramo);
  } catch (err) {
    next(err);
  }
};

exports.updateCheckin = async (req, res, next) => {
  try {
    const id = req.params.id;
    const data = req.body;
    const files = req.files || (req.file ? [req.file] : []);

    const parts = id.split('__');
    const baseId = parts[0];
    const isPasajero = parts.length > 1 && parts[1].startsWith('p-');
    const pasajeroId = isPasajero ? parts[1].substring(2) : null;

    // Handle Packages (Planes)
    if (baseId.startsWith('plan-ida-') || baseId.startsWith('plan-ret-')) {
      const isIda = baseId.startsWith('plan-ida-');
      const planId = baseId.replace('plan-ida-', '').replace('plan-ret-', '');

      const plan = await prisma.prodPlanes.findUnique({
        where: { id: planId },
        include: {
          detalleVenta: {
            include: {
              pasajerosDetalle: { include: { persona: true } },
              venta: {
                include: {
                  cliente: { include: { persona: true } }
                }
              }
            }
          }
        }
      });

      if (!plan) return error(res, 'Paquete no encontrado', 404);

      if (req.permissionScope === 'own' && plan.detalleVenta?.venta?.usuarioId !== req.user.id) {
        return error(res, 'No tiene permiso para modificar este check-in', 403);
      }

      const updateData = isIda 
        ? { checkinStatusIda: data.checkin || 'pendiente' }
        : { checkinStatusRegreso: data.checkin || 'pendiente' };

      await prisma.prodPlanes.update({
        where: { id: planId },
        data: updateData
      });

      // Send email if files attached
      if (files && files.length > 0) {
        const emailService = require('../utils/emailService');
        
        let targetEmail = plan.detalleVenta?.venta?.cliente?.persona?.email;
        let pasajeroNombres = plan.detalleVenta?.venta?.cliente?.persona?.nombres || 'Cliente';
        
        if (pasajeroId && plan.detalleVenta?.pasajerosDetalle) {
          const pas = plan.detalleVenta.pasajerosDetalle.find(p => p.id === pasajeroId);
          if (pas && pas.persona) {
            targetEmail = pas.persona.email || targetEmail;
            pasajeroNombres = `${pas.persona.nombres || ''} ${pas.persona.apellidos || ''}`.trim() || pasajeroNombres;
          }
        }

        if (targetEmail) {
          const ruta = plan.nombrePlan || 'Paquete';
          await emailService.sendEmail({
            to: targetEmail,
            subject: `Su pase de abordar está listo - ${ruta}`,
            html: `
              <div style="font-family: sans-serif; padding: 20px;">
                <h2>¡Hola ${pasajeroNombres}!</h2>
                <p>Su check-in para el ${isIda ? 'vuelo de ida' : 'vuelo de regreso'} del paquete <strong>${ruta}</strong> ha sido realizado exitosamente.</p>
                <p>Adjuntamos a este correo su pase de abordar.</p>
                <p>¡Buen viaje!</p>
                <br>
                <p>Atentamente,<br>El equipo de iTea Travel</p>
              </div>
            `,
            attachments: files.map(f => ({
              filename: f.originalname,
              content: f.buffer
            }))
          });
        }
      }

      return success(res, { checkinStatus: updateData.checkinStatusIda || updateData.checkinStatusRegreso });
    }

    // Handle Normal Flights (TramosVuelo)
    const tramo = await prisma.tramosVuelo.findUnique({
      where: { id: baseId },
      include: { 
        prodTiqueteria: {
          include: {
            detalleVenta: {
              include: {
                pasajerosDetalle: { include: { persona: true } },
                venta: {
                  include: { cliente: { include: { persona: true } } }
                }
              }
            }
          }
        },
        aeropuertoOrigen: true,
        aeropuertoDestino: true
      }
    });
    if (!tramo) return error(res, 'Vuelo no encontrado', 404);

    if (req.permissionScope === 'own' && tramo.prodTiqueteria?.detalleVenta?.venta?.usuarioId !== req.user.id) {
      return error(res, 'No tiene permiso para modificar este check-in', 403);
    }

    const updated = await prisma.tramosVuelo.update({
      where: { id: tramo.id },
      data: { checkinStatus: data.checkin || 'pendiente' }
    });

    if (files && files.length > 0) {
      const emailService = require('../utils/emailService');
      let targetEmail = tramo.prodTiqueteria?.detalleVenta?.venta?.cliente?.persona?.email;
      let pasajeroNombres = tramo.prodTiqueteria?.detalleVenta?.venta?.cliente?.persona?.nombres || 'Cliente';
      
      if (pasajeroId && tramo.prodTiqueteria?.detalleVenta?.pasajerosDetalle) {
        const pas = tramo.prodTiqueteria.detalleVenta.pasajerosDetalle.find(p => p.id === pasajeroId);
        if (pas && pas.persona) {
          targetEmail = pas.persona.email || targetEmail;
          pasajeroNombres = `${pas.persona.nombres || ''} ${pas.persona.apellidos || ''}`.trim() || pasajeroNombres;
        }
      }
      
      if (targetEmail) {
        const ruta = `${tramo.aeropuertoOrigen?.codigoIata || '?'} - ${tramo.aeropuertoDestino?.codigoIata || '?'}`;
        
        await emailService.sendEmail({
          to: targetEmail,
          subject: `Su pase de abordar está listo - Vuelo ${ruta}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px;">
              <h2>¡Hola ${pasajeroNombres}!</h2>
              <p>Su check-in para el vuelo <strong>${ruta}</strong> ha sido realizado exitosamente.</p>
              <p>Adjuntamos a este correo su pase de abordar.</p>
              <p>¡Buen viaje!</p>
              <br>
              <p>Atentamente,<br>El equipo de iTea Travel</p>
            </div>
          `,
          attachments: files.map(f => ({
            filename: f.originalname,
            content: f.buffer
          }))
        });
      }
    }

    success(res, { checkinStatus: updated.checkinStatus });
  } catch (err) {
    next(err);
  }
};
