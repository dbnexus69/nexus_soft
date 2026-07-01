import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, BarChart3, Menu, RefreshCw, Moon, Sun } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useTheme } from '../../context/ThemeContext';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/sales': 'Ventas',
  '/clients': 'Clientes',
  '/itineraries': 'Itinerarios',
  '/users': 'Usuarios',
  '/config': 'Catálogos',
  '/commissions': 'Comisionistas',
  '/responsables': 'Responsables'
};

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/stats', label: 'Estadísticas', icon: BarChart3 },
];

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'iTea';
  const isRootPath = location.pathname === '/' || location.pathname === '/stats';
  const activeNav = location.pathname === '/stats' ? '/stats' : '/';
  
  const { isDarkMode, toggleDarkMode } = useTheme();
  
  const { 
    refreshData,
    fetchSales,
    fetchClients,
    fetchResponsables,
    fetchFlights,
    fetchUsers,
    fetchConfig,
    fetchCommissionAgents 
  } = useData();

  const [isSpinning, setIsSpinning] = useState(false);

  const handleRefresh = async () => {
    setIsSpinning(true);
    try {
      const path = location.pathname;
      if (path === '/users') await fetchUsers();
      else if (path === '/responsables') await fetchResponsables();
      else if (path === '/config') await fetchConfig();
      else if (path === '/commissions') await fetchCommissionAgents();
      else if (path === '/clients') await fetchClients();
      else if (path === '/itineraries') await fetchFlights();
      else if (path === '/sales') {
        await Promise.all([fetchSales(), fetchClients(), fetchResponsables(), fetchCommissionAgents()]);
      }
      else {
        // Fallback for Dashboard / Stats
        refreshData(); 
      }
    } finally {
      setTimeout(() => setIsSpinning(false), 500); // Visual feedback
    }
  };

  return (
    <div className="sticky top-0 z-40 flex flex-col">
      <header className="bg-white/85 dark:bg-[#090b11]/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/60 px-4 md:px-6 py-3.5 transition-colors duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Toggle */}
            <button 
              onClick={onMenuToggle}
              className="md:hidden p-1.5 -ml-1.5 text-slate-500 hover:text-primary dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 text-sm font-body">
              <span className="text-slate-400 dark:text-slate-500 hidden sm:inline font-bold">NEXUS</span>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
              <span className="font-heading font-bold text-primary dark:text-amber-400">{title}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 font-body">
            <button
              onClick={toggleDarkMode}
              className="p-2 text-slate-400 hover:text-primary dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl transition-colors"
              title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={handleRefresh}
              disabled={isSpinning}
              className={`p-2 text-slate-400 hover:text-primary dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl transition-colors ${isSpinning ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Actualizar datos"
            >
              <RefreshCw size={16} className={isSpinning ? 'animate-spin text-primary dark:text-amber-400' : ''} />
            </button>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800/60 hidden sm:block">
              {new Date().toLocaleDateString('es-CO', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </div>
          </div>
        </div>
      </header>
      {isRootPath && (
        <nav className="bg-white/80 dark:bg-[#090b11]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/60 px-6 transition-colors duration-300">
          <div className="flex gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all relative ${
                    isActive
                      ? 'text-primary dark:text-white border-primary dark:border-white font-semibold'
                      : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}