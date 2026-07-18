import { useState, useEffect } from "react";
import {
  User,
  Package,
  CreditCard,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  CheckCircle2,
  Trash2,
  ChevronDown,
  Loader2,
  AlertCircle,
  X, Link2,
} from "lucide-react";

import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { useSalesContext } from "../../context/SalesContext";
import {
  Sale,
  SaleProductId,
  SALE_PRODUCTS,
} from "../../types";
import {
  HotelForm,
  InsuranceForm,
  CheckInForm,
  PlanForm,
  MigrationForm,
  SimCardForm,
  CarRentalForm,
  FincaForm,
  TourForm,
  ConventionForm,
  RestaurantForm,
  VisaForm,
  PassportForm,
  PetServiceForm,
  TicketForm,
} from "./forms";
import {
  WizardFormData,
  INITIAL_FORM,
  INITIAL_TICKET,
  INITIAL_HOTEL,
  INITIAL_INSURANCE,
  INITIAL_PLAN,
  INITIAL_CHECKIN,
  INITIAL_MIGRATION,
  INITIAL_SIMCARD,
  INITIAL_CAR_RENTAL,
  INITIAL_FINCA,
  INITIAL_TOUR,
  INITIAL_CONVENTION,
  INITIAL_RESTAURANT,
  INITIAL_VISA,
  INITIAL_PASSPORT,
  INITIAL_PET_SERVICE,
} from "./wizardData";
import { Step1Client } from "./steps/Step1Client";
import { Step2Products } from "./steps/Step2Products";
import { Step3Payment } from "./steps/Step3Payment";
import { ProductFormsModal } from "./wizard";
import { ticketSchema } from "../../validations/sales/ticketSchema";
import { todayStr } from "../../utils/formatters";

