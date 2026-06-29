import React, { useState, useEffect } from "react";
import Datepicker from "react-tailwindcss-datepicker";
import dayjs from "dayjs";
import { Plane, MapPin, User, Briefcase, Trash2, PlusCircle, ArrowRight, ArrowLeftRight, ArrowLeft, Calendar } from "lucide-react";
import { FormField, Input, Combobox, Select, CurrencyInput } from "../../ui/Form";
import { Button } from "../../ui/Button";
import { TicketData, FlightLeg } from "../../../types";
import { PassengerManager } from "./subcomponents/PassengerManager";
import { FlightLegsManager } from "./subcomponents/FlightLegsManager";
import { useData } from "../../../context/DataContext";

interface TicketFormProps {
  ticket: TicketData;
  onChange: (updates: Partial<TicketData>) => void;
  airlines: { name: string }[];
  suppliers: { name: string }[];
  airports: any[];
  paymentMethods: { name: string; lastFourDigits?: string }[];
  baggage: {
    id: number;
    airlineName: string;
    fareType: string;
    personalItem: string;
    carryOn: string;
    checkedBag: string;
    notes: string;
  }[];
  clients: any[];
  triggerError?: (msg: string) => void;
}

const FLIGHT_MODE_TABS = [
  {
    id: "one_way" as const,
    label: "Solo Ida",
    icon: ArrowRight,
    description: "Un único trayecto de origen a destino",
  },
  {
    id: "round_trip" as const,
    label: "Ida y Vuelta",
    icon: ArrowLeftRight,
    description: "Trayecto de ida con regreso incluido",
  },
];

const STOP_TYPE_PILLS = [
  { id: false, label: "Directo", desc: "Sin escalas intermedias" },
  { id: true,  label: "Con Escalas", desc: "Paradas en aeropuertos intermedios" },
];

interface DateTimePickerProps {
  value: string;
  onChange: (val: string) => void;
  min: string;
  triggerError?: (msg: string) => void;
  fieldName: string;
  className?: string;
  popoverDirection?: "up" | "down";
}

