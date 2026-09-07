const prisma = require('../config/db');
const { NotFoundError, BadRequestError } = require('../errors/AppError');
const { buildMeta } = require('../utils/paginationHelper');

const SECTION_MAP = {
  'cards': {
    model: 'tarjetas_agencia', idField: 'id', include: { metodos_pago: true },
    buscarEn: ['nombre', 'ultimos_cuatro'],
    orden: { defecto: 'name', campos: { name: 'nombre', status: 'status', id: 'id' } },
    transform: (r) => ({ id: r.id, name: r.nombre, paymentMethod: r.metodos_pago?.nombre || null, lastFourDigits: r.ultimos_cuatro, description: r.descripcion, status: r.status === 'active' || r.status === 'Activo' ? 'Activo' : 'Inactivo' }),
    reverseTransform: async (d) => {
      // Por id si viene, y si no por nombre. Resolver una clave ajena por
      // texto libre se rompe en cuanto alguien renombra el método de pago.
      let methodId = Number(d.paymentMethodId) || null;
      if (!methodId && d.paymentMethod) {
        const m = await prisma.metodos_pago.findFirst({ where: { nombre: d.paymentMethod } });
        if (m) methodId = m.id;
      }
      return {
        nombre: d.name || 'Sin nombre',
        metodo_pago_id: methodId,
        ultimos_cuatro: d.lastFourDigits,
        descripcion: d.description,
        status: d.status === 'Inactivo' ? 'inactive' : 'active'
      };
    }
  },
  'payment-methods': {
    model: 'metodos_pago', idField: 'id',
    buscarEn: ['nombre'],
    orden: { defecto: 'name', campos: { name: 'nombre', id: 'id' } },
    transform: (r) => ({ id: r.id, name: r.nombre }),
    reverseTransform: async (d) => ({ nombre: d.name || 'Sin nombre' })
  },
  'document-types': {
    model: 'tipos_documento', idField: 'id',
    buscarEn: ['nombre', 'abreviatura'],
    orden: { defecto: 'name', campos: { name: 'nombre', abbreviation: 'abreviatura', id: 'id' } },
    transform: (r) => ({ id: r.id, name: r.nombre, abbreviation: r.abreviatura }),
    reverseTransform: async (d) => ({
      nombre: d.name || 'Sin nombre',
      abreviatura: d.abbreviation || d.abreviatura || (d.name ? d.name.substring(0, 3).toUpperCase() : 'NA')
    })
  },
  'airlines': {
    model: 'aerolineas', idField: 'id',
    buscarEn: ['nombre', 'codigo_iata'],
    orden: { defecto: 'name', campos: { name: 'nombre', code: 'codigo_iata', type: 'tipo', id: 'id' } },
    transform: (r) => ({ id: r.id, name: r.nombre, code: r.codigo_iata, type: r.tipo, website: r.web }),
    reverseTransform: async (d) => ({
      nombre: d.name || 'Sin nombre',
      codigo_iata: d.code,
      tipo: d.type === 'Nacional' ? 'Nacional' : (d.type === 'Ambos' ? 'Ambos' : 'Internacional'),
      web: d.website
    })
  },
  'suppliers': {
    model: 'proveedores', idField: 'id',
    buscarEn: ['nombre', 'email_contacto', 'telefono'],
    orden: { defecto: 'name', campos: { name: 'nombre', type: 'tipo', id: 'id' } },
    transform: (r) => ({ id: r.id, name: r.nombre, type: r.tipo, email: r.email_contacto, phone: r.telefono, website: r.web, observations: r.observaciones || '' }),
    reverseTransform: async (d) => ({
      nombre: d.name || 'Sin nombre',
      tipo: d.type,
      email_contacto: d.email,
      telefono: d.phone,
      web: d.website,
      observaciones: d.observations || d.observaciones || ''
    })
  },
  'airports': {
    model: 'aeropuertos', idField: 'id',
    buscarEn: ['nombre', 'ciudad', 'pais', 'codigo_iata'],
    orden: { defecto: 'name', campos: { name: 'nombre', abbreviation: 'codigo_iata', city: 'ciudad', type: 'tipo', status: 'status', id: 'id' } },
    transform: (r) => ({ id: r.id, name: r.nombre, abbreviation: r.codigo_iata, city: r.ciudad, country: r.pais, location: [r.ciudad, r.pais].filter(Boolean).join(', '), type: r.tipo, status: r.status === 'active' || r.status === 'Activo' ? 'Activo' : 'Inactivo' }),
    reverseTransform: async (d) => ({
      nombre: d.name || 'Sin nombre',
      codigo_iata: d.abbreviation || d.codigo_iata,
      ciudad: d.city || d.ciudad,
      pais: d.country || d.pais,
      tipo: d.type === 'Nacional' ? 'Nacional' : (d.type === 'Internacional' ? 'Internacional' : 'Ambos'),
      status: d.status === 'Inactivo' ? 'inactive' : 'active'
    })
  },
  'baggage': {
    model: 'politicas_equipaje', idField: 'id', include: { aerolineas: true },
    // La ruta con punto busca en la relación: `aerolineas.nombre`.
    buscarEn: ['tipo_tarifa', 'aerolineas.nombre'],
    orden: { defecto: 'airlineName', campos: { airlineName: 'aerolineas.nombre', fareType: 'tipo_tarifa', id: 'id' } },
    transform: (r) => ({ id: r.id, airlineName: r.aerolineas?.nombre || null, fareType: r.tipo_tarifa, personalItem: r.articulo_personal, carryOn: r.equipaje_mano, checkedBag: r.equipaje_bodega, notes: r.notas }),
    reverseTransform: async (d) => {
      // NUNCA caer en la aerolínea 1. Era `let airlineId = 1`, así que un
      // nombre que no casaba atribuía la política de equipaje a la primera
      // aerolínea del catálogo, en silencio y para siempre.
      let airlineId = Number(d.airlineId) || null;
      if (!airlineId && d.airlineName) {
        const a = await prisma.aerolineas.findFirst({ where: { nombre: d.airlineName } });
        if (a) airlineId = a.id;
      }
      if (!airlineId) {
        throw new BadRequestError(`No existe la aerolínea "${d.airlineName}" en el catálogo`);
      }
      return {
        aerolinea_id: airlineId,
        tipo_tarifa: d.fareType || 'N/A',
        articulo_personal: d.personalItem,
        equipaje_mano: d.carryOn,
        equipaje_bodega: d.checkedBag,
        notas: d.notes
      };
    }
  },
  'packages': {
    model: 'paquetes', idField: 'id',
    // `paquetes` es el único catálogo con borrado lógico.
    soloVigentes: { deleted_at: null },
    buscarEn: ['nombre', 'destino'],
    orden: { defecto: 'name', campos: { name: 'nombre', destination: 'destino', id: 'id' } },
    include: { paquete_hotel: true, paquete_tarifas: true, paquete_asistencia_medica: true, paquete_vuelo: { include: { aerolineas: true } }, paquete_proveedor: { include: { proveedores: true } } },
    // El listado solo necesita lo que se ve en la tabla y en el selector.
    // El include completo son 5 relaciones = 6 viajes a la base por consulta;
    // el detalle entero se pide con GET /config/packages/:id al elegir uno.
    listSelect: {
      id: true, nombre: true, destino: true,
      paquete_hotel: { select: { noches: true } },
      paquete_tarifas: { select: { tarifa_adulto: true, tarifa_menor: true } }
    },
    listTransform: (r) => ({
      id: r.id,
      name: r.nombre,
      destination: r.destino,
      nights: r.paquete_hotel?.[0]?.noches || null,
      rates: r.paquete_tarifas?.[0]
        ? { adult: r.paquete_tarifas[0].tarifa_adulto, child: r.paquete_tarifas[0].tarifa_menor }
        : undefined
    }),
    transform: (r) => ({
      id: r.id,
      name: r.nombre,
      destination: r.destino,
      nights: r.paquete_hotel?.[0]?.noches || null,
      includedServices: r.servicios_incluidos,
      notIncluded: r.no_incluido,
      accommodation: r.paquete_hotel?.[0] ? {
        hotel: r.paquete_hotel[0].hotel_nombre,
        supplier: r.paquete_proveedor?.[0]?.proveedores?.nombre,
        hotelType: r.paquete_hotel[0].tipo_hotel,
        mealPlan: r.paquete_hotel[0].regimen,
      } : undefined,
      flight: r.paquete_vuelo?.[0] ? {
        airline: r.paquete_vuelo[0].aerolineas?.nombre,
        route: r.paquete_vuelo[0].trayectos ? (typeof r.paquete_vuelo[0].trayectos === 'string' ? JSON.parse(r.paquete_vuelo[0].trayectos).route : r.paquete_vuelo[0].trayectos.route) : null,
        legs: r.paquete_vuelo[0].trayectos ? (typeof r.paquete_vuelo[0].trayectos === 'string' ? JSON.parse(r.paquete_vuelo[0].trayectos).legs : r.paquete_vuelo[0].trayectos.legs) : [],
        returnLeg: r.paquete_vuelo[0].trayectos ? (typeof r.paquete_vuelo[0].trayectos === 'string' ? JSON.parse(r.paquete_vuelo[0].trayectos).returnLeg : r.paquete_vuelo[0].trayectos.returnLeg) : null,
        baggagePlan: r.paquete_vuelo[0].plan_equipaje,
        transportType: r.paquete_vuelo[0].tipo_transporte
      } : undefined,
      rates: r.paquete_tarifas?.[0] ? {
        adult: r.paquete_tarifas[0].tarifa_adulto,
        child: r.paquete_tarifas[0].tarifa_menor,
      } : undefined,
      medicalAssistance: r.paquete_asistencia_medica ? {
        amountUsd: r.paquete_asistencia_medica.cobertura_usd,
        coverageDays: r.paquete_asistencia_medica.dias_cobertura
      } : undefined
    }),
    reverseTransform: async (d) => {
      let airlineId = null;
      if (d.flight?.airline) {
        const a = await prisma.aerolineas.findFirst({ where: { nombre: d.flight.airline } });
        if (a) airlineId = a.id;
      }
      let supplierId = null;
      if (d.accommodation?.supplier) {
        const s = await prisma.proveedores.findFirst({ where: { nombre: d.accommodation.supplier } });
        if (s) supplierId = s.id;
      }

      return {
        nombre: d.name || 'Sin nombre',
        destino: d.destination || 'N/A',
        servicios_incluidos: d.includedServices || '',
        no_incluido: d.notIncluded || '',
        creado_por_id: d.creado_por_id || 1,
        paquete_hotel: d.accommodation?.hotel ? {
          create: [{
            hotel_nombre: d.accommodation.hotel,
            noches: d.nights || 0,
            tipo_hotel: d.accommodation.hotelType || 'hotel',
            regimen: d.accommodation.mealPlan || 'solo_desayuno'
          }]
        } : undefined,
        paquete_vuelo: d.flight ? {
          create: [{
            aerolinea_id: airlineId,
            modo_vuelo: d.flight.flightMode || 'round_trip',
            trayectos: { route: d.flight.route, legs: d.flight.legs, returnLeg: d.flight.returnLeg },
            plan_equipaje: d.flight.baggagePlan,
            tipo_transporte: d.flight.transportType || 'Aereo'
          }]
        } : undefined,
        paquete_tarifas: d.rates ? {
          create: [{ tarifa_adulto: d.rates.adult || 0, tarifa_menor: d.rates.child || 0 }]
        } : undefined,
        paquete_asistencia_medica: d.medicalAssistance?.amountUsd ? {
          create: { cobertura_usd: d.medicalAssistance.amountUsd, dias_cobertura: d.medicalAssistance.coverageDays || 0 }
        } : undefined,
        paquete_proveedor: supplierId ? {
          create: [{ proveedor_id: supplierId }]
        } : undefined
      };
    }
  }
};

