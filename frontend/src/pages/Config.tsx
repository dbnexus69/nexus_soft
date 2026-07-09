import { useState, useEffect } from 'react';
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
  Info
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { FormField, Input, Select } from '../components/ui/Form';
import { Table, TableRow, TableCell } from '../components/ui/Table';
import { useConfigContext } from '../context/ConfigContext';
import { usePermissions } from '../context/PermissionsContext';
import { ConfigData } from '../hooks/useConfig';
import ConfigForms from '../components/config/ConfigForms';

import { updateConfigItem, createConfigItem as addConfigItem, deleteConfigItem } from '../api/config';
import { formatCurrency, formatMealPlan } from '../utils/formatters';
import LoadingScreen from '../components/ui/LoadingScreen';

type ConfigSection = 'cards' | 'paymentMethods' | 'documentTypes' | 'airlines' | 'suppliers' | 'airports' | 'baggage' | 'packages';

const SECTIONS = [
  { id: 'cards', label: 'Tarjetas', desc: 'Bancos y tarjetas de crédito/débito', icon: <CreditCard size={18} /> },
  { id: 'paymentMethods', label: 'Formas de Pago', desc: 'Métodos de cobro del sistema', icon: <Coins size={18} /> },
  { id: 'documentTypes', label: 'Tipos de Documento', desc: 'Documentos de identidad base', icon: <IdCard size={18} /> },
  { id: 'airlines', label: 'Aerolíneas', desc: 'Líneas aéreas autorizadas', icon: <PlaneTakeoff size={18} /> },
  { id: 'suppliers', label: 'Proveedores', desc: 'Hoteles, operadores y aerolíneas', icon: <Building2 size={18} /> },
  { id: 'airports', label: 'Aeropuertos', desc: 'Aeropuertos y ubicaciones base', icon: <Compass size={18} /> },
  { id: 'baggage', label: 'Equipaje', desc: 'Políticas y pesos de equipaje', icon: <Luggage size={18} /> },
  { id: 'packages', label: 'Paquetes', desc: 'Catálogo de paquetes turísticos', icon: <Boxes size={18} /> }
] as const;

