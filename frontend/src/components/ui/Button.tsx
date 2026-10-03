import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', children, ...props }, ref) => {
    // El foco se ve con un anillo sólido de 2 px separado del botón, y solo al llegar con el teclado
    // (`focus-visible`). Antes era un halo de 4 px al 15 % de opacidad —o gris claro al 50 %— que casi no
    // se distinguía del fondo: la guía pide al menos 2 px con contraste 3:1.
    const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-2xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary dark:focus-visible:ring-highlight dark:focus-visible:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed font-body hover:scale-[1.01] active:scale-[0.99]';
    
    const variants = {
      primary: 'bg-gradient-to-r from-primary to-accent hover:from-primary-dark hover:to-accent-dark text-white shadow-md hover:shadow-lg shadow-primary/10 hover:shadow-primary/20',
      secondary: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80',
      danger: 'bg-rose-500 hover:bg-rose-600 text-white shadow-md hover:shadow-lg shadow-rose-500/10',
      success: 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md hover:shadow-lg shadow-emerald-500/10',
      // El botón de contorno iba con el fondo al 40 %, que sobre una tarjeta
      // blanca es un blanco lechoso: ni transparente ni sólido. Un botón de
      // contorno no tiene fondo propio —esa es su definición— y así se apoya
      // limpio sobre cualquier superficie.
      outline: 'border border-slate-200 dark:border-slate-800 bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80'
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-5 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
      icon: 'h-10 w-10 p-0 text-sm'
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';