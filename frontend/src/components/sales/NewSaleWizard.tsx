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
} from "lucide-react";
import { Button } from "../ui/Button";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
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
  const { data, addSale } = useData();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardFormData>(() => {
    const saved = localStorage.getItem("itea_new_sale_draft");
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
    localStorage.setItem("itea_new_sale_draft", JSON.stringify(form));
  }, [form]);

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
      setForm(prev => ({
        ...prev,
        supplierCost: calcSupplierCost.toString(),
        ta: calcTa.toString(),
        total: calcTotal.toString()
      }));
    }
  }, [
    form.tickets, form.hotels, form.insurances, form.plans, form.checkIns,
    form.migrations, form.simCards, form.carRentals, form.fincas, form.tours,
    form.conventions, form.restaurants, form.visas, form.passports, form.petServices
  ]);

  /* ---- helpers --------------------------------------------------- */
  const set = <K extends keyof WizardFormData>(
    key: K,
    value: WizardFormData[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

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
    }
    if (s === 2) {
      if (form.selectedProducts.length === 0)
        errs.products = "Debes seleccionar al menos un producto";
    }
    if (s === 3) {
      if (!form.total) errs.total = "El valor total es obligatorio";
      if (!form.paymentMethod)
        errs.paymentMethod = "La forma de pago es obligatoria";
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

  const closeActiveForm = () => {
    if (activeForm && activeIdx !== null) {
      let targetKey: string | null = null;
      switch (activeForm) {
        case "tiqueteria": targetKey = "tickets"; break;
        case "hoteleria": targetKey = "hotels"; break;
        case "seguros_viaje": targetKey = "insurances"; break;
        case "planes": targetKey = "plans"; break;
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
        const items = (form as any)[targetKey] || [];
        const currentItem = items[activeIdx];
        if (currentItem && isItemEmpty(currentItem, activeForm)) {
          const nextItems = [...items];
          nextItems.splice(activeIdx, 1);
          
          setForm(prev => {
            const updatedForm = { ...prev, [targetKey!]: nextItems };
            if (nextItems.length === 0) {
              updatedForm.selectedProducts = prev.selectedProducts.filter(p => p !== activeForm);
            }
            return updatedForm;
          });
        }
      }
    }
    setActiveForm(null);
    setActiveIdx(null);
  };

  const renderActiveForm = () => {
    if (!activeForm || activeIdx === null) return null;

    const product = SALE_PRODUCTS.find((p) => p.id === activeForm);
    const client = data.clients.find((c: any) => c.name === form.clientId);

    return (
      <div className="flex flex-col h-full bg-white animate-fade-in">
        {/* Sub-form Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/50">
          <div className="flex items-center gap-3">
            <button
              onClick={closeActiveForm}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-600"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <h3 className="font-bold text-primary flex items-center gap-2">
                {product?.label}
                <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  Item #{activeIdx + 1}
                </span>
              </h3>
              <p className="text-[10px] text-gray-500">
                Completa la información detallada del servicio
              </p>
            </div>
          </div>
          <Button 
            size="sm" 
            onClick={closeActiveForm}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            Listo
          </Button>
        </div>

        {/* Sub-form Content */}
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-3xl mx-auto">
        {(() => {
          switch (activeForm) {
            case "tiqueteria":
              return (
                <TicketForm
                  ticket={form.tickets[activeIdx] || INITIAL_TICKET(client)}
                  onChange={(updates) => {
                    const next = [...form.tickets];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("tickets", next);
                  }}
                  airlines={data.config.airlines}
                  suppliers={data.config.suppliers}
                  airports={data.config.airports}
                  paymentMethods={data.config.cards}
                  baggage={data.config.baggage}
                />
              );
            case "hoteleria":
              return (
                <HotelForm
                  hotel={form.hotels[activeIdx] || INITIAL_HOTEL(client)}
                  onChange={(updates) => {
                    const next = [...form.hotels];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("hotels", next);
                  }}
                  data={data}
                />
              );
            case "seguros_viaje":
              return (
                <InsuranceForm
                  insurance={form.insurances[activeIdx] || INITIAL_INSURANCE(client)}
                  onChange={(updates) => {
                    const next = [...form.insurances];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("insurances", next);
                  }}
                  data={data}
                />
              );
            case "planes":
              return (
                <PlanForm
                  plan={form.plans[activeIdx] || INITIAL_PLAN(client)}
                  onChange={(updates) => {
                    const next = [...form.plans];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("plans", next);
                  }}
                  data={data}
                />
              );
            case "checkin":
              return (
                <CheckInForm
                  checkIn={form.checkIns[activeIdx] || INITIAL_CHECKIN(client)}
                  client={client}
                  suppliers={data.config.suppliers}
                  onChange={(updates) => {
                    const next = [...form.checkIns];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("checkIns", next);
                  }}
                />
              );
            case "documentacion_migratoria":
              return (
                <MigrationForm
                  migration={form.migrations[activeIdx] || INITIAL_MIGRATION(client)}
                  client={client}
                  suppliers={data.config.suppliers}
                  onChange={(updates) => {
                    const next = [...form.migrations];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("migrations", next);
                  }}
                />
              );
            case "simcard":
              return (
                <SimCardForm
                  sim={form.simCards[activeIdx] || INITIAL_SIMCARD(client)}
                  client={client}
                  suppliers={data.config.suppliers}
                  onChange={(updates) => {
                    const next = [...form.simCards];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("simCards", next);
                  }}
                />
              );
            case "renta_vehiculos":
              return (
                <CarRentalForm
                  car={form.carRentals[activeIdx] || INITIAL_CAR_RENTAL(client)}
                  client={client}
                  suppliers={data.config.suppliers}
                  onChange={(updates) => {
                    const next = [...form.carRentals];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("carRentals", next);
                  }}
                />
              );
            case "renta_fincas":
              return (
                <FincaForm
                  finca={form.fincas[activeIdx] || INITIAL_FINCA(client)}
                  client={client}
                  suppliers={data.config.suppliers}
                  onChange={(updates) => {
                    const next = [...form.fincas];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("fincas", next);
                  }}
                />
              );
            case "tours":
              return (
                <TourForm
                  tour={form.tours[activeIdx] || INITIAL_TOUR(client)}
                  client={client}
                  suppliers={data.config.suppliers}
                  onChange={(updates) => {
                    const next = [...form.tours];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("tours", next);
                  }}
                />
              );
            case "centros_convencion":
              return (
                <ConventionForm
                  convention={form.conventions[activeIdx] || INITIAL_CONVENTION(client)}
                  client={client}
                  suppliers={data.config.suppliers}
                  onChange={(updates) => {
                    const next = [...form.conventions];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("conventions", next);
                  }}
                />
              );
            case "restaurantes":
              return (
                <RestaurantForm
                  restaurant={form.restaurants[activeIdx] || INITIAL_RESTAURANT(client)}
                  client={client}
                  suppliers={data.config.suppliers}
                  onChange={(updates) => {
                    const next = [...form.restaurants];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("restaurants", next);
                  }}
                />
              );
            case "visa":
              return (
                <VisaForm
                  visa={form.visas[activeIdx] || INITIAL_VISA(client)}
                  client={client}
                  suppliers={data.config.suppliers}
                  onChange={(updates) => {
                    const next = [...form.visas];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("visas", next);
                  }}
                />
              );
            case "pasaporte":
              return (
                <PassportForm
                  passport={form.passports[activeIdx] || INITIAL_PASSPORT(client)}
                  client={client}
                  suppliers={data.config.suppliers}
                  onChange={(updates) => {
                    const next = [...form.passports];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("passports", next);
                  }}
                />
              );
            case "servicio_mascotas":
              return (
                <PetServiceForm
                  pet={form.petServices[activeIdx] || INITIAL_PET_SERVICE(client)}
                  client={client}
                  suppliers={data.config.suppliers}
                  onChange={(updates) => {
                    const next = [...form.petServices];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("petServices", next);
                  }}
                />
              );

            default:
              return null;
          }
        })()}
          </div>
        </div>
      </div>
    );
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;
    if (isSubmitting) return;
    setIsSubmitting(true);
    const client = data.clients.find((c: any) => c.name === form.clientId);
    if (!client) {
      setErrors({ ...errors, clientId: "El cliente no es válido" });
      setStep(1);
      return;
    }

    const fullObservations = form.observations.trim();

    const mappedTickets = form.tickets.map(t => {
      // 1. Accumulate outbound legs (initial leg + outbound stops/scales)
      let finalLegs = [...t.legs];
      if (t.hasStops && t.outboundStops && t.outboundStops.length > 0) {
        const validOutboundStops = t.outboundStops.filter(s => s.origin || s.destination || s.flightNumber || s.seat || s.date);
        finalLegs = [...finalLegs, ...validOutboundStops];
      }

      // 2. Accumulate return legs (initial return leg + return stops/scales)
      let finalReturnLeg = t.returnLeg;
      if (t.flightMode === 'round_trip' && t.returnLeg) {
        if (t.returnHasStops && t.returnStops && t.returnStops.length > 0) {
          const validReturnStops = t.returnStops.filter(s => s.origin || s.destination || s.flightNumber || s.seat || s.date);
          if (validReturnStops.length > 0) {
            // Append the primary returnLeg and all returnStops except the last one to finalLegs
            finalLegs.push(t.returnLeg);
            for (let i = 0; i < validReturnStops.length - 1; i++) {
              finalLegs.push(validReturnStops[i]);
            }
            // The last returnStop becomes the final returnLeg
            finalReturnLeg = validReturnStops[validReturnStops.length - 1];
          }
        }
      }

      return {
        ...t,
        legs: finalLegs,
        returnLeg: finalReturnLeg,
        seatNumber: finalLegs[0]?.seat || ""
      };
    });

    const saleData: Omit<Sale, "id"> = {
      clientId: client.id,
      clientName: client.name,
      asesorId: Number(form.asesorId) || user!.id,
      asesorName: form.asesorName || user!.name,
      date: new Date().toISOString().split("T")[0],
      total: Number(form.total),
      paymentMethod: form.paymentMethod,
      status: form.status as Sale["status"],
      observations: fullObservations,
      products: form.selectedProducts,
      ticketData: mappedTickets.length > 0 ? mappedTickets : undefined,
      hotelData: form.hotels.length > 0 ? form.hotels : undefined,
      insuranceData: form.insurances.length > 0 ? form.insurances : undefined,
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
      localStorage.removeItem("itea_new_sale_draft");

      const hasVouchersToSend = [
        ...form.checkIns, ...form.migrations, ...form.simCards, ...form.carRentals,
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
      const errMsg = err?.response?.data?.error?.message || "Ocurrió un error interno en el servidor al registrar la venta. Por favor, asegúrese de reiniciar el servidor backend local para cargar los nuevos módulos de base de datos.";
      alert(`Error al registrar venta: ${errMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    localStorage.removeItem("itea_new_sale_draft");
    onClose();
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {activeForm ? renderActiveForm() : (
        <>
          {/* Header / Stepper */}
          <div className="px-6 py-4 border-b bg-gray-50/50">
            <div className="flex justify-between items-center max-w-2xl mx-auto relative">
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 -translate-y-1/2 -z-10" />
              {STEPS.map((s) => {
                const Icon = s.icon;
                const isCompleted = step > s.id;
                const isActive = step === s.id;

                return (
                  <div key={s.id} className="flex flex-col items-center gap-2">
                    <div
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500
                        ${
                          isCompleted
                            ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100"
                            : isActive
                              ? "bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-110"
                              : "bg-white border-gray-200 text-gray-400"
                        }
                      `}
                    >
                      <Icon size={18} />
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isActive ? "text-primary" : "text-gray-400"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {step === 1 && <Step1Client form={form} set={set} data={data} errors={errors} />}
            {step === 2 && <Step2Products form={form} set={set} data={data} errors={errors} toggleProduct={toggleProduct} actions={actions} />}
            {step === 3 && <Step3Payment form={form} set={set} data={data} errors={errors} />}
          </div>
        </>
      )}

      {/* Footer */}
      <div className="px-6 py-4 border-t bg-white flex gap-3">
        {activeForm ? (
          <>
            <Button
              variant="outline"
              onClick={closeActiveForm}
            >
              Regresar
            </Button>
            <Button
              onClick={closeActiveForm}
            >
              Confirmar y Continuar
            </Button>
          </>
        ) : (
          <div className="flex justify-between items-center w-full">
            <Button
              variant="outline"
              onClick={goBack}
              disabled={step === 1}
              className="px-8 border-gray-200 text-gray-500 hover:bg-gray-50"
            >
              Anterior
            </Button>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="px-8 border-gray-200 text-gray-500 hover:bg-gray-50"
                onClick={handleCancel}
              >
                Cancelar
              </Button>

              {step < 3 ? (
                <Button onClick={goNext} className="px-10 group">
                  Siguiente
                  <ArrowRight
                    size={18}
                    className="ml-2 group-hover:translate-x-1 transition-transform"
                  />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className={`px-10 text-white shadow-lg ${
                    isSubmitting
                      ? "bg-emerald-400 cursor-not-allowed shadow-none"
                      : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                  }`}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creando venta...
                    </span>
                  ) : (
                    "Finalizar Venta"
                  )}
                </Button>
              )}
            </div>
          </div>
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
        !item.ticketNumber &&
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
      return !item.contactName && !item.contactNumber && !item.address;
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
        !item.passportNumber &&
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
        !item.medicalConditions
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
        !item.passportNumber &&
        !item.passportExpiration &&
        !item.countryApplying &&
        !item.estimatedTravelDate
      );
    case "pasaporte":
      return !item.residenceCity && !item.estimatedTravelDate;
    case "servicio_mascotas":
      return (
        !item.petName &&
        !item.breed &&
        item.weight === 0 &&
        !item.travelDate &&
        !item.destinationCountry &&
        !item.medicalConditions
      );
    default:
      return true;
  }
}

