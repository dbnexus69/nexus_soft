import { useState, useMemo, useCallback } from 'react';
import { Sale, SortField, SortDirection, PaginationState } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Pagination } from '../ui/Pagination';

interface SalesTableProps {
  sales: Sale[];
  pagination?: Partial<PaginationState>;
  onPageChange?: (page: number) => void;
}

const STATUS_STYLES = {
  pagado: 'bg-green-50 text-green-700 border-green-200',
  abonado: 'bg-blue-50 text-blue-700 border-blue-200',
  pendiente: 'bg-yellow-50 text-yellow-700 border-yellow-200',
};

const DEFAULT_PAGINATION: PaginationState = {
  page: 1,
  perPage: 10,
  total: 0,
};

// Fuera del componente: definirlo dentro creaba un tipo nuevo en cada render
// y React remontaba el icono entero cada vez.
function SortIcon({ field, sortField, sortDirection }: {
  field: SortField; sortField: SortField; sortDirection: SortDirection;
}) {
  if (sortField !== field) return null;
  return sortDirection === 'asc'
    ? <ChevronUp className="w-4 h-4" />
    : <ChevronDown className="w-4 h-4" />;
}

export function SalesTable({ sales, pagination, onPageChange }: SalesTableProps) {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const pageConfig = pagination ?? DEFAULT_PAGINATION;
  const totalSales = pageConfig.total || sales.length;
  const perPage = pageConfig.perPage || 10;
  const totalPages = Math.ceil(totalSales / perPage);

  const sortedSales = useMemo(() => {
    const sorted = [...sales].sort((a, b) => {
      let aVal: string | number = a[sortField];
      let bVal: string | number = b[sortField];

      if (sortField === 'date') {
        aVal = new Date(a.date).getTime();
        bVal = new Date(b.date).getTime();
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }

      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return sorted;
  }, [sales, sortField, sortDirection]);

  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return sortedSales.slice(start, start + perPage);
  }, [sortedSales, currentPage, perPage]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  }, [sortField]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    onPageChange?.(page);
  }, [onPageChange]);

  if (sales.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <p className="text-sm">No hay ventas registradas</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-border">
              <th 
                className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('date')}
              >
                <div className="flex items-center gap-1">
                  Fecha
                  <SortIcon field="date" sortField={sortField} sortDirection={sortDirection} />
                </div>
              </th>
              <th 
                className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('clientName')}
              >
                <div className="flex items-center gap-1">
                  Cliente
                  <SortIcon field="clientName" sortField={sortField} sortDirection={sortDirection} />
                </div>
              </th>
              <th 
                className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('asesorName')}
              >
                <div className="flex items-center gap-1">
                  Asesor
                  <SortIcon field="asesorName" sortField={sortField} sortDirection={sortDirection} />
                </div>
              </th>
              <th 
                className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors text-right"
                onClick={() => handleSort('total')}
              >
                <div className="flex items-center justify-end gap-1">
                  Valor
                  <SortIcon field="total" sortField={sortField} sortDirection={sortDirection} />
                </div>
              </th>
              <th 
                className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors text-center"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center justify-center gap-1">
                  Estado
                  <SortIcon field="status" sortField={sortField} sortDirection={sortDirection} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-border">
            {paginatedSales.map(sale => (
              <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-600">
                  {new Date(sale.date).toLocaleDateString('es-CO')}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-primary">
                  {sale.clientName}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {sale.asesorName}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-primary text-right">
                  {formatCurrency(sale.total)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${
                    STATUS_STYLES[sale.status]
                  }`}>
                    {sale.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        total={totalSales}
        perPage={perPage}
        onPageChange={handlePageChange}
        className="px-4 py-3 border-t border-gray-border mt-0"
      />
    </div>
  );
}