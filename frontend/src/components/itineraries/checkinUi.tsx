import { memo } from 'react';
import type { CheckinStatusFilter, CheckinCounts, Flight } from '../../types';

// La presentación del check-in (estados, colores y esqueletos de carga) de la pantalla de vuelos.

/**
 * Los tres estados que acepta `GET /flights/checkins`. Fuera del componente
 * para que el array no se recree en cada render.
 */
export const FILTROS_CHECKIN: { id: CheckinStatusFilter; label: string }[] = [
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'critico', label: 'Críticos' },
  { id: 'realizado', label: 'Realizados' },
  { id: 'cancelado', label: 'Cancelados' },
];

/** Contadores en cero, mientras la primera respuesta no ha llegado. */
export const COUNTS_VACIOS: CheckinCounts = { pendiente: 0, realizado: 0, cancelado: 0, critico: 0, total: 0 };

export const TITULOS_CHECKIN: Record<CheckinStatusFilter, string> = {
  pendiente: 'Pasajeros Pendientes',
  critico: 'Check-ins Críticos',
  realizado: 'Check-ins Realizados',
  cancelado: 'Check-ins Cancelados',
};

/** Cómo se nombra cada estado dentro del mensaje de lista vacía. */
export const VACIO_CHECKIN: Record<CheckinStatusFilter, string> = {
  pendiente: 'pendiente para los próximos vuelos',
  critico: 'crítico en las próximas 48 horas',
  realizado: 'realizado',
  cancelado: 'cancelado',
};

/**
 * Color del punto de estado en el calendario.
 *
 * El ROJO queda reservado para cancelado, que es lo que pidió el usuario. Antes
 * lo usaba "vencido", y con los dos en rojo el color no distinguiría "el
 * check-in se pasó de fecha" de "el vuelo se canceló". Vencido pasa a ámbar,
 * que además le encaja mejor: es un aviso, no una cancelación.
 */
export const ESTADO_PUNTO = (cancelado: boolean, realizado: boolean, vencido: boolean) =>
  cancelado ? 'bg-red-500 ring-2 ring-red-200 dark:ring-red-900/50'
    : realizado ? 'bg-green-500'
    : vencido ? 'bg-amber-500'
    : 'bg-yellow-400';

export const ESTADO_TITULO = (cancelado: boolean, realizado: boolean, vencido: boolean) =>
  cancelado ? 'Check-in cancelado'
    : realizado ? 'Check-in realizado'
    : vencido ? 'Check-in vencido'
    : 'Check-in pendiente';

/**
 * Presentación de cada estado del check-in.
 *
 * Esto es el arreglo del fallo: la fila decidía su icono y su insignia SOLO con
 * aritmética de fechas (`isVencido`/`isUrgente`), sin leer nunca `flight.checkin`.
 * Resultado: un check-in cancelado o realizado se pintaba igual que uno
 * pendiente a futuro —avión azul, sin insignia—, así que al cambiar de filtro
 * las filas parecían las mismas y el filtro daba la impresión de no funcionar.
 *
 * El estado guardado manda; vencido y urgente solo matizan a los pendientes.
 */
export const ESTADO_FILA = {
  cancelado: {
    label: 'CANCELADO',
    insignia: 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/60',
    icono: 'bg-red-50 dark:bg-red-950/40 border-red-100 dark:border-red-900/40 text-red-500 dark:text-red-400',
  },
  realizado: {
    label: 'REALIZADO',
    insignia: 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/60',
    icono: 'bg-green-50 dark:bg-green-950/40 border-green-100 dark:border-green-900/40 text-green-600 dark:text-green-400',
  },
  urgente: {
    label: 'URGENTE',
    insignia: 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50',
    icono: 'bg-red-50 dark:bg-red-950/40 border-red-100 dark:border-red-900/40 text-red-500 dark:text-red-400 animate-pulse',
  },
  vencido: {
    // Ámbar, no rojo: el rojo queda para cancelado en toda la pantalla.
    label: 'VENCIDO',
    insignia: 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60',
    icono: 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/40 text-amber-600 dark:text-amber-400',
  },
  pendiente: {
    label: 'PENDIENTE',
    insignia: 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-900/60',
    icono: 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/40 text-blue-500 dark:text-blue-400',
  },
} as const;

export type ClaveEstadoFila = keyof typeof ESTADO_FILA;

