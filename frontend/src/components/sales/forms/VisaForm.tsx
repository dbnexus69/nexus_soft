import { LuGlobe } from "react-icons/lu";
import { FormField, Input, Combobox , CurrencyInput} from "../../ui/Form";
import { VisaData } from "../../../types";
import { ClientInfoSection, VoucherField, FinancialSection } from "./VoucherField";
import { DatePicker } from "./TicketForm";

interface VisaFormProps {
  visa: VisaData;
  client: any;
  suppliers?: any[];
  paymentMethods?: any[];
  onChange: (updates: Partial<VisaData>) => void;
  triggerError?: (msg: string) => void;
}

export function VisaForm({ visa, client, suppliers, paymentMethods, onChange, triggerError }: VisaFormProps) {
  const todayStr = new Date().toISOString().slice(0, 10);
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
            <DatePicker
              value={visa.birthDate}
              onChange={(val) => onChange({ birthDate: val })}
              max={todayStr}
              triggerError={triggerError}
              fieldName="Nacimiento del solicitante"
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
          <FormField label="Tipo de Documento">
            <Combobox
              value={visa.docType || "CC"}
              onChange={(val) => onChange({ docType: val, docNumber: "" })}
              options={[
                { value: "CC", label: "Cédula de Ciudadanía" },
                { value: "TI", label: "Tarjeta de Identidad" },
                { value: "CE", label: "Cédula de Extranjería" },
                { value: "Pasaporte", label: "Pasaporte" },
                { value: "Otro", label: "Otro Documento" },
              ]}
            />
          </FormField>
          <FormField label="Número de Documento">
            <div className="relative pb-5">
              <Input 
                value={visa.docNumber} 
                onChange={(e) => {
                  let cleaned = e.target.value;
                  if (visa.docType === "CC" || visa.docType === "TI") {
                    cleaned = cleaned.replace(/[^0-9]/g, "");
                  } else {
                    cleaned = cleaned.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                  }
                  onChange({ docNumber: cleaned });
                }} 
                placeholder={visa.docType === "Pasaporte" ? "N° Pasaporte" : "Número de documento"} 
                maxLength={20}
              />
              {visa.docNumber !== undefined && visa.docNumber.length > 0 && visa.docNumber.length < 5 && (
                <p className="text-amber-500 text-xs mt-1 absolute bottom-0 left-0">⚠️ Mínimo 5 caracteres</p>
              )}
            </div>
          </FormField>
          <FormField label="Vencimiento de Documento">
            <DatePicker
              value={visa.passportExpiration}
              onChange={(val) => onChange({ passportExpiration: val })}
              min={todayStr}
              triggerError={triggerError}
              fieldName="Vencimiento del documento"
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
            <DatePicker
              value={visa.estimatedTravelDate}
              onChange={(val) => onChange({ estimatedTravelDate: val })}
              min={todayStr}
              triggerError={triggerError}
              fieldName="Estimación de viaje"
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
        supplierPaymentMethod={visa.supplierPaymentMethod}
        isPaymentMethodRequired={false}
        paymentMethods={paymentMethods}
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