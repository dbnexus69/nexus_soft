const { z } = require('zod');

/**
 * Los cuerpos de /api/auth, que no se validaban en ninguna parte.
 *
 * `login` leía `req.body.email` a pelo: con un cuerpo vacío el servicio ya
 * respondía "Correo y contraseña requeridos", pero `email.toLowerCase()`
 * revienta con un 500 si llega un número, y los otros tres endpoints eran
 * esqueletos que no miraban el cuerpo.
 *
 * El correo se normaliza a minúsculas aquí, que es como se guarda y como lo
 * busca el servicio. Es la única transformación: el resto se comprueba y se
 * deja pasar.
 */

const correo = z.string({ required_error: 'El correo es obligatorio' })
  .trim()
  .min(1, 'El correo es obligatorio')
  .max(180, 'Correo demasiado largo')
  .email('No parece un correo válido')
  .toLowerCase();

// La contraseña nueva: la política es única para todos los caminos (schemas/contrasena.js).
const { contrasena } = require('./contrasena');

// Seis cifras. Se acepta con espacios alrededor porque se copia de un correo.
const codigo = z.string({ required_error: 'El código es obligatorio' })
  .trim()
  .regex(/^\d{6}$/, 'El código son 6 dígitos');

const loginSchema = z.object({
  email: correo,
  password: z.string({ required_error: 'La contraseña es obligatoria' }).min(1, 'La contraseña es obligatoria'),
  remember: z.boolean().optional(),
}).strict();

const forgotPasswordSchema = z.object({ email: correo }).strict();

const verifyCodeSchema = z.object({ email: correo, code: codigo }).strict();

const resetPasswordSchema = z.object({
  email: correo,
  code: codigo,
  password: contrasena,
}).strict();

module.exports = { loginSchema, forgotPasswordSchema, verifyCodeSchema, resetPasswordSchema };
