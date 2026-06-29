const { z } = require('zod');

const createAgentSchema = z.object({
  name: z.string({ required_error: 'Nombre es requerido' }),
  type: z.string().nullable().optional(),
  docType: z.string().nullable().optional(),
  docNumber: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email('Email inválido').nullable().optional().or(z.literal('')),
  paymentThreshold: z.union([z.number(), z.string()]).optional(),
  status: z.string().optional()
});

const updateAgentSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  docType: z.string().nullable().optional(),
  docNumber: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email('Email inválido').nullable().optional().or(z.literal('')),
  paymentThreshold: z.union([z.number(), z.string()]).optional(),
  status: z.string().optional()
});

const createSettlementSchema = z.object({
  agentId: z.number({ required_error: 'ID de agente es requerido' }),
  amount: z.number({ required_error: 'Monto es requerido' }),
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
