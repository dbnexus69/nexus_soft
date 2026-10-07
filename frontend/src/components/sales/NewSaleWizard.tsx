import { useState, useEffect } from "react";
import { validarPaso } from "./wizard/validarPaso";
import { useToast } from "../../context/ToastContext";
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
import { useSaleCalculations } from "../../hooks/useSaleCalculations";
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
import { ProductFormsModal, PRODUCT_MAP } from "./wizard";
import { todayStr, formatSaleId } from "../../utils/formatters";
import * as api from "../../api";
import type { VentaCreada } from "../../api/sales";

interface Props {
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const STEPS = [
  { id: 1, label: "Cliente", icon: User },
  { id: 2, label: "Productos", icon: Package },
  { id: 3, label: "Pago", icon: CreditCard },
] as const;

/**
 * Un voucher adjunto llega del formulario como data URL (`VoucherField` lo lee
 * con FileReader). Para subirlo como archivo hay que devolverlo a binario.
 */
/**
 * Un borrador guardado antes de la spec 012 traía la reserva arriba del tiquete: se le pasa al titular si no tiene.
 * El asiento suelto de cada pasajero (`asiento`) se ignora: ahora va uno por tramo (`asientos`).
 */
function borradorAlDia(form: WizardFormData): WizardFormData {
  return {
    ...form,
    tickets: (form.tickets || []).map((t) => {
      if (!t.reservationNumber) return t;
      const iTitular = Math.max(0, (t.passengers || []).findIndex((p) => p.esTitular));
      return {
        ...t,
        passengers: (t.passengers || []).map((p, i) => (i === iTitular && !p.nroReserva ? { ...p, nroReserva: t.reservationNumber } : p)),
      };
    }),
  };
}

function dataUrlABlob(dataUrl: string): Blob {
  const [cabecera, datos = ""] = dataUrl.split(",");
  const tipo = /data:([^;]+)/.exec(cabecera)?.[1] || "application/octet-stream";
  const binario = atob(datos);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

// Borradores de la sesión. El asistente se desmonta al cambiar de módulo, y el
// localStorage no sirve de copia única: los vouchers viajan en base64 y pueden
// superar su cupo (~5 MB), en cuyo caso la escritura falla. Por eso la copia
// viva está aquí, con la misma clave (empresa + usuario) que el localStorage.
const borradoresEnMemoria = new Map<string, WizardFormData>();

export default function NewSaleWizard({ onClose, onSuccess }: Props) {
  const { data, fetchClients, fetchUsers, fetchCommissionAgents, fetchResponsables, fetchConfig, invalidateDashboard } = useData();
  // Crear la venta y refrescar la tabla es responsabilidad de SalesContext,
  // que es donde vive el listado con su página y sus filtros.
  const { handleCreateSale } = useSalesContext();
  const { user } = useAuth();

  // La empresa entra en la clave, no solo el usuario: al suplantar, el
  // superadministrador conserva su userId, así que un borrador a medias con el
  // cliente, los pasajeros y los importes de una agencia se rehidrataba dentro
  // de la siguiente y podía enviarse a la equivocada. Es lo mismo que ya cuidan
  // los cachés de `utils/*Cache.ts`.
  const draftKey = `nexus_new_sale_draft_${user?.empresaId || 'sin-empresa'}_${user?.id || 'unknown'}`;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardFormData>(() => {
    const enMemoria = borradoresEnMemoria.get(draftKey);
    if (enMemoria) return enMemoria;
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        return borradorAlDia(JSON.parse(saved));
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

  const { error: toastError } = useToast();

  const triggerError = (msg: string) => {
    setErrorMessage(msg);
    setShowError(true);
    setTimeout(() => setShowError(false), 4000);
  };

  // Saber si el formulario de tiquetería está completamente vacío (sin tocar)
  const isTicketFormEmpty = (() => {
    if (activeForm === "ticket" && activeIdx !== null) {
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
    if (activeForm === "hotel" && activeIdx !== null) {
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
      const client = form.clientData;
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
    if (activeForm === "insurance" && activeIdx !== null) {
      const ins = form.insurances[activeIdx];
      if (!ins) return true;
      const hasInsuranceType = !!ins.insuranceType?.trim();
      const hasPhone = !!ins.phone?.trim();
      const hasSupplier = !!ins.supplier?.trim();
      const hasCost = ins.supplierCost > 0;
      const hasTa = ins.ta > 0;
      
      const client = form.clientData;
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
    openForm: (type: SaleProductId | null, idx: number | null) => {
      setActiveForm(type);
      setActiveIdx(idx);
    },
  };

  useEffect(() => {
    borradoresEnMemoria.set(draftKey, form);
    try {
      localStorage.setItem(draftKey, JSON.stringify(form));
    } catch (error) {
      // Sin esto, al recargar se restauraría una versión vieja sin avisar.
      localStorage.removeItem(draftKey);
      console.warn("[DRAFT_SAVE_FAILED]", "likely oversized file attachments:", error);
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

  // Compute Totals Automatically using custom hook
  useSaleCalculations(form, setForm);


  const getCurrentItemLinkedPlanIndex = () => {
    if (!activeForm || activeIdx === null || activeForm === 'plan') return '';
    let targetKey: keyof WizardFormData | null = null;
    switch (activeForm) {
      case "ticket": targetKey = "tickets"; break;
      case "hotel": targetKey = "hotels"; break;
      case "insurance": targetKey = "insurances"; break;
      case "checkin": targetKey = "checkIns"; break;
      case "migration": targetKey = "migrations"; break;
      case "simcard": targetKey = "simCards"; break;
      case "car": targetKey = "carRentals"; break;
      case "finca": targetKey = "fincas"; break;
      case "tour": targetKey = "tours"; break;
      case "convention": targetKey = "conventions"; break;
      case "restaurant": targetKey = "restaurants"; break;
      case "visa": targetKey = "visas"; break;
      case "passport": targetKey = "passports"; break;
      case "pet": targetKey = "petServices"; break;
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
    if (!activeForm || activeIdx === null || activeForm === 'plan') return;
    let targetKey: keyof WizardFormData | null = null;
    switch (activeForm) {
      case "ticket": targetKey = "tickets"; break;
      case "hotel": targetKey = "hotels"; break;
      case "insurance": targetKey = "insurances"; break;
      case "checkin": targetKey = "checkIns"; break;
      case "migration": targetKey = "migrations"; break;
      case "simcard": targetKey = "simCards"; break;
      case "car": targetKey = "carRentals"; break;
      case "finca": targetKey = "fincas"; break;
      case "tour": targetKey = "tours"; break;
      case "convention": targetKey = "conventions"; break;
      case "restaurant": targetKey = "restaurants"; break;
      case "visa": targetKey = "visas"; break;
      case "passport": targetKey = "passports"; break;
      case "pet": targetKey = "petServices"; break;
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
          setErrors((prev) => ({ ...prev, creditDueDate: "La fecha de vencimiento no puede ser anterior a hoy" }));
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
    const errs = validarPaso(s, form, data, triggerError);
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goNext = () => {
    if (validateStep(step)) setStep(step + 1);
  };
  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };



  /**
   * Sube el voucher de cada producto que lo tenga, a la línea que devolvió el
   * alta. `creada.products` viene en el mismo orden que cada lista del
   * formulario, así que el producto se encuentra por categoría y posición.
   */
  const subirVouchers = async (creada: VentaCreada) => {
    let subidos = 0;
    const fallidos: string[] = [];
    for (const [categoria, config] of Object.entries(PRODUCT_MAP)) {
      const items = (form[config.key] as any[]) || [];
      for (const [indice, item] of items.entries()) {
        const archivo = item?.voucher || item?.vouchers?.[0];
        if (!archivo?.base64) continue;
        const nombre = `${config.labelSingular} ${indice + 1}`;
        const linea = creada.products.find((p) => p.category === categoria && p.index === indice);
        try {
          if (!linea?.detalleId) throw new Error("la venta no devolvió el producto");
          await api.uploadProductVoucher(creada.id, linea.detalleId, dataUrlABlob(archivo.base64), archivo.name || "voucher");
          subidos++;
        } catch (err: any) {
          fallidos.push(`${nombre} (${archivo.name}): ${err?.response?.data?.error?.message || err?.message || "error desconocido"}`);
        }
      }
    }
    return { subidos, fallidos };
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
    setShowError(false); // el error del intento anterior se quita al reintentar
    const client = form.clientData;
    if (!client) {
      setErrors({ ...errors, clientId: "El cliente no es válido" });
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
      // Se envía siempre que esté puesta. Antes iba condicionada a `isCredit`,
      // y ese indicador se apaga al elegir "pagado" a mano, así que la fecha se
      // descartaba justo en el caso en el que el backend la exige.
      creditDueDate: form.creditDueDate || undefined,
      commissionAgentId: Number(form.commissionAgentId) || undefined,
      commissionAgentName: form.commissionAgentName || undefined,
      commissionAgentAmount: Number(form.commissionAgentAmount) || undefined,
      commissionAgentRetentionPercentage: Number(form.commissionAgentRetentionPercentage) || undefined,
      commissionAgentNetPayment: Number(form.commissionAgentNetPayment) || undefined,
      isSettled: !!form.commissionAgentId ? false : undefined,
      ta: Number(form.ta) || 0,
      supplierCost: Number(form.supplierCost) || 0,
    };

    // Los archivos no viajan en el JSON de la venta. Antes iban dentro, en
    // base64, y el backend los ignoraba: ningún voucher adjunto llegaba a
    // guardarse. Se suben después, uno por producto (ver `subirVouchers`).
    for (const clave of Object.keys(saleData)) {
      if (clave.endsWith("Data") && Array.isArray(saleData[clave])) {
        saleData[clave] = saleData[clave].map(({ voucher, vouchers, ...resto }: any) => resto);
      }
    }

    try {
      // handleCreateSale ya refresca el listado; el dashboard se invalida aparte
      // porque sus cifras cambian con cada venta nueva.
      const creada = await handleCreateSale(saleData);
      invalidateDashboard();
      borradoresEnMemoria.delete(draftKey);
      localStorage.removeItem(draftKey);

      const { subidos, fallidos } = await subirVouchers(creada);
      const venta = `Venta N.º ${formatSaleId(creada.numero ?? creada.id)}`;
      if (fallidos.length) {
        // La venta ya existe: el aviso dice qué archivo falta, para que no se
        // dé por adjuntado un voucher que no llegó.
        toastError(
          `${venta} registrada, pero no se pudo subir el voucher de: ${fallidos.join(", ")}. ` +
          `Conserva esos archivos: habrá que adjuntarlos otra vez.`
        );
      }
      onSuccess(
        subidos > 0
          ? `${venta} registrada con ${subidos} ${subidos === 1 ? "voucher" : "vouchers"}`
          : `${venta} registrada`
      );
      onClose();
    } catch (err: any) {
      console.error("Error al registrar venta:", err);
      const errMsg = err?.response?.data?.error?.message || "Ocurrió un error interno en el servidor al registrar la venta.";
      // Se queda a la vista hasta el siguiente intento (el aviso de 4 s se perdía si se miraba a otro lado).
      setErrorMessage(`No se pudo registrar la venta: ${errMsg}`);
      setShowError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cerrar no descarta: el borrador queda guardado para la próxima vez que se abra la venta.
  const handleCancel = () => {
    onClose();
  };

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ minHeight: 0 }}>

      {/* ══════════════ LEFT SIDEBAR – STEP NAVIGATOR ══════════════ */}
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
              <p className="text-white/40 text-xs tracking-widest uppercase">Nueva Venta</p>
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
                    <p className={`text-xs mt-0.5 ${
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
          <p className="text-white/30 text-xs uppercase tracking-widest mb-2">Progreso</p>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${((step - 1) / (STEPS.length - 1)) * 100}%`,
                background: "linear-gradient(90deg, #8D99AE, #a8b4c4)"
              }}
            />
          </div>
          <p className="text-white/40 text-xs mt-1.5">Paso {step} de {STEPS.length}</p>
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
            onSwitchForm={(productId, idx) => { setActiveForm(productId); setActiveIdx(idx); }}
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
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-widest">
                  Paso {step} - {STEPS[step - 1].label}
                </p>
                <h2 className="text-base font-bold text-primary mt-0.5">
                  {step === 1 ? "Información del Cliente" : step === 2 ? "Configura tus Productos" : "Resumen y Pago"}
                </h2>
              </div>
              <button
                onClick={handleCancel}
                aria-label="Cerrar el asistente de venta"
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-600 hover:bg-gray-100 transition-all"
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
    case "ticket":
      return (
        !item.airline &&
        !item.reservationNumber &&
        !item.flightNumber &&
        (!item.passengers || item.passengers.length === 0 || !item.passengers[0]?.nroTiquete) &&
        !item.seatNumber &&
        (!item.legs || item.legs.every((l: any) => !l.origin && !l.destination && !l.flightNumber))
      );
    case "hotel":
      return (
        !item.hotelName &&
        !item.destination &&
        !item.reservationNumber &&
        !item.observations &&
        !item.hotelType
      );
    case "insurance":
      return !item.phone && !item.insuranceType;
    case "plan":
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
    case "migration":
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
    case "car":
      return (
        !item.licenseNumber &&
        !item.pickupDate &&
        !item.returnDate &&
        !item.guaranteeCreditCard
      );
    case "finca":
      return !item.checkInDate && !item.checkOutDate && !item.petType;
    case "tour":
      return (
        !item.selectedTour &&
        !item.preferredDate &&
        !item.childrenAges &&
        !item.pickupPoint &&
        !item.medicalConditions &&
        !item.observations
      );
    case "convention":
      return (
        !item.organization &&
        !item.startDate &&
        !item.endDate &&
        !item.cateringNotes
      );
    case "restaurant":
      return !item.dateTime;
    case "visa":
      return (
        !item.nationality &&
        !item.docNumber &&
        !item.passportExpiration &&
        !item.countryApplying
      );
    case "passport":
      return !item.residenceCity;
    case "pet":
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
