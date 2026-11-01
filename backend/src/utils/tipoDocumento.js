const prisma = require('../config/db');
const { AppError } = require('../errors/AppError');
const { mensajeDocumento, normalizarDocumento } = require('./datosPersona');

// Errores que la pantalla pinta junto a su campo (`error.details`).
const invalido = (field, message) => new AppError(
  `Datos inválidos: ${field}: ${message}`, 422, 'VALIDATION_ERROR', [{ field, message }],
);

/**
 * El tipo de documento que pide el cuerpo, o null si no pide ninguno.
 *
 * El contrato es el `docTypeId`: las pantallas eligen el tipo de la lista que
 * trae la base (`tipos_documento`) y mandan su id, así que no hay texto que
 * pueda no coincidir. `docType` se sigue aceptando —por abreviatura (`CC`) o por
 * nombre ("Cédula de Ciudadanía")— para los clientes y las rutas anteriores.
 * Un tipo que no existe es un 422 con su campo, nunca un `null` en silencio.
 */
async function resolverTipoDocumento({ docTypeId, docType } = {}) {
  if (docTypeId !== undefined && docTypeId !== null && docTypeId !== '') {
    const tipo = await prisma.tipos_documento.findUnique({ where: { id: Number(docTypeId) } });
    if (!tipo) throw invalido('docTypeId', 'No existe ese tipo de documento');
    return tipo;
  }
  if (docType) {
    const texto = String(docType).trim();
    const tipo = await prisma.tipos_documento.findFirst({
      where: { OR: [{ abreviatura: texto.toUpperCase() }, { nombre: { equals: texto, mode: 'insensitive' } }] },
    });
    if (!tipo) throw invalido('docType', 'No existe ese tipo de documento');
    return tipo;
  }
  return null;
}

/** Aplica la regla del número según el tipo resuelto. Espera el número ya normalizado. */
function comprobarNumeroDeDocumento(tipo, docNumber) {
  const mensaje = mensajeDocumento(tipo.abreviatura, docNumber);
  if (mensaje) throw invalido('docNumber', mensaje);
}

/**
 * Resuelve el tipo y comprueba el número contra él. Devuelve el tipo (o null si
 * el cuerpo no trae documento). El esquema ya garantiza que tipo y número viajan juntos.
 */
async function validarDocumento({ docTypeId, docType, docNumber }) {
  const tipo = await resolverTipoDocumento({ docTypeId, docType });
  if (tipo && docNumber) comprobarNumeroDeDocumento(tipo, docNumber);
  return tipo;
}

/**
 * Las columnas `tipo_documento_id`/`documento` de un registro que no es una persona —un proveedor (spec 037)—
 * a partir del cuerpo crudo, que el esquema ya validó (tipo y número juntos):
 * - sin campos o vacíos → `{}`: no se tocan (editar sin cambiar el documento);
 * - `null` en los dos → se limpian;
 * - con valor → mismas reglas que una persona (`validarDocumento`); el 422 nombra `docTypeId`/`docNumber`.
 */
async function columnasDeDocumento({ docTypeId, docNumber }) {
  if (docTypeId === null && docNumber === null) return { tipo_documento_id: null, documento: null };
  const vacio = (v) => v === undefined || v === null || String(v).trim() === '';
  if (vacio(docTypeId) && vacio(docNumber)) return {};
  const documento = normalizarDocumento(String(docNumber ?? ''));
  const tipo = await validarDocumento({ docTypeId, docNumber: documento });
  return { tipo_documento_id: tipo.id, documento };
}

module.exports = { resolverTipoDocumento, comprobarNumeroDeDocumento, validarDocumento, columnasDeDocumento };
