const { error } = require('../utils/apiResponse');

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
      return error(res, `Datos inválidos: ${messages.join('; ')}`, 400, 'VALIDATION_ERROR');
    }
    req.validatedBody = result.data;
    next();
  };
}

module.exports = { validate };
