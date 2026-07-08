import { Building2, Users, Briefcase, Trash2, PlusCircle } from "lucide-react";
import * as LuIcons from "react-icons/lu";
import { FormField, Input, Combobox, Select , CurrencyInput} from "../../ui/Form";
import { Button } from "../../ui/Button";
import { HotelData, GuestInfo } from "../../../types";
import { DateTimePicker } from "./TicketForm";

interface HotelFormProps {
  hotel: HotelData;
  onChange: (updates: Partial<HotelData>) => void;
  data: any;
  triggerError?: (msg: string) => void;
  mainClient?: any;
}

export function HotelForm({ hotel, onChange, data, triggerError, mainClient }: HotelFormProps) {
  const minDateTime = (() => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  })();

  const addGuest = () => {
    onChange({ guests: [...hotel.guests, { name: "", docType: "CC", docNumber: "" }] });
  };

  const removeGuest = (gIdx: number) => {
    onChange({ guests: hotel.guests.filter((_, i) => i !== gIdx) });
  };

  const updateGuest = (gIdx: number, gUpdates: Partial<GuestInfo>) => {
    const nextGuests = [...hotel.guests];
    nextGuests[gIdx] = { ...nextGuests[gIdx], ...gUpdates };
    onChange({ guests: nextGuests });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
        <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
          <Building2 size={14} />
          Datos del Hotel
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nombre del Hotel">
            <Input
              value={hotel.hotelName}
              onChange={(e) => onChange({ hotelName: e.target.value })}
              placeholder="Ej: Hilton Berlin (Mín 2, Máx 50)"
              maxLength={50}
            />
          </FormField>
          <FormField label="Destino">
            <Combobox
              value={hotel.destination}
              onChange={(val) => onChange({ destination: val })}
              options={(data?.config?.airports || []).map((a: any) => ({
                value: a.location,
                label: `${a.location} (${a.abbreviation})`,
              }))}
              placeholder="Ej: Berlín, Alemania"
            />
          </FormField>
          <FormField label="Proveedor">
            <Combobox
              value={hotel.supplier}
              onChange={(val) => onChange({ supplier: val })}
              options={(data?.config?.suppliers || []).map((s: any) => ({ value: s.name, label: s.name }))}
              placeholder="Seleccionar proveedor..."
            />
          </FormField>
          <FormField label="Número de Reserva">
            <Input
              value={hotel.reservationNumber}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                onChange({ reservationNumber: cleaned });
              }}
              placeholder="Máx 20 caracteres (sin especiales)"
              maxLength={20}
            />
          </FormField>
          <FormField label="Check-in (Fecha y Hora)">
            <DateTimePicker
              value={hotel.startDate}
              onChange={(val) => onChange({ startDate: val })}
              min={minDateTime}
              triggerError={triggerError}
              fieldName="Check-in del hotel"
            />
          </FormField>
          <FormField label="Check-out (Fecha y Hora)">
            <DateTimePicker
              value={hotel.endDate}
              onChange={(val) => onChange({ endDate: val })}
              min={minDateTime}
              triggerError={triggerError}
              fieldName="Check-out del hotel"
            />
          </FormField>
          <FormField label="Tipo de Hotel">
            <Combobox
              value={hotel.hotelType || ""}
              onChange={(val) => onChange({ hotelType: val })}
              options={[
                { value: "", label: "Seleccionar..." },
                { value: "hotel", label: "Hotel" },
                { value: "hotel_turistico", label: "Hotel Turístico" },
                { value: "resort", label: "Resort / Todo Incluido" },
                { value: "boutique", label: "Hotel Boutique" },
                { value: "apartamento", label: "Apartamento / AirBnB" },
                { value: "hostal", label: "Hostal / Albergue" },
                { value: "finca", label: "Finca / Casa Rural" },
              ]}
              placeholder="Seleccionar tipo..."
            />
          </FormField>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
            <Users size={14} />
            Huéspedes
          </h4>
          <Button variant="outline" size="sm" onClick={addGuest}>
            <PlusCircle size={14} className="mr-1" />
            Agregar
          </Button>
        </div>
        <div className="space-y-3">
          {hotel.guests.map((guest, gIdx) => (
            <div key={gIdx} className="flex gap-2 items-start">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                <Combobox
                  value={guest.name}
                  onChange={(val) => {
                    const client = (data?.clients || []).find(
                      (c: any) =>
                        (c.name === val || `${c.firstName} ${c.lastName || ""}`.trim() === val) &&
                        c.status === "active"
                    );
                    if (client) {
                      updateGuest(gIdx, {
                        name: client.name || `${client.firstName} ${client.lastName || ""}`.trim(),
                        docType: client.docType || guest.docType,
                        docNumber: client.docNumber || guest.docNumber,
                      });
                    } else {
                      updateGuest(gIdx, { name: val });
                    }
                  }}
                  options={(data?.clients || [])
                    .filter((c: any) => c.status === "active" && String(c.id) !== String(mainClient?.id))
                    .map((c: any) => ({
                      value: c.name || `${c.firstName} ${c.lastName || ""}`.trim(),
                      label: c.name || `${c.firstName} ${c.lastName || ""}`.trim(),
                    }))}
                  placeholder="Nombre completo"
                />
                <Combobox
                  value={guest.docType}
                  onChange={(val) => updateGuest(gIdx, { docType: val })}
                  options={(data?.config?.documentTypes || []).map((d: any) => ({
                    value: d.abreviatura || d.code || d.name,
                    label: d.abreviatura || d.name || d.code,
                  }))}
                  placeholder="Tipo de documento"
                />
                <Input
                  value={guest.docNumber}
                  onChange={(e) => updateGuest(gIdx, { docNumber: e.target.value })}
                  placeholder="Número de documento"
                />
              </div>
              {hotel.guests.length > 1 && (
                <Button variant="outline" size="sm" onClick={() => removeGuest(gIdx)}>
                  <Trash2 size={14} className="text-red-500" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-emerald-50/20 dark:bg-emerald-500/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
        <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Briefcase size={14} /> Información Financiera
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Costo Proveedor">
            <CurrencyInput
              required
              value={hotel.supplierCost === 0 ? "" : hotel.supplierCost}
              onChange={(val) => {
                onChange({
                  supplierCost: val === "" ? 0 : Number(val),
                });
              }}
            />
          </FormField>
          <FormField label="Tarifa Administrativa (TA)">
            <CurrencyInput
              required
              value={hotel.ta === 0 ? "" : hotel.ta}
              onChange={(val) => {
                onChange({
                  ta: val === "" ? 0 : Number(val),
                });
              }}
            />
          </FormField>
          <FormField label="Método de Pago">
            <Combobox
              value={hotel.supplierPaymentMethod || ""}
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
        <h4 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
          <LuIcons.LuFileText size={14} /> Observaciones del Hotel
        </h4>
        <textarea
          className="w-full h-24 p-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
          placeholder="Ej: Habitación con vista al mar, late check-out solicitado, etc."
          value={hotel.observations || ""}
          onChange={(e) => onChange({ observations: e.target.value })}
        />
      </div>
    </div>
  );
}