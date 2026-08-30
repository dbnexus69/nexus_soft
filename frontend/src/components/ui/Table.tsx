
// La paginación vive en un único sitio: components/ui/Pagination.tsx

interface TableProps {
  headers?: React.ReactNode[];
  children: React.ReactNode;
  className?: string;
}

export function Table({ headers, children, className = '' }: TableProps) {
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
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">{children}</tbody>
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