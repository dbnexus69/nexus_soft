/**
 * La marca de cada agencia, aplicada sobre el tema en caliente.
 *
 * Esto es barato gracias a una decisión anterior: los colores del tema se
 * declaran en CANALES (`--primary-rgb: 43 45 66`) y el hexadecimal se deriva de
 * ellos. Así que vestir la aplicación con los colores de una agencia es escribir
 * tres variables en la raíz del documento — sin recompilar nada, sin un segundo
 * juego de clases, y respetando las 46 clases con opacidad que dependen de esos
 * mismos canales.
 */

export interface Marca {
  slug: string;
  nombre: string;
  logoUrl: string | null;
  colores: {
    primario: string | null;
    acento: string | null;
    realce: string | null;
  };
}

/** '#2B2D42' -> '43 45 66', que es lo que espera la variable del tema. */
function aCanales(hex: string): string | null {
  const limpio = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(limpio)) return null;
  const n = parseInt(limpio, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Pasa un hex a HSL, que es donde se puede razonar sobre claridad y viveza. */
function aHsl(hex: string): { h: number; s: number; l: number } | null {
  const canales = aCanales(hex);
  if (!canales) return null;
  const [r, g, b] = canales.split(' ').map(n => Number(n) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

/** De HSL a los canales que espera la variable del tema. */
function aCanalesDesdeHsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map(v => Math.round((v + m) * 255)).join(' ');
}

/**
 * El fondo de la barra de navegación, teñido con la marca.
 *
 * Aquí es donde de verdad se ve de quién es la aplicación. El resto de la
 * interfaz es gris —1810 clases de slate frente a 378 de marca— y en modo oscuro
 * muchos componentes sustituyen el color de marca por blanco, así que el tinte
 * se diluye hasta no notarse. La barra, en cambio, está siempre a la vista.
 *
 * Se queda MUY oscura a propósito, con el tono de la agencia pero no su
 * claridad: lleva texto blanco encima, y una marca clara —un celeste, un ámbar—
 * lo dejaría ilegible. Así funciona con cualquier color que elija un cliente sin
 * que haya que comprobarlo caso por caso.
 */
function paraLaBarra(hex: string): string | null {
  const hsl = aHsl(hex);
  if (!hsl) return null;
  // Saturación fija y no la del original: un gris de marca dejaría la barra
  // exactamente igual que la de todos, y la gracia es reconocerla.
  return aCanalesDesdeHsl(hsl.h, Math.max(hsl.s, 0.35), 0.08);
}

/**
 * La variante para modo oscuro de un color de marca.
 *
 * El tema no usa el mismo tono en los dos modos, y por un motivo: sobre un fondo
 * oscuro, un azul marino de marca deja de leerse. El tema propio lo resuelve a
 * mano —su primario pasa de #2B2D42 a #8D99AE—, pero una agencia solo elige UN
 * color, así que la variante se deriva: se sube la luminosidad hasta un mínimo
 * legible y se baja algo la saturación, que es lo que hace el tema de la casa.
 *
 * Un color que ya es claro se deja como está: subirle la luminosidad lo
 * convertiría en blanco.
 */
function paraModoOscuro(hex: string): string | null {
  const canales = aCanales(hex);
  if (!canales) return null;
  const [r, g, b] = canales.split(' ').map(n => Number(n) / 255);

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (l >= 0.6) return canales;

  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  // Antes se bajaba la saturación al 55 %, y el resultado era un color casi
  // gris: la marca "apenas se notaba" en oscuro. Se conserva el 85 %, que sigue
  // siendo más suave que el original —sobre fondo oscuro un color a plena
  // saturación vibra— pero se reconoce como suyo.
  const lClaro = 0.64;
  const sSuave = s * 0.85;
  const c = (1 - Math.abs(2 * lClaro - 1)) * sSuave;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lClaro - c / 2;
  const [r2, g2, b2] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];

  return [r2, g2, b2].map(v => Math.round((v + m) * 255)).join(' ');
}

/**
 * Las variables que el tema ya define, y que la marca sobreescribe.
 *
 * Son solo tres de las veintiséis. El resto —fondos, bordes, texto— siguen
 * siendo del tema: una agencia elige su color, no rehace la aplicación.
 */
const VARIABLES: Array<[keyof Marca['colores'], string]> = [
  ['primario', 'primary'],
  ['acento', 'accent'],
  ['realce', 'highlight'],
];

const ETIQUETA_ESTILO = 'marca-empresa';

/**
 * Aplica la marca. Se llama al entrar y al cambiar de empresa.
 *
 * Los colores van en una etiqueta `<style>` propia y no en el atributo `style`
 * del elemento raíz, porque hacen falta dos juegos: el de modo claro y el de
 * `.dark`. Con `style` en línea solo cabría uno, y al cambiar de modo la marca
 * se quedaría con el color equivocado.
 */
export function aplicarMarca(marca: Marca | null): void {
  const anterior = document.getElementById(ETIQUETA_ESTILO);
  if (anterior) anterior.remove();
  if (!marca) return;

  const claro: string[] = [];
  const oscuro: string[] = [];
  for (const [clave, variable] of VARIABLES) {
    const hex = marca.colores[clave];
    if (!hex) continue;
    const canales = aCanales(hex);
    if (!canales) continue;
    claro.push(`--${variable}-rgb: ${canales};`);
    const enOscuro = paraModoOscuro(hex);
    if (enOscuro) oscuro.push(`--${variable}-rgb: ${enOscuro};`);

    // La barra se tiñe con el color principal, y es igual en los dos modos:
    // siempre es oscura, porque siempre lleva texto blanco.
    if (clave === 'primario') {
      const barra = paraLaBarra(hex);
      if (barra) { claro.push(`--nav-rgb: ${barra};`); oscuro.push(`--nav-rgb: ${barra};`); }
    }
  }
  if (!claro.length) return;

  const estilo = document.createElement('style');
  estilo.id = ETIQUETA_ESTILO;
  estilo.textContent = `:root{${claro.join('')}}\n.dark{${oscuro.join('')}}`;
  document.head.appendChild(estilo);
}
