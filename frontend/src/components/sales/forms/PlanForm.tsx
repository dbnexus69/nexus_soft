import { Package, Plane, Users, Briefcase, Trash2, PlusCircle, Link2, Plus, Car, Bus } from "lucide-react";
import { FormField, Input, Combobox, Select , CurrencyInput} from "../../ui/Form";
import { Button } from "../../ui/Button";
import { PlanData, GuestInfo, SaleProductId } from "../../../types";
import { DateTimePicker } from "./TicketForm";

interface PlanFormProps {
  plan: PlanData;
  onChange: (updates: Partial<PlanData>) => void;
  data: any;
  triggerError?: (msg: string) => void;
  mainClient?: any;
  onAddLinkedService?: (productType: SaleProductId, planIdx: number) => void;
  onEditLinkedService?: (productType: SaleProductId, itemIdx: number) => void;
  planIndex?: number;
  linkedServices?: Array<{ productId: SaleProductId; label: string; idx: number }>;
}

export function PlanForm({
  plan,
  onChange,
  data,
  triggerError,
  mainClient,
  onAddLinkedService,
  onEditLinkedService,
  planIndex = 0,
  linkedServices = []
}: PlanFormProps) {
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
        flightNumber: (pkg.flight?.legs?.[0]?.flightNumber || "").replace(/[^a-zA-Z0-9- ]/g, "").toUpperCase().slice(0, 8),
        transportType: pkg.flight?.transportType || 'Aereo',
        observations: `Incluye: ${pkg.includedServices || 'N/A'}\nNo Incluye: ${pkg.notIncluded || 'N/A'}`,
        adultsCount: 2,
        childrenCount: 0,
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Selector de Catálogo */}
      {packages.length > 0 && (
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

      <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
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
          <FormField label="Tipo de Transporte">
            <Select
              value={plan.transportType || "Aereo"}
              onChange={(e) => onChange({ transportType: e.target.value as 'Aereo' | 'Terrestre' })}
            >
              <option value="Aereo">✈️ Transporte Aéreo (Vuelo / Aerolínea)</option>
              <option value="Terrestre">🚌 Transporte Terrestre (Bus / Flota / Vehículo)</option>
            </Select>
          </FormField>
          <FormField label="Nombre del Hotel">
            <Input
              value={plan.hotelName}
              onChange={(e) => onChange({ hotelName: e.target.value })}
              placeholder="Ej: Riu Palace (Máx 50)"
              maxLength={50}
            />
          </FormField>

          <FormField label={plan.transportType === 'Terrestre' ? 'Empresa de Transporte Terrestre' : 'Aerolínea'}>
            {plan.transportType === 'Terrestre' ? (
              <Combobox
                value={plan.airline || ""}
                onChange={(val) => onChange({ airline: val })}
                options={[
                  { value: "Flota Magdalena", label: "Flota Magdalena" },
                  { value: "Expreso Brasilia", label: "Expreso Brasilia" },
                  { value: "Berlinas del Fonce", label: "Berlinas del Fonce" },
                  { value: "Copetran", label: "Copetran" },
                  { value: "Rápido Ochoa", label: "Rápido Ochoa" },
                  { value: "Coomotor", label: "Coomotor" },
                  { value: "Transporte Especial Privado", label: "Transporte Especial Privado" },
                  { value: "Bus de Turismo", label: "Bus de Turismo" },
                  { value: "Chiva Turística", label: "Chiva Turística" },
                  { value: "Van Privada", label: "Van Privada" },
                ]}
                placeholder="Seleccionar o escribir empresa de transporte..."
              />
            ) : (
              <Combobox
                value={plan.airline}
                onChange={(val) => onChange({ airline: val })}
                options={(data?.config?.airlines || []).map((a: any) => ({ value: a.name, label: a.name }))}
                placeholder="Seleccionar aerolínea..."
              />
            )}
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
        </div>
      </div>

      <div className={`p-4 rounded-xl border transition-all ${
        plan.transportType === 'Terrestre'
          ? 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/40'
          : 'bg-blue-50/30 dark:bg-blue-950/20 border-blue-200/80 dark:border-blue-800/40'
      }`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2">
            <h4 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${
              plan.transportType === 'Terrestre' ? 'text-emerald-700 dark:text-emerald-300' : 'text-blue-700 dark:text-blue-300'
            }`}>
              {plan.transportType === 'Terrestre' ? <Car size={16} /> : <Plane size={16} />}
              {plan.transportType === 'Terrestre' ? 'Reservación y Transporte Terrestre' : 'Reservación y Transporte Aéreo'}
            </h4>
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 rounded-lg border border-gray-200 dark:border-slate-700 shadow-2xs">
              <button
                type="button"
                onClick={() => onChange({ transportType: 'Aereo' })}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                  plan.transportType !== 'Terrestre'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shadow-2xs'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700'
                }`}
              >
                ✈️ Aéreo
              </button>
              <button
                type="button"
                onClick={() => onChange({ transportType: 'Terrestre' })}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                  plan.transportType === 'Terrestre'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 shadow-2xs'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700'
                }`}
              >
                🚌 Terrestre
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label={<span>Número de Reservación <span className="text-red-500">*</span></span>}>
              <Input
                required
                value={plan.reservationNumber}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                  onChange({ reservationNumber: cleaned });
                }}
                placeholder="Código de hotel / voucher (Máx 20)"
                maxLength={20}
              />
            </FormField>
            <FormField label={<span>{plan.transportType === 'Terrestre' ? 'Placa / Vehículo / Bus' : 'Número de Vuelo'} <span className="text-red-500">*</span></span>}>
              <Input
                required
                value={plan.flightNumber}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^a-zA-Z0-9- ]/g, "").toUpperCase().slice(0, 8);
                  onChange({ flightNumber: cleaned });
                }}
                placeholder={plan.transportType === 'Terrestre' ? "Ej: XYZ-123 / Bus #4" : "Ej: AV9301"}
                maxLength={8}
              />
            </FormField>
            <FormField label={<span>{plan.transportType === 'Terrestre' ? 'Silla / Puesto' : 'Número de Tiquete'} <span className="text-red-500">*</span></span>}>
              <Input
                required
                value={plan.ticketNumber}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^a-zA-Z0-9- ]/g, "").slice(0, 14);
                  onChange({ ticketNumber: cleaned });
                }}
                placeholder={plan.transportType === 'Terrestre' ? "Ej: Silla #12" : "13 a 14 dígitos numéricos"}
                maxLength={14}
              />
            </FormField>
             <FormField label={<span>{plan.transportType === 'Terrestre' ? 'Código Reserva Terrestre' : 'Confirmación Vuelo'} <span className="text-red-500">*</span></span>}>
               <Input
                 required
                 value={plan.confirmationNumber || ""}
                 onChange={(e) => {
                   const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8);
                   onChange({ confirmationNumber: cleaned });
                 }}
                 placeholder={plan.transportType === 'Terrestre' ? "Ej: TER-991" : "Ej: AB1234"}
                 maxLength={8}
               />
             </FormField>
            <FormField label={<span>{plan.transportType === 'Terrestre' ? 'Salida Origen (Ida)' : 'Fecha Ida (Vuelo)'} <span className="text-red-500">*</span></span>}>
              <DateTimePicker
                value={plan.flightDepartureDate || ""}
                onChange={(val) => onChange({ flightDepartureDate: val })}
                min={minDateTime}
                triggerError={triggerError}
                fieldName={plan.transportType === 'Terrestre' ? 'Salida de ida en bus' : 'Salida de ida del vuelo'}
              />
            </FormField>
            <FormField label={<span>{plan.transportType === 'Terrestre' ? 'Llegada Destino (Ida)' : 'Llegada Ida (Vuelo)'} <span className="text-red-500">*</span></span>}>
              <DateTimePicker
                value={plan.flightDepartureArrivalDate || ""}
                onChange={(val) => onChange({ flightDepartureArrivalDate: val })}
                min={minDateTime}
                triggerError={triggerError}
                fieldName={plan.transportType === 'Terrestre' ? 'Llegada a destino en bus' : 'Llegada de ida del vuelo'}
              />
            </FormField>
            <FormField label={<span>{plan.transportType === 'Terrestre' ? 'Salida Destino (Regreso)' : 'Fecha Vuelta (Vuelo)'} <span className="text-red-500">*</span></span>}>
              <DateTimePicker
                value={plan.flightReturnDate || ""}
                onChange={(val) => onChange({ flightReturnDate: val })}
                min={minDateTime}
                triggerError={triggerError}
                fieldName={plan.transportType === 'Terrestre' ? 'Salida de regreso en bus' : 'Salida de vuelta del vuelo'}
              />
            </FormField>
            <FormField label={<span>{plan.transportType === 'Terrestre' ? 'Llegada Origen (Regreso)' : 'Llegada Vuelta (Vuelo)'} <span className="text-red-500">*</span></span>}>
              <DateTimePicker
                value={plan.flightReturnArrivalDate || ""}
                onChange={(val) => onChange({ flightReturnArrivalDate: val })}
                min={minDateTime}
                triggerError={triggerError}
                fieldName={plan.transportType === 'Terrestre' ? 'Llegada a origen en bus' : 'Llegada de vuelta del vuelo'}
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

      <div className="bg-emerald-50/20 dark:bg-emerald-500/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
        <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Briefcase size={14} /> Finanzas
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nombre del Proveedor">
            <Combobox
              value={plan.supplier}
              onChange={(val) => onChange({ supplier: val })}
              options={(data?.config?.suppliers || []).map((s: any) => ({ value: s.name, label: s.name }))}
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
              options={(data?.config?.cards || []).map((m: any) => ({
                value: m.name,
                label: m.lastFourDigits ? `${m.name} (**${m.lastFourDigits})` : m.name,
              }))}
              placeholder="Seleccionar método..."
              direction="up"
            />
          </FormField>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
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
                  options={(data?.config?.documentTypes || []).map((d: any) => {
                    const code = d.abbreviation || d.abreviatura || d.code || d.name || '';
                    return { value: code, label: code };
                  })}
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

      {/* Sección de Servicios Adicionales Vinculados a este Paquete */}
      <div className="bg-gradient-to-r from-purple-50/60 to-indigo-50/60 dark:from-purple-950/30 dark:to-indigo-950/30 p-5 rounded-2xl border border-purple-200/80 dark:border-purple-800/40 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-600 text-white rounded-xl shadow-md">
              <Link2 size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Servicios Adicionales Vinculados a este Paquete
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Si este paquete requiere servicios extra no incluidos (Tours, Tiquetes, Asistencia Médica, etc.), añádelos aquí.
              </p>
            </div>
          </div>
        </div>

        {/* Lista de servicios ya vinculados a este paquete */}
        {linkedServices.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {linkedServices.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-xl border border-purple-100 dark:border-purple-900/50 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                    {item.label} #{item.idx + 1}
                  </span>
                  <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 px-2 py-0.5 rounded-full font-medium">
                    Vinculado
                  </span>
                </div>
                {onEditLinkedService && (
                  <button
                    type="button"
                    onClick={() => onEditLinkedService(item.productId, item.idx)}
                    className="text-xs text-primary font-bold hover:underline"
                  >
                    Editar
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white/80 dark:bg-slate-900/60 p-3 rounded-xl border border-dashed border-purple-200 dark:border-purple-800 text-center">
            <p className="text-xs text-slate-500">No hay otros servicios vinculados aún a este paquete.</p>
          </div>
        )}

        {/* Botones de acción rápida para añadir servicios directamente al paquete */}
        {onAddLinkedService && (
          <div className="pt-2 border-t border-purple-100 dark:border-purple-900/30">
            <label className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-widest block mb-2">
              + Añadir servicio adicional a este paquete:
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'tours', label: '+ Tour / Excursión' },
                { id: 'tiqueteria', label: '+ Tiquete Aéreo' },
                { id: 'hoteleria', label: '+ Hotel Adicional' },
                { id: 'seguros_viaje', label: '+ Asistencia Médica' },
                { id: 'renta_vehiculos', label: '+ Renta Vehículo' },
                { id: 'renta_fincas', label: '+ Renta Finca' },
              ].map(btn => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => onAddLinkedService(btn.id as SaleProductId, planIndex)}
                  className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-all shadow-2xs flex items-center gap-1"
                >
                  <Plus size={12} />
                  {btn.label.replace('+ ', '')}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}