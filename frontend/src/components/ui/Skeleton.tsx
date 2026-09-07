/**
 * El bloque de carga, definido una sola vez.
 *
 * Había seis tratamientos distintos del mismo efecto repartidos por la
 * aplicación —`bg-slate-100 dark:bg-white/5`, `dark:bg-slate-800`,
 * `dark:bg-slate-700/60`, `bg-gray-200`…— y el más usado era invisible en modo
 * oscuro: `white/5` sobre la tarjeta oscura (#1a1b22) es un 4% de diferencia,
 * así que no se notaba que hubiera nada cargando.
 *
 * `slate-700/70` sobre esa tarjeta da un escalón claro, y en claro `slate-200`
 * se ve sobre el blanco sin llamar la atención más que los datos que va a
 * sustituir. `motion-reduce` respeta a quien pide menos movimiento: el bloque
 * se queda quieto, pero sigue ahí.
 */
export const SKELETON =
  'animate-pulse rounded bg-slate-200 motion-reduce:animate-none dark:bg-slate-700/70';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`${SKELETON} ${className}`} aria-hidden />;
}
