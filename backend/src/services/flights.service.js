const prisma = require('../config/db');
const { buildMeta } = require('../utils/paginationHelper');

class FlightsService {
  async listFlights({ pagination, dateFrom, dateTo, permissionScope, user }) {
    const { page, perPage, skip } = pagination;

    const where = {};
    if (dateFrom || dateTo) {
      where.salida = {};
      if (dateFrom) where.salida.gte = new Date(dateFrom);
      if (dateTo) where.salida.lte = new Date(dateTo);
    }

    if (permissionScope === 'own' && user) {
      where.prod_tiqueteria = {
        detalle_venta: {
          ventas: { usuario_id: user.id }
        }
      };
    }

    const [total, tramos] = await Promise.all([
      prisma.tramos_vuelo.count({ where }),
      prisma.tramos_vuelo.findMany({
        where, skip, take: perPage,
        include: {
          prod_tiqueteria: {
            include: {
              detalle_venta: {
                include: {
                  ventas: { include: { clientes: { include: { personas: true } } } },
                  pasajeros_detalle: { include: { personas: true } }
                }
              },
              aerolineas: true
            }
          },
          aeropuertos_tramos_vuelo_aeropuerto_origen_idToaeropuertos: true,
          aeropuertos_tramos_vuelo_aeropuerto_destino_idToaeropuertos: true
        },
        orderBy: { salida: 'asc' }
      })
    ]);

    const formatLocalDate = (dt) => {
      if (!dt) return null;
      return new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt);
    };

    const formatLocalTime = (dt) => {
      if (!dt) return null;
      return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour12: false, hour: '2-digit', minute: '2-digit' }).format(dt);
    };

    const filteredTramos = tramos.filter(t => {
      const venta = t.prod_tiqueteria?.detalle_venta?.ventas;
      return venta && !venta.deleted_at && venta.status !== 'anulado';
    });

    const productTramos = {};
    for (const t of filteredTramos) {
      const pid = t.prod_tiqueteria_id;
      if (!productTramos[pid]) productTramos[pid] = [];
      productTramos[pid].push(t);
    }

    const tramoType = {};
    for (const ptramos of Object.values(productTramos)) {
      const modo = ptramos[0]?.prod_tiqueteria?.modo_vuelo;
      ptramos.sort((a, b) => a.orden - b.orden);
      if (modo === 'round_trip') {
        const half = Math.ceil(ptramos.length / 2);
        ptramos.forEach((t, idx) => { tramoType[t.id] = idx < half ? 'ida' : 'regreso'; });
      } else {
        ptramos.forEach(t => { tramoType[t.id] = 'ida'; });
      }
    }

    const data = filteredTramos.map(t => {
      const dv = t.prod_tiqueteria?.detalle_venta;
      const venta = dv?.ventas;
      const clientePersona = venta?.clientes?.personas;
      const paxList = (dv?.pasajeros_detalle || [])
        .map(pd => pd.personas ? `${pd.personas.nombres} ${pd.personas.apellidos}` : null)
        .filter(Boolean);

      const aeropuertoOrigen = t.aeropuertos_tramos_vuelo_aeropuerto_origen_idToaeropuertos;
      const aeropuertoDestino = t.aeropuertos_tramos_vuelo_aeropuerto_destino_idToaeropuertos;

      const routeStr = (t.aeropuertoOrigen?.codigoIata || dv?.origen) && (t.aeropuertoDestino?.codigoIata || dv?.destino) 
        ? `${t.aeropuertoOrigen?.codigoIata || dv?.origen} - ${t.aeropuertoDestino?.codigoIata || dv?.destino}`
        : (t.aeropuertoOrigen?.codigoIata || dv?.origen || t.aeropuertoDestino?.codigoIata || dv?.destino || '');
      const paxStr = paxList.length > 0 ? paxList.join(', ') : (clientePersona ? `${clientePersona.nombres} ${clientePersona.apellidos}` : '');

      return {
        id: t.id,
        saleId: venta?.id || null,
        pnr: t.prod_tiqueteria?.nro_reserva || '',
        reservationNumber: t.prod_tiqueteria?.nro_reserva || '',
        airline: t.prod_tiqueteria?.aerolineas?.nombre || '',
        airlineCode: t.prod_tiqueteria?.aerolineas?.codigo_iata || '',
        flightNumber: t.nro_vuelo_tramo || t.prod_tiqueteria?.nro_vuelo || '',
        origin: aeropuertoOrigen?.codigo_iata || dv?.origen || '',
        originCity: aeropuertoOrigen?.ciudad || dv?.origen || '',
        destination: aeropuertoDestino?.codigo_iata || dv?.destino || '',
        destinationCity: aeropuertoDestino?.ciudad || dv?.destino || '',
        route: routeStr,
        flightDate: formatLocalDate(t.salida),
        date: formatLocalDate(t.salida) || '',
        flightTime: formatLocalTime(t.salida),
        time: formatLocalTime(t.salida) || '',
        arrivalDate: formatLocalDate(t.llegada),
        arrivalTime: formatLocalTime(t.llegada),
        checkinStatus: t.prod_tiqueteria?.checkin_status || 'pendiente',
        checkin: t.prod_tiqueteria?.checkin_status || 'pendiente',
        passengerName: paxStr,
        passenger: paxStr,
        ticketNumber: t.nro_tiquete || t.prod_tiqueteria?.nro_tiquete || '',
        seat: t.asiento || null,
        orden: t.orden,
        type: tramoType[t.id] || 'ida'
      };
    });

    return { data, meta: buildMeta(total, page, perPage) };
  }

  async listAirlines() {
    return prisma.aerolineas.findMany({ orderBy: { nombre: 'asc' } });
  }

  async listAirports() {
    return prisma.aeropuertos.findMany({ orderBy: { ciudad: 'asc' } });
  }
}

module.exports = new FlightsService();
