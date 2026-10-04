const prisma = require('../config/db');
const { NotFoundError, ForbiddenError } = require('../errors/AppError');

/**
 * La venta, comprobada contra el alcance de quien pide.
 *
 * El alcance solo se aplicaba al LEER. `listSales` y la cartera filtran por
 * `usuario_id` cuando el permiso de ver es 'own', pero ninguna mutación miraba
 * nada: con la venta de otro en la URL se podía cobrar, anular, editar y
 * borrar. Leer una venta por su id tampoco se comprobaba, así que la lista
 * ocultaba lo que la URL directa enseñaba.
 *
 * Hoy no cambia nada en la práctica —ningún rol tiene el alcance en 'own' en
 * la base—, y ese es justamente el momento de cerrarlo: el día que alguien lo
 * ponga desde la pantalla de permisos, tiene que valer para todo y no solo
 * para los listados.
 *
 * `leer` responde 404 y `escribir` 403, igual que en vuelos: al leer no se
 * confirma que exista la venta de otro; al escribir, quien lo intenta ya sabe
 * que existe porque tiene su id.
 */
/**
 * Sobre qué ventas puede actuar. Es el alcance de VER, no el de la acción
 * pedida: las acciones de escritura son booleanas y no tienen alcance, así que
 * mirar el de la acción dejaba pasar todas las mutaciones.
 */
const soloLasSuyas = (alcance = {}) =>
  (alcance.viewScope || alcance.permissionScope) === 'own' && Boolean(alcance.user);

function esDeOtro(venta, alcance = {}) {
  return soloLasSuyas(alcance) && venta.usuario_id !== alcance.user.id;
}

async function ventaVisible(id, alcance = {}, { paraEscribir = false } = {}) {
  const where = { id: Number(id), deleted_at: null };
  if (!paraEscribir && soloLasSuyas(alcance)) {
    where.usuario_id = alcance.user.id;
  }
  const venta = await prisma.ventas.findFirst({ where });
  if (!venta) throw new NotFoundError('Venta no encontrada');
  if (paraEscribir && esDeOtro(venta, alcance)) {
    throw new ForbiddenError('No puede modificar una venta de otro asesor');
  }
  return venta;
}

module.exports = { soloLasSuyas, esDeOtro, ventaVisible };
