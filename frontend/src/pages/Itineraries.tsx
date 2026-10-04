import { useState, useCallback } from 'react';
import { X, Calendar as CalendarIcon, UserCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { usePermissions } from '../context/PermissionsContext';
import type { CheckinCounts } from '../types';
import { COUNTS_VACIOS } from '../components/itineraries/checkinUi';
import { CalendarioVuelos } from '../components/itineraries/CalendarioVuelos';
import { ListaCheckin } from '../components/itineraries/ListaCheckin';

export default function Itineraries() {
  const { flightsRefreshToken } = useData();
  const { canView } = usePermissions();
  // Se incrementa tras un check-in para releer el calendario y la lista.
  const [refreshToken, setRefreshToken] = useState(0);
  const [activeTab, setActiveTab] = useState<'calendar' | 'checkin'>('calendar');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [counts, setCounts] = useState<CheckinCounts>(COUNTS_VACIOS);

  const avisar = useCallback((ok: boolean, mensaje: string, ms = ok ? 3000 : 5000) => {
    if (ok) {
      setSuccessMessage(mensaje);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), ms);
    } else {
      setErrorMessage(mensaje);
      setShowError(true);
      setTimeout(() => setShowError(false), ms);
    }
  }, []);
  const releer = useCallback(() => setRefreshToken(t => t + 1), []);

  if (!canView('itineraries')) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500">
        <AlertCircle size={48} className="mb-4 opacity-20" />
        <p className="text-lg font-medium">Acceso Restringido</p>
        <p className="text-sm">No tiene permisos para ver itinerarios.</p>
      </div>
    );
  }

  // Los dos contadores solo crecen: su suma cambia cuando cambia cualquiera de ellos.
  const refresco = refreshToken + flightsRefreshToken;

  return (
    <div className="space-y-6 relative">
      {showSuccess && (
        <div className="fixed top-20 right-6 z-[200] bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 animate-slide-in-right">
          <div className="bg-green-500 text-white rounded-full p-1">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <p className="font-bold text-sm">Operación Exitosa</p>
            <p className="text-xs opacity-90">{successMessage}</p>
          </div>
        </div>
      )}

      {showError && (
        <div className="fixed top-20 right-6 z-[200] bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 animate-slide-in-right">
          <div className="bg-red-500 text-white rounded-full p-1">
            <X size={18} />
          </div>
          <div>
            <p className="font-bold text-sm">Error</p>
            <p className="text-xs opacity-90">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Header y Navegación Principal */}
      <div className="flex flex-col items-center justify-center gap-4 animate-fade-in text-center mb-4">
        <div className="flex flex-col items-center justify-center">
          <h1 className="text-3xl font-bold text-primary flex items-center justify-center gap-3">
            <CalendarIcon className="text-accent w-8 h-8" /> Itinerarios de Vuelo
          </h1>
          <p className="text-gray-500 text-sm mt-1">Seguimiento de salidas, regresos y gestión de check-in.</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-border w-fit h-fit">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'calendar' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <CalendarIcon size={16} /> Calendario
          </button>
          <button
            onClick={() => setActiveTab('checkin')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all relative ${activeTab === 'checkin' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <UserCheck size={16} /> Check-in
            {/* Siempre los pendientes: pendingMeta.total depende del filtro
                activo, así que en "Realizados" mostraría el número equivocado. */}
            {counts.pendiente > 0 ? (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white">
                {counts.pendiente}
              </span>
            ) : null}
          </button>
        </div>
      </div>


      {/* Las dos pestañas se quedan montadas (solo se ocultan): cambiar de una a otra no pierde el mes
          elegido ni la página de la lista, igual que cuando todo vivía en este componente. */}
      <div className={activeTab === 'calendar' ? '' : 'hidden'}>
        <CalendarioVuelos refresco={refresco} />
      </div>
      <div className={activeTab === 'checkin' ? '' : 'hidden'}>
        <ListaCheckin refresco={refresco} onCambio={releer} onContadores={setCounts} avisar={avisar} />
      </div>
    </div>
  );
}
