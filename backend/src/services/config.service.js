const prisma = require('../config/db');
const { NotFoundError, BadRequestError } = require('../errors/AppError');

const SECTION_MAP = {
  'cards': {
    model: 'tarjetas_agencia', idField: 'id', include: { metodos_pago: true },
    transform: (r) => ({ id: r.id, name: r.nombre, paymentMethod: r.metodos_pago?.nombre || null, lastFourDigits: r.ultimos_cuatro, description: r.descripcion, status: r.status === 'active' || r.status === 'Activo' ? 'Activo' : 'Inactivo' }),
    reverseTransform: async (d) => {
      let methodId = null;
      if (d.paymentMethod) {
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
    transform: (r) => ({ id: r.id, name: r.nombre }),
    reverseTransform: async (d) => ({ nombre: d.name || 'Sin nombre' })
  },
  'document-types': {
    model: 'tipos_documento', idField: 'id',
    transform: (r) => ({ id: r.id, name: r.nombre, abbreviation: r.abreviatura }),
    reverseTransform: async (d) => ({
      nombre: d.name || 'Sin nombre',
      abreviatura: d.abbreviation || d.abreviatura || (d.name ? d.name.substring(0, 3).toUpperCase() : 'NA')
    })
  },
  'airlines': {
    model: 'aerolineas', idField: 'id',
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
    transform: (r) => ({ id: r.id, airlineName: r.aerolineas?.nombre || null, fareType: r.tipo_tarifa, personalItem: r.articulo_personal, carryOn: r.equipaje_mano, checkedBag: r.equipaje_bodega, notes: r.notas }),
    reverseTransform: async (d) => {
      let airlineId = 1;
      if (d.airlineName) {
        const a = await prisma.aerolineas.findFirst({ where: { nombre: d.airlineName } });
        if (a) airlineId = a.id;
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
    include: { paquete_hotel: true, paquete_tarifas: true, paquete_asistencia_medica: true, paquete_vuelo: { include: { aerolineas: true } }, paquete_proveedor: { include: { proveedores: true } } },
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
        baggagePlan: r.paquete_vuelo[0].plan_equipaje
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
            plan_equipaje: d.flight.baggagePlan
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
  async getSection(section) {
    const config = SECTION_MAP[section];
    if (!config) throw new NotFoundError('Sección no encontrada');

    const queryOptions = {};
    if (config.include) queryOptions.include = config.include;

    const rows = await prisma[config.model].findMany(queryOptions);
    return rows.map(config.transform);
  }

  async getAll() {
    const sections = Object.keys(SECTION_MAP);
    const result = {};
    for (const section of sections) {
      result[section] = await this.getSection(section);
    }
    return result;
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
