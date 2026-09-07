import { memo } from 'react';

export interface Segmento {
  clave: string;
  valor: number;
  /** Clases de fondo del segmento, con su variante oscura. */
  color: string;
  /** Frase completa para el tooltip y el lector de pantalla. */
  etiqueta: string;
}

interface SegmentedBarProps {
  segmentos: Segmento[];
  /** `fina` para dentro de una fila de tabla, `gruesa` para un resumen. */
  grosor?: 'fina' | 'gruesa';
  /** Se antepone a la descripción accesible. */
  titulo?: string;
  className?: string;
}

/**
 * Una barra dividida en partes proporcionales.
 *
 * La usan la antigüedad de la cartera y la composición del pendiente. Vive
 * aquí porque lo que hay que hacer bien es común a las dos y fácil de olvidar
 * en una segunda copia: un segmento con valor nunca baja de 3px —sin ese mínimo
 * 50.000 sobre 14.520.000 desaparece y la barra miente por omisión—, los
 * segmentos vacíos no se pintan, y el conjunto se anuncia como una sola imagen
 * con su desglose en texto.
 */
export const SegmentedBar = memo(function SegmentedBar({
  segmentos,
  grosor = 'fina',
  titulo,
  className = '',
}: SegmentedBarProps) {
  const conValor = segmentos.filter(s => s.valor > 0);
  const total = conValor.reduce((suma, s) => suma + s.valor, 0);
  const alto = grosor === 'gruesa' ? 'h-2.5' : 'h-1.5';
  const fondo = `${alto} rounded-full bg-slate-100 dark:bg-slate-800`;

  if (total <= 0) return <div className={`${fondo} ${className}`} />;

  const descripcion = conValor.map(s => s.etiqueta).join('. ');

  return (
    <div
      className={`${fondo} flex gap-px overflow-hidden ${className}`}
      role="img"
      aria-label={titulo ? `${titulo}. ${descripcion}` : descripcion}
      title={descripcion}
    >
      {conValor.map(s => (
        <div
          key={s.clave}
          className={s.color}
          style={{ width: `${(s.valor / total) * 100}%`, minWidth: 3 }}
        />
      ))}
    </div>
  );
});
