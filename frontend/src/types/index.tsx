import { LuBookCheck } from "react-icons/lu";

/**
 * Los roles del sistema, en un solo sitio.
 *
 * Había dos listas: esta y la de `LoginResponse` en `api/auth.ts`. Al crear
 * `superadmin` solo se actualizó una, así que el usuario que entraba con ese
 * rol llegaba tipado como si no existiera y `isAdmin` lo dejaba fuera del menú
 * de administración.
 */
export type UserRole = "superadmin" | "admin" | "asesor" | "freelancer";

export interface User {
  /** El número que ve la agencia, que empieza en 1 en cada una. El `id` es
   *  global y sus huecos son las filas de las otras agencias. */
  numero?: number | null;
  /** La agencia a la que pertenece. El nombre viene resuelto: ver `Client`. */
  empresaId?: number;
  empresaNombre?: string | null;
  id: number;
  personaId?: number;
  firstName?: string;
  lastName?: string;
  name: string;
  docTypeId?: number | null;
  docType: string | null;
  docNumber: string;
  phone: string;
  birthDate?: string;
  email: string;
  password?: string;
  role: UserRole;
  status: "active" | "inactive";
  createdAt?: string;
  lastLogin?: string | null;
  avatar?: string | null;
  permisos?: { modulo: string; accion: string }[];
}

/**
 * Forma de los permisos por rol, y debe coincidir con `MODULE_ACTIONS` y
 * `SCOPED_VIEW_MODULES` del backend (`roles.service.js`).
 *
 * `responsables` tiene alcance desde la spec 026, cuando su tabla tuvo dueño
 * (`creado_por_id`). `users` y `config` faltaban, y son configurables desde el backend.
 */
/** Alcance de una acción: toda la agencia, solo lo suyo o nada. */
export type Alcance = "all" | "own" | "none";

/**
 * Acciones con alcance en vez de sí/no. Espejo de `SCOPED_ACTIONS` en
 * `backend/src/utils/alcancePermisos.js`; cambiar los dos juntos (spec 020).
 */
export const SCOPED_ACTIONS: Record<string, string[]> = {
  dashboard: ['view'],
  sales: ['view', 'edit', 'delete'],
  quotes: ['view', 'edit', 'delete'],
  clients: ['view', 'edit'],
  responsables: ['view', 'edit', 'delete'],
  itineraries: ['view', 'edit'],
};
export const tieneAlcance = (modulo: string, accion: string) => (SCOPED_ACTIONS[modulo] || []).includes(accion);

export interface RolePermissions {
  dashboard: { view: "all" | "own" | "none" };
  // `delete` faltaba y `authorize('sales','delete')` sí la exige: sin ella en el
  // tipo, la pantalla de permisos no la conocía y la descartaba al guardar.
  // Editar y borrar con alcance (spec 020).
  sales: { view: Alcance; create: boolean; edit: Alcance; delete: Alcance };
  quotes: { view: Alcance; create: boolean; edit: Alcance; delete: Alcance };
  clients: { view: Alcance; create: boolean; edit: Alcance };
  responsables: { view: Alcance; create: boolean; edit: Alcance; delete: Alcance };
  itineraries: { view: Alcance; edit: Alcance };
  commissions: { view: boolean; create: boolean; edit: boolean; delete: boolean };
  users: { view: boolean; create: boolean; edit: boolean; delete: boolean };
  config: { view: boolean; edit: boolean };
  /**
   * Reescribir los permisos de un rol. Solo `superadmin` la tiene.
   *
   * Es su propio módulo y no `config.edit`, que es la llave del catálogo
   * (aerolíneas, proveedores): quien puede añadir una aerolínea no debería
   * poder además reescribir los permisos de todos los roles.
   */
  permissions: { view: boolean; edit: boolean };
}

