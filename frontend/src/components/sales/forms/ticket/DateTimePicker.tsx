import React, { useState, useEffect } from "react";
import Datepicker from "react-tailwindcss-datepicker";
import dayjs from "dayjs";

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
    return `${d}/${m}/${y} ${time}`;
  };

  useEffect(() => {
    setDisplayValue(isoToDisplay(value));
    if (value && value.includes("T")) {
      const timePart = value.split("T")[1];
      if (timePart) {
        const [hStr, mStr] = timePart.split(":");
        let h = parseInt(hStr, 10);
        const p = h >= 12 ? "PM" : "AM";
        if (h === 0) h = 12;
        else if (h > 12) h -= 12;
        setTempHour(String(h).padStart(2, "0"));
        setTempMin(mStr || "00");
        setTempPeriod(p);
      }
    }
  }, [value]);

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        readOnly
        value={displayValue}
        onClick={() => setShowTimePopover(!showTimePopover)}
        placeholder="DD/MM/AAAA HH:MM"
        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
      />
    </div>
  );
}
