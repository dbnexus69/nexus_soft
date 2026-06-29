import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  DollarSign,
  Users,
  Plane,
  UserCog,
  Settings,
  LogOut,
  Database,
  Coins,
  X,
  UserCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionsContext";
import { getInitials } from "../../utils/formatters";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { SidebarUserProfile } from "./SidebarUserProfile";

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
    { to: "/", icon: LayoutDashboard, label: "Dashboard", permission: 'dashboard' as const },
    { to: "/sales", icon: DollarSign, label: "Ventas", permission: 'sales' as const },
    { to: "/clients", icon: Users, label: "Clientes", permission: 'clients' as const },
    { to: "/itineraries", icon: Plane, label: "Itinerarios", permission: 'itineraries' as const },
    { to: "/commissions", icon: Coins, label: "Comisionistas", permission: 'commissions' as const },
  ];

  const adminLinks = [
    { to: "/users", icon: UserCog, label: "Usuarios", permission: 'users' as const },
    { to: "/responsables", icon: UserCheck, label: "Responsables", permission: 'responsables' as const },
    { to: "/config", icon: Database, label: "Gestión Interna", permission: 'config' as const },
  ];

  const filteredMainLinks = mainLinks.filter(link => canView(link.permission));
  const filteredAdminLinks = (adminLinks as any[]).filter(link => {
    if (link.permission === 'users' || link.permission === 'config' || link.permission === 'responsables') {
      return isAdmin;
    }
    return canView(link.permission);
  });

  return (
    <aside 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed left-0 top-0 h-screen bg-[#0b396b] text-white flex flex-col transition-all duration-300 ease-in-out z-50 shadow-2xl 
        ${isExpanded ? "w-64" : "w-20"}
        ${isMobileOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0"}
      `}
    >
      <div className={`p-5 border-b border-[#032650] overflow-hidden transition-all duration-300 flex justify-between md:justify-center items-center ${isExpanded ? "px-6" : "px-4"}`}>
        <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center bg-[#ffffff] rounded-2xl shadow-lg border border-slate-100 p-1 hover:scale-110 hover:-rotate-3 hover:shadow-xl transition-all duration-300 cursor-pointer">
          <img src="/samtur_nuevo.png.png" alt="Samtur Travel Agency" className="w-full h-full object-contain drop-shadow-sm" />
        </div>
        {/* Mobile Close Button */}
        <button 
          onClick={onClose}
          className="md:hidden p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 py-6 overflow-y-auto overflow-x-hidden custom-scrollbar" style={{ direction: 'rtl' }}>
        <div style={{ direction: 'ltr' }}>
          <ul className="space-y-2 px-3">
            {filteredMainLinks.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    `relative flex items-center rounded-xl transition-all duration-300 group ${
                      isExpanded ? "px-4 py-3 gap-3" : "px-0 py-3 justify-center"
                    } ${
                      isActive
                        ? "bg-[#ffffff]/10 text-[#ffffff] shadow-sm"
                        : "text-[#d1d5db] hover:bg-[#ffffff]/5 hover:text-[#ffffff]"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Active Indicator Bar on the Left */}
                      <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-accent shadow-[0_0_12px_#07818e] transition-all duration-500 ease-in-out ${
                        isActive ? 'h-8 opacity-100 translate-x-0' : 'h-0 opacity-0 -translate-x-full'
                      }`} />
                      
                      <div className={`flex-shrink-0 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-accent' : ''}`}>
                        <link.icon size={22} />
                      </div>
                      <span className={`font-medium whitespace-nowrap transition-all duration-300 origin-left ${
                        isExpanded ? "opacity-100 scale-100" : "opacity-0 scale-0 w-0"
                      } ${isActive ? 'text-[#ffffff] font-bold' : ''}`}>
                        {link.label}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          {isAdmin && filteredAdminLinks.length > 0 && (
            <div className="mt-8">
              <div className={`px-4 py-2 transition-all duration-300 ${isExpanded ? "opacity-100" : "opacity-0 h-0 py-0"}`}>
                <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-[0.2em] whitespace-nowrap">
                  Administración
                </span>
              </div>
              <ul className="space-y-2 px-3 mt-2">
                {filteredAdminLinks.map((link) => (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      className={({ isActive }) =>
                        `relative flex items-center rounded-xl transition-all duration-300 group ${
                          isExpanded ? "px-4 py-3 gap-3" : "px-0 py-3 justify-center"
                        } ${
                          isActive
                            ? "bg-[#ffffff]/10 text-[#ffffff] shadow-sm"
                            : "text-[#d1d5db] hover:bg-[#ffffff]/5 hover:text-[#ffffff]"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {/* Active Indicator Bar on the Left */}
                          <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-accent shadow-[0_0_12px_#07818e] transition-all duration-500 ease-in-out ${
                            isActive ? 'h-8 opacity-100 translate-x-0' : 'h-0 opacity-0 -translate-x-full'
                          }`} />

                          <div className={`flex-shrink-0 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-accent' : ''}`}>
                            <link.icon size={22} />
                          </div>
                          <span className={`font-medium whitespace-nowrap transition-all duration-300 origin-left ${
                            isExpanded ? "opacity-100 scale-100" : "opacity-0 scale-0 w-0"
                          } ${isActive ? 'text-[#ffffff] font-bold' : ''}`}>
                            {link.label}
                          </span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </nav>

      <SidebarUserProfile
        user={user}
        isExpanded={isExpanded}
        onLogoutClick={() => setIsConfirmOpen(true)}
      />

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
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
            <LogOut size={32} />
          </div>
          <p className="text-gray-700">
            ¿Estás seguro de que deseas <strong>cerrar sesión</strong>?
          </p>
        </div>
      </Modal>
    </aside>
  );
}
