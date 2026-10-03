const { z } = require('zod');
const {
  numeroDocumentoOpcional, tipoDocumentoPorTexto, idTipoDocumento, telefono, tipoYNumeroJuntos,
} = require('./personaCampos');

const createAgentSchema = z.object({
  name: z.string({ required_error: 'Nombre es requerido' }),
  type: z.string().nullable().optional(),
  docTypeId: idTipoDocumento,
  docType: tipoDocumentoPorTexto,
  docNumber: numeroDocumentoOpcional,
  phone: telefono,
  email: z.string().email('Email inválido').nullable().optional().or(z.literal('')),
  paymentThreshold: z.coerce.number({ invalid_type_error: 'El mínimo para retirar es un número' }).min(0, 'El mínimo para retirar no puede ser negativo').optional(),
  status: z.string().optional(),
  avatar: z.string().nullable().optional(),
  banco: z.string().nullable().optional(),
  tipoCuenta: z.string().nullable().optional(),
  numeroCuenta: z.string().nullable().optional()
}).superRefine(tipoYNumeroJuntos); // el nombre no se restringe a letras: un comisionista puede ser una empresa

const updateAgentSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  docTypeId: idTipoDocumento,
  docType: tipoDocumentoPorTexto,
  docNumber: numeroDocumentoOpcional,
  phone: telefono,
  email: z.string().email('Email inválido').nullable().optional().or(z.literal('')),
  paymentThreshold: z.coerce.number({ invalid_type_error: 'El mínimo para retirar es un número' }).min(0, 'El mínimo para retirar no puede ser negativo').optional(),
  status: z.string().optional(),
  avatar: z.string().nullable().optional(),
  banco: z.string().nullable().optional(),
  tipoCuenta: z.string().nullable().optional(),
  numeroCuenta: z.string().nullable().optional()
}).superRefine(tipoYNumeroJuntos);

const createSettlementSchema = z.object({
  agentId: z.number({ required_error: 'ID de agente es requerido' }),
  // Lo calcula el servidor con las ventas pendientes. Si llega, es la cifra que
  // vio el operador y debe coincidir (si no, 409).
  amount: z.number().optional(),
  date: z.string().optional(),
  paymentMethod: z.union([z.number(), z.string()]).optional(),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  salesIds: z.array(z.number()).optional()
});

module.exports = {
  createAgentSchema,
  updateAgentSchema,
  createSettlementSchema
};