export const DEFAULT_ASESOR_PERMISSIONS: RolePermissions = {
  dashboard: { view: "own" },
  sales: { view: "own", create: true, edit: "own", delete: "none" },
  quotes: { view: "own", create: true, edit: "own", delete: "none" },
  clients: { view: "own", create: true, edit: "own" },
  // El backend los niega por defecto; aquí concedían view/create/edit.
  responsables: { view: "none", create: false, edit: "none", delete: "none" },
  itineraries: { view: "own", edit: "none" },
  commissions: { view: false, create: false, edit: false, delete: false },
  users: { view: false, create: false, edit: false, delete: false },
  config: { view: true, edit: false },
  permissions: { view: false, edit: false },
};
export const DEFAULT_FREELANCER_PERMISSIONS: RolePermissions = {
  dashboard: { view: "own" },
  sales: { view: "own", create: true, edit: "own", delete: "none" },
  quotes: { view: "own", create: true, edit: "own", delete: "none" },
  clients: { view: "own", create: true, edit: "own" },
  // Los que creó (spec 026).
  responsables: { view: "own", create: true, edit: "own", delete: "none" },
  itineraries: { view: "own", edit: "none" },
  commissions: { view: false, create: false, edit: false, delete: false },
  users: { view: false, create: false, edit: false, delete: false },
  config: { view: true, edit: false },
  permissions: { view: false, edit: false },
};

export const ADMIN_PERMISSIONS: RolePermissions = {
  dashboard: { view: "all" },
  sales: { view: "all", create: true, edit: "all", delete: "all" },
  quotes: { view: "all", create: true, edit: "all", delete: "all" },
  clients: { view: "all", create: true, edit: "all" },
  responsables: { view: "all", create: true, edit: "all", delete: "all" },
  itineraries: { view: "all", edit: "all" },
  commissions: { view: true, create: true, edit: true, delete: true },
  users: { view: true, create: true, edit: true, delete: true },
  config: { view: true, edit: true },
  // El admin ve la pantalla pero no la guarda: eso es de superadmin.
  permissions: { view: true, edit: false },
};

/**
 * `superadmin`: el único que puede reescribir permisos. Se lo tiene el usuario
 * #1 (Admin Nexus) y su rol no es editable desde la interfaz — si alguien
 * pudiera quitarle permisos, nadie podría devolvérselos.
 */
export const SUPERADMIN_PERMISSIONS: RolePermissions = {
  ...ADMIN_PERMISSIONS,
  permissions: { view: true, edit: true },
};

export function normalizeRolePermissions(perms: Partial<RolePermissions>, baseTemplate: RolePermissions = DEFAULT_ASESOR_PERMISSIONS): RolePermissions {
  const normalized = JSON.parse(JSON.stringify(baseTemplate)) as RolePermissions;
  if (!perms) return normalized;

  // Se recorre la UNIÓN de lo que trae el servidor y lo que tiene la plantilla.
  //
  // Antes se recorrían solo las claves de la plantilla local, así que todo
  // permiso que el backend declarara y esta constante no conociera se caía por
  // el camino. Eran cinco —config.edit, sales.delete y las tres de users— y el
  // objeto recortado es el que se enviaba de vuelta en el PUT, que reemplaza
  // TODAS las filas del rol: abrir la pantalla de permisos y guardar borraba de
  // la base permisos que nadie había tocado.
  //
  // La plantilla se queda solo como valor por omisión cuando el servidor no
  // responde; ya no decide qué existe.
  const modulos = new Set([...Object.keys(normalized), ...Object.keys(perms)]);
  for (const mod of modulos as Set<keyof RolePermissions>) {
    if (perms[mod]) {
      const src = perms[mod] as any;
      const dst = ((normalized as any)[mod] ??= {}) as any;
      for (const key of new Set([...Object.keys(dst), ...Object.keys(src)])) {
        if (src[key] !== undefined) {
          const val = src[key];
          if (tieneAlcance(mod, key)) {
            // `true`/`false` de antes de la spec 020 valen 'all'/'none'.
            dst[key] = val === true || val === 'true' ? 'all' : val === false || val === 'false' ? 'none' : val;
          } else {
            dst[key] = typeof val === 'string' ? val !== 'none' && val !== 'false' : !!val;
          }
        }
      }
    }
  }
  return normalized;
}

export interface Client {
  /** El número que ve la agencia, que empieza en 1 en cada una. El `id` es
   *  global y sus huecos son las filas de las otras agencias. */
  numero?: number | null;
  /**
   * La agencia a la que pertenece.
   *
   * Llegan el id y el nombre juntos porque el id solo no se puede resolver:
   * `/companies/:id` es del superadministrador, así que un asesor recibiría un
   * número sin forma de traducirlo.
   */
  empresaId?: number;
  empresaNombre?: string | null;
  id: number;
  firstName: string;
  lastName: string;
  name: string;
  docType: string;
  docNumber: string;
  phone: string;
  email: string;
  birthDate?: string;
  address?: string;
  status: "active" | "inactive";
  avatar?: string;
  /** Destinos de preferencia, del más viejo al más nuevo (spec 017). */
  destinations?: string[];
  /** El último añadido: el que se muestra y por el que se filtra. */
  recentDestination?: string | null;
  registrationDate: string;
  createdBy?: number;
}

