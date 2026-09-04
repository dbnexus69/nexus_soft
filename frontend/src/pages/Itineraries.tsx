import { useState, useMemo, useEffect, memo } from 'react';
import { 
  ChevronLeft, ChevronRight, Plane, X, Calendar as CalendarIcon, 
  UserCheck, PlaneTakeoff, PlaneLanding, Search, Filter, AlertCircle,
  Clock, CheckCircle2, XCircle, UploadCloud, ExternalLink, Package
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useData } from '../context/DataContext';
import { usePermissions } from '../context/PermissionsContext';
import { Modal } from '../components/ui/Modal';
import { FormField } from '../components/ui/Form';
import { formatDate, formatDateTime } from '../utils/formatters';
import { Pagination } from '../components/ui/Pagination';
import * as api from '../api';
import { Flight, CheckinCounts, CheckinStatusFilter } from '../types';
import LoadingScreen from '../components/ui/LoadingScreen';

/** Mínimo y máximo del motivo de cancelación; los mismos que valida el servidor. */
const MOTIVO_MIN = 5;
const MOTIVO_MAX = 255;

/** Vuelos pendientes de check-in por página. */
const CHECKIN_PER_PAGE = 10;

/**
 * Los tres estados que acepta `GET /flights/checkins`. Fuera del componente
 * para que el array no se recree en cada render.
 */
const FILTROS_CHECKIN: { id: CheckinStatusFilter; label: string }[] = [
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'critico', label: 'Críticos' },
  { id: 'realizado', label: 'Realizados' },
  { id: 'cancelado', label: 'Cancelados' },
];

/** Contadores en cero, mientras la primera respuesta no ha llegado. */
const COUNTS_VACIOS: CheckinCounts = { pendiente: 0, realizado: 0, cancelado: 0, critico: 0, total: 0 };

const TITULOS_CHECKIN: Record<CheckinStatusFilter, string> = {
  pendiente: 'Pasajeros Pendientes',
  critico: 'Check-ins Críticos',
  realizado: 'Check-ins Realizados',
  cancelado: 'Check-ins Cancelados',
};

