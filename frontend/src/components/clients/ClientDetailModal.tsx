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
      size="md"
      footer={<Button variant="outline" onClick={onClose}>Cerrar</Button>}
    >
      <div className="space-y-4">
        <div className="flex flex-col items-center text-center p-4 bg-gradient-to-b from-accent/5 to-transparent rounded-2xl border border-accent/5 mb-2">
          <div className="w-20 h-20 rounded-full border-4 border-white shadow-lg mb-3 overflow-hidden bg-accent/10">
            {client.avatar ? (
              <img src={client.avatar} alt={client.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl font-bold text-accent">
                {client.name.charAt(0)}
              </div>
            )}
          </div>
          <h2 className="text-lg font-bold text-primary">{client.name}</h2>
          <Badge variant={client.status} className="mt-1">
            {client.status === 'active' ? 'CLIENTE ACTIVO' : 'CLIENTE INACTIVO'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
          <div><span className="text-gray-500 text-sm block">Tipo Doc:</span> <span className="font-medium">{client.docType}</span></div>
          <div><span className="text-gray-500 text-sm block">Numero:</span> <span className="font-medium">{client.docNumber}</span></div>
          <div><span className="text-gray-500 text-sm block">Telefono:</span> <span className="font-medium">{client.phone}</span></div>
          <div className="min-w-0"><span className="text-gray-500 text-sm block">Correo:</span> <span className="font-medium block break-all">{client.email}</span></div>
          <div><span className="text-gray-500 text-sm block">F. Nacimiento:</span> <span className="font-medium">{client.birthDate ? formatDate(client.birthDate) : 'N/A'}</span></div>
          <div><span className="text-gray-500 text-sm block">Registro:</span> <span className="font-medium">{formatDate(client.registrationDate)}</span></div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold">Historial de Compras ({clientSales.length})</h4>
            {clientSales.length > 0 && (
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">
                Total: {formatCurrency(clientSales.reduce((acc, s) => acc + s.total, 0))}
              </span>
            )}
          </div>
          {clientSales.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="p-2 font-semibold">Fecha</th>
                  <th className="p-2 font-semibold">Valor</th>
                  <th className="p-2 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clientSales.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <td className="p-2 text-gray-600">{formatDate(s.date)}</td>
                    <td className="p-2 font-semibold text-primary">{formatCurrency(s.total)}</td>
                    <td className="p-2"><Badge variant={s.status}>{s.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500 text-sm italic">No hay compras registradas</p>
          )}
        </div>

        {clientFlights.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Plane size={14} className="text-accent" /> Vuelos ({clientFlights.length})
            </h4>
            <div className="space-y-2">
              {clientFlights.map(flight => (
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
