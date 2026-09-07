import { SKELETON } from './Skeleton';

// La paginación vive en un único sitio: components/ui/Pagination.tsx

interface TableProps {
  headers?: React.ReactNode[];
  children: React.ReactNode;
  className?: string;
  /**
   * Filas fantasma mientras carga, en vez de las filas de verdad.
   *
   * Cinco páginas sustituían TODA su pantalla por `LoadingScreen`: la tabla, su
   * cabecera y los filtros desaparecían y volvían, y el alto de la página
   * saltaba en cada carga. Con el esqueleto la cabecera se queda quieta y se ve
   * dónde van a aparecer los datos.
   *
   * Quien llama decide cuándo: lo normal es `loading && filas.length === 0`, de
   * forma que una recarga con datos ya en pantalla no los haga parpadear.
   */
  loading?: boolean;
  skeletonRows?: number;
}

/**
 * Filas fantasma. Se exporta porque las tablas que construyen su propia
 * cabecera —clientes, usuarios, comisionistas— no pasan por la rama de
 * `headers` de `Table` y las ponen dentro de su `tbody`. Una sola definición
 * del efecto para todas.
 */
export function SkeletonRows({ columnas, filas }: { columnas: number; filas: number }) {
  return (
    <>
      {Array.from({ length: filas }, (_, i) => (
        <tr key={i}>
          <td colSpan={columnas} className="px-4 py-3">
            <div className={`${SKELETON} h-6`} />
          </td>
        </tr>
      ))}
    </>
  );
}

export function Table({ headers, children, className = '', loading = false, skeletonRows = 5 }: TableProps) {
  if (!headers) {
    return (
      <div className={`overflow-x-auto ${className}`}>
        <table className="w-full">
          {children}
        </table>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
            {headers.map((header, i) => (
              <th key={i} className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {loading
            ? <SkeletonRows columnas={headers.length || 1} filas={skeletonRows} />
            : children}
        </tbody>
      </table>
    </div>
  );
}

interface TableRowProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function TableRow({ children, onClick, className = '' }: TableRowProps) {
  return (
    <tr className={`hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${onClick ? 'cursor-pointer' : ''} ${className}`} onClick={onClick}>
      {children}
    </tr>
  );
}

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
  className?: string;
}

export function TableCell({ children, className = '', ...props }: TableCellProps) {
  return <td className={`px-4 py-3 text-sm dark:text-slate-300 ${className}`} {...props}>{children}</td>;
}