export interface Responsable {
  /** El número que ve la agencia, que empieza en 1 en cada una. El `id` es
   *  global y sus huecos son las filas de las otras agencias. */
  numero?: number | null;
  id: number;
  personaId: number;
  firstName: string;
  lastName: string;
  name: string;
  docTypeId: number | null;
  docType: string | null;
  docNumber: string;
  phone: string;
  email: string;
  status: "active" | "inactive";
  creadoAt: string;
  /** Quien lo creó (spec 026); vacío en los anteriores y en los creados suplantando. */
  createdBy?: number | null;
  deudaTotal: number;
  ventas?: any[];
}

export type SaleProductId =
  | "ticket"
  | "hotel"
  | "insurance"
  | "plan"
  | "checkin"
  | "migration"
  | "simcard"
  | "car"
  | "finca"
  | "tour"
  | "convention"
  | "restaurant"
  | "visa"
  | "passport"
  | "pet";

export interface SaleProductDef {
  id: SaleProductId;
  label: string;
  icon: string;
  group: "main" | "other";
}

export const SALE_PRODUCTS: SaleProductDef[] = [
  // --- Principales ---
  { id: "ticket", label: "Tiquetería", icon: "LuTicket", group: "main" },
  { id: "hotel", label: "Hotelería", icon: "LuBed", group: "main" },
  {
    id: "insurance",
    label: "Seguros de Viaje",
    icon: "LuShieldCheck",
    group: "main",
  },
  { id: "plan", label: "Paquetes", icon: "LuPackage", group: "main" },
  // --- Otros ---
  {
    id: "checkin",
    label: "Check-in",
    icon: "LuBookCheck",
    group: "other",
  },
  {
    id: "migration",
    label: "Documentación Migratoria",
    icon: "LuFileText",
    group: "other",
  },
  { id: "simcard", label: "SIM Card", icon: "LuSmartphone", group: "other" },
  {
    id: "car",
    label: "Renta de Vehículos",
    icon: "LuCar",
    group: "other",
  },
  {
    id: "finca",
    label: "Renta de Fincas",
    icon: "LuWarehouse",
    group: "other",
  },
  { id: "tour", label: "Tours", icon: "LuCompass", group: "other" },
  {
    id: "convention",
    label: "Centros de Convención",
    icon: "LuUsers",
    group: "other",
  },
  {
    id: "restaurant",
    label: "Restaurantes",
    icon: "LuUtensils",
    group: "other",
  },
  { id: "visa", label: "Visa", icon: "LuStamp", group: "other" },
  { id: "passport", label: "Pasaporte", icon: "LuBookOpen", group: "other" },
  {
    id: "pet",
    label: "Servicio de Mascotas",
    icon: "LuDog",
    group: "other",
  },
];

export interface FlightLeg {
  origin: string;
  destination: string;
  flightNumber: string;
  seat: string;
  date: string;
  time?: string;
  arrivalDate?: string;
  arrivalTime?: string;
  ticketNumber?: string;
  airline?: string;
  baggagePlan?: string;
}

export interface GuestInfo {
  name: string;
  docType: string;
  docNumber: string;
}

export interface HotelData {
  hotelName: string;
  destination: string;
  supplier: string;
  reservationNumber: string;
  startDate: string;
  endDate: string;
  supplierCost: number;
  ta: number;
  supplierPaymentMethod: string;
  hotelType?: string;
  observations?: string;
  guests: GuestInfo[];
  linkedToPlanIndex?: number;
  /** Hasta 5 fotos del servicio, solo mientras se cotiza (spec 021) — rutas/URLs, nunca base64. */
  images?: string[];
  /** El id de `detalle_cotizacion` ya guardado — sin él, `ImagesField` no sabe a qué línea subir (spec 021). */
  lineId?: string;
}

