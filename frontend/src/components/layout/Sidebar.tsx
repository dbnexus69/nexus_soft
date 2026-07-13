import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Compass,
  Wallet,
  Contact,
  Globe,
  BadgePercent,
  Users,
  UserCog,
  SlidersHorizontal,
  Settings,
  LogOut,
  X,
  Sun,
  Moon,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionsContext";
import { getInitials, getAvatarGradient } from "../../utils/formatters";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { SidebarUserProfile } from "./SidebarUserProfile";
import { useTheme } from "../../context/ThemeContext";
import { useData } from "../../context/DataContext";

interface SidebarProps {
  isMobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isMobileOpen = false, onClose }: SidebarProps) {
  const { user, logout, isAdmin } = useAuth();
  const { canView } = usePermissions();
  const [isHovered, setIsHovered] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isExpanded = isHovered || isMobileOpen;

  const location = useLocation();
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
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

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
        refreshData(); 
      }
    } finally {
      setTimeout(() => setIsSpinning(false), 500);
    }
  };

  const getShortName = (name?: string) => {
    if (!name) return "";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 4) return `${parts[0]} ${parts[2]}`; // Primer nombre y primer apellido
    if (parts.length === 3) return `${parts[0]} ${parts[1]}`; // Primer nombre y primer apellido
    return name;
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    logout();
  };

  const mainLinks = [
    { to: "/", icon: Compass, label: "Dashboard", permission: 'dashboard' as const },
    { to: "/sales", icon: Wallet, label: "Ventas", permission: 'sales' as const },
    { to: "/clients", icon: Contact, label: "Clientes", permission: 'clients' as const },
    { to: "/itineraries", icon: Globe, label: "Vuelos", permission: 'itineraries' as const },
    { to: "/commissions", icon: BadgePercent, label: "Comisionistas", permission: 'commissions' as const },
  ];

  const adminLinks = [
    { to: "/users", icon: Users, label: "Usuarios", permission: 'users' as const },
    { to: "/responsables", icon: UserCog, label: "Responsables", permission: 'responsables' as const },
    { to: "/config", icon: SlidersHorizontal, label: "Gestión Interna", permission: 'config' as const },
  ];

  const filteredMainLinks = mainLinks.filter(link => canView(link.permission));
  const filteredAdminLinks = (adminLinks as any[]).filter(link => {
    if (link.permission === 'users' || link.permission === 'config' || link.permission === 'responsables') {
      return isAdmin;
    }
    return canView(link.permission);
  });

  return (
    <>
      {/* MOBILE SIDEBAR (Drawer) */}
      <aside 
        className={`fixed left-0 top-0 h-screen bg-[#0b0f19] text-white flex flex-col transition-all duration-300 ease-in-out z-50 shadow-2xl border-r border-slate-800/40 w-64 md:hidden
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Mobile Header / Logo */}
        <div className="p-5 border-b border-slate-800/80 flex justify-between items-center">
          <img 
            src="/db_nexus_logo.png" 
            className="h-11 w-auto object-contain select-none invert" 
            alt="DB NEXUS Logo" 
          />
          <button 
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mobile Nav Links */}
        <nav className="flex-grow py-6 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <ul className="space-y-2 px-3">
            {filteredMainLinks.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive ? "bg-white/10 text-white font-bold" : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`
                  }
                >
                  <link.icon size={20} />
                  <span>{link.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>

          {isAdmin && filteredAdminLinks.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-800/40">
              <div className="px-4 py-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Administración</span>
              </div>
              <ul className="space-y-2 px-3 mt-2">
                {filteredAdminLinks.map((link) => (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                          isActive ? "bg-white/10 text-white font-bold" : "text-slate-300 hover:bg-white/5 hover:text-white"
                        }`
                      }
                    >
                      <link.icon size={20} />
                      <span>{link.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>

        {/* Mobile User Profile */}
        <SidebarUserProfile
          user={user}
          isExpanded={true}
          onLogoutClick={() => setIsConfirmOpen(true)}
        />
      </aside>

      {/* DESKTOP NAVBAR (Horizontal Floating Top Bar) */}
      <header className="hidden md:flex fixed top-4 left-4 right-4 h-16 bg-[#0b0f19]/95 backdrop-blur-xl border border-slate-800/40 rounded-2xl shadow-2xl items-center justify-between px-6 z-50 transition-all duration-300">
        
        {/* Left: Logo */}
        <div className="flex items-center gap-2.5 select-none cursor-pointer">
          <img 
            src="/db_nexus_icon.png" 
            className="h-10 w-auto object-contain select-none invert hover:scale-105 transition-transform duration-200" 
            alt="DB NEXUS" 
          />
          <span className="text-base font-black tracking-tight text-white font-heading">
            DB <span className="text-[#8D99AE] font-bold">NEXUS</span>
          </span>
        </div>

        {/* Center: Navigation Links */}
        <nav className="flex items-center h-full">
          <ul className="flex items-center gap-1.5 font-body">
            {filteredMainLinks.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? "bg-white/10 text-white font-bold shadow-sm"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`
                  }
                >
                  <link.icon size={18} />
                  <span>{link.label}</span>
                </NavLink>
              </li>
            ))}

            {/* Admin Dropdown Links */}
            {isAdmin && filteredAdminLinks.length > 0 && (
              <li className="relative">
                <button
                  onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isAdminMenuOpen || filteredAdminLinks.some(link => location.pathname === link.to)
                      ? "bg-white/10 text-white font-bold"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <UserCog size={18} />
                  <span>Administración</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${isAdminMenuOpen ? "rotate-180" : ""}`} />
                </button>
                {isAdminMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsAdminMenuOpen(false)} />
                    <ul className="absolute left-0 mt-2 w-48 bg-[#0b0f19] border border-slate-800/80 rounded-2xl shadow-2xl p-2 z-50 animate-fade-in font-body">
                      {filteredAdminLinks.map((link) => (
                        <li key={link.to}>
                          <NavLink
                            to={link.to}
                            onClick={() => setIsAdminMenuOpen(false)}
                            className={({ isActive }) =>
                              `flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all w-full text-left ${
                                isActive
                                  ? "bg-white/10 text-white font-bold"
                                  : "text-slate-300 hover:bg-white/5 hover:text-white"
                              }`
                            }
                          >
                            <link.icon size={16} />
                            <span>{link.label}</span>
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </li>
            )}
          </ul>
        </nav>

        {/* Right: Actions, Date & Profile Dropdown */}
        <div className="flex items-center gap-3 font-body">
          
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isSpinning}
            className={`p-2 hover:bg-white/5 rounded-xl transition-all text-slate-300 hover:text-white ${isSpinning ? 'opacity-50' : ''}`}
            title="Actualizar datos"
          >
            <RefreshCw size={16} className={isSpinning ? 'animate-spin text-accent' : ''} />
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 hover:bg-white/5 rounded-xl transition-all text-slate-300 hover:text-white"
            title={isDarkMode ? 'Modo claro' : 'Modo oscuro'}
          >
            {isDarkMode ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} />}
          </button>

          {/* Profile Dropdown Widget */}
          <div className="relative">
            <button 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 hover:bg-white/5 p-1 px-2.5 rounded-xl transition-all text-slate-300 hover:text-white"
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover border border-accent"
                />
              ) : (
                <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${getAvatarGradient(user?.name || "User")} font-extrabold flex items-center justify-center text-xs shadow-sm border border-white/10`}>
                  {getInitials(user?.name || "User")}
                </div>
              )}
              <span className="text-xs font-semibold hidden lg:inline">{getShortName(user?.name)}</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>

            {isUserMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-52 bg-[#0b0f19] border border-slate-800/80 rounded-2xl shadow-2xl p-4 z-50 animate-fade-in text-left">
                  <div className="pb-3 border-b border-slate-800/60 mb-2">
                    <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                    <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">{user?.role}</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsConfirmOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-bold transition-all"
                  >
                    <LogOut size={14} />
                    Cerrar Sesión
                  </button>
                </div>
              </>
            )}
          </div>

        </div>

      </header>

      {/* LOGOUT CONFIRMATION MODAL */}
      <Modal
        isOpen={isConfirmOpen}
        onClose={() => !isLoggingOut && setIsConfirmOpen(false)}
        title="Confirmar Cierre de Sesión"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)} disabled={isLoggingOut}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? "Cerrando sesión..." : "Cerrar Sesión"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center text-center py-4 font-body">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4">
            <LogOut size={32} />
          </div>
          <p className="text-slate-700 dark:text-slate-300 text-sm">
            ¿Estás seguro de que deseas <strong>cerrar sesión</strong>?
          </p>
        </div>
      </Modal>
    </>
  );
}
