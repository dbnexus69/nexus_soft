import { useState, useMemo, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Plane, X, Calendar as CalendarIcon, 
  UserCheck, PlaneTakeoff, PlaneLanding, Search, Filter, AlertCircle,
  Clock, CheckCircle2, UploadCloud, ExternalLink, Package
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useData } from '../context/DataContext';
import { usePermissions } from '../context/PermissionsContext';
import { Modal } from '../components/ui/Modal';
import { FormField } from '../components/ui/Form';
import { formatDate } from '../utils/formatters';
import { Flight } from '../types';
import LoadingScreen from '../components/ui/LoadingScreen';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAYS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

export default function Itineraries() {
  const { data, updateFlight, fetchFlights, fetchClients } = useData();
  const { canEdit: canEditItinerary, canView } = usePermissions();
  const [isLoading, setIsLoading] = useState(true);
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

  const getFlightStatus = (flight: Flight) => {
    if (flight.checkin === 'realizado') {
      return { isRealizado: true, isVencido: false, isUrgente: false };
    }
    const [yr, mo, dy] = flight.date.split('-').map(Number);
    const [hr, mn] = (flight.time || '00:00').split(':').map(Number);
    const flightDateTime = new Date(yr, mo - 1, dy, hr, mn, 0);
    const now = new Date();
    const isVencido = flightDateTime < now;
    const isUrgente = !isVencido && (flightDateTime.getTime() <= now.getTime() + (48 * 60 * 60 * 1000));
    return { isRealizado: false, isVencido, isUrgente };
  };

  // Lazy Load Fetch
  useEffect(() => {
    fetchFlights().finally(() => setIsLoading(false));
    fetchClients().catch(() => {});
  }, [fetchFlights, fetchClients]);

  // Estadísticas y filtros
  const pendingCheckins = useMemo(() => {
    return data.flights.filter(f => f.checkin === 'pendiente').sort((a, b) => a.date.localeCompare(b.date));
  }, [data.flights]);

  const filteredPending = useMemo(() => {
    return pendingCheckins.filter(f => 
      f.passenger.toLowerCase().includes(checkinSearch.toLowerCase()) ||
      f.route.toLowerCase().includes(checkinSearch.toLowerCase())
    );
  }, [pendingCheckins, checkinSearch]);

  // Cliente vinculado al vuelo seleccionado en el modal (memoizado)
  const modalClient = useMemo(() =>
    data.clients.find(c => c.name === selectedFlightForCheckin?.passenger)
  , [data.clients, selectedFlightForCheckin]);

  const flightsIda = data.flights.filter(f => f.type === 'ida');
  const flightsRegreso = data.flights.filter(f => f.type === 'regreso');

  const currentMonthFlights = useMemo(() => {
    return data.flights.filter(f => {
      const parts = f.date.split('-');
      if (parts.length < 3) return false;
      const y = Number(parts[0]);
      const m = Number(parts[1]);
      return y === currentYear && m === currentMonth + 1 && f.type === calendarTab;
    }).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  }, [data.flights, currentMonth, currentYear, calendarTab]);

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
    const flight = data.flights.find(f => f.id === flightId);
    if (flight) {
      setSelectedFlightForCheckin(flight);
      setIsCheckinModalOpen(true);
      setCheckinFiles([]);
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
      const dayFlights = data.flights.filter(f => f.date === dateStr && f.type === calendarTab);
      days.push({ day: i, month: currentMonth, year: currentYear, flights: dayFlights });
    }

    // Rellenar días del mes siguiente
    while (days.length % 7 !== 0) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      days.push({ day: days.length - firstDay - daysInMonth + 1, month: nextMonth, year: nextYear, flights: [] });
    }

    return days;
  }, [currentMonth, currentYear, data.flights, calendarTab]);

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

  if (isLoading && data.flights.length === 0) {
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
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
            {pendingCheckins.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                {pendingCheckins.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'calendar' ? (
        <div className="animate-fade-in space-y-6">
          {/* Sub-navegación para el Calendario */}
          <div className="flex bg-gray-100/50 p-1 rounded-xl w-full sm:w-fit mx-auto border border-gray-border">
            <button
              onClick={() => setCalendarTab('ida')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${calendarTab === 'ida' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-blue-400'}`}
            >
              <PlaneTakeoff size={15} /> Vuelos de Ida ({flightsIda.length})
            </button>
            <button
              onClick={() => setCalendarTab('regreso')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${calendarTab === 'regreso' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-indigo-400'}`}
            >
              <PlaneLanding size={15} /> Vuelos de Regreso ({flightsRegreso.length})
            </button>
          </div>

          {/* Controles del Calendario */}
          <Card className="overflow-hidden border-none shadow-lg">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white border-b border-gray-border">
              <div className="flex flex-wrap items-center justify-between sm:justify-start gap-3 sm:gap-4">
                <div className="flex items-center gap-1">
                  <select
                    value={currentMonth}
                    onChange={(e) => setCurrentMonth(Number(e.target.value))}
                    className="text-base sm:text-lg font-bold text-primary bg-transparent outline-none cursor-pointer hover:bg-gray-100 rounded p-1"
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={currentYear}
                    onChange={(e) => setCurrentYear(Number(e.target.value))}
                    className="text-base sm:text-lg font-bold text-primary bg-transparent outline-none cursor-pointer hover:bg-gray-100 rounded p-1"
                  >
                    {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 3 + i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-border">
                  <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-500">
                    <ChevronLeft size={18} />
                  </button>
                  <button onClick={() => { setCurrentMonth(new Date().getMonth()); setCurrentYear(new Date().getFullYear()); }} className="px-2 py-1 text-xs font-bold text-primary hover:bg-white hover:shadow-sm rounded-md transition-all">
                    HOY
                  </button>
                  <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-500">
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
                <div className="grid grid-cols-7 bg-gray-50/50">
                  {DAYS.map(day => (
                    <div key={day} className="py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest border-r border-gray-border/50 last:border-r-0">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 border-t border-gray-border/50">
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
                        className={`min-h-[140px] p-2 border-r border-b border-gray-border/50 relative group transition-colors ${isOtherMonth ? 'bg-gray-50/30' : 'bg-white hover:bg-primary/[0.02]'}`}
                      >
                        <div className={`text-xs font-bold mb-2 flex items-center justify-center w-7 h-7 rounded-full transition-all ${isToday ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-110' : isOtherMonth ? 'text-gray-300' : 'text-gray-500'}`}>
                          {item.day}
                        </div>

                        <div className="space-y-1">
                          {displayFlights.map(flight => {
                            const client = data.clients.find(c => c.name === flight.passenger);
                            const docInfo = client ? `\n${client.docType}: ${client.docNumber}` : '';
                            const isPlan = flight.source === 'plan';
                            return (
                            <div
                              key={flight.id}
                              title={`${isPlan ? '📦 ' : ''}${flight.passenger}${docInfo}\nHora: ${flight.time}\nCheck-in: ${isPlan ? 'N/A (Paquete)' : flight.checkin}${flight.reservationNumber ? `\nReserva: ${flight.reservationNumber}` : ''}${isPlan ? `\nPlan: ${flight.route}` : ''}${isPlan && flight.additionalPassengers ? `\nAcompañantes: ${flight.additionalPassengers}` : ''}`}
                              className={`px-2 py-1 rounded-md text-[10px] font-semibold border flex items-center gap-1 shadow-sm transition-transform hover:scale-[1.02] ${
                                isPlan
                                  ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                  : flight.type === 'ida' 
                                    ? 'bg-blue-50 border-blue-100 text-blue-700' 
                                    : 'bg-indigo-50 border-indigo-100 text-indigo-800'
                              }`}
                            >
                              {isPlan ? <Package size={10} className="shrink-0" /> : flight.type === 'ida' ? <PlaneTakeoff size={10} className="shrink-0" /> : <PlaneLanding size={10} className="shrink-0" />}
                              <span className="truncate flex-1">{flight.passenger}</span>
                              <span className="opacity-60 shrink-0">{flight.time}</span>
                              {!isPlan && (() => {
                                 const { isRealizado, isVencido } = getFlightStatus(flight);
                                 return (
                                   <span title={isRealizado ? 'Check-in realizado' : isVencido ? 'Check-in vencido' : 'Check-in pendiente'}
                                     className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRealizado ? 'bg-green-500' : isVencido ? 'bg-red-500' : 'bg-yellow-400'}`}
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
              <div className="block sm:hidden p-4 space-y-4 bg-gray-50/30">
                {currentMonthFlights.length > 0 ? (
                  <div className="space-y-3">
                    {currentMonthFlights.map(flight => {
                      const client = data.clients.find(c => c.name === flight.passenger);
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
                              const { isRealizado, isVencido } = getFlightStatus(flight);
                              return (
                                <>
                                  <span title={isRealizado ? 'Check-in realizado' : isVencido ? 'Check-in vencido' : 'Check-in pendiente'}
                                    className={`w-2 h-2 rounded-full ${isRealizado ? 'bg-green-500' : isVencido ? 'bg-red-500' : 'bg-yellow-400'}`}
                                  />
                                  <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">
                                    {isRealizado ? 'Listo' : isVencido ? 'Vencido' : 'Pendiente'}
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
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Buscar pasajero o ruta..."
                      className="pl-9 pr-10 py-1.5 text-sm bg-gray-50 border border-gray-border rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={checkinSearch}
                      onChange={e => setCheckinSearch(e.target.value)}
                    />
                    {checkinSearch && (
                      <button onClick={() => setCheckinSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                }>
                  Pasajeros Pendientes
                </CardHeader>
                <CardBody className="p-0">
                  {filteredPending.length > 0 ? (
                    <div className="divide-y divide-gray-border">
                      {filteredPending.map(flight => {
                        const { isVencido, isUrgente } = getFlightStatus(flight);
                        const client = data.clients.find(c => c.name === flight.passenger);

                        return (
                          <div key={flight.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors ${isVencido ? 'opacity-85' : ''}`}>
                            <div className="flex items-start gap-4">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 ${
                                isVencido 
                                  ? 'bg-gray-100 border-gray-200 text-gray-400' 
                                  : isUrgente 
                                    ? 'bg-red-50 border-red-100 text-red-500 animate-pulse' 
                                    : flight.source === 'plan' 
                                      ? 'bg-emerald-50 border-emerald-100 text-emerald-500' 
                                      : 'bg-blue-50 border-blue-100 text-blue-500'
                              }`}>
                                {flight.source === 'plan' ? (
                                  <Package size={24} />
                                ) : (
                                  <Plane size={24} className={flight.type === 'regreso' ? 'rotate-180' : ''} />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-primary truncate">{flight.passenger}</span>
                                  {client && (
                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">
                                      {client.docType}: {client.docNumber}
                                    </span>
                                  )}
                                  {isVencido ? (
                                    <Badge variant="danger" className="text-[10px] py-0 bg-red-100 text-red-800 border border-red-200">VENCIDO</Badge>
                                  ) : isUrgente ? (
                                    <Badge variant="danger" className="text-[10px] py-0">URGENTE</Badge>
                                  ) : null}
                                  {flight.source === 'plan' && flight.additionalPassengers && flight.additionalPassengers > 0 ? (
                                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                      +{flight.additionalPassengers} acompañantes
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
                                  <span className="flex items-center gap-1"><Filter size={12} /> {flight.route}</span>
                                  <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(flight.date)} - {flight.time}</span>
                                  <span className="font-medium text-primary/60">{flight.airline}</span>
                                  {flight.reservationNumber && (
                                    <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono text-[10px] border border-blue-150 font-semibold">
                                      Reserva: {flight.reservationNumber}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {canEditItinerary('itineraries') && (
                              <Button 
                                size="sm" 
                                onClick={() => handleMarkCheckin(flight.id, flight.passenger)}
                                className="shadow-md shadow-primary/10 w-full sm:w-auto justify-center"
                              >
                                <UserCheck size={16} /> Realizar Check-in
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                      <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 size={32} />
                      </div>
                      <p className="font-bold text-gray-600">¡Todo al día!</p>
                      <p className="text-sm">No hay check-ins pendientes para los próximos vuelos.</p>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="bg-primary text-white border-none shadow-xl shadow-primary/20">
                <CardBody className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-white/20 rounded-xl">
                      <Clock size={24} />
                    </div>
                    <Badge variant="accent" className="bg-white/20 text-white border-none">PRÓXIMAS 48H</Badge>
                  </div>
                  <h3 className="text-sm font-medium text-white/80 uppercase tracking-wider">Check-ins Críticos</h3>
                  <p className="text-3xl font-bold mt-1">
                    {pendingCheckins.filter(f => getFlightStatus(f).isUrgente).length}
                  </p>
                  <p className="text-xs text-white/60 mt-4 leading-relaxed">
                    Recuerda que el check-in debe realizarse al menos 24 horas antes de la salida para evitar inconvenientes.
                  </p>
                </CardBody>
              </Card>

              <Card className="border-none shadow-lg">
                <CardHeader>Resumen de Vuelos</CardHeader>
                <CardBody className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><PlaneTakeoff size={18} /></div>
                      <span className="text-sm font-medium text-gray-600">Salidas</span>
                    </div>
                    <span className="font-bold text-primary">{data.flights.filter(f => f.type === 'ida').length}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><PlaneLanding size={18} /></div>
                      <span className="text-sm font-medium text-gray-600">Regresos</span>
                    </div>
                    <span className="font-bold text-primary">{data.flights.filter(f => f.type === 'regreso').length}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 text-green-600 rounded-lg"><CheckCircle2 size={18} /></div>
                      <span className="text-sm font-medium text-gray-600">Completados</span>
                    </div>
                    <span className="font-bold text-primary">{data.flights.filter(f => f.checkin === 'realizado').length}</span>
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
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs text-blue-700 font-medium mb-1">Pasajero:</p>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-primary">{selectedFlightForCheckin?.passenger}</p>
              {modalClient && (
                <span className="text-[10px] bg-white/50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 font-bold">
                  {modalClient.docType}: {modalClient.docNumber}
                </span>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 border border-gray-border rounded-lg">
              <p className="text-xs text-gray-500 font-medium mb-1">Ruta:</p>
              <p className="text-sm font-bold text-primary">{selectedFlightForCheckin?.route}</p>
            </div>
            <div className="p-3 bg-gray-50 border border-gray-border rounded-lg">
              <p className="text-xs text-gray-500 font-medium mb-1">Fecha y Hora:</p>
              <p className="text-sm font-bold text-primary">
                {selectedFlightForCheckin ? formatDate(selectedFlightForCheckin.date) : ''} {selectedFlightForCheckin?.time}
              </p>
            </div>
            <div className="p-3 bg-gray-50 border border-gray-border rounded-lg">
              <p className="text-xs text-gray-500 font-medium mb-1">Aerolínea:</p>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-primary">{selectedFlightForCheckin?.airline}</p>
                {(() => {
                  const airlineInfo = data.config?.airlines?.find((a: any) => a.name === selectedFlightForCheckin?.airline);
                  if (airlineInfo && airlineInfo.website) {
                    const url = airlineInfo.website.startsWith('http') ? airlineInfo.website : `https://${airlineInfo.website}`;
                    return (
                      <a 
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1 font-bold transition-colors"
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
            <div className="p-3 bg-gray-50 border border-gray-border rounded-lg">
              <p className="text-xs text-gray-500 font-medium mb-1">Enviar a:</p>
              <p className="text-sm font-bold text-primary truncate" title={selectedFlightForCheckin?.email || modalClient?.email}>
                {selectedFlightForCheckin?.email || modalClient?.email || 'Sin correo registrado'}
              </p>
            </div>
            <div className="p-3 bg-gray-50 border border-gray-border rounded-lg">
              <p className="text-xs text-gray-500 font-medium mb-1">Nº Vuelo:</p>
              <p className="text-sm font-bold text-primary">{selectedFlightForCheckin?.flightNumber || 'No registrado'}</p>
            </div>
            <div className="p-3 bg-gray-50 border border-gray-border rounded-lg">
              <p className="text-xs text-gray-500 font-medium mb-1">Código Reserva (PNR):</p>
              <p className="text-sm font-bold text-primary font-mono select-all" title="Click para copiar">{selectedFlightForCheckin?.reservationNumber || 'No registrado'}</p>
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
              <div className="p-6 border-2 border-dashed border-gray-300 bg-white rounded-xl flex flex-col items-center justify-center gap-1 transition-all group-hover:border-primary group-hover:bg-primary/5">
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
    </div>
  );
}