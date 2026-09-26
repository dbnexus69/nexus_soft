const { z } = require('zod');
const {
  normalizarDocumento, mensajeDocumento,
  normalizarNombre, mensajeNombre,
  mensajeTelefono, mensajeNacimiento,
} = require('../utils/datosPersona');

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

const tipoDocumento = z
  .string({ required_error: 'Seleccione el tipo de documento', invalid_type_error: 'Seleccione el tipo de documento' })
  .trim()
  .min(1, 'Seleccione el tipo de documento');

const numeroDocumento = z
  .string({ required_error: 'El número de documento es obligatorio', invalid_type_error: 'El número de documento es obligatorio' })
  .transform(normalizarDocumento);

const campos = {
  firstName: nombre,
  lastName: nombre,
  docType: tipoDocumento,
  docNumber: numeroDocumento,
  email: z.preprocess(vacioAUndefined, z.string().trim().toLowerCase().max(180, 'Máximo 180 caracteres').email('Email inválido').optional()),
  phone: z.preprocess(vacioAUndefined, z.string().trim().superRefine(validar(mensajeTelefono)).optional()),
  birthDate: z.preprocess(vacioAUndefined, z.string().superRefine(validar(mensajeNacimiento)).optional()),
  avatar: z.string().nullable().optional(),
};

// El número solo se puede juzgar sabiendo el tipo: por eso viajan juntos.
function tipoYNumeroJuntos(d, ctx) {
  const hayTipo = d.docType !== undefined;
  const hayNumero = d.docNumber !== undefined;
  if (!hayTipo && !hayNumero) return;
  if (hayTipo !== hayNumero) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [hayTipo ? 'docNumber' : 'docType'],
      message: 'El tipo y el número de documento se envían juntos',
    });
    return;
  }
  const m = mensajeDocumento(d.docType, d.docNumber);
  if (m) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['docNumber'], message: m });
}

const createClientSchema = z.object(campos).superRefine(tipoYNumeroJuntos);

const updateClientSchema = z.object(campos).partial().superRefine(tipoYNumeroJuntos);

module.exports = {
  createClientSchema,
  updateClientSchema,
};
