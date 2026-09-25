class AppError extends Error {
  /**
   * `details` viaja tal cual en `error.details`: la lista `[{ field, message }]`
   * de siempre, con un `value` cuando la pantalla necesita la cifra además del
   * texto (por ejemplo, el acumulado actual en un 409 de liquidación).
   */
  constructor(message, statusCode = 400, code = 'BAD_REQUEST', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(message, 404, 'NOT_FOUND');
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Petición inválida', code = 'BAD_REQUEST', details = null) {
    super(message, 400, code, details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'No autorizado') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Acceso prohibido') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflicto con recurso existente', code = 'CONFLICT', details = null) {
    super(message, 409, code, details);
  }
}

module.exports = {
  AppError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError
};
