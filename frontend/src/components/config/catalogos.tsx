import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

/**
 * Los ocho catálogos de Gestión Interna, cada uno con sus columnas.
 *
 * Una sola definición sustituye a cuatro listas paralelas que había que
 * mantener a mano: `SECTIONS` (rótulo y descripción), `getHeaders`, `getRow` y
 * `getSingularLabel`, más el mapa camelCase→kebab de `api/config.ts`. Añadir un
 * catálogo obligaba a acordarse de los cinco sitios, y ese desajuste es
 * exactamente lo que había pasado: **ninguna de las ocho tablas cuadraba**,
 * porque `getHeaders` no declaraba la columna de acciones y el cuerpo sí la
 * pintaba, así que toda tabla tenía una columna sin cabecera.
 *
 * Ahora cabecera y celdas salen de la misma lista: no pueden descuadrar.
 */

export interface ColumnaCatalogo {
  clave: string;
  rotulo: string;
  /** Clave de `?sortBy=`. Sin ella la columna no se ordena. */
  orden?: string;
  derecha?: boolean;
  render: (item: any) => ReactNode;
}

export interface DefinicionCatalogo {
  /** Clave del frontend, la que usa `data.config`. */
  id: string;
  /** Sección de la API. Era un mapa aparte en `api/config.ts`. */
  seccion: string;
  etiqueta: string;
  singular: string;
  desc: string;
  columnas: ColumnaCatalogo[];
  /** Los paquetes tienen una vista de detalle propia. */
  conDetalle?: boolean;
}

// ── Celdas ──────────────────────────────────────────────────────────────────
//
// Antes cada celda era un `string`: el tipo de `getRow` era `string[]`, así que
// no se podía enlazar una web, marcar un estado ni alinear un código. De ahí
// venían los rellenos de texto ('No especificado', 'No incluido', '-') que se
// repetían columna abajo diciendo nada.

/** Un hueco vacío se ve mejor que la palabra "No especificado" repetida. */
const Vacio = () => <span className="text-slate-300 dark:text-slate-600">—</span>;

const texto = (v: unknown): ReactNode =>
  v === null || v === undefined || v === '' ? <Vacio /> : String(v);

/** Códigos IATA y similares: en cifras tabulares, que es como se comparan. */
const Codigo = ({ valor }: { valor?: string | null }) =>
  valor ? (
    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs tabular-nums tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200">
      {valor}
    </span>
  ) : (
    <Vacio />
  );

const Estado = ({ valor }: { valor?: string | null }) => {
  const activo = valor !== 'Inactivo';
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
        activo ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${activo ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
        aria-hidden
      />
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  );
};

/** La web es para abrirla, no para leer la cadena entera. */
const Enlace = ({ url }: { url?: string | null }) => {
  if (!url) return <Vacio />;
  const limpia = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const href = /^https?:\/\//.test(url) ? url : `https://${url}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-primary hover:underline dark:text-accent"
    >
      <span className="truncate">{limpia}</span>
      <ExternalLink size={11} className="shrink-0" aria-hidden />
    </a>
  );
};

/**
 * Nombre del registro con su id debajo, en pequeño.
 *
 * El diseño anterior daba a un id autoincremental la primera columna de la
 * tabla, que es el sitio más visible. El id no dice nada del registro: se
 * mantiene porque sirve para hablar de una fila, pero de apoyo, como el
 * documento del cliente en la cartera.
 */
const Nombre = ({ item }: { item: any }) => (
  <div className="min-w-0">
    <div className="truncate font-semibold text-slate-900 dark:text-white">
      {item.name || <Vacio />}
    </div>
    <div className="text-xs tabular-nums text-slate-400 dark:text-slate-500">#{item.id}</div>
  </div>
);

const COL_NOMBRE: ColumnaCatalogo = {
  clave: 'name', rotulo: 'Nombre', orden: 'name',
  render: item => <Nombre item={item} />,
};

// ── Los ocho catálogos ──────────────────────────────────────────────────────

