import React from 'react';
import { 
  CreditCard, Pencil, Trash2, Coins, IdCard, 
  PlaneTakeoff, Building2, Compass, Luggage, Boxes, MapPin, Moon, ShieldCheck, Eye
} from 'lucide-react';
import { formatMealPlan } from '../../utils/formatters';

interface ConfigGridsProps {
  section: string;
  filteredData: any[];
  handleOpenModal: (item: any) => void;
  handleDelete: (id: number) => void;
  setViewingPackage: (item: any) => void;
}

const isOptimisticId = (item: any): boolean => {
  if (item === undefined || item === null) return false;
  return item._isOptimistic === true;
};

export default function ConfigGrids({ section, filteredData, handleOpenModal, handleDelete, setViewingPackage }: ConfigGridsProps) {
  
  if (section === 'cards') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredData.map((card, idx) => {
          const gradients = [
            'from-slate-700 via-slate-800 to-slate-900 border border-slate-600/40 shadow-slate-900/50',
            'from-blue-700 via-indigo-900 to-slate-900 border border-blue-500/40 shadow-blue-900/50',
            'from-purple-700 via-indigo-900 to-slate-900 border border-purple-500/40 shadow-purple-900/50',
            'from-teal-600 via-emerald-800 to-slate-900 border border-teal-400/40 shadow-emerald-900/50'
          ];
          const isOptimistic = isOptimisticId(card);
          const gradIndex = Math.abs(Number(card.id || idx)) % gradients.length;
          const grad = gradients[gradIndex];
          
          return (
            <div key={card.id ?? `card-${idx}`} className={`relative bg-gradient-to-br ${grad} text-white p-6 rounded-2xl shadow-lg hover:scale-[1.01] hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between min-h-[220px] ${isOptimistic ? 'opacity-75 animate-pulse' : ''}`}>
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
              <div>
                <div className="flex gap-2.5 items-center mb-4">
                  <div className="w-9 h-6 bg-amber-400/90 rounded-md border border-amber-300/40 flex flex-col justify-between p-0.5 shadow-sm">
                    <div className="h-full border-r border-b border-amber-700/30"></div>
                  </div>
                  <div className="text-sm text-white/90 font-mono tracking-widest font-bold">•••• •••• •••• {card.lastFourDigits || '••••'}</div>
                </div>
                <p className="text-[11px] text-white/80 italic mb-4 line-clamp-2 min-h-[2rem]">
                  {card.description || 'Sin descripción corporativa.'}
                </p>
                <div className="flex justify-between items-center border-t border-white/20 pt-3">
                  <span className="text-[9px] font-mono text-white/60">{isOptimistic ? 'PROCESANDO EN BASE DE DATOS...' : 'SISTEMA DE FACTURACIÓN ITEA'}</span>
                  <div className="flex gap-2 relative z-10">
                    <button 
                      onClick={() => handleOpenModal(card)}
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-lg backdrop-blur-md transition-all duration-200 cursor-pointer flex items-center justify-center"
                      title="Editar"
                      disabled={isOptimistic}
                    >
                      <Pencil size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(card.id)}
                      className="p-2 rounded-xl bg-red-600/60 hover:bg-red-600/80 text-white border border-red-400/30 shadow-lg backdrop-blur-md transition-all duration-200 cursor-pointer flex items-center justify-center"
                      title="Eliminar"
                      disabled={isOptimistic}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (section === 'paymentMethods') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filteredData.map((method, idx) => {
          const methodName = method.name || method.nombre || '';
          const isCard = methodName.toLowerCase().includes('tarjeta') || methodName.toLowerCase().includes('crédito');
          const isTransfer = methodName.toLowerCase().includes('transfe') || methodName.toLowerCase().includes('banco') || methodName.toLowerCase().includes('llaves');
          const isOptimistic = isOptimisticId(method);
          const theme = isCard ? {
            border: 'border-purple-200 hover:border-purple-400 dark:border-purple-500/30 dark:hover:border-purple-400/50',
            bg: 'from-purple-50/40 via-white to-purple-50/10 dark:from-slate-800 dark:via-slate-800/90 dark:to-slate-900 shadow-purple-500/5 dark:shadow-purple-500/10',
            iconBg: 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400',
            tagBg: 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20',
            label: 'Tarjeta / Crédito'
          } : isTransfer ? {
            border: 'border-emerald-200 hover:border-emerald-400 dark:border-emerald-500/30 dark:hover:border-emerald-400/50',
            bg: 'from-emerald-50/40 via-white to-emerald-50/10 dark:from-slate-800 dark:via-slate-800/90 dark:to-slate-900 shadow-emerald-500/5 dark:shadow-emerald-500/10',
            iconBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
            tagBg: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
            label: 'Transferencia / Banco'
          } : {
            border: 'border-amber-200 hover:border-amber-400 dark:border-amber-500/30 dark:hover:border-amber-400/50',
            bg: 'from-amber-50/40 via-white to-amber-50/10 dark:from-slate-800 dark:via-slate-800/90 dark:to-slate-900 shadow-amber-500/5 dark:shadow-amber-500/10',
            iconBg: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
            tagBg: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
            label: 'Efectivo / Otros'
          };

          return (
            <div key={method.id ?? `pm-${idx}`} className={`bg-gradient-to-br ${theme.bg} border ${theme.border} rounded-2xl p-5 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between group relative overflow-hidden min-h-[130px] ${isOptimistic ? 'opacity-70 animate-pulse' : ''}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${theme.iconBg} flex items-center justify-center transition-transform group-hover:rotate-6 duration-300 shadow-sm`}>
                    <Coins size={18} />
                  </div>
                  <div>
                    <span className="font-heading font-bold text-gray-800 dark:text-slate-100 text-xs block group-hover:text-primary dark:group-hover:text-teal-400 transition-colors">{methodName}</span>
                    <span className="text-[9px] text-gray-400 dark:text-slate-400 font-mono tracking-wider">{isOptimistic ? '⏳ Guardando...' : `REF ID: #${method.id != null ? method.id.toString().padStart(3, '0') : '---'}`}</span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 top-4">
                  <button onClick={() => handleOpenModal(method)} className="p-1.5 text-gray-400 dark:text-slate-400 hover:text-primary rounded-lg hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-gray-100 dark:hover:border-slate-600 shadow-sm transition-all" title="Editar" disabled={isOptimistic}>
                    <Pencil size={11} />
                  </button>
                  <button onClick={() => handleDelete(method.id)} className="p-1.5 text-red-400 dark:text-red-400 hover:text-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/20 border border-transparent hover:border-red-100 dark:hover:border-red-500/30 shadow-sm transition-all" title="Eliminar" disabled={isOptimistic}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center border-t border-gray-100/60 dark:border-slate-700 pt-3 mt-auto">
                <span className="text-[9px] text-gray-400 dark:text-slate-400 font-bold uppercase tracking-wider">{theme.label}</span>
                <span className={`text-[8px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-widest flex items-center gap-1 ${
                  isOptimistic ? 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' : theme.tagBg
                }`}>
                  <span className={`w-1 h-1 rounded-full bg-current ${isOptimistic ? 'animate-ping' : ''}`} /> {isOptimistic ? 'Procesando' : 'Activo'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (section === 'documentTypes') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filteredData.map((doc, idx) => {
          const docName = doc.name || doc.nombre || '';
          const isNational = docName.toLowerCase().includes('cédula') || docName.toLowerCase().includes('cc') || docName.toLowerCase().includes('nit');
          const isOptimistic = isOptimisticId(doc);
          const theme = isNational ? {
            border: 'border-blue-200 hover:border-blue-400 dark:border-blue-500/30 dark:hover:border-blue-400/50',
            bg: 'from-blue-50/40 via-white to-blue-50/10 dark:from-slate-800 dark:via-slate-800/90 dark:to-slate-900 shadow-blue-500/5 dark:shadow-blue-500/10',
            iconBg: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
            tagBg: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
            label: 'Nacional / Colombia'
          } : {
            border: 'border-teal-200 hover:border-teal-400 dark:border-teal-500/30 dark:hover:border-teal-400/50',
            bg: 'from-teal-50/40 via-white to-teal-50/10 dark:from-slate-800 dark:via-slate-800/90 dark:to-slate-900 shadow-teal-500/5 dark:shadow-teal-500/10',
            iconBg: 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400',
            tagBg: 'bg-teal-50 text-teal-700 border-teal-100 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20',
            label: 'Internacional / Global'
          };

          return (
            <div key={doc.id ?? `doc-${idx}`} className={`bg-gradient-to-br ${theme.bg} border ${theme.border} rounded-2xl p-5 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between group relative overflow-hidden min-h-[130px] ${isOptimistic ? 'opacity-70 animate-pulse' : ''}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${theme.iconBg} flex items-center justify-center transition-transform group-hover:rotate-6 duration-300 shadow-sm`}>
                    <IdCard size={18} />
                  </div>
                  <div>
                    <span className="font-heading font-bold text-gray-800 dark:text-slate-100 text-xs block group-hover:text-primary dark:group-hover:text-teal-400 transition-colors">{docName}</span>
                    <span className="text-[9px] text-gray-400 dark:text-slate-400 font-mono tracking-wider">{isOptimistic ? '⏳ Guardando...' : `REF ID: #${doc.id != null ? doc.id.toString().padStart(3, '0') : '---'}`}</span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 top-4">
                  <button onClick={() => handleOpenModal(doc)} className="p-1.5 text-gray-400 dark:text-slate-400 hover:text-primary rounded-lg hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-gray-100 dark:hover:border-slate-600 shadow-sm transition-all" title="Editar" disabled={isOptimistic}>
                    <Pencil size={11} />
                  </button>
                  <button onClick={() => handleDelete(doc.id)} className="p-1.5 text-red-400 dark:text-red-400 hover:text-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/20 border border-transparent hover:border-red-100 dark:hover:border-red-500/30 shadow-sm transition-all" title="Eliminar" disabled={isOptimistic}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center border-t border-gray-100/60 dark:border-slate-700 pt-3 mt-auto">
                <span className="text-[9px] text-gray-400 dark:text-slate-400 font-bold uppercase tracking-wider">{theme.label}</span>
                <span className={`text-[8px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-widest flex items-center gap-1 ${
                  isOptimistic ? 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' : theme.tagBg
                }`}>
                  <span className={`w-1 h-1 rounded-full bg-current ${isOptimistic ? 'animate-ping' : ''}`} /> {isOptimistic ? 'Procesando' : 'Habilitado'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (section === 'airlines') {
    const nationals = filteredData.filter(a => (a.type || 'Internacional') === 'Nacional');
    const internationals = filteredData.filter(a => (a.type || 'Internacional') === 'Internacional');

    const renderCard = (airline: any) => {
      const isOptimistic = isOptimisticId(airline);
      return (
        <div key={airline.id} className={`bg-white dark:bg-slate-800 border border-gray-border dark:border-slate-700 hover:border-accent/40 dark:hover:border-accent/60 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between group ${isOptimistic ? 'opacity-70 animate-pulse bg-gray-50/40 dark:bg-slate-800/40' : ''}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              isOptimistic ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' :
              (airline.type || 'Internacional') === 'Nacional' 
                ? 'bg-accent/5 text-accent group-hover:bg-accent/10 dark:bg-accent/20 dark:text-teal-400 dark:group-hover:bg-accent/30' 
                : 'bg-primary/5 text-primary group-hover:bg-primary/10 dark:bg-primary/20 dark:text-blue-400 dark:group-hover:bg-primary/30'
            }`}>
              <PlaneTakeoff size={18} />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-gray-800 dark:text-slate-100 text-xs block truncate">{isOptimistic ? '⏳ ' : ''}{airline.name}</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono bg-primary/5 dark:bg-primary/20 text-primary dark:text-blue-400 px-1.5 py-0.2 rounded text-[9px] font-bold">{isOptimistic ? '...' : airline.code}</span>
                {airline.website && !isOptimistic && (
                  <a 
                    href={airline.website} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[10px] text-accent dark:text-teal-400 hover:underline truncate max-w-[120px] font-semibold"
                    title={`Visitar sitio oficial de ${airline.name}`}
                  >
                    Sitio Web ↗
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => handleOpenModal(airline)} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-primary dark:hover:text-teal-400 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700" title="Editar" disabled={isOptimistic}>
              <Pencil size={13} />
            </button>
            <button onClick={() => handleDelete(airline.id)} className="p-1.5 text-red-500 dark:text-red-400 hover:text-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-500/20" title="Eliminar" disabled={isOptimistic}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-6">
        {nationals.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-700 pb-2">
              <span className="w-1.5 h-4 bg-accent dark:bg-teal-400 rounded-full" />
              <h3 className="font-heading font-bold text-xs text-accent dark:text-teal-400 uppercase tracking-wider">Aerolíneas Nacionales</h3>
              <span className="text-[10px] bg-accent/5 dark:bg-teal-400/10 text-accent dark:text-teal-400 px-2 py-0.5 rounded-full font-bold">{nationals.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {nationals.map(renderCard)}
            </div>
          </div>
        )}
        {internationals.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-700 pb-2">
              <span className="w-1.5 h-4 bg-primary dark:bg-blue-400 rounded-full" />
              <h3 className="font-heading font-bold text-xs text-primary dark:text-blue-400 uppercase tracking-wider">Aerolíneas Internacionales</h3>
              <span className="text-[10px] bg-primary/5 dark:bg-blue-400/10 text-primary dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">{internationals.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {internationals.map(renderCard)}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (section === 'suppliers') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredData.map((supplier) => {
          const isOptimistic = isOptimisticId(supplier);
          return (
            <div key={supplier.id} className={`bg-white dark:bg-slate-800 border border-gray-border dark:border-slate-700 hover:border-accent/40 dark:hover:border-accent/60 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group relative overflow-hidden ${isOptimistic ? 'opacity-70 animate-pulse bg-gray-50/40 dark:bg-slate-800/40' : ''}`}>
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
                isOptimistic ? 'from-amber-400 to-amber-500 animate-pulse' :
                supplier.type === 'Hotel' ? 'from-green-500 to-emerald-600' :
                supplier.type === 'Operador' ? 'from-amber-500 to-orange-600' : 'from-primary to-blue-800'
              }`} />
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-slate-700 flex items-center justify-center text-gray-500 dark:text-slate-400 group-hover:text-accent dark:group-hover:text-teal-400 transition-colors">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-slate-100 text-xs">{supplier.name}</h3>
                    <span className="text-[10px] text-gray-400 dark:text-slate-400 font-mono">{isOptimistic ? '⏳ Guardando...' : `Proveedor #${supplier.id}`}</span>
                  </div>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                  isOptimistic ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' :
                  supplier.type === 'Hotel' ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20' :
                  supplier.type === 'Operador' ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' :
                  'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'
                }`}>
                  {isOptimistic ? 'Guardando' : supplier.type}
                </span>
              </div>
              <div className="border-t border-gray-100 dark:border-slate-700 pt-3 mt-1 flex justify-between items-center">
                <div className="flex flex-col gap-1 min-w-0">
                  <a href={`mailto:${supplier.email}`} className="text-[10px] text-primary dark:text-blue-400 hover:text-accent dark:hover:text-teal-400 hover:underline flex items-center gap-1 min-w-0" title="Enviar Correo">
                    <span className="truncate max-w-[150px] font-mono">{supplier.email}</span>
                  </a>
                  <p className="text-[10px] text-gray-500 dark:text-slate-400 flex items-center gap-1">
                    <span className="font-semibold">Tel:</span> {supplier.phone}
                  </p>
                  {supplier.website && !isOptimistic && (
                    <a 
                      href={supplier.website} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[10px] text-accent dark:text-teal-400 hover:underline font-semibold"
                      title={`Visitar sitio de ${supplier.name}`}
                    >
                      Sitio Web ↗
                    </a>
                  )}
                  {supplier.observations && !isOptimistic && (
                    <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-1 leading-relaxed italic border-t border-gray-100 dark:border-slate-700 pt-1">
                      {supplier.observations}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleOpenModal(supplier)} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-primary dark:hover:text-teal-400 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700" title="Editar" disabled={isOptimistic}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(supplier.id)} className="p-1.5 text-red-500 dark:text-red-400 hover:text-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-500/20" title="Eliminar" disabled={isOptimistic}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (section === 'airports') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredData.map((airport) => {
          const isOptimistic = isOptimisticId(airport);
          return (
            <div key={airport.id} className={`bg-white dark:bg-slate-800 border border-gray-border dark:border-slate-700 hover:border-accent/40 dark:hover:border-accent/60 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group relative overflow-hidden ${isOptimistic ? 'opacity-70 animate-pulse bg-gray-50/40 dark:bg-slate-800/40' : ''}`}>
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
                isOptimistic ? 'from-amber-400 to-amber-500 animate-pulse' :
                (airport.type || 'Ambos') === 'Nacional' ? 'from-amber-400 to-orange-500' :
                (airport.type || 'Ambos') === 'Internacional' ? 'from-primary to-blue-700' :
                'from-accent to-primary'
              }`} />
              
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-slate-700 flex items-center justify-center text-primary dark:text-blue-400 group-hover:text-accent dark:group-hover:text-teal-400 transition-colors flex-shrink-0">
                    <Compass size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-800 dark:text-slate-100 text-xs truncate" title={airport.name}>
                      {airport.name}
                    </h3>
                    <p className="text-[10px] text-gray-400 dark:text-slate-400 truncate">{airport.location}</p>
                  </div>
                </div>
                <span className="font-mono bg-primary/5 dark:bg-primary/20 text-primary dark:text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0">
                  {isOptimistic ? '⏳' : airport.abbreviation}
                </span>
              </div>

              <div className="border-t border-gray-100 dark:border-slate-700 pt-3 mt-1 flex justify-between items-center">
                <div className="flex gap-1.5 items-center">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                    isOptimistic ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' :
                    (airport.type || 'Ambos') === 'Nacional' ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' :
                    (airport.type || 'Ambos') === 'Internacional' ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20' :
                    'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20'
                  }`}>
                    {isOptimistic ? 'Guardando' : (airport.type || 'Ambos')}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                    isOptimistic ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 animate-pulse' :
                    (airport.status || 'Activo') === 'Activo' 
                      ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20' 
                      : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                  }`}>
                    <span className={`w-1 h-1 rounded-full ${
                      isOptimistic ? 'bg-amber-500 animate-ping' :
                      (airport.status || 'Activo') === 'Activo' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    {isOptimistic ? 'Procesando' : (airport.status || 'Activo')}
                  </span>
                </div>
                
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleOpenModal(airport)} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-primary dark:hover:text-teal-400 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700" title="Editar" disabled={isOptimistic}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(airport.id)} className="p-1.5 text-red-500 dark:text-red-400 hover:text-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-500/20" title="Eliminar" disabled={isOptimistic}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (section === 'baggage') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredData.map((bag) => {
          const isOptimistic = isOptimisticId(bag);
          return (
            <div key={bag.id} className={`bg-white dark:bg-slate-800 border border-gray-border dark:border-slate-700 hover:border-accent/40 dark:hover:border-accent/60 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group relative overflow-hidden ${isOptimistic ? 'opacity-70 animate-pulse bg-gray-50/40 dark:bg-slate-800/40' : ''}`}>
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
                isOptimistic ? 'from-amber-400 to-amber-500 animate-pulse' :
                bag.airlineName === 'Avianca' ? 'from-red-500 to-rose-600' :
                bag.airlineName === 'LATAM' ? 'from-indigo-600 to-blue-800' :
                'from-accent to-emerald-500'
              }`} />
              
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-slate-700 flex items-center justify-center text-primary dark:text-blue-400 group-hover:text-accent dark:group-hover:text-teal-400 transition-colors">
                      <Luggage size={16} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 dark:text-slate-100 text-xs">{bag.airlineName}</h3>
                      <span className="text-[10px] bg-primary/5 dark:bg-primary/20 text-primary dark:text-blue-400 font-bold px-2 py-0.5 rounded-full">
                        {bag.fareType}
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] text-gray-400 dark:text-slate-400 font-mono">{isOptimistic ? '⏳ Guardando...' : `ID: #${bag.id}`}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-gray-50/50 dark:bg-slate-700/50 p-2.5 rounded-lg border border-gray-100 dark:border-slate-700 my-3 text-[10px]">
                  <div className="text-center">
                    <span className="block font-bold text-gray-400 uppercase tracking-wider text-[8px] mb-1">Bolso</span>
                    <p className="font-semibold text-gray-700 dark:text-slate-300 truncate" title={bag.personalItem}>{bag.personalItem}</p>
                  </div>
                  <div className="text-center border-x border-gray-200 dark:border-slate-600">
                    <span className="block font-bold text-gray-400 uppercase tracking-wider text-[8px] mb-1">Mano</span>
                    <p className="font-semibold text-gray-700 dark:text-slate-300 truncate" title={bag.carryOn}>{bag.carryOn}</p>
                  </div>
                  <div className="text-center">
                    <span className="block font-bold text-gray-400 uppercase tracking-wider text-[8px] mb-1">Bodega</span>
                    <p className="font-semibold text-gray-700 dark:text-slate-300 truncate" title={bag.checkedBag}>{bag.checkedBag}</p>
                  </div>
                </div>

                {bag.notes && (
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 italic mt-1 line-clamp-2" title={bag.notes}>
                    💡 {bag.notes}
                  </p>
                )}
              </div>

              <div className="border-t border-gray-100 dark:border-slate-700 pt-3 mt-3 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleOpenModal(bag)} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-primary dark:hover:text-teal-400 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700" title="Editar" disabled={isOptimistic}>
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(bag.id)} className="p-1.5 text-red-500 dark:text-red-400 hover:text-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-500/20" title="Eliminar" disabled={isOptimistic}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (section === 'packages') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredData.map((pkg) => {
          const isOptimistic = isOptimisticId(pkg);
          return (
            <div key={pkg.id} className={`bg-white dark:bg-slate-800 border border-gray-border dark:border-slate-700 hover:border-accent/40 dark:hover:border-accent/60 rounded-2xl p-0 shadow-sm hover:shadow-xl transition-all duration-300 group relative overflow-hidden flex flex-col ${isOptimistic ? 'opacity-70 animate-pulse bg-gray-50/40 dark:bg-slate-800/40' : ''}`}>
              {/* Header / Image Placeholder */}
              <div className="h-32 bg-gradient-to-r from-primary to-accent relative flex items-center justify-center overflow-hidden">
                <Boxes size={64} className="text-white/20 absolute -right-4 -bottom-4 rotate-12" />
                <div className="text-center z-10 p-4">
                  <h3 className="text-white font-bold text-lg leading-tight drop-shadow-md">{pkg.name}</h3>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <MapPin size={12} className="text-accent dark:text-teal-400" />
                    <span className="text-white/90 text-xs font-medium">{pkg.destination}</span>
                  </div>
                </div>
                <div className="absolute top-4 left-4 bg-white/20 backdrop-blur-md px-2 py-1 rounded-lg border border-white/30">
                  <span className="text-white text-[10px] font-bold uppercase tracking-tighter">{pkg.nights} Noches</span>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Building2 size={10} /> Hotel
                    </span>
                    <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 truncate">{pkg.accommodation?.hotel || '-'}</p>
                    <p className="text-[10px] text-accent dark:text-teal-400 font-medium">{formatMealPlan(pkg.accommodation?.mealPlan)}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <PlaneTakeoff size={10} /> Vuelo
                    </span>
                    <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 truncate">{pkg.flight?.airline || '-'}</p>
                    <p className="text-[10px] text-gray-500 dark:text-slate-400">{pkg.flight?.route || '-'}</p>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3 border border-gray-100 dark:border-slate-600 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Tarifas Base</span>
                    <ShieldCheck size={14} className="text-emerald-500" />
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[9px] text-gray-500 dark:text-slate-400 uppercase">Adulto</p>
                      <p className="text-sm font-bold text-primary dark:text-blue-400">
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(pkg.rates?.adult || 0)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-gray-500 dark:text-slate-400 uppercase">Menor</p>
                      <p className="text-sm font-bold text-gray-600 dark:text-slate-300">
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(pkg.rates?.child || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center">
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono tracking-tighter">{isOptimistic ? '⏳ Guardando...' : `PKG-ID: #${pkg.id != null ? pkg.id.toString().padStart(4, '0') : '----'}`}</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setViewingPackage(pkg)}
                      className="p-2 rounded-xl bg-gray-50 dark:bg-slate-700 text-primary dark:text-blue-400 hover:bg-primary dark:hover:bg-blue-600 hover:text-white transition-all duration-300 shadow-sm"
                      title="Ver Detalle"
                      disabled={isOptimistic}
                    >
                      <Eye size={14} />
                    </button>
                    <button 
                      onClick={() => handleOpenModal(pkg)}
                      className="p-2 rounded-xl bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-primary dark:hover:bg-blue-600 hover:text-white transition-all duration-300 shadow-sm"
                      title="Editar"
                      disabled={isOptimistic}
                    >
                      <Pencil size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(pkg.id)}
                      className="p-2 rounded-xl bg-gray-50 dark:bg-slate-700 text-red-400 dark:text-red-400 hover:bg-red-500 hover:text-white transition-all duration-300 shadow-sm"
                      title="Eliminar"
                      disabled={isOptimistic}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}
