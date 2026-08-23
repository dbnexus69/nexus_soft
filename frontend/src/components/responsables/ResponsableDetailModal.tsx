import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Plane, Loader2 } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Responsable, Sale } from '../../types';
import { Pagination } from '../ui/Pagination';
import { listSales } from '../../api/sales';

interface ResponsableDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  responsable: Responsable | null;
  responsableFlights: any[];
}

export default function ResponsableDetailModal({ isOpen, onClose, responsable, responsableFlights }: ResponsableDetailModalProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && responsable) {
      fetchSales();
    }
  }, [isOpen, responsable, page]);

  useEffect(() => {
    if (!isOpen) {
      setPage(1);
      setSales([]);
    }
  }, [isOpen]);

  const fetchSales = async () => {
    if (!responsable) return;
    setIsLoading(true);
    try {
      const res = await listSales({ 
        responsableId: responsable.id, 
        page, 
        perPage: 5,
        sortOrder: 'desc',
        sortBy: 'creadoAt'
      });
      if (res && res.data) {
        setSales(res.data);
        if (res.meta) {
          setTotalPages(res.meta.totalPages || 1);
          setTotalRecords(res.meta.total || 0);
        }
      }
    } catch (e) {
      console.error('Error fetching responsable sales:', e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!responsable) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Detalle: ${responsable.name}`}
      size="md"
      footer={<Button variant="outline" onClick={onClose}>Cerrar</Button>}
    >
      <div className="space-y-4">
        <div className="flex flex-col items-center text-center p-4 bg-gradient-to-b from-accent/5 to-transparent rounded-2xl border border-accent/5 mb-2">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary dark:text-teal-400 text-2xl font-semibold overflow-hidden border-4 border-white dark:border-slate-700 shadow-sm">
            {responsable.name.charAt(0)}
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:!text-[#ffffff] mt-2">{responsable.name}</h2>
          <Badge variant={responsable.status} className="mt-1">
            {responsable.status === 'active' ? 'CLIENTE ACTIVO' : 'CLIENTE INACTIVO'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-slate-800/80 p-4 rounded-lg border border-gray-100 dark:border-slate-700">
          <div><span className="text-gray-500 dark:text-slate-400 text-sm block">Tipo Doc:</span> <span className="font-semibold text-gray-900 dark:!text-[#ffffff]">{responsable.docType}</span></div>
          <div><span className="text-gray-500 dark:text-slate-400 text-sm block">Numero:</span> <span className="font-semibold text-gray-900 dark:!text-[#ffffff]">{responsable.docNumber}</span></div>
          <div><span className="text-gray-500 dark:text-slate-400 text-sm block">Telefono:</span> <span className="font-semibold text-gray-900 dark:!text-[#ffffff]">{responsable.phone}</span></div>
          <div className="min-w-0"><span className="text-gray-500 dark:text-slate-400 text-sm block">Correo:</span> <span className="font-semibold text-gray-900 dark:!text-[#ffffff] block break-all">{responsable.email}</span></div>
          <div><span className="text-gray-500 dark:text-slate-400 text-sm block">Registro:</span> <span className="font-semibold text-gray-900 dark:!text-[#ffffff]">{formatDate(responsable.creadoAt)}</span></div>
        </div>
        
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-gray-900 dark:!text-[#ffffff]">
              Historial de Ventas ({totalRecords})
            </h4>
            {(responsable.deudaTotal || 0) > 0 && (
              <span className="text-xs font-bold text-primary dark:text-teal-400 bg-primary/10 dark:bg-teal-950/40 px-2 py-1 rounded-lg">
                Total Deuda: {formatCurrency(responsable.deudaTotal || 0)}
              </span>
            )}
          </div>
          
          <div className="min-h-[220px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full py-8 text-gray-500">
                <Loader2 className="animate-spin mr-2" size={20} />
                <span>Cargando ventas...</span>
              </div>
            ) : sales.length > 0 ? (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left bg-gray-50 dark:bg-slate-800 text-xs text-gray-500 dark:text-slate-400 uppercase">
                      <th className="p-2 font-semibold">ID</th>
                      <th className="p-2 font-semibold">Fecha</th>
                      <th className="p-2 font-semibold">Monto Total</th>
                      <th className="p-2 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {sales.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50">
                        <td className="p-2 font-mono text-gray-500 dark:text-slate-400">#{s.id.toString().padStart(4, '0')}</td>
                        <td className="p-2 text-gray-600 dark:text-slate-300">{formatDate(s.date)}</td>
                        <td className="p-2 font-semibold text-primary">{formatCurrency(s.total)}</td>
                        <td className="p-2"><Badge variant={s.status}>{s.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {totalPages > 1 && (
                  <div className="mt-4 flex justify-center">
                    <Pagination 
                      currentPage={page}
                      totalPages={totalPages}
                      onPageChange={setPage}
                    />
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-500 text-sm italic py-4">No hay historial de ventas asociadas</p>
            )}
          </div>
        </div>

        {responsableFlights.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Plane size={14} className="text-accent" /> Vuelos ({responsableFlights.length})
            </h4>
            <div className="space-y-2">
              {responsableFlights.map(flight => (
                <div key={flight.id} className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                  flight.type === 'ida' ? 'bg-blue-50 border-blue-100' : 'bg-indigo-50 border-indigo-100'
                }`}>
                  <div className="flex items-center gap-2">
                    <Plane size={12} className={flight.type === 'ida' ? 'text-blue-500' : 'text-indigo-500 rotate-180'} />
                    <span className="font-semibold">{flight.route}</span>
                    <span className="text-gray-500">{formatDate(flight.date)} · {flight.time}</span>
                    <span className="text-gray-500">{flight.airline}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full font-bold ${
                    flight.checkin === 'realizado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {flight.checkin === 'realizado' ? 'Check-in ✓' : 'Pendiente'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