class ConfigService {
  /**
   * Un catálogo, paginado, buscado y ordenado.
   *
   * Reescrito por tres motivos:
   *
   * 1. **No había ORDER BY.** Se paginaba con skip/take sobre un orden que
   *    Postgres no garantiza, así que una fila podía salir en dos páginas o en
   *    ninguna. Ahora todas las consultas ordenan, y siempre desempatan por id.
   * 2. **La búsqueda era una cadena de if/else por nombre de sección**, con un
   *    `else` final que asumía que toda tabla tiene `nombre`. Ahora cada
   *    sección declara sus campos en `buscarEn`, al lado de su transform.
   * 3. **Devolvía dos formas distintas**: `{data, meta}` con paginación y un
   *    array pelado sin ella. Ahora siempre `{data, meta}`, con `buildMeta`,
   *    que es lo que usa el resto del repo.
   */
  async getSection(section, pagination = null, { search = '', sortBy, sortOrder } = {}) {
    const config = SECTION_MAP[section];
    if (!config) throw new NotFoundError('Sección no encontrada');

    const where = { ...(config.soloVigentes || {}) };

    if (search) {
      const como = { contains: search, mode: 'insensitive' };
      // Una ruta con punto ('aerolineas.nombre') busca dentro de la relación.
      where.OR = (config.buscarEn || []).map(campo => {
        const [rel, sub] = campo.split('.');
        return sub ? { [rel]: { [sub]: como } } : { [campo]: como };
      });
      if (where.OR.length === 0) delete where.OR;
    }

    const columnas = config.orden?.campos || { id: 'id' };
    if (sortBy && !columnas[sortBy]) {
      throw new BadRequestError(
        `Orden inválido para ${section}: ${sortBy}. Válidos: ${Object.keys(columnas).join(', ')}`
      );
    }
    const sentido = sortOrder ? String(sortOrder).toLowerCase() : 'asc';
    if (sentido !== 'asc' && sentido !== 'desc') {
      throw new BadRequestError(`Sentido de orden inválido: ${sortOrder}. Válidos: asc, desc`);
    }

    // El desempate por id va siempre al final: sin él, dos filas con el mismo
    // valor en la columna de orden pueden cambiar de sitio entre páginas.
    const columna = columnas[sortBy || config.orden?.defecto] || 'id';
    const [rel, sub] = columna.split('.');
    const orderBy = [
      sub ? { [rel]: { [sub]: sentido } } : { [columna]: sentido },
      { id: 'asc' },
    ];

    // select e include son excluyentes en Prisma: si hay listSelect, manda.
    const proyeccion = config.listSelect
      ? { select: config.listSelect }
      : (config.include ? { include: config.include } : {});
    const transformar = config.listSelect ? config.listTransform : config.transform;

    const { page = 1, perPage = 20, skip = 0 } = pagination || {};
    const [total, rows] = await Promise.all([
      prisma[config.model].count({ where }),
      prisma[config.model].findMany({ where, ...proyeccion, orderBy, skip, take: perPage }),
    ]);

    return { data: rows.map(transformar), meta: buildMeta(total, page, perPage) };
  }

