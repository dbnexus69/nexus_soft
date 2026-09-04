import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { AlertCircle, ChevronDown, Receipt } from "lucide-react";
import * as api from "../../api";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { formatCurrency, formatDate, formatSaleId } from "../../utils/formatters";
import { Sale } from "../../types";
import { ServiceRow } from "./detail/ServiceRow";
import { formaDe } from "./detail/serviceShapes";

interface SaleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSale: Sale | null;
}

/**
 * Un par etiqueta/valor de los metadatos. Fuera del componente y memoizado:
 * se pintan hasta doce y no dependen de nada más que de sus props.
 */
const Meta = memo(function Meta({ etiqueta, valor }: { etiqueta: string; valor: any }) {
  if (valor === null || valor === undefined || valor === "" ) return null;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-accent dark:text-slate-400">{etiqueta}</dt>
      <dd className="text-sm font-medium text-primary dark:text-white break-words">{String(valor)}</dd>
    </div>
  );
});

/**
 * Detalle de una venta.
 *
 * La jerarquía dice de qué va una venta: primero el dinero y su estado, luego
 * los servicios —que son el contenido real— y al final los metadatos, plegados.
 *
 * Antes eran siete secciones apiladas con el mismo peso visual (encabezado con
 * borde + tarjeta blanca con una rejilla de pares etiqueta/valor), y para ver
 * un servicio había que abrir un SEGUNDO modal, uno por categoría. Ahora cada
 * servicio se despliega en su sitio, con la forma que le corresponde.
 */
