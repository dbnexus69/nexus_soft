import { memo, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Para el texto "Mostrando 1–20 de 47". Si falta, no se muestra. */
  total?: number;
  perPage?: number;
  /** Deshabilita los controles mientras llega la página. */
  loading?: boolean;
  className?: string;
  /**
   * Muestra el rango ("Mostrando 1-7 de 7") aunque haya una sola página.
   *
   * Por defecto el componente se oculta entero con `totalPages <= 1`, que es lo
   * que quieren la mayoría de las tablas. Pero eso también esconde el total, y
   * en una lista con filtros deja la sensación de que no hay paginación. Opt-in
   * para no cambiar el aspecto de las demás pantallas que ya lo usan.
   */
  alwaysShowRange?: boolean;
}

const VENTANA = 5; // cuántos números de página se ven a la vez

/**
 * Único componente de paginación de la aplicación.
 * Sirve tanto para paginación de servidor (se le pasa el meta de la API)
 * como de cliente (se le pasa el total calculado).
 */
export const Pagination = memo(function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  total,
  perPage,
  loading = false,
  className = '',
  alwaysShowRange = false,
}: PaginationProps) {
  // Los números visibles se derivan durante el render: no son estado.
  const paginas = useMemo(() => {
    let inicio = Math.max(1, currentPage - Math.floor(VENTANA / 2));
    const fin = Math.min(totalPages, inicio + VENTANA - 1);
    if (fin - inicio < VENTANA - 1) inicio = Math.max(1, fin - VENTANA + 1);
    return Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i);
  }, [currentPage, totalPages]);

  if (totalPages <= 1 && !alwaysShowRange) return null;
  // Con una sola página no hay a dónde navegar: se muestra solo el rango.
  const soloRango = totalPages <= 1;

  const primera = paginas[0];
  const ultima = paginas[paginas.length - 1];
  const hayRango = typeof total === 'number' && typeof perPage === 'number' && total > 0;
  const desde = hayRango ? (currentPage - 1) * perPage + 1 : 0;
  const hasta = hayRango ? Math.min(currentPage * perPage, total) : 0;

  const estiloNumero = (activa: boolean) =>
    `w-10 h-10 rounded-xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
      activa
        ? 'bg-primary text-white shadow-md'
        : 'border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
    }`;
  const estiloFlecha =
    'p-2 rounded-xl border border-gray-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-gray-500 dark:text-slate-400';

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 mt-4 ${className}`}>
      {hayRango ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Mostrando <span className="font-semibold text-gray-700 dark:text-slate-200">{desde}–{hasta}</span>
          {' '}de <span className="font-semibold text-gray-700 dark:text-slate-200">{total}</span>
        </p>
      ) : <span />}

      {soloRango ? null : (
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Página anterior"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || loading}
          className={estiloFlecha}
        >
          <ChevronLeft size={18} />
        </button>

        {primera > 1 ? (
          <>
            <button type="button" onClick={() => onPageChange(1)} disabled={loading} className={estiloNumero(false)}>
              1
            </button>
            {primera > 2 ? <span className="text-gray-400">…</span> : null}
          </>
        ) : null}

        {paginas.map((p) => (
          <button
            key={p}
            type="button"
            aria-current={p === currentPage ? 'page' : undefined}
            onClick={() => onPageChange(p)}
            disabled={loading}
            className={estiloNumero(p === currentPage)}
          >
            {p}
          </button>
        ))}

        {ultima < totalPages ? (
          <>
            {ultima < totalPages - 1 ? <span className="text-gray-400">…</span> : null}
            <button type="button" onClick={() => onPageChange(totalPages)} disabled={loading} className={estiloNumero(false)}>
              {totalPages}
            </button>
          </>
        ) : null}

        <button
          type="button"
          aria-label="Página siguiente"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || loading}
          className={estiloFlecha}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      )}
    </div>
  );
});
