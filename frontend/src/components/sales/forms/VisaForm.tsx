import { LuGlobe } from "react-icons/lu";
import { FormField, Input, Combobox , CurrencyInput} from "../../ui/Form";
import { VisaData } from "../../../types";
import { ClientInfoSection, VoucherField, FinancialSection } from "./VoucherField";

interface VisaFormProps {
  visa: VisaData;
  client: any;
  suppliers?: any[];
  onChange: (updates: Partial<VisaData>) => void;
}

export function VisaForm({ visa, client, suppliers, onChange }: VisaFormProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {client && <ClientInfoSection client={client} />}

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
        <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
          <LuGlobe size={14} /> Solicitud de Visa
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nombre Completo">
            <Input value={visa.fullName} onChange={(e) => onChange({ fullName: e.target.value })} placeholder="Como aparece en el pasaporte" />
          </FormField>
          <FormField label="Fecha de Nacimiento">
            <Input 
              type="date" 
              required 
              max={new Date().toISOString().slice(0, 10)} 
              value={visa.birthDate} 
              onChange={(e) => onChange({ birthDate: e.target.value })} 
            />
          </FormField>
          <FormField label="Nacionalidad">
            <Input 
              value={visa.nationality} 
              onChange={(e) => {
                let cleaned = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");
                if (cleaned.length > 0) {
                  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
                }
                onChange({ nationality: cleaned });
              }} 
              placeholder="Ej: Colombiana" 
              maxLength={30}
            />
          </FormField>
          <FormField label="Número de Pasaporte">
            <Input 
              value={visa.passportNumber} 
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                onChange({ passportNumber: cleaned });
              }} 
              placeholder="Número de pasaporte" 
              maxLength={20}
            />
          </FormField>
          <FormField label="Vencimiento Pasaporte">
            <Input 
              type="date" 
              required 
              min={new Date().toISOString().slice(0, 10)} 
              value={visa.passportExpiration} 
              onChange={(e) => onChange({ passportExpiration: e.target.value })} 
            />
          </FormField>
          <FormField label="País al que aplica">
            <Input 
              value={visa.countryApplying} 
              onChange={(e) => {
                let cleaned = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");
                if (cleaned.length > 0) {
                  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
                }
                onChange({ countryApplying: cleaned });
              }} 
              placeholder="Ej: USA, Canadá, China" 
              maxLength={30}
            />
          </FormField>
          <FormField label="Tipo de Visa">
            <Combobox
              value={visa.visaType}
              onChange={(val) => onChange({ visaType: val })}
              options={[
                { value: "turista", label: "Turismo" },
                { value: "negocios", label: "Negocios" },
                { value: "estudiante", label: "Estudio" },
                { value: "trabajo", label: "Trabajo" },
                { value: "tránsito", label: "Tránsito" },
              ]}
            />
          </FormField>
          <FormField label="Fecha Estimada Viaje">
            <Input 
              type="date" 
              min={new Date().toISOString().slice(0, 10)} 
              value={visa.estimatedTravelDate} 
              onChange={(e) => onChange({ estimatedTravelDate: e.target.value })} 
            />
          </FormField>
          <FormField label="Correo de Contacto" className="md:col-span-2">
            <Input 
              type="email" 
              value={visa.email} 
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
        supplierName={visa.supplierName}
        supplierCost={visa.supplierCost}
        ta={visa.ta}
        suppliers={suppliers}
        onChange={(updates) => onChange(updates)}
      />

      <VoucherField 
        voucher={visa.voucher} 
        sendVoucher={visa.sendVoucher} 
        onChange={(updates) => onChange(updates)} 
      />
    </div>
  );
}