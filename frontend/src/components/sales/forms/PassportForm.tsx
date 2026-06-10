import { LuBookOpen } from "react-icons/lu";
import { FormField, Input, Combobox , CurrencyInput} from "../../ui/Form";
import { PassportData } from "../../../types";
import { ClientInfoSection, VoucherField, FinancialSection } from "./VoucherField";
import { DatePicker } from "./TicketForm";

interface PassportFormProps {
  passport: PassportData;
  client: any;
  suppliers?: any[];
  paymentMethods?: any[];
  onChange: (updates: Partial<PassportData>) => void;
  triggerError?: (msg: string) => void;
}

export function PassportForm({ passport, client, suppliers, paymentMethods, onChange, triggerError }: PassportFormProps) {
  const todayStr = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-6 animate-fade-in">
      {client && <ClientInfoSection client={client} />}

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
        <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
          <LuBookOpen size={14} /> Trámite de Pasaporte
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nombre Completo">
            <Input value={passport.fullName} onChange={(e) => onChange({ fullName: e.target.value })} placeholder="Como aparece en el ID" />
          </FormField>
          <FormField label="Número de Identificación">
            <Input value={passport.idNumber} onChange={(e) => onChange({ idNumber: e.target.value })} placeholder="Número de documento" />
          </FormField>
          <FormField label="Fecha de Nacimiento">
            <DatePicker
              value={passport.birthDate}
              onChange={(val) => onChange({ birthDate: val })}
              max={todayStr}
              triggerError={triggerError}
              fieldName="Nacimiento del solicitante"
            />
          </FormField>
          <FormField label="Ciudad de Residencia">
            <Input 
              value={passport.residenceCity} 
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");
                onChange({ residenceCity: cleaned });
              }} 
              placeholder="Ciudad actual" 
              maxLength={85}
            />
          </FormField>
          <FormField label="Tipo de Trámite">
            <Combobox
              value={passport.processType}
              onChange={(val) => onChange({ processType: val })}
              options={[
                { value: "primera vez", label: "Primera Vez" },
                { value: "renovación", label: "Renovación" },
                { value: "pérdida", label: "Por Pérdida" },
                { value: "deterioro", label: "Por Deterioro" },
              ]}
            />
          </FormField>
          <FormField label="Fecha Estimada de Viaje">
            <DatePicker
              value={passport.estimatedTravelDate}
              onChange={(val) => onChange({ estimatedTravelDate: val })}
              min={todayStr}
              triggerError={triggerError}
              fieldName="Estimación de viaje"
            />
          </FormField>
          <FormField label="Teléfono de Contacto" className="md:col-span-2">
            <Input 
              value={passport.phone} 
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[a-zA-Z]/g, "");
                onChange({ phone: cleaned });
              }} 
              placeholder="+57 300 123 4567" 
              maxLength={15}
            />
          </FormField>
        </div>
      </div>

      <FinancialSection 
        supplierName={passport.supplierName}
        supplierCost={passport.supplierCost}
        supplierPaymentMethod={passport.supplierPaymentMethod}
        isPaymentMethodRequired={false}
        paymentMethods={paymentMethods}
        ta={passport.ta}
        suppliers={suppliers}
        onChange={(updates) => onChange(updates)}
      />

      <VoucherField 
        voucher={passport.voucher} 
        sendVoucher={passport.sendVoucher} 
        onChange={(updates) => onChange(updates)} 
      />
    </div>
  );
}