/** Cómo se nombra cada estado dentro del mensaje de lista vacía. */
const VACIO_CHECKIN: Record<CheckinStatusFilter, string> = {
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
const ESTADO_PUNTO = (cancelado: boolean, realizado: boolean, vencido: boolean) =>
  cancelado ? 'bg-red-500 ring-2 ring-red-200 dark:ring-red-900/50'
    : realizado ? 'bg-green-500'
    : vencido ? 'bg-amber-500'
    : 'bg-yellow-400';

const ESTADO_TITULO = (cancelado: boolean, realizado: boolean, vencido: boolean) =>
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
const ESTADO_FILA = {
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

type ClaveEstadoFila = keyof typeof ESTADO_FILA;

/** Resuelve qué presentación toca. El estado guardado tiene prioridad. */
function claveEstadoFila(checkin: string | undefined, vencido: boolean, urgente: boolean): ClaveEstadoFila {
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
const InsigniaEstado = memo(function InsigniaEstado({ clave }: { clave: ClaveEstadoFila }) {
  const e = ESTADO_FILA[clave];
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide ${e.insignia}`}>
      {e.label}
    </span>
  );
});

/** Filas de esqueleto en la primera carga, cuando aún no hay contadores. */
const ESQUELETO_POR_DEFECTO = 3;

/**
 * Fila fantasma mientras llega la respuesta.
 *
 * Reproduce la geometría de una fila real —icono de 48px, dos líneas de texto y
 * el hueco de la acción— para que al llegar los datos no salte la maquetación.
 * Fuera del componente y memoizada: no depende de nada, así que se monta una vez
 * por posición y no se vuelve a renderizar.
 */
const FilaEsqueleto = memo(function FilaEsqueleto() {
  return (
    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse">
      <div className="flex items-start gap-4 flex-1">
        <div className="w-12 h-12 rounded-2xl bg-gray-200 dark:bg-slate-700/60 shrink-0" />
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-40 max-w-[45%] rounded bg-gray-200 dark:bg-slate-700/60" />
            <div className="h-3 w-16 rounded bg-gray-100 dark:bg-slate-800" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-24 rounded bg-gray-100 dark:bg-slate-800" />
            <div className="h-3 w-28 rounded bg-gray-100 dark:bg-slate-800" />
            <div className="h-3 w-20 rounded bg-gray-100 dark:bg-slate-800" />
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
const EsqueletoVacio = memo(function EsqueletoVacio() {
  return (
    <div className="flex flex-col items-center justify-center p-12 animate-pulse">
      <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-slate-700/60 mb-4" />
      <div className="h-4 w-44 rounded bg-gray-200 dark:bg-slate-700/60 mb-2" />
      <div className="h-3 w-64 max-w-full rounded bg-gray-100 dark:bg-slate-800" />
    </div>
  );
});

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAYS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

export default function Itineraries() {
  const { data, updateFlight, flightsRefreshToken } = useData();
  const { canEdit: canEditItinerary, canView } = usePermissions();
  const [isLoading, setIsLoading] = useState(true);
  // Se incrementa tras un check-in para releer las listas del servidor.
  const [refreshToken, setRefreshToken] = useState(0);
  const [activeTab, setActiveTab] = useState<'calendar' | 'checkin'>('calendar');
  const [calendarTab, setCalendarTab] = useState<'ida' | 'regreso'>('ida');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [checkinSearch, setCheckinSearch] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [selectedFlightForCheckin, setSelectedFlightForCheckin] = useState<Flight | null>(null);
  const [checkinFiles, setCheckinFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [flightToCancel, setFlightToCancel] = useState<Flight | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCanceling, setIsCanceling] = useState(false);

  const getFlightStatus = (flight: Flight) => {
    // Cancelado manda sobre todo lo demás: un vuelo cancelado no está vencido
    // ni urgente, ya no hay nada que hacer con él.
    if (flight.checkin === 'cancelado') {
      return { isCancelado: true, isRealizado: false, isVencido: false, isUrgente: false };
    }
    if (flight.checkin === 'realizado') {
      return { isCancelado: false, isRealizado: true, isVencido: false, isUrgente: false };
    }
    const [yr, mo, dy] = flight.date.split('-').map(Number);
    const [hr, mn] = (flight.time || '00:00').split(':').map(Number);
    const flightDateTime = new Date(yr, mo - 1, dy, hr, mn, 0);
    const now = new Date();
    const isVencido = flightDateTime < now;
    const isUrgente = !isVencido && (flightDateTime.getTime() <= now.getTime() + (48 * 60 * 60 * 1000));
    return { isCancelado: false, isRealizado: false, isVencido, isUrgente };
  };

  // ── Datos del calendario: solo los vuelos del mes visible ────────────────
  // Antes se traían todos los vuelos y se filtraba el mes en el navegador.
  const [monthFlights, setMonthFlights] = useState<Flight[]>([]);

  useEffect(() => {
    const desde = new Date(currentYear, currentMonth, 1);
    const hasta = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    let vivo = true;
    api.listFlights({
      dateFrom: desde.toISOString(),
      dateTo: hasta.toISOString(),
      perPage: 100,
    })
      .then((res: any) => { if (vivo) setMonthFlights(res?.data || []); })
      .catch(() => { if (vivo) setMonthFlights([]); })
      .finally(() => { if (vivo) setIsLoading(false); });
    return () => { vivo = false; };
    // flightsRefreshToken: el botón de refrescar de la cabecera y del menú.
  }, [currentMonth, currentYear, refreshToken, flightsRefreshToken]);

  // ── Check-in: una sola petición, paginada y buscada en el servidor ───────
  //
  // Antes eran tres llamadas a GET /flights con filtros distintos: la lista y
  // dos con perPage:1 de las que solo se leía meta.total. Ahora los contadores
  // vienen en meta.counts de esta misma respuesta, calculados en SQL.
  const [pending, setPending] = useState<Flight[]>([]);
  const [pendingMeta, setPendingMeta] = useState({ total: 0, totalPages: 0 });
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [counts, setCounts] = useState<CheckinCounts>(COUNTS_VACIOS);
  /**
   * Si los contadores en memoria sirven para predecir la próxima respuesta.
   *
   * Falso en la primera carga (aún son cero, y "cero" no es lo mismo que
   * "todavía no sé") y tras cambiar la búsqueda: los contadores se calculan
   * sobre el filtro base, que INCLUYE la búsqueda, así que al cambiarla los que
   * hay en memoria son de la búsqueda anterior. Con el estado, en cambio, siguen
   * siendo válidos, porque no dependen de él.
   */
  const [prediccionValida, setPrediccionValida] = useState(false);
  const [checkinStatus, setCheckinStatus] = useState<CheckinStatusFilter>('pendiente');

  // El reseteo de página va en los manejadores, NO en un efecto.
  //
  // Con `useEffect(() => setPendingPage(1), [checkinStatus])` el cambio de
  // filtro disparaba DOS peticiones: la primera con el estado nuevo y la página
  // vieja, y la segunda ya con página 1. Estando en la página 2 y cambiando de
  // filtro, la primera pedía una página que en el estado nuevo puede no existir
  // y la lista aparecía vacía; si además las respuestas se cruzaban, se quedaba
  // vacía. Un filtro que responde con una lista vacía parece un filtro roto.
  const cambiarEstado = (estado: CheckinStatusFilter) => {
    setCheckinStatus(estado);
    setPendingPage(1);
  };

  const cambiarBusqueda = (texto: string) => {
    setCheckinSearch(texto);
    setPendingPage(1);
    // Los contadores que hay en memoria son de la búsqueda anterior: dejan de
    // servir para predecir la forma de la espera.
    setPrediccionValida(false);
  };

  useEffect(() => {
    let vivo = true;
    setPendingLoading(true);
    const t = setTimeout(() => {
      api.listCheckins({
        status: checkinStatus,
        search: checkinSearch || undefined,
        page: pendingPage,
        perPage: CHECKIN_PER_PAGE,
      })
        .then((res: any) => {
          if (!vivo) return;
          setPending(res?.data || []);
          setPendingMeta({ total: res?.meta?.total || 0, totalPages: res?.meta?.totalPages || 0 });
          setCounts(res?.meta?.counts || COUNTS_VACIOS);
          setPrediccionValida(true);
        })
        .catch(() => { if (vivo) { setPending([]); setCounts(COUNTS_VACIOS); setPrediccionValida(true); } })
        .finally(() => { if (vivo) setPendingLoading(false); });
    }, checkinSearch ? 300 : 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [pendingPage, checkinSearch, checkinStatus, refreshToken, flightsRefreshToken]);

  // El vuelo ya trae los datos de su titular: no hace falta cruzarlo con el
  // catálogo de clientes.
  const modalClient = selectedFlightForCheckin
    ? {
        docType: selectedFlightForCheckin.clientDocType,
        docNumber: selectedFlightForCheckin.clientDocNumber,
        email: selectedFlightForCheckin.clientEmail,
      }
    : null;

  const flightsIda = monthFlights.filter(f => f.type === 'ida');
  const flightsRegreso = monthFlights.filter(f => f.type === 'regreso');

  const currentMonthFlights = useMemo(() => {
    return monthFlights
      .filter(f => f.type === calendarTab)
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  }, [monthFlights, calendarTab]);

  // La lista del check-in ya viene filtrada y paginada del servidor.
  const filteredPending = pending;

  /**
   * Cuántas filas fantasma pintar mientras llega la respuesta.
   *
   * Los contadores de `meta.counts` NO dependen del filtro de estado —se
   * calculan sobre el filtro base—, así que al cambiar de filtro el contador del
   * estado nuevo ya está en memoria y predice exactamente cuántas filas trae la
   * página 1. El esqueleto sale con la altura final y no hay salto.
   *
   * Un 0 no significa "no esperes": significa que la espera se dibuja con la
   * forma del bloque vacío en vez de con filas (ver EsqueletoVacio).
   */
  const filasEsqueleto = prediccionValida
    ? Math.min(counts[checkinStatus], CHECKIN_PER_PAGE)
    : ESQUELETO_POR_DEFECTO;

  // Mientras carga se muestra esqueleto SIEMPRE. La predicción no decide si
  // esperar, solo qué forma tiene la espera: filas si se esperan filas, o el
  // bloque vacío si se espera que no haya ninguna.
  const mostrandoEsqueleto = pendingLoading;

  /**
   * Total y páginas que muestra el paginador.
   *
   * `pendingMeta` es del filtro ANTERIOR mientras la petición está en vuelo, así
   * que durante la carga mostraría "Mostrando 1-6 de 6" junto a un esqueleto de
   * dos filas. Se usa el contador del estado nuevo, que ya es el valor correcto:
   * `meta.total` y `counts[status]` cuentan lo mismo con el mismo filtro.
   */
  const totalPaginador = pendingLoading && prediccionValida ? counts[checkinStatus] : pendingMeta.total;
  const paginasPaginador = pendingLoading && prediccionValida
    ? Math.ceil(counts[checkinStatus] / CHECKIN_PER_PAGE)
    : pendingMeta.totalPages;

  const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const changeMonth = (delta: number) => {
    let newMonth = currentMonth + delta;
    let newYear = currentYear;
    if (newMonth > 11) { newMonth = 0; newYear++; }
    if (newMonth < 0) { newMonth = 11; newYear--; }
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  };

  const handleMarkCheckin = (flightId: string, passenger: string) => {
    if (!canEditItinerary('itineraries')) return;
    const flight = [...monthFlights, ...pending].find(f => f.id === flightId);
    if (flight) {
      setSelectedFlightForCheckin(flight);
      setIsCheckinModalOpen(true);
      setCheckinFiles([]);
    }
  };

  const handleOpenCancel = (flight: Flight) => {
    setFlightToCancel(flight);
    setCancelReason('');
  };

  // El mínimo se comprueba también aquí para dar aviso inmediato; el servidor lo
  // valida igual y es quien manda (422 con el detalle por campo).
  const cancelReasonValido = cancelReason.trim().length >= MOTIVO_MIN;

  const confirmCancel = async () => {
    if (!flightToCancel || !cancelReasonValido) return;
    setIsCanceling(true);
    try {
      await api.cancelCheckin(flightToCancel.id, cancelReason.trim());
      setFlightToCancel(null);
      setCancelReason('');
      setRefreshToken(t => t + 1);
      setSuccessMessage(`Check-in cancelado para ${flightToCancel.passenger}`);
      setShowSuccess(true);
    } catch (err: any) {
      const detalle = err?.response?.data?.error;
      setErrorMessage(detalle?.details?.[0]?.message || detalle?.message || 'Error al cancelar el check-in');
      setShowError(true);
    } finally {
      setIsCanceling(false);
    }
  };

  const confirmCheckin = async () => {
    if (!selectedFlightForCheckin) return;

    setIsSending(true);
    try {
      if (checkinFiles.length > 0) {
        const formData = new FormData();
        formData.append('checkin', 'realizado');
        checkinFiles.forEach(file => {
          formData.append('files', file);
        });
        await updateFlight(selectedFlightForCheckin.id, formData);
      } else {
        await updateFlight(selectedFlightForCheckin.id, { checkin: 'realizado' });
      }
      setIsCheckinModalOpen(false);
      // Las listas viven en el servidor: se releen en vez de parchearse aquí.
      setRefreshToken(t => t + 1);
      setSuccessMessage(`Check-in realizado para ${selectedFlightForCheckin.passenger}`);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Error al realizar check-in';
      setErrorMessage(msg);
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
    } finally {
      setIsSending(false);
    }
  };

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
    const daysInPrevMonth = getDaysInMonth(currentMonth - 1, currentYear);
    const days: { day: number; month: number; year: number; flights: Flight[] }[] = [];

    // Rellenar días del mes anterior
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      days.push({ day, month: prevMonth, year: prevYear, flights: [] });
    }

    // Días del mes actual
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayFlights = monthFlights.filter(f => f.date === dateStr && f.type === calendarTab);
      days.push({ day: i, month: currentMonth, year: currentYear, flights: dayFlights });
    }

    // Rellenar días del mes siguiente
    while (days.length % 7 !== 0) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      days.push({ day: days.length - firstDay - daysInMonth + 1, month: nextMonth, year: nextYear, flights: [] });
    }

    return days;
  }, [currentMonth, currentYear, monthFlights, calendarTab]);

  const toggleDay = (dayKey: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayKey)) next.delete(dayKey);
      else next.add(dayKey);
      return next;
    });
  };

  const getDayKey = (day: number, month: number, year: number) => 
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  if (!canView('itineraries')) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500">
        <AlertCircle size={48} className="mb-4 opacity-20" />
        <p className="text-lg font-medium">Acceso Restringido</p>
        <p className="text-sm">No tiene permisos para ver itinerarios.</p>
      </div>
    );
  }

  if (isLoading && monthFlights.length === 0) {
    return <LoadingScreen fullScreen={false} />;
  }

  return (
    <div className="space-y-6 relative">
      {showSuccess && (
        <div className="fixed top-20 right-6 z-[200] bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 animate-slide-in-right">
          <div className="bg-green-500 text-white rounded-full p-1">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <p className="font-bold text-sm">Operación Exitosa</p>
            <p className="text-xs opacity-90">{successMessage}</p>
          </div>
        </div>
      )}

      {showError && (
        <div className="fixed top-20 right-6 z-[200] bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 animate-slide-in-right">
          <div className="bg-red-500 text-white rounded-full p-1">
            <X size={18} />
          </div>
          <div>
            <p className="font-bold text-sm">Error</p>
            <p className="text-xs opacity-90">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Header y Navegación Principal */}
      <div className="flex flex-col items-center justify-center gap-4 animate-fade-in text-center mb-4">
        <div className="flex flex-col items-center justify-center">
          <h1 className="text-3xl font-bold text-primary flex items-center justify-center gap-3">
            <CalendarIcon className="text-accent w-8 h-8" /> Itinerarios de Vuelo
          </h1>
          <p className="text-gray-500 text-sm mt-1">Seguimiento de salidas, regresos y gestión de check-in.</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-border w-fit h-fit">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'calendar' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <CalendarIcon size={16} /> Calendario
          </button>
          <button
            onClick={() => setActiveTab('checkin')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all relative ${activeTab === 'checkin' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <UserCheck size={16} /> Check-in
            {/* Siempre los pendientes: pendingMeta.total depende del filtro
                activo, así que en "Realizados" mostraría el número equivocado. */}
            {counts.pendiente > 0 ? (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                {counts.pendiente}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {activeTab === 'calendar' ? (
        <div className="animate-fade-in space-y-6">
          {/* Sub-navegación para el Calendario */}
          <div className="flex bg-gray-100/50 dark:bg-slate-800/50 p-1 rounded-xl w-full sm:w-fit mx-auto border border-gray-border dark:border-slate-700">
            <button
              onClick={() => setCalendarTab('ida')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${calendarTab === 'ida' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-blue-400'}`}
            >
              <PlaneTakeoff size={15} /> Vuelos de Ida ({flightsIda.length})
            </button>
            <button
              onClick={() => setCalendarTab('regreso')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${calendarTab === 'regreso' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-indigo-400'}`}
            >
              <PlaneLanding size={15} /> Vuelos de Regreso ({flightsRegreso.length})
            </button>
          </div>

          {/* Controles del Calendario */}
          <Card className="overflow-hidden border-none shadow-lg">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-800 border-b border-gray-border dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between sm:justify-start gap-3 sm:gap-4">
                <div className="flex items-center gap-1">
                  <select
                    value={currentMonth}
                    onChange={(e) => setCurrentMonth(Number(e.target.value))}
                    className="text-base sm:text-lg font-bold text-primary dark:text-white bg-transparent outline-none cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 rounded p-1"
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={currentYear}
                    onChange={(e) => setCurrentYear(Number(e.target.value))}
                    className="text-base sm:text-lg font-bold text-primary dark:text-white bg-transparent outline-none cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 rounded p-1"
                  >
                    {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 3 + i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-900/50 p-1 rounded-lg border border-gray-border dark:border-slate-700">
                  <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-md transition-all text-gray-500 dark:text-slate-400">
                    <ChevronLeft size={18} />
                  </button>
                  <button onClick={() => { setCurrentMonth(new Date().getMonth()); setCurrentYear(new Date().getFullYear()); }} className="px-2 py-1 text-xs font-bold text-primary dark:text-white hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-md transition-all">
                    HOY
                  </button>
                  <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-md transition-all text-gray-500 dark:text-slate-400">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-end text-xs font-medium text-gray-500">
                <div className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded-full ${calendarTab === 'ida' ? 'bg-blue-500' : 'bg-indigo-600'}`}></div> 
                  Mostrando {calendarTab === 'ida' ? 'Salidas' : 'Regresos'}
                </div>
              </div>
            </div>

            <CardBody className="p-0">
              {/* Desktop Calendar Grid */}
              <div className="hidden sm:block">
                <div className="grid grid-cols-7 bg-gray-50/50 dark:bg-slate-900/50">
                  {DAYS.map(day => (
                    <div key={day} className="py-3 text-center text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest border-r border-gray-border/50 dark:border-slate-700 last:border-r-0">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 border-t border-gray-border/50 dark:border-slate-700">
                  {calendarDays.map((item, i) => {
                    const isOtherMonth = item.month !== currentMonth;
                    const dayKey = getDayKey(item.day, item.month, item.year);
                    const isExpanded = expandedDays.has(dayKey);
                    const isToday = dayKey === todayStr;
                    const dayFlights = item.flights;
                    const displayFlights = isExpanded ? dayFlights : dayFlights.slice(0, 3);
                    
                    return (
                      <div
                        key={i}
                        className={`min-h-[140px] p-2 border-r border-b border-gray-border/50 dark:border-slate-700 relative group transition-colors ${isOtherMonth ? 'bg-gray-50/30 dark:bg-slate-800/20' : 'bg-white dark:bg-slate-800 hover:bg-primary/[0.02] dark:hover:bg-slate-700/50'}`}
                      >
                        <div className={`text-xs font-bold mb-2 flex items-center justify-center w-7 h-7 rounded-full transition-all ${isToday ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-110' : isOtherMonth ? 'text-gray-300 dark:text-slate-600' : 'text-gray-500 dark:text-slate-300'}`}>
                          {item.day}
                        </div>

                        <div className="space-y-1">
                          {displayFlights.map(flight => {
                            const client = {
                              avatar: flight.clientAvatar,
                              name: flight.clientName,
                              docType: flight.clientDocType,
                              docNumber: flight.clientDocNumber,
                            };
                            const docInfo = client ? `\n${client.docType}: ${client.docNumber}` : '';
                            const isPlan = flight.source === 'plan';
                            return (
                            <div
                              key={flight.id}
                              title={`${isPlan ? '📦 ' : ''}${flight.passenger}${docInfo}\nHora: ${flight.time}\nCheck-in: ${isPlan ? 'N/A (Paquete)' : flight.checkin}${flight.reservationNumber ? `\nReserva: ${flight.reservationNumber}` : ''}${isPlan ? `\nPlan: ${flight.route}` : ''}${isPlan && flight.additionalPassengers ? `\nAcompañantes: ${flight.additionalPassengers}` : ''}`}
                              className={`px-2 py-1 rounded-md text-[10px] font-semibold border flex items-center gap-1 shadow-sm transition-transform hover:scale-[1.02] ${
                                 isPlan
                                   ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300'
                                   : flight.type === 'ida' 
                                     ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-800/50 text-blue-700 dark:text-blue-300' 
                                     : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-800/50 text-indigo-800 dark:text-indigo-300'
                               }`}
                            >
                              {isPlan ? <Package size={10} className="shrink-0" /> : flight.type === 'ida' ? <PlaneTakeoff size={10} className="shrink-0" /> : <PlaneLanding size={10} className="shrink-0" />}
                              <span className="truncate flex-1">{flight.passenger}</span>
                              <span className="opacity-60 shrink-0">{flight.time}</span>
                              {!isPlan && (() => {
                                 const { isCancelado, isRealizado, isVencido } = getFlightStatus(flight);
                                 return (
                                   <span title={ESTADO_TITULO(isCancelado, isRealizado, isVencido)}
                                     className={`w-1.5 h-1.5 rounded-full shrink-0 ${ESTADO_PUNTO(isCancelado, isRealizado, isVencido)}`}
                                   />
                                 );
                               })()}
                            </div>
                            );
                          })}
                        </div>

                        {dayFlights.length > 3 && (
                          <button
                            onClick={() => toggleDay(dayKey)}
                            className="mt-2 w-full py-1 text-[9px] font-bold text-accent uppercase tracking-tighter hover:bg-accent/5 rounded transition-colors border border-accent/10"
                          >
                            {isExpanded ? 'Ver menos' : `+${dayFlights.length - 3} más vuelos`}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mobile List View */}
              <div className="block sm:hidden p-4 space-y-4 bg-gray-50/30 dark:bg-slate-900/30">
                {currentMonthFlights.length > 0 ? (
                  <div className="space-y-3">
                    {currentMonthFlights.map(flight => {
                      const client = {
                              avatar: flight.clientAvatar,
                              name: flight.clientName,
                              docType: flight.clientDocType,
                              docNumber: flight.clientDocNumber,
                            };
                      const parts = flight.date.split('-');
                      const dayStr = parts[2] || '';
                      const dayOfWeekIndex = new Date(flight.date + 'T00:00:00').getDay();
                      const dayOfWeek = DAYS[isNaN(dayOfWeekIndex) ? 0 : dayOfWeekIndex];
                      
                      return (
                        <div key={flight.id} className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex flex-col items-center justify-center bg-primary/5 text-primary rounded-lg w-10 h-10 shrink-0 font-bold">
                              <span className="text-[8px] uppercase font-semibold text-gray-400 leading-none">{dayOfWeek}</span>
                              <span className="text-sm font-heading leading-tight mt-0.5">{Number(dayStr) || dayStr}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-gray-850 truncate">{flight.passenger}</span>
                                {client && (
                                  <span className="text-[8px] bg-gray-100 text-gray-500 px-1 py-0.2 rounded shrink-0 border border-gray-150">
                                    {client.docNumber}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-500 truncate mt-0.5">{flight.route} · {flight.time} · {flight.airline}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {flight.source === 'plan' ? (
                              <>
                                <Package size={14} className="text-emerald-500" />
                                <span className="text-[9px] font-semibold text-emerald-500 uppercase tracking-wider">Paquete</span>
                              </>
                            ) : (() => {
                              const { isCancelado, isRealizado, isVencido } = getFlightStatus(flight);
                              return (
                                <>
                                  <span title={ESTADO_TITULO(isCancelado, isRealizado, isVencido)}
                                    className={`w-2 h-2 rounded-full ${ESTADO_PUNTO(isCancelado, isRealizado, isVencido)}`}
                                  />
                                  <span className={`text-[9px] font-semibold uppercase tracking-wider ${isCancelado ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}`}>
                                    {isCancelado ? 'Cancelado' : isRealizado ? 'Listo' : isVencido ? 'Vencido' : 'Pendiente'}
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-xs">No hay vuelos programados para este mes.</p>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      ) : (
        <div className="animate-fade-in space-y-6">
          {/* Gestión de Check-in */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <Card className="border-none shadow-lg">
                <CardHeader actions={
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    {/* Filtro de estado: sin esto no habría forma de ver los
                        check-ins ya realizados desde la pantalla. */}
                    <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-800/80 p-1 rounded-lg">
                      {FILTROS_CHECKIN.map(f => (
                        <button
                          key={f.id}
                          onClick={() => cambiarEstado(f.id)}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                            checkinStatus === f.id
                              ? 'bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm'
                              : 'text-gray-500 dark:text-slate-400 hover:text-primary dark:hover:text-white'
                          }`}
                        >
                          {f.label} ({counts[f.id]})
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="text"
                        placeholder="Buscar pasajero o ruta..."
                        className="pl-9 pr-10 py-1.5 text-sm bg-gray-50 dark:bg-slate-800/80 border border-gray-border dark:border-slate-700 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                        value={checkinSearch}
                        onChange={e => cambiarBusqueda(e.target.value)}
                      />
                      {checkinSearch ? (
                        <button onClick={() => cambiarBusqueda('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded">
                          <X size={14} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                }>
                  {TITULOS_CHECKIN[checkinStatus]}
                </CardHeader>
                <CardBody className="p-0">
                  {/* El esqueleto va PRIMERO: sin él la lista seguía mostrando
                      las filas del filtro anterior hasta que llegaba la
                      respuesta, y eso es lo que se percibe como retardo. */}
                  {mostrandoEsqueleto ? (
                    <div role="status" aria-busy="true" aria-label="Cargando check-ins">
                      {filasEsqueleto > 0 ? (
                        <div className="divide-y divide-gray-border">
                          {Array.from({ length: filasEsqueleto }, (_, i) => <FilaEsqueleto key={i} />)}
                        </div>
                      ) : (
                        <EsqueletoVacio />
                      )}
                    </div>
                  ) : filteredPending.length > 0 ? (
                    <div className="divide-y divide-gray-border">
                      {filteredPending.map(flight => {
                        const { isVencido, isUrgente } = getFlightStatus(flight);
                        const claveEstado = claveEstadoFila(flight.checkin, isVencido, isUrgente);
                        const client = {
                              avatar: flight.clientAvatar,
                              name: flight.clientName,
                              docType: flight.clientDocType,
                              docNumber: flight.clientDocNumber,
                            };

                        return (
                          <div key={flight.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors ${isVencido ? 'opacity-85' : ''}`}>
                            <div className="flex items-start gap-4">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 ${
                                claveEstado === 'pendiente' && flight.source === 'plan'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/40 text-emerald-500 dark:text-emerald-400'
                                  : ESTADO_FILA[claveEstado].icono
                              }`}>
                                {claveEstado === 'cancelado' ? (
                                  <XCircle size={24} />
                                ) : claveEstado === 'realizado' ? (
                                  <CheckCircle2 size={24} />
                                ) : flight.source === 'plan' ? (
                                  <Package size={24} />
                                ) : (
                                  <Plane size={24} className={flight.type === 'regreso' ? 'rotate-180' : ''} />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-primary dark:text-white truncate">{flight.passenger}</span>
                                  {client && (
                                    <span className="text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                                      {client.docType}: {client.docNumber}
                                    </span>
                                  )}
                                  <InsigniaEstado clave={claveEstado} />
                                  {flight.source === 'plan' && flight.additionalPassengers && flight.additionalPassengers > 0 ? (
                                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/50">
                                      +{flight.additionalPassengers} acompañantes
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-slate-400 mt-1">
                                  <span className="flex items-center gap-1"><Filter size={12} /> {flight.route}</span>
                                  <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(flight.date)} - {flight.time}</span>
                                  <span className="font-medium text-primary/60 dark:text-slate-500">{flight.airline}</span>
                                  {flight.reservationNumber ? (
                                    <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-mono text-[10px] border border-blue-150 dark:border-blue-900/50 font-semibold">
                                      Reserva: {flight.reservationNumber}
                                    </span>
                                  ) : null}
                                </div>
                                {flight.checkin === 'cancelado' && flight.reasonCanceled ? (
                                  <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 flex items-start gap-1">
                                    <XCircle size={12} className="shrink-0 mt-0.5" />
                                    <span className="italic">{flight.reasonCanceled}</span>
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            {/* Cancelado es terminal: se muestra cuándo y por
                                qué, sin ofrecer acciones. En realizado se
                                muestra la fecha y se deja cancelar, porque una
                                aerolínea puede cancelar el vuelo después. */}
                            {flight.checkin === 'cancelado' ? (
                              <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">
                                <XCircle size={14} />
                                {flight.canceledAt ? formatDateTime(flight.canceledAt) : 'Cancelado'}
                              </span>
                            ) : (
                              <div className="flex items-center gap-2 w-full sm:w-auto">
                                {flight.checkin === 'realizado' ? (
                                  <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
                                    <CheckCircle2 size={14} />
                                    {flight.checkinAt ? formatDateTime(flight.checkinAt) : 'Realizado'}
                                  </span>
                                ) : canEditItinerary('itineraries') ? (
                                  <Button
                                    size="sm"
                                    onClick={() => handleMarkCheckin(flight.id, flight.passenger)}
                                    className="shadow-md shadow-primary/10 flex-1 sm:flex-initial justify-center"
                                  >
                                    <UserCheck size={16} /> Realizar Check-in
                                  </Button>
                                ) : null}
                                {canEditItinerary('itineraries') ? (
                                  <button
                                    onClick={() => handleOpenCancel(flight)}
                                    title="Cancelar el check-in de este vuelo"
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors whitespace-nowrap"
                                  >
                                    <XCircle size={14} /> Cancelar
                                  </button>
                                ) : null}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-12 text-gray-400 dark:text-slate-500">
                      <div className="w-16 h-16 bg-green-50 dark:bg-green-950/40 text-green-500 dark:text-green-400 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 size={32} />
                      </div>
                      <p className="font-bold text-gray-600 dark:text-slate-400">
                        {checkinSearch
                          ? 'Sin coincidencias'
                          : checkinStatus === 'realizado'
                            ? 'Aún no hay check-ins realizados'
                            : checkinStatus === 'cancelado'
                              ? 'No hay check-ins cancelados'
                              : '¡Todo al día!'}
                      </p>
                      <p className="text-sm">
                        {checkinSearch
                          ? `Ningún check-in ${VACIO_CHECKIN[checkinStatus]} coincide con la búsqueda.`
                          : `No hay check-ins ${VACIO_CHECKIN[checkinStatus]}.`}
                      </p>
                    </div>
                  )}
                  <Pagination
                    currentPage={pendingPage}
                    totalPages={paginasPaginador}
                    total={totalPaginador}
                    perPage={CHECKIN_PER_PAGE}
                    loading={pendingLoading}
                    onPageChange={setPendingPage}
                    // Con 10 por página y menos de 10 check-ins hay una sola
                    // página y el componente se ocultaba entero, incluido el
                    // total. En una lista con filtros eso parece falta de
                    // paginación, así que aquí el rango se muestra siempre.
                    alwaysShowRange
                    className="px-4 py-3 border-t border-gray-border mt-0"
                  />
                </CardBody>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="bg-primary dark:bg-slate-900 text-white dark:text-slate-100 border-none dark:border dark:border-slate-850 shadow-xl shadow-primary/20 dark:shadow-none">
                <CardBody className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-white/20 dark:bg-slate-800/50 rounded-xl">
                      <Clock size={24} />
                    </div>
                    <Badge variant="accent" className="bg-white/20 dark:bg-slate-800 text-white dark:text-slate-200 border-none">PRÓXIMAS 48H</Badge>
                  </div>
                  <h3 className="text-sm font-medium text-white/80 dark:text-slate-300 uppercase tracking-wider">Check-ins Críticos</h3>
                  <p className="text-3xl font-bold mt-1">
                    {counts.critico}
                  </p>
                  <p className="text-xs text-white/60 dark:text-slate-400 mt-4 leading-relaxed">
                    Recuerda que el check-in debe realizarse al menos 24 horas antes de la salida para evitar inconvenientes.
                  </p>
                </CardBody>
              </Card>

              {/* Las tres cifras salen del mismo meta.counts, así que son
                  coherentes entre sí. Antes "Salidas" y "Regresos" eran del mes
                  visible del calendario y "Completados" un total global: tres
                  números de ámbitos distintos, uno al lado del otro. */}
              <Card className="border-none shadow-lg">
                <CardHeader>Resumen de Check-in</CardHeader>
                <CardBody className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/80 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-lg"><Clock size={18} /></div>
                      <span className="text-sm font-medium text-gray-600 dark:text-slate-300">Pendientes</span>
                    </div>
                    <span className="font-bold text-primary dark:text-white">{counts.pendiente}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/80 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 rounded-lg"><AlertCircle size={18} /></div>
                      <span className="text-sm font-medium text-gray-600 dark:text-slate-300">Críticos</span>
                    </div>
                    <span className="font-bold text-primary dark:text-white">{counts.critico}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/80 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300 rounded-lg"><CheckCircle2 size={18} /></div>
                      <span className="text-sm font-medium text-gray-600 dark:text-slate-300">Realizados</span>
                    </div>
                    <span className="font-bold text-primary dark:text-white">{counts.realizado}</span>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Realizar Check-in y Adjuntar Archivo */}
      <Modal
        isOpen={isCheckinModalOpen}
        onClose={() => !isSending && setIsCheckinModalOpen(false)}
        title="Enviar Check-in"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsCheckinModalOpen(false)} disabled={isSending}>
              Cancelar
            </Button>
            <Button 
              onClick={confirmCheckin} 
              disabled={isSending}
              className="relative"
            >
              {isSending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Enviando...
                </>
              ) : (
                'Enviar al Cliente'
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 rounded-lg">
            <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">Pasajero:</p>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900 dark:!text-[#ffffff]">{selectedFlightForCheckin?.passenger}</p>
              {modalClient && (
                <span className="text-[10px] bg-white/50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800/50 font-bold">
                  {modalClient.docType}: {modalClient.docNumber}
                </span>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-slate-800/80 border border-gray-border dark:border-slate-700 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Ruta:</p>
              <p className="text-sm font-bold text-gray-900 dark:!text-[#ffffff]">{selectedFlightForCheckin?.route}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-slate-800/80 border border-gray-border dark:border-slate-700 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Fecha y Hora:</p>
              <p className="text-sm font-bold text-gray-900 dark:!text-[#ffffff]">
                {selectedFlightForCheckin ? formatDate(selectedFlightForCheckin.date) : ''} {selectedFlightForCheckin?.time}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-slate-800/80 border border-gray-border dark:border-slate-700 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Aerolínea:</p>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-900 dark:!text-[#ffffff]">{selectedFlightForCheckin?.airline}</p>
                {(() => {
                  const airlineInfo = data.config?.airlines?.find((a: any) => a.name === selectedFlightForCheckin?.airline);
                  if (airlineInfo && airlineInfo.website) {
                    const url = airlineInfo.website.startsWith('http') ? airlineInfo.website : `https://${airlineInfo.website}`;
                    return (
                      <a 
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-[10px] text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 hover:underline bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/40 flex items-center gap-1 font-bold transition-colors"
                        title="Ir al sitio web de la aerolínea para Check-in"
                      >
                        <ExternalLink size={10} /> Link Check-in
                      </a>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-slate-800/80 border border-gray-border dark:border-slate-700 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Enviar a:</p>
              <p className="text-sm font-bold text-gray-900 dark:!text-[#ffffff] truncate" title={selectedFlightForCheckin?.email || modalClient?.email}>
                {selectedFlightForCheckin?.email || modalClient?.email || 'Sin correo registrado'}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-slate-800/80 border border-gray-border dark:border-slate-700 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Nº Vuelo:</p>
              <p className="text-sm font-bold text-gray-900 dark:!text-[#ffffff]">{selectedFlightForCheckin?.flightNumber || 'No registrado'}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-slate-800/80 border border-gray-border dark:border-slate-700 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Código Reserva (PNR):</p>
              <p className="text-sm font-bold text-gray-900 dark:!text-[#ffffff] font-mono select-all" title="Click para copiar">{selectedFlightForCheckin?.reservationNumber || 'No registrado'}</p>
            </div>
          </div>

          <FormField label="Adjuntar Documentos de Check-in (Opcional)">
            <div className="relative group mb-3">
              <input
                type="file"
                multiple
                onChange={(e) => {
                  const filesList = Array.from(e.target.files || []);
                  setCheckinFiles(prev => [...prev, ...filesList]);
                  e.target.value = '';
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                accept=".pdf,.jpg,.jpeg,.png"
              />
              <div className="p-6 border-2 border-dashed border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800/50 rounded-xl flex flex-col items-center justify-center gap-1 transition-all group-hover:border-primary group-hover:bg-primary/5">
                <UploadCloud size={28} className="text-gray-300 group-hover:text-primary transition-colors" />
                <p className="text-xs font-bold text-gray-500 uppercase">Seleccionar PDF o Imagen</p>
                <p className="text-[10px] text-gray-400">Haz clic o arrastra aquí (Soporta múltiples archivos)</p>
              </div>
            </div>

            {checkinFiles.length > 0 && (
              <div className="space-y-2 border border-gray-border rounded-xl p-3 bg-gray-50/50 max-h-[160px] overflow-y-auto">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Archivos seleccionados ({checkinFiles.length}):</p>
                {checkinFiles.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="flex items-center justify-between gap-3 p-2 bg-white border border-gray-150 rounded-lg text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                      <span className="font-medium text-gray-700 truncate" title={file.name}>{file.name}</span>
                      <span className="text-[9px] text-gray-400 shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setCheckinFiles(prev => prev.filter((_, i) => i !== idx))} 
                      className="text-red-500 hover:text-red-700 transition-colors p-1"
                      title="Eliminar archivo"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </FormField>

          <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-100 rounded-lg text-[10px] text-amber-700">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <p>Al confirmar, el documento se enviará automáticamente al correo registrado del cliente.</p>
          </div>
        </div>
      </Modal>

      {/* Modal de cancelación del check-in */}
      <Modal
        isOpen={!!flightToCancel}
        onClose={() => setFlightToCancel(null)}
        title="Cancelar Check-in"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setFlightToCancel(null)} disabled={isCanceling}>
              Volver
            </Button>
            <Button
              onClick={confirmCancel}
              disabled={!cancelReasonValido || isCanceling}
              className="bg-red-600 hover:bg-red-700 border-red-600"
            >
              <XCircle size={16} /> {isCanceling ? 'Cancelando...' : 'Cancelar Check-in'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/40 rounded-lg">
            <p className="font-bold text-primary dark:text-white text-sm">{flightToCancel?.passenger}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {flightToCancel?.route} · {flightToCancel ? formatDate(flightToCancel.date) : ''} {flightToCancel?.time}
              {flightToCancel?.flightNumber ? ` · Vuelo ${flightToCancel.flightNumber}` : ''}
            </p>
          </div>

          <FormField label={`Motivo de la cancelación (mínimo ${MOTIVO_MIN} caracteres)`} required>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              maxLength={MOTIVO_MAX}
              rows={3}
              autoFocus
              placeholder="Ej: La aerolínea canceló el vuelo por mantenimiento"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-gray-border dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:text-white resize-none"
            />
            <div className="flex justify-between items-center mt-1">
              <span className={`text-[11px] ${cancelReasonValido ? 'text-gray-400 dark:text-slate-500' : 'text-red-500'}`}>
                {cancelReasonValido ? 'Queda registrado junto a la cancelación.' : `Faltan ${MOTIVO_MIN - cancelReason.trim().length} caracteres.`}
              </span>
              <span className="text-[11px] text-gray-400 dark:text-slate-500">
                {cancelReason.length}/{MOTIVO_MAX}
              </span>
            </div>
          </FormField>

          <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 rounded-lg text-[10px] text-amber-700 dark:text-amber-400">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <p>El vuelo pasará a estado cancelado y se mostrará en rojo en el calendario. No se enviará ningún correo al cliente.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}