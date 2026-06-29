import React from "react";

interface BadgeProps {
  variant: string;
  children: React.ReactNode;
  className?: string;
}

export const Badge = React.memo(function Badge({ variant, children, className = "" }: BadgeProps) {
  const variants: Record<string, string> = {
    pagado: "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400",
    abonado: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400",
    credito: "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-400",
    pendiente: "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-400",
    active: "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400",
    inactive: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400",
    danger: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400",
    anulado: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400",
    realizado: "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400",
    "pendiente-check": "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-400",
    accent: "bg-accent/20 text-accent dark:bg-accent/20 dark:text-teal-400",
  };

  return (
    <span
      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant?.toLowerCase()] || ""} ${className}`}
    >
      {children}
    </span>
  );
});
