import React, { useState, useEffect } from "react";
import Datepicker from "react-tailwindcss-datepicker";
import dayjs from "dayjs";
import { Calendar } from "lucide-react";

export interface DateTimePickerProps {
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

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAsDateTime(e.target.value);
    setDisplayValue(formatted);

    if (formatted.length === 19) {
      const iso = displayToIso(formatted);
      if (iso) {
        onChange(iso);
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
    }
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <input
        type="text"
        value={displayValue}
        onChange={handleTextChange}
        onBlur={handleBlur}
        placeholder="DD/MM/AAAA HH:MM"
        className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-xs bg-white text-gray-700"
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
            startDate: value ? value.split("T")[0] : null,
            endDate: value ? value.split("T")[0] : null,
          } as any}
          onChange={(newValue: any) => {
            if (newValue && newValue.startDate) {
              const formattedDate = dayjs(newValue.startDate).format("YYYY-MM-DD");
              const currentHour = value ? value.split("T")[1]?.split(":")[0] || "12" : "12";
              const currentMin = value ? value.split("T")[1]?.split(":")[1] || "00" : "00";
              
              const hour24 = parseInt(currentHour, 10);
              let h12 = hour24 % 12;
              if (h12 === 0) h12 = 12;
              setTempHour(String(h12).padStart(2, "0"));
              setTempMin(currentMin);
              setTempPeriod(hour24 >= 12 ? "PM" : "AM");
              
              const newIso = `${formattedDate}T${currentHour}:${currentMin}:00-05:00`;
              onChange(newIso);
              setShowTimePopover(true);
            }
          }}
          inputClassName="w-full h-full cursor-pointer"
          toggleClassName="hidden"
        />
      </div>

      {showTimePopover && (
        <div className={`absolute right-0 bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-50 w-52 text-xs text-gray-700 animate-fade-in ${
          popoverDirection === "down" ? "top-full mt-2" : "bottom-full mb-2"
        }`}>
          <div className="font-bold text-gray-800 border-b border-gray-100 pb-2 mb-3 flex items-center justify-between">
            <span>Ajustar Hora</span>
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">12 horas</span>
          </div>

          <div className="flex items-center justify-between gap-1 mb-3">
            <select
              value={tempHour}
              onChange={(e) => setTempHour(e.target.value)}
              className="p-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary text-center font-mono font-bold"
            >
              {Array.from({ length: 12 }, (_, i) => {
                const val = String(i + 1).padStart(2, "0");
                return <option key={val} value={val}>{val}</option>;
              })}
            </select>
            <span className="font-bold text-gray-400">:</span>
            <select
              value={tempMin}
              onChange={(e) => setTempMin(e.target.value)}
              className="p-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary text-center font-mono font-bold"
            >
              {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <div className="flex bg-gray-100 p-0.5 rounded-lg">
              {(["AM", "PM"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTempPeriod(p)}
                  className={`px-1.5 py-1 text-[10px] font-bold rounded ${
                    tempPeriod === p ? "bg-white text-primary shadow-xs" : "text-gray-500"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-1.5 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowTimePopover(false)}
              className="px-3 py-1 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors w-full"
            >
              Aplicar Hora
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
