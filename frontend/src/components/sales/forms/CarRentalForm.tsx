import { Car } from "lucide-react";
import { FormField, Input, Combobox , CurrencyInput} from "../../ui/Form";
import { CarRentalData } from "../../../types";
import { ClientInfoSection, VoucherField, FinancialSection } from "./VoucherField";
import { DateTimePicker } from "./TicketForm";

interface CarRentalFormProps {
  car: CarRentalData;
  client: any;
  suppliers?: any[];
  paymentMethods?: any[];
  onChange: (updates: Partial<CarRentalData>) => void;
  triggerError?: (msg: string) => void;
}

export function CarRentalForm({ car, client, suppliers, paymentMethods, onChange, triggerError }: CarRentalFormProps) {
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
          <Car size={14} /> Renta de Vehículo
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Conductor Principal">
            <Input
              value={car.mainDriver}
              onChange={(e) => onChange({ mainDriver: e.target.value })}
              placeholder="Nombre completo"
            />
          </FormField>
          <FormField label="Número de Licencia">
            <Input
              value={car.licenseNumber}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^a-zA-Z0-9\-\s]/g, "").toUpperCase();
                onChange({ licenseNumber: cleaned });
              }}
              placeholder="Ej: A123-4567"
            />
          </FormField>
          <FormField label="Recogida (Fecha y Hora)">
            <DateTimePicker
              value={car.pickupDate}
              onChange={(val) => onChange({ pickupDate: val })}
              min={minDateTime}
              triggerError={triggerError}
              fieldName="Recogida del vehículo"
            />
          </FormField>
          <FormField label="Devolución (Fecha y Hora)">
            <DateTimePicker
              value={car.returnDate}
              onChange={(val) => onChange({ returnDate: val })}
              min={minDateTime}
              triggerError={triggerError}
              fieldName="Devolución del vehículo"
            />
          </FormField>
          <FormField label="Lugar de Recogida">
            <Combobox
              value={car.pickupLocation}
              onChange={(val) => onChange({ pickupLocation: val })}
              options={[
                { value: "Aeropuerto", label: "Aeropuerto" },
                { value: "Hotel", label: "Hotel" },
                { value: "Oficina", label: "Oficina" },
                { value: "Domicilio", label: "Domicilio" },
              ]}
            />
          </FormField>
          <FormField label="Categoría de Vehículo">
            <Combobox
              value={car.vehicleCategory}
              onChange={(val) => onChange({ vehicleCategory: val })}
              options={[
                { value: "compacto", label: "Compacto" },
                { value: "sedán", label: "Sedán" },
                { value: "suv", label: "SUV" },
                { value: "van", label: "Van" },
                { value: "lujo", label: "Lujo" },
              ]}
            />
          </FormField>
          <FormField label="Conductores Adicionales">
            <Input
              type="text"
              value={car.additionalDrivers}
              onChange={(e) => {
                let cleaned = e.target.value.replace(/[^0-9]/g, "");
                if (cleaned !== "" && Number(cleaned) > 10) cleaned = "10";
                onChange({ additionalDrivers: cleaned === "" ? ("" as any) : parseInt(cleaned) });
              }}
              placeholder="0 a 10"
            />
          </FormField>
          <FormField label="Tipo de Seguro">
            <Combobox
              value={car.insuranceType}
              onChange={(val) =>
                onChange({ insuranceType: val as "basic" | "all_risk" })
              }
              options={[
                { value: "basic", label: "Básico" },
                { value: "all_risk", label: "Todo Riesgo" },
              ]}
            />
          </FormField>
          <FormField label="Tarjeta de Garantía">
            <Input
              value={car.guaranteeCreditCard}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                onChange({ guaranteeCreditCard: cleaned });
              }}
              placeholder="Últimos 4 dígitos"
              maxLength={4}
            />
          </FormField>
        </div>
      </div>

      <FinancialSection 
        supplierName={car.supplierName}
        supplierCost={car.supplierCost}
        supplierPaymentMethod={car.supplierPaymentMethod}
        isPaymentMethodRequired={true}
        paymentMethods={paymentMethods}
        ta={car.ta}
        suppliers={suppliers}
        onChange={(updates) => onChange(updates)}
      />

      <VoucherField 
        voucher={car.voucher} 
        sendVoucher={car.sendVoucher} 
        onChange={(updates) => onChange(updates)} 
      />
    </div>
  );
}
