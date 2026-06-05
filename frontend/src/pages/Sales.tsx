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
  ExternalLink,
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
import { DatePicker } from "../components/sales/forms/TicketForm";
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
  const [isSiigoModalOpen, setIsSiigoModalOpen] = useState(false);
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
  const [isSendingVoucher, setIsSendingVoucher] = useState(false);
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

  /** Carga la venta completa, renderiza el VoucherPDF y devuelve canvas + doc jsPDF listos */
  const buildVoucherPdf = async (sale: Sale) => {
    // 1. Traer venta completa
    let fullSale: Sale = sale;
    try {
      fullSale = await api.getSale(sale.id);
    } catch { /* fallback */ }

    // 2. Inyectar en el componente oculto y esperar render
    setVoucherFullSale(fullSale);
    await new Promise(resolve => setTimeout(resolve, 800));

    if (!voucherRef.current) throw new Error('Contenedor del PDF no disponible');

    // Helper to calculate element height with margins
    const getElementHeightWithMargins = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const marginTop = parseFloat(style.marginTop) || 0;
      const marginBottom = parseFloat(style.marginBottom) || 0;
      return rect.height + marginTop + marginBottom;
    };

    // 3. Distribución dinámica de elementos en páginas
    const originalChildren = Array.from(voucherRef.current.children) as HTMLElement[];
    const footerElement = originalChildren.find(el => el.classList.contains('v-footer'));
    const childrenToDistribute = originalChildren.filter(el => !el.classList.contains('v-footer'));

    const pagesData: HTMLElement[][] = [];
    let currentPageContent: HTMLElement[] = [];
    let currentPageHeight = 0;

    // Altura máxima del contenido por página A4 (820px de ancho -> 1160px de alto. Restando pie de página ~75px y margen de seguridad)
    const maxContentHeight = 1070;

    for (const child of childrenToDistribute) {
      const childHeight = getElementHeightWithMargins(child);
      
      if (currentPageHeight + childHeight > maxContentHeight && currentPageContent.length > 0) {
        pagesData.push(currentPageContent);
        currentPageContent = [child];
        currentPageHeight = childHeight;
      } else {
        currentPageContent.push(child);
        currentPageHeight += childHeight;
      }
    }
    if (currentPageContent.length > 0) {
      pagesData.push(currentPageContent);
    }

    const totalPages = pagesData.length;
    const currentDate = new Date().toLocaleDateString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });

    // 4. Crear contenedor temporal para renderizar las páginas paginadas
    const tempContainer = document.createElement('div');
    tempContainer.className = 'itea-voucher';
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '-9999px';
    tempContainer.style.width = '820px';
    document.body.appendChild(tempContainer);

    const pageElements: HTMLDivElement[] = [];

    // Construir cada página
    for (let i = 0; i < totalPages; i++) {
      const pageDiv = document.createElement('div');
      pageDiv.className = 'v-page v-page-temp';
      
      const contentDiv = document.createElement('div');
      contentDiv.className = 'v-page-content-temp';
      
      pagesData[i].forEach(child => {
        contentDiv.appendChild(child.cloneNode(true));
      });
      
      pageDiv.appendChild(contentDiv);

      // Agregar el footer personalizado con paginación
      if (footerElement) {
        const clonedFooter = footerElement.cloneNode(true) as HTMLElement;
        const footerRight = clonedFooter.querySelector('.v-footer-right');
        if (footerRight) {
          footerRight.innerHTML = `Voucher Electrónico — Orden #${fullSale.id}<br />www.itea.com.co &nbsp;|&nbsp; info@itea.com.co<br />Impreso el ${currentDate}<br />Página ${i + 1} de ${totalPages}`;
        }
        pageDiv.appendChild(clonedFooter);
      }

      tempContainer.appendChild(pageDiv);
      pageElements.push(pageDiv);
    }

    // Esperar un instante para que el navegador termine de renderizar el contenedor temporal
    await new Promise(resolve => setTimeout(resolve, 100));

    // 5. Capturar canvas por cada página y armar el jsPDF
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const imgHeight = 297; // exact A4 height in mm

    for (let i = 0; i < totalPages; i++) {
      if (i > 0) doc.addPage();
      
      const canvas = await html2canvas(pageElements[i], {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      
      doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, imgWidth, imgHeight);
    }

    // Limpiar contenedor temporal
    document.body.removeChild(tempContainer);

    return { doc, fullSale };
  };

  const executeDownloadPDF = async () => {
    if (!voucherSale) return;
    setIsPdfGenerating(true);
    try {
      setSuccessMessage(`Generando voucher #${voucherSale.id}...`);
      setShowSuccess(true);

      const { doc } = await buildVoucherPdf(voucherSale);
      doc.save(`Voucher_iTea_#${voucherSale.id}_${voucherSale.clientName.replace(/\s+/g, '_')}.pdf`);

      setSuccessMessage(`✅ Voucher descargado correctamente`);
      setTimeout(() => setShowSuccess(false), 3000);
      setVoucherSale(null);
      setVoucherFullSale(null);
    } catch (err) {
      console.error(err);
      setSuccessMessage(`❌ Error al generar el PDF`);
      setTimeout(() => setShowSuccess(false), 3000);
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const executeSendVoucher = async () => {
    if (!voucherSale) return;
    setIsSendingVoucher(true);
    try {
      setSuccessMessage(`Generando voucher #${voucherSale.id}...`);
      setShowSuccess(true);

      const { doc } = await buildVoucherPdf(voucherSale);

      // Extraer base64 limpio (sin prefijo data URI)
      const pdfBase64 = doc.output('datauristring').split(',')[1];

      setSuccessMessage(`Enviando al cliente...`);
      const result = await api.sendVoucher(voucherSale.id, pdfBase64);

      setSuccessMessage(`✅ Voucher enviado a ${result.email}`);
      setTimeout(() => setShowSuccess(false), 4000);
      setVoucherSale(null);
      setVoucherFullSale(null);
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.error?.message || 'Error al enviar el voucher';
      setSuccessMessage(`❌ ${msg}`);
      setTimeout(() => setShowSuccess(false), 4000);
    } finally {
      setIsSendingVoucher(false);
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
        <div className="fixed inset-0 pointer-events-none z-[200] flex justify-center">
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
        <div className="fixed top-20 right-6 z-[200] bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 animate-slide-in-right">
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
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-wrap w-full sm:w-auto">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      placeholder="Buscar por cliente, asesor, comisionista..." 
                      className="text-sm border border-gray-border rounded-lg pl-10 pr-9 py-2 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20 w-full"
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
                    className="text-sm border border-gray-border rounded-lg px-3 py-2 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20 w-full sm:w-auto"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="pagado">Finalizado</option>
                    <option value="abonado">Abonado</option>
                    <option value="credito">En Crédito</option>
                    <option value="anulado">Anulado</option>
                  </select>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <span className="text-xs font-semibold text-gray-400 whitespace-nowrap">Desde:</span>
                      <div className="w-full sm:w-36">
                        <DatePicker
                          value={startDate}
                          onChange={setStartDate}
                          fieldName="Fecha Inicial"
                          popoverDirection="down"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <span className="text-xs font-semibold text-gray-400 whitespace-nowrap">Hasta:</span>
                      <div className="w-full sm:w-36">
                        <DatePicker
                          value={endDate}
                          onChange={setEndDate}
                          fieldName="Fecha Final"
                          popoverDirection="down"
                        />
                      </div>
                    </div>
                    {(startDate || endDate) && (
                      <button 
                        onClick={() => { setStartDate(""); setEndDate(""); }}
                        className="text-red-400 hover:text-red-600 p-2 rounded bg-red-50 hover:bg-red-100 flex items-center justify-center h-[34px] w-[34px] shrink-0 self-end sm:self-auto border border-red-100"
                        title="Limpiar fechas"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {canCreate("sales") && (
                    <Button onClick={handleOpenNewSale} className="w-full sm:w-auto justify-center">
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
        contentClassName="!p-0 flex flex-col overflow-hidden h-[65vh] sm:h-[70vh] md:h-[75vh]"
      >
        <NewSaleWizard
          onClose={() => setIsWizardOpen(false)}
          onSuccess={(msg) => {
            setSuccessMessage(msg);
            setShowSuccess(true);
            setShowConfetti(true);
            setIsSiigoModalOpen(true);
            setTimeout(() => setShowConfetti(false), 3000);
            setTimeout(() => setShowSuccess(false), 3000);
          }}
        />
      </Modal>

      {/* ===== MODAL FACTURACIÓN SIIGO ===== */}
      <Modal
        isOpen={isSiigoModalOpen}
        onClose={() => setIsSiigoModalOpen(false)}
        title="Facturación Electrónica"
        size="md"
      >
        <div className="flex flex-col items-center text-center p-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-4 animate-bounce">
            <CheckCircle2 size={36} />
          </div>
          <h3 className="text-xl font-bold text-primary mb-2">¡Venta Registrada Exitosamente!</h3>
          <p className="text-gray-600 text-sm mb-6 max-w-sm">
            La venta ha sido guardada en el sistema. Para cumplir con la normativa legal, por favor procede a generar la factura electrónica en Siigo Nube.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Button
              onClick={() => setIsSiigoModalOpen(false)}
              variant="outline"
              className="flex-1 py-3 text-xs sm:text-sm font-bold border-gray-200 text-gray-500 hover:bg-gray-50"
            >
              Cerrar
            </Button>
            <a
              href="https://siigonube.siigo.com/#/sales-management/2044"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsSiigoModalOpen(false)}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-white font-bold text-xs sm:text-sm bg-accent hover:bg-accent/95 shadow-lg shadow-accent/25 transition-all text-center"
            >
              Generar Factura en Siigo
              <ExternalLink size={16} />
            </a>
          </div>
        </div>
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
        onClose={() => { if (!isPdfGenerating && !isSendingVoucher) { setVoucherSale(null); setVoucherFullSale(null); } }}
        title="Opciones de Voucher"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm text-center">
            ¿Qué deseas hacer con el voucher de la venta <strong>#{voucherSale?.id}</strong>?
          </p>
          <div className="flex flex-col gap-3 mt-4">
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-white flex justify-center items-center gap-2"
              onClick={executeSendVoucher}
              disabled={isSendingVoucher || isPdfGenerating}
            >
              {isSendingVoucher ? (
                <><Loader2 size={16} className="animate-spin" /> Enviando...</>
              ) : (
                <>✉ Enviar al Cliente</>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full flex justify-center items-center gap-2"
              onClick={executeDownloadPDF}
              disabled={isPdfGenerating || isSendingVoucher}
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
              onClick={() => { setVoucherSale(null); setVoucherFullSale(null); }}
              disabled={isSendingVoucher || isPdfGenerating}
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
