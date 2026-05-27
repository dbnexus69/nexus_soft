import { useState, useEffect } from "react";
import { Eye, FileDown, Pencil, Ban } from "lucide-react";
import { RxUpdate } from "react-icons/rx";
import { Table, TableRow, TableCell, Pagination } from "../ui/Table";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { formatCurrency, formatDate } from "../../utils/formatters";
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
}: SalesTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(sales.length / itemsPerPage);

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
            <TableCell>{sale.id}</TableCell>
            <TableCell>
              <div className="flex items-center gap-3">
                {client?.avatar ? (
                  <img
                    src={client.avatar}
                    className="w-8 h-8 rounded-full border border-gray-200"
                    alt={sale.clientName}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs border border-primary/20">
                    {sale.clientName.charAt(0)}
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="font-medium text-primary leading-tight">
                    {sale.clientName}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {client?.email || "Sin correo"}
                  </span>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-3">
                
                <div className="flex flex-col">
                  <span className="font-medium text-gray-700 leading-tight">
                    {sale.asesorName}
                  </span>
                 
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="text-s font-medium text-gray-700">
                  {sale.commissionAgentName || "Venta Directa"}
                </span>
              </div>  
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-emerald-600">
                  T.A: {formatCurrency(sale.ta || 0)}
                </span>
                <span className="text-[10px] text-gray-400">
                  Costo: {formatCurrency(sale.supplierCost || 0)}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-bold text-primary">
                  {formatCurrency(sale.total)}
                </span>
              </div>
            </TableCell>
            <TableCell className="text-xs text-gray-500">
              {formatDate(sale.date)}
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                <Badge variant={sale.status} className="uppercase text-[9px] font-black">
                  {sale.status === "pagado"
                    ? "Finalizado"
                    : sale.status === "abonado"
                      ? "Abonado"
                      : sale.status === "anulado"
                        ? "Anulado"
                        : "En Crédito"}
                </Badge>
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
