/**
 * Tramos del informe de antigüedad de cartera. Única fuente de etiquetas,
 * orden y color; el backend usa las mismas claves en `aging` y `agingBucket`.
 *
 * El color es una ESCALA, no un juego de categorías. La antigüedad es una
 * magnitud creciente, así que un solo tono que se va cargando la representa;
 * el diseño anterior usaba rojo, naranja, amarillo y el color de marca —cuatro
 * tonos sin relación entre sí— y con todo coloreado nada destacaba. Aquí solo
 * el tramo de más de 90 días llega a saturarse de verdad.
 *
 * `undated` queda fuera de la escala a propósito: un crédito sin fecha de
 * vencimiento no es una etapa de la mora, es un dato que falta. Ámbar, que en
 * esta interfaz ya significa "atiéndelo", no rojo.
 */

export const TRAMOS = [
  'current',
  'days1_30',
  'days31_60',
  'days61_90',
  'days90plus',
  'undated',
] as const;

export type Tramo = (typeof TRAMOS)[number];

export type Aging = Record<Tramo, number>;

interface EstiloTramo {
  /** Cabecera de columna y leyenda. */
  corto: string;
  /** Frase completa, para tooltips y lectores de pantalla. */
  largo: string;
  /** Segmento de la barra. */
  barra: string;
  /** Texto e insignia. */
  texto: string;
  insignia: string;
}

export const TRAMO: Record<Tramo, EstiloTramo> = {
  current: {
    corto: 'Corriente',
    largo: 'Aún no vence',
    barra: 'bg-slate-300 dark:bg-slate-600',
    texto: 'text-slate-600 dark:text-slate-300',
    insignia: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  days1_30: {
    corto: '1–30',
    largo: 'Entre 1 y 30 días de mora',
    barra: 'bg-rose-300 dark:bg-rose-400/80',
    texto: 'text-rose-600 dark:text-rose-300',
    insignia: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  },
  days31_60: {
    corto: '31–60',
    largo: 'Entre 31 y 60 días de mora',
    barra: 'bg-rose-500',
    texto: 'text-rose-700 dark:text-rose-300',
    insignia: 'bg-rose-100 text-rose-800 dark:bg-rose-900/70 dark:text-rose-200',
  },
  days61_90: {
    corto: '61–90',
    largo: 'Entre 61 y 90 días de mora',
    barra: 'bg-rose-700',
    texto: 'text-rose-800 dark:text-rose-200',
    insignia: 'bg-rose-200 text-rose-900 dark:bg-rose-800 dark:text-rose-100',
  },
  days90plus: {
    corto: '+90',
    largo: 'Más de 90 días de mora',
    barra: 'bg-rose-900 dark:bg-rose-800',
    texto: 'text-rose-900 dark:text-rose-200',
    insignia: 'bg-rose-900 text-white dark:bg-rose-800 dark:text-rose-50',
  },
  undated: {
    corto: 'Sin fecha',
    largo: 'Sin fecha de vencimiento: no se puede reclamar',
    barra: 'bg-amber-400 dark:bg-amber-500/80',
    texto: 'text-amber-700 dark:text-amber-300',
    insignia: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
};

/** Los cuatro tramos que son mora de verdad. */
export const TRAMOS_MORA: Tramo[] = ['days1_30', 'days31_60', 'days61_90', 'days90plus'];

export const AGING_VACIO: Aging = {
  current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90plus: 0, undated: 0,
};

/** "hace 38 días", "vence hoy", "en 12 días". Sin fecha devuelve null. */
export function textoVencimiento(fecha: string | null, diasMora: number): string | null {
  if (diasMora > 0) return `hace ${diasMora} ${diasMora === 1 ? 'día' : 'días'}`;
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vence = new Date(fecha);
  vence.setHours(0, 0, 0, 0);
  const dias = Math.round((vence.getTime() - hoy.getTime()) / 86400000);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  return `en ${dias} días`;
}
