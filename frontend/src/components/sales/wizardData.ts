import {
  SaleProductId,
  TicketData,
  HotelData,
  InsuranceData,
  PlanData,
  CheckInData,
  MigrationData,
  SimCardData,
  CarRentalData,
  FincaData,
  TourData,
  ConventionData,
  RestaurantData,
  VisaData,
  PassportData,
  PetServiceData,
  GuestInfo,
} from "../../types";

import imgTiqueteria from "../../assets/tiqueteria.webp";
import imgHoteleria from "../../assets/hoteleria.webp";
import imgSeguros from "../../assets/seguros.webp";
import imgPlanes from "../../assets/planes.webp";
import type { Client } from "../../types";

export const PRODUCT_IMAGES: Record<string, string> = {
  ticket: imgTiqueteria,
  hotel: imgHoteleria,
  insurance: imgSeguros,
  plan: imgPlanes,
};

export interface PaymentData {
  amount: number;
  methodId: string;
  methodName: string;
  reference: string;
}

export interface WizardFormData {
  clientId: string;
  /** Registro completo del cliente elegido en el selector. El catálogo ya no
   *  viaja entero al navegador, así que no se puede volver a buscar por nombre. */
  clientData?: ClienteDelFormulario;
  commissionAgentId: string;
  commissionAgentName: string;
  responsableId?: string;
  responsableName?: string;
  commissionAgentPercentage: string;
  commissionAgentAmount: string;
  commissionAgentRetentionPercentage: string;
  commissionAgentNetPayment: string;
  asesorId: string;
  asesorName: string;
  selectedProducts: SaleProductId[];
  observations: string;
  paymentMethod: string;
  payments?: PaymentData[];
  total: string;
  ta: string;
  iva: string;
  supplierCost: string;
  status: string;
  isCredit: boolean;
  creditDueDate: string;
  tickets: TicketData[];
  hotels: HotelData[];
  insurances: InsuranceData[];
  plans: PlanData[];
  checkIns: CheckInData[];
  migrations: MigrationData[];
  simCards: SimCardData[];
  carRentals: CarRentalData[];
  fincas: FincaData[];
  tours: TourData[];
  conventions: ConventionData[];
  restaurants: RestaurantData[];
  visas: VisaData[];
  passports: PassportData[];
  petServices: PetServiceData[];
}

