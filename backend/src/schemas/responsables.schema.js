const { z } = require('zod');

const createResponsableSchema = z.object({
  firstName: z.string({ required_error: 'Nombre es requerido' }),
  lastName: z.string({ required_error: 'Apellido es requerido' }),
  docType: z.string().nullable().optional(),
  docTypeId: z.union([z.number(), z.string()]).nullable().optional(),
  docNumber: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email('Email inválido').nullable().optional().or(z.literal('')),
  birth_date: z.string().nullable().optional()
});

const updateResponsableSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  docType: z.string().nullable().optional(),
  docTypeId: z.union([z.number(), z.string()]).nullable().optional(),
  docNumber: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email('Email inválido').nullable().optional().or(z.literal('')),
  birth_date: z.string().nullable().optional(),
  status: z.string().optional()
});

module.exports = {
  createResponsableSchema,
  updateResponsableSchema
};
