import { mensajeDocumento, normalizarDocumento } from '../../utils/datosPersona';

// El documento de cada persona de la venta (pasajeros, huéspedes, asegurados y el titular de los productos de un
// solo titular), con las mismas reglas que el servidor aplica en `createSale` (`_validarPersonas`). Se comprueba al
// pasar del paso de productos, para no enterarse con un 422 al final del asistente.

interface TipoDocumento { id?: number; name?: string; nombre?: string; abbreviation?: string; abreviatura?: string }

const LISTAS: Array<[string, string]> = [
  ['tickets', 'Tiquete'], ['hotels', 'Hotel'], ['insurances', 'Seguro'], ['plans', 'Paquete'], ['checkIns', 'Check-in'],
  ['migrations', 'Documentación migratoria'], ['simCards', 'SIM Card'], ['carRentals', 'Renta de vehículo'],
  ['fincas', 'Finca'], ['tours', 'Tour'], ['conventions', 'Convención'], ['restaurants', 'Restaurante'],
  ['visas', 'Visa'], ['passports', 'Pasaporte'], ['pets', 'Mascota'],
];
const PERSONAS = [['passengers', 'pasajero'], ['guests', 'huésped'], ['travelers', 'viajero'], ['members', 'asegurado']] as const;

/** El primer documento que no vale, ya redactado para quien arma la venta; null si todos valen. */
export function documentoDePersonaInvalido(form: Record<string, any>, tipos: TipoDocumento[]): string | null {
  const abreviaturaDe = (t: TipoDocumento) => t.abbreviation || t.abreviatura || t.name || '';
  const buscar = (valor: unknown) => {
    const texto = String(valor ?? '').trim().toLowerCase();
    if (!texto) return null;
    return tipos.find(t => abreviaturaDe(t).toLowerCase() === texto || (t.name || t.nombre || '').trim().toLowerCase() === texto);
  };

  const revisar = (donde: string, p: any): string | null => {
    if (!p || String(p.docNumber ?? '').trim() === '') return null;
    const tipo = buscar(p.docType);
    if (String(p.docType ?? '').trim() && !tipo) return `${donde}: el tipo de documento "${p.docType}" no existe`;
    const mensaje = mensajeDocumento(tipo ? abreviaturaDe(tipo) : undefined, normalizarDocumento(p.docNumber));
    return mensaje ? `${donde}: ${mensaje}` : null;
  };

  for (const [clave, etiqueta] of LISTAS) {
    const lista: any[] = Array.isArray(form[clave]) ? form[clave] : [];
    for (let i = 0; i < lista.length; i++) {
      const porItem = revisar(`${etiqueta} #${i + 1}`, lista[i]);
      if (porItem) return porItem;
      for (const [campo, nombre] of PERSONAS) {
        const personas: any[] = Array.isArray(lista[i]?.[campo]) ? lista[i][campo] : [];
        for (let j = 0; j < personas.length; j++) {
          const m = revisar(`${etiqueta} #${i + 1}, ${nombre} ${j + 1}`, personas[j]);
          if (m) return m;
        }
      }
    }
  }
  return null;
}
