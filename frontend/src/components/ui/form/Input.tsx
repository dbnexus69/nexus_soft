import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export function Input({ className = "", error, onBlur, ...props }: InputProps) {
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if ((props.type === "date" || props.type === "datetime-local") && props.min && value) {
      const minDate = new Date(props.min);
      const inputDate = new Date(value);

      if (!isNaN(minDate.getTime()) && !isNaN(inputDate.getTime())) {
        if (inputDate < minDate) {
          e.target.value = String(props.min);
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

  return (
    <input
      className={`w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
        error ? "border-red-500" : "border-slate-300 dark:border-slate-600"
      } ${className}`}
      onBlur={handleBlur}
      {...props}
    />
  );
}
