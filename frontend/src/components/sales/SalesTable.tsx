import { useState, useEffect, useRef } from "react";
import { Eye, FileDown, Pencil, Ban, ChevronDown, CheckCircle2 } from "lucide-react";
import { RxUpdate } from "react-icons/rx";
import { Table, TableRow, TableCell, Pagination } from "../ui/Table";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { formatCurrency, formatDate, formatSaleId, getAvatarGradient } from "../../utils/formatters";
import { Sale, Client, User } from "../../types";

interface SalesTableProps {
  sales: Sale[];
  clients: Client[];
  users: User[];
  onViewDetail: (sale: Sale) => void;
  onPrefetchDetail?: (sale: Sale) => void;
  onDownloadVoucher: (sale: Sale) => void;
  onEdit: (sale: Sale) => void;
  onDelete: (sale: Sale) => void;
  canEditThis: (sale: Sale) => boolean;
  isAdmin: boolean;
  onReviewStatusChange?: (saleId: number, isReviewed: boolean) => void;
}

export default function SalesTable({
  sales,
  clients,
  users,
  onViewDetail,
  onPrefetchDetail,
  onDownloadVoucher,
  onEdit,
  onDelete,
  canEditThis,
  isAdmin,
  onReviewStatusChange,
}: SalesTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(sales.length / itemsPerPage);
  
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

  // Volver a la página 1 cuando se agrega una nueva venta
  useEffect(() => {
    setCurrentPage(1);
  }, [sales.length]);

  const currentSales = sales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex flex-col gap-4">
    <Table
      headers={[
        "#",
        "Cliente",
        "Asesor",
        "Comisionista",
        "T.A / Costos",
        "Total",
        "Fecha",
        "Estado",
        "Acciones",
      ]}
    >
      {currentSales.map((sale) => {
        const client = clients.find(c => c.id === sale.clientId);
        const asesor = users.find(u => u.id === sale.asesorId);

        return (
          <TableRow key={sale.id}>
            <TableCell>{formatSaleId(sale.id)}</TableCell>
            <TableCell>
              <div className="flex items-center gap-3">
                {sale.clientAvatar ? (
                  <img
                    src={sale.clientAvatar}
                    className="w-8 h-8 rounded-full border border-gray-200"
                    alt={sale.clientName}
                  />
                ) : (
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${getAvatarGradient(sale.clientName)} flex items-center justify-center font-black text-xs shadow-sm border border-white/20 shrink-0`}>
                    {sale.clientName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="font-medium text-slate-800 dark:text-slate-100 leading-tight">
                    {sale.clientName}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {sale.clientEmail || "Sin correo"}
                  </span>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-full bg-gradient-to-tr ${getAvatarGradient(sale.asesorName)} flex items-center justify-center font-extrabold text-[10px] shadow-sm border border-white/20 shrink-0`}>
                  {sale.asesorName ? sale.asesorName.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-slate-800 dark:text-slate-100 leading-tight">
                    {sale.asesorName || "Sin Asesor"}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {asesor?.email || "Sin correo"}
                  </span>
                </div>
              </div>
            </TableCell>
            <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-800 dark:text-slate-100 leading-tight">
                      {sale.commissionAgentName}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 flex flex-col">
                      <span>Comisión: {sale.commissionAgentAmount ? formatCurrency(sale.commissionAgentAmount) : 'Sin Monto'}</span>
                      {sale.isSettled ? (
                        <span className="text-emerald-500 font-semibold flex items-center gap-1 mt-0.5"><CheckCircle2 size={10} /> Pagada</span>
                      ) : (
                        <span className="text-amber-500 font-semibold flex items-center gap-1 mt-0.5"><RxUpdate size={10} /> Pendiente</span>
                      )}
                    </span>
                  </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-emerald-600">
                  T.A: {formatCurrency(sale.ta || 0)}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Costo: {formatCurrency(sale.supplierCost || 0)}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {formatCurrency(sale.total)}
                </span>
              </div>
            </TableCell>
            <TableCell className="text-xs text-slate-500 dark:text-slate-400">
              {formatDate(sale.date)}
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <Badge variant={sale.status} className="uppercase text-[9px] font-black">
                    {sale.status === "pagado"
                      ? "Finalizado"
                      : sale.status === "abonado"
                        ? "Abonado"
                        : sale.status === "anulado"
                          ? "Anulado"
                          : "En Crédito"}
                  </Badge>
                  {sale.status === "pagado" && onReviewStatusChange && (
                    <div className="relative inline-flex items-center">
                      {sale.isReviewed ? (
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100" title="Revisado">
                          <CheckCircle2 size={12} />
                        </span>
                      ) : (
                        <div
                          className="relative flex items-center justify-center w-5 h-5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-primary transition-colors border border-transparent hover:border-gray-200"
                          title="Marcar como revisado"
                        >
                          <select
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            value="Pendiente"
                            onChange={(e) => {
                              if (e.target.value === "Revisado") {
                                onReviewStatusChange(sale.id, true);
                              }
                            }}
                          >
                            <option value="Pendiente" disabled>Opciones...</option>
                            <option value="Revisado">Marcar Revisado</option>
                          </select>
                          <ChevronDown size={14} className="pointer-events-none" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {sale.status === "credito" && sale.creditDueDate && (
                  <span className="text-[10px] text-rose-500 font-medium whitespace-nowrap">
                    Vence: {formatDate(sale.creditDueDate)}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onViewDetail(sale)}
                  onMouseEnter={() => onPrefetchDetail?.(sale)}
                  title="Ver detalle"
                >
                  <Eye size={14} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onDownloadVoucher(sale)}
                  title="Descargar Voucher"
                >
                  <FileDown size={14} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit(sale)}
                  disabled={!canEditThis(sale)}
                  title={canEditThis(sale) ? "Actualizar abonos" : "No editable"}
                >
                  <RxUpdate size={14} className={canEditThis(sale) ? "text-primary" : "text-gray-300"} />
                </Button>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300"
                    onClick={() => onDelete(sale)}
                    disabled={sale.status === "anulado"}
                    title={sale.status === "anulado" ? "Venta ya anulada" : "Anular venta"}
                  >
                    <Ban size={14} className={sale.status === "anulado" ? "text-red-300" : ""} />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        );
      })}
    </Table>
    
    <Pagination 
      currentPage={currentPage} 
      totalPages={totalPages} 
      onPageChange={setCurrentPage} 
    />
    </div>
  );
}