export interface PlanData {
  planName: string;
  hotelName: string;
  supplierCost: number;
  ta: number;
  reservationNumber: string;
  flightNumber: string;
  ticketNumber: string;
  packageId?: number | string;
  packageName?: string;
  packageRateId?: number | string;
  confirmationNumber?: string;
  observations?: string;
  adultsCount?: number;
  childrenCount?: number;
  transportType?: string;
    startDate: string;
  endDate: string;
  flightDepartureDate?: string;
  flightDepartureArrivalDate?: string;
  flightReturnDate?: string;
  flightReturnArrivalDate?: string;
  hotelCheckIn?: string;
  hotelCheckOut?: string;
  supplierPaymentMethod: string;
  supplier: string;
  airline: string;
  guests: GuestInfo[];
  packageType?: 'own' | 'supplier';
  voucher?: { name: string; base64: string };
  vouchers?: Array<{ name: string; base64: string }>;
  sendVoucher?: boolean;
  images?: string[];
  /** El id de `detalle_cotizacion` ya guardado — sin él, `ImagesField` no sabe a qué línea subir (spec 021). */
  lineId?: string;
}

export interface InsuranceData {
  insuranceType: string;
  phone: string;
  supplier: string;
  supplierCost: number;
  ta: number;
  supplierPaymentMethod: string;
  members: GuestInfo[];
  coverage: number;
  coverageDays: number;
  startDate: string;
  endDate: string;
  linkedToPlanIndex?: number;
  images?: string[];
  /** El id de `detalle_cotizacion` ya guardado — sin él, `ImagesField` no sabe a qué línea subir (spec 021). */
  lineId?: string;
}

export interface TicketData {
  airline: string;
  /** El nombre de la aerolínea tal como lo devuelve la API al leer la venta. */
  airlineName?: string | null;
  supplier: string;
  reservationNumber: string;
  flightNumber: string;
  departureDate: string;
  arrivalDate: string;
  supplierCost: number;
  ta: number;
  supplierPaymentMethod: string;
  baggagePlan: string;
  ticketNumber: string;
  seatNumber: string;
  flightMode: 'one_way' | 'round_trip';
  hasStops: boolean;
  returnHasStops?: boolean;
  outboundStops?: FlightLeg[];
  returnStops?: FlightLeg[];
  legs: FlightLeg[];
  returnLeg?: FlightLeg;
  passengers: {
    name: string;
    docType: string;
    docNumber: string;
    birthDate: string;
    esTitular?: boolean;
    /** Un asiento por tramo, por su orden en el tiquete (spec 012). `asiento` es de borradores viejos y se ignora. */
    asientos?: { tramo: number; asiento: string }[];
    asiento?: string;
    nroReserva?: string;
    nroTiquete?: string;
  }[];
  linkedToPlanIndex?: number;
  images?: string[];
  /** El id de `detalle_cotizacion` ya guardado — sin él, `ImagesField` no sabe a qué línea subir (spec 021). */
  lineId?: string;
}

export interface CheckInData {
  passengerName: string;
  docType: string;
  docNumber: string;
  flightOrReservation: string;
  travelDate: string;
  seat: string;
  baggage: string;
  phone: string;
  specialNeeds: string;
  needsWheelchair: boolean;
  voucher?: { name: string; base64: string };
  sendVoucher?: boolean;
  supplierName?: string;
  supplierCost?: number;
  supplierPaymentMethod?: string;
  ta?: number;
  linkedToPlanIndex?: number;
  images?: string[];
  /** El id de `detalle_cotizacion` ya guardado — sin él, `ImagesField` no sabe a qué línea subir (spec 021). */
  lineId?: string;
}

export interface MigrationData {
  passengerName: string;
  birthDate: string;
  nationality: string;
  docType: string;
  docNumber: string;
  passportExpiry: string;
  destinationCountry: string;
  requestedDocType: string;
  email: string;
  voucher?: { name: string; base64: string };
  sendVoucher?: boolean;
  supplierName?: string;
  supplierCost?: number;
  supplierPaymentMethod?: string;
  ta?: number;
  linkedToPlanIndex?: number;
  images?: string[];
  /** El id de `detalle_cotizacion` ya guardado — sin él, `ImagesField` no sabe a qué línea subir (spec 021). */
  lineId?: string;
}

export interface SimCardData {
  passengerName: string;
  docType?: string;
  docNumber: string;
  destinationCountry: string;
  arrivalDate: string;
  tripDuration: string;
  dataPlan: string;
  simType: string;
  deliveryMethod: string;
  email: string;
  voucher?: { name: string; base64: string };
  sendVoucher?: boolean;
  supplierName?: string;
  supplierCost?: number;
  supplierPaymentMethod?: string;
  ta?: number;
  linkedToPlanIndex?: number;
  images?: string[];
  /** El id de `detalle_cotizacion` ya guardado — sin él, `ImagesField` no sabe a qué línea subir (spec 021). */
  lineId?: string;
}

