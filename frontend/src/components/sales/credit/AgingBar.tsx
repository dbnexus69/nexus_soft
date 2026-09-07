import { memo } from 'react';
import { formatCurrency } from '../../../utils/formatters';
import { TRAMOS, TRAMO, type Aging } from './aging';

interface AgingBarProps {
  aging: Aging;
  /** Alto de la barra. `fina` para dentro de una fila, `gruesa` para el resumen. */
  grosor?: 'fina' | 'gruesa';
  className?: string;
}

/**
 * La forma de la deuda de un cliente, en una sola barra.
 *
 * Es el único elemento con fuerza visual de la pantalla, y lleva información:
 * los segmentos son proporcionales al dinero de cada tramo, así que la silueta
 * dice de un vistazo si la deuda es reciente, antigua o está sin fechar. Por
 * eso la fila no repite las seis columnas de importes: las cifras exactas de
 * cada tramo viven una sola vez, en el resumen de la cabecera.
 *
 * Un segmento con dinero nunca baja de 3px: sin ese mínimo, 50.000 sobre
 * 14.520.000 desaparecía y la barra mentía por omisión.
 */
export const AgingBar = memo(function AgingBar({
  aging,
  grosor = 'fina',
  className = '',
}: AgingBarProps) {
  const total = TRAMOS.reduce((suma, t) => suma + (aging[t] || 0), 0);
  const conDinero = TRAMOS.filter(t => (aging[t] || 0) > 0);

  const alto = grosor === 'gruesa' ? 'h-2.5' : 'h-1.5';

  if (total <= 0 || conDinero.length === 0) {
    return <div className={`${alto} rounded-full bg-slate-100 dark:bg-slate-800 ${className}`} />;
  }

  const descripcion = conDinero
    .map(t => `${TRAMO[t].largo}: ${formatCurrency(aging[t])}`)
    .join('. ');

  return (
    <div
      className={`${alto} flex gap-px overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 ${className}`}
      role="img"
      aria-label={`Antigüedad de la deuda. ${descripcion}`}
      title={descripcion}
    >
      {conDinero.map(t => (
        <div
          key={t}
          className={TRAMO[t].barra}
          style={{ width: `${(aging[t] / total) * 100}%`, minWidth: 3 }}
        />
      ))}
    </div>
  );
});
