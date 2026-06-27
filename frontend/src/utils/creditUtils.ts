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

export function getClientsWithCredit(clients: Client[], sales: Sale[]): ClientCreditSummary[] {
  const creditSales = sales.filter(s => s.isCredit === true || s.status === 'credito' || s.status === 'abonado');
  
  const clientMap = new Map<number, ClientCreditSummary>();
  
  creditSales.forEach(sale => {
    const client = clients.find(c => c.id === sale.clientId);
    if (!client) return;
    
    const saleStatus = getCreditSaleStatus(sale);
    const daysUntilDue = getDaysUntilDue(sale.creditDueDate || '');
    const paidAmount = sale.creditPaidAmount || 0;
    const pendingAmount = sale.total - paidAmount;
    
    if (!clientMap.has(client.id)) {
      clientMap.set(client.id, {
        client,
        totalCredit: 0,
        pendingAmount: 0,
        paidAmount: 0,
        nextDueDate: null,
        overdueAmount: 0,
        activeCredits: 0,
        status: 'ok'
      });
    }
    
    const summary = clientMap.get(client.id)!;
    
    summary.totalCredit += sale.total;
    summary.paidAmount += paidAmount;
    summary.activeCredits += 1;
    
    if (saleStatus === 'pending' || saleStatus === 'partial' || saleStatus === 'overdue') {
      summary.pendingAmount += pendingAmount;
    }
    
    if (saleStatus === 'overdue') {
      summary.overdueAmount += pendingAmount;
    }
    
    if (sale.creditDueDate) {
      if (!summary.nextDueDate) {
        summary.nextDueDate = sale.creditDueDate;
      } else if (new Date(sale.creditDueDate) < new Date(summary.nextDueDate)) {
        summary.nextDueDate = sale.creditDueDate;
      }
    }
    
    if (saleStatus === 'overdue') {
      summary.status = 'overdue';
    } else if (summary.status !== 'overdue' && daysUntilDue <= 3) {
      summary.status = 'urgent';
    } else if (summary.status !== 'overdue' && summary.status !== 'urgent' && daysUntilDue <= 7) {
      summary.status = 'pending';
    }
  });
  
  return Array.from(clientMap.values()).sort((a, b) => {
    const statusOrder = { overdue: 0, urgent: 1, pending: 2, ok: 3 };
    return statusOrder[a.status] - statusOrder[b.status];
  });
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

export function getCreditSummaryTotals(clients: Client[], sales: Sale[]): {
  totalPending: number;
  totalOverdue: number;
  totalUrgent: number;
  clientsCount: number;
} {
  const clientsWithCredit = getClientsWithCredit(clients, sales);
  
  return {
    totalPending: clientsWithCredit.reduce((sum, c) => sum + c.pendingAmount, 0),
    totalOverdue: clientsWithCredit.reduce((sum, c) => sum + c.overdueAmount, 0),
    totalUrgent: clientsWithCredit.filter(c => c.status === 'urgent').reduce((sum, c) => sum + c.pendingAmount, 0),
    clientsCount: clientsWithCredit.length
  };
}

export function getStatusColor(status: 'pending' | 'partial' | 'paid' | 'overdue'): string {
  switch (status) {
    case 'overdue': return 'text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50';
    case 'partial': return 'text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/50';
    case 'paid': return 'text-green-600 dark:text-green-300 bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900/50';
    default: return 'text-yellow-600 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-900/50';
  }
}

export function getClientStatusColor(status: 'overdue' | 'urgent' | 'pending' | 'ok'): { bg: string; text: string; label: string } {
  switch (status) {
    case 'overdue': return { bg: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50', text: 'text-red-600 dark:text-red-300', label: 'Vencido' };
    case 'urgent': return { bg: 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900/50', text: 'text-orange-600 dark:text-orange-300', label: 'Pronto' };
    case 'pending': return { bg: 'bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-900/50', text: 'text-yellow-600 dark:text-yellow-300', label: 'Pendiente' };
    default: return { bg: 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900/50', text: 'text-green-600 dark:text-green-300', label: 'Al día' };
  }
}