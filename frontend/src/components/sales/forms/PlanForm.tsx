import { Package, Plane, Users, Briefcase, Trash2, PlusCircle } from "lucide-react";
import { FormField, Input, Combobox, Select } from "../../ui/Form";
import { Button } from "../../ui/Button";
import { PlanData, GuestInfo } from "../../../types";

interface PlanFormProps {
  plan: PlanData;
  onChange: (updates: Partial<PlanData>) => void;
  data: any;
}

export function PlanForm({ plan, onChange, data }: PlanFormProps) {
  const addGuest = () => {
    onChange({ guests: [...plan.guests, { name: "", docType: "CC", docNumber: "" }] });
  };

  const removeGuest = (gIdx: number) => {
    onChange({ guests: plan.guests.filter((_, i) => i !== gIdx) });
  };

  const updateGuest = (gIdx: number, gUpdates: Partial<GuestInfo>) => {
    const nextGuests = [...plan.guests];
    nextGuests[gIdx] = { ...nextGuests[gIdx], ...gUpdates };
    onChange({ guests: nextGuests });
  };

  const packages = data.config.packages || [];

  const handleSelectPackage = (packageName: string) => {
    const pkg = packages.find((p: any) => p.name === packageName);
    if (pkg) {
      onChange({
        planName: pkg.name,
        hotelName: pkg.accommodation?.hotel || "",
        supplier: pkg.accommodation?.supplier || "",
        airline: pkg.flight?.airline || "",
        flightNumber: pkg.flight?.legs?.[0]?.flightNumber || "",
        // observations: `Incluye: ${pkg.includedServices}\nNo Incluye: ${pkg.notIncluded}`
        adultsCount: 2,
        childrenCount: 0,
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Selector de Catálogo */}
      <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 mb-4">
        <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3 flex items-center gap-2">
          <Package size={14} className="text-accent" /> Importar desde Catálogo de Paquetes
        </h4>
        <Combobox
          value={plan.planName}
          onChange={(val) => handleSelectPackage(val)}
          options={packages.map((p: any) => ({ value: p.name, label: `${p.name} - ${p.destination} (${p.nights} noches)` }))}
          placeholder="Busca un paquete registrado..."
        />
        <p className="text-[10px] text-gray-500 mt-2 italic">
          * Al seleccionar un paquete se autocompletarán los datos base (Hotel, Aerolínea, Vuelo).
        </p>
      </div>

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
        <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
          <Package size={14} />
          Datos del Plan Vacacional
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nombre del Plan">
            <Input
              value={plan.planName}
              onChange={(e) => onChange({ planName: e.target.value })}
              placeholder="Ej: Plan Cancún Todo Incluido"
            />
          </FormField>
          <FormField label="Nombre del Hotel">
            <Input
              value={plan.hotelName}
              onChange={(e) => onChange({ hotelName: e.target.value })}
              placeholder="Ej: Riu Palace"
            />
          </FormField>

          <FormField label="Aerolínea">
            <Combobox
              value={plan.airline}
              onChange={(val) => onChange({ airline: val })}
              options={data.config.airlines.map((a: any) => ({ value: a.name, label: a.name }))}
              placeholder="Seleccionar aerolínea..."
            />
          </FormField>
          <FormField label="Adultos">
            <Input
              type="number"
              min="0"
              value={plan.adultsCount !== undefined ? plan.adultsCount : ""}
              onChange={(e) => onChange({ adultsCount: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </FormField>
          <FormField label="Menores">
            <Input
              type="number"
              min="0"
              value={plan.childrenCount !== undefined ? plan.childrenCount : ""}
              onChange={(e) => onChange({ childrenCount: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </FormField>
        </div>
      </div>

      <div className="bg-blue-50/20 p-4 rounded-xl border border-blue-100">
        <h4 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Plane size={14} />
          Reservación y Transporte
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Número de Reservación">
            <Input
              value={plan.reservationNumber}
              onChange={(e) => onChange({ reservationNumber: e.target.value })}
              placeholder="Código de hotel"
            />
          </FormField>
          <FormField label="Número de Vuelo">
            <Input
              value={plan.flightNumber}
              onChange={(e) => onChange({ flightNumber: e.target.value })}
              placeholder="Ej: AV9301"
            />
          </FormField>
          <FormField label="Número de Tiquete">
            <Input
              value={plan.ticketNumber}
              onChange={(e) => onChange({ ticketNumber: e.target.value })}
              placeholder="Número de 13 dígitos"
            />
          </FormField>
          <FormField label="Fecha Ida (Vuelo)">
            <Input
              type="datetime-local"
              value={plan.flightDepartureDate}
              onChange={(e) => {
                const val = e.target.value;
                onChange({ flightDepartureDate: val, startDate: val });
              }}
            />
          </FormField>
          <FormField label="Fecha Vuelta (Vuelo)">
            <Input
              type="datetime-local"
              value={plan.flightReturnDate}
              onChange={(e) => {
                const val = e.target.value;
                onChange({ flightReturnDate: val, endDate: val });
              }}
            />
          </FormField>
          <FormField label="Ingreso Hotel">
            <Input
              type="datetime-local"
              value={plan.hotelCheckIn}
              onChange={(e) => onChange({ hotelCheckIn: e.target.value })}
            />
          </FormField>
          <FormField label="Salida Hotel">
            <Input
              type="datetime-local"
              value={plan.hotelCheckOut}
              onChange={(e) => onChange({ hotelCheckOut: e.target.value })}
            />
          </FormField>
        </div>
      </div>

      <div className="bg-emerald-50/20 p-4 rounded-xl border border-emerald-100">
        <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Briefcase size={14} /> Finanzas
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nombre del Proveedor">
            <Combobox
              value={plan.supplier}
              onChange={(val) => onChange({ supplier: val })}
              options={data.config.suppliers.map((s: any) => ({ value: s.name, label: s.name }))}
              placeholder="Seleccionar proveedor..."
            />
          </FormField>
          <FormField label="Costo Proveedor">
            <Input
              type="number"
              value={plan.supplierCost === 0 ? "" : plan.supplierCost}
              onChange={(e) =>
                onChange({
                  supplierCost:
                    e.target.value === "" ? 0 : Number(e.target.value),
                })
              }
            />
          </FormField>
          <FormField label="Valor TA">
            <Input
              type="number"
              value={plan.ta === 0 ? "" : plan.ta}
              onChange={(e) =>
                onChange({
                  ta: e.target.value === "" ? 0 : Number(e.target.value),
                })
              }
            />
          </FormField>
          <FormField label="Método de Pago">
            <Select
              value={plan.supplierPaymentMethod}
              onChange={(e) => onChange({ supplierPaymentMethod: e.target.value })}
              options={data.config.cards.map((m: any) => ({
                value: m.name,
                label: m.lastFourDigits ? `${m.name} (**${m.lastFourDigits})` : m.name,
              }))}
            />
          </FormField>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
            <Users size={14} />
            Integrantes del Plan
          </h4>
          <Button variant="outline" size="sm" onClick={addGuest}>
            <PlusCircle size={14} className="mr-1" />
            Agregar
          </Button>
        </div>
        <div className="space-y-3">
          {plan.guests.map((guest, gIdx) => (
            <div key={gIdx} className="flex gap-2 items-start">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input
                  value={guest.name}
                  onChange={(e) => updateGuest(gIdx, { name: e.target.value })}
                  placeholder="Nombre completo"
                />
                <Select
                  value={guest.docType}
                  onChange={(e) => updateGuest(gIdx, { docType: e.target.value })}
                  options={data.config.documentTypes.map((d: any) => ({
                    value: d.abreviatura,
                    label: d.abreviatura,
                  }))}
                />
                <Input
                  value={guest.docNumber}
                  onChange={(e) => updateGuest(gIdx, { docNumber: e.target.value })}
                  placeholder="Número de documento"
                />
              </div>
              {plan.guests.length > 1 && (
                <Button variant="outline" size="sm" onClick={() => removeGuest(gIdx)}>
                  <Trash2 size={14} className="text-red-500" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}