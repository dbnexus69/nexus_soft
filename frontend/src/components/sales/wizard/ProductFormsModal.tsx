import React from "react";
import { ArrowRight, Link2 } from "lucide-react";
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
  triggerError: (msg: string) => void;
}

export const ProductFormsModal: React.FC<ProductFormsModalProps> = ({
  activeForm,
  activeIdx,
  form,
  data,
  set,
  onCloseForm,
  triggerError
}) => {
  if (!activeForm || activeIdx === null) return null;

  const client = data.clients.find((c: any) => c.name === form.clientId);

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
        set(targetKey as keyof WizardFormData, items);
      }
    }
  };


  return (
    <form onSubmit={(e) => e.preventDefault()} className="flex flex-col h-full bg-white relative">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-border bg-slate-50 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 capitalize">
            {activeForm.replace("_", " ")}
          </h3>
          <p className="text-xs text-slate-500">Diligencie los detalles del servicio</p>
        </div>
        <Button type="button" onClick={onCloseForm} className="gap-2">
          Guardar Servicio <ArrowRight size={16} />
        </Button>
      </div>


      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {activeForm !== "planes" && form.plans.length > 0 && (
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
                  clients={data.clients}
                  mainClient={client}
                  triggerError={triggerError}
                />
              );
            case "hoteleria":
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
                  client={client}
                  suppliers={data.config.suppliers}
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
                  triggerError={triggerError}
                  mainClient={client}
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
            case "documentacion_migratoria":
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
            case "renta_vehiculos":
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
            case "renta_fincas":
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
            case "tours":
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
            case "centros_convencion":
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
            case "restaurantes":
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
            case "pasaporte":
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
            case "servicio_mascotas":
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
    </form>
  );
};
