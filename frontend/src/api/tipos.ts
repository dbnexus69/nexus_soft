// La forma de las respuestas de la API (backend/src/utils/apiResponse.js), para tipar los envoltorios.

export interface Paginacion {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** Una colección paginada: `{ success, data, meta }`. `Extra` son los campos que algunas pantallas añaden a `meta`. */
export interface Pagina<T, Extra = unknown> {
  success: boolean;
  data: T[];
  meta: Paginacion & Extra;
}

/** Un solo recurso: `{ success, data }`. */
export interface Recurso<T> {
  success: boolean;
  data: T;
}
