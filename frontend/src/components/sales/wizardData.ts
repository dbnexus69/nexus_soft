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

import imgTiqueteria from "../../assets/tiqueteria.png";
import imgHoteleria from "../../assets/hoteleria.png";
import imgSeguros from "../../assets/seguros.png";
import imgPlanes from "../../assets/planes.png";

export const PRODUCT_IMAGES: Record<string, string> = {
  tiqueteria: imgTiqueteria,
  hoteleria: imgHoteleria,
  seguros_viaje: imgSeguros,
  planes: imgPlanes,
};

export interface WizardFormData {
  clientId: string;
  commissionAgentId: string;
  commissionAgentName: string;
  commissionAgentAmount: string;
  commissionAgentRetentionPercentage: string;
  commissionAgentNetPayment: string;
  asesorId: string;
  asesorName: string;
  selectedProducts: SaleProductId[];
  observations: string;
  paymentMethod: string;
  total: string;
  ta: string;
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

export const INITIAL_TICKET = (client?: any): TicketData => ({
  airline: "",
  supplier: "",
  reservationNumber: "",
  flightNumber: "",
  departureDate: "",
  arrivalDate: "",
  supplierCost: 0,
  ta: 0,
  supplierPaymentMethod: "Efectivo",
  baggagePlan: "",
  ticketNumber: "",
  seatNumber: "",
  flightMode: "one_way",
  hasStops: false,
  returnHasStops: false,
  outboundStops: [],
  returnStops: [],
  legs: [{ origin: "", destination: "", flightNumber: "", seat: "", date: "" }],
  passengerInfo: {
    name: client?.name || "",
    docType: client?.docType || "",
    docNumber: client?.docNumber || "",
    birthDate: client?.birthDate || "",
  },
});

export const INITIAL_HOTEL = (client?: any): HotelData => ({
  hotelName: "",
  destination: "",
  supplier: "",
  reservationNumber: "",
  startDate: "",
  endDate: "",
  supplierCost: 0,
  ta: 0,
  supplierPaymentMethod: "Efectivo",
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

export const INITIAL_INSURANCE = (client?: any): InsuranceData => ({
  contactName: "",
  contactNumber: "",
  address: "",
  supplier: "",
  supplierCost: 0,
  ta: 0,
  supplierPaymentMethod: "Efectivo",
  members: [
    {
      name: client?.name || "",
      docType: client?.docType || "",
      docNumber: client?.docNumber || "",
    },
  ],
});

export const INITIAL_PLAN = (client?: any): PlanData => ({
  planName: "",
  hotelName: "",
  supplier: "",
  supplierCost: 0,
  ta: 0,
  supplierPaymentMethod: "Efectivo",
  reservationNumber: "",
  flightNumber: "",
  ticketNumber: "",
  adultsCount: 2,
  childrenCount: 0,
  startDate: "",
  endDate: "",
  flightDepartureDate: "",
  flightReturnDate: "",
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
});

export const INITIAL_CHECKIN = (client?: any): CheckInData => ({
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

export const INITIAL_MIGRATION = (client?: any): MigrationData => ({
  passengerName: client?.name || "",
  birthDate: client?.birthDate || "",
  nationality: "",
  passportNumber: "",
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

export const INITIAL_SIMCARD = (client?: any): SimCardData => ({
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

export const INITIAL_CAR_RENTAL = (client?: any): CarRentalData => ({
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

export const INITIAL_FINCA = (client?: any): FincaData => ({
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

export const INITIAL_TOUR = (client?: any): TourData => ({
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
  voucher: undefined,
  sendVoucher: false,
  supplierName: "",
  supplierCost: 0,
  ta: 0,
});

export const INITIAL_CONVENTION = (client?: any): ConventionData => ({
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

export const INITIAL_RESTAURANT = (client?: any): RestaurantData => ({
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

export const INITIAL_VISA = (client?: any): VisaData => ({
  fullName: client?.name || "",
  birthDate: client?.birthDate || "",
  nationality: "",
  passportNumber: "",
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

export const INITIAL_PASSPORT = (client?: any): PassportData => ({
  fullName: client?.name || "",
  idNumber: client?.docNumber || "",
  birthDate: client?.birthDate || "",
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

export const INITIAL_PET_SERVICE = (client?: any): PetServiceData => ({
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
  voucher: undefined,
  sendVoucher: false,
  supplierName: "",
  supplierCost: 0,
  ta: 0,
});

export const INITIAL_FORM: WizardFormData = {
  clientId: "",
  commissionAgentId: "",
  commissionAgentName: "",
  commissionAgentAmount: "",
  commissionAgentRetentionPercentage: "0",
  commissionAgentNetPayment: "0",
  asesorId: "",
  asesorName: "",
  selectedProducts: [],
  observations: "",
  paymentMethod: "",
  total: "",
  ta: "",
  supplierCost: "",
  status: "credito",
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
