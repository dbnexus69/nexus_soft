import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Pagination } from '../ui/Pagination';
import * as api from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { FileText, Calendar, Wallet } from 'lucide-react';

interface AgentDetailsModalProps {
  agent: any;
  isOpen: boolean;
  onClose: () => void;
}

export function AgentDetailsModal({ agent, isOpen, onClose }: AgentDetailsModalProps) {
  const [sales, setSales] = useState<any[]>([]);
  const [salesMeta, setSalesMeta] = useState<any>({ page: 1, perPage: 5, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && agent) {
      fetchAgentSales(1);
    }
  }, [isOpen, agent]);

  const fetchAgentSales = async (page: number) => {
    setIsLoading(true);
    try {
      const res = await api.listSales({ commissionAgentId: agent.id, page, perPage: 5, sortOrder: 'desc' });
      setSales(res.data || []);
      if (res.meta) setSalesMeta(res.meta);
    } catch (error) {
      console.error("Error fetching agent sales:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!agent) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalles del Comisionista" size="xl">
      <div className="p-4 md:p-6 flex flex-col min-h-[400px]">
        {/* Encabezado del Comisionista */}
        <div className="flex items-center gap-4 mb-6 bg-gray-50 dark:bg-slate-800 p-4 rounded-2xl border border-gray-100 dark:border-slate-700">
          <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center font-bold text-xl shadow-inner overflow-hidden">
            {agent.avatar ? (
              <img src={agent.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              (agent.name || "C").charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h3 className="font-bold text-xl text-gray-900 dark:text-white">{agent.name}</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">{agent.docType} {agent.docNumber}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{agent.type || "Comisionista"}</span>
            </div>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Acumulado</p>
            <p className="text-xl font-black text-amber-600 dark:text-amber-400">{formatCurrency(agent.accumulated || 0)}</p>
          </div>
        </div>

        <h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <FileText size={18} className="text-primary" /> Historial de Ventas
        </h4>

        {/* Tabla de ventas */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : sales.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10 bg-gray-50/50 dark:bg-slate-900/30 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
            <Wallet className="text-gray-300 dark:text-slate-600 mb-3" size={32} />
            <p className="text-gray-400 font-bold text-sm">No hay ventas asociadas</p>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-slate-800/50">
                  <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-700">ID Venta</th>
                  <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-700">Fecha</th>
                  <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-700">Estado</th>
                  <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-700 text-right">Comisión Neta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {sales.map((sale: any) => (
                  <tr key={sale.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold font-mono text-primary bg-primary/10 px-2 py-1 rounded-lg">#{sale.id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Calendar size={12} />
                        <span className="text-xs font-bold font-mono">{new Date(sale.date || sale.creadoAt).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${sale.isSettled ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                        {sale.isSettled ? 'Liquidada' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-sm font-black text-gray-800 dark:text-white">{formatCurrency(sale.montoComisionNeto || sale.commissionAgentNetPayment || 0)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {salesMeta?.totalPages > 1 && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
            <Pagination
              currentPage={salesMeta.page}
              totalPages={salesMeta.totalPages}
              onPageChange={fetchAgentSales}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
