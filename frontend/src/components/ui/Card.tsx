import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  const hasBackground = /\bbg-/.test(className);
  return (
    <div className={`card ${hasBackground ? '' : 'bg-white/95 dark:bg-[#131524]/95 backdrop-blur-md'} rounded-2xl border border-slate-200/60 dark:border-slate-800/85 shadow-sm transition-all duration-300 ${className}`}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function CardHeader({ children, actions, className = '' }: CardHeaderProps) {
  return (
    <div className={`card-header flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 border-b border-slate-200/60 dark:border-slate-800/85 ${className}`}>
      <div className="flex-1 text-base md:text-lg font-bold font-heading text-slate-800 dark:text-white">{children}</div>
      {actions}
    </div>
  );
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card-body p-5 ${className}`}>{children}</div>;
}