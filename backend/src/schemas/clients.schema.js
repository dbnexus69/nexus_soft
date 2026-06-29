const { z } = require('zod');

const createClientSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  docType: z.string().nullable().optional(),
  docNumber: z.string().nullable().optional(),
  email: z.string().email('Email inválido').nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  birth_date: z.string().nullable().optional()
});

const updateClientSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  docType: z.string().nullable().optional(),
  docNumber: z.string().nullable().optional(),
  email: z.string().email('Email inválido').nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  birth_date: z.string().nullable().optional()
});

module.exports = {
  createClientSchema,
  updateClientSchema
};
