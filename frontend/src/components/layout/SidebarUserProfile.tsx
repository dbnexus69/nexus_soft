import React from "react";
import { LogOut } from "lucide-react";
import { getInitials } from "../../utils/formatters";

interface SidebarUserProfileProps {
  user: any;
  isExpanded: boolean;
  onLogoutClick: () => void;
}

export const SidebarUserProfile: React.FC<SidebarUserProfileProps> = ({
  user,
  isExpanded,
  onLogoutClick,
}) => {
  const getShortName = (name?: string) => {
    if (!name) return "";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 4) return `${parts[0]} ${parts[2]}`;
    if (parts.length === 3) return `${parts[0]} ${parts[1]}`;
    return name;
  };

  return (
    <div className="p-4 border-t border-[#032650] bg-[#082c54]/50">
      <div className="flex items-center gap-3">
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt={user.name}
            className="w-10 h-10 rounded-full object-cover border-2 border-[#19c3b5] flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#19c3b5] text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
            {getInitials(user?.name || "User")}
          </div>
        )}
        {isExpanded && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {getShortName(user?.name)}
            </p>
            <p className="text-[11px] text-[#19c3b5] font-medium capitalize">
              {user?.role}
            </p>
          </div>
        )}
        {isExpanded && (
          <button
            onClick={onLogoutClick}
            className="p-1.5 hover:bg-[#032650] rounded-lg text-slate-300 hover:text-white transition-colors flex-shrink-0"
            title="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </div>
  );
};
