const { randomUUID: uuidv4 } = require('crypto');
const prisma = require('../config/db');
const { BadRequestError, ForbiddenError, NotFoundError } = require('../errors/AppError');
const almacenamiento = require('../utils/almacenamiento');
const { datosFinancieros } = require('./saleTotals');
const { soloLasSuyas, cotizacionVisible } = require('./quotesAlcance');
const clientsService = require('./clients.service');
const productValidation = require('./productValidation');
const { resumenDe } = require('../catalog/resumenProducto');
const { CATALOG, SLUGS } = require('../catalog/products');
const { buildMeta } = require('../utils/paginationHelper');
const { fechaEnColombia } = require('../utils/fechas');

const ESTADOS_CERRADOS = ['aceptada', 'rechazada'];

// Spec 021: fotos de un servicio cotizado, para que el cliente vea cómo es.
const BUCKET_IMAGENES = 'cotizacion-imagenes';
const MAX_IMAGENES_POR_LINEA = 5;
const EXT_IMAGEN = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
// Cuánto dura la URL firmada que ve el navegador al abrir la cotización — igual de corta que
// la del PDF (`urlDeDescarga`); se vuelve a pedir cada vez que se abre.
const IMAGEN_SEGUNDOS = 300;

/** `null` si no se mandó cliente (una cotización no es una venta: no es obligatorio); si se mandó uno, comprueba que exista. */
async function idDeClienteExistente(clientId) {
  if (clientId === undefined || clientId === null || String(clientId).trim() === '') return null;
  const cliente = await prisma.clientes.findFirst({ where: { id: Number(clientId), deleted_at: null }, select: { id: true } });
  if (!cliente) throw new BadRequestError('El cliente no existe');
  return cliente.id;
}

/**
 * Las líneas de un cuerpo de cotización, una por cada producto de cada categoría —
 * el mismo cuerpo que una venta, agrupado por `ticketData`/`hotelData`/... (spec 007).
 * `detalle` es el objeto completo (`TicketData`/`HotelData`...); `descripcion` se
 * deriva de él, nunca se escribe a mano.
 */
function lineasDe(body) {
  const lineas = [];
  for (const slug of SLUGS) {
    const clave = CATALOG[slug].responseKey;
    for (const item of body[clave] || []) {
      const { ta, costo_proveedor, iva } = datosFinancieros(item);
      lineas.push({
        id: uuidv4(),
        categoria: slug,
        descripcion: resumenDe(slug, item),
        detalle: item,
        costo_proveedor,
        ta,
        iva,
      });
    }
  }
  return lineas;
}

/** Las cuatro cifras de la cotización, suma de sus líneas (no se guardan en la cabecera). */
function totalesDe(lineas) {
  return lineas.reduce((acc, l) => ({
    costoProveedor: acc.costoProveedor + Number(l.costo_proveedor),
    ta: acc.ta + Number(l.ta),
    iva: acc.iva + Number(l.iva),
    total: acc.total + Number(l.costo_proveedor) + Number(l.ta) + Number(l.iva),
  }), { costoProveedor: 0, ta: 0, iva: 0, total: 0 });
}

/**
 * `vencida` no es una columna: se compara `fecha_vencimiento` con hoy en Bogotá al leer,
 * igual que `critico` en vuelos (spec 004). Una cerrada (aceptada/rechazada) no vence.
 */
function estadoEfectivo(cotizacion) {
  if (cotizacion.estado === 'enviada' && cotizacion.fecha_vencimiento) {
    if (fechaEnColombia(cotizacion.fecha_vencimiento) < fechaEnColombia(new Date())) return 'vencida';
  }
  return cotizacion.estado;
}

