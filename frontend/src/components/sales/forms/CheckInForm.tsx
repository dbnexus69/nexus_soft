import { LuPlane } from "react-icons/lu";
import { FormField, Input, Combobox , CurrencyInput} from "../../ui/Form";
import { CheckInData } from "../../../types";
import { ClientInfoSection, VoucherField, FinancialSection } from "./VoucherField";
import { DateTimePicker } from "./TicketForm";

interface CheckInFormProps {
  checkIn: CheckInData;
  client: any;
  suppliers?: any[];
  baggage?: any[];
  paymentMethods?: any[];
  onChange: (updates: Partial<CheckInData>) => void;
  triggerError?: (msg: string) => void;
}

export function CheckInForm({ checkIn, client, suppliers, baggage, paymentMethods, onChange, triggerError }: CheckInFormProps) {
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
          <LuPlane size={14} /> Gestión de Check-in
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nombre del Pasajero">
            <Input value={checkIn.passengerName} onChange={(e) => onChange({ passengerName: e.target.value })} placeholder="Nombre completo" />
          </FormField>
          <div className="grid grid-cols-3 gap-2">
            <FormField label="Tipo Doc" className="col-span-1">
              <Combobox
                value={checkIn.docType}
                onChange={(val) => onChange({ docType: val })}
                options={[
                  { value: "CC", label: "C.C." },
                  { value: "CE", label: "C.E." },
                  { value: "PP", label: "P.P." },
                ]}
              />
            </FormField>
            <FormField label="Nº Documento" className="col-span-2">
              <Input value={checkIn.docNumber} onChange={(e) => onChange({ docNumber: e.target.value })} placeholder="Número" />
            </FormField>
          </div>
          <FormField label="Vuelo o Reserva">
            <Input 
              value={checkIn.flightOrReservation} 
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                onChange({ flightOrReservation: cleaned });
              }} 
              placeholder="Ej: AV123 o XYZ789" 
              maxLength={8}
            />
          </FormField>
          <FormField label="Fecha de Viaje">
            <DateTimePicker
              value={checkIn.travelDate}
              onChange={(val) => onChange({ travelDate: val })}
              min={minDateTime}
              triggerError={triggerError}
              fieldName="Viaje del check-in"
            />
          </FormField>
          <FormField label="Silla Preferida">
            <Input 
              value={checkIn.seat} 
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                onChange({ seat: cleaned });
              }} 
              placeholder="Ej: 12A" 
              maxLength={10}
            />
          </FormField>
          <FormField label="Equipaje">
            <Combobox
              value={checkIn.baggage}
              onChange={(val) => onChange({ baggage: val })}
              options={baggage && baggage.length > 0 ? baggage.map((b: any) => ({
                value: `${b.airlineName} - ${b.fareType}`,
                label: `${b.airlineName} - ${b.fareType}`
              })) : [
                { value: "Solo Artículo Personal", label: "Solo Artículo Personal" },
                { value: "Maleta de Mano (10kg)", label: "Maleta de Mano (10kg)" },
                { value: "Bodega (23kg)", label: "Bodega (23kg)" },
              ]}
            />
          </FormField>
          <FormField label="Celular">
            <Input value={checkIn.phone} onChange={(e) => onChange({ phone: e.target.value })} placeholder="+57 300 123 4567" />
          </FormField>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="wheelchair"
              checked={checkIn.needsWheelchair}
              onChange={(e) => onChange({ needsWheelchair: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="wheelchair" className="text-sm font-medium text-gray-700">
              Requiere Silla de Ruedas
            </label>
          </div>
          <FormField label="Observaciones Especiales" className="md:col-span-2">
            <Input value={checkIn.specialNeeds} onChange={(e) => onChange({ specialNeeds: e.target.value })} placeholder="Alergias, asistencia, etc." />
          </FormField>
        </div>
      </div>

      <FinancialSection 
        supplierName={checkIn.supplierName}
        supplierCost={checkIn.supplierCost}
        supplierPaymentMethod={checkIn.supplierPaymentMethod}
        isPaymentMethodRequired={true}
        paymentMethods={paymentMethods}
        ta={checkIn.ta}
        suppliers={suppliers}
        onChange={(updates) => onChange(updates)}
      />

      <VoucherField 
        voucher={checkIn.voucher} 
        sendVoucher={checkIn.sendVoucher} 
        onChange={(updates) => onChange(updates)} 
      />
    </div>
  );
}