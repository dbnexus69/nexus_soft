import React from "react";
import { Table, TableRow, TableCell } from "../ui/Table";
import { Badge } from "../ui/Badge";
import Avatar from "../ui/Avatar";
import SortIcon from "../ui/SortIcon";
import { Eye, Pencil, Trash2, Key } from "lucide-react";
import { User } from "../../types";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  asesor: "Asesor",
  freelancer: "Freelancer"
};

interface UserTableProps {
  users: User[];
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort: (field: string) => void;
  onViewDetail: (user: User) => void;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onManagePermissions: (user: User) => void;
}

export const UserTable: React.FC<UserTableProps> = ({
  users,
  sortBy,
  sortOrder,
  onSort,
  onViewDetail,
  onEdit,
  onDelete,
  onManagePermissions
}) => {
  return (
    <div className="overflow-x-auto">
      <Table>
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <th className="py-3 px-4 text-left">#ID</th>
            <th className="py-3 px-4 text-left cursor-pointer" onClick={() => onSort("name")}>
              <div className="flex items-center gap-1">
                Usuario
                <SortIcon field="name" currentSort={sortBy} sortOrder={sortOrder} />
              </div>
            </th>
            <th className="py-3 px-4 text-left cursor-pointer" onClick={() => onSort("role")}>
              <div className="flex items-center gap-1">
                Rol
                <SortIcon field="role" currentSort={sortBy} sortOrder={sortOrder} />
              </div>
            </th>
            <th className="py-3 px-4 text-left">Tipo Doc</th>
            <th className="py-3 px-4 text-left">No. Documento</th>
            <th className="py-3 px-4 text-left">Contacto</th>
            <th className="py-3 px-4 text-left cursor-pointer" onClick={() => onSort("status")}>
              <div className="flex items-center gap-1">
                Estado
                <SortIcon field="status" currentSort={sortBy} sortOrder={sortOrder} />
              </div>
            </th>
            <th className="py-3 px-4 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                No se encontraron usuarios registrados.
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <TableCell className="py-3 px-4">
                  <span className="text-xs font-mono font-bold text-slate-400">#{user.id}</span>
                </TableCell>
                <TableCell className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Avatar avatarUrl={user.avatar} name={user.name} size="md" />
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-3 px-4">
                  <Badge variant={user.role === "admin" ? "purple" : user.role === "freelancer" ? "cyan" : "blue"}>
                    {ROLE_LABELS[user.role] || user.role}
                  </Badge>
                </TableCell>
                <TableCell className="py-3 px-4 text-slate-600 dark:text-slate-300">
                  {user.docType || <span className="text-slate-400 italic">N/A</span>}
                </TableCell>
                <TableCell className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                  {user.docNumber}
                </TableCell>
                <TableCell className="py-3 px-4">
                  <div className="text-xs text-slate-600 dark:text-slate-300">{user.phone || "Sin teléfono"}</div>
                </TableCell>
                <TableCell className="py-3 px-4">
                  <Badge variant={user.status === "active" ? "success" : "danger"}>
                    {user.status === "active" ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onViewDetail(user)}
                      className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                      title="Ver detalle"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => onManagePermissions(user)}
                      className="p-1 text-slate-400 hover:text-purple-600 transition-colors"
                      title="Gestionar Permisos"
                    >
                      <Key size={16} />
                    </button>
                    <button
                      onClick={() => onEdit(user)}
                      className="p-1 text-slate-400 hover:text-amber-600 transition-colors"
                      title="Editar"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => onDelete(user)}
                      className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
};
