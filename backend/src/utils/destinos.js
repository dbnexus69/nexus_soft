// Destinos de preferencia del cliente (spec 017): la regla vive aquí y la usan el
// esquema (para el 422 con el campo) y el servicio (para escribir).

const MAX_DESTINOS = 5;
const MIN_LARGO = 2;
const MAX_LARGO = 60;

// NFC y sin caracteres invisibles (de copiar y pegar): dos "Pereira" que se ven iguales
// tienen que ser el mismo texto.
const limpiar = (v) => String(v ?? '').normalize('NFC').replace(/\p{Cf}/gu, '').trim().replace(/\s+/g, ' ');
/** La clave con la que dos destinos son el mismo: sin mayúsculas. */
const claveDestino = (v) => limpiar(v).toLowerCase();

/**
 * La lista tal como se guarda, del más viejo al más nuevo (el último es el reciente).
 * Un repetido (sin mayúsculas) se queda en su última aparición: volver a añadirlo lo
 * convierte en el reciente. `errores` lleva `{ field, message }` relativos a la lista.
 */
function normalizarDestinos(lista) {
  const errores = [];
  if (!Array.isArray(lista)) return { destinos: [], errores: [{ field: '', message: 'Debe ser una lista de destinos' }] };

  const limpios = lista.map(limpiar);
  limpios.forEach((d, i) => {
    if (d.length < MIN_LARGO || d.length > MAX_LARGO) {
      errores.push({ field: String(i), message: `Entre ${MIN_LARGO} y ${MAX_LARGO} caracteres` });
    }
  });

  const vistos = new Set();
  const destinos = [];
  for (let i = limpios.length - 1; i >= 0; i--) {
    const clave = claveDestino(limpios[i]);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    destinos.unshift(limpios[i]);
  }
  if (destinos.length > MAX_DESTINOS) errores.push({ field: '', message: `Máximo ${MAX_DESTINOS} destinos` });

  return { destinos, errores };
}

module.exports = { normalizarDestinos, claveDestino, limpiarDestino: limpiar, MAX_DESTINOS, MAX_LARGO };
