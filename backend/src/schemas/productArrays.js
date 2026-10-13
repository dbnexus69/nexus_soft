const { z } = require('zod');
const { SLUGS, CATALOG } = require('../catalog/products');
const { esquemaDeCategoria } = require('./products.schema');

/**
 * Un campo por categoría —`ticketData`, `hotelData`...—, cada uno validado con el
 * esquema de su categoría (dinero no negativo, forma de pasajeros y tramos, enums).
 *
 * Lo usan por igual el cuerpo de una venta (`sales.schema.js`) y el de una cotización
 * (`quotes.schema.js`, spec 007): las claves salen del catálogo, así que añadir una
 * categoría no obliga a tocar ninguno de los dos.
 *
 * `relajado`: una cotización no es una venta — nada es obligatorio en ella (ni el
 * costo del proveedor), eso se exige recién al convertirla (`sales.schema.js` nunca
 * pasa esta opción). Ver `products.schema.js::esquemaDeCategoria`.
 */
function productArrays({ max = 50, mensajeMax = 'Demasiados productos de este tipo', relajado = false } = {}) {
  return Object.fromEntries(
    SLUGS.map(slug => [
      CATALOG[slug].responseKey,
      z.array(esquemaDeCategoria(slug, { relajado })).max(max, mensajeMax).optional(),
    ])
  );
}

module.exports = { productArrays };
