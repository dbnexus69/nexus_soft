import { todayStr } from './formatters';

// Reglas de los datos de una persona. Espejo de backend/src/utils/datosPersona.js: si cambia una, cambia la otra.
// Aquí sirven para avisar mientras se escribe; el servidor las vuelve a aplicar y es quien manda.

interface ReglaDocumento { patron: RegExp; mensaje: string; soloNumeros: boolean }

const REGLAS_DOCUMENTO: Record<string, ReglaDocumento> = {
  CC: { patron: /^\d{6,10}$/, mensaje: 'La cédula de ciudadanía lleva solo números, de 6 a 10 dígitos', soloNumeros: true },
  TI: { patron: /^\d{10,11}$/, mensaje: 'La tarjeta de identidad lleva solo números, de 10 u 11 dígitos', soloNumeros: true },
  CE: { patron: /^\d{6,10}$/, mensaje: 'La cédula de extranjería lleva solo números, de 6 a 10 dígitos', soloNumeros: true },
  NIT: { patron: /^\d{9,10}(-?\d)?$/, mensaje: 'El NIT lleva de 9 a 11 números, con o sin guion antes del dígito de verificación (900123456-7)', soloNumeros: true },
  PA: { patron: /^[A-Z0-9]{5,15}$/, mensaje: 'El pasaporte lleva letras y números, de 5 a 15 caracteres', soloNumeros: false },
};
const REGLA_GENERICA: ReglaDocumento = { patron: /^[A-Z0-9]{4,20}$/, mensaje: 'El documento lleva solo letras y números, de 4 a 20 caracteres', soloNumeros: false };

const reglaDeDocumento = (tipo?: string) => REGLAS_DOCUMENTO[String(tipo || '').trim().toUpperCase()] || REGLA_GENERICA;

export const documentoSoloNumeros = (tipo?: string) => reglaDeDocumento(tipo).soloNumeros;

/** Lo que se deja teclear o pegar en el número: en un tipo numérico no entra una letra. NIT admite un guion. */
export function limpiarDocumento(tipo: string | undefined, valor: string): string {
  const mayusculas = valor.toUpperCase();
  if (!documentoSoloNumeros(tipo)) return mayusculas.replace(/[^A-Z0-9]/g, '');
  if (String(tipo).toUpperCase() !== 'NIT') return mayusculas.replace(/\D/g, '');
  const limpio = mayusculas.replace(/[^\d-]/g, '');
  const primerGuion = limpio.indexOf('-');
  return primerGuion === -1 ? limpio : limpio.slice(0, primerGuion + 1) + limpio.slice(primerGuion + 1).replace(/-/g, '');
}

export const normalizarDocumento = (valor: string) => String(valor ?? '').trim().toUpperCase();

export function mensajeDocumento(tipo: string | undefined, numero: string): string | null {
  if (!tipo) return 'Elija primero el tipo de documento';
  if (!numero) return 'Obligatorio';
  const regla = reglaDeDocumento(tipo);
  return regla.patron.test(numero) ? null : regla.mensaje;
}

const PATRON_NOMBRE = /^\p{L}+(?:[ '’-]\p{L}+)*$/u;

export const normalizarNombre = (valor: string) => String(valor ?? '').trim().replace(/\s+/g, ' ');

/** Lo que se deja teclear en un nombre: ni números ni símbolos, y sin espacios dobles. */
export const limpiarNombre = (valor: string) => valor.replace(/[^\p{L}\s'’-]/gu, '').replace(/\s{2,}/g, ' ');

export function mensajeNombre(nombre: string): string | null {
  if (!nombre) return 'Obligatorio';
  if (nombre.length < 2) return 'Mínimo 2 letras';
  if (nombre.length > 40) return 'Máximo 40 caracteres';
  if (!PATRON_NOMBRE.test(nombre)) return 'Solo letras, espacios, guion y apóstrofe (sin números ni símbolos)';
  return null;
}

/** Lo que se deja teclear en un teléfono. */
export const limpiarTelefono = (valor: string) => valor.replace(/[^\d+\s-]/g, '');

export function mensajeTelefono(telefono: string): string | null {
  if (!telefono) return null;
  if (!/^\+?[\d\s-]+$/.test(telefono)) return 'Solo números, y opcionalmente + al inicio, espacios y guiones';
  const digitos = telefono.replace(/\D/g, '').length;
  return digitos >= 7 && digitos <= 15 ? null : 'Debe tener entre 7 y 15 dígitos';
}

export function mensajeEmail(email: string): string | null {
  if (!email) return null;
  if (email.length > 180) return 'Máximo 180 caracteres';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? null : 'Email inválido';
}

const ANIOS_MAXIMOS = 120;

export function mensajeNacimiento(valor: string): string | null {
  if (!valor) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  if (!m) return 'Fecha inválida';
  const dia = `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(`${dia}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== dia) return 'Fecha inválida';
  const hoy = todayStr();
  if (dia > hoy) return 'La fecha de nacimiento no puede ser futura';
  const limite = `${Number(hoy.slice(0, 4)) - ANIOS_MAXIMOS}${hoy.slice(4)}`;
  return dia < limite ? `La fecha de nacimiento no puede ser anterior a hace ${ANIOS_MAXIMOS} años` : null;
}