export interface CarRentalData {
  mainDriver: string;
  licenseNumber: string;
  pickupDate: string;
  returnDate: string;
  pickupLocation: string;
  vehicleCategory: string;
  additionalDrivers: number;
  insuranceType: string;
  guaranteeCreditCard: string;
  voucher?: { name: string; base64: string };
  sendVoucher?: boolean;
  supplierName?: string;
  supplierCost?: number;
  supplierPaymentMethod?: string;
  ta?: number;
  linkedToPlanIndex?: number;
  images?: string[];
  /** El id de `detalle_cotizacion` ya guardado — sin él, `ImagesField` no sabe a qué línea subir (spec 021). */
  lineId?: string;
}

export interface FincaData {
  fincaName: string;
  fincaAddress: string;
  fincaCity: string;
  observations: string;
  responsibleName: string;
  docType?: string;
  docNumber: string;
  checkInDate: string;
  checkOutDate: string;
  adultsCount: number;
  childrenCount: number;
  hasPets: boolean;
  petType: string;
  additionalServices: string[];
  phone: string;
  voucher?: { name: string; base64: string };
  sendVoucher?: boolean;
  supplierName?: string;
  supplierCost?: number;
  supplierPaymentMethod?: string;
  ta?: number;
  linkedToPlanIndex?: number;
  images?: string[];
  /** El id de `detalle_cotizacion` ya guardado — sin él, `ImagesField` no sabe a qué línea subir (spec 021). */
  lineId?: string;
}

export interface TourData {
  passengerName: string;
  selectedTour: string;
  preferredDate: string;
  adultsCount: number;
  childrenCount: number;
  childrenAges: string;
  guideLanguage: string;
  needsTransport: boolean;
  pickupPoint: string;
  medicalConditions: string;
  phone: string;
  observations?: string;
  voucher?: { name: string; base64: string };
  sendVoucher?: boolean;
  supplierName?: string;
  supplierCost?: number;
  supplierPaymentMethod?: string;
  ta?: number;
  guests: GuestInfo[];
  vouchers?: Array<{ name: string; base64: string }>;
  linkedToPlanIndex?: number;
  images?: string[];
  /** El id de `detalle_cotizacion` ya guardado — sin él, `ImagesField` no sabe a qué línea subir (spec 021). */
  lineId?: string;
}

export interface ConventionData {
  city?: string;
  address?: string;
  placeName?: string;
  organization: string;
  contactName: string;
  startDate: string;
  endDate: string;
  estimatedAttendance: number;
  requiredSpace: string;
  eventType: string;
  avEquipment: string[];
  hasCatering: boolean;
  cateringNotes: string;
  email: string;
  voucher?: { name: string; base64: string };
  sendVoucher?: boolean;
  supplierName?: string;
  supplierCost?: number;
  supplierPaymentMethod?: string;
  ta?: number;
  linkedToPlanIndex?: number;
  images?: string[];
  /** El id de `detalle_cotizacion` ya guardado — sin él, `ImagesField` no sabe a qué línea subir (spec 021). */
  lineId?: string;
}

export interface RestaurantData {
  reservationName: string;
  dateTime: string;
  peopleCount: number;
  tablePreference: string;
  menuType: string;
  dietaryRestrictions: string[];
  specialOccasion: string;
  phone: string;
  voucher?: { name: string; base64: string };
  sendVoucher?: boolean;
  supplierName?: string;
  supplierCost?: number;
  supplierPaymentMethod?: string;
  ta?: number;
  linkedToPlanIndex?: number;
  images?: string[];
  /** El id de `detalle_cotizacion` ya guardado — sin él, `ImagesField` no sabe a qué línea subir (spec 021). */
  lineId?: string;
}

export interface VisaData {
  fullName: string;
  birthDate: string;
  nationality: string;
  docType: string;
  docNumber: string;
  passportExpiration: string;
  countryApplying: string;
  visaType: string;
  estimatedTravelDate: string;
  email: string;
  voucher?: { name: string; base64: string };
  sendVoucher?: boolean;
  supplierName?: string;
  supplierCost?: number;
  supplierPaymentMethod?: string;
  ta?: number;
  linkedToPlanIndex?: number;
  images?: string[];
  /** El id de `detalle_cotizacion` ya guardado — sin él, `ImagesField` no sabe a qué línea subir (spec 021). */
  lineId?: string;
}

