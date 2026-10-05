import { useState, useEffect } from 'react';
import { Plane, X, UserCheck, Search, Filter, AlertCircle, Clock, CheckCircle2, XCircle, Package } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Pagination } from '../ui/Pagination';
import { useData } from '../../context/DataContext';
import { usePermissions } from '../../context/PermissionsContext';
import { formatDate, formatDateTime } from '../../utils/formatters';
import * as api from '../../api';
import type { Flight, CheckinCounts, CheckinStatusFilter } from '../../types';
import { ModalEnviarCheckin, ModalCancelarCheckin, MOTIVO_MIN } from './CheckinModals';
import {
  FILTROS_CHECKIN, COUNTS_VACIOS, TITULOS_CHECKIN, VACIO_CHECKIN, ESTADO_FILA, claveEstadoFila,
  InsigniaEstado, ESQUELETO_POR_DEFECTO, FilaEsqueleto, EsqueletoVacio, getFlightStatus,
} from './checkinUi';

/** Vuelos de check-in por página. */
const CHECKIN_PER_PAGE = 10;

interface Props {
  /** Cambia cuando hay que releer la lista. */
  refresco: number;
  /** Tras cambiar un check-in: la pantalla relee esta lista y el calendario. */
  onCambio: () => void;
  /** Los contadores por estado, para la insignia de la pestaña. */
  onContadores: (c: CheckinCounts) => void;
  avisar: (ok: boolean, mensaje: string, ms?: number) => void;
}

