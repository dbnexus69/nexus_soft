import { LuBookCheck } from "react-icons/lu";

export interface User {
  id: number;
  personaId?: number;
  firstName?: string;
  lastName?: string;
  name: string;
  docType: string | null;
  docNumber: string;
  phone: string;
  birthDate?: string;
  email: string;
  password?: string;
  role: "admin" | "asesor" | "freelancer";
  status: "active" | "inactive";
  createdAt?: string;
  lastLogin?: string;
  avatar?: string | null;
  permisos?: { modulo: string; accion: string }[];
}

/**
 * Forma de los permisos por rol, y debe coincidir con `MODULE_ACTIONS` y
 * `SCOPED_VIEW_MODULES` del backend (`roles.service.js`).
 *
 * `responsables` era `all | own | none` y ahora es sí/no: su tabla no tiene
 * columna de dueño, así que un 'own' se habría comportado como 'all' sin
 * avisar. `users` y `config` faltaban, y son configurables desde el backend.
 */
export interface RolePermissions {
  dashboard: { view: "all" | "own" | "none" };
  sales: { view: "all" | "own" | "none"; create: boolean; edit: boolean };
  clients: { view: "all" | "own" | "none"; create: boolean; edit: boolean };
  responsables: { view: boolean; create: boolean; edit: boolean; delete: boolean };
  itineraries: { view: "all" | "own" | "none"; edit: boolean };
  commissions: { view: boolean; create: boolean; edit: boolean; delete: boolean };
  users: { view: boolean };
  config: { view: boolean };
}

export const DEFAULT_ASESOR_PERMISSIONS: RolePermissions = {
  dashboard: { view: "own" },
  sales: { view: "own", create: true, edit: true },
  clients: { view: "own", create: true, edit: true },
  // El backend los niega por defecto; aquí concedían view/create/edit.
  responsables: { view: false, create: false, edit: false, delete: false },
  itineraries: { view: "own", edit: false },
  commissions: { view: false, create: false, edit: false, delete: false },
  users: { view: true },
  config: { view: true },
};
export const DEFAULT_FREELANCER_PERMISSIONS: RolePermissions = {
  dashboard: { view: "own" },
  sales: { view: "own", create: true, edit: true },
  clients: { view: "own", create: true, edit: true },
  // El backend los niega por defecto; aquí concedían view/create/edit.
  responsables: { view: false, create: false, edit: false, delete: false },
  itineraries: { view: "own", edit: false },
  commissions: { view: false, create: false, edit: false, delete: false },
  users: { view: true },
  config: { view: true },
};

export const ADMIN_PERMISSIONS: RolePermissions = {
  dashboard: { view: "all" },
  sales: { view: "all", create: true, edit: true },
  clients: { view: "all", create: true, edit: true },
  responsables: { view: true, create: true, edit: true, delete: true },
  itineraries: { view: "all", edit: true },
  commissions: { view: true, create: true, edit: true, delete: true },
  users: { view: true },
  config: { view: true },
};

// Los mismos que `SCOPED_VIEW_MODULES` del backend. `responsables` sale de la
// lista: sin columna de dueño, su `view` es un sí/no.
const SCOPED_VIEW_MODULES = ['dashboard', 'sales', 'clients', 'itineraries'];

export function normalizeRolePermissions(perms: Partial<RolePermissions>, baseTemplate: RolePermissions = DEFAULT_ASESOR_PERMISSIONS): RolePermissions {
  const normalized = JSON.parse(JSON.stringify(baseTemplate)) as RolePermissions;
  if (!perms) return normalized;

  for (const mod of Object.keys(normalized) as (keyof RolePermissions)[]) {
    if (perms[mod]) {
      const src = perms[mod] as any;
      const dst = normalized[mod] as any;
      for (const key of Object.keys(dst)) {
        if (src[key] !== undefined) {
          const val = src[key];
          if (key === 'view' && SCOPED_VIEW_MODULES.includes(mod)) {
            dst[key] = val === true ? 'all' : val === false ? 'none' : val;
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
  registrationDate: string;
  createdBy?: number;
}

export interface Responsable {
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
}

export interface TicketData {
  airline: string;
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
    asiento?: string;
    nroReserva?: string;
    nroTiquete?: string;
  }[];
  linkedToPlanIndex?: number;
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
}

export interface SimCardData {
  passengerName: string;
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
}

export interface FincaData {
  fincaName: string;
  fincaAddress: string;
  fincaCity: string;
  observations: string;
  responsibleName: string;
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
}

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: string;
  reference?: string;
}

export interface Sale {
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
  supplierCost?: number;
  payments?: PaymentRecord[];
  servicesSummary?: Array<{ tipo: string; label: string; detail: string | null }>;
  isReviewed?: boolean;
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
  clientId?: string | null;
  clientName?: string | null;
  clientAvatar?: string | null;
  clientEmail?: string | null;
  clientDocType?: string | null;
  clientDocNumber?: string | null;
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
  name: string;
  type: string;
  docType: string;
  docNumber: string;
  status: "Activo" | "Inactivo";
  phone?: string;
  email?: string;
  accumulated?: number;
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
  documentTypes: { id: number; name: string; abreviatura: string }[];
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
  commissionSettlements: CommissionSettlement[];
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
  previousYearRevenue: number;
  revenueGrowth: number;
  totalOperations: number;
  operationsGrowth: number;
  pendingBalance: number;
  pendingCount: number;
  suppliersTotal: number;
  monthlyRevenue: number;
  categoryDistribution: CategoryData[];
  carteraStatus: CarteraData[];
  monthlyTrend: TrendData[];
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
