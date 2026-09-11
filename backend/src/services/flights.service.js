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

/**
 * ¿Solo las ventas propias?
 *
 * Es el alcance de VER, no el de la acción pedida. Las acciones de escritura
 * son booleanas —`edit: true` no tiene alcance—, así que las comprobaciones de
 * propiedad del check-in miraban un valor que nunca era 'own' y no se cumplían
 * nunca: los listados ocultaban el vuelo de otro asesor y el PUT del check-in
 * sobre ese mismo vuelo pasaba.
 */
const soloLasSuyas = ({ viewScope, permissionScope, user } = {}) =>
  (viewScope || permissionScope) === 'own' && Boolean(user);

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
function construirWhereBase({ dateFrom, dateTo, search, permissionScope, viewScope, user }) {
  const ventas = { ...VENTA_VIGENTE };

  // Con ámbito 'own' un asesor solo ve los vuelos de sus propias ventas.
  if (soloLasSuyas({ permissionScope, viewScope, user })) ventas.usuario_id = user.id;

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
 * Clasifica cada tramo como ida o regreso. En un `round_trip`, la primera mitad
 * de los tramos del producto es la ida.
 *
 * Se resuelve con TODOS los tramos del producto, no con los de la página. Antes
 * se agrupaba solo lo visible, así que un ida y vuelta partido entre dos
 * páginas se clasificaba sobre la mitad que se veía: los dos tramos de la
 * página 1 salían como "ida" y "regreso" y los otros dos repetían la etiqueta
 * en la página 2. La misma fila cambiaba de tipo según la página desde la que
 * se mirase.
 *
 * Cuesta una consulta más, pero de tres columnas y por un índice
 * (`@@index([prod_tiqueteria_id])`), no el `include` de cuatro niveles.
 */
async function resolverTipos(tramos) {
  const productos = [...new Set(tramos.map(t => t.prod_tiqueteria_id).filter(Boolean))];
  if (productos.length === 0) return {};

  const modos = new Map();
  for (const t of tramos) modos.set(t.prod_tiqueteria_id, t.prod_tiqueteria?.modo_vuelo);

  const hermanos = await prisma.tramos_vuelo.findMany({
    where: { prod_tiqueteria_id: { in: productos } },
    select: { id: true, orden: true, prod_tiqueteria_id: true },
    orderBy: [{ prod_tiqueteria_id: 'asc' }, { orden: 'asc' }],
  });

  const porProducto = new Map();
  for (const h of hermanos) {
    if (!porProducto.has(h.prod_tiqueteria_id)) porProducto.set(h.prod_tiqueteria_id, []);
    porProducto.get(h.prod_tiqueteria_id).push(h);
  }

  const tipos = {};
  for (const [pid, grupo] of porProducto) {
    if (modos.get(pid) === 'round_trip') {
      const mitad = Math.ceil(grupo.length / 2);
      grupo.forEach((h, i) => { tipos[h.id] = i < mitad ? 'ida' : 'regreso'; });
    } else {
      grupo.forEach(h => { tipos[h.id] = 'ida'; });
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
    // Claves internas para ordenar y filtrar en la mezcla con los vuelos de
    // plan. `paginarMezcla` las quita antes de responder.
    _salida: t.salida,
    _estado: estado,

    id: t.id,
    // Un tramo de tiquetería admite todo: check-in con documentos, momento y
    // cancelación con motivo. Un vuelo de plan, de momento, no.
    source: 'ticket',
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
    // Un solo JOIN lateral en vez de una consulta por nivel de relación. Con el
    // include anidado, una página de 10 filas costaba 11 viajes al pooler
    // (~75-160ms cada uno) más su BEGIN/COMMIT: unos 2s por petición.
    relationLoadStrategy: 'join',
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

// ───────────────────────────── vuelos de un plan ─────────────────────────────
//
// Un vuelo vendido dentro de un plan no aparecía en ninguna pantalla de
// vuelos. `flights.service` solo leía `tramos_vuelo`, que cuelga de
// `prod_tiqueteria`, y las dos columnas que el plan tiene para esto
// —`checkin_status_ida` y `checkin_status_regreso`— no las leía ni las escribía
// nadie. El asistente de venta EXIGE la fecha de ida y la de vuelta de un plan,
// así que cada plan vendido son dos vuelos que nadie podía ver ni gestionar.
//
// **Por qué no se convierten en tramos de verdad.** Sería lo correcto —una sola
// fuente de vuelos— pero `tramos_vuelo` exige `prod_tiqueteria_id`,
// `aeropuerto_origen_id` y `aeropuerto_destino_id`, y un plan no tiene ninguno
// de los tres: el formulario no pide aeropuertos, solo fechas, aerolínea y
// número de vuelo. Hacerlo posible es cambiar tres columnas a nullable y añadir
// una relación, y en este entorno no se puede: `prisma db push` necesita el
// DIRECT_URL de Supabase, que no es alcanzable, así que el cliente generado no
// admitiría columnas nuevas.
//
// Así que el plan se expande al LEER: una fila con fecha de ida y fecha de
// regreso son dos vuelos, con el mismo id compuesto en los dos sentidos
// (`plan:<id>:ida`), que es lo que permite escribir el check-in en la columna
// que toca. El estado sigue viviendo en su columna, no en dos sitios.

const PLAN_ID_SEP = ':';
const DIRECCIONES = {
  ida: { estado: 'checkin_status_ida', salida: 'fecha_salida_vuelo', llegada: 'fecha_llegada_vuelo' },
  regreso: { estado: 'checkin_status_regreso', salida: 'fecha_regreso_vuelo', llegada: 'fecha_llegada_regreso_vuelo' },
};

const idVueloDePlan = (planId, direccion) => `plan${PLAN_ID_SEP}${planId}${PLAN_ID_SEP}${direccion}`;

/** `plan:<uuid>:ida` -> {planId, direccion}. Cualquier otra cosa, null. */
function descomponerIdPlan(id) {
  const partes = String(id).split(PLAN_ID_SEP);
  if (partes.length !== 3 || partes[0] !== 'plan') return null;
  const [, planId, direccion] = partes;
  if (!DIRECCIONES[direccion]) return null;
  return { planId, direccion };
}

/**
 * Filtro sobre `prod_planes`, equivalente al de tramos: venta vigente, ámbito
 * de permisos y búsqueda. Las FECHAS no se filtran aquí: una fila lleva dos
 * vuelos con fechas distintas, así que el rango se aplica a cada vuelo ya
 * expandido —si no, pedir un mes traería el regreso de otro mes o descartaría
 * la ida que sí entra—.
 */
function construirWherePlanes({ search, permissionScope, viewScope, user }) {
  const ventas = { ...VENTA_VIGENTE };
  if (soloLasSuyas({ permissionScope, viewScope, user })) ventas.usuario_id = user.id;

  const where = {
    detalle_venta: { ventas },
    // Sin fecha de vuelo no hay vuelo que mostrar: es un plan sin transporte.
    OR: [{ fecha_salida_vuelo: { not: null } }, { fecha_regreso_vuelo: { not: null } }],
  };

  if (search) {
    const como = { contains: search, mode: 'insensitive' };
    // El OR de la búsqueda no puede pisar el OR de "tiene alguna fecha": se
    // combinan con AND, el mismo motivo que en `combinar`.
    return {
      AND: [
        where,
        {
          OR: [
            { nro_vuelo: como },
            { nro_reserva: como },
            { nro_tiquete: como },
            { nombre_plan: como },
            { detalle_venta: { pasajeros_detalle: { some: { personas: { OR: [{ nombres: como }, { apellidos: como }] } } } } },
            { detalle_venta: { ventas: { clientes: { personas: { OR: [{ nombres: como }, { apellidos: como }] } } } } },
          ],
        },
      ],
    };
  }

  return where;
}

/**
 * Los planes con vuelo, con lo necesario para pintar la fila.
 *
 * `relationLoadStrategy: 'join'` por lo mismo que en tramos: un include de
 * cuatro niveles cuesta un viaje al pooler por nivel.
 */
function buscarPlanes(where, take) {
  return prisma.prod_planes.findMany({
    where,
    take,
    relationLoadStrategy: 'join',
    include: {
      aerolineas: true,
      paquetes: true,
      detalle_venta: {
        include: {
          ventas: { include: { clientes: { include: { personas: { include: { tipos_documento: true } } } } } },
          pasajeros_detalle: { include: { personas: true } },
        },
      },
    },
    orderBy: [{ fecha_salida_vuelo: 'asc' }, { id: 'asc' }],
  });
}

/**
 * Una fila de plan -> hasta dos vuelos, con la misma forma que `mapearTramo`.
 *
 * La ruta sale del destino del paquete o del `detalle_venta`, que es lo único
 * que hay: el plan no guarda aeropuertos. En el regreso se invierte, que es lo
 * que de verdad ocurre en el viaje de vuelta.
 */
function expandirPlan(plan) {
  const dv = plan.detalle_venta;
  const venta = dv?.ventas;
  const persona = venta?.clientes?.personas;

  const pasajeros = (dv?.pasajeros_detalle || [])
    .map(pd => (pd.personas ? `${pd.personas.nombres} ${pd.personas.apellidos}` : null))
    .filter(Boolean);
  const nombrePax = pasajeros.length > 0
    ? pasajeros.join(', ')
    : (persona ? `${persona.nombres} ${persona.apellidos}` : '');

  const origen = dv?.origen || '';
  const destino = dv?.destino || plan.paquetes?.destino || '';

  return Object.entries(DIRECCIONES).flatMap(([direccion, col]) => {
    const salida = plan[col.salida];
    if (!salida) return [];

    const esIda = direccion === 'ida';
    const desde = esIda ? origen : destino;
    const hasta = esIda ? destino : origen;
    const estado = plan[col.estado] || 'pendiente';

    return [{
      // `salida` cruda, para ordenar y para los predicados de estado. No sale
      // en la respuesta: se formatea igual que en los tramos.
      _salida: salida,
      _estado: estado,

      id: idVueloDePlan(plan.id, direccion),
      // Con qué se puede operar sobre esta fila. La pantalla lo necesita para
      // no ofrecer lo que este origen no soporta.
      source: 'plan',
      planId: plan.id,
      saleId: venta?.id || null,
      pnr: plan.nro_reserva || '',
      reservationNumber: plan.nro_reserva || '',
      planName: plan.nombre_plan || plan.paquetes?.nombre || '',
      airline: plan.aerolineas?.nombre || '',
      airlineCode: plan.aerolineas?.codigo_iata || '',
      flightNumber: plan.nro_vuelo || '',
      origin: desde,
      originCity: desde,
      destination: hasta,
      destinationCity: hasta,
      route: desde && hasta ? `${desde} - ${hasta}` : (desde || hasta || ''),
      flightDate: formatLocalDate(salida),
      date: formatLocalDate(salida) || '',
      flightTime: formatLocalTime(salida),
      time: formatLocalTime(salida) || '',
      arrivalDate: formatLocalDate(plan[col.llegada]),
      arrivalTime: formatLocalTime(plan[col.llegada]),
      checkinStatus: estado,
      checkin: estado,
      // El plan no tiene dónde guardar ni el momento del check-in, ni los
      // documentos, ni el motivo de una cancelación: son columnas que hay que
      // añadir. Se devuelven en null en vez de omitirlas, para que la fila
      // tenga la misma forma que la de un tramo y la pantalla no tenga que
      // distinguir.
      checkinAt: null,
      checkinDocs: null,
      canceledAt: null,
      reasonCanceled: null,
      passengerName: nombrePax,
      passenger: nombrePax,
      clientId: venta?.cliente_id || null,
      clientName: persona ? `${persona.nombres} ${persona.apellidos}` : null,
      clientAvatar: persona?.avatar_url || null,
      clientEmail: persona?.email || null,
      clientDocType: persona?.tipos_documento?.abreviatura || null,
      clientDocNumber: persona?.documento || null,
      ticketNumber: plan.nro_tiquete || '',
      seat: null,
      orden: esIda ? 1 : 2,
      type: direccion,
    }];
  });
}

/** ¿Cae este vuelo de plan en el rango pedido? */
function enRango(vuelo, dateFrom, dateTo) {
  if (dateFrom && vuelo._salida < new Date(dateFrom)) return false;
  if (dateTo && vuelo._salida > new Date(dateTo)) return false;
  return true;
}

/**
 * El mismo criterio de estado que los tramos, sobre los vuelos ya expandidos.
 * Se decide en memoria porque `critico` depende de la hora y de la fecha de
 * CADA sentido, no de la fila.
 */
function cumpleEstado(vuelo, status, ahora) {
  if (!status) return true;
  const pendiente = vuelo._estado === 'pendiente';
  if (status === 'pendiente') return pendiente;
  if (status === 'realizado') return vuelo._estado === 'realizado';
  if (status === 'cancelado') return vuelo._estado === 'cancelado';
  if (status === 'critico') {
    return pendiente
      && vuelo._salida >= ahora
      && vuelo._salida <= new Date(ahora.getTime() + MS_CRITICOS);
  }
  return true;
}

/** Cubo de contadores al que pertenece, con el mismo pliegue que los tramos. */
const cuboDe = (vuelo) => (vuelo._estado === 'realizado' ? 'realizado'
  : vuelo._estado === 'cancelado' ? 'cancelado' : 'pendiente');

/**
 * Los vuelos de plan que entran en el listado, ya filtrados y ordenados.
 *
 * Se traen todos los que pasan el filtro, no una página: hay que ordenarlos
 * junto con los tramos, y no se puede paginar en SQL una fila que se convierte
 * en dos según sus fechas. `TOPE_PLANES` acota el coste; son planes con vuelo,
 * no ventas, así que el orden de magnitud es de decenas.
 */
const TOPE_PLANES = 500;

async function vuelosDePlan({ status, dateFrom, dateTo, search, permissionScope, viewScope, user }, ahora) {
  const planes = await buscarPlanes(construirWherePlanes({ search, permissionScope, user }), TOPE_PLANES);

  const todos = planes
    .flatMap(expandirPlan)
    .filter(v => enRango(v, dateFrom, dateTo));

  // Los contadores se calculan ANTES del filtro de estado, igual que los de
  // tramos se calculan sobre `whereBase`: al filtrar por un estado, los demás
  // tienen que seguir mostrando su total.
  const counts = { pendiente: 0, realizado: 0, cancelado: 0, critico: 0, total: 0 };
  for (const v of todos) {
    counts[cuboDe(v)] += 1;
    counts.total += 1;
    if (cumpleEstado(v, 'critico', ahora)) counts.critico += 1;
  }

  const filas = todos
    .filter(v => cumpleEstado(v, status, ahora))
    .sort(ordenarPorSalida);

  return { filas, counts };
}

/** Mismo orden que la consulta de tramos: salida ascendente, id de desempate. */
function ordenarPorSalida(a, b) {
  const da = a._salida instanceof Date ? a._salida.getTime() : new Date(a._salida).getTime();
  const db = b._salida instanceof Date ? b._salida.getTime() : new Date(b._salida).getTime();
  if (da !== db) return da - db;
  return String(a.id).localeCompare(String(b.id));
}

/**
 * Mezcla las dos fuentes y devuelve la página pedida.
 *
 * Las dos listas llegan ordenadas por el mismo criterio, así que la mezcla
 * ordenada de las dos también lo está: se concatena, se ordena y se corta. De
 * los tramos se piden `skip + perPage` filas —no `perPage`— porque cualquiera
 * de ellas puede quedar desplazada a otra página por un vuelo de plan que se
 * cuele delante.
 */
function paginarMezcla(deTramos, dePlanes, skip, perPage) {
  return [...deTramos, ...dePlanes]
    .sort(ordenarPorSalida)
    .slice(skip, skip + perPage)
    .map(({ _salida, _estado, ...fila }) => fila);
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
  /**
   * Un tramo por su id.
   *
   * Aplica el mismo filtro que el listado —venta vigente y ámbito de
   * permisos—, así que un asesor con alcance 'own' recibe 404, no el vuelo de
   * otro: si un recurso no es visible en la lista, tampoco debe serlo por su
   * URL directa.
   */
  async getFlightById(id, { permissionScope, viewScope, user } = {}) {
    const dePlan = descomponerIdPlan(id);
    if (dePlan) {
      const { filas } = await vuelosDePlan({ permissionScope, viewScope, user }, new Date());
      const vuelo = filas.find(v => v.id === String(id));
      if (!vuelo) throw new NotFoundError('Vuelo no encontrado');
      const { _salida, _estado, ...fila } = vuelo;
      return fila;
    }

    const whereBase = construirWhereBase({ permissionScope, viewScope, user });
    const [tramo] = await buscarTramos({ AND: [whereBase, { id: String(id) }] }, 0, 1);
    if (!tramo) throw new NotFoundError('Vuelo no encontrado');

    const tipos = await resolverTipos([tramo]);
    const { _salida, _estado, ...fila } = mapearTramo(tramo, tipos[tramo.id]);
    return fila;
  }

  async listFlights({ pagination, dateFrom, dateTo, checkinStatus, search, permissionScope, viewScope, user }) {
    const { page, perPage, skip } = pagination;
    const ahora = new Date();
    const whereBase = construirWhereBase({ dateFrom, dateTo, search, permissionScope, viewScope, user });
    const where = combinar(whereBase, predicadoEstado(checkinStatus, ahora));

    // El count y las filas comparten el mismo `where`: si divergen, una
    // búsqueda sin resultados sigue informando de que hay N registros.
    //
    // De los tramos se piden `skip + perPage`, no `perPage`: un vuelo de plan
    // puede colarse por delante y desplazar filas a la página siguiente.
    const [total, tramos, planes] = await Promise.all([
      prisma.tramos_vuelo.count({ where }),
      buscarTramos(where, 0, skip + perPage),
      vuelosDePlan({ status: checkinStatus, dateFrom, dateTo, search, permissionScope, user }, ahora),
    ]);

    const tipos = await resolverTipos(tramos);
    const data = paginarMezcla(tramos.map(t => mapearTramo(t, tipos[t.id])), planes.filas, skip, perPage);

    return { data, meta: buildMeta(total + planes.filas.length, page, perPage) };
  }

  /**
   * Listado de check-ins de vuelo. Sustituye a las tres llamadas que la
   * pantalla hacía contra `listFlights` con filtros distintos: los contadores
   * por estado viajan en `meta.counts`, calculados en SQL.
   */
  async listCheckins({ pagination, status, dateFrom, dateTo, search, permissionScope, viewScope, user }) {
    const { page, perPage, skip } = pagination;
    const ahora = new Date();

    const whereBase = construirWhereBase({ dateFrom, dateTo, search, permissionScope, viewScope, user });
    const where = combinar(whereBase, predicadoEstado(status, ahora));

    // Tres consultas, no cuatro: el `count` para `meta.total` sobraba, porque
    // cuenta exactamente lo mismo que el contador del estado pedido. Derivarlo
    // ahorra un viaje al pooler (con su BEGIN/COMMIT) y, más importante,
    // garantiza que el total y los contadores no puedan discrepar nunca: salen
    // del mismo sitio. La regla del repo es que el count y las filas se
    // construyan con el mismo filtro; aquí ya es imposible incumplirla.
    const [tramos, grupos, criticos, planes] = await Promise.all([
      buscarTramos(where, 0, skip + perPage),
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
      // Los vuelos vendidos dentro de un plan, que no son tramos y hasta ahora
      // no salían en ninguna de las dos pantallas.
      vuelosDePlan({ status, dateFrom, dateTo, search, permissionScope, viewScope, user }, ahora),
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
    // Los de plan suman en los mismos cubos: para quien mira la pantalla son
    // check-ins pendientes igual que los demás.
    for (const clave of Object.keys(counts)) counts[clave] += planes.counts[clave];

    // El total del listado es el contador del estado pedido; sin filtro, el de
    // todos. `critico` incluido: su contador se cuenta con su mismo predicado.
    const total = status ? counts[status] : counts.total;

    const tipos = await resolverTipos(tramos);
    const data = paginarMezcla(tramos.map(t => mapearTramo(t, tipos[t.id])), planes.filas, skip, perPage);

    return { data, meta: { ...buildMeta(total, page, perPage), counts } };
  }

  /**
   * Registra el check-in de UN tramo y envía al cliente los documentos
   * adjuntos, que es lo que la pantalla promete al confirmar.
   */
  async updateCheckin(tramoId, body = {}, files = [], { permissionScope, viewScope, user } = {}) {
    // Con multipart todo llega como string, así que la comparación es directa.
    const pedido = body.checkin || body.checkinStatus || 'realizado';

    // `critico` es derivado: escribirlo crearía filas cuyo estado contradice su
    // fecha y que ningún filtro encontraría.
    if (pedido !== 'pendiente' && pedido !== 'realizado') {
      throw new BadRequestError(
        `Estado de check-in no escribible: ${pedido}. Válidos: pendiente, realizado`
      );
    }

    const dePlan = descomponerIdPlan(tramoId);
    if (dePlan) return this._checkinDePlan(dePlan, pedido, files, { permissionScope, viewScope, user });

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
    if (soloLasSuyas({ permissionScope, viewScope, user }) && venta.usuario_id !== user.id) {
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
    const { productStatus } = await prisma.transaccion(async (tx) => {
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
  /**
   * Check-in de un vuelo vendido dentro de un plan.
   *
   * Escribe en la columna del sentido —`checkin_status_ida` o
   * `checkin_status_regreso`—, que existía desde el principio y no la usaba
   * nadie. No hay rollup que recalcular: en un plan cada sentido es un vuelo y
   * su columna es el estado, sin tramos por debajo que agregar.
   *
   * Lo que no puede hacer, y por qué: guardar CUÁNDO se hizo, los documentos
   * adjuntos y el motivo de una cancelación. `prod_planes` no tiene esas
   * columnas y añadirlas necesita un `db push` contra el DIRECT_URL de
   * Supabase, que desde aquí no es alcanzable. Los adjuntos que lleguen se
   * rechazan en vez de aceptarse y perderse en silencio.
   */
  async _checkinDePlan({ planId, direccion }, pedido, files, { permissionScope, viewScope, user }) {
    if (files && files.length) {
      throw new BadRequestError(
        'Un vuelo de plan todavía no puede guardar documentos de check-in: falta la columna donde ponerlos'
      );
    }

    const plan = await prisma.prod_planes.findUnique({
      where: { id: planId },
      include: { detalle_venta: { include: { ventas: true } } },
    });
    if (!plan) throw new NotFoundError('Vuelo no encontrado');

    const venta = plan.detalle_venta?.ventas;
    if (!venta || venta.deleted_at || venta.status === 'anulado') {
      throw new BadRequestError('La venta de este vuelo no está vigente');
    }
    if (soloLasSuyas({ permissionScope, viewScope, user }) && venta.usuario_id !== user.id) {
      throw new ForbiddenError('No puede registrar el check-in de una venta de otro asesor');
    }

    const col = DIRECCIONES[direccion];
    if (!plan[col.salida]) throw new NotFoundError('Este plan no tiene vuelo de ' + direccion);

    await prisma.prod_planes.update({
      where: { id: planId },
      data: { [col.estado]: pedido },
    });

    return {
      id: idVueloDePlan(planId, direccion),
      source: 'plan',
      checkinStatus: pedido,
      checkin: pedido,
      checkinAt: null,
      attachments: [],
      emailSent: false,
      emailStatus: 'no_aplica',
      productCheckinStatus: pedido,
    };
  }

  async cancelCheckin(tramoId, { reasonCanceled }, { permissionScope, viewScope, user } = {}) {
    // Cancelar exige guardar el motivo, y `prod_planes` no tiene dónde. Se
    // dice, en vez de guardar el estado y perder el motivo: una cancelación
    // sin motivo es justo lo que este endpoint existe para evitar.
    if (descomponerIdPlan(tramoId)) {
      throw new BadRequestError(
        'Un vuelo de plan todavía no se puede cancelar: falta la columna del motivo. Márcalo como pendiente si el check-in no se hizo.'
      );
    }

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
    if (soloLasSuyas({ permissionScope, viewScope, user }) && venta.usuario_id !== user.id) {
      throw new ForbiddenError('No puede cancelar el check-in de una venta de otro asesor');
    }
    if (tramo.checkin_status === 'cancelado') {
      throw new BadRequestError('El check-in de este vuelo ya está cancelado');
    }

    const { productStatus } = await prisma.transaccion(async (tx) => {
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
