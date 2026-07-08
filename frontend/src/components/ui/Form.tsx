import { ReactNode, useState, useRef, useEffect } from 'react';
import { X, AlertCircle, ChevronDown, Search } from 'lucide-react';

interface FormFieldProps {
  label: ReactNode;
  children: ReactNode;
  error?: string;
  className?: string;
  required?: boolean;
}

export function FormField({ label, children, error, className = "" }: FormFieldProps) {
  const hasMb = className.split(' ').some(c => c.startsWith('mb-'));
  return (
    <div className={`${hasMb ? '' : 'mb-4'} ${className}`}>
      <label className={`block text-sm font-medium mb-1 ${error ? 'text-red-500' : 'text-gray-700'}`}>{label}</label>
      {children}
      {error && (
        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
          <AlertCircle size={14} />
          {error}
        </p>
      )}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export function Input({ className = '', error, onBlur, value, ...props }: InputProps) {
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if ((props.type === 'date' || props.type === 'datetime-local') && props.min && val) {
      const minDate = new Date(props.min);
      const inputDate = new Date(val);

      if (!isNaN(minDate.getTime()) && !isNaN(inputDate.getTime())) {
        if (inputDate < minDate) {
          // Coerce to minimum allowed value
          e.target.value = String(props.min);
          
          // Dispatch change event to update React parent states
          if (props.onChange) {
            const changeEvent = Object.create(e);
            changeEvent.target = e.target;
            changeEvent.currentTarget = e.target;
            props.onChange(changeEvent);
          }
        }
      }
    }
    if (onBlur) {
      onBlur(e);
    }
  };

  const safeValue = props.type === 'file' ? undefined : (value ?? '');

  return (
    <input
      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 ${
        error ? 'border-red-500' : 'border-gray-border'
      } ${className}`}
      onBlur={handleBlur}
      value={safeValue}
      {...props}
    />
  );
}

export function CurrencyInput({ className = '', error, value, onChange, placeholder, ...props }: InputProps & { value?: string | number, onChange?: (val: string) => void }) {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    if (value !== undefined && value !== null && value !== '') {
      const num = Number(value);
      if (!isNaN(num)) {
        setDisplayValue(new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0
        }).format(num));
      }
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawValue = e.target.value.replace(/\D/g, '');
    if (rawValue.length > 8) {
      rawValue = rawValue.slice(0, 8);
    }
    if (onChange) {
      onChange(rawValue);
    }
  };

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder || "$ 0"}
      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 ${
        error ? 'border-red-500' : 'border-gray-border'
      } ${className}`}
      {...props}
    />
  );
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
  className?: string;
  inputClassName?: string;
  preventNumbers?: boolean;
  direction?: 'down' | 'up';
}

export function Combobox({ value, onChange, options, placeholder, error, className = '', inputClassName = '', preventNumbers, direction = 'down' }: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      const selected = options.find(o => o.value === value);
      const displayValue = selected ? selected.label : value;
      setSearchTerm(preventNumbers ? displayValue.replace(/[0-9]/g, "") : displayValue);
    }
  }, [value, options, isOpen, preventNumbers]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find(o => o.value === value)?.label || value;
  
  const normalizeStr = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filteredOptions = !searchTerm
    ? options
    : options.filter(opt => 
        normalizeStr(opt.label).includes(normalizeStr(searchTerm)) ||
        normalizeStr(opt.value).includes(normalizeStr(searchTerm))
      );

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all ${
            error ? 'border-red-500' : 'border-gray-border'
          } ${inputClassName}`}
          value={searchTerm}
          onChange={(e) => {
            let val = e.target.value;
            if (preventNumbers) {
              val = val.replace(/[0-9]/g, "");
            }
            setSearchTerm(val);
            setIsOpen(true);
            onChange(val);
          }}
          onFocus={(e) => {
            setIsOpen(true);
            e.target.select();
          }}
          placeholder={placeholder}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          {isOpen ? <Search size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {isOpen && (
        <div className={`absolute z-[100] w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-fade-in custom-scrollbar ${direction === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-accent/5 ${
                  value === opt.value ? 'bg-accent/10 text-accent font-bold' : 'text-gray-700'
                }`}
                onClick={() => {
                  let val = opt.value;
                  if (preventNumbers) {
                    val = val.replace(/[0-9]/g, "");
                  }
                  onChange(val);
                  setSearchTerm(opt.label.replace(/[0-9]/g, ""));
                  setIsOpen(false);
                }}
              >
                {opt.label}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500 italic">
              No se encontraron resultados
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options?: { value: string; label: string }[];
  error?: string;
}

export function Select({ options, error, className = '', children, value, ...props }: SelectProps) {
  return (
    <select
      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 ${
        error ? 'border-red-500' : 'border-gray-border'
      } ${className}`}
      value={value ?? ''}
      {...props}
    >
      {Array.isArray(options) ? options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      )) : children}
    </select>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ className = '', value, ...props }: TextareaProps) {
  return (
    <textarea
      className={`w-full px-3 py-2 border border-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 ${className}`}
      value={value ?? ''}
      {...props}
    />
  );
}