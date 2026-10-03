// Espejo de backend/src/schemas/contrasena.js: si cambia una, cambia la otra.
// El servidor es quien manda; aquí sirve para avisar mientras se escribe.

export const REQUISITOS_CONTRASENA: Array<{ etiqueta: string; cumple: (c: string) => boolean }> = [
  { etiqueta: 'Mínimo 8 caracteres', cumple: (c) => c.length >= 8 },
  { etiqueta: 'Una letra minúscula', cumple: (c) => /[a-z]/.test(c) },
  { etiqueta: 'Una letra mayúscula', cumple: (c) => /[A-Z]/.test(c) },
  { etiqueta: 'Un número', cumple: (c) => /\d/.test(c) },
  { etiqueta: 'Un carácter especial (ej: @, $, !, %, *, ?)', cumple: (c) => /[^A-Za-z0-9]/.test(c) },
];

/** null si la contraseña vale; si no, lo primero que le falta. */
export function mensajeContrasena(contrasena: string): string | null {
  if (contrasena.length > 72) return 'Máximo 72 caracteres';
  const falta = REQUISITOS_CONTRASENA.find((r) => !r.cumple(contrasena));
  return falta ? `La contraseña necesita: ${falta.etiqueta.toLowerCase()}` : null;
}

export const AYUDA_CONTRASENA = 'Mínimo 8 caracteres, con minúscula, mayúscula, número y un carácter especial.';