export interface WizardProps {
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const INITIAL_TICKET = (client?: ClienteDelFormulario): TicketData => ({
  airline: "",
  supplier: "",
  reservationNumber: "",
  flightNumber: "",
  departureDate: "",
  arrivalDate: "",
  supplierCost: 0,
  ta: 0,
  supplierPaymentMethod: "",
  baggagePlan: "",
  ticketNumber: "",
  seatNumber: "",
  flightMode: "one_way",
  hasStops: false,
  returnHasStops: false,
  outboundStops: [],
  returnStops: [],
  legs: [{ origin: "", destination: "", flightNumber: "", seat: "", date: "", airline: "", baggagePlan: "" }],
  passengers: [
    {
      name: client?.name || "",
      docType: client?.docType || "",
      docNumber: client?.docNumber || "",
      birthDate: client?.birthDate ? client.birthDate.split('T')[0] : "",
      esTitular: true,
      asiento: "",
      nroReserva: "",
      nroTiquete: ""
    }
  ],
});

export const INITIAL_HOTEL = (client?: ClienteDelFormulario): HotelData => ({
  hotelName: "",
  destination: "",
  supplier: "",
  reservationNumber: "",
  startDate: "",
  endDate: "",
  supplierCost: 0,
  ta: 0,
  supplierPaymentMethod: "",
  hotelType: "",
  observations: "",
  guests: [
    {
      name: client?.name || "",
      docType: client?.docType || "",
      docNumber: client?.docNumber || "",
    },
  ],
});

export const INITIAL_INSURANCE = (client?: ClienteDelFormulario): InsuranceData => ({
  insuranceType: "",
  phone: client?.phone || "",
  supplier: "",
  supplierCost: 0,
  ta: 0,
  supplierPaymentMethod: "",
  coverage: 0,
  coverageDays: 0,
  startDate: "",
  endDate: "",
  members: [
    {
      name: client?.name || "",
      docType: client?.docType || "",
      docNumber: client?.docNumber || "",
    },
  ],
});

export const INITIAL_PLAN = (client?: ClienteDelFormulario): PlanData => ({
  planName: "",
  packageId: "",
  packageName: "",
  packageRateId: "",
  hotelName: "",
  supplier: "",
  supplierCost: 0,
  ta: 0,
  supplierPaymentMethod: "",
  reservationNumber: "",
  confirmationNumber: "",
  observations: "",
  flightNumber: "",
  ticketNumber: "",
  adultsCount: 2,
  childrenCount: 0,
  startDate: "",
  endDate: "",
  flightDepartureDate: "",
  flightDepartureArrivalDate: "",
  flightReturnDate: "",
  flightReturnArrivalDate: "",
  hotelCheckIn: "",
  hotelCheckOut: "",
  airline: "",
  guests: [
    {
      name: client?.name || "",
      docType: client?.docType || "",
      docNumber: client?.docNumber || "",
    },
  ],
  packageType: "own",
  voucher: undefined,
  sendVoucher: false,
});

export const INITIAL_CHECKIN = (client?: ClienteDelFormulario): CheckInData => ({
  passengerName: client?.name || "",
  docType: client?.docType || "CC",
  docNumber: client?.docNumber || "",
  flightOrReservation: "",
  travelDate: "",
  seat: "",
  baggage: "",
  phone: client?.phone || "",
  specialNeeds: "",
  needsWheelchair: false,
  voucher: undefined,
  sendVoucher: false,
  supplierName: "",
  supplierCost: 0,
  ta: 0,
});

export const INITIAL_MIGRATION = (client?: ClienteDelFormulario): MigrationData => ({
  passengerName: client?.name || "",
  birthDate: client?.birthDate ? client.birthDate.split('T')[0] : "",
  nationality: "",
  docType: client?.docType || "CC",
  docNumber: client?.docNumber || "",
  passportExpiry: "",
  destinationCountry: "",
  requestedDocType: "Visa Turismo",
  email: client?.email || "",
  voucher: undefined,
  sendVoucher: false,
  supplierName: "",
  supplierCost: 0,
  ta: 0,
});

export const INITIAL_SIMCARD = (client?: ClienteDelFormulario): SimCardData => ({
  passengerName: client?.name || "",
  docNumber: client?.docNumber || "",
  destinationCountry: "",
  arrivalDate: "",
  tripDuration: "",
  dataPlan: "",
  simType: "eSIM",
  deliveryMethod: "Correo Electrónico",
  email: client?.email || "",
  voucher: undefined,
  sendVoucher: false,
  supplierName: "",
  supplierCost: 0,
  ta: 0,
});

export const INITIAL_CAR_RENTAL = (client?: ClienteDelFormulario): CarRentalData => ({
  mainDriver: client?.name || "",
  licenseNumber: "",
  pickupDate: "",
  returnDate: "",
  pickupLocation: "Aeropuerto",
  vehicleCategory: "compacto",
  additionalDrivers: 0,
  insuranceType: "basic",
  guaranteeCreditCard: "",
  voucher: undefined,
  sendVoucher: false,
  supplierName: "",
  supplierCost: 0,
  ta: 0,
});

export const INITIAL_FINCA = (client?: ClienteDelFormulario): FincaData => ({
  fincaName: "",
  fincaAddress: "",
  fincaCity: "",
  observations: "",
  responsibleName: client?.name || "",
  docNumber: client?.docNumber || "",
  checkInDate: "",
  checkOutDate: "",
  adultsCount: 2,
  childrenCount: 0,
  hasPets: false,
  petType: "",
  additionalServices: [],
  phone: client?.phone || "",
  voucher: undefined,
  sendVoucher: false,
  supplierName: "",
  supplierCost: 0,
  ta: 0,
});

export const INITIAL_TOUR = (client?: ClienteDelFormulario): TourData => ({
  passengerName: client?.name || "",
  selectedTour: "",
  preferredDate: "",
  adultsCount: 2,
  childrenCount: 0,
  childrenAges: "",
  guideLanguage: "español",
  needsTransport: false,
  pickupPoint: "",
  medicalConditions: "",
  phone: client?.phone || "",
  observations: "",
  voucher: undefined,
  sendVoucher: false,
  supplierName: "",
  supplierCost: 0,
  ta: 0,
  guests: [{ name: client?.name || "", docType: client?.docType || "CC", docNumber: client?.docNumber || "" }],
  vouchers: [],
});

export const INITIAL_CONVENTION = (client?: ClienteDelFormulario): ConventionData => ({
  city: "",
  address: "",
  placeName: "",
  organization: "",
  contactName: client?.name || "",
  startDate: "",
  endDate: "",
  estimatedAttendance: 0,
  requiredSpace: "sala A",
  eventType: "congreso",
  avEquipment: [],
  hasCatering: false,
  cateringNotes: "",
  email: client?.email || "",
  voucher: undefined,
  sendVoucher: false,
  supplierName: "",
  supplierCost: 0,
  ta: 0,
});

export const INITIAL_RESTAURANT = (client?: ClienteDelFormulario): RestaurantData => ({
  reservationName: client?.name || "",
  dateTime: "",
  peopleCount: 2,
  tablePreference: "interior",
  menuType: "à la carte",
  dietaryRestrictions: [],
  specialOccasion: "cumpleaños",
  phone: client?.phone || "",
  voucher: undefined,
  sendVoucher: false,
  supplierName: "",
  supplierCost: 0,
  ta: 0,
});

export const INITIAL_VISA = (client?: ClienteDelFormulario): VisaData => ({
  fullName: client?.name || "",
  birthDate: client?.birthDate ? client.birthDate.split('T')[0] : "",
  nationality: "",
  docType: client?.docType || "CC",
  docNumber: client?.docNumber || "",
  passportExpiration: "",
  countryApplying: "",
  visaType: "turista",
  estimatedTravelDate: "",
  email: client?.email || "",
  voucher: undefined,
  sendVoucher: false,
  supplierName: "",
  supplierCost: 0,
  ta: 0,
});

export const INITIAL_PASSPORT = (client?: ClienteDelFormulario): PassportData => ({
  fullName: client?.name || "",
  idNumber: client?.docNumber || "",
  birthDate: client?.birthDate ? client.birthDate.split('T')[0] : "",
  residenceCity: "",
  processType: "primera vez",
  estimatedTravelDate: "",
  phone: client?.phone || "",
  voucher: undefined,
  sendVoucher: false,
  supplierName: "",
  supplierCost: 0,
  ta: 0,
});

export const INITIAL_PET_SERVICE = (client?: ClienteDelFormulario): PetServiceData => ({
  ownerName: client?.name || "",
  petName: "",
  species: "perro",
  breed: "",
  weight: 0,
  size: "mediano",
  travelType: "cabina",
  travelDate: "",
  destinationCountry: "",
  medicalConditions: "",
  phone: client?.phone || "",
  transportCompany: "",
  observations: "",
  voucher: undefined,
  sendVoucher: false,
  supplierName: "",
  supplierCost: 0,
  ta: 0,
});

export const INITIAL_FORM: WizardFormData = {
  clientId: "",
  clientData: undefined,
  commissionAgentId: "",
  commissionAgentName: "",
  responsableId: "",
  responsableName: "",
  commissionAgentPercentage: "",
  commissionAgentAmount: "",
  commissionAgentRetentionPercentage: "0",
  commissionAgentNetPayment: "0",
  asesorId: "",
  asesorName: "",
  selectedProducts: [],
  observations: "",
  paymentMethod: "",
  payments: [],
  total: "",
  ta: "",
  iva: "",
  supplierCost: "",
  status: "",
  isCredit: false,
  creditDueDate: "",
  tickets: [],
  hotels: [],
  insurances: [],
  plans: [],
  checkIns: [],
  migrations: [],
  simCards: [],
  carRentals: [],
  fincas: [],
  tours: [],
  conventions: [],
  restaurants: [],
  visas: [],
  passports: [],
  petServices: [],
};

/** Lo que reciben los pasos del asistente para cambiar un campo del formulario. */
export type FijarCampo = <K extends keyof WizardFormData>(clave: K, valor: WizardFormData[K]) => void;

/** El cliente de la venta tal como lo ven los formularios de producto (puede faltar mientras se elige). */
export type ClienteDelFormulario = Partial<Client> | null | undefined;
