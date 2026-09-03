const fs = require('fs/promises');
const path = require('path');
const prisma = require('../config/db');
const { buildMeta } = require('../utils/paginationHelper');
const { NotFoundError, BadRequestError, ForbiddenError } = require('../errors/AppError');
const emailService = require('../utils/emailService');

// Los formateadores se crean una vez, no en cada petición: construir un
// Intl.DateTimeFormat es caro y antes se hacían dos por llamada.
const FMT_FECHA = new Intl.DateTimeFormat('fr-CA', {
  timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
});
const FMT_HORA = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Bogota', hour12: false, hour: '2-digit', minute: '2-digit',
});

const formatLocalDate = (dt) => (dt ? FMT_FECHA.format(dt) : null);
const formatLocalTime = (dt) => (dt ? FMT_HORA.format(dt) : null);

/** Una venta anulada o borrada no aparece en itinerarios ni acepta check-in. */
const VENTA_VIGENTE = { deleted_at: null, status: { not: 'anulado' } };

/** Ventana de "crítico": el check-in urgente son las próximas 48 horas. */
const HORAS_CRITICAS = 48;
const MS_CRITICOS = HORAS_CRITICAS * 60 * 60 * 1000;

// `checkin_status` es nullable, y la salida hace `|| 'pendiente'`. Si el filtro
// fuese solo la igualdad, una fila con NULL se mostraría como pendiente pero no
// la encontraría ningún filtro ni la contaría ningún contador.
const PRED_PENDIENTE = { OR: [{ checkin_status: 'pendiente' }, { checkin_status: null }] };
const PRED_REALIZADO = { checkin_status: 'realizado' };
// `cancelado` es terminal y disjunto: no es pendiente, así que no entra en la
// lista de pendientes ni puede ser crítico. Sale gratis, porque PRED_PENDIENTE
// solo casa 'pendiente' y NULL.
const PRED_CANCELADO = { checkin_status: 'cancelado' };

/**
 * `critico` es el único estado que NO está almacenado: depende de la hora
 * actual, así que guardarlo exigiría un cron y quedaría desincronizado entre
 * pasadas. Se deriva, y es un SUBCONJUNTO de pendiente — no un estado aparte:
 * si excluyera a los críticos de la lista de pendientes, los vuelos más
 * urgentes desaparecerían justo de la pantalla que sirve para no olvidarlos.
 */
function predCritico(ahora) {
  return {
    AND: [
      PRED_PENDIENTE,
      { salida: { gte: ahora, lte: new Date(ahora.getTime() + MS_CRITICOS) } },
    ],
  };
}

const ESTADOS_FILTRABLES = ['pendiente', 'realizado', 'critico', 'cancelado'];

function predicadoEstado(status, ahora) {
  if (!status) return null;
  if (status === 'pendiente') return PRED_PENDIENTE;
  if (status === 'realizado') return PRED_REALIZADO;
  if (status === 'critico') return predCritico(ahora);
  if (status === 'cancelado') return PRED_CANCELADO;
  throw new BadRequestError(
    `Estado de check-in inválido: ${status}. Válidos: ${ESTADOS_FILTRABLES.join(', ')}`
  );
}

/**
 * Filtro base: vigencia de la venta, ámbito de permisos, rango de fechas y
 * búsqueda. Deliberadamente SIN la condición de estado, porque los contadores
 * por estado se calculan sobre este mismo filtro.
 */
