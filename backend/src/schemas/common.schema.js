const { z } = require('zod');

/** Una fecha aceptable en un parámetro de query: cualquier cosa que Date entienda. */
const fechaQuery = z
  .string()
  .refine(v => !Number.isNaN(new Date(v).getTime()), 'No es una fecha válida')
  .optional();

/**
 * Rango de fechas por query, usado por ventas, vuelos, comisiones y estadísticas.
 *
 * `passthrough` es obligatorio: este schema solo mira las dos fechas y el resto
 * del query (page, perPage, search, status...) tiene que seguir llegando.
 *
 * Comprueba además que el rango tenga sentido. Un `dateFrom` posterior al
 * `dateTo` no es un error de base de datos: devuelve cero filas en silencio y
 * quien mira la pantalla no sabe por qué está vacía.
 */
const dateRangeSchema = z
  .object({ dateFrom: fechaQuery, dateTo: fechaQuery })
  .passthrough()
  .refine(
    q => !q.dateFrom || !q.dateTo || new Date(q.dateFrom) <= new Date(q.dateTo),
    { message: 'La fecha inicial no puede ser posterior a la final', path: ['dateFrom'] }
  );

module.exports = { dateRangeSchema };