export interface PassportData {
  fullName: string;
  idNumber: string;
  birthDate: string;
  residenceCity: string;
  processType: string;
  estimatedTravelDate: string;
  phone: string;
  voucher?: { name: string; base64: string };
  sendVoucher?: boolean;
  supplierName?: string;
  supplierCost?: number;
  supplierPaymentMethod?: string;
  ta?: number;
  linkedToPlanIndex?: number;
  images?: string[];
  /** El id de `detalle_cotizacion` ya guardado — sin él, `ImagesField` no sabe a qué línea subir (spec 021). */
  lineId?: string;
}

export interface PetServiceData {
  ownerName: string;
  petName: string;
  species: string;
  breed: string;
  weight: number;
  size: string;
  travelType: string;
  travelDate: string;
  destinationCountry: string;
  medicalConditions: string;
  phone: string;
  transportCompany?: string;
  observations?: string;
  voucher?: { name: string; base64: string };
  sendVoucher?: boolean;
  supplierName?: string;
  supplierCost?: number;
  supplierPaymentMethod?: string;
  ta?: number;
  linkedToPlanIndex?: number;
  images?: string[];
  /** El id de `detalle_cotizacion` ya guardado — sin él, `ImagesField` no sabe a qué línea subir (spec 021). */
  lineId?: string;
}

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: string;
  reference?: string;
}

/**
 * Una línea de cotización: categoría, descripción y precio final (costo + ganancia + IVA).
 * `detalle` es el mismo objeto de categoría que usa el asistente de venta (`TicketData`,
 * `HotelData`...) — spec 007, replanificada para pedir los mismos datos que una venta.
 */
export interface QuoteLine {
  id: string;
  categoria: SaleProductId;
  descripcion: string;
  costoProveedor: number;
  ta: number;
  iva: number;
  precio: number;
  detalle?: Record<string, unknown> | null;
}

/**
 * Una cotización (spec 007). No es una venta: nada en ella es obligatorio, ni
 * siquiera el cliente — se exige recién al convertirla. Los totales se derivan al
 * leer, nunca se guardan ni se suman en el navegador.
 */
export interface Quote {
  id: number;
  numero?: number | null;
  name?: string | null;
  clientId: number | null;
  clientName?: string;
  asesorId: number;
  estado: "borrador" | "enviada" | "aceptada" | "rechazada" | "vencida";
  fechaVencimiento: string | null;
  observations?: string | null;
  ventaId?: number | null;
  creadoAt: string;
  lines: QuoteLine[];
  totals: { costoProveedor: number; ta: number; iva: number; total: number };
}

export interface Sale {
  /**
   * El número que ve la agencia, propio de cada empresa y sin huecos.
   *
   * El `id` sigue siendo la clave interna y lo que va en la URL, pero no se
   * pinta: es un autoincremento global, y sus huecos son las ventas de las
   * demás agencias — contables por cualquiera que sepa restar.
   */
  numero?: number | null;
  id: number;
  clientId: number;
  clientName: string;
  clientEmail?: string;
  clientAvatar?: string;
  asesorId: number;
  asesorName: string;
  responsableId?: number;
  responsableName?: string;
  date: string;
  total: number;
  status: "credito" | "abonado" | "pagado" | "anulado";
  category?: string;
  paymentMethod: string;
  observations?: string;
  products?: SaleProductId[];
  ticketData?: TicketData[];
  hotelData?: HotelData[];
  insuranceData?: InsuranceData[];
  planData?: PlanData[];
  checkInData?: CheckInData[];
  migrationData?: MigrationData[];
  simCardData?: SimCardData[];
  carRentalData?: CarRentalData[];
  fincaData?: FincaData[];
  tourData?: TourData[];
  conventionData?: ConventionData[];
  restaurantData?: RestaurantData[];
  visaData?: VisaData[];
  passportData?: PassportData[];
  petServiceData?: PetServiceData[];
  isCredit?: boolean;
  creditDueDate?: string;
  creditPaidAmount?: number;
  // Comisionista
  commissionAgentId?: number;
  commissionAgentName?: string;
  commissionAgentAmount?: number;
  commissionAgentRetentionPercentage?: number;
  commissionAgentNetPayment?: number;
  isSettled?: boolean;
  settlementDate?: string;
  ta?: number;
  iva?: number;
  supplierCost?: number;
  payments?: PaymentRecord[];
  servicesSummary?: Array<{ tipo: string; label: string; detail: string | null }>;
  isReviewed?: boolean;
  /** El último envío del voucher al cliente (spec 011). */
  lastVoucherSent?: { to: string; at: string } | null;
}

