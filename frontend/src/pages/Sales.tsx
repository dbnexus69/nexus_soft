import { useState, useMemo, useEffect } from "react";
import * as api from "../api";
import {
  Plus,
  ShoppingBag,
  Receipt,
  TrendingUp,
  Wallet,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  Ban,
  Search,
  X,
} from "lucide-react";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../context/PermissionsContext";
import { formatCurrency, formatDate } from "../utils/formatters";
import { buildAirportMap } from "../utils/airportInfo";
import { Sale } from "../types";
import NewSaleWizard from "../components/sales/NewSaleWizard";
import ProductDetailsModal from "../components/sales/ProductDetailsModal";
import SaleDetailModal from "../components/sales/SaleDetailModal";
import SaleEditModal from "../components/sales/SaleEditModal";
import SalesTable from "../components/sales/SalesTable";
import StatCard from "../components/ui/StatCard";
import CreditDashboard from "../components/sales/CreditDashboard";
import { VoucherPDF } from "../components/sales/VoucherPDF";
import { useRef } from "react";
export default function Sales() {
  const { data, addSale, updateSale, voidSale, registerCreditPayment, deleteSalePayment, salesLoading, fetchSales, fetchClients } = useData();
  const { user, isAdmin } = useAuth();
  const { canCreate, canEdit } = usePermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [salesDetails, setSalesDetails] = useState<Record<number, Sale>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [activeTab, setActiveTab] = useState<'list' | 'credit'>('list');
  const [detailedProduct, setDetailedProduct] = useState<{
    type: string;
    data: any[];
  } | null>(null);
  const [voidConfirm, setVoidConfirm] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [isVoiding, setIsVoiding] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [voucherSale, setVoucherSale] = useState<Sale | null>(null);
  const [voucherFullSale, setVoucherFullSale] = useState<Sale | null>(null);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const voucherRef = useRef<HTMLDivElement>(null);
  const airportMap = useMemo(() => buildAirportMap(data.config.airports || []), [data.config.airports]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'pagado' | 'credito' | 'abonado' | 'anulado'>('all');
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const filteredSales = useMemo(() => {
    const list = isAdmin ? data.sales : data.sales.filter((s) => s.asesorId === user?.id);
    return list.filter((sale) => {
      // 1. Text Search Filter (client name, status, asesor, commissionAgent, id)
      const query = searchTerm.toLowerCase().trim();
      const matchesText = !query || 
        sale.clientName.toLowerCase().includes(query) ||
        sale.status.toLowerCase().includes(query) ||
        sale.asesorName.toLowerCase().includes(query) ||
        (sale.commissionAgentName || "").toLowerCase().includes(query) ||
        String(sale.id).includes(query);

      // 2. Status Select Filter
      const matchesStatus = statusFilter === 'all' || sale.status === statusFilter;

      // 3. Date Range Filter
      let matchesDate = true;
      if (startDate) {
        matchesDate = matchesDate && new Date(sale.date) >= new Date(startDate);
      }
      if (endDate) {
        matchesDate = matchesDate && new Date(sale.date) <= new Date(endDate + "T23:59:59");
      }

      return matchesText && matchesStatus && matchesDate;
    }).sort((a, b) => b.id - a.id);
  }, [data.sales, isAdmin, user?.id, searchTerm, statusFilter, startDate, endDate]);

  // Lazy Load Fetch
  useEffect(() => {
    fetchSales();
    fetchClients();
  }, [fetchSales, fetchClients]);

  const totals = useMemo(() => {
    return filteredSales.reduce(
      (acc, s) => ({
        total: acc.total + s.total,
        pagado: acc.pagado + (s.status === "pagado" ? s.total : 0),
        pendiente: acc.pendiente + (s.status === "credito" ? s.total : 0),
      }),
      { total: 0, pagado: 0, pendiente: 0 },
    );
  }, [filteredSales]);

  // Eliminamos el prefetch silencioso para evitar peticiones "fantasma" que colapsan la red y el backend.
  // La carga detallada se hará estrictamente "On Demand" (bajo demanda) cuando el usuario pase el mouse o haga click.

  const handlePrefetchDetail = (sale: Sale) => {
    if (!salesDetails[sale.id]) {
      api.getSale(sale.id).then(fetched => {
        setSalesDetails(prev => ({ ...prev, [sale.id]: fetched }));
      }).catch(() => null);
    }
  };

  const canEditThis = (sale: Sale): boolean => {
    if (!canEdit("sales")) return false;
    // Solo permitir edición si NO está pagada ni anulada
    if (sale.status === "pagado" || sale.status === "anulado") return false;
    if (isAdmin) return true;
    return sale.asesorId === user?.id;
  };

  const handleOpenNewSale = () => {
    setIsWizardOpen(true);
  };

  const handleOpenModal = (sale?: Sale) => {
    if (sale && !canEditThis(sale)) return;
    setEditingSale(sale || null);
    setIsModalOpen(true);
  };

  const handleViewDetail = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDetailOpen(true);
    handlePrefetchDetail(sale);
  };

  const handleDownloadVoucher = (sale: Sale) => {
    setVoucherSale(sale);
    setVoucherFullSale(null); // will be fetched on demand
  };

  const executeDownloadPDF = async () => {
    if (!voucherSale) return;
    setIsPdfGenerating(true);

    try {
      setSuccessMessage(`Cargando datos de la venta #${voucherSale.id}...`);
      setShowSuccess(true);

      // Step 1: Always fetch the FULL sale from API (list only has summary)
      let fullSale: Sale = voucherSale;
      try {
        fullSale = await api.getSale(voucherSale.id);
      } catch {
        // fallback to what we have
      }
      setVoucherFullSale(fullSale);

      // Step 2: Wait for React to render the VoucherPDF component with fresh data
      await new Promise(resolve => setTimeout(resolve, 600));

      if (!voucherRef.current) {
        throw new Error('El contenedor del PDF no está listo');
      }

      setSuccessMessage(`Generando PDF...`);

      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const canvas = await html2canvas(voucherRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const doc = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let position = 0;
      const totalPages = Math.ceil(imgHeight / pageHeight);

      for (let i = 0; i < totalPages; i++) {
        if (i > 0) doc.addPage();
        doc.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', 0, position, imgWidth, imgHeight);
        position -= pageHeight;
      }

      doc.save(`Voucher_iTea_#${voucherSale.id}_${voucherSale.clientName.replace(/\s+/g, '_')}.pdf`);

      setSuccessMessage(`✅ Voucher descargado correctamente`);
      setTimeout(() => setShowSuccess(false), 3000);
      setVoucherSale(null);
      setVoucherFullSale(null);
    } catch (error) {
      console.error(error);
      setSuccessMessage(`❌ Error al generar el PDF`);
      setTimeout(() => setShowSuccess(false), 3000);
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const handleVoidSale = async () => {
    if (!voidConfirm || !voidReason.trim() || isVoiding) return;
    setIsVoiding(true);
    try {
      await voidSale(voidConfirm.id, voidReason);
      setSuccessMessage(`Venta #${voidConfirm.id} anulada correctamente`);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setVoidConfirm(null);
      setVoidReason("");
    } catch {
      setSuccessMessage(`Error al anular la venta #${voidConfirm.id}`);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-[100] flex justify-center">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="animate-confetti absolute top-0 text-2xl"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                color: ["#FFD700", "#FF4500", "#00BFFF", "#32CD32", "#FF69B4"][
                  Math.floor(Math.random() * 5)
                ],
              }}
            >
              ★
            </div>
          ))}
        </div>
      )}

      {showSuccess && (
        <div className="fixed top-20 right-6 z-[100] bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 animate-slide-in-right">
          <div className="bg-green-500 text-white rounded-full p-1">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <p className="font-bold text-sm">Operación Exitosa</p>
            <p className="text-xs opacity-90">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Header de Sección */}
      <div className="mb-6 animate-fade-in">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
          <ShoppingBag className="text-accent w-8 h-8" /> Gestión de Ventas
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Control de ingresos, facturación y estados de pago de tus clientes.
        </p>
      </div>

      {/* TABS SELECTOR */}
      <div className="gap-2 bg-white p-1 rounded-xl border border-gray-100 shadow-sm inline-flex animate-fade-in">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'list' 
              ? 'bg-primary text-white shadow-md' 
              : 'text-gray-500 hover:bg-gray-50 hover:text-primary'
          }`}
        >
          <FileText size={18} /> Listado de Ventas
        </button>
        <button
          onClick={() => setActiveTab('credit')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'credit' 
              ? 'bg-primary text-white shadow-md' 
              : 'text-gray-500 hover:bg-gray-50 hover:text-primary'
          }`}
        >
          <CreditCard size={18} /> Crédito y Cobros
        </button>
      </div>

      {activeTab === 'list' ? (
        <>


          <Card className="animate-fade-in">
            <CardHeader
              actions={
                <div className="flex gap-3 items-center flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      placeholder="Buscar por cliente, asesor, comisionista..." 
                      className="text-sm border border-gray-border rounded-lg pl-10 pr-9 py-2 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20 w-72"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                    className="text-sm border border-gray-border rounded-lg px-3 py-2 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="pagado">Finalizado</option>
                    <option value="abonado">Abonado</option>
                    <option value="credito">En Crédito</option>
                    <option value="anulado">Anulado</option>
                  </select>
                  <div className="flex items-center gap-1.5 border border-gray-border rounded-lg px-2 py-1 bg-white text-xs text-gray-500">
                    <span className="font-semibold text-gray-400">Desde:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="bg-transparent focus:outline-none text-gray-600"
                    />
                    <span className="font-semibold text-gray-400 ml-1">Hasta:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="bg-transparent focus:outline-none text-gray-600"
                    />
                    {(startDate || endDate) && (
                      <button 
                        onClick={() => { setStartDate(""); setEndDate(""); }}
                        className="text-red-400 hover:text-red-600 ml-1 p-0.5 rounded bg-red-50"
                        title="Limpiar fechas"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  {canCreate("sales") && (
                    <Button onClick={handleOpenNewSale}>
                      <Plus size={18} />
                      Nueva Venta
                    </Button>
                  )}
                </div>
              }
            >
              Lista de Ventas {isAdmin ? "(Todas)" : "(Mis Ventas)"}
            </CardHeader>

            {/* Skeleton de carga — solo se muestra en el primer fetch sin caché */}
            {salesLoading && filteredSales.length === 0 ? (
              <div className="p-4 space-y-3 animate-pulse">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-8 w-8 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-gray-200 rounded w-1/3" style={{ animationDelay: `${i * 60}ms` }} />
                      <div className="h-2.5 bg-gray-100 rounded w-1/4" />
                    </div>
                    <div className="h-3 bg-gray-200 rounded w-16" />
                    <div className="h-3 bg-gray-200 rounded w-20" />
                    <div className="h-3 bg-gray-200 rounded w-14" />
                    <div className="h-6 bg-gray-100 rounded-full w-20" />
                    <div className="flex gap-1.5">
                      <div className="h-8 w-8 rounded-lg bg-gray-100" />
                      <div className="h-8 w-8 rounded-lg bg-gray-100" />
                      <div className="h-8 w-8 rounded-lg bg-gray-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-gray-500 bg-white rounded-b-2xl border-t border-gray-100">
                <Ban size={48} className="text-gray-200 mb-4 animate-bounce" />
                <p className="text-lg font-bold text-gray-700">Venta no encontrada</p>
                <p className="text-sm text-gray-400 mt-1">Prueba ajustando los términos de búsqueda o los filtros de fecha.</p>
              </div>
            ) : (
              <SalesTable
                sales={filteredSales}
                clients={data.clients}
                users={data.users}
                onViewDetail={handleViewDetail}
                onPrefetchDetail={handlePrefetchDetail}
                onDownloadVoucher={handleDownloadVoucher}
                onEdit={handleOpenModal}
                onDelete={(sale) => setVoidConfirm(sale)}
                canEditThis={canEditThis}
                isAdmin={isAdmin}
              />
            )}
          </Card>
        </>
      ) : (
        <CreditDashboard 
          clients={data.clients}
          sales={filteredSales} 
        />
      )}

      {/* ===== WIZARD MODAL (Nueva Venta) ===== */}
      <Modal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        title="Nueva Venta"
        size="xl"
      >
        <NewSaleWizard
          onClose={() => setIsWizardOpen(false)}
          onSuccess={(msg) => {
            setSuccessMessage(msg);
            setShowSuccess(true);
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);
            setTimeout(() => setShowSuccess(false), 3000);
          }}
        />
      </Modal>

      {/* ===== EDIT MODAL (Editar Venta) ===== */}
      <SaleEditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingSale={editingSale}
        clients={data.clients}
        user={user}
        isAdmin={isAdmin}
        onUpdateSale={updateSale}
        onAddSale={addSale}
        onRegisterPayment={(saleId, amount, method) => registerCreditPayment(saleId, amount, method)}
        onDeletePayment={(saleId, paymentId) => deleteSalePayment(saleId, paymentId)}
        onDownloadVoucher={handleDownloadVoucher}
      />

      {/* ===== DETAIL MODAL (Ver Detalle) ===== */}
      <SaleDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        selectedSale={salesDetails[selectedSale?.id || 0] || selectedSale}
        clients={data.clients}
        onViewProductDetails={setDetailedProduct}
      />

      {/* Detalle Específico de Producto */}
      {detailedProduct && (
        <ProductDetailsModal
          product={detailedProduct}
          onClose={() => setDetailedProduct(null)}
          airportMap={airportMap}
        />
      )}

      {/* ===== CONFIRMAR ANULACIÓN ===== */}
      <Modal
        isOpen={!!voidConfirm}
        onClose={() => setVoidConfirm(null)}
        title="Anular Venta"
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              className="border-none"
              onClick={() => setVoidConfirm(null)}
              disabled={isVoiding}
            >
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
              onClick={handleVoidSale}
              disabled={!voidReason.trim() || isVoiding}
            >
              {isVoiding && <Loader2 size={16} className="animate-spin" />}
              {isVoiding ? "Anulando..." : "Anular Venta"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            ¿Estás seguro de que deseas anular la venta <strong>#{voidConfirm?.id}</strong>?
            El registro se conservará pero su estado pasará a "Anulado".
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo de anulación <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full text-sm border border-gray-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[100px]"
              placeholder="Escribe la razón detallada para anular esta venta..."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* ===== VOUCHER MODAL (Opciones de Voucher) ===== */}
      <Modal
        isOpen={!!voucherSale}
        onClose={() => setVoucherSale(null)}
        title="Opciones de Voucher"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm text-center">
            ¿Qué deseas hacer con el voucher de la venta <strong>#{voucherSale?.id}</strong>?
          </p>
          <div className="flex flex-col gap-3 mt-4">
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white flex justify-center items-center"
              onClick={() => {
                setSuccessMessage(`Voucher enviado al cliente exitosamente`);
                setShowSuccess(true);
                setTimeout(() => setShowSuccess(false), 3000);
                setVoucherSale(null);
              }}
            >
              Enviar al Cliente
            </Button>
            <Button
              variant="outline"
              className="w-full flex justify-center items-center gap-2"
              onClick={executeDownloadPDF}
              disabled={isPdfGenerating}
            >
              {isPdfGenerating ? (
                <><Loader2 size={16} className="animate-spin" /> Generando PDF...</>
              ) : (
                <>&#8595; Descargar Voucher</>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full text-gray-500 mt-2 border-none"
              onClick={() => setVoucherSale(null)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* COMPONENTE OCULTO PARA GENERAR PDF - usa la venta completa cargada del API */}
      <VoucherPDF ref={voucherRef} sale={voucherFullSale} airportMap={airportMap} />
    </div>
  );
}
