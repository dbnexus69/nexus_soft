/**
 * Los colores de cada agencia, aplicados al voucher.
 *
 * **Solo al voucher, y es una decisión, no una limitación.** La interfaz es la
 * herramienta con la que trabaja el equipo de la agencia: conviene que sea
 * siempre la misma, para que dar soporte no dependa de qué colores eligió cada
 * cliente. El voucher, en cambio, es lo único que sale de la oficina y llega al
 * cliente final, y ahí la marca que tiene que aparecer es la de la agencia.
 *
 * El nombre y el logo sí siguen en la interfaz —en la barra y en la cabecera—,
 * porque eso no es decoración: dice en qué agencia estás trabajando.
 *
 * Como el voucher es un documento impreso, no hay modo oscuro que atender: se
 * fue toda la derivación que hacía falta para eso.
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

/** Pasa un hex a HSL, que es donde se puede razonar sobre claridad y viveza. */
function aHsl(hex: string): { h: number; s: number; l: number } | null {
  const limpio = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(limpio)) return null;
  const n = parseInt(limpio, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255);
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

/** De HSL a `rgb(r g b)`, listo para meter en una variable CSS. */
function aRgb(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `rgb(${[r, g, b].map(v => Math.round((v + m) * 255)).join(' ')})`;
}

/**
 * El color de la franja de cabecera y de la caja de totales: el tono de la
 * agencia, forzado a oscuro.
 *
 * Encima va texto blanco. Si una agencia elige un celeste o un ámbar y lo
 * usáramos tal cual, su voucher saldría ilegible — y sería el documento que
 * recibe su cliente. Forzando la claridad, funciona con cualquier color que
 * elijan sin tener que revisarlo caso por caso.
 */
function tintaOscura(hex: string): string | null {
  const c = aHsl(hex);
  return c ? aRgb(c.h, Math.max(c.s, 0.3), Math.min(c.l, 0.16)) : null;
}

/** Luminancia relativa, para medir contraste de verdad. */
function luminancia(r: number, g: number, b: number): number {
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Contraste de un color HSL contra el blanco del papel. */
function contrasteConBlanco(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return 1.05 / (luminancia(r + m, g + m, b + m) + 0.05);
}

/**
 * El acento: sobre blanco, en detalles pequeños —la marca de cada sección, la
 * cifra destacada, la segunda palabra del pie—.
 *
 * No se le pone un techo de claridad fijo, se le **exige un contraste**: se va
 * oscureciendo hasta llegar a 4,5 a 1, que es el mínimo legible para texto
 * normal. Un techo fijo no basta, y se ve con un ámbar: a la claridad que
 * bastaba para un azul, el ámbar se quedaba en 3,0 y no se leía. Esto funciona
 * con el tono que elija cualquier agencia sin revisarlo a mano.
 */
const CONTRASTE_MINIMO = 4.5;

function acentoLegible(hex: string): string | null {
  const c = aHsl(hex);
  if (!c) return null;
  const s = Math.max(c.s, 0.45);
  let l = Math.min(c.l, 0.42);
  while (l > 0.08 && contrasteConBlanco(c.h, s, l) < CONTRASTE_MINIMO) l -= 0.02;
  return aRgb(c.h, s, l);
}

const ETIQUETA_ESTILO = 'marca-empresa';

/**
 * Aplica los colores de la agencia al voucher. Se llama al entrar y al salir.
 *
 * Van en una etiqueta `<style>` con el selector `.nexus-voucher` y no en el
 * atributo `style` del componente, por un motivo concreto: el PDF se genera
 * clonando el contenido dentro de un contenedor temporal que se crea a mano
 * (`Sales.tsx`). Un estilo en línea se quedaría en el original y el PDF saldría
 * con los colores por defecto; una regla por clase la hereda también el clon.
 */
export function aplicarMarca(marca: Marca | null): void {
  document.getElementById(ETIQUETA_ESTILO)?.remove();
  if (!marca) return;

  const tinta = marca.colores.primario ? tintaOscura(marca.colores.primario) : null;
  const acento = marca.colores.realce
    ? acentoLegible(marca.colores.realce)
    : marca.colores.acento ? acentoLegible(marca.colores.acento) : null;

  const reglas = [
    tinta ? `--v-tinta: ${tinta};` : '',
    acento ? `--v-acento: ${acento};` : '',
  ].join('');
  if (!reglas) return;

  const estilo = document.createElement('style');
  estilo.id = ETIQUETA_ESTILO;
  estilo.textContent = `.nexus-voucher{${reglas}}`;
  document.head.appendChild(estilo);
}
