import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plane, Search, ArrowRightCircle, Info, Luggage, Leaf, CalendarRange, TrendingDown, TrendingUp, Minus,
} from "lucide-react";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { FormField, Combobox, Input, Select } from "../components/ui/Form";
import { DatePicker } from "../components/sales/forms/TicketForm";
import { INITIAL_TICKET } from "../components/sales/wizardData";
import { usePermissions } from "../context/PermissionsContext";
import { useData } from "../context/DataContext";
import { formatCurrency, todayStr } from "../utils/formatters";
import {
  searchFlights, searchFlightCalendar,
  type FlightSearchResult, type FlightSearchResponse, type FlightCalendarEntry, type TravelClass, type TripType,
} from "../api";

/** "Xh Ym", a lo que ya usan otras pantallas para una duración en minutos. */
function formatDuration(minutos: number | null) {
  if (minutos == null) return "—";
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return `${horas}h ${resto}m`;
}

const TIPOS_DE_VIAJE: { value: TripType; label: string }[] = [
  { value: "one_way", label: "Solo ida" },
  { value: "round_trip", label: "Ida y vuelta" },
];

const CLASES: { value: TravelClass; label: string }[] = [
  { value: "economy", label: "Turista" },
  { value: "premium_economy", label: "Turista premium" },
  { value: "business", label: "Ejecutiva" },
  { value: "first", label: "Primera" },
];

const NIVEL_PRECIO: Record<string, { texto: string; clase: string; icono: typeof TrendingDown }> = {
  low: { texto: "Los precios están bajos para esta ruta", clase: "text-emerald-600 dark:text-emerald-400", icono: TrendingDown },
  typical: { texto: "Los precios son los típicos para esta ruta", clase: "text-accent", icono: Minus },
  high: { texto: "Los precios están altos para esta ruta", clase: "text-amber-600 dark:text-amber-400", icono: TrendingUp },
};

