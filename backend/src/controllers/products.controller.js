const fs = require('fs/promises');
const path = require('path');
const prisma = require('../config/db');
const { success } = require('../utils/apiResponse');
const { BadRequestError, ForbiddenError, NotFoundError } = require('../errors/AppError');

/**
 * Los productos de una venta se crean con ella, en un solo `POST /sales`: el
 * asistente arma el borrador en el navegador y lo manda entero, y el backend lo
 * escribe en una transacción. Aquí ya no hay alta, edición ni baja de productos
 * sueltos: ninguna pantalla las usaba, obligaban a mantener una segunda copia de
 * cada transform de categoría y dejaban caminos a medias (el PUT de un tiquete
 * ignoraba sus tramos). Se retiraron en la spec 002 (T8).
 *
 * Lo que queda es el voucher de un producto: un archivo, que no viaja dentro del
 * JSON de la venta. El navegador lo sube justo después del 201, a la línea que
 * `POST /sales` le devuelve.
 */

const CARPETA = path.join(__dirname, '../../uploads');

/** Borra un fichero de `uploads/` sin fallar si ya no está. */
async function borrarFichero(ruta) {
  if (!ruta) return;
  await fs.unlink(path.join(CARPETA, path.basename(ruta))).catch(() => {});
}

/**
 * La venta a la que pertenece el producto.
 *
 * `deleted_at: null`: una venta eliminada no aparece en ningún listado y no se
 * toca. Y con el alcance de quien pide: si su permiso de ver ventas es 'own', no
 * puede tocar la venta de otro. Es el alcance de VER, no el de la acción:
 * `create` y `edit` son booleanas y no llevan alcance.
 */
async function getSale(saleId, req) {
  const id = parseInt(saleId);
  const venta = await prisma.ventas.findFirst({ where: { id, deleted_at: null } });
  if (!venta) return null;
  if (req?.viewScope === 'own' && req.user && venta.usuario_id !== req.user.id) {
    throw new ForbiddenError('No puede modificar una venta de otro asesor');
  }
  return venta;
}

/**
 * PUT /sales/:saleId/products/:detalleId/voucher — sube o reemplaza el voucher
 * de un producto. PUT porque reemplaza: repetirlo deja el mismo estado, igual
 * que el logo de una agencia.
 *
 * - El producto tiene que ser de la venta de la URL (T9). Antes se buscaba solo
 *   por su id: con el id de una venta propia se podía escribir en la línea de
 *   cualquier otra de la agencia. Un producto de otra venta responde 404, igual
 *   que uno que no existe.
 * - `multer` escribe el fichero antes de que esto decida. Si se rechaza, se
 *   borra: si no, cada rechazo dejaba un huérfano en `uploads/`.
 * - El voucher anterior se borra al reemplazarlo, para que la carpeta no acabe
 *   siendo un archivo de todos los que tuvo.
 */
exports.uploadVoucher = async (req, res, next) => {
  try {
    if (!req.file) throw new BadRequestError('Falta el archivo del voucher (campo "file")');

    const venta = await getSale(req.params.saleId, req);
    const linea = venta && await prisma.detalle_venta.findFirst({
      where: { id: req.params.detalleId, venta_id: venta.id },
      select: { id: true, voucher_url: true },
    });
    if (!linea) throw new NotFoundError('Producto no encontrado en esta venta');

    const voucher_url = `/uploads/${req.file.filename}`;
    await prisma.detalle_venta.update({ where: { id: linea.id }, data: { voucher_url } });
    if (linea.voucher_url && linea.voucher_url !== voucher_url) await borrarFichero(linea.voucher_url);

    success(res, { detalleId: linea.id, voucher_url });
  } catch (err) {
    if (req.file) await borrarFichero(req.file.filename);
    next(err);
  }
};
