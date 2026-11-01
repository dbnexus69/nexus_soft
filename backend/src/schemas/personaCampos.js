const { z } = require('zod');
const {
  normalizarDocumento, normalizarNombre, mensajeNombre, mensajeTelefono, mensajeNacimiento,
} = require('../utils/datosPersona');

// Los campos de una persona, con sus reglas (utils/datosPersona.js), para los esquemas
// de clientes, usuarios, comisionistas y responsables. Aquí solo se cablean.

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

const numeroDocumentoOpcional = z.preprocess(vacioAUndefined, numeroDocumento.optional());

// La abreviatura o el nombre del tipo, de las rutas anteriores a `docTypeId`.
// Recortado antes de mirar si está vacío: un tipo de solo espacios es "sin tipo", no un tipo.
const tipoDocumentoPorTexto = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() || undefined : vacioAUndefined(v)),
  z.string().optional(),
);

// El id del tipo de documento (`tipos_documento.id`); llega como número o como texto del <select>.
const idTipoDocumento = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.coerce.number({ invalid_type_error: 'Seleccione el tipo de documento' }).int('Seleccione el tipo de documento').positive('Seleccione el tipo de documento').optional(),
);

const email = z.preprocess(vacioAUndefined, z.string().trim().toLowerCase().max(180, 'Máximo 180 caracteres').email('Email inválido').optional());
const telefono = z.preprocess(vacioAUndefined, z.string().trim().superRefine(validar(mensajeTelefono)).optional());
const nacimiento = z.preprocess(vacioAUndefined, z.string().superRefine(validar(mensajeNacimiento)).optional());

/** El tipo y el número se juzgan juntos: el número solo vale para un tipo. Basta con que venga `docTypeId` o `docType`. */
function tipoYNumeroJuntos(d, ctx) {
  const hayTipo = d.docType !== undefined || d.docTypeId !== undefined;
  const hayNumero = d.docNumber !== undefined;
  if (hayTipo === hayNumero) return;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: [hayTipo ? 'docNumber' : 'docTypeId'],
    message: 'El tipo y el número de documento se envían juntos',
  });
}

/**
 * Avatar (spec 036): una URL del selector de la pantalla (`AvatarPicker.tsx`, hoy de api.dicebear.com), acotada.
 * Antes era cualquier texto sin largo: cabía hasta el tope de 5 MB del JSON y viajaba en cada listado.
 */
const ORIGEN_AVATARES = 'api.dicebear.com';
const avatar = z.string().trim().max(300, 'El avatar es demasiado largo')
  .url('El avatar tiene que ser una URL')
  .refine((u) => { try { return new URL(u).hostname === ORIGEN_AVATARES; } catch { return false; } },
    'El avatar tiene que ser uno del selector')
  .nullable().optional();

module.exports = { validar, vacioAUndefined, nombre, numeroDocumento, numeroDocumentoOpcional, tipoDocumentoPorTexto, idTipoDocumento, email, telefono, nacimiento, tipoYNumeroJuntos, avatar };
