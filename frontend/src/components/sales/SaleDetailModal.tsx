import { useState, useEffect } from "react";
import {
  Plane,
  Building2,
  ShieldCheck,
  Package,
  Luggage,
  FileInput,
  Smartphone,
  Car,
  TreePine,
  Compass,
  Music,
  UtensilsCrossed,
  FileText,
  PawPrint,
  ShoppingBag,
  Loader2,
  AlertCircle
} from "lucide-react";
import * as api from "../../api";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { formatCurrency, formatDate, formatSaleId } from "../../utils/formatters";
import { Sale, Client } from "../../types";

const PRODUCT_ICONS: Record<string, React.ReactNode> = {
  Tiquetería: <Plane size={16} className="text-primary" />,
  Hotelería: <Building2 size={16} className="text-primary" />,
  Seguros: <ShieldCheck size={16} className="text-primary" />,
  Planes: <Package size={16} className="text-primary" />,
  CheckIn: <Luggage size={16} className="text-primary" />,
  Migración: <FileInput size={16} className="text-primary" />,
  SimCard: <Smartphone size={16} className="text-primary" />,
  AlquilerAutos: <Car size={16} className="text-primary" />,
  Finca: <TreePine size={16} className="text-primary" />,
  Tour: <Compass size={16} className="text-primary" />,
  Evento: <Music size={16} className="text-primary" />,
  Restaurante: <UtensilsCrossed size={16} className="text-primary" />,
  Visa: <FileText size={16} className="text-primary" />,
  Pasaporte: <FileText size={16} className="text-primary" />,
  Mascotas: <PawPrint size={16} className="text-primary" />,
};

function getProductDetails(type: string, data: any[]): { label: string; count: number } {
  const arr = data || [];
  return { label: type, count: arr.length };
}

interface SaleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSale: Sale | null;
  onViewProductDetails: (product: { type: string; data: any[] }) => void;
}