/** El panel de "Ver detalles": todo lo que SearchApi documenta para una opción, sin recortar. */
function DetalleVuelo({ resultado }: { resultado: FlightSearchResult }) {
  return (
    <div className="space-y-5">
      {resultado.legs.map((tramo, idx) => (
        <div key={idx} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-primary dark:text-white">
              {tramo.departureAirport?.id || "?"} → {tramo.arrivalAirport?.id || "?"}
            </p>
            <span className="text-xs text-accent">{tramo.flightNumber}</span>
          </div>
          <p className="mt-1 text-xs text-accent">
            {tramo.departureAirport?.name} ({tramo.departureAirport?.date} {tramo.departureAirport?.time}) —{" "}
            {tramo.arrivalAirport?.name} ({tramo.arrivalAirport?.date} {tramo.arrivalAirport?.time})
          </p>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-accent">
            <span>{tramo.airline}</span>
            {tramo.airplane && <span>{tramo.airplane}</span>}
            {tramo.travelClass && <span>{tramo.travelClass}</span>}
            <span>{formatDuration(tramo.duration)}</span>
          </div>
          {tramo.extensions.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {tramo.extensions.map((ext, i) => (
                <li key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {ext}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {resultado.layovers.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Escalas</p>
          <ul className="mt-1 space-y-1 text-sm text-accent">
            {resultado.layovers.map((l, i) => (
              <li key={i}>
                {l.name} ({l.id}) — {formatDuration(l.duration)}{l.isOvernight ? " · nocturna" : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(resultado.baggage || resultado.extensions.length > 0) && (
        <div className="flex items-start gap-2 text-sm text-accent">
          <Luggage size={16} className="mt-0.5 shrink-0" />
          <div>
            {resultado.baggage?.carry_on_bag && <p>Equipaje de mano: {resultado.baggage.carry_on_bag}</p>}
            {resultado.extensions.map((ext, i) => <p key={i}>{ext}</p>)}
          </div>
        </div>
      )}

      {resultado.carbonEmissions && (
        <div className="flex items-start gap-2 text-sm text-accent">
          <Leaf size={16} className="mt-0.5 shrink-0" />
          <div>
            {resultado.carbonEmissions.this_flight != null && (
              <p>Emisiones de este vuelo: {Math.round(resultado.carbonEmissions.this_flight / 1000)} kg</p>
            )}
            {resultado.carbonEmissions.typical_for_this_route != null && (
              <p>Típico de la ruta: {Math.round(resultado.carbonEmissions.typical_for_this_route / 1000)} kg</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Una fila de resultado, al estilo de Google Flights: hora — hora, duración, ruta, CO2, precio. */
function FilaVuelo({ r, onVerDetalles, onUsar, botonUsar, precioEstimado }: {
  r: FlightSearchResult; onVerDetalles: () => void; onUsar: () => void; botonUsar: string; precioEstimado?: boolean;
}) {
  const primerTramo = r.legs[0];
  const ultimoTramo = r.legs[r.legs.length - 1];
  const co2 = r.carbonEmissions?.this_flight != null ? Math.round(r.carbonEmissions.this_flight / 1000) : null;
  const co2Alto = r.carbonEmissions?.difference_percent != null && r.carbonEmissions.difference_percent > 0;

  return (
    <Card className="transition-colors hover:border-primary/30">
      <CardBody>
        <div className="flex flex-wrap items-center gap-4">
          {primerTramo?.airlineLogo && (
            <img src={primerTramo.airlineLogo} alt="" className="h-7 w-7 shrink-0 object-contain" />
          )}
          <div className="min-w-[180px] flex-1">
            <p className="font-heading font-semibold text-primary dark:text-white">
              {primerTramo?.departureAirport?.time || "—"} – {ultimoTramo?.arrivalAirport?.time || "—"}
            </p>
            <p className="text-xs text-accent">{r.airline || "Aerolínea sin dato"}</p>
          </div>
          <div className="min-w-[140px]">
            <p className="text-sm text-primary dark:text-white">{formatDuration(r.duration)}</p>
            <p className="text-xs text-accent">
              {r.stops === 0 ? "Directo" : `${r.stops} escala${r.stops > 1 ? "s" : ""}`}
              {primerTramo?.departureAirport?.id && ultimoTramo?.arrivalAirport?.id
                ? ` · ${primerTramo.departureAirport.id}-${ultimoTramo.arrivalAirport.id}` : ""}
            </p>
          </div>
          {co2 != null && (
            <div className="min-w-[90px] text-xs text-accent">
              <span className={co2Alto ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                {co2} kg CO2e
              </span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="font-heading text-lg font-semibold text-primary dark:text-white">
                {r.price != null ? formatCurrency(r.price) : "Precio sin dato"}
              </p>
              {precioEstimado && <p className="text-[11px] text-accent">estimado, se confirma con la vuelta</p>}
            </div>
            <Button variant="outline" onClick={onVerDetalles}>
              <Info size={15} /> Detalles
            </Button>
            <Button variant="outline" onClick={onUsar}>
              <ArrowRightCircle size={15} /> {botonUsar}
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

/** Un precio por día, de a 7 — como el calendario de Google Flights para ida sola (sin `bookingToken`, spec 039). */
function TiraDeFechas({ entradas, onUsar }: { entradas: FlightCalendarEntry[]; onUsar: (fecha: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
      {entradas.map((e) => (
        <button
          key={e.departure}
          type="button"
          onClick={() => e.departure && onUsar(e.departure)}
          disabled={!e.departure}
          className={`rounded-xl border p-2 text-center transition-colors ${
            e.isLowestPrice
              ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
              : "border-slate-200 bg-white hover:border-primary/40 dark:border-slate-700 dark:bg-slate-900/40"
          }`}
        >
          <p className="text-xs text-accent">{e.departure}</p>
          <p className={`text-sm font-semibold ${e.isLowestPrice ? "text-emerald-700 dark:text-emerald-300" : "text-primary dark:text-white"}`}>
            {e.price != null ? formatCurrency(e.price) : "—"}
          </p>
        </button>
      ))}
    </div>
  );
}

/**
 * Búsqueda de vuelos en vivo, vía SearchApi (spec 039). Separada de "Itinerarios"
 * (el check-in de tiquetes ya vendidos, en `/flights`): esto es sobre precios de
 * mercado, antes de vender nada. Elegir un resultado abre una cotización nueva
 * con ese tiquete ya lleno — nunca una venta directa, porque un precio buscado
 * no es un precio confirmado.
 */
export default function FlightSearch() {
  const navigate = useNavigate();
  const { canCreate } = usePermissions();
  const { data, fetchConfig } = useData();

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const [departureId, setDepartureId] = useState("");
  const [arrivalId, setArrivalId] = useState("");
  const [outboundDate, setOutboundDate] = useState("");
  const [tripType, setTripType] = useState<TripType>("one_way");
  const [returnDate, setReturnDate] = useState("");
  const [adults, setAdults] = useState(1);
  const [travelClass, setTravelClass] = useState<TravelClass>("economy");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");
  const [respuesta, setRespuesta] = useState<FlightSearchResponse | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState<FlightSearchResult | null>(null);

  // Ida y vuelta es de dos pasos (spec 039): primero se eligen los vuelos de IDA; elegir uno
  // vuelve a buscar con su `departureToken` y la respuesta pasa a ser las VUELTAS para esa ida,
  // ya con el precio real y el `bookingToken`. `idaElegida` guarda la ida mientras se ve la vuelta.
  const [etapa, setEtapa] = useState<"ida" | "vuelta">("ida");
  const [idaElegida, setIdaElegida] = useState<FlightSearchResult | null>(null);

  const [orden, setOrden] = useState<"recomendado" | "barato">("recomendado");
  const [filtroParadas, setFiltroParadas] = useState<"any" | "0" | "1">("any");
  const [filtroAerolinea, setFiltroAerolinea] = useState("");
  const [precioMaximo, setPrecioMaximo] = useState("");

  // Calendario de precios: un día por columna, de a 7 — como Google Flights para ida sola
  // (sin `bookingToken`, spec 039). "Usar esta fecha" solo cambia la fecha de salida y busca.
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [buscandoCalendario, setBuscandoCalendario] = useState(false);
  const [errorCalendario, setErrorCalendario] = useState("");
  const [calendario, setCalendario] = useState<FlightCalendarEntry[] | null>(null);

  const airportOptions = (data.config.airports || []).map((a) => ({
    value: a.abbreviation,
    label: `${a.abbreviation} - ${a.name} (${a.location})`,
  }));

  const puedeBuscar = Boolean(departureId && arrivalId && outboundDate)
    && (tripType === "one_way" || Boolean(returnDate)) && !buscando;

  /** Siempre arranca (o reinicia) en el paso "ida": nunca busca directo las vueltas. */
  const buscar = async (fechaDeSalida?: string) => {
    const fecha = fechaDeSalida || outboundDate;
    setBuscando(true); setError(""); setRespuesta(null); setCalendario(null);
    setEtapa("ida"); setIdaElegida(null);
    try {
      const r = await searchFlights({
        departureId, arrivalId, outboundDate: fecha,
        tripType, returnDate: tripType === "round_trip" ? returnDate : undefined,
        adults, travelClass,
      });
      setRespuesta(r);
    } catch (e: any) {
      setError(e.response?.data?.error?.message || e.message || "No se pudo buscar vuelos");
    } finally {
      setBuscando(false);
    }
  };

  /** Elegir una ida: vuelve a buscar con su `departureToken`, y la respuesta pasa a ser las vueltas. */
  const elegirIda = async (ida: FlightSearchResult) => {
    if (!ida.departureToken) return;
    setBuscando(true); setError(""); setRespuesta(null);
    try {
      const r = await searchFlights({
        departureId, arrivalId, outboundDate, tripType: "round_trip", returnDate,
        departureToken: ida.departureToken, adults, travelClass,
      });
      setRespuesta(r);
      setIdaElegida(ida);
      setEtapa("vuelta");
    } catch (e: any) {
      setError(e.response?.data?.error?.message || e.message || "No se pudo buscar las vueltas");
    } finally {
      setBuscando(false);
    }
  };

  const volverAElegirIda = () => { buscar(); };

  const buscarCalendario = async (desde?: string) => {
    const fecha = desde || outboundDate;
    if (!departureId || !arrivalId || !fecha) return;
    setBuscandoCalendario(true); setErrorCalendario(""); setCalendario(null);
    try {
      const r = await searchFlightCalendar({ departureId, arrivalId, outboundDate: fecha });
      setCalendario(r);
    } catch (e: any) {
      setErrorCalendario(e.response?.data?.error?.message || e.message || "No se pudo traer el calendario");
    } finally {
      setBuscandoCalendario(false);
    }
  };

  /** 7 días después del último que se ve en el calendario — el ">" de Google Flights. */
  const verSemanaSiguiente = () => {
    const ultimo = calendario?.[calendario.length - 1]?.departure;
    if (!ultimo) return;
    const siguiente = new Date(`${ultimo}T00:00:00`);
    siguiente.setDate(siguiente.getDate() + 1);
    buscarCalendario(siguiente.toISOString().slice(0, 10));
  };

  const usarFechaDelCalendario = (fecha: string) => {
    setOutboundDate(fecha);
    buscar(fecha);
  };

  const aerolineasDisponibles = useMemo(
    () => [...new Set((respuesta?.results || []).map(r => r.airline).filter(Boolean) as string[])].sort(),
    [respuesta],
  );

  const resultadosFiltrados = useMemo(() => {
    let lista = respuesta?.results || [];
    if (filtroParadas === "0") lista = lista.filter(r => r.stops === 0);
    else if (filtroParadas === "1") lista = lista.filter(r => r.stops <= 1);
    if (filtroAerolinea) lista = lista.filter(r => r.airline === filtroAerolinea);
    const max = Number(precioMaximo);
    if (precioMaximo && max > 0) lista = lista.filter(r => (r.price ?? 0) <= max);
    if (orden === "barato") lista = [...lista].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    return lista;
  }, [respuesta, filtroParadas, filtroAerolinea, precioMaximo, orden]);

  const usarVuelo = (resultado: FlightSearchResult) => {
    const base = INITIAL_TICKET();
    const esIdaYVuelta = tripType === "round_trip" && idaElegida;
    navigate("/quotes", {
      state: {
        prefillTicket: {
          ...base,
          airline: (esIdaYVuelta ? idaElegida!.airline : resultado.airline) || "",
          // En ida y vuelta, `resultado` (la vuelta elegida) ya trae el precio real de la
          // combinación completa — el de la ida era solo estimado (spec 039).
          ta: resultado.price || 0,
          flightMode: esIdaYVuelta ? "round_trip" : "one_way",
          legs: [{ ...base.legs[0], origin: departureId, destination: arrivalId, date: outboundDate }],
          ...(esIdaYVuelta ? { returnLeg: { ...base.legs[0], origin: arrivalId, destination: departureId, date: returnDate } } : {}),
        },
      },
    });
  };

  /** El botón de cada fila, según en qué paso está (solo ida / elegir ida / elegir vuelta). */
  const onUsarFila = (r: FlightSearchResult) => {
    if (tripType === "round_trip" && etapa === "ida") elegirIda(r);
    else usarVuelo(r);
  };
  const botonFila = tripType === "round_trip" && etapa === "ida" ? "Elegir esta ida" : "Usar";

  if (!canCreate("quotes")) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-accent">No tenés permiso para crear cotizaciones, así que esta búsqueda no te sirve todavía.</p>
        </CardBody>
      </Card>
    );
  }

  const nivel = respuesta?.priceInsights?.price_level ? NIVEL_PRECIO[respuesta.priceInsights.price_level] : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold text-primary dark:text-white flex items-center gap-2">
          <Plane size={22} /> Vuelos
        </h1>
        <p className="mt-0.5 text-sm text-accent">Precios en vivo, para armar una cotización.</p>
      </header>

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-end gap-4">
            <FormField label="Tipo de viaje" className="mb-0 w-40">
              <Select
                value={tripType}
                onChange={e => { setTripType(e.target.value as TripType); setRespuesta(null); }}
                options={TIPOS_DE_VIAJE}
              />
            </FormField>
            <FormField label="Origen" className="mb-0 w-44">
              <Combobox value={departureId} onChange={setDepartureId} options={airportOptions} placeholder="BOG" />
            </FormField>
            <FormField label="Destino" className="mb-0 w-44">
              <Combobox value={arrivalId} onChange={setArrivalId} options={airportOptions} placeholder="MIA" />
            </FormField>
            <FormField label="Fecha de salida" className="mb-0 w-40">
              <DatePicker value={outboundDate} onChange={setOutboundDate} min={todayStr()} fieldName="Fecha de salida" />
            </FormField>
            {tripType === "round_trip" && (
              <FormField label="Fecha de regreso" className="mb-0 w-40">
                <DatePicker value={returnDate} onChange={setReturnDate} min={outboundDate || todayStr()} fieldName="Fecha de regreso" />
              </FormField>
            )}
            <FormField label="Pasajeros" className="mb-0 w-24">
              <Input type="number" min={1} max={9} value={adults} onChange={e => setAdults(Number(e.target.value) || 1)} />
            </FormField>
            <FormField label="Clase" className="mb-0 w-40">
              <Select value={travelClass} onChange={e => setTravelClass(e.target.value as TravelClass)} options={CLASES} />
            </FormField>
            <Button onClick={() => buscar()} disabled={!puedeBuscar}>
              <Search size={16} />{buscando ? "Buscando…" : "Buscar"}
            </Button>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="button"
            onClick={() => {
              setMostrarCalendario(v => !v);
              if (!mostrarCalendario && !calendario) buscarCalendario();
            }}
            disabled={!departureId || !arrivalId || !outboundDate}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline dark:text-white"
          >
            <CalendarRange size={14} /> {mostrarCalendario ? "Ocultar" : "Ver"} calendario de precios (ida sola, solo de referencia)
          </button>

          {mostrarCalendario && (
            <div className="mt-3 space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-xs text-accent">
                El precio de cada día, para elegir el más barato. No tiene datos para mandar directo a una
                cotización —tocá un día para buscarlo arriba y elegir el vuelo ahí.
              </p>
              {buscandoCalendario && <p className="text-sm text-accent">Buscando…</p>}
              {errorCalendario && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{errorCalendario}</p>}
              {calendario && (calendario.length === 0 ? (
                <p className="text-sm text-accent">Sin datos de calendario para esa fecha.</p>
              ) : (
                <>
                  <TiraDeFechas entradas={calendario} onUsar={usarFechaDelCalendario} />
                  <div className="text-right">
                    <Button variant="outline" onClick={verSemanaSiguiente} disabled={buscandoCalendario}>
                      Próximos 7 días →
                    </Button>
                  </div>
                </>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {nivel && respuesta?.priceInsights && (
        <div className={`flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 ${nivel.clase}`}>
          <nivel.icono size={16} />
          <span>{nivel.texto}</span>
          {respuesta.priceInsights.typical_price_range && (
            <span className="text-accent">
              (típico entre {formatCurrency(respuesta.priceInsights.typical_price_range.low_price)} y{" "}
              {formatCurrency(respuesta.priceInsights.typical_price_range.high_price)})
            </span>
          )}
        </div>
      )}

      {respuesta && (
        <>
          {tripType === "round_trip" && (
            <div className="flex items-center gap-3">
              <h2 className="font-heading text-lg font-semibold text-primary dark:text-white">
                {etapa === "ida" ? "Vuelos de ida" : "Vuelos de vuelta"}
              </h2>
              {etapa === "vuelta" && (
                <button type="button" onClick={volverAElegirIda} className="text-xs font-medium text-primary hover:underline dark:text-white">
                  ← Cambiar la ida
                </button>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-xl border border-slate-200 p-0.5 dark:border-slate-700">
              {(["recomendado", "barato"] as const).map(o => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOrden(o)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    orden === o ? "bg-primary text-white" : "text-accent hover:text-primary dark:hover:text-white"
                  }`}
                >
                  {o === "recomendado" ? "Recomendado" : "Más económicos"}
                </button>
              ))}
            </div>
            <Select
              value={filtroParadas}
              onChange={e => setFiltroParadas(e.target.value as any)}
              options={[
                { value: "any", label: "Cualquier parada" },
                { value: "0", label: "Solo directos" },
                { value: "1", label: "Hasta 1 escala" },
              ]}
              className="w-auto"
            />
            {aerolineasDisponibles.length > 1 && (
              <Select
                value={filtroAerolinea}
                onChange={e => setFiltroAerolinea(e.target.value)}
                options={[{ value: "", label: "Todas las aerolíneas" }, ...aerolineasDisponibles.map(a => ({ value: a, label: a }))]}
                className="w-auto"
              />
            )}
            <Input
              type="number" min={0} placeholder="Precio máximo" value={precioMaximo}
              onChange={e => setPrecioMaximo(e.target.value)} className="w-40"
            />
          </div>

          <div className="space-y-3">
            {resultadosFiltrados.length === 0 ? (
              <p className="text-sm text-accent">No se encontraron vuelos con esos filtros.</p>
            ) : resultadosFiltrados.map((r, idx) => (
              <FilaVuelo
                key={idx} r={r} onVerDetalles={() => setDetalleAbierto(r)} onUsar={() => onUsarFila(r)}
                botonUsar={botonFila} precioEstimado={tripType === "round_trip" && etapa === "ida"}
              />
            ))}
          </div>
        </>
      )}

      {detalleAbierto && (
        <Modal isOpen onClose={() => setDetalleAbierto(null)} title="Detalle del vuelo" size="lg">
          <DetalleVuelo resultado={detalleAbierto} />
        </Modal>
      )}
    </div>
  );
}
