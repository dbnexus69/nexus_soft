const { z } = require('zod');

const createUserSchema = z.object({
  name: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string({ required_error: 'Email es requerido' }).email('Email inválido'),
  password: z.string({ required_error: 'Contraseña es requerida' }).min(6, 'Mínimo 6 caracteres'),
  role: z.string({ required_error: 'Rol es requerido' }),
  phone: z.string().nullable().optional(),
  docType: z.string().nullable().optional(),
  docNumber: z.string().nullable().optional(),
  birth_date: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  status: z.string().optional()
});

const updateUserSchema = z.object({
  name: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email('Email inválido').optional(),
  password: z.string().min(6, 'Mínimo 6 caracteres').optional(),
  role: z.string().optional(),
  phone: z.string().nullable().optional(),
  docType: z.string().nullable().optional(),
  docNumber: z.string().nullable().optional(),
  birth_date: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  status: z.string().optional()
});

module.exports = {
  createUserSchema,
  updateUserSchema
};
