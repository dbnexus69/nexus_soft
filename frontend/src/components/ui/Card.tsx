import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  const hasBackground = /\bbg-/.test(className);
  return (
    <div className={`card ${hasBackground ? '' : 'bg-white'} rounded-lg border border-gray-border shadow-sm ${className}`}>
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
    <div className={`card-header flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border-b border-gray-border ${className}`}>
      <div className="flex-1 text-base md:text-lg font-bold">{children}</div>
      {actions}
    </div>
  );
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card-body p-4 ${className}`}>{children}</div>;
}