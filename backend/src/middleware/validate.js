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

module.exports = { validate };
