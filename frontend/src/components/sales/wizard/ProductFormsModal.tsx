import React from "react";
import {
  ArrowRight, ArrowLeft, Link2, Check, X, Plus, Plane, Building2, ShieldCheck,
  Package, Luggage, FileInput, Smartphone, Car, TreePine, Compass, Music,
  UtensilsCrossed, FileText, PawPrint
} from "lucide-react";
import { Button } from "../../ui/Button";
import { SaleProductId } from "../../../types";
import { WizardFormData, INITIAL_TICKET, INITIAL_HOTEL, INITIAL_INSURANCE, INITIAL_PLAN, INITIAL_CHECKIN, INITIAL_MIGRATION, INITIAL_SIMCARD, INITIAL_CAR_RENTAL, INITIAL_FINCA, INITIAL_TOUR, INITIAL_CONVENTION, INITIAL_RESTAURANT, INITIAL_VISA, INITIAL_PASSPORT, INITIAL_PET_SERVICE } from "../wizardData";
import {
  HotelForm, InsuranceForm, CheckInForm, PlanForm, MigrationForm, SimCardForm,
  CarRentalForm, FincaForm, TourForm, ConventionForm, RestaurantForm, VisaForm,
  PassportForm, PetServiceForm, TicketForm
} from "../forms";

interface ProductFormsModalProps {
  activeForm: SaleProductId | null;
  activeIdx: number | null;
  form: WizardFormData;
  data: any;
  set: (field: keyof WizardFormData, val: any) => void;
  onCloseForm: () => void;
  onSwitchForm?: (productId: SaleProductId, idx: number) => void;
  triggerError: (msg: string) => void;
}

const PRODUCT_ICONS: Record<SaleProductId, any> = {
  ticket: Plane,
  hotel: Building2,
  insurance: ShieldCheck,
  plan: Package,
  checkin: Luggage,
  migration: FileInput,
  simcard: Smartphone,
  car: Car,
  finca: TreePine,
  tour: Compass,
  convention: Music,
  restaurant: UtensilsCrossed,
  visa: FileText,
  passport: FileInput,
  pet: PawPrint,
};

const PRODUCT_MAP: Record<SaleProductId, { key: keyof WizardFormData; labelSingular: string; initialFn: any }> = {
  ticket: { key: "tickets", labelSingular: "Tiquete", initialFn: INITIAL_TICKET },
  hotel: { key: "hotels", labelSingular: "Hotel", initialFn: INITIAL_HOTEL },
  insurance: { key: "insurances", labelSingular: "Seguro", initialFn: INITIAL_INSURANCE },
  plan: { key: "plans", labelSingular: "Paquete", initialFn: INITIAL_PLAN },
  checkin: { key: "checkIns", labelSingular: "Check-In", initialFn: INITIAL_CHECKIN },
  migration: { key: "migrations", labelSingular: "Trámite Migratorio", initialFn: INITIAL_MIGRATION },
  simcard: { key: "simCards", labelSingular: "SimCard", initialFn: INITIAL_SIMCARD },
  car: { key: "carRentals", labelSingular: "Vehículo", initialFn: INITIAL_CAR_RENTAL },
  finca: { key: "fincas", labelSingular: "Finca", initialFn: INITIAL_FINCA },
  tour: { key: "tours", labelSingular: "Tour", initialFn: INITIAL_TOUR },
  convention: { key: "conventions", labelSingular: "Convención", initialFn: INITIAL_CONVENTION },
  restaurant: { key: "restaurants", labelSingular: "Restaurante", initialFn: INITIAL_RESTAURANT },
  visa: { key: "visas", labelSingular: "Visa", initialFn: INITIAL_VISA },
  passport: { key: "passports", labelSingular: "Pasaporte", initialFn: INITIAL_PASSPORT },
  pet: { key: "petServices", labelSingular: "Mascota", initialFn: INITIAL_PET_SERVICE },
};

