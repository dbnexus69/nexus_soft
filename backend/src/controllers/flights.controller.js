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

    const data = tramos.map(t => ({
      id: t.id,
      passenger: t.prodTiqueteria?.detalleVenta?.venta?.cliente?.persona
        ? `${t.prodTiqueteria.detalleVenta.venta.cliente.persona.nombres} ${t.prodTiqueteria.detalleVenta.venta.cliente.persona.apellidos}`
        : 'Desconocido',
      route: `${t.aeropuertoOrigen?.codigoIata || '?'} - ${t.aeropuertoDestino?.codigoIata || '?'}`,
      airline: t.prodTiqueteria?.aerolinea?.nombre || '',
      date: t.salida.toISOString().split('T')[0],
      time: t.salida.toISOString().split('T')[1].substring(0, 5),
      type: t.orden === 1 ? 'ida' : 'regreso',
      checkin: t.prodTiqueteria?.checkinStatus || 'pendiente',
      flightNumber: t.nroVueloTramo,
      seat: null
    }));

    success(res, data, buildMeta(total, page, perPage));
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

    const tramo = await prisma.tramosVuelo.findUnique({
      where: { id },
      include: { prodTiqueteria: true }
    });
    if (!tramo) return error(res, 'Vuelo no encontrado', 404);

    const updated = await prisma.prodTiqueteria.update({
      where: { id: tramo.prodTiqueteriaId },
      data: { checkinStatus: data.checkin || 'pendiente' }
    });

    success(res, { checkinStatus: updated.checkinStatus });
  } catch (err) {
    next(err);
  }
};
