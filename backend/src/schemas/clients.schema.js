const { z } = require('zod');
const {
  normalizarDocumento, mensajeDocumento,
  normalizarNombre, mensajeNombre,
  mensajeTelefono, mensajeNacimiento,
} = require('../utils/datosPersona');
const { idTipoDocumento, tipoDocumentoPorTexto } = require('./personaCampos');

// Las reglas viven en utils/datosPersona.js; aquí solo se cablean. El servicio recibe `req.validatedBody`, ya normalizado.

const validar = (mensaje) => (valor, ctx) => {
  const m = mensaje(valor);
  if (m) ctx.addIssue({ code: z.ZodIssueCode.custom, message: m });
};

// El formulario manda '' o null para "no puesto".
const vacioAUndefined = (v) => (v === '' || v === null ? undefined : v);

const nombre = z
  .string({ required_error: 'Obligatorio', invalid_type_error: 'Obligatorio' })
  .transform(normalizarNombre)
  .superRefine(validar(mensajeNombre));

const numeroDocumento = z
  .string({ required_error: 'El número de documento es obligatorio', invalid_type_error: 'El número de documento es obligatorio' })
  .transform(normalizarDocumento);

const campos = {
  firstName: nombre,
  lastName: nombre,
  // El contrato es `docTypeId` (el id de `tipos_documento`); `docType` (abreviatura o nombre) sigue valiendo.
  docTypeId: idTipoDocumento,
  docType: tipoDocumentoPorTexto,
  docNumber: numeroDocumento,
  email: z.preprocess(vacioAUndefined, z.string().trim().toLowerCase().max(180, 'Máximo 180 caracteres').email('Email inválido').optional()),
  phone: z.preprocess(vacioAUndefined, z.string().trim().superRefine(validar(mensajeTelefono)).optional()),
  birthDate: z.preprocess(vacioAUndefined, z.string().superRefine(validar(mensajeNacimiento)).optional()),
  avatar: z.string().nullable().optional(),
};

// El número solo se puede juzgar sabiendo el tipo: por eso viajan juntos.
// Con el tipo por id, la regla del número la aplica el servicio (necesita la base para saber la abreviatura).
function tipoYNumeroJuntos(d, ctx) {
  const hayTipo = d.docType !== undefined || d.docTypeId !== undefined;
  const hayNumero = d.docNumber !== undefined;
  if (!hayTipo && !hayNumero) return;
  if (hayTipo !== hayNumero) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [hayTipo ? 'docNumber' : 'docTypeId'],
      message: 'El tipo y el número de documento se envían juntos',
    });
    return;
  }
  if (d.docTypeId === undefined) {
    const m = mensajeDocumento(d.docType, d.docNumber);
    if (m) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['docNumber'], message: m });
  }
}

// Un cliente nuevo lleva siempre documento: si falta el tipo, el número o los dos, se dice cada uno.
function conDocumento(d, ctx) {
  let falta = false;
  if (d.docNumber === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['docNumber'], message: 'El número de documento es obligatorio' });
    falta = true;
  }
  if (d.docType === undefined && d.docTypeId === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['docTypeId'], message: 'Seleccione el tipo de documento' });
    falta = true;
  }
  if (!falta) tipoYNumeroJuntos(d, ctx);
}

const createClientSchema = z.object({ ...campos, docNumber: numeroDocumento.optional() }).superRefine(conDocumento);

const updateClientSchema = z.object(campos).partial().superRefine(tipoYNumeroJuntos);

module.exports = {
  createClientSchema,
  updateClientSchema,
};