export function DateTimePicker({
  value,
  onChange,
  min,
  triggerError,
  fieldName,
  className = "",
  popoverDirection = "up",
}: DateTimePickerProps) {
  const [displayValue, setDisplayValue] = useState("");
  const [showTimePopover, setShowTimePopover] = useState(false);
  const [tempHour, setTempHour] = useState("12");
  const [tempMin, setTempMin] = useState("00");
  const [tempPeriod, setTempPeriod] = useState<"AM" | "PM">("AM");

  const isoToDisplay = (iso: string): string => {
    if (!iso) return "";
    const [datePart, timePart] = iso.split("T");
    if (!datePart) return "";
    const [y, m, d] = datePart.split("-");
    if (!y || !m || !d) return "";
    const time = timePart ? timePart.slice(0, 5) : "00:00";
    
    const [h24Str, minStr] = time.split(":");
    const h24 = parseInt(h24Str, 10);
    const period = h24 >= 12 ? "PM" : "AM";
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    const formattedH12 = String(h12).padStart(2, "0");
    return `${d}/${m}/${y} ${formattedH12}:${minStr} ${period}`;
  };

  const displayToIso = (display: string): string => {
    if (!display || display.length < 19) return "";
    const parts = display.trim().split(" ");
    const datePart = parts[0];
    const timePart = parts[1];
    const period = parts[2];
    if (!datePart || !timePart || !period) return "";
    
    const [d, m, y] = datePart.split("/");
    if (!d || !m || !y || y.length !== 4) return "";
    
    const [h12Str, minStr] = timePart.split(":");
    let hour24 = parseInt(h12Str, 10);
    if (period === "PM" && hour24 < 12) {
      hour24 += 12;
    } else if (period === "AM" && hour24 === 12) {
      hour24 = 0;
    }
    const formattedHour24 = String(hour24).padStart(2, "0");
    return `${y}-${m}-${d}T${formattedHour24}:${minStr}:00-05:00`;
  };

  useEffect(() => {
    if (value) {
      setDisplayValue(isoToDisplay(value));
    } else {
      setDisplayValue("");
    }
  }, [value]);

  const formatAsDateTime = (val: string) => {
    // Buscar si ya escribieron algo de AM o PM al final
    const periodMatch = val.match(/(am|pm|a|p|m)?\s*$/i);
    const periodTyped = periodMatch ? periodMatch[0].toUpperCase().trim() : "";

    const digits = val.replace(/\D/g, "").slice(0, 12);
    let formatted = "";
    if (digits.length > 0) {
      formatted += digits.slice(0, 2);
    }
    if (digits.length > 2) {
      formatted += "/" + digits.slice(2, 4);
    }
    if (digits.length > 4) {
      formatted += "/" + digits.slice(4, 8);
    }
    if (digits.length > 8) {
      formatted += " " + digits.slice(8, 10);
    }
    if (digits.length > 10) {
      formatted += ":" + digits.slice(10, 12);
    }

    if (digits.length >= 12) {
      let finalPeriod = "AM";
      if (periodTyped.includes("P")) {
        finalPeriod = "PM";
      } else if (periodTyped.includes("A")) {
        finalPeriod = "AM";
      } else {
        const existingPeriod = displayValue.split(" ")[2];
        finalPeriod = existingPeriod || "AM";
      }
      formatted += " " + finalPeriod;
    }
    return formatted;
  };

  const validateAndTrigger = (isoVal: string): boolean => {
    return true;
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAsDateTime(e.target.value);
    setDisplayValue(formatted);

    if (formatted.length === 19) {
      const iso = displayToIso(formatted);
      if (iso) {
        if (validateAndTrigger(iso)) {
          onChange(iso);
        } else {
          onChange(min);
          setDisplayValue(isoToDisplay(min));
        }
      }
    }
  };

  const handleBlur = () => {
    if (!displayValue) {
      onChange("");
      return;
    }
    const iso = displayToIso(displayValue);
    if (!iso || displayValue.length < 19) {
      if (triggerError) {
        triggerError(`Fecha incompleta. Se ha restablecido a la fecha mínima.`);
      }
      onChange(min);
      setDisplayValue(isoToDisplay(min));
    } else {
      if (!validateAndTrigger(iso)) {
        onChange(min);
        setDisplayValue(isoToDisplay(min));
      }
    }
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Input visual con mascara */}
      <input
        type="text"
        value={displayValue}
        onChange={handleTextChange}
        onBlur={handleBlur}
        placeholder="DD/MM/AAAA HH:MM"
        className="w-full px-3 py-2 pr-10 border border-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00828a]/50 text-xs bg-white text-gray-700"
      />
      
      {/* Icono de calendario decorativo */}
      <div className="absolute right-2 text-gray-400 p-1 pointer-events-none z-10">
        <Calendar size={15} />
      </div>

      {/* Datepicker de Tailwind CSS invisible superpuesto para disparar el popup (sin overflow-hidden para permitir ver el dropdown) */}
      <div className="absolute right-1 w-8 h-8 z-20 cursor-pointer [&>div]:w-full [&>div]:h-full [&_input]:w-full [&_input]:h-full [&_input]:cursor-pointer [&_input]:opacity-0 [&_input]:absolute [&_input]:inset-0 [&_div.absolute]:right-0 [&_div.absolute]:left-auto">
        <Datepicker
          popoverDirection={popoverDirection}
          asSingle={true}
          useRange={false}
          value={{
            startDate: value ? value.split("T")[0] : null,
            endDate: value ? value.split("T")[0] : null,
          } as any}
          onChange={(newValue: any) => {
            if (newValue && newValue.startDate) {
              const formattedDate = dayjs(newValue.startDate).format("YYYY-MM-DD");
              const currentHour = value ? value.split("T")[1]?.split(":")[0] || "12" : "12";
              const currentMin = value ? value.split("T")[1]?.split(":")[1] || "00" : "00";
              
              // Convertir de 24h a 12h para los estados del selector de hora
              const hour24 = parseInt(currentHour, 10);
              let h12 = hour24 % 12;
              if (h12 === 0) h12 = 12;
              setTempHour(String(h12).padStart(2, "0"));
              setTempMin(currentMin);
              setTempPeriod(hour24 >= 12 ? "PM" : "AM");
              
              const newIso = `${formattedDate}T${currentHour}:${currentMin}:00-05:00`;
              if (validateAndTrigger(newIso)) {
                onChange(newIso);
              } else {
                onChange(min);
              }
              setShowTimePopover(true);
            }
          }}
          inputClassName="w-full h-full cursor-pointer"
          toggleClassName="hidden"
        />
      </div>

      {/* Popover de Selección de Hora */}
      {showTimePopover && (
        <div className={`absolute right-0 bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-50 w-52 text-xs text-gray-700 animate-fade-in ${
          popoverDirection === "up" ? "bottom-full mb-2" : "top-10"
        }`}>
          <div className="font-bold text-center border-b pb-1.5 mb-2 text-primary">
            Elegir Hora
          </div>
          <div className="flex gap-2 justify-center mb-3">
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-gray-400 mb-1">Hora</span>
              <select
                value={tempHour}
                onChange={(e) => setTempHour(e.target.value)}
                className="border rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-[#00828a] focus:outline-none bg-white"
              >
                {Array.from({ length: 12 }).map((_, i) => {
                  const h = String(i + 1).padStart(2, "0");
                  return <option key={h} value={h}>{h}</option>;
                })}
              </select>
            </div>
            <div className="flex items-center pt-4 text-gray-400 font-bold">:</div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-gray-400 mb-1">Minuto</span>
              <select
                value={tempMin}
                onChange={(e) => setTempMin(e.target.value)}
                className="border rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-[#00828a] focus:outline-none bg-white"
              >
                {Array.from({ length: 60 }).map((_, i) => {
                  const m = String(i).padStart(2, "0");
                  return <option key={m} value={m}>{m}</option>;
                })}
              </select>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-gray-400 mb-1">Período</span>
              <select
                value={tempPeriod}
                onChange={(e) => setTempPeriod(e.target.value as "AM" | "PM")}
                className="border rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-[#00828a] focus:outline-none bg-white"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowTimePopover(false)}
              className="flex-1 py-1 rounded bg-gray-100 hover:bg-gray-200 transition-colors font-semibold text-[10px]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                const datePart = value ? value.split("T")[0] : dayjs().format("YYYY-MM-DD");
                
                // Convertir de formato 12h + AM/PM de vuelta a formato militar 24h
                let hour24 = parseInt(tempHour, 10);
                if (tempPeriod === "PM" && hour24 < 12) {
                  hour24 += 12;
                } else if (tempPeriod === "AM" && hour24 === 12) {
                  hour24 = 0;
                }
                const formattedHour24 = String(hour24).padStart(2, "0");

                const newIso = `${datePart}T${formattedHour24}:${tempMin}:00-05:00`;
                if (validateAndTrigger(newIso)) {
                  onChange(newIso);
                } else {
                  onChange(min);
                }
                setShowTimePopover(false);
              }}
              className="flex-1 py-1 rounded bg-[#00828a] text-white hover:bg-[#00828a]/90 transition-colors font-semibold text-[10px]"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface DatePickerProps {
  value: string;
  onChange: (val: string) => void;
  min?: string;
  max?: string;
  triggerError?: (msg: string) => void;
  fieldName: string;
  className?: string;
  popoverDirection?: "up" | "down";
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  triggerError,
  fieldName,
  className = "",
  popoverDirection,
}: DatePickerProps) {
  const [displayValue, setDisplayValue] = useState("");

  const isoToDisplay = (iso: string): string => {
    if (!iso) return "";
    const datePart = iso.split("T")[0];
    const [y, m, d] = datePart.split("-");
    if (!y || !m || !d) return "";
    return `${d}/${m}/${y}`;
  };

  const displayToIso = (display: string): string => {
    if (!display || display.length < 10) return "";
    const [d, m, y] = display.split("/");
    if (!d || !m || !y || y.length !== 4) return "";
    return `${y}-${m}-${d}`;
  };

  useEffect(() => {
    if (value) {
      setDisplayValue(isoToDisplay(value));
    } else {
      setDisplayValue("");
    }
  }, [value]);

  const formatAsDate = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 8);
    let formatted = "";
    if (digits.length > 0) {
      formatted += digits.slice(0, 2);
    }
    if (digits.length > 2) {
      formatted += "/" + digits.slice(2, 4);
    }
    if (digits.length > 4) {
      formatted += "/" + digits.slice(4, 8);
    }
    return formatted;
  };

  const validateAndTrigger = (isoVal: string): boolean => {
    return true;
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAsDate(e.target.value);
    setDisplayValue(formatted);

    if (formatted.length === 10) {
      const iso = displayToIso(formatted);
      if (iso) {
        if (validateAndTrigger(iso)) {
          onChange(iso);
        } else {
          const fallback = min || max || "";
          onChange(fallback);
          setDisplayValue(isoToDisplay(fallback));
        }
      }
    }
  };

  const handleBlur = () => {
    if (!displayValue) {
      onChange("");
      return;
    }
    const iso = displayToIso(displayValue);
    if (!iso || displayValue.length < 10) {
      if (triggerError) {
        triggerError(`Fecha incompleta.`);
      }
      const fallback = min || max || "";
      onChange(fallback);
      setDisplayValue(isoToDisplay(fallback));
    } else {
      if (!validateAndTrigger(iso)) {
        const fallback = min || max || "";
        onChange(fallback);
        setDisplayValue(isoToDisplay(fallback));
      }
    }
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <input
        type="text"
        value={displayValue}
        onChange={handleTextChange}
        onBlur={handleBlur}
        placeholder="DD/MM/AAAA"
        className="w-full px-3 py-2 pr-10 border border-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00828a]/50 text-xs bg-white text-gray-700"
      />
      <div className="absolute right-2 text-gray-400 p-1 pointer-events-none z-10">
        <Calendar size={15} />
      </div>
      <div className="absolute right-1 w-8 h-8 z-20 cursor-pointer [&>div]:w-full [&>div]:h-full [&_input]:w-full [&_input]:h-full [&_input]:cursor-pointer [&_input]:opacity-0 [&_input]:absolute [&_input]:inset-0 [&_div.absolute]:right-0 [&_div.absolute]:left-auto">
        <Datepicker
          popoverDirection={popoverDirection}
          asSingle={true}
          useRange={false}
          value={{
            startDate: value || null,
            endDate: value || null,
          } as any}
          onChange={(newValue: any) => {
            if (newValue && newValue.startDate) {
              const formattedDate = dayjs(newValue.startDate).format("YYYY-MM-DD");
              if (validateAndTrigger(formattedDate)) {
                onChange(formattedDate);
              } else {
                onChange(min || max || "");
              }
            }
          }}
          inputClassName="w-full h-full cursor-pointer"
          toggleClassName="hidden"
        />
      </div>
    </div>
  );
}

