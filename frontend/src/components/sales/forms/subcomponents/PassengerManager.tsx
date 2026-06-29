import React from "react";
import { User, Trash2, PlusCircle } from "lucide-react";
import { FormField, Input, Select } from "../../../ui/Form";

interface Passenger {
  name: string;
  docType: string;
  docNumber: string;
  birthDate: string;
  esTitular?: boolean;
  nroTiquete?: string;
  nroReserva?: string;
  asiento?: string;
}

interface PassengerManagerProps {
  passengers: Passenger[];
  clients: any[];
  onChange: (passengers: Passenger[]) => void;
  documentTypes: any[];
}

export function PassengerManager({ passengers, clients, onChange, documentTypes }: PassengerManagerProps) {
  const addPassenger = () => {
    onChange([...passengers, { 
      name: "", docType: "", docNumber: "", birthDate: "", esTitular: passengers.length === 0 
    }]);
  };

  const removePassenger = (index: number) => {
    if (passengers.length === 1) return;
    const newPax = passengers.filter((_, i) => i !== index);
    if (passengers[index].esTitular && newPax.length > 0) {
      newPax[0].esTitular = true;
    }
    onChange(newPax);
  };

  const updatePassenger = (index: number, field: string, value: any) => {
    const newPax = [...passengers];
    newPax[index] = { ...newPax[index], [field]: value };
    if (field === "esTitular" && value === true) {
      newPax.forEach((p, i) => { if (i !== index) p.esTitular = false; });
    }
    onChange(newPax);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          Pasajeros
        </h3>
        <button
          type="button"
          onClick={addPassenger}
          className="text-primary hover:bg-primary-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
        >
          <PlusCircle className="w-4 h-4" />
          Agregar Pasajero
        </button>
      </div>
      
      {passengers.map((pax, idx) => (
        <div key={idx} className="bg-gray-50/50 p-4 rounded-xl space-y-4 border border-gray-100">
           {/* Formulario extraído */}
           <div className="flex items-center gap-2">
             <span className="font-medium">Pasajero {idx + 1}</span>
             {pax.esTitular && <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">Titular</span>}
             <button type="button" onClick={() => removePassenger(idx)} className="ml-auto text-red-500 hover:text-red-700">
               <Trash2 className="w-4 h-4" />
             </button>
           </div>
           <div className="grid grid-cols-2 gap-4">
             <FormField label="Nombre Completo">
               <Input value={pax.name} onChange={(e) => updatePassenger(idx, "name", e.target.value)} />
             </FormField>
             <FormField label="Documento">
               <Input value={pax.docNumber} onChange={(e) => updatePassenger(idx, "docNumber", e.target.value)} />
             </FormField>
           </div>
        </div>
      ))}
    </div>
  );
}
