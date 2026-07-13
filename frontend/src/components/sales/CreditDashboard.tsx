import { useState, useMemo } from "react";
import { Card, CardHeader, CardBody } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { 
  CreditCard, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  Wallet, 
  AlertCircle,
  Search,
  X
} from "lucide-react";
import { 
  getClientsWithCredit, 
  getCreditSummaryTotals, 
  getClientStatusColor, 
  getStatusColor, 
  getClientCreditSales,
  ClientCreditSummary
} from "../../utils/creditUtils";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { Client, Sale } from "../../types";

interface CreditDashboardProps {
  clients: Client[];
  sales: Sale[];
}

export default function CreditDashboard({ clients, sales }: CreditDashboardProps) {
  const [creditFilter, setCreditFilter] = useState<'all' | 'overdue' | 'urgent' | 'pending'>('all');
  const [selectedCreditClient, setSelectedCreditClient] = useState<ClientCreditSummary | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const clientsWithCredit = useMemo(() => 
    getClientsWithCredit(clients, sales), 
  [clients, sales]);

  const creditTotals = useMemo(() => 
    getCreditSummaryTotals(clients, sales),
  [clients, sales]);

  const filteredCreditClients = useMemo(() => {
    let result = clientsWithCredit;
    if (creditFilter !== 'all') {
      result = result.filter(c => c.status === creditFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(c => {
        if (c.client.name?.toLowerCase().includes(q)) return true;
        if (c.client.docNumber?.toLowerCase().includes(q)) return true;
        
        const statusMap: Record<string, string> = { 'overdue': 'vencido', 'urgent': 'pronto', 'pending': 'pendiente' };
        if (statusMap[c.status]?.includes(q)) return true;

        const clientSales = getClientCreditSales(c.client.id, sales);
        return clientSales.some(cs => {
          if (String(cs.sale.id).includes(q)) return true;
          if (formatDate(cs.sale.date).toLowerCase().includes(q)) return true;
          if (cs.sale.status?.toLowerCase().includes(q)) return true;
          if (cs.status?.toLowerCase().includes(q)) return true;
          return false;
        });
      });
    }

    return result;
  }, [clientsWithCredit, creditFilter, searchTerm, sales]);

  const selectedClientCreditSales = useMemo(() => {
    if (!selectedCreditClient) return [];
    return getClientCreditSales(selectedCreditClient.client.id, sales);
  }, [selectedCreditClient, sales]);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-none shadow-lg">
            <CardHeader actions={
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative w-full sm:w-64 shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    placeholder="Buscar por documento, nombre, ID de venta..." 
                    className="text-sm border border-gray-border dark:border-slate-700 rounded-lg pl-9 pr-8 py-1.5 bg-white dark:bg-slate-900 text-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 w-full"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded">
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button onClick={() => setCreditFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${creditFilter === 'all' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'}`}>
                  Todos ({clientsWithCredit.length})
                </button>
                <button onClick={() => setCreditFilter('overdue')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${creditFilter === 'overdue' ? 'bg-red-500 text-white' : 'bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/30'}`}>
                  Vencidos ({clientsWithCredit.filter(c => c.status === 'overdue').length})
                </button>
                <button onClick={() => setCreditFilter('urgent')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${creditFilter === 'urgent' ? 'bg-orange-500 text-white' : 'bg-orange-50 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/30'}`}>
                  Pronto ({clientsWithCredit.filter(c => c.status === 'urgent').length})
                </button>
                <button onClick={() => setCreditFilter('pending')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${creditFilter === 'pending' ? 'bg-yellow-500 text-white' : 'bg-yellow-50 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-500/30'}`}>
                  Pendiente ({clientsWithCredit.filter(c => c.status === 'pending').length})
                </button>
              </div>
            }>
              Clientes con Crédito Pendiente
            </CardHeader>
            <CardBody className="p-0">
              {filteredCreditClients.length > 0 ? (
                <div className="divide-y divide-gray-border max-h-[500px] overflow-y-auto custom-scrollbar">
                  {filteredCreditClients.map(creditClient => {
                    const statusColors = getClientStatusColor(creditClient.status);
                    return (
                      <div 
                        key={creditClient.client.id} 
                        className={`p-4 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${selectedCreditClient?.client.id === creditClient.client.id ? 'bg-primary/5 dark:bg-primary/20 border-l-4 border-primary' : ''}`} 
                        onClick={() => setSelectedCreditClient(creditClient)}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${statusColors.bg} ${statusColors.text}`}>
                            <CreditCard size={24} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-primary dark:text-white">{creditClient.client.name}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors.bg} ${statusColors.text}`}>{statusColors.label}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400 mt-1">
                              <span className="flex items-center gap-1"><DollarSign size={12} /> {creditClient.activeCredits} crédito(s)</span>
                              <span className="flex items-center gap-1"><Clock size={12} /> {creditClient.nextDueDate ? formatDate(creditClient.nextDueDate) : 'Sin fecha'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-primary dark:text-slate-200">{formatCurrency(creditClient.pendingAmount)}</p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">pendiente</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : searchTerm.trim() ? (
                <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                  <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mb-4"><Search size={32} /></div>
                  <p className="font-bold text-gray-600">No se encontró ningún crédito</p>
                  <p className="text-sm">Intenta con otros términos de búsqueda.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                  <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-4"><CheckCircle size={32} /></div>
                  <p className="font-bold text-gray-600">¡Todo al día!</p>
                  <p className="text-sm">No hay clientes con crédito pendiente.</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-primary dark:bg-slate-900 text-white dark:text-slate-100 border-none dark:border dark:border-slate-850 shadow-xl shadow-primary/20 dark:shadow-none">
            <CardBody className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 dark:bg-slate-800/50 rounded-xl"><Wallet size={24} /></div>
                <Badge variant="accent" className="bg-white/20 dark:bg-slate-800 text-white dark:text-slate-200 border-none">CARTERA TOTAL</Badge>
              </div>
              <h3 className="text-sm font-medium text-white/80 dark:text-slate-300 uppercase tracking-wider">Total Pendiente</h3>
              <p className="text-3xl font-bold mt-1">{formatCurrency(creditTotals.totalPending)}</p>
              <div className="mt-4 pt-4 border-t border-white/20 dark:border-slate-800 space-y-2">
                <div className="flex justify-between text-xs text-white/70 dark:text-slate-300">
                  <span>Vencido</span>
                  <span className="font-bold text-red-300 dark:text-red-400">{formatCurrency(creditTotals.totalOverdue)}</span>
                </div>
                <div className="flex justify-between text-xs text-white/70 dark:text-slate-300">
                  <span>Próximo (3 días)</span>
                  <span className="font-bold text-orange-300 dark:text-orange-400">{formatCurrency(creditTotals.totalUrgent)}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {selectedCreditClient ? (
            <Card className="border-none shadow-lg">
              <CardHeader>{selectedCreditClient.client.name}</CardHeader>
              <CardBody className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                    <p className="text-xs text-gray-500">Total Crédito</p>
                    <p className="text-sm font-bold text-primary dark:text-white">{formatCurrency(selectedCreditClient.totalCredit)}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                    <p className="text-xs text-gray-500">Pendiente</p>
                    <p className="text-sm font-bold text-orange-600 dark:text-orange-400">{formatCurrency(selectedCreditClient.pendingAmount)}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                    <p className="text-xs text-gray-500">Pagado</p>
                    <p className="text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(selectedCreditClient.paidAmount)}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                    <p className="text-xs text-gray-500">Vencido</p>
                    <p className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(selectedCreditClient.overdueAmount)}</p>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
                  <p className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-3">Ventas a Crédito</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                    {selectedClientCreditSales.map(saleInfo => {
                      const saleStatusColors = getStatusColor(saleInfo.status);
                      return (
                        <div key={saleInfo.sale.id} className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-100 dark:border-slate-700">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="text-sm font-bold text-primary dark:text-white">Venta #{saleInfo.sale.id}</p>
                              <p className="text-xs text-gray-500">{formatDate(saleInfo.sale.date)} · Vence: {saleInfo.sale.creditDueDate ? formatDate(saleInfo.sale.creditDueDate) : 'N/A'}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${saleStatusColors}`}>
                              {saleInfo.status === 'paid' ? 'Liquidado' : saleInfo.status === 'partial' ? 'Parcial' : saleInfo.status === 'overdue' ? 'Vencido' : 'Pendiente'}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] mt-2">
                            <span className="text-gray-500">Total: <span className="font-semibold text-gray-700 dark:text-slate-200">{formatCurrency(saleInfo.sale.total)}</span></span>
                            <span className="text-gray-500">Pendiente: <span className="font-semibold text-orange-600 dark:text-orange-400">{formatCurrency(saleInfo.pendingAmount)}</span></span>
                          </div>
                          {saleInfo.daysUntilDue <= 3 && saleInfo.daysUntilDue >= 0 && (
                            <div className="mt-2 flex items-center gap-1 text-[10px] text-orange-600 dark:text-orange-400 font-medium bg-orange-50 dark:bg-orange-500/10 p-1 rounded"><Clock size={10} /> Vence en {saleInfo.daysUntilDue} día(s)</div>
                          )}
                          {saleInfo.daysUntilDue < 0 && (
                            <div className="mt-2 flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-500/10 p-1 rounded"><AlertCircle size={10} /> Vencido hace {Math.abs(saleInfo.daysUntilDue)} día(s)</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardBody>
            </Card>
          ) : (
            <Card className="border-none shadow-lg">
              <CardBody className="flex flex-col items-center justify-center p-8 text-gray-400 min-h-[300px]">
                <CreditCard size={48} className="mb-4 opacity-20" />
                <p className="font-medium">Selecciona un cliente</p>
                <p className="text-sm">para ver el historial de créditos</p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
