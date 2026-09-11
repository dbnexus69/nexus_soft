import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

/**
 * La superficie sobre la que va todo. 25 usos en la aplicación.
 *
 * **Opaca y sin desenfoque, a propósito.** Era `bg-white/95` con
 * `backdrop-blur-md`: una tarjeta translúcida con filtro de fondo. Eso hacía dos
 * cosas, las dos malas para algo que solo tiene que sostener contenido:
 *
 * - El 5 % de transparencia dejaba pasar el fondo de la página, así que el
 *   blanco no era blanco y el contraste del texto bajaba un poco en cada
 *   tarjeta.
 * - `backdrop-filter` no solo difumina: crea un contexto de apilamiento y un
 *   bloque contenedor. Todo lo que se despliega DENTRO de una tarjeta —los
 *   desplegables, los menús— queda compuesto ahí dentro, y ahí es donde salía
 *   el aspecto borroso.
 *
 * Una tarjeta es papel, no cristal. El desenfoque tiene sentido en lo que
 * flota por encima del contenido —la cabecera fija, el velo de una ventana— y
 * ahí se conserva.
 *
 * El blanco va como valor literal y no como `bg-white` por un motivo concreto:
 * `index.css` reescribe `.dark .bg-white` con `!important`, así que usar la
 * clase normal cambiaría también el color de las tarjetas en modo oscuro. El
 * problema era el modo claro; el oscuro se queda exactamente como estaba.
 */
export function Card({ children, className = '' }: CardProps) {
  const hasBackground = /\bbg-/.test(className);
  return (
    <div className={`card ${hasBackground ? '' : 'bg-[#ffffff] dark:bg-[#131524]'} rounded-2xl border border-slate-200/60 dark:border-slate-800/85 shadow-sm transition-all duration-300 ${className}`}>
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