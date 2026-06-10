import { LuMap } from "react-icons/lu";
import { FormField, Input, Combobox, Textarea , CurrencyInput} from "../../ui/Form";
import { TourData } from "../../../types";
import { ClientInfoSection, VoucherField, FinancialSection } from "./VoucherField";
import { DateTimePicker } from "./TicketForm";

interface TourFormProps {
  tour: TourData;
  client: any;
  suppliers?: any[];
  paymentMethods?: any[];
  onChange: (updates: Partial<TourData>) => void;
  triggerError?: (msg: string) => void;
}

export function TourForm({ tour, client, suppliers, paymentMethods, onChange, triggerError }: TourFormProps) {
  const minDateTime = (() => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  })();
  return (
    <div className="space-y-6 animate-fade-in">
      {client && <ClientInfoSection client={client} />}

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
        <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
          <LuMap size={14} /> Tour Guiado
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nombre del Pasajero">
            <Input value={tour.passengerName} onChange={(e) => onChange({ passengerName: e.target.value })} placeholder="Nombre completo" />
          </FormField>
          <FormField label="Tour Seleccionado">
            <Input 
              value={tour.selectedTour} 
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, "");
                onChange({ selectedTour: cleaned });
              }} 
              placeholder="Nombre del tour" 
              maxLength={50}
            />
          </FormField>
          <FormField label="Fecha y Hora Preferida">
            <DateTimePicker
              value={tour.preferredDate}
              onChange={(val) => onChange({ preferredDate: val })}
              min={minDateTime}
              triggerError={triggerError}
              fieldName="Tour guiado"
            />
          </FormField>
          <FormField label="Número de Adultos">
            <Input 
              type="text" 
              value={tour.adultsCount} 
              onChange={(e) => {
                let cleaned = e.target.value.replace(/[^0-9]/g, "");
                if (cleaned.length > 3) cleaned = cleaned.slice(0, 3);
                onChange({ adultsCount: cleaned === "" ? ("" as any) : parseInt(cleaned) });
              }} 
            />
          </FormField>
          <FormField label="Número de Niños">
            <Input 
              type="text" 
              value={tour.childrenCount} 
              onChange={(e) => {
                let cleaned = e.target.value.replace(/[^0-9]/g, "");
                if (cleaned.length > 3) cleaned = cleaned.slice(0, 3);
                onChange({ childrenCount: cleaned === "" ? ("" as any) : parseInt(cleaned) });
              }} 
            />
          </FormField>
          <FormField label="Edades de Niños (Opcional)">
            <Input 
              value={tour.childrenAges} 
              onChange={(e) => onChange({ childrenAges: e.target.value })} 
              placeholder="Ej: 5, 8, 12" 
              maxLength={40}
            />
          </FormField>
          <FormField label="Idioma del Guía">
            <Combobox
              value={tour.guideLanguage}
              onChange={(val) => onChange({ guideLanguage: val })}
              options={[
                { value: "español", label: "Español" },
                { value: "inglés", label: "Inglés" },
                { value: "portugués", label: "Portugués" },
                { value: "francés", label: "Francés" },
              ]}
            />
          </FormField>
          <FormField label="Teléfono">
            <Input value={tour.phone} onChange={(e) => onChange({ phone: e.target.value })} placeholder="+57 300 123 4567" />
          </FormField>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="needs-transport"
              checked={tour.needsTransport}
              onChange={(e) => onChange({ needsTransport: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="needs-transport" className="text-sm font-medium text-gray-700">
              Requiere Transporte
            </label>
          </div>
          <FormField label="Punto de Recogida">
            <Input 
              value={tour.pickupPoint} 
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, "");
                onChange({ pickupPoint: cleaned });
              }} 
              placeholder="Hotel, Aeropuerto, etc." 
              maxLength={30}
            />
          </FormField>
          <FormField label="Condiciones Médicas">
            <Textarea value={tour.medicalConditions} onChange={(e) => onChange({ medicalConditions: e.target.value })} placeholder="Alergias, enfermedades, etc." rows={2} />
          </FormField>
          <FormField label="Observaciones">
            <Textarea value={tour.observations} onChange={(e) => onChange({ observations: e.target.value })} placeholder="Notas adicionales del tour..." rows={2} />
          </FormField>
        </div>
      </div>

      <FinancialSection 
        supplierName={tour.supplierName}
        supplierCost={tour.supplierCost}
        supplierPaymentMethod={tour.supplierPaymentMethod}
        isPaymentMethodRequired={true}
        paymentMethods={paymentMethods}
        ta={tour.ta}
        suppliers={suppliers}
        onChange={(updates) => onChange(updates)}
      />

      <VoucherField 
        voucher={tour.voucher} 
        sendVoucher={tour.sendVoucher} 
        onChange={(updates) => onChange(updates)} 
      />
    </div>
  );
}