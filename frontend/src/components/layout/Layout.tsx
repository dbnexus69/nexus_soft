import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../../context/AuthContext';
import { stopImpersonation } from '../../api';

export function Layout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, marca } = useAuth();
  const [isStopping, setIsStopping] = useState(false);

  const salirSuplantacion = async () => {
    if (user?.suplantacionId && user.empresaId) {
      setIsStopping(true);
      try {
        await stopImpersonation(user.empresaId, user.suplantacionId);
        
        const originalToken = localStorage.getItem('nexus_original_token');
        if (originalToken) {
          localStorage.setItem('nexus_token', originalToken);
          localStorage.removeItem('nexus_original_token');
          // No sabemos la expiración exacta del original aquí de forma fácil, pero 
          // limpiar la actual basta, el AuthContext recargará y refrescará si sigue vivo.
          localStorage.removeItem('nexus_session_expiry');
          window.location.href = '/';
        } else {
          localStorage.removeItem('nexus_token');
          localStorage.removeItem('nexus_session_expiry');
          window.location.href = '/login';
        }
      } catch (e) {
        console.error(e);
        setIsStopping(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090b11] text-slate-800 dark:text-slate-200 transition-colors duration-300 relative overflow-hidden font-body">

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <Sidebar isMobileOpen={isMobileOpen} onClose={() => setIsMobileOpen(false)} />
      
      <div className="pl-0 md:pl-0 md:pt-24 transition-all duration-300 relative z-10">
        {user?.suplantacionId && (
          <div className="bg-red-600 text-white px-4 py-2 text-center text-sm font-medium flex justify-center items-center gap-4">
            <span>Estás operando en nombre de <strong>{marca?.nombre || user.empresaSlug}</strong></span>
            <button 
              onClick={salirSuplantacion} 
              disabled={isStopping}
              className="bg-red-800 hover:bg-red-900 px-3 py-1 rounded text-xs transition-colors"
            >
              {isStopping ? 'Saliendo...' : 'Salir de la suplantación'}
            </button>
          </div>
        )}
        <div className="md:hidden">
          <Header onMenuToggle={() => setIsMobileOpen(true)} />
        </div>
        <main className="p-4 md:p-6 min-h-[calc(100vh-90px)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}