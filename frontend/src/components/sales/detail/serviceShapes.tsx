import { memo, type ReactElement, type ReactNode } from "react";
import {
  Plane, BedDouble, ShieldCheck, Package, BookCheck, FileText, Smartphone,
  Car, Warehouse, Compass, Users, Utensils, Stamp, BookOpen, Dog,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime } from "../../../utils/formatters";

/**
 * Forma propia de cada categoría de servicio.
 *
 * El detalle de venta pintaba las quince categorías con la MISMA rejilla de
 * etiqueta/valor a cuatro columnas. Pero un vuelo es una secuencia de tramos,
 * una estancia es un rango de fechas con huéspedes y una mascota es un animal
 * con un medio de transporte: aplanarlos en la misma rejilla borra justo lo que
 * distingue a cada uno y obliga a leer etiqueta por etiqueta.
 *
 * Aquí cada categoría declara dos cosas:
 *   `resumen`  lo que identifica al servicio en una línea, sin abrirlo
 *   `Detalle`  cómo se despliega, con la estructura que le corresponde
 */

const guion = "—";

/** Une partes descartando las vacías, para no dejar separadores huérfanos. */
const unir = (partes: (string | number | null | undefined)[], sep = " · ") =>
  partes.filter(p => p !== null && p !== undefined && p !== "" && p !== 0).join(sep);

const fecha = (v?: string | null) => (v ? formatDate(v) : null);

/** Rango de fechas legible; si son iguales o falta una, no inventa el rango. */
const rango = (a?: string | null, b?: string | null) => {
  if (a && b) return `${formatDate(a)} – ${formatDate(b)}`;
  return fecha(a) || fecha(b) || null;
};

// ── Piezas de presentación ──────────────────────────────────────────────────

/**
 * Dato suelto. Se usa para lo que de verdad no tiene estructura; el resto de
 * cada categoría se pinta con su propia forma.
 */
const Dato = memo(function Dato({ etiqueta, valor }: { etiqueta: string; valor: any }) {
  const v = valor === null || valor === undefined || valor === "" ? guion : valor;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] leading-tight text-accent dark:text-slate-400">{etiqueta}</dt>
      <dd className="text-sm font-medium text-primary dark:text-white break-words">{String(v)}</dd>
    </div>
  );
});

const Datos = memo(function Datos({ items }: { items: [string, any][] }) {
  const visibles = items.filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (visibles.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
      {visibles.map(([k, v]) => <Dato key={k} etiqueta={k} valor={v} />)}
    </dl>
  );
});

/**
 * Lista de personas. Aparece en cinco categorías con nombres de campo
 * distintos (`guests`, `travelers`, `passengers`), así que se normaliza aquí.
 */
