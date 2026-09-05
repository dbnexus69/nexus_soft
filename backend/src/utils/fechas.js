/**
 * Fechas en hora de Colombia, sin depender de la zona del servidor.
 *
 * El problema: `new Date('2027-07-15T06:40:00')` —una cadena de fecha y hora
 * SIN designador de zona— se interpreta como hora **local del proceso**. Así que
 * el instante que se guarda depende de dónde corra el servidor:
 *
 *   servidor en Bogotá  ->  2027-07-15T11:40:00Z  ->  se muestra 06:40  ✓
 *   servidor en UTC     ->  2027-07-15T06:40:00Z  ->  se muestra 01:40  ✗
 *   servidor en Madrid  ->  2027-07-15T04:40:00Z  ->  se muestra 14/07 23:40  ✗
 *
 * En una máquina de desarrollo colombiana sale bien y nadie lo nota; al
 * desplegar en un servidor UTC —lo normal— todos los vuelos se corren cinco
 * horas y los nocturnos cambian de día. La lectura sí era explícita
 * (`flights.service.js` formatea con `timeZone: 'America/Bogota'`), así que la
 * escritura era la mitad que faltaba.
 *
 * Colombia es UTC-5 todo el año, sin horario de verano, así que la conversión es
 * una resta fija y no hace falta librería. Verificado con Intl en enero, abril,
 * julio y octubre: GMT-05:00 en los cuatro.
 */

/** Colombia no cambia de hora: el desfase es constante. */
const OFFSET_COLOMBIA_H = 5;

/**
 * Interpreta una fecha y una hora como hora de Colombia y devuelve el instante.
 *
 * @param {string} fecha  'YYYY-MM-DD', o un ISO completo con zona (se respeta)
 * @param {string} [hora] 'HH:mm'; se ignora si `fecha` ya trae la hora
 * @returns {Date|null} null si la fecha no es utilizable
 */
function enHoraColombia(fecha, hora) {
  if (!fecha) return null;

  const texto = String(fecha).trim();

  // Si ya viene con zona (el DateTimePicker del frontend emite '...-05:00'),
  // el instante está definido sin ambigüedad: se respeta tal cual.
  if (/T/.test(texto) && /(Z|[+-]\d{2}:?\d{2})$/.test(texto)) {
    const d = new Date(texto);
    return isNaN(d.getTime()) ? null : d;
  }

  // Un ISO con hora pero SIN zona es el caso ambiguo: se toma como Colombia.
  const [parteFecha, parteHora] = texto.includes('T') ? texto.split('T') : [texto, null];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(parteFecha);
  if (!m) {
    const d = new Date(texto);
    return isNaN(d.getTime()) ? null : d;
  }

  const [, a, mes, dia] = m.map(Number);
  const reloj = (parteHora || hora || '00:00').slice(0, 5);
  const hm = /^(\d{1,2}):(\d{2})$/.exec(reloj);
  const hh = hm ? Number(hm[1]) : 0;
  const mm = hm ? Number(hm[2]) : 0;

  // Sumar el desfase convierte la hora local de Colombia al instante UTC.
  const d = new Date(Date.UTC(a, mes - 1, dia, hh + OFFSET_COLOMBIA_H, mm, 0));
  return isNaN(d.getTime()) ? null : d;
}

module.exports = { enHoraColombia, OFFSET_COLOMBIA_H };
