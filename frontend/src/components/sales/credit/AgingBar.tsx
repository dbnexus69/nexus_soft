import { memo } from 'react';
import { formatCurrency } from '../../../utils/formatters';
import { SegmentedBar } from '../../ui/SegmentedBar';
import { TRAMOS, TRAMO, type Aging } from './aging';

interface AgingBarProps {
  aging: Aging;
  grosor?: 'fina' | 'gruesa';
  className?: string;
}

/**
 * La forma de la deuda de un cliente, en una sola barra.
 *
 * Es el único elemento con fuerza visual de la pantalla de cartera, y lleva
 * información: los segmentos son proporcionales al dinero de cada tramo, así
 * que la silueta dice de un vistazo si la deuda es reciente, antigua o está sin
 * fechar. Por eso la fila no repite las seis columnas de importes: las cifras
 * exactas de cada tramo viven una sola vez, en el resumen de la cabecera.
 */
export const AgingBar = memo(function AgingBar({
  aging,
  grosor = 'fina',
  className = '',
}: AgingBarProps) {
  return (
    <SegmentedBar
      grosor={grosor}
      className={className}
      titulo="Antigüedad de la deuda"
      segmentos={TRAMOS.map(t => ({
        clave: t,
        valor: aging[t] || 0,
        color: TRAMO[t].barra,
        etiqueta: `${TRAMO[t].largo}: ${formatCurrency(aging[t] || 0)}`,
      }))}
    />
  );
});
