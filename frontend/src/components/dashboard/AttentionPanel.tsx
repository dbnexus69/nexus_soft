import { memo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, PlaneTakeoff, FileSearch, Check, ArrowRight } from "lucide-react";
import { formatCurrency, formatDateTime } from "../../utils/formatters";
import { AttentionSummary } from "../../types";

/**
 * Lo que requiere acción hoy.
 *
 * Sustituye a la tabla "Últimas Ventas Aprobadas", que ni filtraba por
 * aprobadas —el backend no aplicaba filtro de estado— ni aportaba nada: las
 * mismas columnas que /sales con cinco filas y sin búsqueda ni filtros.
 *
 * Un dashboard sirve para decidir qué hacer, no para ser una copia peor de otra
 * pantalla. Cada línea lleva al sitio donde el asunto se resuelve.
 */

/** Cuántos días hace de una fecha, para decir "hace 21 días" sin librerías. */
function diasDesde(iso: string) {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "hace 1 día";
  return `hace ${dias} días`;
}

interface FilaProps {
  Icono: typeof AlertTriangle;
  /** Urgente pinta el acento; el resto queda en silencio deliberadamente. */
  urgente?: boolean;
  titulo: string;
  detalle: string | null;
  importe?: number;
  a: string;
}

const Fila = memo(function Fila({ Icono, urgente, titulo, detalle, importe, a }: FilaProps) {
  return (
    <li>
      <Link
        to={a}
        className="group flex items-center gap-4 px-5 py-4 hover:bg-gray-light dark:hover:bg-slate-800/60 transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight/50 focus-visible:ring-inset"
      >
        <span className={`shrink-0 ${urgente ? "text-highlight" : "text-accent dark:text-slate-500"}`}>
          <Icono size={18} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block font-heading font-semibold text-primary dark:text-white">
            {titulo}
          </span>
          {detalle ? (
            <span className="block text-xs text-accent dark:text-slate-400 mt-0.5 truncate">
              {detalle}
            </span>
          ) : null}
        </span>

        {typeof importe === "number" && importe > 0 ? (
          <span className={`shrink-0 text-sm font-semibold tabular-nums ${urgente ? "text-highlight" : "text-primary dark:text-white"}`}>
            {formatCurrency(importe)}
          </span>
        ) : null}

        <ArrowRight
          size={16}
          className="shrink-0 text-accent/50 dark:text-slate-600 group-hover:text-highlight transition-colors motion-reduce:transition-none"
        />
      </Link>
    </li>
  );
});

const Esqueleto = memo(function Esqueleto() {
  return (
    <ul className="divide-y divide-gray-border dark:divide-slate-800">
      {[0, 1, 2].map(i => (
        <li key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse motion-reduce:animate-none">
          <div className="w-[18px] h-[18px] rounded bg-gray-200 dark:bg-slate-700/60 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-44 max-w-[45%] rounded bg-gray-200 dark:bg-slate-700/60" />
            <div className="h-3 w-56 max-w-[60%] rounded bg-gray-100 dark:bg-slate-800" />
          </div>
        </li>
      ))}
    </ul>
  );
});

export const AttentionPanel = memo(function AttentionPanel({
  resumen, cargando,
}: { resumen: AttentionSummary | null; cargando: boolean }) {
  const filas: FilaProps[] = [];

  if (resumen) {
    const { overdueCredit: c, criticalCheckins: k, unreviewedSales: r } = resumen;

    if (c.count > 0) {
      filas.push({
        Icono: AlertTriangle,
        urgente: true,
        titulo: c.count === 1 ? "1 crédito vencido" : `${c.count} créditos vencidos`,
        detalle: c.oldestDueDate ? `el más antiguo venció ${diasDesde(c.oldestDueDate)}` : null,
        importe: c.amount,
        a: "/sales",
      });
    }

    if (k.count > 0) {
      const n = k.next;
      filas.push({
        Icono: PlaneTakeoff,
        urgente: true,
        titulo: k.count === 1 ? "1 check-in en 48 horas" : `${k.count} check-ins en 48 horas`,
        detalle: n
          ? `${n.origin || "???"} → ${n.destination || "???"}, ${formatDateTime(n.departure)}`
          : null,
        a: "/flights",
      });
    }

    if (r.count > 0) {
      filas.push({
        Icono: FileSearch,
        titulo: r.count === 1 ? "1 venta sin revisar" : `${r.count} ventas sin revisar`,
        detalle: null,
        importe: r.amount,
        a: "/sales",
      });
    }
  }

  return (
    <section className="bg-white/95 dark:bg-[#131524]/95 border border-gray-border dark:border-slate-800 rounded-2xl overflow-hidden">
      <h2 className="font-heading text-sm font-semibold text-primary dark:text-white px-5 py-4 border-b border-gray-border dark:border-slate-800">
        Requiere atención
      </h2>

      {cargando && !resumen ? (
        <Esqueleto />
      ) : filas.length === 0 ? (
        // Una pantalla vacía es una invitación a actuar, o una confirmación.
        // Aquí es lo segundo: no hay nada pendiente y eso hay que decirlo.
        <p className="flex items-center gap-2.5 px-5 py-6 text-sm text-accent dark:text-slate-400">
          <Check size={18} className="text-success shrink-0" />
          Nada pendiente: sin créditos vencidos, sin check-ins inminentes y todas las ventas revisadas.
        </p>
      ) : (
        <ul className="divide-y divide-gray-border dark:divide-slate-800">
          {filas.map(f => <Fila key={f.titulo} {...f} />)}
        </ul>
      )}
    </section>
  );
});