export interface Flight {
  id: string;
  originalTramoId?: string;
  pasajeroId?: string | null;
  email?: string | null;
  passenger: string;
  route: string;
  airline: string;
  date: string;
  time: string;
  type: "ida" | "regreso";
  checkin: "pendiente" | "realizado" | "critico" | "cancelado";
  flightNumber?: string;
  seat?: string | null;
  reservationNumber?: string;
  source?: "ticket" | "plan";
  additionalPassengers?: number;
  // El backend ya devolvía estos campos y la pantalla los pintaba con
  // `(flight as any)`. Declararlos quita los casts y deja que el compilador
  // avise si el contrato cambia.
  saleId?: string | null;
  /** El asesor de la venta del vuelo (spec 020). */
  asesorId?: number | null;
  clientId?: string | null;
  clientName?: string | null;
  clientAvatar?: string | null;
  clientEmail?: string | null;
  clientDocType?: string | null;
  clientDocNumber?: string | null;
  // "CC 1020304050, PA AB123456": el de cada pasajero (o el del cliente si no hay pasajeros).
  passengerDocs?: string | null;
  checkinStatus?: "pendiente" | "realizado" | "critico" | "cancelado";
  checkinAt?: string | null;
  checkinDocs?: { url: string; filename: string }[] | null;
  canceledAt?: string | null;
  reasonCanceled?: string | null;
}

/** Estados por los que se puede filtrar el listado de check-ins. */
export type CheckinStatusFilter = "pendiente" | "realizado" | "critico" | "cancelado";

/**
 * Contadores por estado que devuelve `GET /flights/checkins` en `meta.counts`.
 * `critico` es un subconjunto de `pendiente`, así que no suma en el total.
 */
export interface CheckinCounts {
  pendiente: number;
  realizado: number;
  cancelado: number;
  critico: number;
  total: number;
}

export interface CommissionAgent {
  id: number;
  numero?: number | null;
  name: string;
  type: string;
  docTypeId?: number | null;
  docType: string;
  docNumber: string;
  status: "Activo" | "Inactivo";
  phone?: string;
  email?: string;
  avatar?: string | null;
  banco?: string | null;
  tipoCuenta?: string | null;
  numeroCuenta?: string | null;
  accumulated: number;
  paymentThreshold?: number;
}

export interface TravelPackage {
  id: number;
  name: string;
  destination: string;
  nights: number;
  flight: {
    airline: string;
    supplier?: string;
    route: string;
    cabinBaggage?: string;
    checkedBaggage?: string;
    baggagePlan?: string;
    flightMode?: 'one_way' | 'round_trip';
    transportType?: string;
    legs?: {
      origin: string;
      destination: string;
      flightNumber: string;
      seat: string;
      date?: string;
    }[];
    returnLeg?: {
      origin: string;
      destination: string;
      flightNumber: string;
      seat: string;
      date?: string;
    };
  };
  accommodation: {
    hotel: string;
    hotelType: string;
    mealPlan: string;
    supplier?: string;
  };
  includedServices: string;
  notIncluded: string;
  medicalAssistance: {
    amountUsd: number;
    coverageDays: number;
  };
  rates: {
    adult: number;
    child: number;
  };
}

export interface CommissionSettlement {
  id: number;
  agentId: number;
  agentName: string;
  amount: number;
  date: string;
  paymentMethod: string;
  reference?: string;
  notes?: string;
  salesIds: number[];
}

