const prisma = require('../config/db');
const { buildMeta } = require('../utils/paginationHelper');

class FlightsService {
  async listFlights({ pagination, dateFrom, dateTo, checkinStatus, search, permissionScope, user }) {
    const { page, perPage, skip } = pagination;

    // Las ventas anuladas o borradas se excluyen aquí, en el where, no después
    // de traer las filas: si no, el count las contaba y la paginación mentía.
    const ventaVigente = { deleted_at: null, status: { not: 'anulado' } };
    const detalleVenta = { ventas: { ...ventaVigente } };
    const tiqueteria = {};

    const where = {};
    if (dateFrom || dateTo) {
      where.salida = {};
      if (dateFrom) where.salida.gte = new Date(dateFrom);
      if (dateTo) where.salida.lte = new Date(dateTo);
    }

    if (permissionScope === 'own' && user) {
      detalleVenta.ventas.usuario_id = user.id;
    }

    // Estado de check-in: pendiente / realizado / critico
    if (checkinStatus) {
      tiqueteria.checkin_status = checkinStatus;
    }

    // Búsqueda por pasajero, titular, localizador o número de vuelo.
    if (search) {
      const como = { contains: search, mode: 'insensitive' };
      where.OR = [
        { nro_vuelo_tramo: como },
        { nro_tiquete: como },
        { prod_tiqueteria: { nro_reserva: como } },
        { prod_tiqueteria: { nro_vuelo: como } },
        { prod_tiqueteria: { detalle_venta: { pasajeros_detalle: { some: { personas: { OR: [{ nombres: como }, { apellidos: como }] } } } } } },
        { prod_tiqueteria: { detalle_venta: { ventas: { clientes: { personas: { OR: [{ nombres: como }, { apellidos: como }] } } } } } },
      ];
    }

    where.prod_tiqueteria = { ...tiqueteria, detalle_venta: detalleVenta };

    const [total, tramos] = await Promise.all([
      prisma.tramos_vuelo.count({ where }),
      prisma.tramos_vuelo.findMany({
        where, skip, take: perPage,
        include: {
          prod_tiqueteria: {
            include: {
              detalle_venta: {
                include: {
                  ventas: { include: { clientes: { include: { personas: { include: { tipos_documento: true } } } } } },
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

    // Ya vienen filtrados por el where; se conserva el nombre para el resto del método.
    const filteredTramos = tramos;

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

      const codOrigen = aeropuertoOrigen?.codigo_iata || dv?.origen;
      const codDestino = aeropuertoDestino?.codigo_iata || dv?.destino;
      const routeStr = codOrigen && codDestino
        ? `${codOrigen} - ${codDestino}`
        : (codOrigen || codDestino || '');
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
        clientId: venta?.cliente_id || null,
        clientName: clientePersona ? `${clientePersona.nombres} ${clientePersona.apellidos}` : null,
        clientAvatar: clientePersona?.avatar_url || null,
        clientEmail: clientePersona?.email || null,
        clientDocType: clientePersona?.tipos_documento?.abreviatura || null,
        clientDocNumber: clientePersona?.documento || null,
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
