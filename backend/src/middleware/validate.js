const { error } = require('../utils/apiResponse');

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      // 422: la petición está bien formada pero no pasa las reglas del recurso.
      // Los errores van por campo para que el cliente los pinte junto a su input.
      const details = result.error.issues.map(i => ({
        field: i.path.join('.') || '(raíz)',
        message: i.message,
      }));
      const resumen = details.map(d => `${d.field}: ${d.message}`).join('; ');
      return error(res, `Datos inválidos: ${resumen}`, 422, 'VALIDATION_ERROR', details);
    }
    req.validatedBody = result.data;
    next();
  };
}

/**
 * Igual que `validate`, pero sobre `req.query`.
 *
 * Los parámetros de query no se validaban en ninguna parte: una fecha inválida
 * llegaba al servicio, que hacía `new Date(valor)` y acababa en un 500 ilegible
 * —un RangeError de `toISOString()` o un error de Prisma sobre un Invalid Date—.
 * Un dato mal formado del cliente es un 422 con el campo señalado, no un 500.
 *
 * El schema debe llevar `.passthrough()`: aquí solo se comprueban las claves
 * declaradas y el resto del query tiene que seguir llegando intacto.
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.issues.map(i => ({
        field: i.path.join('.') || '(raíz)',
        message: i.message,
      }));
      const resumen = details.map(d => `${d.field}: ${d.message}`).join('; ');
      return error(res, `Parámetros inválidos: ${resumen}`, 422, 'VALIDATION_ERROR', details);
    }
    next();
  };
}

module.exports = { validate, validateQuery };