  // Un elemento con su detalle completo. Es lo que se pide al seleccionar algo
  // en un listado ligero (un paquete en el formulario de planes, por ejemplo).
  async getItem(section, id) {
    const config = SECTION_MAP[section];
    if (!config) throw new NotFoundError('Sección no encontrada');

    // `findFirst`, no `findUnique`: hace falta poder añadir el filtro de
    // vigencia de los paquetes, que tienen borrado lógico.
    const row = await prisma[config.model].findFirst({
      where: { [config.idField]: Number(id), ...(config.soloVigentes || {}) },
      include: config.include
    });
    if (!row) throw new NotFoundError('Elemento no encontrado');
    return config.transform(row);
  }

  // Catálogos que los selectores necesitan desde el primer render.
  // 'packages' queda fuera a propósito: son 5 relaciones anidadas por fila y
  // solo lo usa el formulario de planes, que lo pide por su cuenta.
  static SECCIONES_ARRANQUE = [
    'cards', 'payment-methods', 'document-types',
    'airlines', 'suppliers', 'airports', 'baggage'
  ];

  async getAll({ sections } = {}) {
    // El cliente puede pedir un subconjunto con ?sections=airlines,suppliers
    const pedidas = Array.isArray(sections) && sections.length
      ? sections.filter(s => SECTION_MAP[s])
      : ConfigService.SECCIONES_ARRANQUE;

    // Las secciones son independientes: se piden en paralelo.
    //
    // Los selectores necesitan el catálogo COMPLETO, no una página: se pide con
    // un perPage alto explícito en vez de apoyarse en que `getSection` devuelva
    // todo cuando no se le pasa paginación, que era la ambigüedad que hacía que
    // el mismo método devolviera dos formas distintas.
    const rows = await Promise.all(
      pedidas.map(s => this.getSection(s, { page: 1, perPage: 500, skip: 0 }))
    );
    return Object.fromEntries(pedidas.map((s, i) => [s, rows[i].data]));
  }