export default function SaleDetailModal({
  isOpen,
  onClose,
  selectedSale,
  onViewProductDetails,
}: SaleDetailModalProps) {
  const [fullSale, setFullSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Cada categoría se pide cuando el usuario la abre, no al cargar el modal.
  const [loadedProducts, setLoadedProducts] = useState<Record<string, any[]>>({});
  const [loadingSection, setLoadingSection] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && selectedSale) {
      setLoading(true);
      setError("");
      setLoadedProducts({});
      api.getSale(selectedSale.id).then(fetched => {
        setFullSale(fetched);
      }).catch(() => {
        setFullSale(selectedSale);
        setError("No se pudieron cargar los detalles completos");
      }).finally(() => setLoading(false));
    } else {
      setFullSale(null);
      setLoadedProducts({});
      setLoadingSection(null);
    }
  }, [isOpen, selectedSale]);

  if (!selectedSale) return null;

  const sale = fullSale || selectedSale;
  const commissionAmount = sale.commissionAgentNetPayment || 0;
  const supplierCost = sale.supplierCost || 0;
  const gananciaNeta = sale.total - supplierCost - commissionAmount;

  const productSections = [
    { key: "ticketData", label: "Tiquetería", summaryType: "ticket" },
    { key: "hotelData", label: "Hotelería", summaryType: "hotel" },
    { key: "insuranceData", label: "Seguros", summaryType: "insurance" },
    { key: "planData", label: "Planes", summaryType: "plan" },
    { key: "checkInData", label: "CheckIn", summaryType: "checkin" },
    { key: "migrationData", label: "Migración", summaryType: "migration" },
    { key: "simCardData", label: "SimCard", summaryType: "simcard" },
    { key: "carRentalData", label: "AlquilerAutos", summaryType: "car" },
    { key: "fincaData", label: "Finca", summaryType: "finca" },
    { key: "tourData", label: "Tour", summaryType: "tour" },
    { key: "conventionData", label: "Evento", summaryType: "convention" },
    { key: "restaurantData", label: "Restaurante", summaryType: "restaurant" },
    { key: "visaData", label: "Visa", summaryType: "visa" },
    { key: "passportData", label: "Pasaporte", summaryType: "passport" },
    { key: "petServiceData", label: "Mascotas", summaryType: "pet" },
  ];

  const suppliersList = (() => {
    const suppliers = new Set<string>();
    productSections.forEach(({ summaryType }) => {
      const dataArr = loadedProducts[summaryType];
      if (Array.isArray(dataArr)) {
        dataArr.forEach((item: any) => {
          const name = item.supplier || item.supplierName;
          if (name && typeof name === "string" && name.trim()) {
            suppliers.add(name.trim());
          }
        });
      }
    });
    return Array.from(suppliers).join(", ") || "No especificado";
  })();

  const inventory: { category: string; label: string; count: number }[] = (sale as any).products || [];
  const hasCategory = (slug: string) => inventory.some(p => p.category === slug && p.count > 0);
  const hasAnyProduct = (sale.servicesSummary && sale.servicesSummary.length > 0) || inventory.length > 0;

  const getCustomObservations = (obs: string) => {
    if (!obs) return "";
    const parts = obs.split("\n---\n");
    if (parts.length > 1) {
      return parts[1].trim();
    }
    const txt = parts[0].trim();
    const hasServiceKeywords = productSections.some(({ label }) => 
      txt.toLowerCase().includes(label.toLowerCase())
    ) || txt.toLowerCase().includes("luticket") || txt.toLowerCase().includes("decameron");
    
    if (hasServiceKeywords && txt.split("\n").length <= 2) {
      return "";
    }
    return txt;
  };

  const onViewProductClick = async (slug: string, label: string) => {
    if (loadedProducts[slug]) {
      onViewProductDetails({ type: label, data: loadedProducts[slug] });
      return;
    }
    setLoadingSection(slug);
    try {
      const data = await api.getSaleProductsByCategory(sale.id, slug);
      setLoadedProducts(prev => ({ ...prev, [slug]: data }));
      onViewProductDetails({ type: label, data });
    } catch {
      setError(`No se pudo cargar ${label}`);
    } finally {
      setLoadingSection(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Detalle de Venta #${formatSaleId(sale.id)}`}
      size="lg"
      footer={
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Sección Venta */}
        <div>
          <h4 className="text-sm font-bold text-primary border-b border-gray-200 pb-2 mb-3">
            Información de la Venta
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div>
              <span className="text-gray-500 text-xs block">Venta #</span>
              <span className="font-bold text-gray-800">{formatSaleId(sale.id)}</span>
            </div>
            <div>
              <span className="text-gray-500 text-xs block">Fecha</span>
              <span className="font-medium text-gray-800">
                {formatDate(sale.date)}
              </span>
            </div>
            <div>
              <span className="text-gray-500 text-xs block">Estado</span>
              <Badge variant={sale.status}>{sale.status}</Badge>
            </div>
            <div>
              <span className="text-gray-500 text-xs block">Valor Final</span>
              <span className="font-black text-emerald-600">
                {formatCurrency(sale.total)}
              </span>
            </div>
            {sale.isCredit && sale.creditDueDate && (
              <div className="col-span-2 sm:col-span-1">
                <span className="text-gray-500 text-xs block">Vence Crédito</span>
                <span className="font-medium text-rose-600">
                  {formatDate(sale.creditDueDate)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Sección Cliente */}
        <div>
          <h4 className="text-sm font-bold text-primary border-b border-gray-200 pb-2 mb-3">
            Detalles del Cliente
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div className="col-span-2 sm:col-span-1">
              <span className="text-gray-500 text-xs block">Nombre</span>
              <span className="font-medium text-gray-800">
                {sale.clientName}
              </span>
            </div>
            {(sale as any).clientDocNumber ? (
              <>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-gray-500 text-xs block">Documento</span>
                  <span className="font-medium text-gray-800">
                    {(sale as any).clientDocType} {(sale as any).clientDocNumber}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-gray-500 text-xs block">Correo</span>
                  <span className="font-medium text-gray-800 break-words">
                    {sale.clientEmail}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-gray-500 text-xs block">Teléfono</span>
                  <span className="font-medium text-gray-800">
                    {(sale as any).clientPhone}
                  </span>
                </div>
              </>
            ) : (
              <div className="col-span-3 text-sm text-gray-400 italic flex items-center">
                Detalles adicionales del cliente no disponibles
              </div>
            )}
          </div>
        </div>

        {/* Sección Responsable */}
        {sale.responsableName && (
          <div>
            <h4 className="text-sm font-bold text-primary border-b border-gray-200 pb-2 mb-3">
              Responsable de la Venta
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <div>
                <span className="text-gray-500 text-xs block">Nombre del Responsable</span>
                <span className="font-medium text-gray-800">
                  {sale.responsableName}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Sección Operativo y Financiero */}
        <div>
          <h4 className="text-sm font-bold text-primary border-b border-gray-200 pb-2 mb-3">
            Detalles Operativos y Financieros
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div>
              <span className="text-gray-500 text-xs block">
                Asesor
              </span>
              <span className="font-medium text-gray-800">
                {sale.asesorName}
              </span>
            </div>

            <div>
              <span className="text-gray-500 text-xs block">
                Pago a Proveedores
              </span>
              <span className="font-medium text-rose-600">
                {formatCurrency(supplierCost)}
              </span>
            </div>
            <div>
              <span className="text-gray-500 text-xs block">Pago Comisionista</span>
              <span className="font-medium text-amber-600">
                {formatCurrency(commissionAmount)}
              </span>
            </div>
            <div>
              <span className="text-gray-500 text-xs block">Ganancia Oficina</span>
              <span className="font-bold text-emerald-600">
                {formatCurrency(gananciaNeta)}
              </span>
            </div>
          </div>
        </div>

        {/* Sección Comisionista */}
        {(sale.commissionAgentName || commissionAmount > 0) && (
          <div>
            <h4 className="text-sm font-bold text-primary border-b border-gray-200 pb-2 mb-3">
              Detalles del Comisionista
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <div>
                <span className="text-gray-500 text-xs block">Nombre</span>
                <span className="font-medium text-gray-800">
                  {sale.commissionAgentName || "-"}
                </span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">% Retención Oficina</span>
                <span className="font-medium text-gray-800">
                  {sale.commissionAgentRetentionPercentage || 0}%
                </span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Neto a Pagar</span>
                <span className="font-bold text-rose-600">
                  {formatCurrency(commissionAmount)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Servicios Vendidos */}
        <div>
          <h4 className="text-sm font-bold text-primary border-b border-gray-200 pb-2 mb-3 flex items-center gap-2">
            <ShoppingBag size={16} className="text-accent" /> Desglose de Servicios
          </h4>
          {!hasAnyProduct ? (
            <p className="text-sm text-gray-400 italic p-4 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
              No hay servicios registrados para esta venta.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {productSections.map(({ key, label, summaryType }) => {
                // If fullSale has loaded, check if this section has products.
                // Otherwise, check if this category exists in servicesSummary.
                // El inventario de la cabecera dice qué categorías tiene la venta
                // y cuántas, sin traer sus datos.
                const inv = inventory.find(p => p.category === summaryType);
                const hasProduct = inv
                  ? inv.count > 0
                  : (sale.servicesSummary || []).some(s => s.tipo === summaryType);

                if (!hasProduct) return null;

                const isPending = loadingSection === summaryType;
                const itemsCount = inv?.count ?? (loadedProducts[summaryType]?.length || 1);

                return (
                  <div key={key} className="bg-gray-50 border border-gray-200 p-3 rounded-lg flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                      {PRODUCT_ICONS[label] || <ShoppingBag size={16} className="text-primary" />}
                      {label} {fullSale ? `(${itemsCount})` : ""}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => onViewProductClick(summaryType, label)}
                      className="text-xs py-1.5 px-3 border-gray-200 text-gray-700 hover:bg-gray-50"
                    >
                      {isPending ? (
                        <span className="flex items-center gap-1">
                          <Loader2 size={12} className="animate-spin text-accent" />
                          Cargando...
                        </span>
                      ) : (
                        "Ver Detalles"
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Observaciones */}
        {(() => {
          const customObs = getCustomObservations(sale.observations || "");
          if (!customObs) return null;
          return (
            <div>
              <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                Observaciones Adicionales
              </h5>
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100 whitespace-pre-wrap shadow-inner">
                {customObs}
              </p>
            </div>
          );
        })()}

        {/* Historial de Pagos */}
        {(() => {
          const payments = sale.payments || [];
          if (payments.length === 0) return null;
          return (
            <div>
              <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                Historial de Pagos
              </h5>
              <div className="space-y-2">
                {payments.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors">
                    <span className="font-bold text-gray-800 text-sm">{formatCurrency(p.amount)}</span>
                    <span className="text-xs text-gray-500 font-medium">{p.method} · {formatDate(p.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </Modal>
  );
}