function construirWhereBase({ dateFrom, dateTo, search, permissionScope, user }) {
  const ventas = { ...VENTA_VIGENTE };

  // Con ámbito 'own' un asesor solo ve los vuelos de sus propias ventas.
  if (permissionScope === 'own' && user) ventas.usuario_id = user.id;

  const where = { prod_tiqueteria: { detalle_venta: { ventas } } };

  if (dateFrom || dateTo) {
    where.salida = {};
    if (dateFrom) where.salida.gte = new Date(dateFrom);
    if (dateTo) where.salida.lte = new Date(dateTo);
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

  return where;
}

/**
 * El filtro final se compone con AND, nunca con spread. Con spread hay dos
 * colisiones de clave que perderían filtros en silencio: `search` ya ocupa
 * `OR` y el predicado de pendiente necesita el suyo; `dateFrom/dateTo` ya
 * ocupan `salida` y el de crítico también. En ambos casos ganaría el segundo.
 */
function combinar(whereBase, predicado) {
  return predicado ? { AND: [whereBase, predicado] } : whereBase;
}

/**
 * Clasifica cada tramo como ida o regreso. Agrupa por producto y, en un
 * round_trip, la primera mitad es ida.
 *
 * Limitación conocida: se resuelve solo con los tramos de la página actual, así
 * que un round_trip partido entre dos páginas se etiqueta mal. Es un defecto
 * previo que se conserva tal cual; arreglarlo pide resolver el tipo con todos
 * los tramos del producto, no solo los visibles.
 */
function resolverTipos(tramos) {
  const porProducto = {};
  for (const t of tramos) {
    const pid = t.prod_tiqueteria_id;
    if (!porProducto[pid]) porProducto[pid] = [];
    porProducto[pid].push(t);
  }

  const tipos = {};
  for (const grupo of Object.values(porProducto)) {
    const modo = grupo[0]?.prod_tiqueteria?.modo_vuelo;
    grupo.sort((a, b) => a.orden - b.orden);
    if (modo === 'round_trip') {
      const mitad = Math.ceil(grupo.length / 2);
      grupo.forEach((t, i) => { tipos[t.id] = i < mitad ? 'ida' : 'regreso'; });
    } else {
      grupo.forEach(t => { tipos[t.id] = 'ida'; });
    }
  }
  return tipos;
}

/** Fila de la respuesta. Varias claves están duplicadas por compatibilidad. */
function mapearTramo(t, tipo) {
  const dv = t.prod_tiqueteria?.detalle_venta;
  const venta = dv?.ventas;
  const persona = venta?.clientes?.personas;

  const pasajeros = (dv?.pasajeros_detalle || [])
    .map(pd => (pd.personas ? `${pd.personas.nombres} ${pd.personas.apellidos}` : null))
    .filter(Boolean);

  const origen = t.aeropuertos_tramos_vuelo_aeropuerto_origen_idToaeropuertos;
  const destino = t.aeropuertos_tramos_vuelo_aeropuerto_destino_idToaeropuertos;

  const codOrigen = origen?.codigo_iata || dv?.origen;
  const codDestino = destino?.codigo_iata || dv?.destino;
  const ruta = codOrigen && codDestino
    ? `${codOrigen} - ${codDestino}`
    : (codOrigen || codDestino || '');

  const nombrePax = pasajeros.length > 0
    ? pasajeros.join(', ')
    : (persona ? `${persona.nombres} ${persona.apellidos}` : '');

  // El estado se lee del TRAMO, no del producto: la fila es un tramo, el
  // frontend manda el id del tramo, y el check-in aéreo se hace por vuelo.
  const estado = t.checkin_status || 'pendiente';

  return {
    id: t.id,
    saleId: venta?.id || null,
    pnr: t.prod_tiqueteria?.nro_reserva || '',
    reservationNumber: t.prod_tiqueteria?.nro_reserva || '',
    airline: t.prod_tiqueteria?.aerolineas?.nombre || '',
    airlineCode: t.prod_tiqueteria?.aerolineas?.codigo_iata || '',
    flightNumber: t.nro_vuelo_tramo || t.prod_tiqueteria?.nro_vuelo || '',
    origin: origen?.codigo_iata || dv?.origen || '',
    originCity: origen?.ciudad || dv?.origen || '',
    destination: destino?.codigo_iata || dv?.destino || '',
    destinationCity: destino?.ciudad || dv?.destino || '',
    route: ruta,
    flightDate: formatLocalDate(t.salida),
    date: formatLocalDate(t.salida) || '',
    flightTime: formatLocalTime(t.salida),
    time: formatLocalTime(t.salida) || '',
    arrivalDate: formatLocalDate(t.llegada),
    arrivalTime: formatLocalTime(t.llegada),
    checkinStatus: estado,
    checkin: estado,
    checkinAt: t.checkin_at ? t.checkin_at.toISOString() : null,
    checkinDocs: t.checkin_docs || null,
    canceledAt: t.canceled_at ? t.canceled_at.toISOString() : null,
    reasonCanceled: t.reason_canceled || null,
    passengerName: nombrePax,
    passenger: nombrePax,
    clientId: venta?.cliente_id || null,
    clientName: persona ? `${persona.nombres} ${persona.apellidos}` : null,
    clientAvatar: persona?.avatar_url || null,
    clientEmail: persona?.email || null,
    clientDocType: persona?.tipos_documento?.abreviatura || null,
    clientDocNumber: persona?.documento || null,
    ticketNumber: t.nro_tiquete || t.prod_tiqueteria?.nro_tiquete || '',
    seat: t.asiento || null,
    orden: t.orden,
    type: tipo || 'ida',
  };
}

/**
 * La ÚNICA consulta de tramos, compartida por los dos listados.
 *
 * El `include` va inline a propósito: `scripts/check-prisma-fields.js` valida
 * las claves parseando el literal que sigue a la llamada, así que extraerlo a
 * una constante dejaría sin comprobar justo las relaciones de nombre largo,
 * que son el error snake_case/camelCase que más veces ha aparecido aquí.
 */
function buscarTramos(where, skip, take) {
  return prisma.tramos_vuelo.findMany({
    where,
    skip,
    take,
    include: {
      prod_tiqueteria: {
        include: {
          detalle_venta: {
            include: {
              ventas: { include: { clientes: { include: { personas: { include: { tipos_documento: true } } } } } },
              pasajeros_detalle: { include: { personas: true } },
            },
          },
          aerolineas: true,
        },
      },
      aeropuertos_tramos_vuelo_aeropuerto_origen_idToaeropuertos: true,
      aeropuertos_tramos_vuelo_aeropuerto_destino_idToaeropuertos: true,
    },
    // Ascendente y con desempate: el vuelo más próximo primero, que es lo
    // operativo. El desempate por id evita que dos tramos con la misma salida
    // bailen entre páginas. No cambiar a 'desc'.
    orderBy: [{ salida: 'asc' }, { id: 'asc' }],
  });
}

/**
 * Recalcula `prod_tiqueteria.checkin_status`, que es el agregado que lee el
 * detalle de venta (`catalog/products.js`).
 *
 * Los tramos cancelados NO bloquean: si el resto está hecho, el producto queda
 * realizado — un tramo que ya no se vuela no puede dejar el producto pendiente
 * para siempre. Y si TODOS están cancelados, el producto es cancelado.
 */
async function recalcularProducto(tx, prodTiqueteriaId) {
  const hermanos = await tx.tramos_vuelo.findMany({
    where: { prod_tiqueteria_id: prodTiqueteriaId },
    select: { checkin_status: true },
  });

  const vivos = hermanos.filter(h => h.checkin_status !== 'cancelado');

  let estado;
  if (hermanos.length === 0) estado = 'pendiente';
  else if (vivos.length === 0) estado = 'cancelado';
  else if (vivos.every(h => h.checkin_status === 'realizado')) estado = 'realizado';
  else estado = 'pendiente';

  await tx.prod_tiqueteria.update({
    where: { id: prodTiqueteriaId },
    data: { checkin_status: estado },
  });

  return estado;
}

class FlightsService {
  async listFlights({ pagination, dateFrom, dateTo, checkinStatus, search, permissionScope, user }) {
    const { page, perPage, skip } = pagination;
    const whereBase = construirWhereBase({ dateFrom, dateTo, search, permissionScope, user });
    const where = combinar(whereBase, predicadoEstado(checkinStatus, new Date()));

    // El count y las filas comparten el mismo `where`: si divergen, una
    // búsqueda sin resultados sigue informando de que hay N registros.
    const [total, tramos] = await Promise.all([
      prisma.tramos_vuelo.count({ where }),
      buscarTramos(where, skip, perPage),
    ]);

    const tipos = resolverTipos(tramos);
    const data = tramos.map(t => mapearTramo(t, tipos[t.id]));

    return { data, meta: buildMeta(total, page, perPage) };
  }

  /**
   * Listado de check-ins de vuelo. Sustituye a las tres llamadas que la
   * pantalla hacía contra `listFlights` con filtros distintos: los contadores
   * por estado viajan en `meta.counts`, calculados en SQL.
   */
  async listCheckins({ pagination, status, dateFrom, dateTo, search, permissionScope, user }) {
    const { page, perPage, skip } = pagination;
    const ahora = new Date();

    const whereBase = construirWhereBase({ dateFrom, dateTo, search, permissionScope, user });
    const where = combinar(whereBase, predicadoEstado(status, ahora));

    const [total, tramos, grupos, criticos] = await Promise.all([
      prisma.tramos_vuelo.count({ where }),
      buscarTramos(where, skip, perPage),
      // Los contadores se calculan sobre whereBase, SIN la condición de estado:
      // al filtrar por uno, los demás siguen mostrando su total.
      prisma.tramos_vuelo.groupBy({
        by: ['checkin_status'],
        where: whereBase,
        _count: { _all: true },
      }),
      // `critico` no puede salir del groupBy: no es un valor almacenado, así
      // que agrupar por la columna daría siempre 0.
      prisma.tramos_vuelo.count({ where: { AND: [whereBase, predCritico(ahora)] } }),
    ]);

    const counts = { pendiente: 0, realizado: 0, cancelado: 0, critico: criticos, total: 0 };
    for (const g of grupos) {
      const n = g._count._all;
      // El bucket NULL se pliega sobre pendiente, igual que hace la salida.
      // `critico` no suma aquí: es un subconjunto de pendiente, no un bucket.
      const clave = g.checkin_status === 'realizado' ? 'realizado'
        : g.checkin_status === 'cancelado' ? 'cancelado'
        : 'pendiente';
      counts[clave] += n;
      counts.total += n;
    }

    const tipos = resolverTipos(tramos);
    const data = tramos.map(t => mapearTramo(t, tipos[t.id]));

    return { data, meta: { ...buildMeta(total, page, perPage), counts } };
  }

  /**
   * Registra el check-in de UN tramo y envía al cliente los documentos
   * adjuntos, que es lo que la pantalla promete al confirmar.
   */
  async updateCheckin(tramoId, body = {}, files = [], { permissionScope, user } = {}) {
    // Con multipart todo llega como string, así que la comparación es directa.
    const pedido = body.checkin || body.checkinStatus || 'realizado';

    // `critico` es derivado: escribirlo crearía filas cuyo estado contradice su
    // fecha y que ningún filtro encontraría.
    if (pedido !== 'pendiente' && pedido !== 'realizado') {
      throw new BadRequestError(
        `Estado de check-in no escribible: ${pedido}. Válidos: pendiente, realizado`
      );
    }

    // El id es el de tramos_vuelo, un uuid en texto. No hacer parseInt.
    const tramo = await prisma.tramos_vuelo.findUnique({
      where: { id: String(tramoId) },
      include: {
        prod_tiqueteria: {
          include: {
            detalle_venta: {
              include: { ventas: { include: { clientes: { include: { personas: true } } } } },
            },
          },
        },
      },
    });

    if (!tramo) throw new NotFoundError('Tramo de vuelo no encontrado');

    const venta = tramo.prod_tiqueteria?.detalle_venta?.ventas;
    if (!venta || venta.deleted_at || venta.status === 'anulado') {
      throw new BadRequestError('La venta de este vuelo no está vigente');
    }
    if (permissionScope === 'own' && user && venta.usuario_id !== user.id) {
      throw new ForbiddenError('No puede registrar el check-in de una venta de otro asesor');
    }

    const realizado = pedido === 'realizado';
    const docs = (files || []).map(f => ({
      url: `/uploads/${f.filename}`,
      filename: f.originalname,
    }));

    // El correo va DESPUÉS del commit: es una llamada de red, y dentro de la
    // transacción la mantendría abierta durante segundos y un fallo haría
    // rollback de un check-in que el operador ya da por hecho.
    const { productStatus } = await prisma.$transaction(async (tx) => {
      await tx.tramos_vuelo.update({
        where: { id: tramo.id },
        data: {
          checkin_status: pedido,
          checkin_at: realizado ? new Date() : null,
          // Este endpoint deja el tramo en pendiente o realizado, así que ya no
          // está cancelado: dejar el motivo puesto sería un dato que contradice
          // al estado. Así se revierte una cancelación equivocada.
          canceled_at: null,
          reason_canceled: null,
          // Solo se sobrescriben si vienen adjuntos nuevos: repetir el envío
          // sin ficheros no debe borrar los que ya había.
          ...(docs.length ? { checkin_docs: docs } : {}),
        },
      });

      const productStatus = await recalcularProducto(tx, tramo.prod_tiqueteria_id);
      return { productStatus };
    });

    const actualizado = await prisma.tramos_vuelo.findUnique({
      where: { id: tramo.id },
      select: { checkin_status: true, checkin_at: true, checkin_docs: true },
    });

    const correo = realizado
      ? await this._enviarCheckin(tramo, venta, docs)
      : { emailSent: false, emailStatus: 'no_aplica', emailError: null, emailTo: null };

    return {
      id: tramo.id,
      // DataContext.updateFlight lee `checkinStatus`; `checkin` va duplicado
      // por simetría con las filas del listado.
      checkinStatus: actualizado.checkin_status || 'pendiente',
      checkin: actualizado.checkin_status || 'pendiente',
      checkinAt: actualizado.checkin_at ? actualizado.checkin_at.toISOString() : null,
      docs: actualizado.checkin_docs || [],
      productCheckinStatus: productStatus,
      ...correo,
    };
  }

  /**
   * Cancela el check-in de UN tramo.
   *
   * Endpoint aparte del que registra el check-in, y no un valor más de aquél,
   * porque cancelar exige un motivo y deja rastro: mezclarlo obligaría a que
   * `reasonCanceled` fuese opcional en el schema y a validarlo a mano según el
   * estado pedido, que es justo la clase de validación condicional que se
   * escapa. Como recurso propio, el motivo es obligatorio por construcción.
   *
   * Se admite cancelar desde cualquier estado, incluido `realizado`: una
   * aerolínea puede cancelar el vuelo después de que el check-in esté hecho.
   */
  async cancelCheckin(tramoId, { reasonCanceled }, { permissionScope, user } = {}) {
    const tramo = await prisma.tramos_vuelo.findUnique({
      where: { id: String(tramoId) },
      include: {
        prod_tiqueteria: {
          include: { detalle_venta: { include: { ventas: true } } },
        },
      },
    });

    if (!tramo) throw new NotFoundError('Tramo de vuelo no encontrado');

    const venta = tramo.prod_tiqueteria?.detalle_venta?.ventas;
    if (!venta || venta.deleted_at || venta.status === 'anulado') {
      throw new BadRequestError('La venta de este vuelo no está vigente');
    }
    if (permissionScope === 'own' && user && venta.usuario_id !== user.id) {
      throw new ForbiddenError('No puede cancelar el check-in de una venta de otro asesor');
    }
    if (tramo.checkin_status === 'cancelado') {
      throw new BadRequestError('El check-in de este vuelo ya está cancelado');
    }

    const { productStatus } = await prisma.$transaction(async (tx) => {
      await tx.tramos_vuelo.update({
        where: { id: tramo.id },
        data: {
          checkin_status: 'cancelado',
          canceled_at: new Date(),
          reason_canceled: reasonCanceled,
          // El check-in deja de estar hecho: su fecha no debe quedar puesta.
          checkin_at: null,
        },
      });

      const productStatus = await recalcularProducto(tx, tramo.prod_tiqueteria_id);
      return { productStatus };
    });

    const actualizado = await prisma.tramos_vuelo.findUnique({
      where: { id: tramo.id },
      select: { checkin_status: true, canceled_at: true, reason_canceled: true },
    });

    return {
      id: tramo.id,
      // Mismos nombres que en las filas del listado, y `checkinStatus` es el
      // que lee DataContext.updateFlight.
      checkinStatus: actualizado.checkin_status,
      checkin: actualizado.checkin_status,
      canceledAt: actualizado.canceled_at ? actualizado.canceled_at.toISOString() : null,
      reasonCanceled: actualizado.reason_canceled,
      checkinAt: null,
      productCheckinStatus: productStatus,
    };
  }

  /**
   * Envía los documentos del check-in al correo del cliente.
   *
   * Nunca lanza: un cliente sin correo, o un fallo de Resend, no puede tumbar
   * un check-in que ya está guardado. El resultado viaja en la respuesta para
   * que la pantalla pueda avisar.
   */
  async _enviarCheckin(tramo, venta, docs) {
    const persona = venta?.clientes?.personas;
    const destino = persona?.email;

    if (!destino) {
      return {
        emailSent: false,
        emailStatus: 'sin_correo',
        emailError: 'El cliente no tiene correo registrado',
        emailTo: null,
      };
    }

    const nombre = persona ? `${persona.nombres} ${persona.apellidos}` : 'viajero';
    const fecha = formatLocalDate(tramo.salida);
    const hora = formatLocalTime(tramo.salida);
    const vuelo = tramo.nro_vuelo_tramo || tramo.prod_tiqueteria?.nro_vuelo || '';
    const pnr = tramo.prod_tiqueteria?.nro_reserva || '';

    let adjuntos = [];
    try {
      adjuntos = await Promise.all(
        docs.map(async (d) => ({
          filename: d.filename,
          content: await fs.readFile(path.join(__dirname, '../../uploads', path.basename(d.url))),
        }))
      );
    } catch (err) {
      return {
        emailSent: false,
        emailStatus: 'error_adjunto',
        emailError: err.message,
        emailTo: destino,
      };
    }

    const res = await emailService.sendEmail({
      to: destino,
      subject: `Check-in realizado${vuelo ? ` - Vuelo ${vuelo}` : ''}`,
      html: `
        <p>Hola <strong>${nombre}</strong>,</p>
        <p>Hemos realizado el check-in de tu vuelo:</p>
        <ul>
          ${vuelo ? `<li><strong>Vuelo:</strong> ${vuelo}</li>` : ''}
          ${fecha ? `<li><strong>Fecha:</strong> ${fecha} ${hora || ''}</li>` : ''}
          ${pnr ? `<li><strong>Reserva:</strong> ${pnr}</li>` : ''}
        </ul>
        ${adjuntos.length ? '<p>Adjuntamos tus documentos de check-in.</p>' : ''}
      `,
      attachments: adjuntos,
    });

    return {
      emailSent: !!res.success,
      emailStatus: res.success ? 'enviado' : 'error_envio',
      emailError: res.success ? null : (res.error?.message || String(res.error || 'Error de envío')),
      emailTo: destino,
    };
  }
}

module.exports = new FlightsService();
