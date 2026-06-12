import { LuSmartphone } from "react-icons/lu";
import { FormField, Input, Combobox , CurrencyInput} from "../../ui/Form";
import { SimCardData } from "../../../types";
import { ClientInfoSection, VoucherField, FinancialSection } from "./VoucherField";
import { DateTimePicker } from "./TicketForm";

interface SimCardFormProps {
  sim: SimCardData;
  client: any;
  suppliers?: any[];
  paymentMethods?: any[];
  onChange: (updates: Partial<SimCardData>) => void;
  triggerError?: (msg: string) => void;
}

export function SimCardForm({ sim, client, suppliers, paymentMethods, onChange, triggerError }: SimCardFormProps) {
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
          <LuSmartphone size={14} /> Configuración de SIM Card
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nombre del Titular">
            <Input value={sim.passengerName} onChange={(e) => onChange({ passengerName: e.target.value })} placeholder="Nombre completo" />
          </FormField>
          <FormField label="Número de Documento">
            <Input value={sim.docNumber} onChange={(e) => onChange({ docNumber: e.target.value })} placeholder="C.C. o Pasaporte" />
          </FormField>
          <FormField label="País de Destino">
            <Input 
              value={sim.destinationCountry} 
              onChange={(e) => {
                let cleaned = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");
                if (cleaned.length > 0) {
                  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
                }
                onChange({ destinationCountry: cleaned });
              }} 
              placeholder="Ej: España, USA" 
            />
          </FormField>
          <FormField label="Fecha y Hora de Llegada">
            <DateTimePicker
              value={sim.arrivalDate}
              onChange={(val) => onChange({ arrivalDate: val })}
              min={minDateTime}
              triggerError={triggerError}
              fieldName="Llegada de la SIM card"
            />
          </FormField>
          <FormField label="Duración del Viaje (Días)">
            <Input 
              type="text" 
              value={sim.tripDuration} 
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^0-9]/g, "");
                onChange({ tripDuration: cleaned });
              }} 
              placeholder="Ej: 15" 
            />
          </FormField>
          <FormField label="Plan de Datos">
            <Input value={sim.dataPlan} onChange={(e) => onChange({ dataPlan: e.target.value })} placeholder="Ej: 10GB, Ilimitado" />
          </FormField>
          <FormField label="Tipo de SIM">
            <Combobox
              value={sim.simType}
              onChange={(val) => onChange({ simType: val })}
              options={[
                { value: "Física", label: "SIM Física (Chip)" },
                { value: "eSIM", label: "eSIM (Digital)" },
                { value: "MicroSIM", label: "Micro SIM" },
                { value: "NanoSIM", label: "Nano SIM" },
              ]}
            />
          </FormField>
          <FormField label="Método de Entrega">
            <Combobox
              value={sim.deliveryMethod}
              onChange={(val) => onChange({ deliveryMethod: val })}
              options={[
                { value: "Correo Electrónico", label: "Correo Electrónico (Solo eSIM)" },
                { value: "Domicilio", label: "Envío a Domicilio" },
                { value: "Recogida en Oficina", label: "Recogida en Oficina" },
                { value: "Aeropuerto", label: "Entrega en Aeropuerto" },
              ]}
            />
          </FormField>
          <FormField label="Correo Electrónico" className="md:col-span-2">
            <Input 
              type="email" 
              value={sim.email} 
              onChange={(e) => {
                let val = e.target.value;
                if (val.includes(".com")) {
                  val = val.substring(0, val.indexOf(".com") + 4);
                }
                onChange({ email: val.trim() });
              }} 
              placeholder="ejemplo@correo.com" 
            />
          </FormField>
        </div>
      </div>

      <FinancialSection 
        supplierName={sim.supplierName}
        supplierCost={sim.supplierCost}
        supplierPaymentMethod={sim.supplierPaymentMethod}
        isPaymentMethodRequired={true}
        paymentMethods={paymentMethods}
        ta={sim.ta}
        suppliers={suppliers}
        onChange={(updates) => onChange(updates)}
      />

      <VoucherField 
        voucher={sim.voucher} 
        sendVoucher={sim.sendVoucher} 
        onChange={(updates) => onChange(updates)} 
      />
    </div>
  );
}