import { LuUtensils } from "react-icons/lu";
import { FormField, Input, Combobox , CurrencyInput} from "../../ui/Form";
import { RestaurantData } from "../../../types";
import { ClientInfoSection, VoucherField, FinancialSection } from "./VoucherField";
import { DateTimePicker } from "./TicketForm";

interface RestaurantFormProps {
  restaurant: RestaurantData;
  client: any;
  suppliers?: any[];
  paymentMethods?: any[];
  onChange: (updates: Partial<RestaurantData>) => void;
  triggerError?: (msg: string) => void;
}

export function RestaurantForm({ restaurant, client, suppliers, paymentMethods, onChange, triggerError }: RestaurantFormProps) {
  const minDateTime = (() => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  })();
  const toggleRestriction = (res: string) => {
    const current = restaurant.dietaryRestrictions;
    const next = current.includes(res) ? current.filter((i) => i !== res) : [...current, res];
    onChange({ dietaryRestrictions: next });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {client && <ClientInfoSection client={client} />}

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
        <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
          <LuUtensils size={14} /> Reserva de Restaurante
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nombre de la Reserva *">
            <Input value={restaurant.reservationName} onChange={(e) => onChange({ reservationName: e.target.value })} placeholder="A nombre de..." />
          </FormField>
          <FormField label="Fecha y Hora *">
            <DateTimePicker
              value={restaurant.dateTime}
              onChange={(val) => onChange({ dateTime: val })}
              min={minDateTime}
              triggerError={triggerError}
              fieldName="Reserva de restaurante"
            />
          </FormField>
          <FormField label="Nº de Personas *">
            <Input 
              type="text" 
              value={restaurant.peopleCount} 
              onChange={(e) => {
                let cleaned = e.target.value.replace(/[^0-9]/g, "");
                if (cleaned.length > 3) cleaned = cleaned.slice(0, 3);
                onChange({ peopleCount: cleaned === "" ? ("" as any) : parseInt(cleaned) });
              }} 
            />
          </FormField>
          <FormField label="Preferencia de Mesa">
            <Input 
              value={restaurant.tablePreference} 
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, "");
                onChange({ tablePreference: cleaned });
              }} 
              placeholder="Ej: Terraza, Ventana" 
              maxLength={30}
            />
          </FormField>
          <FormField label="Tipo de Menú">
            <Input 
              value={restaurant.menuType} 
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, "");
                onChange({ menuType: cleaned });
              }} 
              placeholder="Ej: A la carta, Menú fijo" 
              maxLength={30}
            />
          </FormField>
          <FormField label="Ocasión Especial">
            <Combobox
              value={restaurant.specialOccasion}
              onChange={(val) => onChange({ specialOccasion: val })}
              options={[
                { value: "cumpleaños", label: "Cumpleaños" },
                { value: "aniversario", label: "Aniversario" },
                { value: "cena negocio", label: "Cena de Negocios" },
                { value: "otro", label: "Otro" },
              ]}
            />
          </FormField>
          <FormField label="Celular *">
            <Input type="tel" value={restaurant.phone} onChange={(e) => onChange({ phone: e.target.value })} placeholder="+57 300 123 4567" />
          </FormField>
          <div className="md:col-span-2 space-y-3">
            <label className="text-sm font-medium text-gray-700">Restricciones Alimentarias</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {["Vegano", "Sin Gluten", "Halal", "Lactosa", "Nueces", "Mariscos"].map((res) => (
                <label key={res} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-100 cursor-pointer hover:border-primary/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={restaurant.dietaryRestrictions.includes(res)}
                    onChange={() => toggleRestriction(res)}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span className="text-xs text-gray-600">{res}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <FinancialSection 
        supplierName={restaurant.supplierName}
        supplierCost={restaurant.supplierCost}
        supplierPaymentMethod={restaurant.supplierPaymentMethod}
        isPaymentMethodRequired={false}
        paymentMethods={paymentMethods}
        ta={restaurant.ta}
        suppliers={suppliers}
        onChange={(updates) => onChange(updates)}
      />

      <VoucherField 
        voucher={restaurant.voucher} 
        sendVoucher={restaurant.sendVoucher} 
        onChange={(updates) => onChange(updates)} 
      />
    </div>
  );
}