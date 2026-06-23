import { Package, Plane, Users, Briefcase, Trash2, PlusCircle } from "lucide-react";
import { FormField, Input, Combobox, Select , CurrencyInput} from "../../ui/Form";
import { Button } from "../../ui/Button";
import { PlanData, GuestInfo } from "../../../types";
import { DateTimePicker } from "./TicketForm";
import { VoucherField } from "./VoucherField";

interface PlanFormProps {
  plan: PlanData;
  onChange: (updates: Partial<PlanData>) => void;
  data: any;
  triggerError?: (msg: string) => void;
  mainClient?: any;
}

export function PlanForm({ plan, onChange, data, triggerError, mainClient }: PlanFormProps) {
  const minDateTime = (() => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  })();

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
        packageId: pkg.id,
        packageName: pkg.name,
        planName: pkg.name,
        hotelName: pkg.accommodation?.hotel || "",
        supplier: pkg.accommodation?.supplier || "",
        airline: pkg.flight?.airline || "",
        flightNumber: (pkg.flight?.legs?.[0]?.flightNumber || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8),
        observations: `Incluye: ${pkg.includedServices || 'N/A'}\nNo Incluye: ${pkg.notIncluded || 'N/A'}`,
        adultsCount: 2,
        childrenCount: 0,
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Selector de Tipo de Paquete */}
      <div className="bg-white p-4 rounded-xl border border-gray-250/60 shadow-sm flex flex-col gap-3">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
          Tipo de Paquete
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ packageType: "own" })}
            className={`py-3 px-4 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-center gap-2 ${
              plan.packageType !== "supplier"
                ? "border-primary bg-primary/5 text-primary shadow-sm"
                : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
            }`}
          >
            <Package size={16} />
            Propio de la Empresa
          </button>
          <button
            type="button"
            onClick={() => onChange({ packageType: "supplier" })}
            className={`py-3 px-4 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-center gap-2 ${
              plan.packageType === "supplier"
                ? "border-primary bg-primary/5 text-primary shadow-sm"
                : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
            }`}
          >
            <Users size={16} />
            Por Proveedor
          </button>
        </div>
      </div>

      {/* Selector de Catálogo */}
      {plan.packageType !== "supplier" && (
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
      )}

      {plan.packageType === "supplier" && (
        <VoucherField
          multiple={true}
          vouchers={plan.vouchers || (plan.voucher ? [plan.voucher] : undefined)}
          sendVoucher={plan.sendVoucher}
          onChange={(updates) => {
            if (updates.vouchers) {
              onChange({ vouchers: updates.vouchers, voucher: updates.vouchers[0] });
            } else if ('vouchers' in updates) {
              onChange({ vouchers: undefined, voucher: undefined });
            }
            if (updates.sendVoucher !== undefined) {
              onChange({ sendVoucher: updates.sendVoucher });
            }
          }}
        />
      )}

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
              placeholder="Ej: Plan Cancún Todo Incluido (Máx 50)"
              maxLength={50}
            />
          </FormField>
          {plan.packageType !== "supplier" && (
            <>
              <FormField label="Nombre del Hotel">
                <Input
                  value={plan.hotelName}
                  onChange={(e) => onChange({ hotelName: e.target.value })}
                  placeholder="Ej: Riu Palace (Máx 50)"
                  maxLength={50}
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
                  type="text"
                  value={plan.adultsCount !== undefined ? plan.adultsCount : ""}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, "").slice(0, 3);
                    onChange({ adultsCount: cleaned === "" ? undefined : Number(cleaned) });
                  }}
                  placeholder="Solo números, máx 999"
                />
              </FormField>
              <FormField label="Menores">
                <Input
                  type="text"
                  value={plan.childrenCount !== undefined ? plan.childrenCount : ""}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, "").slice(0, 3);
                    onChange({ childrenCount: cleaned === "" ? undefined : Number(cleaned) });
                  }}
                  placeholder="Solo números, máx 999"
                />
              </FormField>
            </>
          )}
        </div>
      </div>

      {plan.packageType !== "supplier" && (
        <div className="bg-blue-50/20 p-4 rounded-xl border border-blue-100">
          <h4 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Plane size={14} />
            Reservación y Transporte
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label={<span>Número de Reservación <span className="text-red-500">*</span></span>}>
              <Input
                required
                value={plan.reservationNumber}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                  onChange({ reservationNumber: cleaned });
                }}
                placeholder="Código de hotel (Máx 20)"
                maxLength={20}
              />
            </FormField>
            <FormField label={<span>Número de Vuelo <span className="text-red-500">*</span></span>}>
              <Input
                required
                value={plan.flightNumber}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8);
                  onChange({ flightNumber: cleaned });
                }}
                placeholder="Ej: AV9301"
                maxLength={8}
              />
            </FormField>
            <FormField label={<span>Número de Tiquete <span className="text-red-500">*</span></span>}>
              <Input
                required
                value={plan.ticketNumber}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, "").slice(0, 14);
                  onChange({ ticketNumber: cleaned });
                }}
                placeholder="13 a 14 dígitos numéricos"
                maxLength={14}
              />
            </FormField>
             <FormField label={<span>Confirmación <span className="text-red-500">*</span></span>}>
               <Input
                 required
                 value={plan.confirmationNumber || ""}
                 onChange={(e) => {
                   const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
                   onChange({ confirmationNumber: cleaned });
                 }}
                 placeholder="6 caracteres (Ej: AB1234)"
                 maxLength={6}
               />
             </FormField>
            <FormField label={<span>Fecha Ida (Vuelo) <span className="text-red-500">*</span></span>}>
              <DateTimePicker
                value={plan.flightDepartureDate || ""}
                onChange={(val) => onChange({ flightDepartureDate: val })}
                min={minDateTime}
                triggerError={triggerError}
                fieldName="Salida de ida del plan"
              />
            </FormField>
            <FormField label={<span>Llegada Ida (Vuelo) <span className="text-red-500">*</span></span>}>
              <DateTimePicker
                value={plan.flightDepartureArrivalDate || ""}
                onChange={(val) => onChange({ flightDepartureArrivalDate: val })}
                min={minDateTime}
                triggerError={triggerError}
                fieldName="Llegada de ida del plan"
              />
            </FormField>
            <FormField label={<span>Fecha Vuelta (Vuelo) <span className="text-red-500">*</span></span>}>
              <DateTimePicker
                value={plan.flightReturnDate || ""}
                onChange={(val) => onChange({ flightReturnDate: val })}
                min={minDateTime}
                triggerError={triggerError}
                fieldName="Salida de vuelta del plan"
              />
            </FormField>
            <FormField label={<span>Llegada Vuelta (Vuelo) <span className="text-red-500">*</span></span>}>
              <DateTimePicker
                value={plan.flightReturnArrivalDate || ""}
                onChange={(val) => onChange({ flightReturnArrivalDate: val })}
                min={minDateTime}
                triggerError={triggerError}
                fieldName="Llegada de vuelta del plan"
              />
            </FormField>
            <FormField label={<span>Ingreso Hotel <span className="text-red-500">*</span></span>}>
              <DateTimePicker
                value={plan.startDate || ""}
                onChange={(val) => onChange({ startDate: val })}
                min={minDateTime}
                triggerError={triggerError}
                fieldName="Ingreso al hotel del plan"
              />
            </FormField>
            <FormField label={<span>Salida Hotel <span className="text-red-500">*</span></span>}>
              <DateTimePicker
                value={plan.endDate || ""}
                onChange={(val) => onChange({ endDate: val })}
                min={minDateTime}
                triggerError={triggerError}
                fieldName="Salida del hotel del plan"
              />
            </FormField>
          </div>
        </div>
      )}

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
            <CurrencyInput
              required
              value={plan.supplierCost === 0 ? "" : plan.supplierCost}
              onChange={(val) =>
                onChange({
                  supplierCost: val === "" ? 0 : Number(val),
                })
              }
            />
          </FormField>
          <FormField label="Valor TA">
            <CurrencyInput
              required
              value={plan.ta === 0 ? "" : plan.ta}
              onChange={(val) =>
                onChange({
                  ta: val === "" ? 0 : Number(val),
                })
              }
            />
          </FormField>
          <FormField label="Método de Pago">
            <Combobox
              value={plan.supplierPaymentMethod || ""}
              onChange={(val) => onChange({ supplierPaymentMethod: val })}
              options={data.config.cards.map((m: any) => ({
                value: m.name,
                label: m.lastFourDigits ? `${m.name} (**${m.lastFourDigits})` : m.name,
              }))}
              placeholder="Seleccionar método..."
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
          <Button type="button" variant="outline" size="sm" onClick={addGuest}>
            <PlusCircle size={14} className="mr-1" />
            Agregar
          </Button>
        </div>
        <div className="space-y-3">
          {plan.guests.map((guest, gIdx) => (
            <div key={gIdx} className="flex gap-2 items-start">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                <Combobox
                  value={guest.name}
                  onChange={(val) => {
                    const cleaned = val.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");
                    const client = (data?.clients || []).find(
                      (c: any) =>
                        (c.name === cleaned || `${c.firstName} ${c.lastName || ""}`.trim() === cleaned) &&
                        c.status === "active"
                    );
                    if (client) {
                      updateGuest(gIdx, {
                        name: client.name || `${client.firstName} ${client.lastName || ""}`.trim(),
                        docType: client.docType || guest.docType,
                        docNumber: client.docNumber || guest.docNumber,
                      });
                    } else {
                      updateGuest(gIdx, { name: cleaned });
                    }
                  }}
                  options={(data?.clients || [])
                    .filter((c: any) => c.status === "active" && String(c.id) !== String(mainClient?.id))
                    .map((c: any) => ({
                      value: c.name || `${c.firstName} ${c.lastName || ""}`.trim(),
                      label: c.name || `${c.firstName} ${c.lastName || ""}`.trim(),
                    }))}
                  placeholder="Nombre completo"
                  preventNumbers={true}
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
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                    updateGuest(gIdx, { docNumber: cleaned });
                  }}
                  placeholder="Número de documento"
                  maxLength={20}
                />
              </div>
              {plan.guests.length > 1 && (
                <Button type="button" variant="outline" size="sm" onClick={() => removeGuest(gIdx)}>
                  <Trash2 size={14} className="text-red-500" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4">
          <FormField label="Observaciones">
            <textarea
              className="w-full text-sm p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
              rows={3}
              value={plan.observations || ""}
              onChange={(e) => onChange({ observations: e.target.value })}
              placeholder="Notas, inclusiones, excepciones..."
            />
          </FormField>
        </div>
      </div>
    </div>
  );
}