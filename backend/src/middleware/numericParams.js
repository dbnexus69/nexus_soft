const { BadRequestError } = require('../errors/AppError');

/** Tope de `integer` en Postgres. Por encima, Prisma revienta con un 500. */
const MAX_INT4 = 2147483647;

/**
 * Declara qué parámetros de ruta de un router son enteros.
 *
 * El problema que resuelve: los controladores hacían `parseInt(req.params.id)`
 * y pasaban el resultado a Prisma. Con un id no numérico eso es `NaN`, y una
 * consulta con `where: { id: NaN }` acaba en un 500 con una traza de Prisma
 * ilegible. Se encontró tecleando `/api/sales/credit-portfolio`, que cae en
 * `/sales/:id` y devolvía "Error interno del servidor" en lugar de decir que el
 * identificador no vale. Un dato mal formado del cliente es un 400.
 *
 * Se usa `router.param`, que Express ejecuta antes del manejador y solo en las
 * rutas de ese router que llevan el parámetro. Así queda declarado una vez por
 * router en lugar de repetir la comprobación en los 24 sitios que hacían
 * `parseInt`, y esos `parseInt` dejan de poder producir `NaN`.
 *
 * NO se aplica a los identificadores que son uuid —los tramos de vuelo, los
 * pagos, los productos—: ahí un valor no numérico es lo normal.
 */
function paramsNumericos(router, ...nombres) {
  for (const nombre of nombres) {
    router.param(nombre, (req, res, next, valor) => {
      const texto = String(valor);

      if (!/^\d+$/.test(texto)) {
        return next(new BadRequestError(
          `El parámetro ${nombre} debe ser un número entero, y se recibió "${texto}"`,
          'INVALID_PARAM',
        ));
      }

      // Un número correcto pero fuera de rango también acaba en 500 si llega a
      // Prisma, así que se corta aquí con el mismo criterio.
      if (Number(texto) > MAX_INT4) {
        return next(new BadRequestError(
          `El parámetro ${nombre} está fuera de rango: ${texto}`,
          'INVALID_PARAM',
        ));
      }

      next();
    });
  }
}

module.exports = { paramsNumericos, MAX_INT4 };