function mapCotizacion(cotizacion, lineas) {
  return {
    id: cotizacion.id,
    numero: cotizacion.numero,
    name: cotizacion.nombre,
    clientId: cotizacion.cliente_id,
    clientName: cotizacion.clientes
      ? `${cotizacion.clientes.personas.nombres} ${cotizacion.clientes.personas.apellidos}`
      : undefined,
    asesorId: cotizacion.usuario_id,
    estado: estadoEfectivo(cotizacion),
    fechaVencimiento: cotizacion.fecha_vencimiento ? cotizacion.fecha_vencimiento.toISOString() : null,
    observations: cotizacion.observaciones,
    ventaId: cotizacion.venta_id,
    creadoAt: cotizacion.creado_at.toISOString(),
    lines: lineas.map(l => ({
      id: l.id,
      categoria: l.categoria,
      descripcion: l.descripcion,
      // El detalle completo (el mismo `TicketData`/`HotelData`... del asistente), para
      // reabrir el mismo formulario al editar. Nulo en líneas de antes de este cambio.
      detalle: l.detalle,
      costoProveedor: Number(l.costo_proveedor),
      ta: Number(l.ta),
      iva: Number(l.iva),
      precio: Number(l.costo_proveedor) + Number(l.ta) + Number(l.iva),
    })),
    totals: totalesDe(lineas),
  };
}

/**
 * Las rutas guardadas en `detalle.images` de cada línea, convertidas a URLs firmadas de corta
 * duración — igual que ya se hace con el PDF. Nunca se manda al navegador la ruta cruda del
 * bucket. Muta `lines` en el sitio; se usa después de `mapCotizacion`, nunca antes (el PDF
 * necesita las rutas crudas para descargar los bytes, no una URL que expira).
 */
async function resolverImagenesDeLineas(lines) {
  for (const l of lines) {
    const rutas = l.detalle?.images;
    if (!Array.isArray(rutas) || !rutas.length) continue;
    l.detalle = {
      ...l.detalle,
      images: await Promise.all(rutas.map(r => almacenamiento.firmar(BUCKET_IMAGENES, r, IMAGEN_SEGUNDOS))),
    };
  }
}

class QuotesService {
  async listQuotes({ pagination, search, status, alcance = {} }) {
    const { page, perPage, skip } = pagination;
    const where = {
      deleted_at: null,
      ...(soloLasSuyas(alcance) ? { usuario_id: alcance.user.id } : {}),
      ...(status ? { estado: status } : {}),
      ...(search ? {
        clientes: { personas: { OR: [
          { nombres: { contains: search, mode: 'insensitive' } },
          { apellidos: { contains: search, mode: 'insensitive' } },
        ] } },
      } : {}),
    };
    const [total, filas] = await Promise.all([
      prisma.cotizaciones.count({ where }),
      prisma.cotizaciones.findMany({
        where,
        orderBy: { creado_at: 'desc' },
        skip,
        take: perPage,
        include: { clientes: { include: { personas: true } }, detalle_cotizacion: true },
      }),
    ]);
    return { data: filas.map(f => mapCotizacion(f, f.detalle_cotizacion)), meta: buildMeta(total, page, perPage) };
  }

  /**
   * `resolverImagenes` en `false` solo lo usa el PDF (`services/quotes/index.js`): necesita la
   * ruta cruda de cada imagen para descargar sus bytes con el service role, no una URL firmada
   * que de todos modos tendría que volver a bajar por HTTP.
   */
  async getQuoteById(id, alcance = {}, { resolverImagenes = true } = {}) {
    const visible = await cotizacionVisible(id, alcance);
    const [cotizacion, lineas] = await Promise.all([
      prisma.cotizaciones.findFirst({ where: { id: visible.id }, include: { clientes: { include: { personas: true } } } }),
      prisma.detalle_cotizacion.findMany({ where: { cotizacion_id: visible.id }, orderBy: { creado_at: 'asc' } }),
    ]);
    const mapeada = mapCotizacion(cotizacion, lineas);
    if (resolverImagenes) await resolverImagenesDeLineas(mapeada.lines);
    return mapeada;
  }

