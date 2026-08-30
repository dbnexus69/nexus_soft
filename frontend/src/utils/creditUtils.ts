// La agregación de la cartera (totales por cliente y del conjunto) la hace
// ahora el backend en GET /sales/credit: calcularla aquí obligaba a tener
// todas las ventas en memoria.
import { Client, Sale } from '../types';

export interface ClientCreditSummary {
  client: Client;
  totalCredit: number;
  pendingAmount: number;
  paidAmount: number;
  nextDueDate: string | null;
  overdueAmount: number;
  activeCredits: number;
  status: 'overdue' | 'urgent' | 'pending' | 'ok';
}

export interface CreditSaleInfo {
  sale: Sale;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  daysUntilDue: number;
  pendingAmount: number;
}


export function getDaysUntilDue(dueDate: string): number {
  const date = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diff = date.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getCreditSaleStatus(sale: Sale): 'pending' | 'partial' | 'paid' | 'overdue' {
  if (!sale.isCredit && sale.status !== 'credito' && sale.status !== 'abonado') return 'paid';
  
  const paidAmount = sale.creditPaidAmount || 0;
  
  if (paidAmount >= sale.total) return 'paid';
  if (paidAmount > 0) return 'partial';
  
  const daysUntilDue = getDaysUntilDue(sale.creditDueDate || '');
  if (daysUntilDue < 0) return 'overdue';
  
  return 'pending';
}


export function getClientCreditSales(clientId: number, sales: Sale[]): CreditSaleInfo[] {
  const creditSales = sales
    .filter(s => s.clientId === clientId && (s.isCredit === true || s.status === 'credito' || s.status === 'abonado'))
    .map(sale => {
      const daysUntilDue = sale.creditDueDate ? getDaysUntilDue(sale.creditDueDate) : 0;
      const paidAmount = sale.creditPaidAmount || 0;
      
      return {
        sale,
        status: getCreditSaleStatus(sale),
        daysUntilDue,
        pendingAmount: sale.total - paidAmount
      };
    })
    .sort((a, b) => {
      if (a.status === 'overdue' && b.status !== 'overdue') return -1;
      if (b.status === 'overdue' && a.status !== 'overdue') return 1;
      if (a.status === 'partial' && b.status === 'pending') return -1;
      if (b.status === 'partial' && a.status === 'pending') return 1;
      return new Date(a.sale.creditDueDate || '').getTime() - new Date(b.sale.creditDueDate || '').getTime();
    });
  
  return creditSales;
}


export function getStatusColor(status: 'pending' | 'partial' | 'paid' | 'overdue'): string {
  switch (status) {
    case 'overdue': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/20 border-red-200 dark:border-red-500/30';
    case 'partial': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/20 border-blue-200 dark:border-blue-500/30';
    case 'paid': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/20 border-green-200 dark:border-green-500/30';
    default: return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/20 border-yellow-200 dark:border-yellow-500/30';
  }
}

export function getClientStatusColor(status: 'overdue' | 'urgent' | 'pending' | 'ok'): { bg: string; text: string; label: string } {
  switch (status) {
    case 'overdue': return { bg: 'bg-red-50 dark:bg-red-500/20 border-red-200 dark:border-red-500/30', text: 'text-red-600 dark:text-red-400', label: 'Vencido' };
    case 'urgent': return { bg: 'bg-orange-50 dark:bg-orange-500/20 border-orange-200 dark:border-orange-500/30', text: 'text-orange-600 dark:text-orange-400', label: 'Pronto' };
    case 'pending': return { bg: 'bg-yellow-50 dark:bg-yellow-500/20 border-yellow-200 dark:border-yellow-500/30', text: 'text-yellow-600 dark:text-yellow-400', label: 'Pendiente' };
    default: return { bg: 'bg-green-50 dark:bg-green-500/20 border-green-200 dark:border-green-500/30', text: 'text-green-600 dark:text-green-400', label: 'Al día' };
  }
}