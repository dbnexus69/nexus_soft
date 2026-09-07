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
 * pagos, los productos—: ésos van con `paramsUuid`.
 *
 * **Ojo con el nombre del parámetro.** `router.param` se aplica a TODO el
 * router, no a la ruta donde se declara. Las rutas de producto usaban `:id`
 * para el uuid del producto y este middleware las rompió enteras —400 en cada
 * PUT y cada DELETE— hasta que pasaron a llamarse `:productId`. Si un router
 * mezcla ids enteros y uuid, tienen que tener nombres distintos.
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

/**
 * Igual, para los identificadores que son uuid.
 *
 * Sin esto, `/sales/18/payments/no-es-un-uuid` acababa en la base buscando esa
 * cadena para devolver 404: un 404 dice "no existe", cuando lo que pasa es que
 * el identificador no tiene forma de identificador. Y en las tablas donde el
 * id es `text` sin índice utilizable para el valor, el 404 se pagaba con un
 * recorrido de tabla por cada petición mal formada.
 *
 * Se acepta el uuid con o sin guiones, que es como lo emiten distintos
 * clientes, y el id compuesto de los vuelos de plan (`plan:<uuid>:ida`), que
 * es un identificador válido de este API.
 */
const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
const ID_VUELO_PLAN = /^plan:[0-9a-f-]{32,36}:(ida|regreso)$/i;

function paramsUuid(router, ...nombres) {
  for (const nombre of nombres) {
    router.param(nombre, (req, res, next, valor) => {
      const texto = String(valor);
      if (!UUID.test(texto) && !ID_VUELO_PLAN.test(texto)) {
        return next(new BadRequestError(
          `El parámetro ${nombre} no es un identificador válido: "${texto}"`,
          'INVALID_PARAM',
        ));
      }
      next();
    });
  }
}

module.exports = { paramsNumericos, paramsUuid, MAX_INT4, UUID };
