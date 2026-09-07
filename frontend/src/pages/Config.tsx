import { useState, useEffect, useRef, useCallback } from 'react';
import { SKELETON } from '../components/ui/Skeleton';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Settings, 
  ListTree, 
  Database, 
  Boxes, 
  CreditCard, 
  Coins, 
  IdCard, 
  PlaneTakeoff, 
  Building2, 
  MapPin, 
  Luggage, 
  Search, 
  Grid, 
  List,
  Compass,
  Eye,
  ShieldCheck,
  Info, X } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { FormField, Input, Select } from '../components/ui/Form';
import { Table, TableRow, TableCell } from '../components/ui/Table';
import { useConfigContext } from '../context/ConfigContext';
import { usePermissions } from '../context/PermissionsContext';
import { ConfigData } from '../hooks/useConfig';
import ConfigForms from '../components/config/ConfigForms';

import { getConfigSection, updateConfigItem, createConfigItem as addConfigItem, deleteConfigItem } from '../api/config';
import { formatCurrency, formatMealPlan } from '../utils/formatters';
import { Pagination } from "../components/ui/Pagination";

type ConfigSection = 'cards' | 'paymentMethods' | 'documentTypes' | 'airlines' | 'suppliers' | 'airports' | 'baggage' | 'packages';

import SortIcon from '../components/ui/SortIcon';
import { CatalogDetailModal } from '../components/config/CatalogDetailModal';
import { CATALOGOS, CATALOGO_POR_ID, N_COLUMNAS } from '../components/config/catalogos';

/**
 * Los catálogos, su rótulo, su singular y sus columnas viven en
 * `components/config/catalogos.tsx`. Antes estaban repartidos en cuatro listas
 * paralelas aquí mismo —`SECTIONS`, `getHeaders`, `getRow`, `getSingularLabel`—
 * y el desajuste entre dos de ellas es lo que hacía que ninguna de las ocho
 * tablas cuadrara: la cabecera no declaraba la columna de acciones.
 */
type SectionId = string;

const isOptimisticId = (item: any): boolean => {
  if (item === undefined || item === null) return false;
  return item._isOptimistic === true;
};

