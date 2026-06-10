import { LuDog } from "react-icons/lu";
import { FormField, Input, Combobox, Textarea , CurrencyInput} from "../../ui/Form";
import { PetServiceData } from "../../../types";
import { ClientInfoSection, VoucherField, FinancialSection } from "./VoucherField";
import { DatePicker } from "./TicketForm";

interface PetServiceFormProps {
  pet: PetServiceData;
  client: any;
  suppliers?: any[];
  paymentMethods?: any[];
  onChange: (updates: Partial<PetServiceData>) => void;
  triggerError?: (msg: string) => void;
}

export function PetServiceForm({ pet, client, suppliers, paymentMethods, onChange, triggerError }: PetServiceFormProps) {
  const todayStr = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-6 animate-fade-in">
      {client && <ClientInfoSection client={client} />}

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
        <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
          <LuDog size={14} /> Transporte de Mascotas
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <FormField label="Nombre del Dueño">
            <Input 
              value={pet.ownerName} 
              onChange={(e) => {
                let cleaned = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");
                if (cleaned.length > 0) {
                  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
                }
                onChange({ ownerName: cleaned });
              }} 
              placeholder="Nombre completo" 
              maxLength={50}
            />
          </FormField>
          <FormField label="Nombre de la Mascota">
            <Input 
              value={pet.petName} 
              onChange={(e) => {
                let cleaned = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");
                if (cleaned.length > 0) {
                  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
                }
                onChange({ petName: cleaned });
              }} 
              placeholder="Nombre de la mascota" 
              maxLength={30}
            />
          </FormField>
          <FormField label="Especie">
            <Combobox
              value={pet.species}
              onChange={(val) => onChange({ species: val })}
              options={[
                { value: "perro", label: "Perro" },
                { value: "gato", label: "Gato" },
                { value: "ave", label: "Ave" },
                { value: "otro", label: "Otro" },
              ]}
            />
          </FormField>
          <FormField label="Raza">
            <Input 
              value={pet.breed} 
              onChange={(e) => {
                let cleaned = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");
                if (cleaned.length > 0) {
                  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
                }
                onChange({ breed: cleaned });
              }} 
              placeholder="Ej: Labrador, Persa" 
              maxLength={30}
            />
          </FormField>
          <FormField label="Peso (kg)">
            <Input 
              type="number" 
              value={pet.weight || ""} 
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0 && val <= 999.9) {
                  onChange({ weight: val });
                } else if (e.target.value === "") {
                  onChange({ weight: 0 });
                }
              }} 
              placeholder="0.0" 
              min={0}
              max={999}
            />
          </FormField>
          <FormField label="Tamaño">
            <Combobox
              value={pet.size}
              onChange={(val) => onChange({ size: val })}
              options={[
                { value: "pequeño", label: "Pequeño" },
                { value: "mediano", label: "Mediano" },
                { value: "grande", label: "Grande" },
                { value: "gigante", label: "Gigante" },
              ]}
            />
          </FormField>
          <FormField label="Tipo de Viaje">
            <Combobox
              value={pet.travelType}
              onChange={(val) => onChange({ travelType: val })}
              options={[
                { value: "cabina", label: "En Cabina" },
                { value: "bodega", label: "En Bodega" },
                { value: "terrestre", label: "Terrestre" },
              ]}
            />
          </FormField>
          <FormField label="Fecha de Viaje">
            <DatePicker
              value={pet.travelDate}
              onChange={(val) => onChange({ travelDate: val })}
              min={todayStr}
              triggerError={triggerError}
              fieldName="Viaje de la mascota"
            />
          </FormField>
          <FormField label="País Destino">
            <Input 
              value={pet.destinationCountry} 
              onChange={(e) => {
                let cleaned = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");
                if (cleaned.length > 0) {
                  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
                }
                onChange({ destinationCountry: cleaned });
              }} 
              placeholder="País de destino" 
              maxLength={30}
            />
          </FormField>
          <FormField label="Teléfono">
            <Input 
              value={pet.phone} 
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[a-zA-Z]/g, "");
                onChange({ phone: cleaned });
              }} 
              placeholder="+57 300 123 4567" 
              maxLength={15}
            />
          </FormField>
          <FormField label="Nombre de la Empresa">
            <div className="relative pb-5">
              <Input 
                value={pet.transportCompany || ""} 
                onChange={(e) => {
                  let cleaned = e.target.value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, "");
                  onChange({ transportCompany: cleaned });
                }} 
                placeholder="Ej: Pet Airways" 
                maxLength={40}
              />
              {pet.transportCompany !== undefined && pet.transportCompany.length > 0 && pet.transportCompany.length < 3 && (
                <p className="text-amber-500 text-xs mt-1 absolute bottom-0 left-0">⚠️ Mínimo 3 caracteres</p>
              )}
            </div>
          </FormField>
          <FormField label="Condiciones Médicas">
            <Textarea 
              value={pet.medicalConditions} 
              onChange={(e) => onChange({ medicalConditions: e.target.value })} 
              placeholder="Alergias, medicamentos, etc." 
              rows={2} 
              maxLength={100}
            />
          </FormField>
          <FormField label="Observaciones">
            <Textarea 
              value={pet.observations || ""} 
              onChange={(e) => onChange({ observations: e.target.value })} 
              placeholder="Anotaciones adicionales..." 
              rows={2} 
            />
          </FormField>
        </div>
      </div>

      <FinancialSection 
        supplierName={pet.supplierName}
        supplierCost={pet.supplierCost}
        supplierPaymentMethod={pet.supplierPaymentMethod}
        isPaymentMethodRequired={true}
        paymentMethods={paymentMethods}
        ta={pet.ta}
        suppliers={suppliers}
        onChange={(updates) => onChange(updates)}
      />

      <VoucherField 
        voucher={pet.voucher} 
        sendVoucher={pet.sendVoucher} 
        onChange={(updates) => onChange(updates)} 
      />
    </div>
  );
}