import { memo } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { formatCurrency } from "../../../utils/formatters";
import { formaDe } from "./serviceShapes";

interface ServiceRowProps {
  /** Slug de la categoría: ticket, hotel, insurance… */
  categoria: string;
  /** Cuántos servicios de esta categoría tiene la venta, del inventario. */
  cantidad: number;
  /** Los servicios ya cargados, o undefined si aún no se han pedido. */
  items?: any[];
  abierta: boolean;
  cargando: boolean;
  onToggle: (categoria: string) => void;
}

/**
 * Un servicio de la venta, desplegable en su sitio.
 *
 * Antes esto era una píldora con el nombre de la categoría y un botón que abría
 * un SEGUNDO modal. Se perdían dos cosas: no se veía de qué iba el servicio sin
 * abrirlo —ni ruta, ni fecha, ni para quién— y no se podían comparar dos
 * servicios de la misma venta sin cerrar y volver a abrir.
 *
 * Memoizada porque una venta grande pinta hasta quince de estas y el modal
 * re-renderiza cada vez que se abre o cierra cualquier otra.
 */
export const ServiceRow = memo(function ServiceRow({
  categoria, cantidad, items, abierta, cargando, onToggle,
}: ServiceRowProps) {
  const forma = formaDe(categoria);
  const { Icono, Detalle } = forma;

  // Con la fila cerrada solo se conoce el inventario (categoría y cuántos). El
  // resumen de cada servicio necesita sus datos, que llegan al desplegar.
  const cargados = items || [];
  const resumenes = cargados.map(it => forma.resumen(it));
  const importe = cargados.reduce((a, it) => a + (Number(it.ta) || 0) + (Number(it.supplierCost) || 0), 0);

  return (
    <li className={`border-b border-gray-border dark:border-slate-800 last:border-b-0 transition-colors ${abierta ? "bg-highlight-soft/40 dark:bg-highlight-soft/30" : ""}`}>
      <button
        type="button"
        onClick={() => onToggle(categoria)}
        aria-expanded={abierta}
        className="w-full flex items-start gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-gray-light dark:hover:bg-slate-800/60 transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight/50 focus-visible:ring-inset"
      >
        <span className={`shrink-0 mt-0.5 ${abierta ? "text-highlight" : "text-accent dark:text-slate-400"}`}>
          <Icono size={18} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-heading font-semibold text-primary dark:text-white">
              {resumenes[0]?.titulo || forma.label}
            </span>
            {cantidad > 1 ? (
              <span className="text-xs text-accent dark:text-slate-400">
                y {cantidad - 1} más
              </span>
            ) : null}
          </span>
          <span className="block text-xs text-accent dark:text-slate-400 mt-0.5 truncate">
            {resumenes[0]?.meta || forma.label}
          </span>
        </span>

        {/* Cuándo y cuánto, cada uno en su columna: es lo que se escanea. */}
        <span className="hidden sm:block shrink-0 text-xs text-accent dark:text-slate-400 tabular-nums text-right w-32 mt-0.5">
          {resumenes[0]?.cuando || ""}
        </span>
        <span className="shrink-0 text-sm font-semibold text-primary dark:text-white tabular-nums text-right w-28 mt-0.5">
          {importe > 0 ? formatCurrency(importe) : ""}
        </span>

        <span className="shrink-0 text-accent dark:text-slate-500 mt-0.5">
          {cargando ? (
            <Loader2 size={16} className="animate-spin motion-reduce:animate-none text-highlight" />
          ) : (
            <ChevronRight size={16} className={`transition-transform motion-reduce:transition-none ${abierta ? "rotate-90" : ""}`} />
          )}
        </span>
      </button>

      {abierta ? (
        <div className="px-4 sm:px-5 pb-5 pl-11 sm:pl-12 space-y-5">
          {cargados.length === 0 && !cargando ? (
            <p className="text-sm text-accent dark:text-slate-400 italic">
              No se pudo cargar el detalle de este servicio.
            </p>
          ) : (
            cargados.map((item, i) => (
              <div key={item.id || i} className={i > 0 ? "pt-5 border-t border-gray-border/60 dark:border-slate-800" : ""}>
                {cargados.length > 1 ? (
                  <p className="text-xs text-highlight dark:text-highlight font-semibold mb-2.5">
                    {resumenes[i]?.titulo}
                  </p>
                ) : null}
                <Detalle item={item} />
                {item.supplier ? (
                  <p className="text-xs text-accent dark:text-slate-500 mt-3">
                    Proveedor: <span className="text-primary dark:text-slate-300">{item.supplier}</span>
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </li>
  );
});
