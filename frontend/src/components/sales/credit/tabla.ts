/**
 * Columnas de la tabla de cartera. Vive aparte porque el número de columnas lo
 * necesitan las dos partes: la cabecera que las pinta y la fila desplegable con
 * su `colSpan`. Estaba escrito a mano como `colSpan={6}` en tres sitios, y
 * añadir una columna dejaba el desplegable y el estado vacío desalineados.
 */
export interface ColumnaCartera {
  clave: string;
  rotulo: string;
  /** Clave que entiende `?sortBy=`. Sin ella la columna no se ordena. */
  orden?: string;
  derecha?: boolean;
}

export const COLUMNAS: ColumnaCartera[] = [
  { clave: 'cliente', rotulo: 'Cliente', orden: 'client' },
  { clave: 'creditos', rotulo: 'Créditos', orden: 'credits', derecha: true },
  { clave: 'vencido', rotulo: 'Vencido', orden: 'overdue', derecha: true },
  { clave: 'pendiente', rotulo: 'Pendiente', orden: 'pending', derecha: true },
  { clave: 'mora', rotulo: 'Mora', orden: 'days' },
  // La barra de antigüedad no es una magnitud: no se ordena por ella.
  { clave: 'antiguedad', rotulo: 'Antigüedad' },
];

export const N_COLUMNAS = COLUMNAS.length;

/** Sentido natural de cada columna: los nombres suben, el dinero baja. */
export const SENTIDO_NATURAL: Record<string, 'asc' | 'desc'> = {
  client: 'asc', credits: 'desc', overdue: 'desc', pending: 'desc', days: 'desc',
};