export function TicketForm({
  ticket,
  onChange,
  airlines,
  suppliers,
  airports,
  paymentMethods,
  baggage,
  clients,
  mainClient,
  triggerError,
}: TicketFormProps & { mainClient?: any }) {
  const airportOptions = airports.map((a) => ({
    value: a.abbreviation,
    label: `${a.abbreviation} - ${a.name} (${a.location})`,
  }));

  React.useEffect(() => {
    const pax = ticket.passengers || ((ticket as any).passengerInfo ? [{ ...(ticket as any).passengerInfo, esTitular: true, asiento: '', nroReserva: '', nroTiquete: '' }] : []);
    if (pax.length === 0) {
      onChange({
        passengers: [{
          name: mainClient?.name || mainClient ? `${mainClient.firstName} ${mainClient.lastName || ''}`.trim() : '',
          docType: mainClient?.docType || '',
          docNumber: mainClient?.docNumber || '',
          birthDate: mainClient?.birthDate ? mainClient.birthDate.split('T')[0] : '',
          esTitular: true,
          asiento: '',
          nroReserva: '',
          nroTiquete: ''
        }]
      });
    }
  }, [ticket.passengers, (ticket as any).passengerInfo, mainClient]);

  // Obtener fecha y hora actual en la zona horaria local para la validación de min
  const minDateTime = (() => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  })();

  const validateDateInput = (value: string, fieldName: string): boolean => {
    return true;
  };

  /* ─── Legs ─────────────────────────────────────────────────── */
  const updateLeg = (idx: number, updates: Partial<FlightLeg>) => {
    const next = [...ticket.legs];
    next[idx] = { ...next[idx], ...updates };
    onChange({ legs: next });
  };
  const addLeg = () =>
    onChange({ legs: [...ticket.legs, { origin: "", destination: "", flightNumber: "", seat: "", date: "", arrivalDate: "", airline: "", baggagePlan: "" }] });
  const removeLeg = (idx: number) =>
    onChange({ legs: ticket.legs.filter((_, i) => i !== idx) });

  /* ─── Stops ─────────────────────────────────────────────────── */
  const addStop = (type: "outbound" | "return") => {
    const key = type === "outbound" ? "outboundStops" : "returnStops";
    const currentStops = ticket[key] || [];
    onChange({
      [key]: [
        ...currentStops,
        { origin: "", destination: "", flightNumber: "", seat: "", date: "", arrivalDate: "", airline: "", baggagePlan: "" },
      ],
    });
  };
  const updateStop = (
    type: "outbound" | "return",
    idx: number,
    updates: Partial<FlightLeg>
  ) => {
    const key = type === "outbound" ? "outboundStops" : "returnStops";
    const next = [...(ticket[key] || [])];
    next[idx] = { ...next[idx], ...updates };
    onChange({ [key]: next });
  };
  const removeStop = (type: "outbound" | "return", idx: number) => {
    const key = type === "outbound" ? "outboundStops" : "returnStops";
    onChange({ [key]: (ticket[key] || []).filter((_, i) => i !== idx) });
  };

  /* ─── Helpers ─────────────────────────────────────────────── */
  const setFlightMode = (mode: "one_way" | "round_trip") => {
    onChange({ flightMode: mode, returnLeg: undefined, returnStops: [] });
  };

  const isRoundTrip = ticket.flightMode === "round_trip";

  /* ─── Shared stop-list renderer ─────────────────────────── */
  const renderStopList = ({
    type,
    color = "primary",
  }: {
    type: "outbound" | "return";
    color?: "primary" | "blue";
  }) => {
    const stops = type === "outbound" ? ticket.outboundStops : ticket.returnStops;
    const colorMap = {
      primary: {
        title: "text-primary",
        btn: "text-primary bg-primary/5 hover:bg-primary/10",
        empty: "text-gray-400",
      },
      blue: {
        title: "text-blue-600",
        btn: "text-blue-600 bg-blue-50 hover:bg-blue-100",
        empty: "text-blue-400/60",
      },
    };
    const c = colorMap[color];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${c.title}`}>
            <MapPin size={11} />
            Escalas {type === "outbound" ? "de Ida" : "de Vuelta"}
          </span>
          <button
            type="button"
            onClick={() => addStop(type)}
            className={`flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-md transition-colors ${c.btn}`}
          >
            <PlusCircle size={10} /> Añadir Escala
          </button>
        </div>
        <div className="space-y-4">
          {(stops || []).map((stop, sIdx) => (
            <div
              key={sIdx}
              className={`p-4 rounded-xl border relative group transition-all duration-200 ${
                color === "primary"
                  ? "bg-primary/5/10 border-primary/20 hover:border-primary/40 bg-white"
                  : "bg-blue-50/30 border-blue-100 hover:border-blue-300 bg-white"
              }`}
            >
              <div className="absolute -top-2.5 left-3 bg-white px-2 py-0.5 rounded-full border border-gray-150 shadow-sm flex items-center gap-1">
                <span className={`text-[9px] font-extrabold uppercase tracking-wide ${color === "primary" ? "text-primary" : "text-blue-600"}`}>
                  Escala #{sIdx + 1}
                </span>
              </div>
              
              <button
                type="button"
                onClick={() => removeStop(type, sIdx)}
                className="absolute -top-2.5 right-3 bg-red-50 text-red-500 border border-red-100 rounded-full p-1 hover:bg-red-100 transition-colors shadow-sm"
                title="Eliminar Escala"
              >
                <Trash2 size={11} />
              </button>

              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <FormField label={<span>Origen <span className="text-red-500">*</span></span>}>
                    <Combobox
                      value={stop.origin || ""}
                      onChange={(val) => updateStop(type, sIdx, { origin: val })}
                      options={airportOptions}
                      placeholder="BOG"
                      className="text-xs"
                    />
                  </FormField>
                  
                  <FormField label={<span>Destino <span className="text-red-500">*</span></span>}>
                    <Combobox
                      value={stop.destination || ""}
                      onChange={(val) => updateStop(type, sIdx, { destination: val })}
                      options={airportOptions}
                      placeholder="MDE"
                      className="text-xs"
                    />
                  </FormField>
                  
                  <FormField label={<span>N° Vuelo <span className="text-red-500">*</span></span>}>
                    <Input
                      required
                      maxLength={6}
                      value={stop.flightNumber || ""}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
                        updateStop(type, sIdx, { flightNumber: cleaned });
                      }}
                      placeholder="AV93"
                      className="text-xs"
                    />
                    {stop.flightNumber?.length > 0 && stop.flightNumber.length < 3 && (
                      <p className="text-[10px] text-amber-500 mt-1 font-medium animate-fade-in">⚠️ Mínimo 3 caracteres.</p>
                    )}
                  </FormField>
                  
                  <FormField label="Asiento">
                    <Input
                      maxLength={5}
                      value={stop.seat || ""}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 5);
                        updateStop(type, sIdx, { seat: cleaned });
                      }}
                      placeholder="12A"
                      className="text-xs"
                    />
                    {stop.seat?.length > 0 && stop.seat.length < 2 && (
                      <p className="text-[10px] text-amber-500 mt-1 font-medium animate-fade-in">⚠️ Mínimo 2 caracteres.</p>
                    )}
                  </FormField>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Aerolínea">
                    <Combobox
                      value={stop.airline || ticket.airline || ""}
                      onChange={(val) => updateStop(type, sIdx, { airline: val })}
                      options={airlines.map((a) => ({ value: a.name, label: a.name }))}
                      placeholder="Ej: Avianca"
                    />
                  </FormField>
                  <FormField label="Plan de Equipaje">
                    <Combobox
                      value={stop.baggagePlan || ticket.baggagePlan || ""}
                      onChange={(val) => updateStop(type, sIdx, { baggagePlan: val })}
                      options={baggage
                        .filter((b) => !(stop.airline || ticket.airline) || b.airlineName.toLowerCase() === (stop.airline || ticket.airline).toLowerCase())
                        .map((b) => ({
                          value: `${b.airlineName} - ${b.fareType}`,
                          label: `${b.airlineName} - ${b.fareType}`,
                        }))}
                      placeholder="Seleccionar plan..."
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormField label={<span>Salida <span className="text-red-500">*</span></span>}>
                    <DateTimePicker
                      value={stop.date || ""}
                      onChange={(val) => updateStop(type, sIdx, { date: val })}
                      min={minDateTime}
                      triggerError={triggerError}
                      fieldName="Salida de la escala"
                    />
                  </FormField>
                  
                  <FormField label={<span>Llegada <span className="text-red-500">*</span></span>}>
                    <DateTimePicker
                      value={stop.arrivalDate || ""}
                      onChange={(val) => updateStop(type, sIdx, { arrivalDate: val })}
                      min={minDateTime}
                      triggerError={triggerError}
                      fieldName="Llegada de la escala"
                    />
                  </FormField>

                  <FormField label="N° Tiquete (Opcional)">
                    <Input
                      minLength={8}
                      maxLength={16}
                      value={stop.ticketNumber || ""}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                        updateStop(type, sIdx, { ticketNumber: cleaned });
                      }}
                      placeholder="Tiquete de escala"
                      className="text-xs"
                    />
                    {stop.ticketNumber && stop.ticketNumber.length > 0 && stop.ticketNumber.length < 8 && (
                      <p className="text-[10px] text-amber-500 mt-1 font-medium animate-fade-in">
                        ⚠️ Mínimo 8 caracteres.
                      </p>
                    )}
                  </FormField>
                </div>
              </div>
            </div>
          ))}
          {(stops || []).length === 0 && (
            <p className={`text-[10px] italic col-span-full text-center py-1 ${c.empty}`}>
              No hay escalas registradas.
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <datalist id="cities-list-ticket">
        {airports?.map((a) => <option key={a.abbreviation} value={a.abbreviation} />)}
      </datalist>

      {/* ── Información General ─────────────────────────────── */}
      <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
        <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
          <Plane size={14} /> Información General del Vuelo
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Aerolínea">
            <Combobox
              value={ticket.airline}
              onChange={(val) => onChange({ airline: val })}
              options={airlines.map((a) => ({ value: a.name, label: a.name }))}
              placeholder="Ej: Avianca"
            />
          </FormField>
          <FormField label="Proveedor">
            <Combobox
              value={ticket.supplier}
              onChange={(val) => onChange({ supplier: val })}
              options={suppliers.map((s) => ({ value: s.name, label: s.name }))}
              placeholder="Ej: Viajes Éxito"
            />
          </FormField>
          <FormField label="Código de Reserva">
            <Input
              required
              maxLength={6}
              value={ticket.reservationNumber}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
                onChange({ reservationNumber: cleaned });
              }}
              placeholder="6 caracteres exactos"
            />
            {ticket.reservationNumber?.length > 0 && ticket.reservationNumber.length < 6 && (
              <p className="text-[10px] text-amber-500 mt-1 font-medium animate-fade-in">
                ⚠️ Faltan {6 - ticket.reservationNumber.length} caracteres (debe tener exactamente 6).
              </p>
            )}
          </FormField>
        </div>
      </div>

      {/* ── Itinerario de Vuelos (Delegado a Submódulo) ── */}
        <FlightLegsManager
          flightMode={ticket.flightMode}
          hasStops={ticket.hasStops}
          returnHasStops={ticket.returnHasStops}
          legs={ticket.legs}
          outboundStops={ticket.outboundStops}
          returnLeg={ticket.returnLeg}
          returnStops={ticket.returnStops}
          airports={airports}
          onChange={(field, value) => onChange({ [field]: value })}
        />
        
      {/* ── Información de Pasajeros (Delegado a Submódulo) ── */}
        <PassengerManager 
          passengers={ticket.passengers || (ticket as any).passengerInfo ? [{ ...(ticket as any).passengerInfo, esTitular: true, asiento: '', nroReserva: '', nroTiquete: '' }] : []}
          clients={clients}
          documentTypes={data?.config?.documentTypes || []}
          onChange={(pax) => onChange({ passengers: pax })}
        />
        
      {/* ── Detalles Financieros ──────────────────────────────── */}
      <div className="bg-emerald-50/20 dark:bg-emerald-500/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
        <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Briefcase size={14} /> Detalles Financieros
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Valor Pagado al Proveedor">
            <CurrencyInput
              required
              value={ticket.supplierCost === 0 ? "" : ticket.supplierCost}
              onChange={(val) => onChange({ supplierCost: val === "" ? 0 : Number(val) })}
            />
          </FormField>
          <FormField label="Valor TA">
            <CurrencyInput
              required
              value={ticket.ta === 0 ? "" : ticket.ta}
              onChange={(val) => onChange({ ta: val === "" ? 0 : Number(val) })}
            />
          </FormField>
          <FormField label="Método de Pago Proveedor">
            <Combobox
              value={ticket.supplierPaymentMethod || ""}
              onChange={(val) => onChange({ supplierPaymentMethod: val })}
              options={paymentMethods.map((m) => ({
                value: m.name,
                label: m.lastFourDigits ? `${m.name} (**${m.lastFourDigits})` : m.name,
              }))}
              placeholder="Seleccionar método..."
            />
          </FormField>
        </div>
      </div>
    </div>
  );
}
