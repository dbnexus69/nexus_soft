const { z } = require('zod');
const { normalizarDocumento, mensajeDocumento, mensajeTelefono } = require('../utils/datosPersona');
const { color } = require('./companies.schema');

/**
 * El perfil de la agencia que edita su admin desde "Mi empresa" (spec 011).
 *
 * Todo es opcional y un texto vacío se guarda como NULL (borrar un dato es mandarlo vacío). El NIT y el
 * teléfono siguen las reglas de las personas (`utils/datosPersona.js`): no hay una segunda regla para lo
 * mismo. El nombre legal y el slug no están: son del superadministrador.
 */

const vacioANulo = (v) => (v === '' ? null : v);

const texto = (max) => z.string().trim().max(max, `Máximo ${max} caracteres`)
  .transform(vacioANulo).nullable().optional();

const conRegla = (normalizar, mensaje) => z.string()
  .transform(v => normalizar(v))
  .superRefine((v, ctx) => {
    const m = v ? mensaje(v) : null;
    if (m) ctx.addIssue({ code: z.ZodIssueCode.custom, message: m });
  })
  .transform(vacioANulo).nullable().optional();

const clausula = z.object({
  titulo: z.string().trim().min(1, 'El título es obligatorio').max(80, 'Máximo 80 caracteres'),
  texto: z.string().trim().min(1, 'El texto es obligatorio').max(600, 'Máximo 600 caracteres'),
});

const updateCompanyProfileSchema = z.object({
  nombreComercial: texto(120),
  nit: conRegla(normalizarDocumento, (v) => mensajeDocumento('NIT', v)),
  direccion: texto(150),
  telefono: conRegla((v) => String(v).trim(), mensajeTelefono),
  emailContacto: z.union([z.literal(''), z.string().trim().email('No parece un correo válido').max(180)])
    .transform(vacioANulo).nullable().optional(),
  sitioWeb: z.union([
    z.literal(''),
    z.string().trim().max(200, 'Máximo 200 caracteres')
      .regex(/^https?:\/\/[^\s/$.?#].[^\s]*$/i, 'Debe empezar por http:// o https://'),
  ]).transform(vacioANulo).nullable().optional(),
  colorPrimario: color,
  colorAcento: color,
  colorRealce: color,
  voucherPie: texto(300),
  // null = volver a los términos por defecto.
  voucherTerminos: z.array(clausula).max(15, 'Máximo 15 cláusulas').nullable().optional(),
});

module.exports = { updateCompanyProfileSchema };