  async createQuote(body, alcance = {}) {
    const { clientId, asesorId, name, fechaVencimiento, observations } = body;

    // Mismo resguardo que `createSale`: sin asesor explícito, `usuario_id` cae en
    // quien crea; suplantando, ese id es del superadministrador, de otra agencia.
    const asesorPedido = asesorId === undefined || asesorId === null ? null : Number(asesorId);
    if (soloLasSuyas(alcance) && asesorPedido !== null && asesorPedido !== alcance.user.id) {
      throw new ForbiddenError('No puede crear una cotización a nombre de otro asesor');
    }
    if (asesorPedido === null && alcance.suplantando) {
      throw new BadRequestError('Elige un asesor: quien suplanta no puede quedar como el asesor de la cotización');
    }
    const usuarioId = asesorPedido ?? alcance.user.id;

    // Sin cliente fijo (spec 007): una cotización no es una venta, así que nada aquí
    // es obligatorio, ni siquiera el cliente. Si se manda uno, tiene que existir.
    const clienteId = await idDeClienteExistente(clientId);

    // Misma validación que una venta, salvo la reserva del titular (no existe
    // todavía mientras se cotiza): aeropuertos y planes de equipaje de los tiquetes,
    // y el documento de cada persona (productValidation.js, compartido).
    const catalogos = await productValidation.precargarCatalogos(body);
    productValidation.validarTiquetes(body.ticketData || [], catalogos, { exigirReserva: false });
    productValidation.validarPersonas(body, catalogos);

    const lineas = lineasDe(body);
    if (!lineas.length) throw new BadRequestError('La cotización necesita al menos un servicio');

    const creada = await prisma.transaccion(async (tx) => {
      const cotizacion = await tx.cotizaciones.create({
        data: {
          cliente_id: clienteId,
          usuario_id: usuarioId,
          nombre: name || null,
          fecha_vencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
          observaciones: observations || null,
        },
      });
      await tx.detalle_cotizacion.createMany({
        data: lineas.map(l => ({ ...l, cotizacion_id: cotizacion.id })),
      });
      return cotizacion;
    });

    return this.getQuoteById(creada.id, alcance);
  }

  async updateQuote(id, body, alcance = {}) {
    const cotizacion = await cotizacionVisible(id, alcance, { paraEscribir: true });
    if (ESTADOS_CERRADOS.includes(cotizacion.estado)) {
      throw new BadRequestError('No se puede editar una cotización aceptada o rechazada');
    }
    const { clientId, name, fechaVencimiento, observations } = body;
    const clienteId = clientId !== undefined ? await idDeClienteExistente(clientId) : undefined;

    const catalogos = await productValidation.precargarCatalogos(body);
    productValidation.validarTiquetes(body.ticketData || [], catalogos, { exigirReserva: false });
    productValidation.validarPersonas(body, catalogos);

    const lineas = lineasDe(body);
    if (!lineas.length) throw new BadRequestError('La cotización necesita al menos un servicio');

    await prisma.transaccion(async (tx) => {
      await tx.cotizaciones.update({
        where: { id: cotizacion.id },
        data: {
          ...(clientId !== undefined ? { cliente_id: clienteId } : {}),
          nombre: name || null,
          fecha_vencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
          observaciones: observations || null,
        },
      });
      // Se reescribe entera: más simple que un diff línea a línea, y consistente con
      // que una cotización en borrador/enviada se reemplaza por completo (plan.md).
      await tx.detalle_cotizacion.deleteMany({ where: { cotizacion_id: cotizacion.id } });
      await tx.detalle_cotizacion.createMany({
        data: lineas.map(l => ({ ...l, cotizacion_id: cotizacion.id })),
      });
    });

    return this.getQuoteById(cotizacion.id, alcance);
  }

  async deleteQuote(id, alcance = {}) {
    const cotizacion = await cotizacionVisible(id, alcance, { paraEscribir: true });
    await prisma.cotizaciones.update({ where: { id: cotizacion.id }, data: { deleted_at: new Date() } });
  }

