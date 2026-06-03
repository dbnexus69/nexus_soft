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

    const [total, tramos] = await Promise.all([
      prisma.tramosVuelo.count({ where }),
      prisma.tramosVuelo.findMany({
        where,
        skip,
        take: perPage,
        include: {
          prodTiqueteria: {
            include: {
              detalleVenta: { include: { venta: { include: { cliente: { include: { persona: true } } } } } },
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
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const formatLocalTime = (dt) => {
      const h = String(dt.getHours()).padStart(2, '0');
      const m = String(dt.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
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

    const data = filteredTramos.map(t => ({
      id: t.id,
      passenger: t.prodTiqueteria?.detalleVenta?.venta?.cliente?.persona
        ? `${t.prodTiqueteria.detalleVenta.venta.cliente.persona.nombres} ${t.prodTiqueteria.detalleVenta.venta.cliente.persona.apellidos}`
        : 'Desconocido',
      route: `${t.aeropuertoOrigen?.codigoIata || '?'} - ${t.aeropuertoDestino?.codigoIata || '?'}`,
      airline: t.prodTiqueteria?.aerolinea?.nombre || '',
      date: formatLocalDate(t.salida),
      time: formatLocalTime(t.salida),
      type: tramoType[t.id] || 'ida',
      checkin: t.prodTiqueteria?.checkinStatus || 'pendiente',
      flightNumber: t.nroVueloTramo,
      seat: null
    }));

    success(res, data, buildMeta(filteredTramos.length, page, perPage));
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
    success(res, tramo);
  } catch (err) {
    next(err);
  }
};

exports.updateCheckin = async (req, res, next) => {
  try {
    const id = req.params.id;
    const data = req.body;
    const file = req.file;

    const tramo = await prisma.tramosVuelo.findUnique({
      where: { id },
      include: { 
        prodTiqueteria: {
          include: {
            detalleVenta: {
              include: {
                venta: {
                  include: {
                    cliente: {
                      include: {
                        persona: true
                      }
                    }
                  }
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

    const updated = await prisma.prodTiqueteria.update({
      where: { id: tramo.prodTiqueteriaId },
      data: { checkinStatus: data.checkin || 'pendiente' }
    });

    // Send email if a file was uploaded and we have the client's email
    if (file) {
      const emailService = require('../utils/emailService');
      const email = tramo.prodTiqueteria?.detalleVenta?.venta?.cliente?.persona?.email;
      
      if (email) {
        const pasajeroNombres = tramo.prodTiqueteria?.detalleVenta?.venta?.cliente?.persona?.nombres || 'Cliente';
        const ruta = `${tramo.aeropuertoOrigen?.codigoIata || '?'} - ${tramo.aeropuertoDestino?.codigoIata || '?'}`;
        
        await emailService.sendEmail({
          to: email,
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
          attachments: [
            {
              filename: file.originalname,
              content: file.buffer
            }
          ]
        });
      }
    }

    success(res, { checkinStatus: updated.checkinStatus });
  } catch (err) {
    next(err);
  }
};