  async createItem(section, data) {
    const config = SECTION_MAP[section];
    if (!config) throw new NotFoundError('Sección no encontrada');

    let createData;
    if (config.reverseTransform) {
      createData = await config.reverseTransform(data);
    } else {
      createData = { ...data };
      delete createData.id;
    }

    const created = await prisma[config.model].create({
      data: createData,
      include: config.include
    });

    return config.transform(created);
  }

  async updateItem(section, id, data) {
    const config = SECTION_MAP[section];
    if (!config) throw new NotFoundError('Sección no encontrada');

    let updateData;
    if (config.reverseTransform) {
      updateData = await config.reverseTransform(data);
      // For packages and other complex updates, we need to clean up old relations before creating new ones
      if (section === 'packages') {
        await prisma.paquete_hotel.deleteMany({ where: { paquete_id: Number(id) } });
        await prisma.paquete_vuelo.deleteMany({ where: { paquete_id: Number(id) } });
        await prisma.paquete_tarifas.deleteMany({ where: { paquete_id: Number(id) } });
        await prisma.paquete_asistencia_medica.deleteMany({ where: { paquete_id: Number(id) } });
        await prisma.paquete_proveedor.deleteMany({ where: { paquete_id: Number(id) } });
      }
    } else {
      updateData = { ...data };
      delete updateData.id;
    }

    const updated = await prisma[config.model].update({
      where: { [config.idField]: Number(id) },
      data: updateData,
      include: config.include
    });

    return config.transform(updated);
  }

  async deleteItem(section, id) {
    const config = SECTION_MAP[section];
    if (!config) throw new NotFoundError('Sección no encontrada');

    if (section === 'packages') {
      await prisma.paquete_hotel.deleteMany({ where: { paquete_id: Number(id) } });
      await prisma.paquete_vuelo.deleteMany({ where: { paquete_id: Number(id) } });
      await prisma.paquete_tarifas.deleteMany({ where: { paquete_id: Number(id) } });
      await prisma.paquete_asistencia_medica.deleteMany({ where: { paquete_id: Number(id) } });
      await prisma.paquete_proveedor.deleteMany({ where: { paquete_id: Number(id) } });
    }

    await prisma[config.model].delete({
      where: { [config.idField]: Number(id) }
    });
    return true;
  }
}

module.exports = new ConfigService();
