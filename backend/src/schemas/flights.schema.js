const { z } = require('zod');

/**
 * Cancelación del check-in de un tramo.
 *
 * El motivo es obligatorio: cancelar sin dejar constancia de por qué convierte
 * el estado en un dato inútil para auditar. `trim` antes de medir, para que
 * cinco espacios no cuenten como cinco caracteres. El tope de 255 es el de la
 * columna: sin él, un texto más largo fallaría en la base con un error opaco.
 */
const cancelCheckinSchema = z.object({
  reasonCanceled: z
    .string({ required_error: 'El motivo de la cancelación es obligatorio' })
    .trim()
    .min(5, 'El motivo debe tener al menos 5 caracteres')
    .max(255, 'El motivo no puede pasar de 255 caracteres'),
});

module.exports = { cancelCheckinSchema };