export const CATALOGOS: DefinicionCatalogo[] = [
  {
    id: 'cards', seccion: 'cards',
    etiqueta: 'Tarjetas', singular: 'Tarjeta',
    desc: 'Tarjetas de crédito y débito de la agencia',
    columnas: [
      COL_NOMBRE,
      { clave: 'paymentMethod', rotulo: 'Forma de pago', render: i => texto(i.paymentMethod) },
      {
        clave: 'lastFourDigits', rotulo: 'Terminación',
        render: i => (i.lastFourDigits
          ? <span className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">•••• {i.lastFourDigits}</span>
          : <Vacio />),
      },
      { clave: 'status', rotulo: 'Estado', orden: 'status', render: i => <Estado valor={i.status} /> },
      {
        clave: 'description', rotulo: 'Descripción',
        render: i => (i.description
          ? <span className="block max-w-[18rem] truncate text-slate-600 dark:text-slate-300">{i.description}</span>
          : <Vacio />),
      },
    ],
  },
  {
    id: 'paymentMethods', seccion: 'payment-methods',
    etiqueta: 'Formas de pago', singular: 'Forma de pago',
    desc: 'Cómo se cobra y se paga en el sistema',
    columnas: [COL_NOMBRE],
  },
  {
    id: 'documentTypes', seccion: 'document-types',
    etiqueta: 'Tipos de documento', singular: 'Tipo de documento',
    desc: 'Documentos de identidad admitidos',
    columnas: [
      COL_NOMBRE,
      // La abreviatura NO se mostraba: la cabecera solo tenía '#' y 'Nombre'
      // aunque es un campo obligatorio y único, y es lo que se elige en los
      // formularios de cliente.
      { clave: 'abbreviation', rotulo: 'Abreviatura', orden: 'abbreviation', render: i => <Codigo valor={i.abbreviation} /> },
    ],
  },
  {
    id: 'airlines', seccion: 'airlines',
    etiqueta: 'Aerolíneas', singular: 'Aerolínea',
    desc: 'Líneas aéreas del catálogo de vuelos',
    columnas: [
      COL_NOMBRE,
      { clave: 'code', rotulo: 'IATA', orden: 'code', render: i => <Codigo valor={i.code} /> },
      { clave: 'type', rotulo: 'Cobertura', orden: 'type', render: i => texto(i.type) },
      { clave: 'website', rotulo: 'Sitio web', render: i => <Enlace url={i.website} /> },
    ],
  },
  {
    id: 'suppliers', seccion: 'suppliers',
    etiqueta: 'Proveedores', singular: 'Proveedor',
    desc: 'Hoteles, operadores y mayoristas',
    columnas: [
      COL_NOMBRE,
      { clave: 'type', rotulo: 'Tipo', orden: 'type', render: i => texto(i.type) },
      {
        clave: 'email', rotulo: 'Contacto',
        render: i => (i.email || i.phone ? (
          <div className="min-w-0 text-xs">
            {i.email && <div className="truncate text-slate-600 dark:text-slate-300">{i.email}</div>}
            {i.phone && <div className="tabular-nums text-slate-400 dark:text-slate-500">{i.phone}</div>}
          </div>
        ) : <Vacio />),
      },
      { clave: 'website', rotulo: 'Sitio web', render: i => <Enlace url={i.website} /> },
    ],
  },
  {
    id: 'airports', seccion: 'airports',
    etiqueta: 'Aeropuertos', singular: 'Aeropuerto',
    desc: 'Aeropuertos y sus ciudades',
    columnas: [
      COL_NOMBRE,
      { clave: 'abbreviation', rotulo: 'IATA', orden: 'abbreviation', render: i => <Codigo valor={i.abbreviation} /> },
      { clave: 'location', rotulo: 'Ubicación', orden: 'city', render: i => texto(i.location || i.city) },
      { clave: 'type', rotulo: 'Cobertura', orden: 'type', render: i => texto(i.type) },
      { clave: 'status', rotulo: 'Estado', orden: 'status', render: i => <Estado valor={i.status} /> },
    ],
  },
  {
    id: 'baggage', seccion: 'baggage',
    etiqueta: 'Equipaje', singular: 'Política de equipaje',
    desc: 'Qué se puede llevar con cada tarifa',
    columnas: [
      {
        clave: 'airlineName', rotulo: 'Aerolínea', orden: 'airlineName',
        render: i => (
          <div className="min-w-0">
            <div className="truncate font-semibold text-slate-900 dark:text-white">
              {i.airlineName || <Vacio />}
            </div>
            <div className="text-xs tabular-nums text-slate-400 dark:text-slate-500">#{i.id}</div>
          </div>
        ),
      },
      { clave: 'fareType', rotulo: 'Tarifa', orden: 'fareType', render: i => texto(i.fareType) },
      { clave: 'personalItem', rotulo: 'Art. personal', render: i => texto(i.personalItem) },
      { clave: 'carryOn', rotulo: 'Equipaje de mano', render: i => texto(i.carryOn) },
      { clave: 'checkedBag', rotulo: 'Equipaje en bodega', render: i => texto(i.checkedBag) },
    ],
  },
  {
    id: 'packages', seccion: 'packages',
    etiqueta: 'Paquetes', singular: 'Paquete',
    desc: 'Paquetes turísticos armados',
    conDetalle: true,
    columnas: [
      COL_NOMBRE,
      { clave: 'destination', rotulo: 'Destino', orden: 'destination', render: i => texto(i.destination) },
      {
        clave: 'nights', rotulo: 'Noches', derecha: true,
        render: i => (i.nights ? <span className="tabular-nums">{i.nights}</span> : <Vacio />),
      },
      // Se retira la columna "Hotel": el listado no trae ese campo —el
      // `listTransform` del backend solo devuelve nombre, destino, noches y
      // tarifas— así que la columna mostraba un guion en TODAS las filas. El
      // hotel está en el detalle del paquete, que es de donde se puede leer.
      {
        clave: 'rates', rotulo: 'Tarifa adulto', derecha: true,
        render: i => (i.rates?.adult
          ? <span className="tabular-nums">{formatCurrency(i.rates.adult)}</span>
          : <Vacio />),
      },
    ],
  },
];

export const CATALOGO_POR_ID: Record<string, DefinicionCatalogo> =
  Object.fromEntries(CATALOGOS.map(c => [c.id, c]));

/** Columnas + la de acciones. La cabecera y el cuerpo usan esta misma cuenta. */
export const N_COLUMNAS = (def: DefinicionCatalogo) => def.columnas.length + 1;
