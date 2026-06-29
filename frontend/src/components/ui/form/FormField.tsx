import React, { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

export interface FormFieldProps {
  label: ReactNode;
  children: ReactNode;
  error?: string;
  className?: string;
  required?: boolean;
}

export function FormField({ label, children, error, className = "", required = false }: FormFieldProps) {
  const hasMb = className.split(" ").some((c) => c.startsWith("mb-"));
  return (
    <div className={`${hasMb ? "" : "mb-4"} ${className}`}>
      <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${error ? "text-red-500" : "text-slate-700 dark:text-slate-300"}`}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle size={13} />
          {error}
        </p>
      )}
    </div>
  );
}
