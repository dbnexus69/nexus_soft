import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';

export interface AsyncOption {
  value: string;
  label: string;
  /** El registro completo, para que quien selecciona no tenga que buscarlo. */
  data?: any;
}

interface AsyncComboboxProps {
  value: string;
  /** Recibe el texto y, si viene de la lista, el registro completo. */
  onChange: (value: string, option?: AsyncOption) => void;
  /** Consulta al servidor. Debe devolver ya las opciones mapeadas. */
  fetchOptions: (query: string) => Promise<AsyncOption[]>;
  placeholder?: string;
  error?: string;
  className?: string;
  inputClassName?: string;
  /** Texto cuando no hay resultados. */
  emptyText?: string;
  disabled?: boolean;
}

const DEBOUNCE_MS = 300;

/**
 * Combo que busca contra el servidor en vez de filtrar una lista precargada.
 *
 * El Combobox normal recibe todas las opciones ya cargadas, lo que obliga a
 * traerse el catálogo entero (y a cortarlo en 100, perdiendo el resto sin
 * avisar). Este pide solo lo que coincide con lo que el usuario escribe.
 */
export function AsyncCombobox({
  value,
  onChange,
  fetchOptions,
  placeholder,
  error,
  className = '',
  inputClassName = '',
  emptyText = 'Sin resultados',
  disabled = false,
}: AsyncComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const [options, setOptions] = useState<AsyncOption[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Cada búsqueda lleva número: solo la última en salir escribe el resultado.
  // Sin esto, una respuesta lenta de "Ma" puede pisar a la de "Marta".
  const peticionRef = useRef(0);

  // Mientras está cerrado, el input refleja el valor de fuera.
  useEffect(() => {
    if (!isOpen) setSearchTerm(value);
  }, [value, isOpen]);

  useEffect(() => {
    const alClicarFuera = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', alClicarFuera);
    return () => document.removeEventListener('mousedown', alClicarFuera);
  }, []);

  const buscar = useCallback(async (q: string) => {
    const miTurno = ++peticionRef.current;
    setLoading(true);
    try {
      const res = await fetchOptions(q);
      if (peticionRef.current === miTurno) setOptions(res);
    } catch {
      if (peticionRef.current === miTurno) setOptions([]);
    } finally {
      if (peticionRef.current === miTurno) setLoading(false);
    }
  }, [fetchOptions]);

  // Debounce: no se consulta en cada tecla.
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => buscar(searchTerm), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm, isOpen, buscar]);

  const abrir = () => {
    if (disabled) return;
    setIsOpen(true);
    buscar(searchTerm); // primera tanda inmediata, sin esperar al debounce
  };

  const elegir = (opt: AsyncOption) => {
    onChange(opt.value, opt);
    setSearchTerm(opt.label);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          disabled={disabled}
          className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all disabled:opacity-60 ${
            error ? 'border-red-500' : 'border-gray-border'
          } ${inputClassName}`}
          value={searchTerm}
          placeholder={placeholder}
          onFocus={abrir}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            // Texto libre: se propaga sin registro asociado.
            onChange(e.target.value);
          }}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <ChevronDown size={16} />}
        </span>
      </div>

      {isOpen ? (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-border dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading && options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">Buscando...</div>
          ) : options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">{emptyText}</div>
          ) : (
            options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => elegir(opt)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
                  opt.value === value ? 'bg-primary/5 font-semibold text-primary dark:text-teal-400' : 'text-gray-700 dark:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