const Personas = memo(function Personas({ titulo, gente }: { titulo: string; gente?: any[] }) {
  if (!gente?.length) return null;
  return (
    <div>
      <p className="text-[11px] text-accent dark:text-slate-400 mb-1.5">{titulo}</p>
      <ul className="flex flex-wrap gap-1.5">
        {gente.map((p, i) => (
          <li
            key={p.docNumber || p.id || i}
            className="text-xs bg-white dark:bg-slate-800 border border-gray-border dark:border-slate-700 rounded-full pl-2.5 pr-2 py-1 text-primary dark:text-slate-200"
          >
            {p.name || p.nombreCompleto || guion}
            {p.docNumber ? (
              <span className="text-accent dark:text-slate-500 ml-1.5">{p.docNumber}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
});

/**
 * Los tramos de un vuelo, como la secuencia que son.
 *
 * Aquí la numeración sí significa algo —es el orden en que se vuelan— a
 * diferencia de los `01 / 02 / 03` decorativos. El hilo vertical a la
 * izquierda es lo que convierte una lista en un itinerario.
 */
const Tramos = memo(function Tramos({ legs }: { legs?: any[] }) {
  if (!legs?.length) return null;
  return (
    <ol className="relative pl-4 space-y-3 before:absolute before:left-[3px] before:top-2 before:bottom-2 before:w-px before:bg-highlight/30">
      {legs.map((l, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-4 top-[7px] w-[7px] h-[7px] rounded-full bg-highlight" />
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="font-mono text-sm font-semibold text-primary dark:text-white tabular-nums">
              {l.origin || "???"} {l.time || ""}
              <span className="text-accent mx-1.5">→</span>
              {l.destination || "???"} {l.arrivalTime || ""}
            </span>
            <span className="text-xs text-accent dark:text-slate-400">
              {unir([l.date ? formatDate(l.date) : null, l.flightNumber, l.airline,
                     l.seat ? `asiento ${l.seat}` : null, l.ticketNumber])}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
});

/** Nota larga: observaciones, condiciones médicas, restricciones. */
const Nota = memo(function Nota({ titulo, texto }: { titulo: string; texto?: string | null }) {
  if (!texto) return null;
  return (
    <div className="border-l-2 border-highlight/40 pl-3">
      <p className="text-[11px] text-accent dark:text-slate-400">{titulo}</p>
      <p className="text-sm text-primary dark:text-slate-200 leading-relaxed">{texto}</p>
    </div>
  );
});

const Bloque = ({ children }: { children: ReactNode }) => (
  <div className="space-y-4">{children}</div>
);

// ── Etiquetas legibles de los enums ─────────────────────────────────────────

const MODO_VUELO: Record<string, string> = {
  one_way: "Solo ida", round_trip: "Ida y vuelta", multi_city: "Multidestino",
};
const TAMANO_MASCOTA: Record<string, string> = {
  pequeno: "Pequeño", mediano: "Mediano", grande: "Grande", gigante: "Gigante",
};
const TRANSPORTE_MASCOTA: Record<string, string> = {
  cabina: "En cabina", bodega: "En bodega", terrestre: "Terrestre",
};

// ── El catálogo de formas ───────────────────────────────────────────────────

export interface Resumen {
  /** Lo que identifica al servicio: la ruta, el hotel, el nombre del titular. */
  titulo: string;
  /** Segunda línea: para quién y con qué referencia. */
  meta: string;
  /** Cuándo. Se alinea en su propia columna para poder escanear la fecha. */
  cuando: string | null;
}

interface Forma {
  label: string;
  Icono: typeof Plane;
  resumen: (x: any) => Resumen;
  Detalle: (props: { item: any }) => ReactElement;
}

export const FORMAS: Record<string, Forma> = {
  ticket: {
    label: "Tiquetería",
    Icono: Plane,
    resumen: (t) => {
      const legs: any[] = t.legs || [];
      // La ruta completa, no solo el origen: es lo que identifica un vuelo.
      const escalas = legs.map(l => l.origin).filter(Boolean);
      const ultimo = legs[legs.length - 1]?.destination;
      const ruta = [...escalas, ultimo].filter(Boolean).join(" → ");
      const pax = (t.passengers || []).map((p: any) => p.name).filter(Boolean);
      return {
        titulo: ruta || t.flightNumber || "Vuelo",
        meta: unir([pax.join(", "), t.reservationNumber, MODO_VUELO[t.flightMode]]),
        cuando: fecha(legs[0]?.date),
      };
    },
    Detalle: ({ item: t }) => (
      <Bloque>
        <Tramos legs={t.legs} />
        <Datos items={[
          ["Aerolínea", t.airlineName || t.airline],
          ["Reserva", t.reservationNumber],
          ["Tiquete", t.ticketNumber],
          ["Equipaje", t.baggagePlanName],
          ["Modo", MODO_VUELO[t.flightMode] || t.flightMode],
          ["Check-in", t.checkinStatus],
        ]} />
        <Personas titulo="Pasajeros" gente={t.passengers} />
      </Bloque>
    ),
  },

  hotel: {
    label: "Hotelería",
    Icono: BedDouble,
    resumen: (h) => ({
      titulo: h.hotelName || "Alojamiento",
      meta: unir([h.destination, h.reservationNumber,
                  h.roomCount ? `${h.roomCount} hab.` : null]),
      cuando: rango(h.startDate, h.endDate),
    }),
    Detalle: ({ item: h }) => (
      <Bloque>
        <Datos items={[
          ["Destino", h.destination],
          ["Tipo", h.hotelType],
          ["Habitación", unir([h.roomType, h.roomCount ? `x${h.roomCount}` : null], " ")],
          ["Régimen", h.mealPlan],
          ["Reserva", h.reservationNumber],
          ["Entrada / salida", rango(h.startDate, h.endDate)],
        ]} />
        <Personas titulo="Huéspedes" gente={h.guests} />
      </Bloque>
    ),
  },

  insurance: {
    label: "Seguro",
    Icono: ShieldCheck,
    resumen: (s) => ({
      titulo: s.insuranceType || "Asistencia",
      meta: unir([s.coverageAmount ? `Cobertura ${formatCurrency(s.coverageAmount)}` : null,
                  s.coverageDays ? `${s.coverageDays} días` : null]),
      cuando: rango(s.startDate, s.endDate),
    }),
    Detalle: ({ item: s }) => (
      <Bloque>
        <Datos items={[
          ["Plan", s.insuranceType],
          ["Cobertura", s.coverageAmount ? formatCurrency(s.coverageAmount) : null],
          ["Días", s.coverageDays],
          ["Vigencia", rango(s.startDate, s.endDate)],
          ["Contacto", s.contactNumber],
        ]} />
        <Personas titulo="Asegurados" gente={s.members} />
      </Bloque>
    ),
  },

  plan: {
    label: "Paquete",
    Icono: Package,
    resumen: (p) => ({
      titulo: p.packageName || "Paquete",
      meta: unir([p.destination, p.travelersCount ? `${p.travelersCount} viajeros` : null]),
      cuando: rango(p.startDate, p.endDate),
    }),
    Detalle: ({ item: p }) => (
      <Bloque>
        <Datos items={[
          ["Destino", p.destination],
          ["Fechas", rango(p.startDate, p.endDate)],
          ["Viajeros", p.travelersCount],
          ["Hotel", p.hotelName],
          ["Régimen", p.mealPlan],
          ["Aerolínea", p.airline],
        ]} />
        {/* Lo incluido es una lista de sí/no: se muestra solo lo que sí entra. */}
        <div className="flex flex-wrap gap-1.5">
          {([["Vuelo", p.includesFlight], ["Hotel", p.includesHotel],
             ["Traslados", p.includesTransfers], ["Tours", p.includesTours],
             ["Asistencia", p.includesAssistance]] as [string, boolean][])
            .filter(([, si]) => si)
            .map(([q]) => (
              <span key={q} className="text-xs bg-highlight-soft text-highlight-ink dark:text-highlight border border-highlight/20 rounded-full px-2.5 py-1">
                incluye {q}
              </span>
            ))}
        </div>
        <Personas titulo="Viajeros" gente={p.travelers} />
      </Bloque>
    ),
  },

  checkin: {
    label: "Check-in",
    Icono: BookCheck,
    resumen: (c) => ({
      titulo: c.flightOrReservation || "Check-in",
      meta: unir([c.seat ? `Asiento ${c.seat}` : null, c.baggage, c.phone]),
      cuando: c.travelDate ? formatDateTime(c.travelDate) : null,
    }),
    Detalle: ({ item: c }) => (
      <Bloque>
        <Datos items={[
          ["Vuelo / reserva", c.flightOrReservation],
          ["Fecha de viaje", c.travelDate ? formatDateTime(c.travelDate) : null],
          ["Asiento", c.seat],
          ["Equipaje", c.baggage],
          ["Teléfono", c.phone],
          ["Silla de ruedas", c.usesWheelchair ? "Sí" : null],
        ]} />
        <Nota titulo="Necesidades especiales" texto={c.specialNeeds} />
      </Bloque>
    ),
  },

  migration: {
    label: "Documentación migratoria",
    Icono: FileText,
    resumen: (m) => ({
      titulo: m.requestedDocType || "Trámite migratorio",
      meta: unir([m.destinationCountry, m.nationality, m.passportNumber]),
      cuando: fecha(m.passportExpiry),
    }),
    Detalle: ({ item: m }) => (
      <Datos items={[
        ["Documento solicitado", m.requestedDocType],
        ["País destino", m.destinationCountry],
        ["Nacionalidad", m.nationality],
        ["Tipo de documento", m.docType],
        ["Pasaporte", m.passportNumber],
        ["Vence", fecha(m.passportExpiry)],
      ]} />
    ),
  },

  simcard: {
    label: "SIM card",
    Icono: Smartphone,
    resumen: (s) => ({
      titulo: unir([s.simType, s.dataPlan], " · ") || "SIM card",
      meta: unir([s.destinationCountry, s.tripDuration, s.deliveryMethod]),
      cuando: s.arrivalDate ? formatDateTime(s.arrivalDate) : null,
    }),
    Detalle: ({ item: s }) => (
      <Datos items={[
        ["Tipo", s.simType],
        ["Plan de datos", s.dataPlan],
        ["País destino", s.destinationCountry],
        ["Llegada", s.arrivalDate ? formatDateTime(s.arrivalDate) : null],
        ["Duración", s.tripDuration],
        ["Entrega", s.deliveryMethod],
      ]} />
    ),
  },

  car: {
    label: "Renta de vehículo",
    Icono: Car,
    resumen: (c) => ({
      titulo: c.vehicleCategory || "Vehículo",
      meta: unir([c.mainDriver, c.pickupLocation]),
      cuando: rango(c.pickupDate, c.returnDate),
    }),
    Detalle: ({ item: c }) => (
      <Bloque>
        <Datos items={[
          ["Categoría", c.vehicleCategory],
          ["Conductor", c.mainDriver],
          ["Licencia", c.licenseNumber],
          ["Recogida", c.pickupDate ? formatDateTime(c.pickupDate) : null],
          ["Devolución", c.returnDate ? formatDateTime(c.returnDate) : null],
          ["Lugar", c.pickupLocation],
          ["Seguro", c.insuranceType],
          ["Garantía", c.guaranteeCreditCard],
          ["Conductores extra", c.additionalDrivers],
        ]} />
      </Bloque>
    ),
  },

  finca: {
    label: "Finca",
    Icono: Warehouse,
    resumen: (f) => ({
      titulo: f.fincaName || "Finca",
      meta: unir([f.city, f.responsibleName,
                  unir([f.adultsCount ? `${f.adultsCount} adultos` : null,
                        f.childrenCount ? `${f.childrenCount} niños` : null], ", ")]),
      cuando: rango(f.checkInDate, f.checkOutDate),
    }),
    Detalle: ({ item: f }) => (
      <Bloque>
        <Datos items={[
          ["Finca", f.fincaName],
          ["Ciudad", f.city],
          ["Dirección", f.address],
          ["Responsable", unir([f.responsibleName, f.docNumber])],
          ["Entrada", f.checkInDate ? formatDateTime(f.checkInDate) : null],
          ["Salida", f.checkOutDate ? formatDateTime(f.checkOutDate) : null],
          ["Ocupantes", unir([f.adultsCount ? `${f.adultsCount} adultos` : null,
                              f.childrenCount ? `${f.childrenCount} niños` : null], ", ")],
          ["Mascotas", f.hasPets ? (f.petType || "Sí") : null],
          ["Servicios", f.additionalServices],
        ]} />
        <Nota titulo="Observaciones" texto={f.observations} />
      </Bloque>
    ),
  },

  tour: {
    label: "Tour",
    Icono: Compass,
    resumen: (t) => ({
      titulo: t.tourName || "Tour",
      meta: unir([t.passengerName,
                  unir([t.adultsCount ? `${t.adultsCount} adultos` : null,
                        t.childrenCount ? `${t.childrenCount} niños` : null], ", "),
                  t.guideLanguage]),
      cuando: fecha(t.preferredDate),
    }),
    Detalle: ({ item: t }) => (
      <Bloque>
        <Datos items={[
          ["Tour", t.tourName],
          ["Fecha", fecha(t.preferredDate)],
          ["Participantes", unir([t.adultsCount ? `${t.adultsCount} adultos` : null,
                                  t.childrenCount ? `${t.childrenCount} niños` : null], ", ")],
          ["Edades", t.childrenAges],
          ["Idioma del guía", t.guideLanguage],
          ["Transporte", t.needsTransport ? "Incluido" : null],
          ["Punto de recogida", t.pickupPoint],
          ["Teléfono", t.phone],
        ]} />
        <Nota titulo="Condiciones médicas" texto={t.medicalConditions} />
        <Nota titulo="Observaciones" texto={t.observations} />
        <Personas titulo="Participantes" gente={t.guests} />
      </Bloque>
    ),
  },

  convention: {
    label: "Evento",
    Icono: Users,
    resumen: (c) => ({
      titulo: c.venueName || c.eventType || "Evento",
      meta: unir([c.organization, c.city,
                  c.estimatedAttendance ? `${c.estimatedAttendance} asistentes` : null]),
      cuando: rango(c.startDate, c.endDate),
    }),
    Detalle: ({ item: c }) => (
      <Bloque>
        <Datos items={[
          ["Sede", c.venueName],
          ["Organización", c.organization],
          ["Contacto", unir([c.contactName, c.email])],
          ["Tipo", c.eventType],
          ["Fechas", rango(c.startDate, c.endDate)],
          ["Asistencia", c.estimatedAttendance],
          ["Espacio", c.requiredSpace],
          ["Ciudad", c.city],
          ["Dirección", c.address],
          ["Equipo AV", c.avEquipment],
          ["Catering", c.hasCatering ? (c.cateringNotes || "Sí") : null],
        ]} />
      </Bloque>
    ),
  },

  restaurant: {
    label: "Restaurante",
    Icono: Utensils,
    resumen: (r) => ({
      titulo: r.reservationName || "Reserva",
      meta: unir([r.peopleCount ? `${r.peopleCount} personas` : null,
                  r.menuType, r.specialOccasion]),
      cuando: r.dateTime ? formatDateTime(r.dateTime) : null,
    }),
    Detalle: ({ item: r }) => (
      <Bloque>
        <Datos items={[
          ["A nombre de", r.reservationName],
          ["Fecha y hora", r.dateTime ? formatDateTime(r.dateTime) : null],
          ["Personas", r.peopleCount],
          ["Mesa", r.tablePreference],
          ["Menú", r.menuType],
          ["Ocasión", r.specialOccasion],
          ["Teléfono", r.phone],
        ]} />
        <Nota titulo="Restricciones alimentarias" texto={r.dietaryRestrictions} />
      </Bloque>
    ),
  },

  visa: {
    label: "Visa",
    Icono: Stamp,
    resumen: (v) => ({
      titulo: unir([v.visaType, v.countryApplying], " · ") || "Visa",
      meta: unir([v.fullName, v.passportNumber]),
      cuando: fecha(v.estimatedTravelDate),
    }),
    Detalle: ({ item: v }) => (
      <Datos items={[
        ["Solicitante", v.fullName],
        ["Tipo de visa", v.visaType],
        ["País", v.countryApplying],
        ["Nacionalidad", v.nationality],
        ["Documento", unir([v.docType, v.passportNumber])],
        ["Pasaporte vence", fecha(v.passportExpiry)],
        ["Nacimiento", fecha(v.birthDate)],
        ["Viaje estimado", fecha(v.estimatedTravelDate)],
        ["Correo", v.email],
      ]} />
    ),
  },

  passport: {
    label: "Pasaporte",
    Icono: BookOpen,
    resumen: (p) => ({
      titulo: p.fullName || "Pasaporte",
      meta: unir([p.processType || p.tramiteType, p.idNumber, p.residenceCity]),
      cuando: fecha(p.estimatedTravelDate),
    }),
    Detalle: ({ item: p }) => (
      <Datos items={[
        ["Titular", p.fullName],
        ["Documento", p.idNumber],
        ["Tipo de trámite", p.processType || p.tramiteType],
        ["Nacimiento", fecha(p.birthDate)],
        ["Ciudad de residencia", p.residenceCity],
        ["Viaje estimado", fecha(p.estimatedTravelDate)],
        ["Teléfono", p.phone],
      ]} />
    ),
  },

  pet: {
    label: "Servicio de mascotas",
    Icono: Dog,
    resumen: (m) => ({
      titulo: unir([m.petName, m.species], " · ") || "Mascota",
      meta: unir([m.breed, TAMANO_MASCOTA[m.size] || m.size,
                  TRANSPORTE_MASCOTA[m.travelType || m.transportType] || m.travelType,
                  m.transportCompany]),
      cuando: fecha(m.travelDate),
    }),
    Detalle: ({ item: m }) => (
      <Bloque>
        <Datos items={[
          ["Nombre", m.petName],
          ["Especie", m.species],
          ["Raza", m.breed],
          ["Peso", m.weight ? `${m.weight} kg` : null],
          ["Tamaño", TAMANO_MASCOTA[m.size] || m.size],
          ["Cómo viaja", TRANSPORTE_MASCOTA[m.travelType || m.transportType] || m.travelType],
          ["Transportadora", m.transportCompany],
          ["Fecha de viaje", fecha(m.travelDate)],
          ["País destino", m.destinationCountry],
          ["Teléfono", m.phone],
        ]} />
        <Nota titulo="Condiciones médicas" texto={m.medicalConditions} />
        <Nota titulo="Observaciones" texto={m.observations} />
      </Bloque>
    ),
  },
};

/** Forma de reserva, para una categoría que no esté en el catálogo. */
export const FORMA_GENERICA: Forma = {
  label: "Servicio",
  Icono: Package,
  resumen: (x) => ({
    titulo: x.name || x.nombre || "Servicio",
    meta: unir([x.supplier]),
    cuando: null,
  }),
  Detalle: ({ item }) => (
    <Datos items={Object.entries(item)
      .filter(([k, v]) => typeof v !== "object" && !["id", "parentDetalleId"].includes(k))
      .map(([k, v]) => [k, v] as [string, any])} />
  ),
};

export const formaDe = (slug: string) => FORMAS[slug] || FORMA_GENERICA;
