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
import { useData } from '../context/DataContext';
import { ConfigData } from '../types';
import ConfigForms from '../components/config/ConfigForms';
import ConfigGrids from '../components/config/ConfigGrids';
import { formatCurrency } from '../utils/formatters';

type ConfigSection = 'cards' | 'paymentMethods' | 'documentTypes' | 'airlines' | 'suppliers' | 'airports' | 'baggage' | 'packages';

const SECTIONS = [
  { id: 'cards', label: 'Tarjetas', desc: 'Bancos y tarjetas de crédito/débito', icon: <CreditCard size={18} /> },
  { id: 'paymentMethods', label: 'Formas de Pago', desc: 'Métodos de cobro del sistema', icon: <Coins size={18} /> },
  { id: 'documentTypes', label: 'Tipos de Documento', desc: 'Documentos de identidad base', icon: <IdCard size={18} /> },
  { id: 'airlines', label: 'Aerolíneas', desc: 'Líneas aéreas autorizadas', icon: <PlaneTakeoff size={18} /> },
  { id: 'suppliers', label: 'Mayoristas', desc: 'Hoteles, operadores y aerolíneas', icon: <Building2 size={18} /> },
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
  const { data, addConfigItem, updateConfigItem, deleteConfigItem, fetchConfig } = useData();
  const [currentSection, setCurrentSection] = useState<SectionId>('cards');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [formData, setFormData] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);
  const [viewingPackage, setViewingPackage] = useState<any>(null);

  // Lazy Load Fetch
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const currentData = ((data.config[currentSection as keyof ConfigData] || []) as any[])
    .slice()
    .sort((a, b) => Number(b.id) - Number(a.id));

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

  const getRow = (item: any, section: SectionId): string[] => {
    switch (section) {
      case 'cards': return [
        item.name || item.bank || 'Tarjeta Sin Nombre', 
        item.paymentMethod || item.type || 'No especificado', 
        `•••• ${item.lastFourDigits || item.id?.toString().padStart(4, '0')}`, 
        item.status || 'Activo', 
        item.description || 'Sin descripción'
      ];
      case 'paymentMethods': return [item.name];
      case 'documentTypes': return [item.name];
      case 'airlines': return [item.name, item.code, item.type || 'Internacional', item.website || 'No especificado'];
      case 'suppliers': return [item.name, item.type, item.email, item.phone, item.website || 'No especificado'];
      case 'airports': return [item.name, item.abbreviation, item.location, item.type || 'Ambos', item.status || 'Activo'];
      case 'baggage': return [item.airlineName, item.fareType, item.personalItem || 'No incluido', item.carryOn || 'No incluido', item.checkedBag || 'No incluido'];
      case 'packages': return [item.name, item.destination, item.nights?.toString(), item.accommodation?.hotel || '-', formatCurrency(item.rates?.adult || 0)];
      default: return [item.name];
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
      if (!formData.name || formData.name.trim().length < 3) {
        newErrors.name = 'El nombre debe tener al menos 3 caracteres.';
      }
      if (!formData.paymentMethod) {
        newErrors.paymentMethod = 'Debe seleccionar un método de pago.';
      }
      if (!formData.lastFourDigits || formData.lastFourDigits.length !== 4 || !/^\d{4}$/.test(formData.lastFourDigits)) {
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
          if (!formData.type) newErrors.type = 'Debe seleccionar un tipo de mayorista.';
          if (!formData.email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email)) newErrors.email = 'Debe ingresar un correo electrónico válido.';
          if (!formData.phone || formData.phone.trim().length < 7) newErrors.phone = 'Debe ingresar un teléfono válido.';
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

  const handleSubmit = () => {
    if (!validate()) return;
    
    if (editingItem) {
      updateConfigItem(currentSection as ConfigSection, editingItem.id, formData);
    } else {
      addConfigItem(currentSection as ConfigSection, formData);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: number) => {
    setDeleteItemId(id);
  };

  const confirmDelete = () => {
    if (deleteItemId !== null) {
      deleteConfigItem(currentSection as ConfigSection, deleteItemId);
      setDeleteItemId(null);
    }
  };





  // Static statistics based on actual active config lengths
  const stats = [
    { label: 'Mayoristas Activos', count: data.config.suppliers?.length || 0, icon: <Building2 className="text-primary" size={18} /> },
    { label: 'Aeropuertos Base', count: data.config.airports?.length || 0, icon: <Compass className="text-accent" size={18} /> },
    { label: 'Aerolíneas de Viaje', count: data.config.airlines?.length || 0, icon: <PlaneTakeoff className="text-success" size={18} /> },
    { label: 'Formas de Pago', count: data.config.paymentMethods?.length || 0, icon: <Coins className="text-warning" size={18} /> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Dynamic Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
            <Database className="text-accent w-8 h-8" /> Gestión Interna
          </h1>
          <p className="text-gray-500 text-xs mt-1">
            Administración central de tablas maestras, catálogos base y parámetros para la facturación.
          </p>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white border border-gray-border p-4 rounded-xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                {stat.icon}
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{stat.label}</p>
                <p className="text-lg font-bold text-gray-800">{stat.count}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left internal Sidebar: catalog selection */}
        <div className="lg:col-span-1 space-y-2">
          <div className="bg-white border border-gray-border rounded-xl p-3 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2 lg:mb-3 hidden lg:block">Módulos Catálogos</p>
            <div className="flex flex-row overflow-x-auto lg:flex-col gap-1.5 lg:gap-0 lg:space-y-1 pb-1 lg:pb-0 scrollbar-none">
              {SECTIONS.map(section => {
                const isActive = currentSection === section.id;
                const count = (data.config[section.id as keyof ConfigData] as any[])?.length || 0;
                return (
                  <button
                    key={section.id}
                    onClick={() => {
                      setCurrentSection(section.id);
                      setSearchTerm('');
                    }}
                    className={`shrink-0 lg:w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-primary text-white shadow-md shadow-primary/10'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={isActive ? 'text-accent' : 'text-gray-400'}>
                        {section.icon}
                      </div>
                      <div className="text-left min-w-0">
                        <span className="block truncate">{section.label}</span>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Panel: Active Catalog view */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader actions={
              <div className="flex flex-wrap items-center gap-3">
                {/* Search Bar */}
                <div className="relative w-full sm:w-44">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Filtrar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 w-full rounded-lg border border-gray-border text-xs focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                  />
                </div>

                {/* Grid/List View switcher */}
                <div className="flex items-center border border-gray-border rounded-lg p-0.5 bg-gray-50">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1 rounded ${viewMode === 'grid' ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    title="Vista de Cuadrículas"
                  >
                    <Grid size={13} />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-1 rounded ${viewMode === 'table' ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    title="Vista de Tabla"
                  >
                    <List size={13} />
                  </button>
                </div>
                {/* Add new button */}
                <Button onClick={() => handleOpenModal()} size="sm">
                  <Plus size={14} />
                  Agregar Nuevo
                </Button>
              </div>
            }>
              <div className="flex items-center gap-2">
                <span className="text-primary font-heading font-bold text-base">
                  {SECTIONS.find(s => s.id === currentSection)?.label}
                </span>
                <span className="text-[11px] font-normal text-gray-400 hidden sm:inline">
                  — {SECTIONS.find(s => s.id === currentSection)?.desc}
                </span>
              </div>
            </CardHeader>
            
            <CardBody>
              {filteredData.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-xs">No se encontraron registros en este catálogo.</p>
                </div>
              ) : (
                viewMode === 'grid' ? (
                  <ConfigGrids 
                    section={currentSection} 
                    filteredData={filteredData} 
                    handleOpenModal={handleOpenModal} 
                    handleDelete={handleDelete} 
                    setViewingPackage={setViewingPackage}
                  />
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
                )
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Editar Registro' : 'Registrar Elemento'}
        size={currentSection === 'packages' ? 'xl' : 'lg'}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>Guardar Cambios</Button>
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
            data={data} 
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
            <Button variant="outline" onClick={() => setDeleteItemId(null)}>
              No, cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
              Sí, eliminar registro
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
                        <p className="text-xs font-semibold text-emerald-800">{viewingPackage.accommodation?.mealPlan || '-'}</p>
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