  async duplicateQuote(id, alcance = {}) {
    const original = await cotizacionVisible(id, alcance);
    const lineas = await prisma.detalle_cotizacion.findMany({ where: { cotizacion_id: original.id } });

    // Misma cantidad de días de validez que tenía el original, contados desde hoy;
    // si no tenía fecha de vencimiento, la copia tampoco.
    let fechaVencimiento = null;
    if (original.fecha_vencimiento) {
      const dias = Math.round((original.fecha_vencimiento.getTime() - original.creado_at.getTime()) / 86400000);
      fechaVencimiento = new Date(Date.now() + dias * 86400000);
    }

    const copia = await prisma.transaccion(async (tx) => {
      const cotizacion = await tx.cotizaciones.create({
        data: {
          cliente_id: original.cliente_id,
          usuario_id: original.usuario_id,
          nombre: original.nombre,
          fecha_vencimiento: fechaVencimiento,
          observaciones: original.observaciones,
        },
      });
      if (lineas.length) {
        await tx.detalle_cotizacion.createMany({
          data: lineas.map(l => ({
            id: uuidv4(), cotizacion_id: cotizacion.id, categoria: l.categoria, descripcion: l.descripcion,
            detalle: l.detalle, costo_proveedor: l.costo_proveedor, ta: l.ta, iva: l.iva,
          })),
        });
      }
      return cotizacion;
    });

    return this.getQuoteById(copia.id, alcance);
  }

  async sendQuote(id, alcance = {}) {
    const cotizacion = await cotizacionVisible(id, alcance, { paraEscribir: true });
    if (ESTADOS_CERRADOS.includes(cotizacion.estado)) {
      throw new BadRequestError('No se puede enviar una cotización aceptada o rechazada');
    }
    await prisma.cotizaciones.update({ where: { id: cotizacion.id }, data: { estado: 'enviada' } });
    return this.getQuoteById(cotizacion.id, alcance);
  }

  async respondQuote(id, { accepted }, alcance = {}) {
    const cotizacion = await cotizacionVisible(id, alcance, { paraEscribir: true });
    if (cotizacion.estado !== 'enviada') {
      throw new BadRequestError('Solo se puede responder una cotización enviada');
    }
    await prisma.cotizaciones.update({ where: { id: cotizacion.id }, data: { estado: accepted ? 'aceptada' : 'rechazada' } });
    return this.getQuoteById(cotizacion.id, alcance);
  }

  /**
   * No escribe la venta: agrupa las líneas por categoría y devuelve el detalle
   * completo de cada una, listo para precargar el borrador del asistente —el mismo
   * objeto que ya validó al guardar la cotización, sin volver a escribirlo.
   */
  async convertToSale(id, alcance = {}) {
    const cotizacion = await cotizacionVisible(id, alcance, { paraEscribir: true });
    if (cotizacion.estado !== 'aceptada') {
      throw new BadRequestError('Solo se puede convertir en venta una cotización aceptada');
    }
    if (cotizacion.venta_id) {
      throw new BadRequestError('Esta cotización ya fue convertida en una venta');
    }
    const [cliente, lineas] = await Promise.all([
      cotizacion.cliente_id ? clientsService.getClientById(cotizacion.cliente_id) : null,
      prisma.detalle_cotizacion.findMany({ where: { cotizacion_id: cotizacion.id }, orderBy: { creado_at: 'asc' } }),
    ]);
    const products = {};
    for (const l of lineas) {
      if (!l.detalle) continue; // Líneas de antes de este cambio: sin detalle, no hay nada que precargar.
      (products[l.categoria] ??= []).push(l.detalle);
    }
    return { quoteId: cotizacion.id, clientId: cotizacion.cliente_id, client: cliente, products };
  }

  /** Llamado por el frontend justo después de que `POST /sales` cree la venta. */
  async linkSale(id, { saleId }, alcance = {}) {
    const cotizacion = await cotizacionVisible(id, alcance, { paraEscribir: true });
    // No pisar un enlace ya puesto: dejaría la cotización apuntando a una venta
    // distinta de la que realmente se generó a partir de ella.
    if (cotizacion.venta_id) {
      throw new BadRequestError('Esta cotización ya está enlazada a una venta');
    }
    const venta = await prisma.ventas.findFirst({ where: { id: Number(saleId), deleted_at: null }, select: { id: true } });
    if (!venta) throw new BadRequestError('La venta no existe');
    await prisma.cotizaciones.update({ where: { id: cotizacion.id }, data: { venta_id: venta.id } });
    return this.getQuoteById(cotizacion.id, alcance);
  }