export const ProductFormsModal: React.FC<ProductFormsModalProps> = ({
  activeForm,
  activeIdx,
  form,
  data,
  set,
  onCloseForm,
  onSwitchForm,
  triggerError
}) => {
  if (!activeForm || activeIdx === null) return null;

  const client = form.clientData;
  const currentConfig = activeForm ? PRODUCT_MAP[activeForm] : null;
  const currentItems = currentConfig ? ((form as any)[currentConfig.key] || []) : [];

  const getCurrentItemLinkedPlanIndex = () => {
    if (!activeForm || activeIdx === null || activeForm === 'plan') return '';
    let targetKey = null;
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
    let targetKey = null;
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
        set(targetKey as keyof WizardFormData, items);
      }
    }
  };


  const getLinkedServicesForPlan = (planIdx: number) => {
    const linked: Array<{ productId: SaleProductId; label: string; idx: number }> = [];
    const map: Array<{ productId: SaleProductId; label: string; key: keyof WizardFormData }> = [
      { productId: "ticket", label: "Tiquete", key: "tickets" },
      { productId: "hotel", label: "Hotel", key: "hotels" },
      { productId: "insurance", label: "Asistencia Médica", key: "insurances" },
      { productId: "checkin", label: "Check-in", key: "checkIns" },
      { productId: "car", label: "Renta Autos", key: "carRentals" },
      { productId: "finca", label: "Finca", key: "fincas" },
      { productId: "tour", label: "Tour", key: "tours" },
      { productId: "restaurant", label: "Restaurante", key: "restaurants" },
      { productId: "visa", label: "Visa", key: "visas" },
      { productId: "passport", label: "Pasaporte", key: "passports" },
    ];
    map.forEach(m => {
      const items = (form as any)[m.key] || [];
      items.forEach((item: any, idx: number) => {
        if (item.linkedToPlanIndex === planIdx) {
          linked.push({ productId: m.productId, label: m.label, idx });
        }
      });
    });
    return linked;
  };

  const handleAddLinkedService = (productId: SaleProductId, planIdx: number) => {
    let targetKey: keyof WizardFormData | null = null;
    let initialFn: any = null;
    switch (productId) {
      case "ticket": targetKey = "tickets"; initialFn = INITIAL_TICKET; break;
      case "hotel": targetKey = "hotels"; initialFn = INITIAL_HOTEL; break;
      case "insurance": targetKey = "insurances"; initialFn = INITIAL_INSURANCE; break;
      case "checkin": targetKey = "checkIns"; initialFn = INITIAL_CHECKIN; break;
      case "migration": targetKey = "migrations"; initialFn = INITIAL_MIGRATION; break;
      case "simcard": targetKey = "simCards"; initialFn = INITIAL_SIMCARD; break;
      case "car": targetKey = "carRentals"; initialFn = INITIAL_CAR_RENTAL; break;
      case "finca": targetKey = "fincas"; initialFn = INITIAL_FINCA; break;
      case "tour": targetKey = "tours"; initialFn = INITIAL_TOUR; break;
      case "convention": targetKey = "conventions"; initialFn = INITIAL_CONVENTION; break;
      case "restaurant": targetKey = "restaurants"; initialFn = INITIAL_RESTAURANT; break;
      case "visa": targetKey = "visas"; initialFn = INITIAL_VISA; break;
      case "passport": targetKey = "passports"; initialFn = INITIAL_PASSPORT; break;
      case "pet": targetKey = "petServices"; initialFn = INITIAL_PET_SERVICE; break;
    }
    if (targetKey && initialFn) {
      if (!form.selectedProducts.includes(productId)) {
        set("selectedProducts", [...form.selectedProducts, productId]);
      }
      const currentItems = [...((form as any)[targetKey] || [])];
      const newItem = { ...initialFn(client), linkedToPlanIndex: planIdx };
      currentItems.push(newItem);
      set(targetKey, currentItems);
    }
  };

  return (
    <form onSubmit={(e) => e.preventDefault()} className="flex flex-col h-full bg-white relative">
      <div className="px-4 sm:px-6 py-3.5 border-b border-gray-200 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-3 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCloseForm}
            className="px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl transition-all flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 shadow-2xs"
            title="Volver a la selección de servicios"
          >
            <ArrowLeft size={16} />
            <span>Volver</span>
          </button>
          <div className="h-5 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />
          {(() => {
            const IconComp = PRODUCT_ICONS[activeForm];
            return (
              <div className="flex items-center gap-2">
                {IconComp && (
                  <div className="p-1.5 bg-primary/10 text-primary rounded-lg shrink-0">
                    <IconComp size={18} />
                  </div>
                )}
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 capitalize">
                    {activeForm.replace("_", " ")}
                  </h3>
                  <p className="text-[11px] text-slate-500 hidden sm:block">Diligencie o edite los detalles del servicio</p>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCloseForm}
            className="text-xs gap-1.5 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={15} />
            <span>Cancelar</span>
          </Button>
          <Button
            type="button"
            onClick={onCloseForm}
            className="text-xs gap-1.5 bg-primary text-white hover:bg-primary/90 shadow-xs"
          >
            <Check size={15} />
            <span>Guardar Servicio</span>
          </Button>
        </div>
      </div>

      {/* Barra de Pestañas e Ítems Múltiples (Tiquete 1, Tiquete 2, + Añadir otro) */}
      {currentConfig && (
        <div className="px-4 sm:px-6 py-2.5 bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 overflow-x-auto shrink-0 custom-scrollbar">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 shrink-0">
              {currentConfig.labelSingular}s ({currentItems.length}):
            </span>
            {currentItems.map((item: any, idx: number) => {
              const isActive = idx === activeIdx;
              const nameText = item.hotelName || item.planName || item.tourName || item.passengerName || item.passengerInfo?.name || item.fincaName || `${currentConfig.labelSingular} #${idx + 1}`;
              return (
                <div
                  key={idx}
                  onClick={() => onSwitchForm && onSwitchForm(activeForm, idx)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shrink-0 ${
                    isActive
                      ? "bg-primary text-white border-primary shadow-xs"
                      : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary/50"
                  }`}
                >
                  <span className="truncate max-w-[140px]">{nameText}</span>
                  {currentItems.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextItems = currentItems.filter((_: any, i: number) => i !== idx);
                        set(currentConfig.key, nextItems);
                        if (nextItems.length === 0) {
                          onCloseForm();
                        } else if (activeIdx >= nextItems.length) {
                          if (onSwitchForm) onSwitchForm(activeForm, nextItems.length - 1);
                        }
                      }}
                      className={`p-0.5 rounded-full hover:bg-black/20 ${isActive ? 'text-white' : 'text-slate-400 hover:text-red-500'}`}
                      title={`Eliminar ${currentConfig.labelSingular} #${idx + 1}`}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const newItem = currentConfig.initialFn(client);
              const nextItems = [...currentItems, newItem];
              set(currentConfig.key, nextItems);
              if (onSwitchForm) {
                onSwitchForm(activeForm, nextItems.length - 1);
              }
            }}
            className="text-xs font-bold gap-1 bg-white dark:bg-slate-900 text-primary border-primary/30 hover:bg-primary/5 shrink-0"
          >
            <Plus size={14} />
            <span>+ Añadir {currentConfig.labelSingular} #{currentItems.length + 1}</span>
          </Button>
        </div>
      )}


      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {activeForm !== "plan" && form.plans.length > 0 && (
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm animate-fade-in mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Link2 size={16} className="text-primary" />
              <h4 className="text-sm font-bold text-gray-800 dark:text-slate-200">Vincular a Paquete</h4>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">Si este servicio pertenece a un paquete de esta misma venta, selecciónalo aquí para agruparlos.</p>
            <select 
              className="w-full text-sm p-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
              value={getCurrentItemLinkedPlanIndex()}
              onChange={e => setCurrentItemLinkedPlanIndex(e.target.value)}
            >
              <option value="">-- No vincular a ningún paquete --</option>
              {form.plans.map((p, idx) => (
                <option key={idx} value={idx}>
                  Paquete #{idx + 1}: {p.planName || p.packageName || 'Sin nombre'}
                </option>
              ))}
            </select>
          </div>
        )}
        {(() => {

          switch (activeForm) {
            case "ticket":
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
                  clients={data.clients}
                  mainClient={client}
                  triggerError={triggerError}
                />
              );
            case "hotel":
              return (
                <HotelForm
                  hotel={form.hotels[activeIdx] || INITIAL_HOTEL(client)}
                  mainClient={client}
                  data={data}
                  onChange={(updates) => {
                    const next = [...form.hotels];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("hotels", next);
                  }}
                  triggerError={triggerError}
                  suppliers={data.config.suppliers}
                />
              );
            case "insurance":
              return (
                <InsuranceForm
                  insurance={form.insurances[activeIdx] || INITIAL_INSURANCE(client)}
                  onChange={(updates) => {
                    const next = [...form.insurances];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("insurances", next);
                  }}
                  data={data}
                  client={client}
                  suppliers={data.config.suppliers}
                />
              );
            case "plan":
              return (
                <PlanForm
                  plan={form.plans[activeIdx] || INITIAL_PLAN(client)}
                  onChange={(updates) => {
                    const next = [...form.plans];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("plans", next);
                  }}
                  data={data}
                  triggerError={triggerError}
                  mainClient={client}
                  onAddLinkedService={handleAddLinkedService}
                  planIndex={activeIdx}
                  linkedServices={getLinkedServicesForPlan(activeIdx)}
                />
              );
            case "checkin":
              return (
                <CheckInForm
                  checkIn={form.checkIns[activeIdx] || INITIAL_CHECKIN(client)}
                  client={client}
                  suppliers={data.config.suppliers}
                  baggage={data.config.baggage}
                  paymentMethods={data.config.cards}
                  onChange={(updates) => {
                    const next = [...form.checkIns];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("checkIns", next);
                  }}
                  triggerError={triggerError}
                />
              );
            case "migration":
              return (
                <MigrationForm
                  migration={form.migrations[activeIdx] || INITIAL_MIGRATION(client)}
                  client={client}
                  suppliers={data.config.suppliers}
                  paymentMethods={data.config.cards}
                  onChange={(updates) => {
                    const next = [...form.migrations];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("migrations", next);
                  }}
                  triggerError={triggerError}
                />
              );
            case "simcard":
              return (
                <SimCardForm
                  sim={form.simCards[activeIdx] || INITIAL_SIMCARD(client)}
                  client={client}
                  suppliers={data.config.suppliers}
                  paymentMethods={data.config.cards}
                  onChange={(updates) => {
                    const next = [...form.simCards];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("simCards", next);
                  }}
                  triggerError={triggerError}
                />
              );
            case "car":
              return (
                <CarRentalForm
                  car={form.carRentals[activeIdx] || INITIAL_CAR_RENTAL(client)}
                  client={client}
                  suppliers={data.config.suppliers}
                  paymentMethods={data.config.cards}
                  onChange={(updates) => {
                    const next = [...form.carRentals];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("carRentals", next);
                  }}
                  triggerError={triggerError}
                />
              );
            case "finca":
              return (
                <FincaForm
                  finca={form.fincas[activeIdx] || INITIAL_FINCA(client)}
                  client={client}
                  suppliers={data.config.suppliers}
                  paymentMethods={data.config.cards}
                  onChange={(updates) => {
                    const next = [...form.fincas];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("fincas", next);
                  }}
                  triggerError={triggerError}
                />
              );
            case "tour":
              return (
                <TourForm
                  tour={form.tours[activeIdx] || INITIAL_TOUR(client)}
                  mainClient={client}
                  data={data}
                  onChange={(updates) => {
                    const next = [...form.tours];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("tours", next);
                  }}
                  triggerError={triggerError}
                />
              );
            case "convention":
              return (
                <ConventionForm
                  convention={form.conventions[activeIdx] || INITIAL_CONVENTION(client)}
                  client={client}
                  suppliers={data.config.suppliers}
                  paymentMethods={data.config.cards}
                  onChange={(updates) => {
                    const next = [...form.conventions];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("conventions", next);
                  }}
                  triggerError={triggerError}
                />
              );
            case "restaurant":
              return (
                <RestaurantForm
                  restaurant={form.restaurants[activeIdx] || INITIAL_RESTAURANT(client)}
                  client={client}
                  suppliers={data.config.suppliers}
                  paymentMethods={data.config.cards}
                  onChange={(updates) => {
                    const next = [...form.restaurants];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("restaurants", next);
                  }}
                  triggerError={triggerError}
                />
              );
            case "visa":
              return (
                <VisaForm
                  visa={form.visas[activeIdx] || INITIAL_VISA(client)}
                  client={client}
                  suppliers={data.config.suppliers}
                  paymentMethods={data.config.cards}
                  onChange={(updates) => {
                    const next = [...form.visas];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("visas", next);
                  }}
                  triggerError={triggerError}
                />
              );
            case "passport":
              return (
                <PassportForm
                  passport={form.passports[activeIdx] || INITIAL_PASSPORT(client)}
                  client={client}
                  suppliers={data.config.suppliers}
                  paymentMethods={data.config.cards}
                  onChange={(updates) => {
                    const next = [...form.passports];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("passports", next);
                  }}
                  triggerError={triggerError}
                />
              );
            case "pet":
              return (
                <PetServiceForm
                  pet={form.petServices[activeIdx] || INITIAL_PET_SERVICE(client)}
                  client={client}
                  suppliers={data.config.suppliers}
                  paymentMethods={data.config.cards}
                  onChange={(updates) => {
                    const next = [...form.petServices];
                    next[activeIdx] = { ...next[activeIdx], ...updates };
                    set("petServices", next);
                  }}
                  triggerError={triggerError}
                />
              );
            default:
              return null;
          }
        })()}
      </div>

      {/* Barra Inferior Sticky con Botones de Acción Completa (Volver, Cancelar, Guardar) */}
      <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-3 shrink-0 sticky bottom-0 z-20 shadow-md">
        <button
          type="button"
          onClick={onCloseForm}
          className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl transition-all flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 shadow-2xs"
        >
          <ArrowLeft size={16} />
          <span>Volver a Productos</span>
        </button>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCloseForm}
            className="text-xs gap-1.5 border-slate-300 dark:border-slate-700"
          >
            <X size={15} />
            <span>Cancelar</span>
          </Button>
          <Button
            type="button"
            onClick={onCloseForm}
            className="text-xs gap-1.5 bg-primary text-white hover:bg-primary/90 shadow-xs"
          >
            <Check size={15} />
            <span>Guardar Servicio</span>
          </Button>
        </div>
      </div>
    </form>
  );
};
