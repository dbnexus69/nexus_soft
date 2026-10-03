const { z } = require('zod');
const {
  nombre, numeroDocumentoOpcional, tipoDocumentoPorTexto, idTipoDocumento, telefono, nacimiento, tipoYNumeroJuntos,
} = require('./personaCampos');

// El contrato del tipo de documento es `docTypeId` (el id de `tipos_documento`); `docType` sigue
// aceptando la abreviatura o el nombre de antes. Las reglas de personas, en ./personaCampos.
const campos = {
  docTypeId: idTipoDocumento,
  docType: tipoDocumentoPorTexto,
  docNumber: numeroDocumentoOpcional,
  phone: telefono,
  email: z.string().email('Email inválido').nullable().optional().or(z.literal('')),
  birth_date: nacimiento,
};

const createResponsableSchema = z.object({
  firstName: nombre,
  lastName: nombre,
  ...campos,
}).superRefine(tipoYNumeroJuntos);

const updateResponsableSchema = z.object({
  firstName: nombre.optional(),
  lastName: nombre.optional(),
  ...campos,
  status: z.string().optional()
}).superRefine(tipoYNumeroJuntos);

module.exports = {
  createResponsableSchema,
  updateResponsableSchema
};
