const { z } = require('zod');
const { contrasena } = require('./contrasena');
const {
  nombre, numeroDocumentoOpcional, tipoDocumentoPorTexto, idTipoDocumento, telefono, nacimiento, tipoYNumeroJuntos,
} = require('./personaCampos');

const createUserSchema = z.object({
  name: z.string().optional(),
  firstName: nombre.optional(),
  lastName: nombre.optional(),
  email: z.string({ required_error: 'Email es requerido' }).email('Email inválido'),
  password: contrasena,
  role: z.string({ required_error: 'Rol es requerido' }),
  phone: telefono,
  docTypeId: idTipoDocumento,
  docType: tipoDocumentoPorTexto,
  docNumber: numeroDocumentoOpcional,
  birth_date: nacimiento,
  birthDate: nacimiento, // el que lee el servicio; birth_date queda por compatibilidad
  avatar: z.string().nullable().optional(),
  status: z.string().optional()
}).superRefine(tipoYNumeroJuntos);

const updateUserSchema = z.object({
  name: z.string().optional(),
  firstName: nombre.optional(),
  lastName: nombre.optional(),
  email: z.string().email('Email inválido').optional(),
  password: contrasena.optional(),
  role: z.string().optional(),
  phone: telefono,
  docTypeId: idTipoDocumento,
  docType: tipoDocumentoPorTexto,
  docNumber: numeroDocumentoOpcional,
  birth_date: nacimiento,
  birthDate: nacimiento, // el que lee el servicio; birth_date queda por compatibilidad
  avatar: z.string().nullable().optional(),
  status: z.string().optional()
}).superRefine(tipoYNumeroJuntos);

module.exports = {
  createUserSchema,
  updateUserSchema
};