export interface ConfigData {
  cards: {
    id: number;
    name: string;
    paymentMethod: string;
    lastFourDigits: string;
    status: "Activo" | "Inactivo";
    description: string;
  }[];
  paymentMethods: { id: number; name: string }[];
  documentTypes: { id: number; name: string; abbreviation: string }[];
  airlines: {
    id: number;
    name: string;
    code: string;
    type: "Nacional" | "Internacional";
    website: string;
  }[];
  suppliers: {
    id: number;
    name: string;
    type: string;
    email: string;
    phone: string;
    website: string;
  }[];
  airports: {
    id: number;
    name: string;
    abbreviation: string;
    city?: string;
    country?: string;
    location: string;
    type: "Nacional" | "Internacional" | "Ambos";
    status: "Activo" | "Inactivo";
  }[];
  baggage: {
    id: number;
    airlineName: string;
    fareType: string;
    personalItem: string;
    carryOn: string;
    checkedBag: string;
    notes: string;
  }[];
  packages: TravelPackage[];
  /** Los permisos del usuario conectado, tal como los aplica el servidor (`GET /auth/me/permissions`). */
  misPermisos?: RolePermissions | null;
  rolePermissions: {
    // `admin` faltaba aunque DataContext lo escribe en tiempo de ejecución
    // (`{ admin: normalizeRolePermissions(adminPerms, ADMIN_PERMISSIONS) }`).
    asesor: RolePermissions;
    freelancer: RolePermissions;
    admin: RolePermissions;
  };
}

export interface AppData {
  users: User[];
  clients: Client[];
  responsables: Responsable[];
  // Las ventas no viven aquí: su listado, filtros y paginación están en
  // SalesContext, y los detalles se piden filtrados por cliente o asesor.
  commissionAgents: CommissionAgent[];
  config: ConfigData;
  salesHistory: MonthlySale[];
}

export interface MonthlySale {
  id: number;
  year: number;
  month: number;
  total: number;
  count: number;
  category: {
    hotels: number;
    flights: number;
    packages: number;
    insurance: number;
    transfers: number;
  };
}

export interface DashboardStats {
  totalRevenue: number;
  // La respuesta los devolvía y el tipo no los declaraba.
  totalOperations: number;
  salesGrowth: number;
  monthlyRevenue: number;
  pendingBalance: number;
  pendingCount: number;
  suppliersTotal: number;
  totalClients: number;
  activeClients: number;
  totalFlights: number;
  supplierCount: number;
  categoryDistribution: { name: string; value: number; percentage: number }[];
  carteraStatus: { name: string; value: number; color: string }[];
  monthlyTrend: { month: number; currentYear: number; previousYear: number }[];
  categoryBreakdown: Record<string, { count: number; revenue: number; personas?: number }>;
  creditProveedores?: number;
  creditTa?: number;
}

export interface CategoryData {
  name: string;
  value: number;
  percentage: number;
}

export interface CarteraData {
  name: string;
  value: number;
  color: string;
}

export interface TrendData {
  month: number;
  currentYear: number;
  previousYear: number;
}

export type SortField =
  | "date"
  | "clientName"
  | "asesorName"
  | "total"
  | "status";
export type SortDirection = "asc" | "desc";

export interface PaginationState {
  page: number;
  perPage: number;
  total: number;
}

export interface DesgloseCategorias {
  documentos: number;
  hoteles: number;
  planes: number;
  seguros: number;
  tiquetes: number;
  otros: number;
}

export interface KPIData {
  vuelosVendidos: number;
  ordenes: {
    total: number;
    desglose: DesgloseCategorias;
  };
  taIngresada: {
    total: number;
    desglose: DesgloseCategorias;
  };
  taPendiente: {
    total: number;
    desglose: DesgloseCategorias;
  };
  proveedores: {
    total: number;
    desglose: DesgloseCategorias;
  };
}

export const EMPTY_DESGLOSE: DesgloseCategorias = {
  documentos: 0,
  hoteles: 0,
  planes: 0,
  seguros: 0,
  tiquetes: 0,
  otros: 0,
};

export const CATEGORIA_LABELS: Record<keyof DesgloseCategorias, string> = {
  documentos: "Documentos",
  hoteles: "Hoteles",
  planes: "Paquetes",
  seguros: "Seguros",
  tiquetes: "Tiquetes",
  otros: "Otros",
};

/**
 * Resumen de `GET /stats/attention`: lo que requiere acción hoy.
 *
 * Cada bloque trae el conteo, el importe y lo justo para pintar una línea. La
 * lista completa vive en su pantalla, que es donde se resuelve.
 */
export interface AttentionSummary {
  overdueCredit: { count: number; amount: number; oldestDueDate: string | null };
  criticalCheckins: {
    count: number;
    next: { departure: string; origin: string | null; destination: string | null } | null;
  };
  unreviewedSales: { count: number; amount: number };
}
