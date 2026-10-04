import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, PlaneTakeoff, PlaneLanding, AlertCircle, Package } from 'lucide-react';
import { Card, CardBody } from '../ui/Card';
import { SKELETON } from '../ui/Skeleton';
import * as api from '../../api';
import { fetchAllPages } from '../../api/fetchAll';
import type { Flight } from '../../types';
import { ESTADO_PUNTO, ESTADO_TITULO, getFlightStatus } from './checkinUi';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAYS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

/** El calendario de vuelos del mes (ida o regreso), con su propia carga. `refresco` cambia cuando hay que releerlo. */
export function CalendarioVuelos({ refresco }: { refresco: number }) {
  const [isLoading, setIsLoading] = useState(true);
  // Reintentar tras un fallo de carga.
  const [reintento, setReintento] = useState(0);
  const [calendarTab, setCalendarTab] = useState<'ida' | 'regreso'>('ida');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // ── Datos del calendario: solo los vuelos del mes visible ────────────────
  // Antes se traían todos los vuelos y se filtraba el mes en el navegador.
  const [monthFlights, setMonthFlights] = useState<Flight[]>([]);
  // Mes al que corresponden `monthFlights` y fallo de la última carga: sin ellos,
  // cambiar de mes dejaba los días vacíos "como si no hubiera vuelos" mientras
  // llegaba la respuesta, y un error de red se veía igual que un mes sin vuelos.
  const [mesCargado, setMesCargado] = useState<string | null>(null);
  const [errorCalendario, setErrorCalendario] = useState<string | null>(null);
  const claveMes = `${currentYear}-${currentMonth}`;

  useEffect(() => {
    // El rango se manda como días (AAAA-MM-DD): el servidor los toma como días de
    // Bogotá. Con `toISOString()` de fechas locales del navegador el mes se
    // corría según la zona de quien lo mira.
    const pad = (n: number) => String(n).padStart(2, '0');
    const ultimoDia = new Date(currentYear, currentMonth + 1, 0).getDate();
    const desde = `${currentYear}-${pad(currentMonth + 1)}-01`;
    const hasta = `${currentYear}-${pad(currentMonth + 1)}-${pad(ultimoDia)}`;
    let vivo = true;
    setErrorCalendario(null);
    // `fetchAllPages`, no `perPage: 100` a pelo: el backend topa perPage en 100
    // y aquí no se leía `meta.totalPages`, así que un mes con más de cien
    // tramos perdía el resto sin decir nada — los días afectados salían vacíos
    // en el calendario como si no hubiera vuelos. El rango es un mes, así que
    // recorrer sus páginas está acotado por construcción.
    fetchAllPages<Flight>(api.listFlights, {
      dateFrom: desde,
      dateTo: hasta,
    })
      .then((res) => { if (vivo) { setMonthFlights(res.data); setMesCargado(claveMes); } })
      .catch((err: any) => {
        if (!vivo) return;
        setMonthFlights([]);
        setErrorCalendario(err?.response?.data?.error?.message || 'No se pudieron cargar los vuelos del mes.');
      })
      .finally(() => { if (vivo) setIsLoading(false); });
    return () => { vivo = false; };
    // refresco: el botón de refrescar de la cabecera y los cambios de check-in.
  }, [currentMonth, currentYear, refresco, reintento]);

  const flightsIda = monthFlights.filter(f => f.type === 'ida');
  const flightsRegreso = monthFlights.filter(f => f.type === 'regreso');

  const currentMonthFlights = useMemo(() => {
    return monthFlights
      .filter(f => f.type === calendarTab)
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  }, [monthFlights, calendarTab]);

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

  // "Hoy" según Bogotá, como las fechas de los vuelos.
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

  const calendarioCargando = !errorCalendario && (isLoading || mesCargado !== claveMes);
  const reintentar = () => setReintento(t => t + 1);

  return (
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

      {errorCalendario && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="flex items-center gap-2"><AlertCircle size={16} /> {errorCalendario}</span>
          <button onClick={reintentar} className="font-bold underline underline-offset-2 hover:text-red-900">Reintentar</button>
        </div>
      )}

      {/* Controles del Calendario */}
      <Card className="overflow-hidden border-none shadow-lg">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-800 border-b border-gray-border dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between sm:justify-start gap-3 sm:gap-4">
            <div className="flex items-center gap-1">
              <select
                value={currentMonth}
                onChange={(e) => setCurrentMonth(Number(e.target.value))}
                className="text-base sm:text-lg font-bold text-primary dark:text-white bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 rounded p-1"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
              <select
                value={currentYear}
                onChange={(e) => setCurrentYear(Number(e.target.value))}
                className="text-base sm:text-lg font-bold text-primary dark:text-white bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 rounded p-1"
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
                <div key={day} className="py-3 text-center text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest border-r border-gray-border/50 dark:border-slate-700 last:border-r-0">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 border-t border-gray-border/50 dark:border-slate-700">
              {/* Celdas fantasma con la misma altura que las de verdad, así
                  la rejilla no cambia de tamaño cuando llegan los vuelos. */}
              {calendarioCargando
                ? Array.from({ length: 35 }, (_, i) => (
                    <div
                      key={`hueco-${i}`}
                      className="min-h-[140px] border-r border-b border-gray-border/50 p-2 dark:border-slate-700"
                    >
                      <div className={`${SKELETON} h-4 w-6`} />
                    </div>
                  ))
                : calendarDays.map((item, i) => {
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
                        const docInfo = flight.passengerDocs ? `\n${flight.passengerDocs}` : '';
                        const isPlan = flight.source === 'plan';
                        return (
                        <div
                          key={flight.id}
                          title={`${isPlan ? 'Paquete: ' : ''}${flight.passenger}${docInfo}\nHora: ${flight.time}\nCheck-in: ${isPlan ? 'N/A (Paquete)' : flight.checkin}${flight.reservationNumber ? `\nReserva: ${flight.reservationNumber}` : ''}${isPlan ? `\nPlan: ${flight.route}` : ''}${isPlan && flight.additionalPassengers ? `\nAcompañantes: ${flight.additionalPassengers}` : ''}`}
                          className={`px-2 py-1 rounded-md text-xs font-semibold border flex items-center gap-1 shadow-sm transition-transform hover:scale-[1.02] ${
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
                          {(() => {
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
                        className="mt-2 w-full py-1 text-xs font-bold text-accent uppercase tracking-tighter hover:bg-accent/5 rounded transition-colors border border-accent/10"
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
                  const parts = flight.date.split('-');
                  const dayStr = parts[2] || '';
                  const dayOfWeekIndex = new Date(flight.date + 'T00:00:00').getDay();
                  const dayOfWeek = DAYS[isNaN(dayOfWeekIndex) ? 0 : dayOfWeekIndex];
                  
                  return (
                    <div key={flight.id} className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex flex-col items-center justify-center bg-primary/5 text-primary rounded-lg w-10 h-10 shrink-0 font-bold">
                          <span className="text-xs uppercase font-semibold text-gray-500 leading-none">{dayOfWeek}</span>
                          <span className="text-sm font-heading leading-tight mt-0.5">{Number(dayStr) || dayStr}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-gray-800 truncate">{flight.passenger}</span>
                            {flight.passengerDocs && (
                              <span className="text-xs bg-gray-100 text-gray-500 px-1 py-0.2 rounded shrink-0 border border-gray-200">
                                {flight.passengerDocs}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{flight.route} · {flight.time} · {flight.airline}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {(() => {
                          const { isCancelado, isRealizado, isVencido } = getFlightStatus(flight);
                          return (
                            <>
                              {flight.source === 'plan' && <Package size={14} className="text-emerald-500" />}
                              <span title={ESTADO_TITULO(isCancelado, isRealizado, isVencido)}
                                className={`w-2 h-2 rounded-full ${ESTADO_PUNTO(isCancelado, isRealizado, isVencido)}`}
                              />
                              <span className={`text-xs font-semibold uppercase tracking-wider ${isCancelado ? 'text-red-500 dark:text-red-400' : 'text-gray-500'}`}>
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
              <div className="text-center py-8 text-gray-500">
                <p className="text-xs">No hay vuelos programados para este mes.</p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
