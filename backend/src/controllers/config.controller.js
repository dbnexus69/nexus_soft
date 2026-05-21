const prisma = require('../config/db');
const { success, error } = require('../utils/apiResponse');

const SECTION_MAP = {
  'cards': { model: 'tarjetasAgencia', idField: 'id' },
  'payment-methods': { model: 'metodosPago', idField: 'id' },
  'document-types': { model: 'tiposDocumento', idField: 'id' },
  'airlines': { model: 'aerolineas', idField: 'id' },
  'suppliers': { model: 'proveedores', idField: 'id' },
  'airports': { model: 'aeropuertos', idField: 'id' },
  'baggage': { model: 'politicasEquipaje', idField: 'id', include: { aerolinea: true } },
  'packages': { model: 'paquetes', idField: 'id', include: { paqueteHotel: true, paqueteTarifas: true, paqueteAsistenciaMedica: true } },
};

exports.getAll = async (req, res, next) => {
  try {
    const entries = Object.entries(SECTION_MAP);
    const results = await Promise.all(
      entries.map(([, config]) =>
        prisma[config.model].findMany({ include: config.include || undefined })
      )
    );
    const data = {};
    entries.forEach(([key], i) => {
      data[key] = results[i];
    });
    success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.getSection = async (req, res, next) => {
  try {
    const { section } = req.params;
    const config = SECTION_MAP[section];
    if (!config) return error(res, `Sección "${section}" no válida`, 400);

    const sectionData = await prisma[config.model].findMany({
      include: config.include || undefined
    });

    success(res, sectionData);
  } catch (err) {
    next(err);
  }
};

exports.createItem = async (req, res, next) => {
  try {
    const { section } = req.params;
    const config = SECTION_MAP[section];
    if (!config) return error(res, `Sección "${section}" no válida`, 400);

    const item = await prisma[config.model].create({
      data: { ...req.body }
    });

    success(res, item, null, 201);
  } catch (err) {
    next(err);
  }
};

exports.updateItem = async (req, res, next) => {
  try {
    const { section, id } = req.params;
    const config = SECTION_MAP[section];
    if (!config) return error(res, `Sección "${section}" no válida`, 400);

    const item = await prisma[config.model].update({
      where: { [config.idField]: parseInt(id) },
      data: { ...req.body }
    });

    success(res, item);
  } catch (err) {
    next(err);
  }
};

exports.removeItem = async (req, res, next) => {
  try {
    const { section, id } = req.params;
    const config = SECTION_MAP[section];
    if (!config) return error(res, `Sección "${section}" no válida`, 400);

    await prisma[config.model].delete({
      where: { [config.idField]: parseInt(id) }
    });

    success(res, { message: 'Elemento eliminado' });
  } catch (err) {
    next(err);
  }
};
