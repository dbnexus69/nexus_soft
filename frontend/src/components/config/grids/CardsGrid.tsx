import React from 'react';
import { CreditCard, Pencil, Trash2 } from 'lucide-react';

interface CardsGridProps {
  filteredData: any[];
  handleOpenModal: (item: any) => void;
  handleDelete: (id: number) => void;
}

const isOptimisticId = (item: any): boolean => {
  return item && item._isOptimistic === true;
};

export const CardsGrid: React.FC<CardsGridProps> = ({ filteredData, handleOpenModal, handleDelete }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {filteredData.map((card) => {
        const gradients = [
          'from-slate-700 via-slate-800 to-slate-900 border border-slate-600/40 shadow-slate-900/50',
          'from-blue-700 via-indigo-900 to-slate-900 border border-blue-500/40 shadow-blue-900/50',
          'from-purple-700 via-indigo-900 to-slate-900 border border-purple-500/40 shadow-purple-900/50',
          'from-teal-600 via-emerald-800 to-slate-900 border border-teal-400/40 shadow-emerald-900/50'
        ];
        const isOptimistic = isOptimisticId(card);
        const gradIndex = Math.abs(Number(card.id)) % gradients.length;
        const grad = gradients[gradIndex];

        return (
          <div key={card.id} className={`relative bg-gradient-to-br ${grad} text-white p-6 rounded-2xl shadow-lg hover:scale-[1.01] hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between min-h-[220px] ${isOptimistic ? 'opacity-75 animate-pulse' : ''}`}>
            <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4 pointer-events-none select-none text-white">
              <CreditCard size={180} />
            </div>
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/70 font-semibold">Nombre Tarjeta</p>
                  <h3 className="font-heading font-bold text-base text-white">{card.name || card.bank || 'Tarjeta Sin Nombre'}</h3>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                  isOptimistic ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30' :
                  (card.status || 'Activo') === 'Activo' ? 'bg-green-500/20 text-green-200 border border-green-500/30' : 'bg-red-500/20 text-red-200 border border-red-500/30'
                }`}>
                  {isOptimistic ? '⏳ Guardando' : (card.status || 'Activo')}
                </span>
              </div>
              <div className="mb-2">
                <p className="text-[9px] uppercase tracking-widest text-white/70 font-semibold">Método de Pago</p>
                <p className="text-xs font-semibold text-white">{card.paymentMethod || card.type || 'No especificado'}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <div>
                <p className="text-[9px] uppercase tracking-widest text-white/60 font-semibold">Últimos dígitos</p>
                <p className="text-sm font-mono font-bold">•••• {card.lastFourDigits || '0000'}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenModal(card)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                  title="Editar"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleDelete(card.id)}
                  className="p-2 bg-rose-500/20 hover:bg-rose-500/40 rounded-lg text-rose-200 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
