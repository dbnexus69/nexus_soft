import React from "react";
import { Plane, Calendar as CalendarIcon, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Flight } from "../../types";

interface FlightCardProps {
  flight: Flight;
  onCheckinClick: (flight: Flight) => void;
}

export const FlightCard: React.FC<FlightCardProps> = ({ flight, onCheckinClick }) => {
  const getStatus = () => {
    if (flight.checkin === 'realizado') return { label: 'Realizado', variant: 'success' as const };
    const [yr, mo, dy] = flight.date.split('-').map(Number);
    const [hr, mn] = (flight.time || '00:00').split(':').map(Number);
    const flightDateTime = new Date(yr, mo - 1, dy, hr, mn, 0);
    const now = new Date();
    if (flightDateTime < now) return { label: 'Vencido', variant: 'danger' as const };
    if (flightDateTime.getTime() <= now.getTime() + (48 * 60 * 60 * 1000)) {
      return { label: 'Urgente (48h)', variant: 'warning' as const };
    }
    return { label: 'Pendiente', variant: 'secondary' as const };
  };

  const status = getStatus();

  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md transition-all flex flex-col justify-between gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <Plane size={18} />
          </div>
          <div>
            <div className="font-semibold text-slate-900 dark:text-white text-sm">{flight.route}</div>
            <div className="text-xs text-slate-500">{flight.airline} · Vuelo {flight.flightNumber || 'N/A'}</div>
          </div>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 py-2 border-y border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center gap-1.5">
          <CalendarIcon size={14} className="text-slate-400" />
          <span>{flight.date}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={14} className="text-slate-400" />
          <span>{flight.time || 'Hora N/A'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate max-w-[180px]">
          👤 {flight.passenger}
        </div>
        {flight.checkin === 'pendiente' && (
          <button
            onClick={() => onCheckinClick(flight)}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            Realizar Check-in
          </button>
        )}
      </div>
    </div>
  );
};