/** Resuelve qué presentación toca. El estado guardado tiene prioridad. */
export function claveEstadoFila(checkin: string | undefined, vencido: boolean, urgente: boolean): ClaveEstadoFila {
  if (checkin === 'cancelado') return 'cancelado';
  if (checkin === 'realizado') return 'realizado';
  if (urgente) return 'urgente';
  if (vencido) return 'vencido';
  return 'pendiente';
}

/**
 * Insignia de estado. Fuera del componente y memoizada: se pintan hasta 10 por
 * página y no dependen de nada más que de su propia clave.
 */
export const InsigniaEstado = memo(function InsigniaEstado({ clave }: { clave: ClaveEstadoFila }) {
  const e = ESTADO_FILA[clave];
  return (
    <span className={`text-xs font-bold px-1.5 py-0.5 rounded tracking-wide ${e.insignia}`}>
      {e.label}
    </span>
  );
});

/** Filas de esqueleto en la primera carga, cuando aún no hay contadores. */
export const ESQUELETO_POR_DEFECTO = 3;

/**
 * Fila fantasma mientras llega la respuesta.
 *
 * Reproduce la geometría de una fila real —icono de 48px, dos líneas de texto y
 * el hueco de la acción— para que al llegar los datos no salte la maquetación.
 * Fuera del componente y memoizada: no depende de nada, así que se monta una vez
 * por posición y no se vuelve a renderizar.
 */
export const FilaEsqueleto = memo(function FilaEsqueleto() {
  return (
    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse">
      <div className="flex items-start gap-4 flex-1">
        <div className="w-12 h-12 rounded-2xl bg-gray-200 dark:bg-slate-700/60 shrink-0" />
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-40 max-w-[45%] rounded bg-gray-200 dark:bg-slate-700/60" />
            <div className="h-3 w-16 rounded bg-gray-200 dark:bg-slate-700/70" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-24 rounded bg-gray-200 dark:bg-slate-700/70" />
            <div className="h-3 w-28 rounded bg-gray-200 dark:bg-slate-700/70" />
            <div className="h-3 w-20 rounded bg-gray-200 dark:bg-slate-700/70" />
          </div>
        </div>
      </div>
      <div className="h-8 w-36 rounded-lg bg-gray-200 dark:bg-slate-700/60 shrink-0" />
    </div>
  );
});

/**
 * Esqueleto para cuando lo que va a llegar es una lista vacía.
 *
 * Antes, con la predicción a 0, no se pintaba nada y se mostraba el mensaje de
 * "no hay registros" de inmediato. Eso afirma un resultado que todavía no ha
 * llegado: si los contadores están rancios —se busca algo que deja un estado en
 * 0 y luego se borra la búsqueda— aparecía el mensaje de vacío y después las
 * filas. Mejor esperar mostrando que se está esperando.
 *
 * Copia la geometría del bloque vacío (p-12, círculo de 64px, dos líneas) para
 * que al resolverse no cambie la altura.
 */
export const EsqueletoVacio = memo(function EsqueletoVacio() {
  return (
    <div className="flex flex-col items-center justify-center p-12 animate-pulse">
      <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-slate-700/60 mb-4" />
      <div className="h-4 w-44 rounded bg-gray-200 dark:bg-slate-700/60 mb-2" />
      <div className="h-3 w-64 max-w-full rounded bg-gray-200 dark:bg-slate-700/70" />
    </div>
  );
});

/** En qué punto está el check-in de un vuelo: lo guardado manda, y la fecha (de Bogotá) matiza a los pendientes. */
export function getFlightStatus(flight: Flight) {
  // Cancelado manda sobre todo lo demás: un vuelo cancelado no está vencido
  // ni urgente, ya no hay nada que hacer con él.
  if (flight.checkin === 'cancelado') {
    return { isCancelado: true, isRealizado: false, isVencido: false, isUrgente: false };
  }
  if (flight.checkin === 'realizado') {
    return { isCancelado: false, isRealizado: true, isVencido: false, isUrgente: false };
  }
  // La fecha y la hora del vuelo son de Bogotá (UTC-5, sin horario de verano):
  // con la hora local del navegador, quien mira desde otra zona ve vencido o
  // urgente un vuelo que aún no lo es (y al revés).
  const flightDateTime = new Date(`${flight.date}T${flight.time || '00:00'}:00-05:00`);
  const now = new Date();
  const isVencido = flightDateTime < now;
  const isUrgente = !isVencido && (flightDateTime.getTime() <= now.getTime() + (48 * 60 * 60 * 1000));
  return { isCancelado: false, isRealizado: false, isVencido, isUrgente };
}
