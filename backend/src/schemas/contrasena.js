const { z } = require('zod');

/**
 * La contraseña de una cuenta nueva o cambiada, con UNA sola política para todos los caminos.
 *
 * Antes había tres copias: el restablecimiento (`auth.schema`), el alta de una agencia
 * (`companies.schema`) y el alta de un usuario (`users.schema`), que pedía seis caracteres sin más.
 * Ocho caracteres con minúscula, mayúscula, número y símbolo es lo que `Login.tsx` ya anunciaba;
 * el espejo del navegador está en `frontend/src/utils/contrasena.ts`. El tope de 72 es el de bcrypt:
 * más allá de 72 bytes ignora el resto, así que una contraseña más larga no sería más segura.
 *
 * Solo se aplica al CREAR o CAMBIAR. El inicio de sesión no la comprueba (`auth.schema`), para que
 * quien tiene una contraseña antigua de seis caracteres siga entrando y pueda cambiarla.
 */
const contrasena = z.string({ required_error: 'La contraseña es obligatoria', invalid_type_error: 'La contraseña es obligatoria' })
  .min(8, 'Mínimo 8 caracteres')
  .max(72, 'Máximo 72 caracteres')
  .regex(/[a-z]/, 'Debe llevar una minúscula')
  .regex(/[A-Z]/, 'Debe llevar una mayúscula')
  .regex(/\d/, 'Debe llevar un número')
  .regex(/[^A-Za-z0-9]/, 'Debe llevar un carácter especial');

module.exports = { contrasena };
