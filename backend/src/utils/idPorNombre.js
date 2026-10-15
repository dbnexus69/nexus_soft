const prisma = require('../config/db');
const { AppError } = require('../errors/AppError');

/**
 * Id de una fila de catálogo (método de pago, aerolínea, proveedor) a partir de su nombre,
 * recortado y sin distinguir mayúsculas. Un nombre que no existe es un 422 con su campo,
 * no una clave vacía guardada en silencio (spec 002, T14).
 */
async function idPorNombre(modelo, nombre, field) {
  const texto = String(nombre).trim();
  const fila = await prisma[modelo].findFirst({
    where: { nombre: { equals: texto, mode: 'insensitive' } },
    select: { id: true },
  });
  if (!fila) {
    const message = `No existe "${texto}"`;
    throw new AppError(`Datos inválidos: ${field}: ${message}`, 422, 'VALIDATION_ERROR', [{ field, message }]);
  }
  return fila.id;
}

module.exports = { idPorNombre };