export default function Config() {
  const { config, loading, addConfigItem: addContextItem, updateConfigItem: updateContextItem, deleteConfigItem: deleteContextItem, fetchConfig } = useConfigContext();
  const [currentSection, setCurrentSection] = useState<SectionId>('cards');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);
  const [viewingPackage, setViewingPackage] = useState<any>(null);
  const [viendoItem, setViendoItem] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [avisoBorrado, setAvisoBorrado] = useState<string | null>(null);
  const [paginatedData, setPaginatedData] = useState<any[]>([]);
  const [paginationMeta, setPaginationMeta] = useState<any>(null);
  const [isSectionLoading, setIsSectionLoading] = useState(false);

  const def = CATALOGO_POR_ID[currentSection];

  // Orden: sin elegir manda el del servidor, que cada catálogo declara.
  const [orden, setOrden] = useState<{ por: string | null; sentido: 'asc' | 'desc' }>(
    { por: null, sentido: 'asc' },
  );
  const [page, setPage] = useState(1);
  const peticion = useRef(0);

  useEffect(() => { setPage(1); }, [currentSection, searchTerm, orden]);

  // Al cambiar de catálogo se vacían las filas.
  //
  // Sin esto el esqueleto no aparecía nunca al cambiar de pestaña: la condición
  // es `cargando && filas.length === 0` y las filas seguían siendo las del
  // catálogo anterior. Y no era solo que faltara el efecto — esas filas se
  // pintaban un instante con las columnas del catálogo NUEVO, así que se veían
  // aeropuertos bajo las cabeceras de aerolíneas, con las celdas vacías.
  //
  // La búsqueda y el orden NO vacían: ahí conservar las filas mientras se
  // teclea evita un parpadeo en cada letra, y las columnas son las mismas.
  useEffect(() => {
    setPaginatedData([]);
    setPaginationMeta(null);
  }, [currentSection]);

  // Antes había además `currentData` y `filteredData`: un orden por id y una
  // CUARTA copia de las reglas de búsqueda, esta en el navegador, sobre el
  // catálogo completo que trae `/config/all`. Eran código muerto —
  // `isPaginatedSection` era siempre verdadero porque su lista contenía las
  // ocho secciones— y ahora buscar, ordenar y paginar lo hace el servidor.
  const cargarSeccion = useCallback(async () => {
    const mia = ++peticion.current;
    setIsSectionLoading(true);
    try {
      const res = await getConfigSection(currentSection, {
        page, perPage: 12,
        search: searchTerm.trim() || undefined,
        sortBy: orden.por || undefined,
        sortOrder: orden.por ? orden.sentido : undefined,
      });
      if (mia !== peticion.current) return;
      setPaginatedData(res?.data || []);
      setPaginationMeta(res?.meta || null);
    } catch (err) {
      if (mia === peticion.current) { console.error(err); setPaginatedData([]); }
    } finally {
      if (mia === peticion.current) setIsSectionLoading(false);
    }
  }, [currentSection, page, searchTerm, orden]);

  useEffect(() => {
    const t = setTimeout(cargarSeccion, searchTerm ? 300 : 0);
    return () => clearTimeout(t);
  }, [cargarSeccion, searchTerm]);

  // Primer clic: ascendente. Segundo: descendente. Tercero: vuelta al orden
  // por defecto del catálogo, para poder deshacer sin recargar.
  const ordenarPor = useCallback((clave: string) => {
    setOrden(actual => {
      if (actual.por !== clave) return { por: clave, sentido: 'asc' };
      if (actual.sentido === 'asc') return { por: clave, sentido: 'desc' };
      return { por: null, sentido: 'asc' };
    });
  }, []);

  const handleOpenModal = (item?: any) => {
    setErrors({});
    setAvisoGuardado(null);
    if (item) {
      setEditingItem(item);
      setFormData({ ...item });
    } else {
      setEditingItem(null);
      setFormData(currentSection === 'cards' ? { status: 'Activo', paymentMethod: '' } : {});
    }
    setIsModalOpen(true);
  };

  /**
   * Los errores del servidor, puestos en su campo.
   *
   * Antes había aquí un `validate()` de 65 líneas con un switch por sección:
   * una quinta copia de las reglas, y con condiciones MÁS estrictas que la
   * base —exigía web en las aerolíneas y los tres pesos del equipaje, todos
   * nullable— así que el formulario prohibía lo que la base permite. Ahora las
   * reglas viven en `schemas/config.schema.js`, una sola vez, y el 422 trae
   * `details: [{field, message}]` para pintarlas junto a su input.
   *
   * Antes tampoco llegaban: se leía `err.response.data.message` cuando la API
   * devuelve `error.message`, así que el aviso siempre decía "Error
   * desconocido" y el motivo real no se veía nunca.
   */
  const mostrarErrorDelServidor = (err: any, porDefecto: string): string => {
    const payload = err?.response?.data?.error;
    if (Array.isArray(payload?.details) && payload.details.length > 0) {
      setErrors(Object.fromEntries(payload.details.map((d: any) => [d.field, d.message])));
      return payload.details.map((d: any) => d.message).join('. ');
    }
    return payload?.message || err?.message || porDefecto;
  };

  const [avisoGuardado, setAvisoGuardado] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsSaving(true);
    setErrors({});
    setAvisoGuardado(null);
    try {
      if (editingItem) {
        const updated = await updateConfigItem(currentSection as ConfigSection, editingItem.id, formData);
        setPaginatedData(prev => prev.map(item => item.id === editingItem.id ? updated : item));
      } else {
        await addConfigItem(currentSection as ConfigSection, formData);
      }
      
      // Al crear se vuelve a la primera página, que es donde el orden por
      // defecto del catálogo pone lo nuevo.
      if (!editingItem) { setPage(1); cargarSeccion(); }
      fetchConfig();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setAvisoGuardado(mostrarErrorDelServidor(err, "No se pudo guardar."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    setAvisoBorrado(null);
    setDeleteItemId(id);
  };

  const confirmDelete = async () => {
    if (deleteItemId !== null) {
      setIsDeleting(true);
      try {
        await deleteConfigItem(currentSection as ConfigSection, deleteItemId);
        cargarSeccion();
        fetchConfig();
        setDeleteItemId(null);
      } catch (err: any) {
        console.error(err);
        setAvisoBorrado(mostrarErrorDelServidor(err, "No se pudo eliminar."));
      } finally {
        setIsDeleting(false);
      }
    }
  };





  // Sin retorno temprano: la tabla y la vista de fichas traen su esqueleto.

  return (
    <div className="animate-fade-in space-y-5">
      {/* La cabecera estaba centrada, con un icono de 32px y un subtítulo de
          dos líneas. Un título de página centrado gasta alto vertical y no
          orienta; alineado a la izquierda, con el catálogo activo al lado, sí. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="font-heading text-2xl font-semibold text-primary dark:text-white">
          Gestión interna
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{def.desc}</p>
      </div>

      {/* Los ocho catálogos. Se retira el contador de cada pestaña: salía de
          `config[seccion].length`, que es el catálogo cacheado de /config/all,
          y como `packages` no viaja en esa carga su contador era siempre 0.
          El número real de registros lo dice el paginador, una sola vez. */}
      {/* Pestañas subrayadas, no pastillas.
          La pastilla activa era `bg-slate-900` en claro y `bg-white` en oscuro:
          un bloque blanco puro sobre un fondo casi negro (#111216), que no
          pertenece a esta paleta y deslumbra. Y las inactivas dependían de
          `slate-800`, casi el mismo tono que la tarjeta, así que en oscuro
          apenas se distinguían del fondo.
          El subrayado usa `--color-highlight`, que el tema ya define en las dos
          variantes (#0F7B8A claro, #3FB8C7 oscuro), así que se lee igual de bien
          en ambos sin un caso especial. Además distingue navegación de filtro:
          las pastillas se usan para filtrar, en la cartera. */}
      <nav
        className="-mx-1 flex gap-1 overflow-x-auto border-b border-gray-border px-1"
        aria-label="Catálogos"
      >
        {CATALOGOS.map(c => {
          const activo = currentSection === c.id;
          return (
            <button
              key={c.id}
              onClick={() => { setCurrentSection(c.id); setSearchTerm(''); }}
              aria-current={activo ? 'page' : undefined}
              className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-highlight/40 ${
                activo
                  ? 'border-highlight text-highlight'
                  : 'border-transparent text-accent hover:border-gray-border hover:text-primary dark:hover:text-white'
              }`}
            >
              {c.etiqueta}
            </button>
          );
        })}
      </nav>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} aria-hidden />
            <input
              placeholder={`Buscar en ${def.etiqueta.toLowerCase()}`}
              className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-9 pr-8 text-sm text-slate-700 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {/* La vista de fichas no tiene cabeceras que pulsar, así que el orden
              va en un control propio. Sin él no se podría ordenar por id, que
              es como se ven los últimos registros creados. */}
          {def.vista === 'fichas' && (
            <div className="flex gap-1 text-xs">
              {([
                { por: 'name', etiqueta: 'A–Z', sentido: 'asc' as const },
                { por: 'id', etiqueta: 'Recientes', sentido: 'desc' as const },
              ]).map(o => {
                const activo = orden.por === o.por;
                return (
                  <button
                    key={o.por}
                    onClick={() => setOrden({ por: o.por, sentido: o.sentido })}
                    aria-pressed={activo}
                    className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                      activo
                        ? 'bg-highlight text-white'
                        : 'text-accent hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {o.etiqueta}
                  </button>
                );
              })}
            </div>
          )}

          {/* Decía "Nuevo Aerolíneas": el rótulo era el plural. Cada catálogo
              declara su singular. */}
          <Button size="sm" onClick={() => handleOpenModal()}>
            <Plus size={15} aria-hidden />
            Nuevo {def.singular.toLowerCase()}
          </Button>
        </div>

        {def.vista === 'fichas' ? (
          <div className="p-4">
            {isSectionLoading && paginatedData.length === 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 6 }, (_, i) => (
                  <div
                    key={i}
                    className={`${SKELETON} h-16 rounded-xl`}
                  />
                ))}
              </div>
            ) : paginatedData.length === 0 ? (
              <div className="py-10 text-center">
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  {searchTerm.trim()
                    ? `Nada coincide con "${searchTerm.trim()}"`
                    : `Aún no hay ${def.etiqueta.toLowerCase()}`}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {searchTerm.trim()
                    ? 'Prueba con otro término.'
                    : `Crea la primera con "Nuevo ${def.singular.toLowerCase()}".`}
                </p>
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {paginatedData.map((item: any) => (
                  <li
                    key={item.id}
                    className={`group flex items-start justify-between gap-2 rounded-xl border border-gray-border px-3 py-2.5 transition-colors hover:border-highlight/60 ${
                      isOptimisticId(item) ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900 dark:text-white">
                        {item.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
                          #{item.id}
                        </span>
                        {def.fichaApoyo?.(item)}
                      </div>
                    </div>
                    {/* Las acciones aparecen al pasar por encima o al enfocar
                        con el teclado: con seis fichas, dieciocho botones
                        siempre visibles pesan más que las propias fichas. */}
                    <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => setViendoItem(item)}
                        title="Ver detalle"
                        aria-label={`Ver el detalle de ${item.name}`}
                        disabled={isOptimisticId(item)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-white"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenModal(item)}
                        title="Editar"
                        aria-label={`Editar ${item.name}`}
                        disabled={isOptimisticId(item)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-white"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        title="Eliminar"
                        aria-label={`Eliminar ${item.name}`}
                        disabled={isOptimisticId(item)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {def.columnas.map(col => {
                  const activa = orden.por === col.orden;
                  return (
                    <th
                      key={col.clave}
                      scope="col"
                      aria-sort={activa ? (orden.sentido === 'asc' ? 'ascending' : 'descending') : undefined}
                      className={`px-3 py-2 ${col.derecha ? 'text-right' : 'text-left'}`}
                    >
                      {col.orden ? (
                        <button
                          type="button"
                          onClick={() => ordenarPor(col.orden!)}
                          className={`inline-flex items-center gap-1 rounded font-medium hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 dark:hover:text-slate-200 ${
                            col.derecha ? 'flex-row-reverse' : ''
                          } ${activa ? 'text-slate-800 dark:text-slate-200' : ''}`}
                        >
                          {col.rotulo}
                          <SortIcon field={col.orden} currentSort={orden.por || ''} sortOrder={orden.sentido} />
                        </button>
                      ) : (
                        col.rotulo
                      )}
                    </th>
                  );
                })}
                {/* La columna que faltaba en las ocho cabeceras. */}
                <th scope="col" className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isSectionLoading && paginatedData.length === 0 ? (
                // Filas fantasma en vez de sustituir la tabla por una pantalla
                // de carga: así la cabecera no desaparece y el alto no salta.
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="border-t border-slate-200 dark:border-slate-800">
                    <td colSpan={N_COLUMNAS(def)} className="px-3 py-3">
                      <div className={`${SKELETON} h-6`} />
                    </td>
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                <tr className="border-t border-slate-200 dark:border-slate-800">
                  <td colSpan={N_COLUMNAS(def)} className="px-4 py-14 text-center">
                    {/* Buscar sin resultados y un catálogo vacío no son lo
                        mismo, y antes los dos decían "Catálogo Vacío". */}
                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                      {searchTerm.trim()
                        ? `Nada coincide con "${searchTerm.trim()}"`
                        : `Aún no hay ${def.etiqueta.toLowerCase()}`}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {searchTerm.trim()
                        ? 'Prueba con otro término.'
                        : `Crea el primer registro con "Nuevo ${def.singular.toLowerCase()}".`}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item: any) => (
                  <tr
                    key={item.id}
                    className={`border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40 ${
                      isOptimisticId(item) ? 'opacity-50' : ''
                    }`}
                  >
                    {def.columnas.map(col => (
                      <td
                        key={col.clave}
                        className={`px-3 py-2.5 ${col.derecha ? 'text-right' : ''} ${
                          col.clave === 'name' || col.clave === 'airlineName' ? '' : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {col.render(item)}
                      </td>
                    ))}
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        {(def.detalle || def.conDetalle) && (
                          <button
                            type="button"
                            onClick={() => (def.conDetalle ? setViewingPackage(item) : setViendoItem(item))}
                            title="Ver detalle"
                            aria-label={`Ver el detalle de ${item.name}`}
                            disabled={isOptimisticId(item)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-white"
                          >
                            <Eye size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenModal(item)}
                          title="Editar"
                          aria-label={`Editar ${item.name || item.airlineName}`}
                          disabled={isOptimisticId(item)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-white"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          title="Eliminar"
                          aria-label={`Eliminar ${item.name || item.airlineName}`}
                          disabled={isOptimisticId(item)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}

        {/* Con `total` y `perPage`: sin ellos el paginador no podía decir
            cuántos registros hay, y se ocultaba del todo con una sola página. */}
        <Pagination
          currentPage={paginationMeta?.page || 1}
          totalPages={paginationMeta?.totalPages || 0}
          total={paginationMeta?.total || 0}
          perPage={12}
          loading={isSectionLoading}
          onPageChange={setPage}
          className="border-t border-slate-200 px-4 py-3 dark:border-slate-800"
        />
      </div>

      <CatalogDetailModal
        def={def}
        item={viendoItem}
        onClose={() => setViendoItem(null)}
        onEditar={handleOpenModal}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? `Editar ${def.singular.toLowerCase()}` : `Nuevo ${def.singular.toLowerCase()}`}
        size={currentSection === 'packages' ? 'xl' : 'lg'}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {avisoGuardado && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              {avisoGuardado}
            </p>
          )}
          <ConfigForms 
            section={currentSection} 
            formData={formData} 
            setFormData={setFormData} 
            errors={errors} 
            setErrors={setErrors} 
            data={{ config }} 
          />
        </div>
      </Modal>

      {/* Premium Custom Delete Confirmation Modal */}
      <Modal
        isOpen={deleteItemId !== null}
        onClose={() => setDeleteItemId(null)}
        title="Confirmar Eliminación"
        footer={
          <div className="flex gap-2 w-full justify-end">
            <Button variant="outline" onClick={() => setDeleteItemId(null)} disabled={isDeleting}>
              No, cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
              {isDeleting ? 'Eliminando...' : 'Sí, eliminar registro'}
            </Button>
          </div>
        }
      >
        <div className="text-center p-4">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <Trash2 size={28} />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">
            ¿Estás absolutamente seguro?
          </h3>
          <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
            Esta acción es irreversible. Se eliminará de forma permanente el elemento con ID <strong className="text-gray-700 font-mono">#{deleteItemId}</strong> del catálogo de <strong className="text-primary">{def.etiqueta.toLowerCase()}</strong>.
          </p>
          {avisoBorrado && (
            <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              {avisoBorrado}
            </p>
          )}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left flex items-start gap-3">
            <span className="text-amber-600 text-lg">⚠️</span>
            <p className="text-xs text-amber-700 leading-relaxed font-semibold">
              Nota: Asegúrate de que este elemento no esté siendo referenciado por tiquetes o ventas activas del sistema.
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={viewingPackage !== null}
        onClose={() => setViewingPackage(null)}
        title={`Detalle del Paquete: ${viewingPackage?.name}`}
        size="xl"
      >
        {viewingPackage && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Main Info */}
              <div className="md:col-span-2 space-y-6">
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <h4 className="text-sm font-bold text-primary mb-4 flex items-center gap-2">
                    <Info size={16} className="text-accent" /> Información General
                  </h4>
                  <div className="grid grid-cols-2 gap-y-4">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Destino</p>
                      <p className="text-sm font-semibold text-gray-700">{viewingPackage.destination}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Duración</p>
                      <p className="text-sm font-semibold text-gray-700">{viewingPackage.nights} Noches</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                    <h4 className="text-sm font-bold text-blue-700 mb-4 flex items-center gap-2">
                      <PlaneTakeoff size={16} /> Vuelo
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] text-blue-400 uppercase font-bold">Aerolínea / Ruta</p>
                        <p className="text-xs font-semibold text-blue-800">{viewingPackage.flight?.airline || '-'} | {viewingPackage.flight?.route || '-'}</p>
                      </div>
                      <div className="flex justify-between">
                        <div>
                          <p className="text-[10px] text-blue-400 uppercase font-bold">Cabina</p>
                          <p className="text-xs font-semibold text-blue-800">{viewingPackage.flight?.cabinBaggage || '-'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-blue-400 uppercase font-bold">Bodega</p>
                          <p className="text-xs font-semibold text-blue-800">{viewingPackage.flight?.checkedBaggage || '-'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100">
                    <h4 className="text-sm font-bold text-emerald-700 mb-4 flex items-center gap-2">
                      <Building2 size={16} /> Alojamiento
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] text-emerald-400 uppercase font-bold">Hotel / Tipo</p>
                        <p className="text-xs font-semibold text-emerald-800">{viewingPackage.accommodation?.hotel || '-'} | {viewingPackage.accommodation?.hotelType || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-emerald-400 uppercase font-bold">Régimen</p>
                        <p className="text-xs font-semibold text-emerald-800">{formatMealPlan(viewingPackage.accommodation?.mealPlan)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 space-y-4">
                  <div>
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Servicios Incluidos</h4>
                    <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{viewingPackage.includedServices || 'No especificado'}</p>
                  </div>
                  <div className="pt-4 border-t border-gray-50">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">No Incluye</h4>
                    <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{viewingPackage.notIncluded || 'No especificado'}</p>
                  </div>
                </div>
              </div>

              {/* Sidebar Info (Rates & Assistance) */}
              <div className="space-y-4">
                <div className="bg-purple-600 p-5 rounded-2xl text-white shadow-lg shadow-purple-200">
                  <h4 className="text-xs font-bold uppercase tracking-widest mb-4 opacity-80">Tarifas del Paquete</h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-end border-b border-white/20 pb-2">
                      <span className="text-xs font-medium">Tarifa Adulto</span>
                      <span className="text-xl font-bold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(viewingPackage.rates?.adult || 0)}</span>
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-medium">Tarifa Menor</span>
                      <span className="text-lg font-bold opacity-90">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(viewingPackage.rates?.child || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100">
                  <h4 className="text-xs font-bold text-amber-700 mb-3 uppercase flex items-center gap-2">
                    <ShieldCheck size={14} /> Asistencia Médica
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[10px] text-amber-600 font-bold uppercase">Monto</span>
                      <span className="text-xs font-bold text-amber-900">{viewingPackage.medicalAssistance?.amountUsd ? `${viewingPackage.medicalAssistance.amountUsd} USD` : '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-amber-600 font-bold uppercase">Cobertura</span>
                      <span className="text-xs font-bold text-amber-900">{viewingPackage.medicalAssistance?.coverageDays ? `${viewingPackage.medicalAssistance.coverageDays} Días` : '-'}</span>
                    </div>
                  </div>
                </div>

                <Button 
                  className="w-full mt-4" 
                  onClick={() => {
                    setViewingPackage(null);
                    handleOpenModal(viewingPackage);
                  }}
                >
                  <Pencil size={14} /> Editar Paquete
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}