export default function SaleDetailModal({ isOpen, onClose, selectedSale }: SaleDetailModalProps) {
  const [fullSale, setFullSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Cada categoría se pide cuando el usuario la despliega, no al abrir.
  const [productos, setProductos] = useState<Record<string, any[]>>({});
  const [cargando, setCargando] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [verMeta, setVerMeta] = useState(false);

  useEffect(() => {
    if (!isOpen || !selectedSale) {
      setFullSale(null); setProductos({}); setCargando(null); setAbierta(null); setVerMeta(false);
      return;
    }
    let vivo = true;
    setLoading(true);
    setError("");
    setProductos({});
    setAbierta(null);
    api.getSale(selectedSale.id)
      .then(v => { if (vivo) setFullSale(v); })
      .catch(() => {
        if (!vivo) return;
        setFullSale(selectedSale);
        setError("No se pudieron cargar los detalles completos");
      })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
    // `selectedSale?.id`, no el objeto: una identidad nueva del padre repetiría
    // la petición sin que haya cambiado la venta.
  }, [isOpen, selectedSale?.id]);

  const sale = fullSale || selectedSale;

  /**
   * Al desplegar se pide la categoría si aún no está. Se guarda en `productos`
   * para que volver a abrirla no cueste otra petición.
   */
  const alternar = useCallback(async (slug: string) => {
    setAbierta(prev => (prev === slug ? null : slug));
    setProductos(prev => {
      if (prev[slug]) return prev;
      // La carga se dispara fuera del setState; aquí solo se comprueba.
      return prev;
    });
    if (productos[slug] || !sale) return;
    setCargando(slug);
    try {
      const data = await api.getSaleProductsByCategory(sale.id, slug);
      setProductos(prev => ({ ...prev, [slug]: data }));
    } catch {
      setError(`No se pudo cargar ${formaDe(slug).label}`);
    } finally {
      setCargando(null);
    }
  }, [productos, sale]);

  // Derivados durante el render, no en estado ni en efectos.
  const cifras = useMemo(() => {
    if (!sale) return null;
    const pagos = sale.payments || [];
    const pagado = pagos.length
      ? pagos.reduce((a: number, p: any) => a + (Number(p.amount) || 0), 0)
      : Number(sale.creditPaidAmount) || 0;
    const total = Number(sale.total) || 0;
    const costo = Number(sale.supplierCost) || 0;
    const comision = Number(sale.commissionAgentNetPayment) || 0;
    return {
      total, pagado,
      pendiente: Math.max(0, total - pagado),
      costo, comision,
      ganancia: total - costo - comision,
    };
  }, [sale]);

  if (!selectedSale || !sale || !cifras) return null;

  const inventario: { category: string; label: string; count: number }[] = (sale as any).products || [];
  const conServicios = inventario.filter(p => p.count > 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Venta #${formatSaleId(sale.id)}`}
      size="lg"
      contentClassName="!p-0"
      footer={<Button variant="outline" onClick={onClose}>Cerrar</Button>}
    >
      <div className="divide-y divide-gray-border dark:divide-slate-800">

        {/* ── El hecho principal: cuánto, cuánto falta, en qué estado ───── */}
        <header className="px-4 sm:px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-accent dark:text-slate-400">
                {sale.clientName || "Cliente"}
                {sale.date ? <span className="mx-1.5">·</span> : null}
                {sale.date ? formatDate(sale.date) : null}
              </p>
              {/* El importe es el dato que se busca al abrir: va grande y en
                  cifras tabulares para poder comparar entre ventas. */}
              <p className="font-heading text-[2.125rem] leading-none font-bold text-primary dark:text-white tabular-nums mt-1.5">
                {formatCurrency(cifras.total)}
              </p>
            </div>
            <Badge variant={sale.status as any} className="mt-1">{sale.status}</Badge>
          </div>

          {cifras.pendiente > 0 ? (
            <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <span className="text-sm text-accent dark:text-slate-400">
                Pagado <span className="font-semibold text-primary dark:text-white tabular-nums">{formatCurrency(cifras.pagado)}</span>
              </span>
              {/* El acento marca lo que pide atención, no decora. */}
              <span className="text-sm text-accent dark:text-slate-400">
                Falta <span className="font-semibold text-highlight tabular-nums">{formatCurrency(cifras.pendiente)}</span>
              </span>
            </div>
          ) : (
            <p className="mt-4 text-sm text-success font-medium">Pagada por completo</p>
          )}

          {error ? (
            <p className="mt-4 flex items-center gap-2 text-xs text-warning">
              <AlertCircle size={14} /> {error}
            </p>
          ) : null}
        </header>

        {/* ── Los servicios: el contenido real de la venta ──────────────── */}
        <section>
          <div className="flex items-baseline justify-between px-4 sm:px-6 pt-4 pb-2">
            <h3 className="font-heading text-sm font-semibold text-primary dark:text-white">
              Servicios
            </h3>
            {conServicios.length > 0 ? (
              <span className="text-xs text-accent dark:text-slate-400">
                {conServicios.reduce((a, p) => a + p.count, 0)} en esta venta
              </span>
            ) : null}
          </div>

          {loading ? (
            <ul className="divide-y divide-gray-border dark:divide-slate-800">
              {[0, 1, 2].map(i => (
                <li key={i} className="px-4 sm:px-5 py-3.5 flex items-center gap-3 animate-pulse motion-reduce:animate-none">
                  <div className="w-[18px] h-[18px] rounded bg-gray-200 dark:bg-slate-700/60 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-48 max-w-[50%] rounded bg-gray-200 dark:bg-slate-700/60" />
                    <div className="h-3 w-64 max-w-[70%] rounded bg-gray-100 dark:bg-slate-800" />
                  </div>
                </li>
              ))}
            </ul>
          ) : conServicios.length === 0 ? (
            <p className="px-4 sm:px-6 pb-5 text-sm text-accent dark:text-slate-400">
              Esta venta no tiene servicios registrados.
            </p>
          ) : (
            <ul className="border-t border-gray-border dark:border-slate-800">
              {conServicios.map(p => (
                <ServiceRow
                  key={p.category}
                  categoria={p.category}
                  cantidad={p.count}
                  items={productos[p.category]}
                  abierta={abierta === p.category}
                  cargando={cargando === p.category}
                  onToggle={alternar}
                />
              ))}
            </ul>
          )}
        </section>

        {/* ── Pagos ─────────────────────────────────────────────────────── */}
        {(sale.payments || []).length > 0 ? (
          <section className="px-4 sm:px-6 py-4">
            <h3 className="font-heading text-sm font-semibold text-primary dark:text-white mb-2.5">
              Pagos
            </h3>
            <ul className="space-y-1.5">
              {(sale.payments as any[]).map((p, i) => (
                <li key={p.id || i} className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="text-accent dark:text-slate-400 flex items-center gap-2 min-w-0">
                    <Receipt size={14} className="shrink-0" />
                    <span className="truncate">{p.method || "Sin método"}</span>
                    <span className="text-xs shrink-0">{p.date ? formatDate(p.date) : ""}</span>
                  </span>
                  <span className="font-semibold text-primary dark:text-white tabular-nums shrink-0">
                    {formatCurrency(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ── Metadatos: plegados, porque casi nunca es lo que se busca ── */}
        <section>
          <button
            type="button"
            onClick={() => setVerMeta(v => !v)}
            aria-expanded={verMeta}
            className="w-full flex items-center justify-between px-4 sm:px-6 py-3.5 text-left hover:bg-gray-light dark:hover:bg-slate-800/60 transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight/50 focus-visible:ring-inset"
          >
            <span className="font-heading text-sm font-semibold text-primary dark:text-white">
              Cliente, asesor y finanzas
            </span>
            <ChevronDown size={16} className={`text-accent transition-transform motion-reduce:transition-none ${verMeta ? "rotate-180" : ""}`} />
          </button>

          {verMeta ? (
            <dl className="px-4 sm:px-6 pb-5 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <Meta etiqueta="Cliente" valor={sale.clientName} />
              <Meta etiqueta="Documento" valor={(sale as any).clientDocNumber} />
              <Meta etiqueta="Correo" valor={sale.clientEmail} />
              <Meta etiqueta="Asesor" valor={sale.asesorName} />
              <Meta etiqueta="Responsable" valor={(sale as any).responsableName} />
              <Meta etiqueta="Fecha" valor={sale.date ? formatDate(sale.date) : null} />
              <Meta etiqueta="Costo proveedor" valor={cifras.costo ? formatCurrency(cifras.costo) : null} />
              <Meta etiqueta="TA" valor={sale.ta ? formatCurrency(sale.ta) : null} />
              <Meta etiqueta="Ganancia neta" valor={formatCurrency(cifras.ganancia)} />
              <Meta etiqueta="Comisionista" valor={sale.commissionAgentName} />
              <Meta etiqueta="Comisión neta" valor={cifras.comision ? formatCurrency(cifras.comision) : null} />
              <Meta etiqueta="Vence crédito" valor={sale.creditDueDate ? formatDate(sale.creditDueDate) : null} />
            </dl>
          ) : null}
        </section>

        {/* ── Observaciones ─────────────────────────────────────────────── */}
        {sale.observations ? (
          <section className="px-4 sm:px-6 py-4">
            <h3 className="font-heading text-sm font-semibold text-primary dark:text-white mb-2">
              Observaciones
            </h3>
            <p className="text-sm text-primary dark:text-slate-300 whitespace-pre-wrap leading-relaxed border-l-2 border-highlight/40 pl-3">
              {sale.observations}
            </p>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
