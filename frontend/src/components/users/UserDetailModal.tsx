import React from 'react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { TrendingUp } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { User, Sale } from '../../types';

interface UserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  userSales: Sale[];
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  asesor: "Asesor",
  freelancer: "Freelancer",
};

export default function UserDetailModal({ isOpen, onClose, user, userSales }: UserDetailModalProps) {
  if (!user) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Detalle: ${user.name}`}
      size="md"
      footer={<Button variant="outline" onClick={onClose}>Cerrar</Button>}
    >
      <div className="space-y-4">
        <div className="flex flex-col items-center text-center p-4 bg-gradient-to-b from-accent/10 to-transparent rounded-2xl border border-accent/20 mb-2">
          <div className="w-20 h-20 rounded-full border-4 border-white dark:border-slate-700 shadow-lg mb-3 overflow-hidden bg-accent/10">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl font-bold text-accent">
                {user.name.charAt(0)}
              </div>
            )}
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:!text-[#ffffff]">{user.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="accent" className="bg-accent/10 border-accent/20 text-accent font-semibold">
              {ROLE_LABELS[user.role] || user.role}
            </Badge>
            <Badge variant={user.status}>
              {user.status === 'active' ? 'USUARIO ACTIVO' : 'USUARIO INACTIVO'}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-slate-800/80 p-4 rounded-lg border border-gray-100 dark:border-slate-700">
          <div><span className="text-gray-500 dark:text-slate-400 text-sm block">Tipo Doc:</span> <span className="font-semibold text-gray-900 dark:!text-[#ffffff]">{user.docType}</span></div>
          <div><span className="text-gray-500 dark:text-slate-400 text-sm block">Número:</span> <span className="font-semibold text-gray-900 dark:!text-[#ffffff]">{user.docNumber}</span></div>
          <div><span className="text-gray-500 dark:text-slate-400 text-sm block">Teléfono:</span> <span className="font-semibold text-gray-900 dark:!text-[#ffffff]">{user.phone || 'N/A'}</span></div>
          <div className="min-w-0"><span className="text-gray-500 dark:text-slate-400 text-sm block">Correo:</span> <span className="font-semibold text-gray-900 dark:!text-[#ffffff] block break-all">{user.email}</span></div>
          <div><span className="text-gray-500 dark:text-slate-400 text-sm block">F. Nacimiento:</span> <span className="font-semibold text-gray-900 dark:!text-[#ffffff]">{user.birthDate ? formatDate(user.birthDate) : 'N/A'}</span></div>
          <div><span className="text-gray-500 dark:text-slate-400 text-sm block">Rol:</span> <span className="font-semibold text-gray-900 dark:!text-[#ffffff]">{ROLE_LABELS[user.role] || user.role}</span></div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-gray-900 dark:!text-[#ffffff] flex items-center gap-2">
              <TrendingUp size={16} className="text-accent" /> Historial de Ventas Realizadas ({userSales.length})
            </h4>
            {userSales.length > 0 && (
              <span className="text-xs font-bold text-primary dark:text-teal-400 bg-primary/10 dark:bg-teal-950/40 px-2 py-1 rounded-lg">
                Total Facturado: {formatCurrency(userSales.reduce((acc, s) => acc + s.total, 0))}
              </span>
            )}
          </div>
          {userSales.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left bg-gray-50 dark:bg-slate-800 text-xs text-gray-500 dark:text-slate-400 uppercase">
                  <th className="p-2 font-semibold">Fecha</th>
                  <th className="p-2 font-semibold">Valor</th>
                  <th className="p-2 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {userSales.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50">
                    <td className="p-2 text-gray-600 dark:text-slate-300">{formatDate(s.date)}</td>
                    <td className="p-2 font-semibold text-gray-900 dark:!text-[#ffffff]">{formatCurrency(s.total)}</td>
                    <td className="p-2"><Badge variant={s.status}>{s.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500 dark:text-slate-400 text-sm italic">No hay ventas registradas por este usuario</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