/** La gestión de check-in: lista paginada y filtrada en el servidor, sus acciones y los dos diálogos. */
export function ListaCheckin({ refresco, onCambio, onContadores, avisar }: Props) {
  const { data, updateFlight } = useData();
  const { canEdit: canEditItinerary } = usePermissions();
  const [checkinSearch, setCheckinSearch] = useState('');
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [selectedFlightForCheckin, setSelectedFlightForCheckin] = useState<Flight | null>(null);
  const [checkinFiles, setCheckinFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [flightToCancel, setFlightToCancel] = useState<Flight | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCanceling, setIsCanceling] = useState(false);

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
  const [errorLista, setErrorLista] = useState<string | null>(null);

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
    setErrorLista(null);
    const t = setTimeout(() => {
      api.listCheckins({
        status: checkinStatus,
        search: checkinSearch || undefined,
        page: pendingPage,
        perPage: CHECKIN_PER_PAGE,
      })
        .then((res) => {
          if (!vivo) return;
          const totalPaginas = res?.meta?.totalPages || 0;
          // Tras cambiar un estado (o cancelar el último de la página) la página
          // pedida puede haber dejado de existir: se vuelve a la última en vez de
          // mostrar una lista vacía con contadores que dicen lo contrario.
          if (totalPaginas > 0 && pendingPage > totalPaginas) {
            setPendingPage(totalPaginas);
            return;
          }
          setPending(res?.data || []);
          setPendingMeta({ total: res?.meta?.total || 0, totalPages: totalPaginas });
          setCounts(res?.meta?.counts || COUNTS_VACIOS);
          setPrediccionValida(true);
        })
        .catch((err: any) => {
          if (!vivo) return;
          // Un fallo no es una lista vacía: se avisa y se deja reintentar.
          setPending([]);
          setErrorLista(err?.response?.data?.error?.message || 'No se pudo cargar la lista de check-in.');
        })
        .finally(() => { if (vivo) setPendingLoading(false); });
    }, checkinSearch ? 300 : 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [pendingPage, checkinSearch, checkinStatus, refresco]);

  // El vuelo ya trae los datos de su titular: no hace falta cruzarlo con el
  // catálogo de clientes.
  const modalClient = selectedFlightForCheckin
    ? {
        docType: selectedFlightForCheckin.clientDocType,
        docNumber: selectedFlightForCheckin.clientDocNumber,
        email: selectedFlightForCheckin.clientEmail,
      }
    : null;

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

  const handleMarkCheckin = (flightId: string, passenger: string) => {
    if (!canEditItinerary('itineraries')) return;
    const flight = pending.find(f => f.id === flightId);
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
      onCambio();
      avisar(true, `Check-in cancelado para ${flightToCancel.passenger}`, 3000);
    } catch (err: any) {
      const detalle = err?.response?.data?.error;
      avisar(false, detalle?.details?.[0]?.message || detalle?.message || 'Error al cancelar el check-in', 5000);
    } finally {
      setIsCanceling(false);
    }
  };

  const [revirtiendoId, setRevirtiendoId] = useState<string | null>(null);

  const handleRevertCheckin = async (flight: Flight) => {
    if (!canEditItinerary('itineraries')) return;
    setRevirtiendoId(flight.id);
    try {
      await updateFlight(flight.id, { checkin: 'pendiente' });
      onCambio();
      avisar(true, `Check-in de ${flight.passenger} marcado como pendiente`, 3000);
    } catch (err: any) {
      avisar(false, err?.response?.data?.error?.message || 'No se pudo marcar el check-in como pendiente', 5000);
    } finally {
      setRevirtiendoId(null);
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
      onCambio();
      avisar(true, `Check-in enviado a ${selectedFlightForCheckin.passenger} y marcado como realizado`, 3000);
    } catch (err: any) {
      // Si el correo no salió (cliente sin correo, fallo de envío), el servidor no lo marca y dice por qué;
      // el diálogo se queda abierto para reintentar.
      const msg = err?.response?.data?.error?.message || 'Error al realizar check-in';
      avisar(false, msg, 5000);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => { onContadores(counts); }, [counts, onContadores]);
  const reintentar = onCambio;

  return (
    <>
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
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                      type="text"
                      placeholder="Buscar pasajero, reserva o vuelo..."
                      className="pl-9 pr-10 py-1.5 text-sm bg-gray-50 dark:bg-slate-800/80 border border-gray-border dark:border-slate-700 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                      value={checkinSearch}
                      onChange={e => cambiarBusqueda(e.target.value)}
                    />
                    {checkinSearch ? (
                      <button onClick={() => cambiarBusqueda('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600 p-0.5 rounded">
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
                ) : errorLista ? (
                  <div role="alert" className="flex flex-col items-center gap-3 py-10 px-4 text-center text-sm text-red-700">
                    <AlertCircle size={28} className="opacity-60" />
                    <p>{errorLista}</p>
                    <Button size="sm" onClick={reintentar}>Reintentar</Button>
                  </div>
                ) : filteredPending.length > 0 ? (
                  <div className="divide-y divide-gray-border">
                    {filteredPending.map(flight => {
                      const { isVencido, isUrgente } = getFlightStatus(flight);
                      const claveEstado = claveEstadoFila(flight.checkin, isVencido, isUrgente);

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
                                {flight.passengerDocs && (
                                  <span className="text-xs bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                                    {flight.passengerDocs}
                                  </span>
                                )}
                                <InsigniaEstado clave={claveEstado} />
                                {flight.source === 'plan' && flight.additionalPassengers && flight.additionalPassengers > 0 ? (
                                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/50">
                                    +{flight.additionalPassengers} acompañantes
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-slate-400 mt-1">
                                <span className="flex items-center gap-1"><Filter size={12} /> {flight.route}</span>
                                <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(flight.date)} - {flight.time}</span>
                                <span className="font-medium text-primary/60 dark:text-slate-500">{flight.airline}</span>
                                {flight.reservationNumber ? (
                                  <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-mono text-xs border border-blue-200 dark:border-blue-900/50 font-semibold">
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
                                <>
                                  <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
                                    <CheckCircle2 size={14} />
                                    {flight.checkinAt ? formatDateTime(flight.checkinAt) : 'Realizado'}
                                  </span>
                                  {/* Deshacer un check-in marcado por error. */}
                                  {canEditItinerary('itineraries') ? (
                                    <button
                                      onClick={() => handleRevertCheckin(flight)}
                                      disabled={revirtiendoId === flight.id}
                                      className="text-xs font-semibold text-gray-500 hover:text-primary underline underline-offset-2 disabled:opacity-50"
                                    >
                                      Marcar pendiente
                                    </button>
                                  ) : null}
                                </>
                              ) : canEditItinerary('itineraries') ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleMarkCheckin(flight.id, flight.passenger)}
                                    className="shadow-md shadow-primary/10 flex-1 sm:flex-initial justify-center"
                                  >
                                    <UserCheck size={16} /> Realizar Check-in
                                  </Button>
                                </>
                              ) : null}
                              {/* Los vuelos de paquete también se cancelan con motivo (spec 004, T6). */}
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
                  <div className="flex flex-col items-center justify-center p-12 text-gray-500 dark:text-slate-500">
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
            <Card className="bg-primary dark:bg-slate-900 text-white dark:text-slate-100 border-none dark:border dark:border-slate-800 shadow-xl shadow-primary/20 dark:shadow-none">
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

      <ModalEnviarCheckin
        abierto={isCheckinModalOpen}
        enviando={isSending}
        vuelo={selectedFlightForCheckin}
        cliente={modalClient}
        aerolineas={data.config?.airlines || []}
        archivos={checkinFiles}
        setArchivos={setCheckinFiles}
        onCerrar={() => setIsCheckinModalOpen(false)}
        onConfirmar={confirmCheckin}
      />

      <ModalCancelarCheckin
        vuelo={flightToCancel}
        motivo={cancelReason}
        setMotivo={setCancelReason}
        cancelando={isCanceling}
        valido={cancelReasonValido}
        onCerrar={() => setFlightToCancel(null)}
        onConfirmar={confirmCancel}
      />
    </>
  );
}
