const prisma = require('../config/db');
const { NotFoundError, ForbiddenError } = require('../errors/AppError');

// Mismo patrón que `ventasAlcance.js`: el alcance es el de VER, no el de la acción
// pedida (las acciones de escritura son booleanas y no tienen alcance).
const soloLasSuyas = (alcance = {}) =>
  (alcance.viewScope || alcance.permissionScope) === 'own' && Boolean(alcance.user);

function esDeOtro(cotizacion, alcance = {}) {
  return soloLasSuyas(alcance) && cotizacion.usuario_id !== alcance.user.id;
}

/**
 * La cotización, comprobada contra el alcance de quien pide.
 *
 * `leer` responde 404 y `escribir` 403, igual que en ventas: al leer no se
 * confirma que exista la cotización de otro; al escribir, quien lo intenta ya
 * sabe que existe porque tiene su id.
 */
async function cotizacionVisible(id, alcance = {}, { paraEscribir = false } = {}) {
  const where = { id: Number(id), deleted_at: null };
  if (!paraEscribir && soloLasSuyas(alcance)) {
    where.usuario_id = alcance.user.id;
  }
  const cotizacion = await prisma.cotizaciones.findFirst({ where });
  if (!cotizacion) throw new NotFoundError('Cotización no encontrada');
  if (paraEscribir && esDeOtro(cotizacion, alcance)) {
    throw new ForbiddenError('No puede modificar una cotización de otro asesor');
  }
  return cotizacion;
}

module.exports = { soloLasSuyas, esDeOtro, cotizacionVisible };
