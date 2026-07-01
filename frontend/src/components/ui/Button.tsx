import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-2xl transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed font-body hover:scale-[1.01] active:scale-[0.99]';
    
    const variants = {
      primary: 'bg-gradient-to-r from-primary to-accent hover:from-primary-dark hover:to-accent-dark text-white shadow-md hover:shadow-lg shadow-primary/10 hover:shadow-primary/20 focus:ring-4 focus:ring-primary/15',
      secondary: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80 focus:ring-4 focus:ring-slate-200/50',
      danger: 'bg-rose-500 hover:bg-rose-600 text-white shadow-md hover:shadow-lg shadow-rose-500/10 focus:ring-4 focus:ring-rose-500/15',
      success: 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md hover:shadow-lg shadow-emerald-500/10 focus:ring-4 focus:ring-emerald-500/15',
      outline: 'border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-[#131524]/40 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 focus:ring-4 focus:ring-slate-100/50'
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4.5 py-2 text-sm',
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