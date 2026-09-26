const { fechaEnColombia } = require('./fechas');

// Reglas de los datos de una persona. Espejo de frontend/src/utils/datosPersona.ts: si cambia una, cambia la otra.

// La regla depende del tipo de documento, por abreviatura. Un tipo que no esté aquí cae en REGLA_GENERICA.
const REGLAS_DOCUMENTO = {
  CC: { patron: /^\d{6,10}$/, mensaje: 'La cédula de ciudadanía lleva solo números, de 6 a 10 dígitos' },
  TI: { patron: /^\d{10,11}$/, mensaje: 'La tarjeta de identidad lleva solo números, de 10 u 11 dígitos' },
  CE: { patron: /^\d{6,10}$/, mensaje: 'La cédula de extranjería lleva solo números, de 6 a 10 dígitos' },
  NIT: { patron: /^\d{9,10}(-?\d)?$/, mensaje: 'El NIT lleva de 9 a 11 números, con o sin guion antes del dígito de verificación (900123456-7)' },
  PA: { patron: /^[A-Z0-9]{5,15}$/, mensaje: 'El pasaporte lleva letras y números, de 5 a 15 caracteres' },
};
const REGLA_GENERICA = { patron: /^[A-Z0-9]{4,20}$/, mensaje: 'El documento lleva solo letras y números, de 4 a 20 caracteres' };

const reglaDeDocumento = (tipo) => REGLAS_DOCUMENTO[String(tipo || '').trim().toUpperCase()] || REGLA_GENERICA;

const normalizarDocumento = (valor) => String(valor ?? '').trim().toUpperCase();

/** null si el número vale para ese tipo; si no, el mensaje para quien lo escribió. Espera un número ya normalizado. */
function mensajeDocumento(tipo, numero) {
  if (!numero) return 'El número de documento es obligatorio';
  const regla = reglaDeDocumento(tipo);
  return regla.patron.test(numero) ? null : regla.mensaje;
}

const PATRON_NOMBRE = /^\p{L}+(?:[ '’-]\p{L}+)*$/u;

const normalizarNombre = (valor) => String(valor ?? '').trim().replace(/\s+/g, ' ');

function mensajeNombre(nombre) {
  if (!nombre) return 'Obligatorio';
  if (nombre.length < 2) return 'Mínimo 2 letras';
  if (nombre.length > 40) return 'Máximo 40 caracteres';
  if (!PATRON_NOMBRE.test(nombre)) return 'Solo letras, espacios, guion y apóstrofe (sin números ni símbolos)';
  return null;
}

/** El teléfono es opcional a este nivel: vacío es válido. */
function mensajeTelefono(telefono) {
  if (!telefono) return null;
  if (!/^\+?[\d\s-]+$/.test(telefono)) return 'Solo números, y opcionalmente + al inicio, espacios y guiones';
  const digitos = telefono.replace(/\D/g, '').length;
  return digitos >= 7 && digitos <= 15 ? null : 'Debe tener entre 7 y 15 dígitos';
}

const ANIOS_MAXIMOS = 120;

/** Vacío es válido. Compara días de Colombia, no instantes: nacer "hoy" es válido y "mañana" no. */
function mensajeNacimiento(valor) {
  if (!valor) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor));
  if (!m) return 'Fecha inválida';
  const dia = `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(`${dia}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== dia) return 'Fecha inválida';
  const hoy = fechaEnColombia(new Date());
  if (dia > hoy) return 'La fecha de nacimiento no puede ser futura';
  const limite = `${Number(hoy.slice(0, 4)) - ANIOS_MAXIMOS}${hoy.slice(4)}`;
  return dia < limite ? `La fecha de nacimiento no puede ser anterior a hace ${ANIOS_MAXIMOS} años` : null;
}

module.exports = {
  REGLAS_DOCUMENTO,
  normalizarDocumento, mensajeDocumento,
  normalizarNombre, mensajeNombre,
  mensajeTelefono, mensajeNacimiento,
};