  /** La línea, comprobando que de verdad sea de esta cotización (spec 021, mismo resguardo que un producto de venta). */
  async _lineaDeLaCotizacion(cotizacionId, lineId) {
    const linea = await prisma.detalle_cotizacion.findFirst({ where: { id: lineId, cotizacion_id: cotizacionId } });
    if (!linea) throw new NotFoundError('Servicio no encontrado en esta cotización');
    return linea;
  }

  /**
   * Sube una foto de un servicio cotizado (spec 021): primero el archivo al bucket, después la
   * ruta a `detalle.images` de la línea. Si falla escribir la línea, se borra el archivo recién
   * subido — no se queda un huérfano por un fallo a mitad de camino.
   */
  async addLineImage(id, lineId, fichero, alcance = {}) {
    const cotizacion = await cotizacionVisible(id, alcance, { paraEscribir: true });
    if (ESTADOS_CERRADOS.includes(cotizacion.estado)) {
      throw new BadRequestError('No se puede editar una cotización aceptada o rechazada');
    }
    const linea = await this._lineaDeLaCotizacion(cotizacion.id, lineId);
    if (!fichero?.buffer?.length) {
      throw new BadRequestError('No llegó ningún archivo', 'VALIDATION_ERROR', [{ field: 'image', message: 'Elige una imagen' }]);
    }
    const ext = EXT_IMAGEN[fichero.mimetype];
    if (!ext) throw new BadRequestError('La imagen tiene que ser PNG, JPG o WebP');

    const imagenes = Array.isArray(linea.detalle?.images) ? linea.detalle.images : [];
    if (imagenes.length >= MAX_IMAGENES_POR_LINEA) {
      throw new BadRequestError(`Esta línea ya tiene el máximo de ${MAX_IMAGENES_POR_LINEA} imágenes`);
    }

    const nombre = `${cotizacion.id}/${lineId}/${uuidv4()}.${ext}`;
    await almacenamiento.subir(BUCKET_IMAGENES, nombre, fichero.buffer, fichero.mimetype);
    try {
      await prisma.detalle_cotizacion.update({
        where: { id: lineId },
        data: { detalle: { ...(linea.detalle || {}), images: [...imagenes, nombre] } },
      });
    } catch (err) {
      await almacenamiento.borrar(BUCKET_IMAGENES, nombre).catch(() => {});
      throw err;
    }
    return this.getQuoteById(cotizacion.id, alcance);
  }

  /** Borra una foto de un servicio cotizado (spec 021). No fallar si el archivo ya no está en el bucket. */
  async removeLineImage(id, lineId, indice, alcance = {}) {
    const cotizacion = await cotizacionVisible(id, alcance, { paraEscribir: true });
    if (ESTADOS_CERRADOS.includes(cotizacion.estado)) {
      throw new BadRequestError('No se puede editar una cotización aceptada o rechazada');
    }
    const linea = await this._lineaDeLaCotizacion(cotizacion.id, lineId);
    const imagenes = Array.isArray(linea.detalle?.images) ? [...linea.detalle.images] : [];
    const i = Number(indice);
    if (!Number.isInteger(i) || i < 0 || i >= imagenes.length) {
      throw new BadRequestError('Esa imagen no existe');
    }
    const [quitada] = imagenes.splice(i, 1);
    await prisma.detalle_cotizacion.update({
      where: { id: lineId },
      data: { detalle: { ...(linea.detalle || {}), images: imagenes } },
    });
    await almacenamiento.borrar(BUCKET_IMAGENES, quitada)
      .catch(err => console.warn('[QUOTE_IMAGE_DELETE_FAILED]', err.message));
    return this.getQuoteById(cotizacion.id, alcance);
  }
}

module.exports = new QuotesService();
