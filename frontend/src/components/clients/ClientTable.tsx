import React from 'react';
import { Table, TableRow, TableCell } from '../ui/Table';
import { Badge } from '../ui/Badge';
import Avatar from '../ui/Avatar';
import SortIcon from '../ui/SortIcon';
import { Eye, Pencil, UserCheck, UserX } from 'lucide-react';
import { Client } from '../../types';

interface ClientTableProps {
  clients: Client[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  canEdit: boolean;
  onSort: (field: string) => void;
  onViewDetail: (client: Client) => void;
  onEdit: (client: Client) => void;
  onToggleStatus: (client: Client) => void;
}

export const ClientTable: React.FC<ClientTableProps> = ({
  clients,
  sortBy,
  sortOrder,
  canEdit,
  onSort,
  onViewDetail,
  onEdit,
  onToggleStatus
}) => {
  return (
    <div className="overflow-x-auto">
      <Table>
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <th className="py-3 px-4 text-left">#ID</th>
            <th className="py-3 px-4 text-left cursor-pointer" onClick={() => onSort('name')}>
              <div className="flex items-center gap-1">
                Cliente
                <SortIcon field="name" currentSort={sortBy} sortOrder={sortOrder} />
              </div>
            </th>
            <th className="py-3 px-4 text-left">Tipo Doc</th>
            <th className="py-3 px-4 text-left">No. Documento</th>
            <th className="py-3 px-4 text-left">Contacto</th>
            <th className="py-3 px-4 text-left cursor-pointer" onClick={() => onSort('status')}>
              <div className="flex items-center gap-1">
                Estado
                <SortIcon field="status" currentSort={sortBy} sortOrder={sortOrder} />
              </div>
            </th>
            <th className="py-3 px-4 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
          {clients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                No se encontraron clientes registrados.
              </TableCell>
            </TableRow>
          ) : (
            clients.map((client) => (
              <TableRow key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <TableCell className="py-3 px-4">
                  <span className="text-xs font-mono font-bold text-slate-400">#{client.id}</span>
                </TableCell>
                <TableCell className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Avatar avatarUrl={client.avatar} name={client.name} size="md" />
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{client.name}</div>
                      <div className="text-xs text-slate-500">{client.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-3 px-4 text-slate-600 dark:text-slate-300">
                  {client.docType || <span className="text-slate-400 italic">N/A</span>}
                </TableCell>
                <TableCell className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                  {client.docNumber}
                </TableCell>
                <TableCell className="py-3 px-4 text-slate-600 dark:text-slate-300">
                  {client.phone || 'Sin teléfono'}
                </TableCell>
                <TableCell className="py-3 px-4">
                  <Badge variant={client.status === 'active' ? 'success' : 'danger'}>
                    {client.status === 'active' ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onViewDetail(client)}
                      className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                      title="Ver perfil"
                    >
                      <Eye size={16} />
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => onEdit(client)}
                        className="p-1 text-slate-400 hover:text-amber-600 transition-colors"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => onToggleStatus(client)}
                        className={`p-1 transition-colors ${
                          client.status === 'active'
                            ? 'text-slate-400 hover:text-red-600'
                            : 'text-slate-400 hover:text-emerald-600'
                        }`}
                        title={client.status === 'active' ? 'Desactivar' : 'Activar'}
                      >
                        {client.status === 'active' ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>
                    )}
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
