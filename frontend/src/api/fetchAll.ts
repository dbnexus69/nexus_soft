/**
 * fetchAll.ts
 *
 * Trae una colección COMPLETA recorriendo sus páginas.
 *
 * El problema que resuelve: pedir `perPage: 100` y quedarse con lo que venga
 * corta la lista en silencio. Con 150 clientes se cargan 100 y los otros 50
 * no existen para la aplicación — nadie se entera hasta que alguien pregunta
 * por qué no aparece un cliente. Y el backend topa perPage en 100, así que
 * subir el número tampoco sirve.
 *
 * Esto pide página tras página hasta agotar `meta.total`, así que el resultado
 * está completo con 50 registros o con 5.000.
 *
 * Cuándo usarlo: solo donde de verdad hace falta la lista entera en memoria
 * (resolver un nombre, alimentar un cálculo). Si es para que el usuario elija
 * algo, el patrón correcto es AsyncCombobox, que busca en el servidor.
 */

const PER_PAGE = 100;

/** Tope de seguridad: evita que un error de paginación pida páginas sin fin. */
const MAX_PAGINAS = 100;

interface RespuestaPaginada<T> {
  data?: T[];
  meta?: { total?: number; totalPages?: number; hasNext?: boolean };
}

type Listador<T> = (params: Record<string, unknown>) => Promise<RespuestaPaginada<T>>;

export interface ResultadoCompleto<T> {
  data: T[];
  total: number;
  /** true si se alcanzó MAX_PAGINAS y la lista puede estar incompleta. */
  truncado: boolean;
}

export async function fetchAllPages<T>(
  listar: Listador<T>,
  params: Record<string, unknown> = {},
): Promise<ResultadoCompleto<T>> {
  const primera = await listar({ ...params, page: 1, perPage: PER_PAGE });
  const acumulado: T[] = primera.data ? [...primera.data] : [];
  const total = primera.meta?.total ?? acumulado.length;
  const totalPaginas = primera.meta?.totalPages ?? 1;

  if (totalPaginas <= 1) {
    return { data: acumulado, total, truncado: false };
  }

  const ultima = Math.min(totalPaginas, MAX_PAGINAS);

  // Las páginas restantes son independientes: se piden a la vez.
  const resto = await Promise.all(
    Array.from({ length: ultima - 1 }, (_, i) =>
      listar({ ...params, page: i + 2, perPage: PER_PAGE }),
    ),
  );
  for (const r of resto) {
    if (r.data) acumulado.push(...r.data);
  }

  const truncado = totalPaginas > MAX_PAGINAS;
  if (truncado && import.meta.env.DEV) {
    console.warn(
      `[fetchAllPages] La colección tiene ${total} registros (${totalPaginas} páginas) ` +
      `y se cortó en ${MAX_PAGINAS}. Esta lista no debería cargarse entera: ` +
      `usa búsqueda en servidor o una consulta agregada.`,
    );
  }

  return { data: acumulado, total, truncado };
}
