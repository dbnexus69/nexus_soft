import React from "react";
import { Table, TableRow, TableCell } from "../ui/Table";
import { Badge } from "../ui/Badge";
import { Wallet, Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "../../utils/formatters";

interface AgentTableProps {
  agents: any[];
  canEdit: boolean;
  canDelete: boolean;
  onSettle: (agent: any) => void;
  onEdit: (agent: any) => void;
  onDelete: (agent: any) => void;
}

export const AgentTable: React.FC<AgentTableProps> = ({
  agents,
  canEdit,
  canDelete,
  onSettle,
  onEdit,
  onDelete
}) => {
  return (
    <div className="overflow-x-auto">
      <Table>
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <th className="py-3 px-4 text-left">Agente</th>
            <th className="py-3 px-4 text-left">Tipo</th>
            <th className="py-3 px-4 text-left">Tipo Doc</th>
            <th className="py-3 px-4 text-left">No. Documento</th>
            <th className="py-3 px-4 text-right">Acumulado</th>
            <th className="py-3 px-4 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
          {agents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                No se encontraron agentes comisionistas registrados.
              </TableCell>
            </TableRow>
          ) : (
            agents.map((agent) => (
              <TableRow key={agent.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <TableCell className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                  <div>{agent.name}</div>
                  <div className="text-xs text-slate-400">{agent.email || agent.phone}</div>
                </TableCell>
                <TableCell className="py-3 px-4">
                  <Badge variant="blue">{agent.type || "Interno"}</Badge>
                </TableCell>
                <TableCell className="py-3 px-4 text-slate-600 dark:text-slate-300">
                  {agent.docType || <span className="text-slate-400 italic">N/A</span>}
                </TableCell>
                <TableCell className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                  {agent.docNumber}
                </TableCell>
                <TableCell className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(agent.accumulated || 0)}
                </TableCell>
                <TableCell className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {canEdit && (
                      <button
                        onClick={() => onSettle(agent)}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium"
                        title="Liquidar comisiones"
                      >
                        <Wallet size={15} /> Liquidar
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => onEdit(agent)}
                        className="p-1 text-slate-400 hover:text-amber-600 transition-colors"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => onDelete(agent)}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
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
