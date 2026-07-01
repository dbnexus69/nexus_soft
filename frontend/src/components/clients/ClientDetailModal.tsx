import React from 'react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Plane } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Client, Sale } from '../../types';

interface ClientDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  clientSales: Sale[];
  clientFlights: any[];
}

export default function ClientDetailModal({ isOpen, onClose, client, clientSales, clientFlights }: ClientDetailModalProps) {
  if (!client) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Detalle: ${client.name}`}
      size="xl"
      contentClassName="!p-0"
    >
      <div className="flex flex-col md:flex-row min-h-[500px]">
        {/* Left Column - Profile Summary */}
        <div className="w-full md:w-1/3 bg-gray-50/50 dark:bg-slate-800/30 p-6 md:p-8 border-b md:border-b-0 md:border-r border-gray-100 dark:border-slate-700/50 flex flex-col items-center justify-start relative overflow-hidden rounded-l-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
          
          <div className="relative z-10 w-full flex flex-col items-center mt-4">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white dark:border-slate-700 shadow-xl mb-6 overflow-hidden bg-accent/10 transition-transform duration-300 hover:scale-105">
              {client.avatar ? (
                <img src={client.avatar} alt={client.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-accent">
                  {client.name.charAt(0)}
                </div>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-3">{client.name}</h2>
            <Badge variant={client.status} className="mb-8 shadow-sm">
              {client.status === 'active' ? 'CLIENTE ACTIVO' : 'CLIENTE INACTIVO'}
            </Badge>

            {clientSales.length > 0 && (
              <div className="w-full bg-white/80 dark:bg-slate-800/80 p-5 rounded-2xl border border-gray-100 dark:border-slate-700/50 text-center shadow-sm backdrop-blur-sm">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">Total Compras</span>
                <span className="text-2xl font-bold text-primary dark:text-teal-400">
                  {formatCurrency(clientSales.reduce((acc, s) => acc + s.total, 0))}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Details */}
        <div className="w-full md:w-2/3 flex flex-col bg-white dark:bg-slate-900 rounded-r-2xl">
          <div className="p-6 md:p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
            {/* Information Grid */}
            <div>
              <div className="flex items-center gap-2 mb-5">
                <div className="h-6 w-1 bg-primary rounded-full"></div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                  Información General
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 bg-gray-50/50 dark:bg-slate-800/30 p-5 rounded-2xl border border-gray-100 dark:border-slate-700/50">
                <div><span className="text-gray-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Tipo Doc</span> <span className="font-semibold text-gray-900 dark:text-white">{client.docType}</span></div>
                <div><span className="text-gray-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Número</span> <span className="font-semibold text-gray-900 dark:text-white">{client.docNumber}</span></div>
                <div><span className="text-gray-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Teléfono</span> <span className="font-semibold text-gray-900 dark:text-white">{client.phone}</span></div>
                <div className="min-w-0"><span className="text-gray-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Correo</span> <span className="font-semibold text-gray-900 dark:text-white block break-all">{client.email}</span></div>
                <div><span className="text-gray-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">F. Nacimiento</span> <span className="font-semibold text-gray-900 dark:text-white">{client.birthDate ? formatDate(client.birthDate) : 'N/A'}</span></div>
                <div><span className="text-gray-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Registro</span> <span className="font-semibold text-gray-900 dark:text-white">{formatDate(client.registrationDate)}</span></div>
              </div>
            </div>

            {/* Purchase History */}
            <div>
              <div className="flex items-center gap-2 mb-5">
                <div className="h-6 w-1 bg-accent rounded-full"></div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                  Historial de Compras ({clientSales.length})
                </h3>
              </div>
              
              {clientSales.length > 0 ? (
                <div className="border border-gray-100 dark:border-slate-700/50 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50/80 dark:bg-slate-800/80 text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      <tr>
                        <th className="px-5 py-4 font-semibold">Fecha</th>
                        <th className="px-5 py-4 font-semibold">Valor</th>
                        <th className="px-5 py-4 font-semibold text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                      {clientSales.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors bg-white dark:bg-slate-900">
                          <td className="px-5 py-4 text-gray-600 dark:text-slate-300">{formatDate(s.date)}</td>
                          <td className="px-5 py-4 font-bold text-gray-900 dark:text-white">{formatCurrency(s.total)}</td>
                          <td className="px-5 py-4 text-center"><Badge variant={s.status}>{s.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-gray-50/50 dark:bg-slate-800/30 p-8 rounded-2xl border border-gray-100 dark:border-slate-700/50 text-center">
                  <p className="text-gray-500 text-sm italic">No hay compras registradas</p>
                </div>
              )}
            </div>

            {/* Flights */}
            {clientFlights.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <div className="h-6 w-1 bg-blue-500 rounded-full"></div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <Plane size={18} className="text-blue-500" /> Vuelos ({clientFlights.length})
                  </h3>
                </div>
                <div className="space-y-3">
                  {clientFlights.map(flight => (
                    <div key={flight.id} className={`flex items-center justify-between p-4 rounded-2xl border shadow-sm text-sm transition-all hover:shadow-md ${
                      flight.type === 'ida' ? 'bg-blue-50/30 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/30' : 'bg-indigo-50/30 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800/30'
                    }`}>
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${flight.type === 'ida' ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-indigo-100 dark:bg-indigo-900/50'}`}>
                          <Plane size={16} className={flight.type === 'ida' ? 'text-blue-600 dark:text-blue-400' : 'text-indigo-600 dark:text-indigo-400 rotate-180'} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-base">{flight.route}</p>
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{formatDate(flight.date)} · {flight.time} · <span className="font-semibold text-gray-700 dark:text-slate-300">{flight.airline}</span></p>
                        </div>
                      </div>
                      <span className={`px-4 py-1.5 rounded-full text-xs font-bold border ${
                        flight.checkin === 'realizado' ? 'bg-green-100/50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/50' : 'bg-yellow-100/50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/50'
                      }`}>
                        {flight.checkin === 'realizado' ? 'Check-in ✓' : 'Pendiente'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 md:px-8 py-5 border-t border-gray-100 dark:border-slate-700/50 flex justify-end bg-gray-50/50 dark:bg-slate-900 rounded-br-2xl mt-auto">
            <Button variant="outline" onClick={onClose} className="min-w-[120px] shadow-sm bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700">
              Cerrar Detalles
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