type SectionId = typeof SECTIONS[number]['id'];

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
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Lazy Load Fetch
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const currentData = ((config[currentSection as keyof ConfigData] || []) as any[])
    .slice()
    .sort((a, b) => {
      const idA = a.id ?? a._id ?? 0;
      const idB = b.id ?? b._id ?? 0;
      const numA = Number(idA);
      const numB = Number(idB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numB - numA;
      }
      return String(idB).localeCompare(String(idA));
    });

  // Dynamic filter based on search input
  const filteredData = currentData.filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    switch (currentSection) {
      case 'cards':
        return (item.name || '').toLowerCase().includes(term) || 
               (item.paymentMethod || '').toLowerCase().includes(term) || 
               (item.lastFourDigits || '').includes(term) ||
               (item.description || '').toLowerCase().includes(term);
      case 'paymentMethods':
      case 'documentTypes':
        return (item.name || '').toLowerCase().includes(term);
      case 'airlines':
        return (item.name || '').toLowerCase().includes(term) || (item.code || '').toLowerCase().includes(term);
      case 'suppliers':
        return (item.name || '').toLowerCase().includes(term) || 
               (item.type || '').toLowerCase().includes(term) || 
               (item.email || '').toLowerCase().includes(term) ||
               (item.phone || '').toLowerCase().includes(term);
      case 'airports':
        return (item.name || '').toLowerCase().includes(term) || (item.abbreviation || '').toLowerCase().includes(term) || (item.location || '').toLowerCase().includes(term);
      case 'baggage':
        return (item.airlineName || '').toLowerCase().includes(term);
      case 'packages':
        return (item.name || '').toLowerCase().includes(term) || (item.destination || '').toLowerCase().includes(term);
      default:
        return true;
    }
  });

  const getHeaders = (section: SectionId): string[] => {
    switch (section) {
      case 'cards': return ['#', 'Nombre', 'Método de Pago', 'Últimos 4 Dígitos', 'Estado', 'Descripción'];
      case 'paymentMethods': return ['#', 'Nombre'];
      case 'documentTypes': return ['#', 'Nombre'];
      case 'airlines': return ['#', 'Nombre', 'Código IATA', 'Cobertura', 'Sitio Web'];
      case 'suppliers': return ['#', 'Nombre', 'Tipo', 'Email', 'Teléfono', 'Sitio Web'];
      case 'airports': return ['#', 'Nombre', 'Abreviación', 'Ubicación', 'Cobertura', 'Estado'];
      case 'baggage': return ['#', 'Aerolínea', 'Tarifa', 'Art. Personal', 'Equip. Mano', 'Equip. Bodega'];
      case 'packages': return ['#', 'Nombre', 'Destino', 'Noches', 'Hotel', 'Tarifa Adulto'];
      default: return ['#', 'Nombre'];
    }
  };

  const getSingularLabel = (section: SectionId): string => {
    switch (section) {
      case 'cards': return 'Tarjeta';
      case 'paymentMethods': return 'Forma de Pago';
      case 'documentTypes': return 'Tipo de Documento';
      case 'airlines': return 'Aerolínea';
      case 'suppliers': return 'Proveedor';
      case 'airports': return 'Aeropuerto';
      case 'baggage': return 'Equipaje';
      case 'packages': return 'Paquete';
      default: return 'Elemento';
    }
  };

  const getRow = (item: any, section: SectionId): string[] => {
    const itemName = item.name || item.nombre || item.bank || item.nombre_plan || item.hotel_nombre || 'Sin Nombre';
    switch (section) {
      case 'cards': return [
        itemName, 
        item.paymentMethod || item.type || 'No especificado', 
        `•••• ${item.lastFourDigits || (item.id != null ? item.id.toString().padStart(4, '0') : '0000')}`, 
        item.status || 'Activo', 
        item.description || 'Sin descripción'
      ];
      case 'paymentMethods': return [itemName];
      case 'documentTypes': return [itemName];
      case 'airlines': return [itemName, item.code || item.codigoIata || item.codigo_iata || '-', item.type || 'Internacional', item.website || 'No especificado'];
      case 'suppliers': return [itemName, item.type || '-', item.email || '-', item.phone || '-', item.website || 'No especificado'];
      case 'airports': return [itemName, item.abbreviation || item.codigoIata || item.codigo_iata || '-', item.location || item.ciudad || '-', item.type || 'Ambos', item.status || 'Activo'];
      case 'baggage': return [item.airlineName || item.aerolinea || '-', item.fareType || item.tipoTarifa || '-', item.personalItem || 'No incluido', item.carryOn || 'No incluido', item.checkedBag || 'No incluido'];
      case 'packages': return [itemName, item.destination || item.destino || '-', item.nights?.toString() || '-', item.accommodation?.hotel || item.hotel || '-', formatCurrency(item.rates?.adult || item.tarifaAdulto || 0)];
      default: return [itemName];
    }
  };

  const handleOpenModal = (item?: any) => {
    setErrors({});
    if (item) {
      setEditingItem(item);
      setFormData({ ...item });
    } else {
      setEditingItem(null);
      setFormData(currentSection === 'cards' ? { status: 'Activo', paymentMethod: '' } : {});
    }
    setIsModalOpen(true);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (currentSection === 'cards') {
      if (!formData.name || String(formData.name).trim().length < 3) {
        newErrors.name = 'El nombre debe tener al menos 3 caracteres.';
      }
      if (!formData.paymentMethod) {
        newErrors.paymentMethod = 'Debe seleccionar un método de pago.';
      }
      const lastFourStr = String(formData.lastFourDigits || '');
      if (lastFourStr.length !== 4 || !/^\d{4}$/.test(lastFourStr)) {
        newErrors.lastFourDigits = 'Debe ingresar exactamente los últimos 4 dígitos numéricos.';
      }
      if (!formData.status) {
        newErrors.status = 'Debe seleccionar un estado.';
      }
    } else {
      switch (currentSection) {
        case 'paymentMethods':
        case 'documentTypes':
          if (!formData.name || formData.name.trim().length === 0) newErrors.name = 'El nombre es obligatorio.';
          break;
        case 'airlines':
          if (!formData.name || formData.name.trim().length === 0) newErrors.name = 'El nombre es obligatorio.';
          if (!formData.code || formData.code.trim().length === 0) newErrors.code = 'El código IATA es obligatorio.';
          if (!formData.type) newErrors.type = 'Debe seleccionar un tipo de cobertura.';
          if (!formData.website || !formData.website.startsWith('http')) newErrors.website = 'Debe ingresar un enlace válido (que inicie con http:// o https://).';
          break;
        case 'suppliers':
          if (!formData.name || formData.name.trim().length === 0) newErrors.name = 'El nombre es obligatorio.';
          if (!formData.type) newErrors.type = 'Debe seleccionar un tipo de proveedor.';
          if (formData.email && formData.email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Debe ingresar un correo electrónico válido.';
          if (formData.phone && formData.phone.trim().length > 0 && formData.phone.trim().length < 7) newErrors.phone = 'Debe ingresar un teléfono válido.';
          if (!formData.website || !formData.website.startsWith('http')) newErrors.website = 'Debe ingresar un enlace de sitio web válido (que inicie con http:// o https://).';
          break;
        case 'airports':
          if (!formData.name || formData.name.trim().length === 0) newErrors.name = 'El nombre del aeropuerto es obligatorio.';
          if (!formData.abbreviation || formData.abbreviation.trim().length === 0) newErrors.abbreviation = 'La abreviación IATA es obligatoria.';
          if (!formData.city || formData.city.trim().length === 0) newErrors.city = 'La ciudad es obligatoria.';
          if (!formData.country || formData.country.trim().length === 0) newErrors.country = 'El país es obligatorio.';
          if (!formData.type) newErrors.type = 'Debe seleccionar un tipo de cobertura.';
          if (!formData.status) newErrors.status = 'Debe seleccionar un estado.';
          break;
        case 'baggage':
          if (!formData.airlineName) newErrors.airlineName = 'Debe seleccionar una aerolínea.';
          if (!formData.fareType || formData.fareType.trim().length === 0) newErrors.fareType = 'La tarifa o cabina es obligatoria.';
          if (!formData.personalItem || formData.personalItem.trim().length === 0) newErrors.personalItem = 'La especificación de artículo personal es obligatoria.';
          if (!formData.carryOn || formData.carryOn.trim().length === 0) newErrors.carryOn = 'La especificación de equipaje de mano es obligatoria.';
          if (!formData.checkedBag || formData.checkedBag.trim().length === 0) newErrors.checkedBag = 'La especificación de equipaje de bodega es obligatoria.';
          break;
        case 'packages':
          if (!formData.name || formData.name.trim().length === 0) newErrors.name = 'El nombre del paquete es obligatorio.';
          if (!formData.destination || formData.destination.trim().length === 0) newErrors.destination = 'El destino es obligatorio.';
          if (!formData.nights || formData.nights <= 0) newErrors.nights = 'Debe ingresar un número válido de noches.';
          break;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      alert("Por favor corrige los errores del formulario antes de guardar.");
      return;
    }
    
    setIsSaving(true);
    try {
      if (editingItem) {
        await updateConfigItem(currentSection as ConfigSection, editingItem.id, formData);
      } else {
        await addConfigItem(currentSection as ConfigSection, formData);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      alert("Error al guardar: " + (err?.response?.data?.message || err.message || "Error desconocido"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    setDeleteItemId(id);
  };

  const confirmDelete = async () => {
    if (deleteItemId !== null) {
      setIsDeleting(true);
      try {
        await deleteConfigItem(currentSection as ConfigSection, deleteItemId);
        setDeleteItemId(null);
      } catch (err: any) {
        console.error(err);
        alert("Error al eliminar: " + (err?.response?.data?.message || err.message || "Error desconocido"));
      } finally {
        setIsDeleting(false);
      }
    }
  };





  const stats = [
    { label: 'Proveedores Activos', count: config.suppliers?.length || 0, icon: <Building2 className="text-primary" size={18} /> },
    { label: 'Aeropuertos Base', count: config.airports?.length || 0, icon: <Compass className="text-accent" size={18} /> },
    { label: 'Aerolíneas de Viaje', count: config.airlines?.length || 0, icon: <PlaneTakeoff className="text-success" size={18} /> },
    { label: 'Formas de Pago', count: config.paymentMethods?.length || 0, icon: <Coins className="text-warning" size={18} /> },
  ];

  if (loading && (!config.suppliers || config.suppliers.length === 0)) {
    return <LoadingScreen fullScreen={false} />;
  }

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Header */}
      <div className="flex flex-col items-center justify-center gap-4 mb-6 text-center">
        <div className="flex flex-col items-center justify-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary flex items-center justify-center gap-3">
            <Database className="text-accent w-8 h-8" /> Gestión Interna
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Administración central de tablas maestras, catálogos base y parámetros para la facturación.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-border w-fit mx-auto mb-6 max-w-full overflow-x-auto flex-nowrap scrollbar-none">
        {SECTIONS.map(section => {
          const isActive = currentSection === section.id;
          const count = (config[section.id as keyof ConfigData] as any[])?.length || 0;
          return (
            <button
              key={section.id}
              onClick={() => {
                setCurrentSection(section.id);
                setSearchTerm('');
              }}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {section.icon}
              <span className="hidden sm:inline">{section.label}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      <Card className="animate-fade-in">
        <CardHeader actions={
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-wrap w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input 
                placeholder={`Buscar en ${SECTIONS.find(s => s.id === currentSection)?.label}...`}
                className="pl-10 pr-9 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button onClick={() => handleOpenModal()} className="w-full sm:w-auto justify-center">
              <Plus size={18} />
              Nuevo {SECTIONS.find(s => s.id === currentSection)?.label}
            </Button>
          </div>
        }>
          Catálogo de {SECTIONS.find(s => s.id === currentSection)?.label}
        </CardHeader>
        
        <CardBody>
          {filteredData.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">No se encontraron registros en este catálogo.</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <Table headers={getHeaders(currentSection)}>
                {filteredData.map((item: any) => {
                  const isOptimistic = isOptimisticId(item);
                  return (
                    <TableRow key={item.id}>
                            <TableCell className="font-semibold text-gray-700">
                              {item.id}
                            </TableCell>
                            {getRow(item, currentSection).map((val, i) => (
                              <TableCell key={i}>{val}</TableCell>
                            ))}
                            <TableCell>
                              <div className="flex gap-2">
                                {currentSection === 'packages' && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => setViewingPackage(item)} 
                                    title="Ver Detalle"
                                    disabled={isOptimistic}
                                  >
                                    <Eye size={13} />
                                  </Button>
                                )}
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleOpenModal(item)}
                                  disabled={isOptimistic}
                                >
                                  <Pencil size={13} />
                                </Button>
                                <Button 
                                  variant="danger" 
                                  size="sm" 
                                  onClick={() => handleDelete(item.id)}
                                  disabled={isOptimistic}
                                >
                                  <Trash2 size={13} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </Table>
                  </div>
              )}
            </CardBody>
          </Card>
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? `Editar ${getSingularLabel(currentSection)}` : `Nuevo ${getSingularLabel(currentSection)}`}
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
            Esta acción es irreversible. Se eliminará de forma permanente el elemento con ID <strong className="text-gray-700 font-mono">#{deleteItemId}</strong> del catálogo de <strong className="text-primary">{SECTIONS.find(s => s.id === currentSection)?.label}</strong>.
          </p>
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