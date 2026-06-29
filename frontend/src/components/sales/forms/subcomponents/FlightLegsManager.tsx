import React from "react";
import { Plane, ArrowRight, ArrowLeftRight, Trash2, PlusCircle, ArrowLeft } from "lucide-react";
import { FormField, Input, Combobox } from "../../../ui/Form";
import Datepicker from "react-tailwindcss-datepicker";
import { FlightLeg } from "../../../../types";

interface FlightLegsManagerProps {
  flightMode: 'one_way' | 'round_trip';
  hasStops: boolean;
  returnHasStops?: boolean;
  legs: FlightLeg[];
  outboundStops?: FlightLeg[];
  returnLeg?: FlightLeg;
  returnStops?: FlightLeg[];
  airports: any[];
  onChange: (field: string, value: any) => void;
}

export function FlightLegsManager(props: FlightLegsManagerProps) {
  const { flightMode, hasStops, legs, airports, onChange } = props;

  const updateLeg = (index: number, updates: Partial<FlightLeg>) => {
    const newLegs = [...legs];
    newLegs[index] = { ...newLegs[index], ...updates };
    onChange("legs", newLegs);
  };

  return (
    <div className="space-y-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <Plane className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Itinerario de Vuelos</h3>
      </div>
      
      {/* Tramos de ida */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Trayecto Principal</h4>
        {legs.map((leg, idx) => (
          <div key={idx} className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <FormField label="Origen">
               <Combobox 
                 options={airports.map(a => ({ value: a.code, label: `${a.city} (${a.code})` }))}
                 value={leg.origin}
                 onChange={(v) => updateLeg(idx, { origin: v })}
               />
            </FormField>
            <FormField label="Destino">
               <Combobox 
                 options={airports.map(a => ({ value: a.code, label: `${a.city} (${a.code})` }))}
                 value={leg.destination}
                 onChange={(v) => updateLeg(idx, { destination: v })}
               />
            </FormField>
            <FormField label="Fecha">
              <Input type="date" value={leg.date} onChange={(e) => updateLeg(idx, { date: e.target.value })} />
            </FormField>
            <FormField label="Vuelo">
              <Input value={leg.flightNumber} onChange={(e) => updateLeg(idx, { flightNumber: e.target.value })} />
            </FormField>
          </div>
        ))}
      </div>
      
      {/* Todo: Lógica de escalas (outboundStops, returnLeg) a conectar en fases posteriores */}
      {flightMode === 'round_trip' && (
         <div className="mt-4 p-4 border border-dashed border-gray-200 rounded-lg text-center text-sm text-gray-500">
           Tramos de Retorno (Renderizado Delegado al Manager)
         </div>
      )}
    </div>
  );
}