interface Props {
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const STEPS = [
  { id: 1, label: "Cliente", icon: User },
  { id: 2, label: "Productos", icon: Package },
  { id: 3, label: "Pago", icon: CreditCard },
] as const;

export default function NewSaleWizard({ onClose, onSuccess }: Props) {
  const { data, addSale, fetchClients, fetchUsers, fetchCommissionAgents, fetchResponsables, fetchConfig } = useData();
  const { fetchSales } = useSalesContext();
  const { user } = useAuth();

  const draftKey = `itea_new_sale_draft_${user?.id || 'unknown'}`;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardFormData>(() => {
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_FORM;
      }
    }
    return {
      ...INITIAL_FORM,
      asesorId: user?.id ? String(user.id) : "",
      asesorName: user?.name || "",
    };
  });
  const [showOtherProducts, setShowOtherProducts] = useState(false);
  const [activeForm, setActiveForm] = useState<SaleProductId | null>(null);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const triggerError = (msg: string) => {
    setErrorMessage(msg);
    setShowError(true);
    setTimeout(() => setShowError(false), 4000);
  };

  // Saber si el formulario de tiqueteríƒÂ­a estíƒÂ¡ completamente vacíƒÂ­o (sin tocar)
  const isTicketFormEmpty = (() => {
    if (activeForm === "tiqueteria" && activeIdx !== null) {
      const ticket = form.tickets[activeIdx];
      if (!ticket) return true;
      
      const hasAirline = !!ticket.airline?.trim();
      const hasSupplier = !!ticket.supplier?.trim();
      const hasResNumber = !!ticket.reservationNumber?.trim();
      const paxList = ticket.passengers || ((ticket as any).passengerInfo ? [(ticket as any).passengerInfo] : []);
      const titular = paxList.find((p: any) => p.esTitular) || paxList[0];
      const hasTicketNumber = titular ? !!titular.nroTiquete?.trim() : false;
      const hasCost = ticket.supplierCost > 0;
      const hasTa = ticket.ta > 0;
      
      // Comprobar si hay tramos con texto
      let hasLegsContent = false;
      if (ticket.legs && ticket.legs.length > 0) {
        hasLegsContent = ticket.legs.some(leg => 
          !!leg.origin?.trim() || !!leg.destination?.trim() || !!leg.flightNumber?.trim() || !!leg.seat?.trim() || !!leg.date?.trim() || !!leg.arrivalDate?.trim()
        );
      }
      
      // Comprobar escalas
      let hasStopsContent = false;
      if (ticket.outboundStops && ticket.outboundStops.length > 0) {
        hasStopsContent = ticket.outboundStops.some(stop =>
          !!stop.origin?.trim() || !!stop.destination?.trim() || !!stop.flightNumber?.trim() || !!stop.seat?.trim() || !!stop.date?.trim() || !!stop.arrivalDate?.trim()
        );
      }
      
      // Comprobar regreso
      let hasReturnContent = false;
      if (ticket.returnLeg) {
        const ret = ticket.returnLeg;
        hasReturnContent = !!ret.origin?.trim() || !!ret.destination?.trim() || !!ret.flightNumber?.trim() || !!ret.seat?.trim() || !!ret.date?.trim() || !!ret.arrivalDate?.trim();
      }
      
      let hasReturnStopsContent = false;
      if (ticket.returnStops && ticket.returnStops.length > 0) {
        hasReturnStopsContent = ticket.returnStops.some(stop =>
          !!stop.origin?.trim() || !!stop.destination?.trim() || !!stop.flightNumber?.trim() || !!stop.seat?.trim() || !!stop.date?.trim() || !!stop.arrivalDate?.trim()
        );
      }

      return !(hasAirline || hasSupplier || hasResNumber || hasTicketNumber || hasCost || hasTa || hasLegsContent || hasStopsContent || hasReturnContent || hasReturnStopsContent);
    }
    return false;
  })();

  const isHotelFormEmpty = (() => {
    if (activeForm === "hoteleria" && activeIdx !== null) {
      const hotel = form.hotels[activeIdx];
      if (!hotel) return true;
      const hasHotelName = !!hotel.hotelName?.trim();
      const hasDestination = !!hotel.destination?.trim();
      const hasSupplier = !!hotel.supplier?.trim();
      const hasReservationNumber = !!hotel.reservationNumber?.trim();
      const hasStartDate = !!hotel.startDate?.trim();
      const hasEndDate = !!hotel.endDate?.trim();
      const hasHotelType = !!hotel.hotelType?.trim();
      const hasObservations = !!hotel.observations?.trim();
      const hasCost = hotel.supplierCost > 0;
      const hasTa = hotel.ta > 0;
      
      // Ignore initial prefilled passenger in guests list for empty check
      const client = data.clients.find((c: any) => c.name === form.clientId);
      const initialGuestName = client?.name || "";
      const initialGuestDoc = client?.docNumber || "";
      
      const hasGuests = hotel.guests && hotel.guests.some(g => {
        if (g.name === initialGuestName && g.docNumber === initialGuestDoc) {
          return false;
        }
        return !!g.name?.trim() || !!g.docNumber?.trim();
      });

      return !(hasHotelName || hasDestination || hasSupplier || hasReservationNumber || hasStartDate || hasEndDate || hasHotelType || hasObservations || hasCost || hasTa || hasGuests);
    }
    return false;
  })();

  const isInsuranceFormEmpty = (() => {
    if (activeForm === "seguros_viaje" && activeIdx !== null) {
      const ins = form.insurances[activeIdx];
      if (!ins) return true;
      const hasInsuranceType = !!ins.insuranceType?.trim();
      const hasPhone = !!ins.phone?.trim();
      const hasSupplier = !!ins.supplier?.trim();
      const hasCost = ins.supplierCost > 0;
      const hasTa = ins.ta > 0;
      
      const client = data.clients.find((c: any) => c.name === form.clientId);
      const initialMemberName = client?.name || "";
      const initialMemberDoc = client?.docNumber || "";
      
      const hasMembers = ins.members && ins.members.some(m => {
        if (m.name === initialMemberName && m.docNumber === initialMemberDoc) {
          return false;
        }
        return !!m.name?.trim() || !!m.docNumber?.trim();
      });

      return !(hasInsuranceType || hasPhone || hasSupplier || hasCost || hasTa || hasMembers);
    }
    return false;
  })();

  const actions = {
    showOtherProducts,
    setShowOtherProducts,
    activeForm,
    activeIdx,
    openForm: (type: SaleProductId, idx: number) => {
      setActiveForm(type);
      setActiveIdx(idx);
    },
  };

  useEffect(() => {
    try {
      // Intentar guardar el draft en localStorage
      localStorage.setItem(draftKey, JSON.stringify(form));
    } catch (error) {
      console.warn("No se pudo guardar el borrador en localStorage (probablemente los archivos adjuntos son muy grandes):", error);
    }
  }, [form]);

  // Fetch data needed for comboboxes to ensure freshness
  useEffect(() => {
    fetchClients();
    fetchUsers();
    fetchCommissionAgents();
    fetchResponsables();
    fetchConfig();
  }, [fetchClients, fetchUsers, fetchCommissionAgents, fetchResponsables, fetchConfig]);

  // Compute Totals Automatically
  useEffect(() => {
    let calcSupplierCost = 0;
    let calcTa = 0;

    form.tickets.forEach(t => { calcSupplierCost += Number(t.supplierCost) || 0; calcTa += Number(t.ta) || 0; });
    form.hotels.forEach(h => { calcSupplierCost += Number(h.supplierCost) || 0; calcTa += Number(h.ta) || 0; });
    form.insurances.forEach(i => { calcSupplierCost += Number(i.supplierCost) || 0; calcTa += Number(i.ta) || 0; });
    form.plans.forEach(p => { calcSupplierCost += Number(p.supplierCost) || 0; calcTa += Number(p.ta) || 0; });
    form.checkIns.forEach(c => { calcSupplierCost += Number(c.supplierCost) || 0; calcTa += Number(c.ta) || 0; });
    form.migrations.forEach(m => { calcSupplierCost += Number(m.supplierCost) || 0; calcTa += Number(m.ta) || 0; });
    form.simCards.forEach(s => { calcSupplierCost += Number(s.supplierCost) || 0; calcTa += Number(s.ta) || 0; });
    form.carRentals.forEach(cr => { calcSupplierCost += Number(cr.supplierCost) || 0; calcTa += Number(cr.ta) || 0; });
    form.fincas.forEach(f => { calcSupplierCost += Number(f.supplierCost) || 0; calcTa += Number(f.ta) || 0; });
    form.tours.forEach(t => { calcSupplierCost += Number(t.supplierCost) || 0; calcTa += Number(t.ta) || 0; });
    form.conventions.forEach(c => { calcSupplierCost += Number(c.supplierCost) || 0; calcTa += Number(c.ta) || 0; });
    form.restaurants.forEach(r => { calcSupplierCost += Number(r.supplierCost) || 0; calcTa += Number(r.ta) || 0; });
    form.visas.forEach(v => { calcSupplierCost += Number(v.supplierCost) || 0; calcTa += Number(v.ta) || 0; });
    form.passports.forEach(p => { calcSupplierCost += Number(p.supplierCost) || 0; calcTa += Number(p.ta) || 0; });
    form.petServices.forEach(ps => { calcSupplierCost += Number(ps.supplierCost) || 0; calcTa += Number(ps.ta) || 0; });

    const calcTotal = calcSupplierCost + calcTa;

    if (
      form.supplierCost !== calcSupplierCost.toString() ||
      form.ta !== calcTa.toString() ||
      form.total !== calcTotal.toString()
    ) {
      setForm(prev => {
        const commPercentage = parseFloat(prev.commissionAgentPercentage || "0");
        const newCommAmount = calcTa * (commPercentage / 100);
        const retention = parseFloat(prev.commissionAgentRetentionPercentage || "0");
        const newCommNet = newCommAmount * (1 - retention / 100);

        return {
          ...prev,
          supplierCost: calcSupplierCost.toString(),
          ta: calcTa.toString(),
          total: calcTotal.toString(),
          commissionAgentAmount: newCommAmount.toString(),
          commissionAgentNetPayment: newCommNet.toString()
        };
      });
    }
  }, [
    form.tickets, form.hotels, form.insurances, form.plans, form.checkIns,
    form.migrations, form.simCards, form.carRentals, form.fincas, form.tours,
    form.conventions, form.restaurants, form.visas, form.passports, form.petServices
  ]);


  const getCurrentItemLinkedPlanIndex = () => {
    if (!activeForm || activeIdx === null || activeForm === 'planes') return '';
    let targetKey = null;
    switch (activeForm) {
      case "tiqueteria": targetKey = "tickets"; break;
      case "hoteleria": targetKey = "hotels"; break;
      case "seguros_viaje": targetKey = "insurances"; break;
      case "checkin": targetKey = "checkIns"; break;
      case "documentacion_migratoria": targetKey = "migrations"; break;
      case "simcard": targetKey = "simCards"; break;
      case "renta_vehiculos": targetKey = "carRentals"; break;
      case "renta_fincas": targetKey = "fincas"; break;
      case "tours": targetKey = "tours"; break;
      case "centros_convencion": targetKey = "conventions"; break;
      case "restaurantes": targetKey = "restaurants"; break;
      case "visa": targetKey = "visas"; break;
      case "pasaporte": targetKey = "passports"; break;
      case "servicio_mascotas": targetKey = "petServices"; break;
    }
    if (targetKey) {
      const items = (form as any)[targetKey];
      if (items[activeIdx] && items[activeIdx].linkedToPlanIndex !== undefined && items[activeIdx].linkedToPlanIndex !== null) {
        return items[activeIdx].linkedToPlanIndex.toString();
      }
    }
    return '';
  };

  const setCurrentItemLinkedPlanIndex = (val: string) => {
    if (!activeForm || activeIdx === null || activeForm === 'planes') return;
    let targetKey = null;
    switch (activeForm) {
      case "tiqueteria": targetKey = "tickets"; break;
      case "hoteleria": targetKey = "hotels"; break;
      case "seguros_viaje": targetKey = "insurances"; break;
      case "checkin": targetKey = "checkIns"; break;
      case "documentacion_migratoria": targetKey = "migrations"; break;
      case "simcard": targetKey = "simCards"; break;
      case "renta_vehiculos": targetKey = "carRentals"; break;
      case "renta_fincas": targetKey = "fincas"; break;
      case "tours": targetKey = "tours"; break;
      case "centros_convencion": targetKey = "conventions"; break;
      case "restaurantes": targetKey = "restaurants"; break;
      case "visa": targetKey = "visas"; break;
      case "pasaporte": targetKey = "passports"; break;
      case "servicio_mascotas": targetKey = "petServices"; break;
    }
    if (targetKey) {
      const items = [...((form as any)[targetKey] || [])];
      if (items[activeIdx]) {
        items[activeIdx] = { ...items[activeIdx], linkedToPlanIndex: val === '' ? null : Number(val) };
        setForm(prev => ({ ...prev, [targetKey as string]: items }));
      }
    }
  };

  /* ---- helpers --------------------------------------------------- */

  const set = <K extends keyof WizardFormData>(
    key: K,
    value: WizardFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    
    // Clear or update validation errors in real time
    if (key === "creditDueDate") {
      const dateStr = value as string;
      if (dateStr) {
        const selectedDate = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        selectedDate.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
          setErrors((prev) => ({ ...prev, creditDueDate: "La fecha de vencimiento no puede ser anterior al díƒÂ­a de hoy" }));
        } else {
          setErrors((prev) => {
            const next = { ...prev };
            delete next.creditDueDate;
            return next;
          });
        }
      } else {
        setErrors((prev) => ({ ...prev, creditDueDate: "La fecha de vencimiento es obligatoria" }));
      }
    } else if (errors[key as string]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
    }
  };

  const toggleProduct = (id: SaleProductId) => {
    setForm((prev) => {
      const isSelecting = !prev.selectedProducts.includes(id);
      const nextProducts = isSelecting
        ? [...prev.selectedProducts, id]
        : prev.selectedProducts.filter((p) => p !== id);
      return { ...prev, selectedProducts: nextProducts };
    });
  };

  /* ---- navigation ------------------------------------------------ */
  const validateStep = (s: number) => {
    const errs: Record<string, string> = {};
    if (s === 1) {
      if (!form.clientId) errs.clientId = "El cliente es obligatorio";
      if (form.commissionAgentName && !form.commissionAgentId) {
        errs.commissionAgent = "El comisionista ingresado no estíƒÂ¡ registrado";
      } else if (form.commissionAgentId) {
        if (data.commissionAgents && data.commissionAgents.length > 0) {
          const agentExists = data.commissionAgents.some(
            (a: any) => String(a.id) === String(form.commissionAgentId)
          );
          if (!agentExists) {
            errs.commissionAgent = "El comisionista seleccionado ya no existe en el sistema";
          }
        }
      }
    }
    if (s === 2) {
      if (form.selectedProducts.length === 0) {
        errs.products = "Debes seleccionar al menos un producto";
      } else if (form.selectedProducts.includes("tiqueteria")) {
        if (!form.tickets || form.tickets.length === 0) {
          errs.products = "Debes configurar al menos un tiquete";
        } else {
          for (let i = 0; i < form.tickets.length; i++) {
            const ticket = form.tickets[i];
            const parsed = ticketSchema.safeParse(ticket);
            
            if (!parsed.success) {
              const errorMessage = parsed.error.issues[0].message;
              triggerError(`El servicio de Tiquetería #${i + 1} tiene campos inválidos: ${errorMessage}`);
              errs.tiqueteriaValidation = "invalid";
              break;
            }
          }
        }
      }

      if (form.selectedProducts.includes("hoteleria")) {
        if (!form.hotels || form.hotels.length === 0) {
          errs.products = "Debes configurar al menos un hotel";
        } else {
          for (let i = 0; i < form.hotels.length; i++) {
            const hotel = form.hotels[i];
            const isStrictlyValid = (() => {
              if (!hotel) return false;
              if (!hotel.hotelName || hotel.hotelName.trim().length < 2 || hotel.hotelName.trim().length > 50) return false;
              if (!hotel.destination || hotel.destination.trim().length === 0) return false;
              if (!hotel.supplier || hotel.supplier.trim().length === 0) return false;
              if (!hotel.reservationNumber || hotel.reservationNumber.trim().length === 0 || hotel.reservationNumber.trim().length > 20) return false;
              if (!hotel.startDate || !hotel.endDate) return false;
              
              // Validar que fechas no sean del pasado
              const now = new Date();
              now.setHours(0, 0, 0, 0);
              if (new Date(hotel.startDate) < now || new Date(hotel.endDate) < now) return false;

              if (hotel.supplierCost <= 0) return false;
              if (hotel.ta < 0) return false;
              if (!hotel.supplierPaymentMethod) return false;
              return true;
            })();

            if (!isStrictlyValid) {
              triggerError(`El servicio de Hotelería #${i + 1} tiene campos requeridos vacíos o inválidos (El nombre de hotel debe tener entre 2 y 50 letras, la reserva máximo 20 caracteres y sin caracteres especiales, las fechas deben ser futuras y los montos obligatorios). Por favor, edítalo.`);
              errs.hoteleriaValidation = "invalid";
              break;
            }
          }
        }
      }

      if (form.selectedProducts.includes("seguros_viaje")) {
        if (!form.insurances || form.insurances.length === 0) {
          errs.products = "Debes configurar al menos un seguro de viaje";
        } else {
          for (let i = 0; i < form.insurances.length; i++) {
            const ins = form.insurances[i];
            const isStrictlyValid = (() => {
              if (!ins) return false;
              
              // Validar tipo de seguro
              if (!ins.insuranceType || ins.insuranceType.trim().length < 3 || ins.insuranceType.trim().length > 40) return false;

              // Validar teléfono del cliente: limpiar a números y medir de 7 a 15
              const cleanedPhone = ins.phone ? ins.phone.replace(/\D/g, "") : "";
              if (cleanedPhone.length < 7 || cleanedPhone.length > 15) return false;

              // Validar financieros: obligatorios y mayores de 0
              if (ins.supplierCost <= 0 || ins.ta < 0) return false;
              if (!ins.supplierPaymentMethod) return false;

              return true;
            })();

            if (!isStrictlyValid) {
              triggerError(`El servicio de Seguro de Viaje #${i + 1} tiene campos requeridos vacíos o inválidos. El tipo de seguro debe tener entre 3 y 40 caracteres, el teléfono entre 7 y 15 díƒÂ­gitos y los costos financieros obligatorios.`);
              errs.segurosValidation = "invalid";
              break;
            }
          }
        }
      }

      if (form.selectedProducts.includes("planes")) {
        if (!form.plans || form.plans.length === 0) {
          errs.products = "Debes configurar al menos un paquete";
        } else {
          for (let i = 0; i < form.plans.length; i++) {
            const plan = form.plans[i];
            const errors: string[] = [];
            if (!plan) errors.push("Plan inválido");
            else {
              // Campo comíƒÂºn a ambos tipos
              if (!plan.planName || plan.planName.trim().length > 50) errors.push("Nombre del Plan (máx 50 chars)");

              if (plan.packageType === 'supplier') {
                // í¢â€â‚¬í¢â€â‚¬ PAQUETE POR PROVEEDOR: solo campos míƒÂ­nimos í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬
                if (!plan.supplier || plan.supplier.trim().length === 0) errors.push("Proveedor (requerido)");

                if (!plan.vouchers || plan.vouchers.length === 0) {
                  if (!plan.voucher) errors.push("Debe adjuntar el voucher del proveedor");
                }

                if (plan.supplierCost === undefined || plan.supplierCost <= 0) errors.push("Costo Proveedor (> $0)");
                if (plan.ta === undefined || plan.ta < 0) errors.push("Valor TA (>= $0)");
                if (!plan.supplierPaymentMethod) errors.push("Método de Pago Proveedor (requerido)");

              } else {
                // í¢â€â‚¬í¢â€â‚¬ PAQUETE POR EMPRESA: validaciíƒÂ³n completa í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬í¢â€â‚¬
                if (!plan.hotelName || plan.hotelName.trim().length < 2 || plan.hotelName.trim().length > 50) errors.push("Nombre del Hotel (2-50 chars)");
                if (!plan.reservationNumber || plan.reservationNumber.trim().length === 0 || plan.reservationNumber.trim().length > 20) errors.push("Número de Reservación (1-20 chars)");
                if (plan.adultsCount === undefined || plan.adultsCount < 0 || plan.adultsCount > 999) errors.push("Adultos (0-999)");
                if (plan.childrenCount === undefined || plan.childrenCount < 0 || plan.childrenCount > 999) errors.push("Menores (0-999)");
                if (!plan.flightNumber || plan.flightNumber.trim().length === 0) {
                  errors.push(plan.transportType === 'Terrestre' ? "Placa / Vehículo (requerido)" : "Número de Vuelo (requerido)");
                } else if (plan.transportType !== 'Terrestre') {
                  if (plan.flightNumber.length > 8) {
                    errors.push("Número de Vuelo (máx 8 caracteres)");
                  } else if (!/^[A-Z0-9]+$/.test(plan.flightNumber)) {
                    errors.push("Número de Vuelo (debe ser alfanumérico en mayúsculas sin espacios ni caracteres especiales)");
                  }
                }
                if (!plan.ticketNumber || plan.ticketNumber.trim().length === 0) {
                  errors.push(plan.transportType === 'Terrestre' ? "Puesto / Asiento (requerido)" : "Número de Tiquete (requerido)");
                } else if (plan.transportType !== 'Terrestre') {
                  if (plan.ticketNumber.length < 13 || plan.ticketNumber.length > 14) {
                    errors.push("Número de Tiquete (mínimo 13 y máximo 14 dígitos)");
                  } else if (!/^\d+$/.test(plan.ticketNumber)) {
                    errors.push("Número de Tiquete (debe ser estrictamente numérico)");
                  }
                }
                if (!plan.confirmationNumber || plan.confirmationNumber.trim().length === 0) {
                  errors.push("Confirmación (requerido)");
                } else if (plan.confirmationNumber.length !== 6) {
                  errors.push("Confirmación (debe tener exactamente 6 caracteres)");
                } else if (!/^[A-Z0-9]+$/.test(plan.confirmationNumber)) {
                  errors.push("Confirmación (debe ser alfanumérico en mayúsculas sin espacios ni caracteres especiales)");
                }
                if (!plan.supplier || plan.supplier.trim().length === 0) errors.push("Proveedor (requerido)");

                if (!plan.flightDepartureDate) errors.push("Fecha Ida (requerido)");
                if (!plan.flightReturnDate) errors.push("Fecha Vuelta (requerido)");
                if (!plan.startDate) errors.push("Ingreso Hotel (requerido)");
                if (!plan.endDate) errors.push("Salida Hotel (requerido)");
                if (!plan.flightDepartureArrivalDate) errors.push("Llegada Ida (requerido)");
                if (!plan.flightReturnArrivalDate) errors.push("Llegada Vuelta (requerido)");

                const now = new Date();
                now.setHours(0, 0, 0, 0);
                if (plan.flightDepartureDate && new Date(plan.flightDepartureDate) < now) errors.push("Fecha Ida no puede ser anterior a la fecha actual");
                if (plan.flightReturnDate && new Date(plan.flightReturnDate) < now) errors.push("Fecha Vuelta no puede ser anterior a la fecha actual");
                if (plan.startDate && new Date(plan.startDate) < now) errors.push("Ingreso Hotel no puede ser anterior a la fecha actual");
                if (plan.endDate && new Date(plan.endDate) < now) errors.push("Salida Hotel no puede ser anterior a la fecha actual");
                if (plan.flightDepartureArrivalDate && new Date(plan.flightDepartureArrivalDate) < now) errors.push("Llegada Ida no puede ser anterior a la fecha actual");
                if (plan.flightReturnArrivalDate && new Date(plan.flightReturnArrivalDate) < now) errors.push("Llegada Vuelta no puede ser anterior a la fecha actual");

                if (plan.flightDepartureDate && plan.flightDepartureArrivalDate && new Date(plan.flightDepartureArrivalDate) < new Date(plan.flightDepartureDate)) {
                  errors.push("Llegada Ida debe ser posterior a la Fecha Ida");
                }
                if (plan.flightReturnDate && plan.flightReturnArrivalDate && new Date(plan.flightReturnArrivalDate) < new Date(plan.flightReturnDate)) {
                  errors.push("Llegada Vuelta debe ser posterior a la Fecha Vuelta");
                }
                if (plan.flightDepartureDate && plan.flightReturnDate && new Date(plan.flightReturnDate) < new Date(plan.flightDepartureDate)) {
                  errors.push("Fecha Vuelta debe ser posterior a la Fecha Ida");
                }
                if (plan.startDate && plan.endDate && new Date(plan.endDate) < new Date(plan.startDate)) {
                  errors.push("Salida Hotel debe ser posterior al Ingreso Hotel");
                }

                if (plan.supplierCost === undefined || plan.supplierCost <= 0) errors.push("Costo Proveedor (> $0)");
                if (plan.ta === undefined || plan.ta < 0) errors.push("Valor TA (>= $0)");
                if (!plan.supplierPaymentMethod) errors.push("Método de Pago Proveedor (requerido)");
              }

              // Integrantes: requeridos en ambos tipos
              if (plan.guests && plan.guests.length > 0) {
                plan.guests.forEach((g, gIdx) => {
                  if (!g.name || g.name.trim().length < 3 || g.name.trim().length > 70) {
                    errors.push(`Integrante #${gIdx + 1}: Nombre Completo (3-70 caracteres)`);
                  } else if (/[^a-zA-Záéíóúíí‰íí“íšñÑ\s]/.test(g.name)) {
                    errors.push(`Integrante #${gIdx + 1}: Nombre Completo solo permite letras y espacios`);
                  }
                  if (!g.docType || g.docType.trim().length === 0) {
                    errors.push(`Integrante #${gIdx + 1}: Tipo de Documento es requerido`);
                  }
                  if (!g.docNumber || g.docNumber.trim().length < 5 || g.docNumber.trim().length > 20) {
                    errors.push(`Integrante #${gIdx + 1}: Número de Documento (5-20 caracteres)`);
                  } else if (/[^a-zA-Z0-9]/.test(g.docNumber)) {
                    errors.push(`Integrante #${gIdx + 1}: Número de Documento debe ser alfanumérico`);
                  }
                });
              } else {
                errors.push("Debes registrar al menos un integrante en el plan");
              }
            }

            if (errors.length > 0) {
              triggerError(`El servicio de Paquetes #${i + 1} tiene errores: ${errors.join(", ")}`);
              errs.planesValidation = "invalid";
              break;
            }
          }
        }
      }

      if (form.selectedProducts.includes("checkin")) {
        if (!form.checkIns || form.checkIns.length === 0) {
          errs.products = "Debes configurar al menos un Check-in";
        } else {
          for (let i = 0; i < form.checkIns.length; i++) {
            const check = form.checkIns[i];
            const errors: string[] = [];
            if (!check) errors.push("Check-in inválido");
            else {
              if (!check.passengerName || check.passengerName.trim().length === 0) errors.push("Nombre del pasajero (requerido)");
              if (!check.docType || check.docType.trim().length === 0) errors.push("Tipo de Doc (requerido)");
              if (!check.docNumber || check.docNumber.trim().length === 0) errors.push("Ní‚Âº de Doc (requerido)");
              if (!check.flightOrReservation || check.flightOrReservation.trim().length < 3 || check.flightOrReservation.trim().length > 8) errors.push("Vuelo o Reserva (3-8 chars)");
              if (!check.travelDate) errors.push("Fecha de viaje (requerido)");
              if (check.seat && check.seat.trim().length > 10) errors.push("Silla Preferida (máx 10 chars)");

              const now = new Date();
              now.setHours(0, 0, 0, 0);
              if (check.travelDate && new Date(check.travelDate) < now) errors.push("Fecha de viaje debe ser futura");
            }

            if (errors.length > 0) {
              triggerError(`El servicio de Check-in #${i + 1} tiene errores: ${errors.join(", ")}`);
              errs.checkinValidation = "invalid";
              break;
            }
          }
        }
      }

      if (form.selectedProducts.includes("documentacion_migratoria")) {
        if (!form.migrations || form.migrations.length === 0) {
          errs.products = "Debes configurar al menos una Documentación Migratoria";
        } else {
          for (let i = 0; i < form.migrations.length; i++) {
            const mig = form.migrations[i];
            const errors: string[] = [];
            if (!mig) errors.push("Documento inválido");
            else {
              if (!mig.passengerName || mig.passengerName.trim().length === 0) errors.push("Nombre del pasajero (requerido)");
              if (!mig.birthDate) errors.push("Fecha de Nacimiento (requerida)");
              if (!mig.nationality || mig.nationality.trim().length === 0 || mig.nationality.length > 30) errors.push("Nacionalidad (1-30 chars)");
              if (!mig.docType) errors.push("Tipo de Documento (requerido)");
              if (!mig.docNumber || mig.docNumber.trim().length < 5 || mig.docNumber.length > 20) errors.push("Número de Documento (5-20 chars)");
              if (mig.docType === "Pasaporte" && !mig.passportExpiry) errors.push("Vencimiento de Documento (requerido)");
              if (!mig.destinationCountry || mig.destinationCountry.trim().length === 0) errors.push("País de Destino (requerido)");
              if (!mig.requestedDocType || mig.requestedDocType.trim().length === 0) errors.push("Trámite (requerido)");
              
              if (mig.email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(mig.email)) errors.push("Correo electríƒÂ³nico inválido");
                if (!mig.email.endsWith(".com")) errors.push("Correo debe terminar en .com");
              }

              const now = new Date();
              now.setHours(0, 0, 0, 0);
              
              if (mig.birthDate && new Date(mig.birthDate) > now) errors.push("Fecha de Nacimiento no puede ser futura");
              if (mig.passportExpiry && new Date(mig.passportExpiry) < now) errors.push("Vencimiento de Documento no puede ser pasado");
            }

            if (errors.length > 0) {
              triggerError(`El servicio de Documentación Migratoria #${i + 1} tiene errores: ${errors.join(", ")}`);
              errs.migrationValidation = "invalid";
              break;
            }
          }
        }
      }

      if (form.selectedProducts.includes("simcard")) {
        if (!form.simCards || form.simCards.length === 0) {
          errs.products = "Debes configurar al menos una SIM Card";
        } else {
          for (let i = 0; i < form.simCards.length; i++) {
            const sim = form.simCards[i];
            const errors: string[] = [];
            if (!sim) errors.push("SIM Card inválida");
            else {
              if (!sim.passengerName || sim.passengerName.trim().length === 0) errors.push("Nombre del Titular (requerido)");
              if (!sim.destinationCountry || sim.destinationCountry.trim().length === 0) errors.push("País de Destino (requerido)");
              if (!sim.arrivalDate) errors.push("Fecha de Llegada (requerida)");
              if (!sim.tripDuration || isNaN(Number(sim.tripDuration)) || Number(sim.tripDuration) <= 0) errors.push("Duración del Viaje (mayor a 0)");
              
              if (sim.email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(sim.email)) errors.push("Correo electríƒÂ³nico inválido");
                if (!sim.email.endsWith(".com")) errors.push("Correo debe terminar en .com");
              }

              const now = new Date();
              now.setHours(0, 0, 0, 0);
              
              if (sim.arrivalDate && new Date(sim.arrivalDate) < now) errors.push("Fecha de Llegada no puede ser pasada");
            }

            if (errors.length > 0) {
              triggerError(`El servicio de SIM Card #${i + 1} tiene errores: ${errors.join(", ")}`);
              errs.simCardValidation = "invalid";
              break;
            }
          }
        }
      }

      if (form.selectedProducts.includes("renta_vehiculos")) {
        if (!form.carRentals || form.carRentals.length === 0) {
          errs.products = "Debes configurar al menos una Renta de VehíƒÂ­culo";
        } else {
          for (let i = 0; i < form.carRentals.length; i++) {
            const car = form.carRentals[i];
            const errors: string[] = [];
            if (!car) errors.push("Renta de VehíƒÂ­culo inválida");
            else {
              if (!car.mainDriver || car.mainDriver.trim().length === 0) errors.push("Conductor Principal (requerido)");
              if (!car.pickupDate) errors.push("Recogida (requerida)");
              if (!car.returnDate) errors.push("Devolución (requerida)");
              
              const cleanLicense = car.licenseNumber ? car.licenseNumber.replace(/[\-\s]/g, "") : "";
              if (cleanLicense.length < 5 || cleanLicense.length > 18) {
                errors.push("Número de Licencia (5-18 caracteres)");
              }
              
              if (car.additionalDrivers === undefined || car.additionalDrivers < 0 || car.additionalDrivers > 10) {
                errors.push("Conductores Adicionales (0-10)");
              }

              if (!car.guaranteeCreditCard || car.guaranteeCreditCard.trim().length !== 4) {
                errors.push("Tarjeta de GarantíƒÂ­a (exactamente 4 díƒÂ­gitos)");
              }

              const now = new Date();
              now.setHours(0, 0, 0, 0);
              
              if (car.pickupDate && new Date(car.pickupDate) < now) errors.push("Recogida no puede ser pasada");
              if (car.returnDate && new Date(car.returnDate) < now) errors.push("Devolución no puede ser pasada");
              if (car.pickupDate && car.returnDate && new Date(car.returnDate) < new Date(car.pickupDate)) errors.push("Devolución debe ser posterior a la Recogida");
            }

            if (errors.length > 0) {
              triggerError(`El servicio de Renta de VehíƒÂ­culo #${i + 1} tiene errores: ${errors.join(", ")}`);
              errs.carRentalValidation = "invalid";
              break;
            }
          }
        }
      }

      if (form.selectedProducts.includes("renta_fincas")) {
        if (!form.fincas || form.fincas.length === 0) {
          errs.products = "Debes configurar al menos una Renta de Finca";
        } else {
          for (let i = 0; i < form.fincas.length; i++) {
            const finca = form.fincas[i];
            const errors: string[] = [];
            if (!finca) errors.push("Renta de Finca inválida");
            else {
              if (!finca.fincaName || finca.fincaName.trim().length < 3 || finca.fincaName.trim().length > 30) errors.push("Nombre de la Finca (3-30 caracteres)");
              if (!finca.fincaCity || finca.fincaCity.trim().length < 3 || finca.fincaCity.trim().length > 50) errors.push("Ciudad o Pueblo (3-50 caracteres)");
              if (!finca.fincaAddress || finca.fincaAddress.trim().length < 5 || finca.fincaAddress.trim().length > 30) errors.push("Dirección de la Finca (5-30 caracteres)");
              if (!finca.responsibleName || finca.responsibleName.trim().length === 0) errors.push("Responsable (requerido)");
              if (!finca.checkInDate) errors.push("Check-in (requerido)");
              if (!finca.checkOutDate) errors.push("Check-out (requerido)");
              
              if (finca.adultsCount === undefined || isNaN(Number(finca.adultsCount)) || Number(finca.adultsCount) < 0 || Number(finca.adultsCount) > 999) errors.push("Número de Adultos (0-999)");
              if (finca.childrenCount === undefined || isNaN(Number(finca.childrenCount)) || Number(finca.childrenCount) < 0 || Number(finca.childrenCount) > 999) errors.push("Número de NiíƒÂ±os (0-999)");

              const now = new Date();
              now.setHours(0, 0, 0, 0);
              
              if (finca.checkInDate && new Date(finca.checkInDate) < now) errors.push("Check-in no puede ser pasado");
              if (finca.checkOutDate && new Date(finca.checkOutDate) < now) errors.push("Check-out no puede ser pasado");
              if (finca.checkInDate && finca.checkOutDate && new Date(finca.checkOutDate) < new Date(finca.checkInDate)) errors.push("Check-out debe ser posterior al Check-in");
              if (!finca.supplierPaymentMethod) errors.push("Método de Pago Proveedor (requerido)");
            }

            if (errors.length > 0) {
              triggerError(`El servicio de Renta de Finca #${i + 1} tiene errores: ${errors.join(", ")}`);
              errs.fincaValidation = "invalid";
              break;
            }
          }
        }
      }

      if (form.selectedProducts.includes("tours")) {
        if (!form.tours || form.tours.length === 0) {
          errs.products = "Debes configurar al menos un Tour";
        } else {
          for (let i = 0; i < form.tours.length; i++) {
            const tour = form.tours[i];
            const errors: string[] = [];
            if (!tour) errors.push("Tour inválido");
            else {
              if (!tour.passengerName || tour.passengerName.trim().length === 0) errors.push("Nombre del Pasajero (requerido)");
              if (!tour.pickupPoint || tour.pickupPoint.trim().length === 0 || tour.pickupPoint.length > 30) errors.push("Punto de Recogida (1-30 caracteres)");
              
              if (tour.adultsCount === undefined || isNaN(Number(tour.adultsCount)) || Number(tour.adultsCount) < 0 || Number(tour.adultsCount) > 999) errors.push("Número de Adultos (0-999)");
              if (tour.childrenCount === undefined || isNaN(Number(tour.childrenCount)) || Number(tour.childrenCount) < 0 || Number(tour.childrenCount) > 999) errors.push("Número de NiíƒÂ±os (0-999)");

              if (!tour.supplierPaymentMethod) errors.push("Método de Pago Proveedor (requerido)");
            }

            if (errors.length > 0) {
              triggerError(`El servicio de Tour #${i + 1} tiene errores: ${errors.join(", ")}`);
              errs.tourValidation = "invalid";
              break;
            }
          }
        }
      }

      if (form.selectedProducts.includes("centros_convencion")) {
        if (!form.conventions || form.conventions.length === 0) {
          errs.products = "Debes configurar al menos un Centro de ConvenciíƒÂ³n";
        } else {
          for (let i = 0; i < form.conventions.length; i++) {
            const conv = form.conventions[i];
            const errors: string[] = [];
            if (!conv) errors.push("ConvenciíƒÂ³n inválida");
            else {
              if (!conv.placeName || conv.placeName.trim().length < 3 || conv.placeName.trim().length > 40) errors.push("Nombre del Lugar (3-40 caracteres)");
              if (!conv.city || conv.city.trim().length < 3 || conv.city.trim().length > 40) errors.push("Ciudad (3-40 caracteres)");
              if (!conv.address || conv.address.trim().length < 5 || conv.address.trim().length > 40) errors.push("Dirección (5-40 caracteres)");
              if (!conv.requiredSpace || conv.requiredSpace.trim().length < 3 || conv.requiredSpace.trim().length > 40) errors.push("Espacio Requerido (3-40 caracteres)");
              if (!conv.eventType || conv.eventType.trim().length < 3 || conv.eventType.trim().length > 40) errors.push("Tipo de Evento (3-40 caracteres)");
              if (!conv.organization || conv.organization.trim().length === 0) errors.push("Organización (requerido)");
              if (!conv.contactName || conv.contactName.trim().length === 0) errors.push("Nombre de Contacto (requerido)");
              if (!conv.startDate) errors.push("Fecha Inicio (requerida)");
              if (!conv.endDate) errors.push("Fecha Fin (requerida)");
              
              if (conv.estimatedAttendance === undefined || isNaN(Number(conv.estimatedAttendance)) || Number(conv.estimatedAttendance) < 0 || Number(conv.estimatedAttendance) > 999) errors.push("Asistencia Estimada (0-999)");

              if (conv.email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(conv.email)) errors.push("Correo electríƒÂ³nico inválido");
                if (!conv.email.endsWith(".com")) errors.push("Correo debe terminar en .com");
              }

              const now = new Date();
              now.setHours(0, 0, 0, 0);
              
              if (conv.startDate && new Date(conv.startDate) < now) errors.push("Fecha Inicio no puede ser pasada");
              if (conv.endDate && new Date(conv.endDate) < now) errors.push("Fecha Fin no puede ser pasada");
              if (conv.startDate && conv.endDate && new Date(conv.endDate) < new Date(conv.startDate)) errors.push("Fecha Fin debe ser posterior a la de Inicio");
              if (!conv.supplierPaymentMethod) errors.push("Método de Pago Proveedor (requerido)");
            }

            if (errors.length > 0) {
              triggerError(`El servicio de Centro de Convenciones #${i + 1} tiene errores: ${errors.join(", ")}`);
              errs.conventionValidation = "invalid";
              break;
            }
          }
        }
      }

      if (form.selectedProducts.includes("restaurantes")) {
        if (!form.restaurants || form.restaurants.length === 0) {
          errs.products = "Debes configurar al menos un Restaurante";
        } else {
          for (let i = 0; i < form.restaurants.length; i++) {
            const rest = form.restaurants[i];
            const errors: string[] = [];
            if (!rest) errors.push("Restaurante inválido");
            else {
              if (!rest.reservationName || rest.reservationName.trim().length === 0) errors.push("Nombre de Reserva (requerido)");
              if (!rest.dateTime) errors.push("Fecha y Hora (requerida)");
              if (!rest.phone || rest.phone.trim().length === 0) errors.push("Celular (requerido)");
              
              if (rest.peopleCount === undefined || isNaN(Number(rest.peopleCount)) || Number(rest.peopleCount) < 1 || Number(rest.peopleCount) > 999) errors.push("Ní‚Âº de Personas (1-999)");

              if (rest.tablePreference && (rest.tablePreference.trim().length < 3 || rest.tablePreference.length > 30)) {
                errors.push("Preferencia de Mesa (3-30 caracteres)");
              }
              if (rest.menuType && (rest.menuType.trim().length < 3 || rest.menuType.length > 30)) {
                errors.push("Tipo de MeníƒÂº (3-30 caracteres)");
              }

              const now = new Date();
              now.setHours(0, 0, 0, 0);
              
              if (rest.dateTime && new Date(rest.dateTime) < now) errors.push("Fecha y Hora no puede ser pasada");

              if (rest.ta === undefined || rest.ta <= 0) {
                errors.push("Tarifa Admin (TA) obligatoria (> $0)");
              }
            }

            if (errors.length > 0) {
              triggerError(`El servicio de Restaurante #${i + 1} tiene errores: ${errors.join(", ")}`);
              errs.restaurantValidation = "invalid";
              break;
            }
          }
        }
      }

      if (form.selectedProducts.includes("visa")) {
        if (!form.visas || form.visas.length === 0) {
          errs.products = "Debes configurar al menos una Visa";
        } else {
          for (let i = 0; i < form.visas.length; i++) {
            const visa = form.visas[i];
            const errors: string[] = [];
            if (!visa) errors.push("Visa inválida");
            else {
              if (!visa.fullName || visa.fullName.trim().length === 0) errors.push("Nombre Completo (requerido)");
              
              if (!visa.birthDate) {
                errors.push("Fecha de Nacimiento (requerida)");
              } else {
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                if (new Date(visa.birthDate) > now) {
                  errors.push("Fecha de Nacimiento no puede ser futura");
                }
              }

              if (!visa.nationality || visa.nationality.trim().length < 3 || visa.nationality.trim().length > 30) {
                errors.push("Nacionalidad (3-30 caracteres)");
              } else if (/[^a-zA-Záéíóúíí‰íí“íšñÑ\s]/.test(visa.nationality)) {
                errors.push("Nacionalidad solo permite letras");
              }

              if (!visa.docType) errors.push("Tipo de Documento (requerido)");

              if (!visa.docNumber || visa.docNumber.trim().length < 5 || visa.docNumber.length > 20) {
                errors.push("Número de Documento (5-20 chars)");
              } else if (/[^a-zA-Z0-9]/.test(visa.docNumber)) {
                errors.push("Número de Documento debe ser alfanumérico");
              }

              if (visa.docType === "Pasaporte" && !visa.passportExpiration) {
                errors.push("Vencimiento de Documento (requerido)");
              } else if (visa.passportExpiration) {
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                if (new Date(visa.passportExpiration) < now) {
                  errors.push("Vencimiento de Documento no puede ser pasado");
                }
              }

              if (!visa.countryApplying || visa.countryApplying.trim().length < 3 || visa.countryApplying.trim().length > 30) {
                errors.push("País al que aplica (3-30 caracteres)");
              } else if (/[^a-zA-Záéíóúíí‰íí“íšñÑ\s]/.test(visa.countryApplying)) {
                errors.push("País al que aplica solo permite letras");
              }

              if (visa.email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(visa.email)) errors.push("Correo electríƒÂ³nico inválido");
                if (!visa.email.endsWith(".com")) errors.push("Correo debe terminar en .com");
              }

              if (visa.estimatedTravelDate) {
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                if (new Date(visa.estimatedTravelDate) < now) {
                  errors.push("Fecha Estimada de Viaje no puede ser pasada");
                }
              }
            }

            if (errors.length > 0) {
              triggerError(`El servicio de Visa #${i + 1} tiene errores: ${errors.join(", ")}`);
              errs.visaValidation = "invalid";
              break;
            }
          }
        }
      }

      if (form.selectedProducts.includes("pasaporte")) {
        if (!form.passports || form.passports.length === 0) {
          errs.products = "Debes configurar al menos un Pasaporte";
        } else {
          for (let i = 0; i < form.passports.length; i++) {
            const passport = form.passports[i];
            const errors: string[] = [];
            if (!passport) errors.push("Pasaporte inválido");
            else {
              if (!passport.fullName || passport.fullName.trim().length === 0) errors.push("Nombre Completo (requerido)");
              if (!passport.idNumber || passport.idNumber.trim().length === 0) errors.push("Número de Identificación (requerido)");
              
              if (!passport.birthDate) {
                errors.push("Fecha de Nacimiento (requerida)");
              } else {
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                if (new Date(passport.birthDate) > now) {
                  errors.push("Fecha de Nacimiento no puede ser futura");
                }
              }

              if (!passport.residenceCity || passport.residenceCity.trim().length === 0) {
                errors.push("Ciudad de Residencia (requerida)");
              } else {
                if (passport.residenceCity.length > 85) {
                  errors.push("Ciudad de Residencia (máximo 85 caracteres)");
                }
                if (/[^a-zA-Záéíóúíí‰íí“íšñÑ\s]/.test(passport.residenceCity)) {
                  errors.push("Ciudad de Residencia no debe tener números ni caracteres especiales");
                }
              }

              if (passport.estimatedTravelDate) {
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                if (new Date(passport.estimatedTravelDate) < now) {
                  errors.push("Fecha Estimada de Viaje no puede ser pasada");
                }
              }

              if (!passport.phone || passport.phone.trim().length === 0) {
                errors.push("TelíƒÂ©fono de Contacto (requerido)");
              } else {
                if (passport.phone.length > 15) {
                  errors.push("TelíƒÂ©fono de Contacto (máximo 15 caracteres)");
                }
                if (/[a-zA-Z]/.test(passport.phone)) {
                  errors.push("TelíƒÂ©fono de Contacto no puede contener letras");
                }
              }
            }

            if (errors.length > 0) {
              triggerError(`El tríƒÂ¡mite de Pasaporte #${i + 1} tiene errores: ${errors.join(", ")}`);
              errs.passportValidation = "invalid";
              break;
            }
          }
        }
      }

      if (form.selectedProducts.includes("servicio_mascotas")) {
        if (!form.petServices || form.petServices.length === 0) {
          errs.products = "Debes configurar al menos un Transporte de Mascotas";
        } else {
          for (let i = 0; i < form.petServices.length; i++) {
            const pet = form.petServices[i];
            const errors: string[] = [];
            if (!pet) errors.push("Transporte de Mascotas inválido");
            else {
              if (!pet.ownerName || pet.ownerName.trim().length === 0) {
                errors.push("Nombre del DueíƒÂ±o (requerido)");
              } else if (/[^a-zA-Záéíóúíí‰íí“íšñÑ\s]/.test(pet.ownerName)) {
                errors.push("Nombre del DueíƒÂ±o solo permite letras");
              }

              if (!pet.petName || pet.petName.trim().length === 0) {
                errors.push("Nombre de la Mascota (requerido)");
              } else if (/[^a-zA-ZíƒÂ¡íƒÂ©íƒÂ­íƒÂ³íƒÂºíƒÂíƒâ€°íƒÂíƒâ€œíƒÅ¡íƒÂ±íƒâ€˜\s]/.test(pet.petName)) {
                errors.push("Nombre de la Mascota solo permite letras");
              }

              if (!pet.breed || pet.breed.trim().length === 0) {
                errors.push("Raza (requerida)");
              } else if (/[^a-zA-ZíƒÂ¡íƒÂ©íƒÂ­íƒÂ³íƒÂºíƒÂíƒâ€°íƒÂíƒâ€œíƒÅ¡íƒÂ±íƒâ€˜\s]/.test(pet.breed)) {
                errors.push("Raza solo permite letras");
              }

              if (pet.weight === undefined || isNaN(pet.weight) || pet.weight < 0 || pet.weight > 999.9) {
                errors.push("Peso debe ser entre 0 y 999.9 kg");
              }
              if (pet.transportCompany && (pet.transportCompany.length < 3 || pet.transportCompany.length > 40)) {
                errors.push("Nombre de Empresa (3-40 caracteres)");
              }

              if (!pet.travelDate) {
                errors.push("Fecha de Viaje (requerida)");
              } else {
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                if (new Date(pet.travelDate) < now) {
                  errors.push("Fecha de Viaje no puede ser pasada");
                }
              }

              if (!pet.destinationCountry || pet.destinationCountry.trim().length < 3 || pet.destinationCountry.trim().length > 30) {
                errors.push("País Destino (3-30 caracteres)");
              } else if (/[^a-zA-ZíƒÂ¡íƒÂ©íƒÂ­íƒÂ³íƒÂºíƒÂíƒâ€°íƒÂíƒâ€œíƒÅ¡íƒÂ±íƒâ€˜\s]/.test(pet.destinationCountry)) {
                errors.push("País Destino solo permite letras");
              }

              if (!pet.phone || pet.phone.trim().length === 0) {
                errors.push("TelíƒÂ©fono (requerido)");
              } else {
                if (pet.phone.length > 15) {
                  errors.push("TelíƒÂ©fono (máximo 15 caracteres)");
                }
                if (/[a-zA-Z]/.test(pet.phone)) {
                  errors.push("TelíƒÂ©fono no puede contener letras");
                }
              }
              if (!pet.supplierPaymentMethod) errors.push("Método de Pago Proveedor (requerido)");
            }

            if (errors.length > 0) {
              triggerError(`El Transporte de Mascota #${i + 1} tiene errores: ${errors.join(", ")}`);
              errs.petValidation = "invalid";
              break;
            }
          }
        }
      }

    }
    if (s === 3) {
      if (!form.total || Number(form.total) <= 0) errs.total = "El valor total debe ser mayor a $0";
      
      const hasPayments = form.payments && form.payments.length > 0;
      if (form.status !== "credito" && !form.paymentMethod && !hasPayments) {
        errs.paymentMethod = "La forma de pago es obligatoria";
      }
      
      if (!form.status) {
        errs.status = "El estado de la venta es obligatorio";
      }
      
      const isCreditState = form.status === "credito" || form.status === "abonado";
      if (isCreditState) {
        if (!form.creditDueDate) {
          errs.creditDueDate = "La fecha de vencimiento es obligatoria";
        } else {
          const selectedDate = new Date(form.creditDueDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          selectedDate.setHours(0, 0, 0, 0);
          if (selectedDate < today) {
            errs.creditDueDate = "La fecha de vencimiento no puede ser anterior al díƒÂ­a de hoy";
          }
        }
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goNext = () => {
    if (validateStep(step)) setStep(step + 1);
  };
  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };



  const handleSubmit = async () => {
    if (!validateStep(1)) {
      setStep(1);
      return;
    }
    if (!validateStep(2)) {
      setStep(2);
      return;
    }
    if (!validateStep(3)) {
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    const client = data.clients.find((c: any) => c.name === form.clientId);
    if (!client) {
      setErrors({ ...errors, clientId: "El cliente no es víƒÂ¡lido" });
      setStep(1);
      return;
    }

    const fullObservations = form.observations.trim();

    const mappedTickets = form.tickets.map(t => {
      return {
        ...t,
        seatNumber: t.legs && t.legs.length > 0 ? t.legs[0].seat : ""
      };
    });

    const calculatedPaymentMethod = form.payments && form.payments.length > 0
      ? (form.payments.length === 1 ? form.payments[0].methodName : "Mixto")
      : form.paymentMethod;

    let finalStatus = form.status;
    if (form.status === "credito" && form.payments && form.payments.length > 0) {
      finalStatus = "abonado";
    }

    const mappedInsurances = form.insurances.map(ins => ({
      ...ins,
      phone: ins.phone ? ins.phone.replace(/\D/g, "") : ""
    }));

    const saleData: any = {
      clientId: client.id,
      clientName: client.name,
      asesorId: Number(form.asesorId) || user!.id,
      asesorName: form.asesorName || user!.name,
      date: todayStr(),
      total: Number(form.total),
      paymentMethod: calculatedPaymentMethod,
      payments: form.payments?.map(p => ({
        amount: Number(p.amount),
        method: p.methodId,
        reference: p.reference
      })),
      status: finalStatus as Sale["status"],
      responsableId: form.responsableId ? Number(form.responsableId) : undefined,
      observations: fullObservations,
      products: form.selectedProducts,
      ticketData: mappedTickets.length > 0 ? mappedTickets : undefined,
      hotelData: form.hotels.length > 0 ? form.hotels : undefined,
      insuranceData: mappedInsurances.length > 0 ? mappedInsurances : undefined,
      planData: form.plans.length > 0 ? form.plans : undefined,
      checkInData: form.checkIns.length > 0 ? form.checkIns : undefined,
      migrationData: form.migrations.length > 0 ? form.migrations : undefined,
      simCardData: form.simCards.length > 0 ? form.simCards : undefined,
      carRentalData: form.carRentals.length > 0 ? form.carRentals : undefined,
      fincaData: form.fincas.length > 0 ? form.fincas : undefined,
      tourData: form.tours.length > 0 ? form.tours : undefined,
      conventionData: form.conventions.length > 0 ? form.conventions : undefined,
      restaurantData: form.restaurants.length > 0 ? form.restaurants : undefined,
      visaData: form.visas.length > 0 ? form.visas : undefined,
      passportData: form.passports.length > 0 ? form.passports : undefined,
      petServiceData: form.petServices.length > 0 ? form.petServices : undefined,
      isCredit: form.isCredit,
      creditDueDate: form.isCredit ? form.creditDueDate : undefined,
      commissionAgentId: Number(form.commissionAgentId) || undefined,
      commissionAgentName: form.commissionAgentName || undefined,
      commissionAgentAmount: Number(form.commissionAgentAmount) || undefined,
      commissionAgentRetentionPercentage: Number(form.commissionAgentRetentionPercentage) || undefined,
      commissionAgentNetPayment: Number(form.commissionAgentNetPayment) || undefined,
      isSettled: !!form.commissionAgentId ? false : undefined,
      ta: Number(form.ta) || 0,
      supplierCost: Number(form.supplierCost) || 0,
    };

    try {
      await addSale(saleData as any);
      await fetchSales();
      localStorage.removeItem(draftKey);

      const hasVouchersToSend = [
        ...form.plans, ...form.checkIns, ...form.migrations, ...form.simCards, ...form.carRentals,
        ...form.fincas, ...form.tours, ...form.conventions, ...form.restaurants,
        ...form.visas, ...form.passports, ...form.petServices
      ].some(item => item.sendVoucher);

      if (hasVouchersToSend) {
        onSuccess("Venta registrada y vouchers enviados al cliente");
      } else {
        onSuccess("Venta registrada exitosamente");
      }
      onClose();
    } catch (err: any) {
      console.error("Error al registrar venta:", err);
      const errMsg = err?.response?.data?.error?.message || "Ocurrió un error interno en el servidor al registrar la venta.";
      alert(`Error al registrar venta: ${errMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    localStorage.removeItem(draftKey);
    onClose();
  };

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ minHeight: 0 }}>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â• LEFT SIDEBAR â€“ STEP NAVIGATOR â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div
        className="hidden sm:flex flex-col flex-shrink-0 w-64 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #1e2035 0%, #2B2D42 60%, #3a2f50 100%)" }}
      >
        {/* Decorative orbs */}
        <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #8D99AE 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 -right-10 w-48 h-48 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #8D99AE 0%, transparent 70%)" }} />

        {/* Brand header */}
        <div className="px-6 pt-8 pb-6 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
              style={{ background: "linear-gradient(135deg, #8D99AE, #6b7a94)" }}>
              DB
            </div>
            <div>
              <p className="text-white font-bold text-sm tracking-wider">DB NEXUS</p>
              <p className="text-white/40 text-[10px] tracking-widest uppercase">Nueva Venta</p>
            </div>
          </div>
        </div>

        {/* Step list */}
        <div className="flex-1 px-5 py-8 space-y-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isCompleted = step > s.id;
            const isActive    = step === s.id;
            return (
              <div key={s.id} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="absolute left-5 top-10 bottom-0 w-px"
                    style={{ background: isCompleted ? "rgba(141,153,174,0.6)" : "rgba(255,255,255,0.08)" }} />
                )}
                <div className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 ${
                  isActive ? "bg-white/10 shadow-lg" : "hover:bg-white/5"
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 border ${
                    isCompleted
                      ? "border-emerald-400 bg-emerald-400/20 text-emerald-400"
                      : isActive
                        ? "border-slate-300 bg-slate-300/20 text-slate-200 shadow-md"
                        : "border-white/15 bg-transparent text-white/30"
                  }`}>
                    {isCompleted ? <CheckCircle2 size={15} /> : <Icon size={15} />}
                  </div>
                  <div>
                    <p className={`text-xs font-semibold tracking-wide transition-colors ${
                      isActive ? "text-white" : isCompleted ? "text-emerald-400" : "text-white/35"
                    }`}>{s.label}</p>
                    <p className={`text-[10px] mt-0.5 ${
                      isActive ? "text-white/50" : "text-white/20"
                    }`}>
                      {s.id === 1 ? "Datos del cliente" : s.id === 2 ? "Selección de productos" : "Método de pago"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="px-5 pb-6 border-t border-white/10 pt-4 flex-shrink-0">
          <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2">Progreso</p>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${((step - 1) / (STEPS.length - 1)) * 100}%`,
                background: "linear-gradient(90deg, #8D99AE, #a8b4c4)"
              }}
            />
          </div>
          <p className="text-white/40 text-[10px] mt-1.5">Paso {step} de {STEPS.length}</p>
        </div>
      </div>

      {/* ══════════════ RIGHT CONTENT AREA ══════════════ */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--color-bg-base)]" style={{ position: "relative" }}>

        {activeForm ? (
          <ProductFormsModal
            activeForm={activeForm}
            activeIdx={activeIdx}
            form={form}
            data={data}
            set={set}
            onCloseForm={() => { setActiveForm(null); setActiveIdx(null); }}
            triggerError={triggerError}
          />
        ) : (
          <>
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 sm:px-8 py-4 bg-white border-b border-gray-100 flex-shrink-0 shadow-sm">
              <div className="sm:hidden flex items-center gap-1.5">
                {STEPS.map((s) => (
                  <div key={s.id} className={`h-1.5 rounded-full transition-all duration-300 ${
                    step >= s.id ? "w-6 bg-primary" : "w-3 bg-gray-200"
                  }`} />
                ))}
              </div>
              <div className="hidden sm:block">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
                  Paso {step} - {STEPS[step - 1].label}
                </p>
                <h2 className="text-base font-bold text-primary mt-0.5">
                  {step === 1 ? "Información del Cliente" : step === 2 ? "Configura tus Productos" : "Resumen y Pago"}
                </h2>
              </div>
              <button
                onClick={handleCancel}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Toast Error */}
            {showError && (
              <div className="absolute top-20 right-6 z-[200] max-w-sm bg-white border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl shadow-2xl flex items-start gap-3 animate-slide-in-right">
                <div className="bg-rose-500 text-white rounded-full p-1 flex-shrink-0 mt-0.5">
                  <AlertCircle size={15} />
                </div>
                <div>
                  <p className="font-bold text-sm">Error de Validación</p>
                  <p className="text-xs text-rose-600 mt-0.5 leading-relaxed">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6">
              <div className="animate-fade-in">
                {step === 1 && <Step1Client form={form} set={set} data={data} errors={errors} />}
                {step === 2 && <Step2Products form={form} set={set} data={data} errors={errors} toggleProduct={toggleProduct} actions={actions} />}
                {step === 3 && <Step3Payment form={form} set={set} data={data} errors={errors} />}
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 bg-white border-t border-gray-100 px-5 sm:px-8 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
              <div className="flex justify-between items-center gap-3">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={step === 1}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                  Anterior
                </button>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2.5 rounded-xl text-gray-500 text-sm font-medium hover:bg-gray-100 transition-all"
                  >
                    Cancelar
                  </button>
                  {step < 3 ? (
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={step === 2 && form.selectedProducts.length === 0}
                      className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-100 transition-all"
                      style={{ background: "linear-gradient(135deg, #2B2D42, #3d4060)" }}
                    >
                      Siguiente
                      <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="px-7 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-2 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-100 disabled:cursor-not-allowed transition-all"
                      style={{
                        background: isSubmitting
                          ? "linear-gradient(135deg, #5eb87b, #4caf68)"
                          : "linear-gradient(135deg, #27ae60, #1e8449)"
                      }}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creando venta...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={16} />
                          Finalizar Venta
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


function isItemEmpty(item: any, category: SaleProductId): boolean {
  if (!item) return true;
  
  if (Number(item.supplierCost) > 0 || Number(item.ta) > 0) return false;
  if (item.supplierName && item.supplierName.trim() !== "") return false;

  switch (category) {
    case "tiqueteria":
      return (
        !item.airline &&
        !item.reservationNumber &&
        !item.flightNumber &&
        (!item.passengers || item.passengers.length === 0 || !item.passengers[0]?.nroTiquete) &&
        !item.seatNumber &&
        (!item.legs || item.legs.every((l: any) => !l.origin && !l.destination && !l.flightNumber))
      );
    case "hoteleria":
      return (
        !item.hotelName &&
        !item.destination &&
        !item.reservationNumber &&
        !item.observations &&
        !item.hotelType
      );
    case "seguros_viaje":
      return !item.phone && !item.insuranceType;
    case "planes":
      return (
        !item.planName &&
        !item.hotelName &&
        !item.reservationNumber &&
        !item.flightNumber &&
        !item.ticketNumber &&
        !item.airline
      );
    case "checkin":
      return (
        !item.flightOrReservation &&
        !item.travelDate &&
        !item.seat &&
        !item.baggage &&
        !item.specialNeeds
      );
    case "documentacion_migratoria":
      return (
        !item.nationality &&
        !item.docNumber &&
        !item.passportExpiry &&
        !item.destinationCountry
      );
    case "simcard":
      return (
        !item.destinationCountry &&
        !item.arrivalDate &&
        !item.tripDuration &&
        !item.dataPlan
      );
    case "renta_vehiculos":
      return (
        !item.licenseNumber &&
        !item.pickupDate &&
        !item.returnDate &&
        !item.guaranteeCreditCard
      );
    case "renta_fincas":
      return !item.checkInDate && !item.checkOutDate && !item.petType;
    case "tours":
      return (
        !item.selectedTour &&
        !item.preferredDate &&
        !item.childrenAges &&
        !item.pickupPoint &&
        !item.medicalConditions &&
        !item.observations
      );
    case "centros_convencion":
      return (
        !item.organization &&
        !item.startDate &&
        !item.endDate &&
        !item.cateringNotes
      );
    case "restaurantes":
      return !item.dateTime;
    case "visa":
      return (
        !item.nationality &&
        !item.docNumber &&
        !item.passportExpiration &&
        !item.countryApplying
      );
    case "pasaporte":
      return !item.residenceCity;
    case "servicio_mascotas":
      return (
        !item.petName &&
        !item.breed &&
        item.weight === 0 &&
        !item.travelDate &&
        !item.destinationCountry &&
        !item.medicalConditions &&
        !item.transportCompany &&
        !item.observations
      );
    default:
      return true;
  }
}
