import { useState, useMemo } from 'react';
import { Sale, PaginationState } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { User, MapPin, Calendar, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Pagination } from '../ui/Pagination';

interface RecentBookingsProps {
  sales: Sale[];
}

const STATUS_CONFIG = {
  pagado: { label: 'Confirmada', color: 'text-green-600 bg-green-50', icon: CheckCircle },
  abonado: { label: 'En abono', color: 'text-blue-600 bg-blue-50', icon: AlertTriangle },
  pendiente: { label: 'Pendiente', color: 'text-yellow-600 bg-yellow-50', icon: Clock },
};

const ITINERARY_NAMES = [
  'Caribe Premium',
  'Europa 15D',
  'NY Express',
  'San Andrés',
  'Buenos Aires',
  'Machu Picchu',
  'Cancún Todo Incluido',
  'Brasil Express',
  'Pasadena Dream',
  'Mediterráneo',
];

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  
  const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'hoy';
  if (diffDays === 1) return 'mañana';
  if (diffDays === 2) return '2 días';
  if (diffDays === -1) return 'ayer';
  if (diffDays === -2) return '2 días';
  if (diffDays < 0) return `${Math.abs(diffDays)} días`;
  if (diffDays <= 7) return `${diffDays} días`;
  return '—';
}

export function RecentBookings({ sales }: RecentBookingsProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 5;
  const totalPages = Math.ceil(sales.length / perPage);
  
  const paginatedSales = useMemo(() => {
    const sorted = [...sales].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const start = (currentPage - 1) * perPage;
    return sorted.slice(start, start + perPage);
  }, [sales, currentPage]);

  if (sales.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <p className="text-sm">No hay reservas</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 rounded-t-lg border border-gray-border">
        <div className="col-span-1 text-[10px] font-semibold text-gray-500 uppercase">#</div>
        <div className="col-span-2 text-[10px] font-semibold text-gray-500 uppercase">Cliente</div>
        <div className="col-span-2 text-[10px] font-semibold text-gray-500 uppercase">Reserva</div>
        <div className="col-span-2 text-[10px] font-semibold text-gray-500 uppercase">Asesor</div>
        <div className="col-span-2 text-[10px] font-semibold text-gray-500 uppercase text-right">Valor</div>
        <div className="col-span-1 text-[10px] font-semibold text-gray-500 uppercase text-center">Salida</div>
        <div className="col-span-2 text-[10px] font-semibold text-gray-500 uppercase text-center">Estado</div>
      </div>

      {/* Table Body */}
      <div className="border border-gray-border rounded-b-lg overflow-hidden">
        {paginatedSales.map((sale, idx) => {
          const statusKey = sale.status as keyof typeof STATUS_CONFIG;
          const status = STATUS_CONFIG[statusKey] || STATUS_CONFIG.pendiente;
          const StatusIcon = status.icon;
          const saleNumber = 2845 - ((currentPage - 1) * perPage) - idx;
          
          return (
            <div 
              key={sale.id} 
              className="grid grid-cols-12 gap-2 px-3 py-3 items-center hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
            >
              <div className="col-span-1 text-sm font-medium text-gray-600">
                #{saleNumber}
              </div>
              <div className="col-span-2 text-sm font-medium text-primary truncate">
                {sale.clientName.length > 15 ? sale.clientName.substring(0, 15) + '...' : sale.clientName}
              </div>
              <div className="col-span-2 text-sm text-gray-600 truncate flex items-center gap-1">
                <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                {ITINERARY_NAMES[sale.id % ITINERARY_NAMES.length]}
              </div>
              <div className="col-span-2 text-sm text-gray-600 truncate flex items-center gap-1">
                <User className="w-3 h-3 text-gray-400 flex-shrink-0" />
                {sale.asesorName.split(' ')[0]}
              </div>
              <div className="col-span-2 text-sm font-semibold text-primary text-right">
                {formatCurrency(sale.total)}
              </div>
              <div className="col-span-1 text-xs text-gray-500 text-center">
                {formatRelativeDate(sale.date)}
              </div>
              <div className="col-span-2 flex justify-center">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {status.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        total={sales.length}
        perPage={perPage}
        onPageChange={setCurrentPage}
        className="pt-2 border-t border-gray-border mt-2"
      />
    </div>
  );
}