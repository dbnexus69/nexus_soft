import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Eye, Pencil, UserCheck, UserX, Search, CheckCircle, ChevronLeft, ChevronRight, TrendingUp, Users as UsersIcon, X } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { FormField, Input, Select } from '../components/ui/Form';
import { Table, TableRow, TableCell } from '../components/ui/Table';
import StatCard from '../components/ui/StatCard';
import SortIcon from '../components/ui/SortIcon';
import ResponsableDetailModal from '../components/responsables/ResponsableDetailModal';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';
import { formatDate, capitalizeName, formatId, todayStr } from '../utils/formatters';
import { Responsable } from '../types';
import LoadingScreen from '../components/ui/LoadingScreen';

import AvatarPicker, { AVATARS } from '../components/ui/AvatarPicker';
import { DatePicker } from '../components/sales/forms/TicketForm';

export default function Responsables() {
  const { data, addResponsable, updateResponsable, deleteResponsable, fetchResponsables, fetchSales } = useData();
  const { user } = useAuth();
  const { permissions, canCreate, canEdit } = usePermissions();
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingResponsable, setEditingResponsable] = useState<Responsable | null>(null);
  const [selectedResponsable, setSelectedResponsable] = useState<Responsable | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<{ id: number; name: string; newStatus: string } | null>(null);
  const [toggledResponsableId, setToggledResponsableId] = useState<number | null>(null);
  const [toggleAction, setToggleAction] = useState<'activated' | 'deactivated' | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Responsable; direction: 'asc' | 'desc' }>({ key: 'id', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const triggerError = (msg: string) => {
    setErrorMessage(msg);
    setShowError(true);
    setTimeout(() => setShowError(false), 5000);
  };

  const validateField = (name: string, value: string) => {
    let errorMsg = '';
    switch (name) {
      case 'firstName':
        if (!value.trim()) errorMsg = 'El nombre es obligatorio';
        else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(value)) errorMsg = 'El nombre solo debe contener letras';
        else if (value.length > 40) errorMsg = 'El nombre no puede exceder 40 caracteres';
        break;
      case 'lastName':
        if (!value.trim()) errorMsg = 'El apellido es obligatorio';
        else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(value)) errorMsg = 'El apellido solo debe contener letras';
        else if (value.length > 40) errorMsg = 'El apellido no puede exceder 40 caracteres';
        break;
      case 'docType':
        if (!value) errorMsg = 'Seleccione un tipo de documento';
        break;
      case 'docNumber':
        if (!value.trim()) {
          errorMsg = 'El número de documento es obligatorio';
        } else {
          const typeUpper = formData.docType ? formData.docType.toUpperCase() : '';
          if (typeUpper === 'PASAPORTE' || typeUpper === 'PP' || typeUpper === 'PAS') {
            if (value.length < 9 || value.length > 12) {
              errorMsg = 'El pasaporte debe tener entre 9 y 12 caracteres';
            } else if (!/^[a-zA-Z0-9]+$/.test(value)) {
              errorMsg = 'El pasaporte solo debe contener caracteres alfanuméricos';
            }
          } else if (typeUpper === 'NIT' || typeUpper === 'RUT') {
            if (value.length !== 11) {
              errorMsg = 'El NIT/RUT debe tener exactamente 11 caracteres (9 dígitos + guion + 1 dígito)';
            } else if (!/^\d{9}-\d{1}$/.test(value)) {
              errorMsg = 'El NIT/RUT debe tener formato 9 dígitos - guion - 1 dígito de verificación (ej: 123456789-0)';
            }
          } else if (typeUpper === 'CC') {
            if (value.length < 8 || value.length > 10) {
              errorMsg = 'La cédula de ciudadanía debe tener entre 8 y 10 dígitos';
            } else if (!/^\d+$/.test(value)) {
              errorMsg = 'La cédula de ciudadanía solo debe contener números';
            }
          } else if (value.length > 15) {
            errorMsg = 'El documento no puede exceder 15 caracteres';
          }
        }
        
        if (!errorMsg) {
          const isDuplicateDoc = data.responsables.some(c => 
            c.docNumber === value && (!editingResponsable || c.id !== editingResponsable.id)
          );
          if (isDuplicateDoc) errorMsg = 'Este documento ya esta registrado';
        }
        break;
      case 'phone':
        if (!value.trim()) errorMsg = 'El teléfono es obligatorio';
        else if (!/^\d+$/.test(value)) errorMsg = 'El teléfono solo debe contener números';
        else if (value.length > 15) errorMsg = 'El teléfono no puede exceder 15 caracteres';
        break;
      case 'email':
        if (!value.trim()) errorMsg = 'El correo es obligatorio';
        else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) errorMsg = 'El correo no es válido';
        else if (value.length > 40) errorMsg = 'El correo no puede exceder 40 caracteres';
        break;
      case 'birthDate':
        if (!value) {
          errorMsg = 'La fecha de nacimiento es obligatoria';
        } else {
          const selectedDate = new Date(value);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selectedDate > today) {
            errorMsg = 'La fecha de nacimiento no puede ser superior a la fecha actual';
          }
        }
        break;
    }
    
    setErrors(prev => ({ ...prev, [name]: errorMsg }));
    if (errorMsg) {
      triggerError(errorMsg);
    }
  };

  // Lazy Load Fetch
  useEffect(() => {
    fetchResponsables().finally(() => setIsLoading(false));
    fetchSales().catch(() => {});
  }, [fetchResponsables, fetchSales]);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    docType: '',
    docNumber: '',
    phone: '',
    email: '',
    birthDate: '',
    status: 'active' as 'active' | 'inactive'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});



  const handleOpenModal = (responsable?: Responsable) => {
    if (responsable && !canEdit('responsables')) return;
    if (responsable) {
      setEditingResponsable(responsable);
      setFormData({
        firstName: responsable.firstName || '',
        lastName: responsable.lastName || '',
        docType: responsable.docType,
        docNumber: responsable.docNumber,
        phone: responsable.phone,
        email: responsable.email,
        birthDate: responsable.birthDate || '',
        status: responsable.status
      });
    } else {
      setEditingResponsable(null);
      setFormData({
        firstName: '',
        lastName: '',
        docType: '',
        docNumber: '',
        phone: '',
        email: '',
        birthDate: '',
        status: 'active'
      });
    }
    setErrors({});
    setIsModalOpen(true);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'El nombre es obligatorio';
    else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(formData.firstName)) newErrors.firstName = 'El nombre solo debe contener letras';
    else if (formData.firstName.length > 40) newErrors.firstName = 'El nombre no puede exceder 40 caracteres';
    
    if (!formData.lastName.trim()) newErrors.lastName = 'El apellido es obligatorio';
    else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(formData.lastName)) newErrors.lastName = 'El apellido solo debe contener letras';
    else if (formData.lastName.length > 40) newErrors.lastName = 'El apellido no puede exceder 40 caracteres';
    
    if (!formData.docType) {
      newErrors.docType = 'Seleccione un tipo de documento';
    }
    
    if (!formData.docNumber.trim()) {
      newErrors.docNumber = 'El número de documento es obligatorio';
    } else {
      const typeUpper = formData.docType ? formData.docType.toUpperCase() : '';
      if (typeUpper === 'PASAPORTE' || typeUpper === 'PP' || typeUpper === 'PAS') {
        if (formData.docNumber.length < 9 || formData.docNumber.length > 12) {
          newErrors.docNumber = 'El pasaporte debe tener entre 9 y 12 caracteres';
        } else if (!/^[a-zA-Z0-9]+$/.test(formData.docNumber)) {
          newErrors.docNumber = 'El pasaporte solo debe contener caracteres alfanuméricos';
        }
      } else if (typeUpper === 'NIT' || typeUpper === 'RUT') {
        if (formData.docNumber.length !== 11) {
          newErrors.docNumber = 'El NIT/RUT debe tener exactamente 11 caracteres (9 dígitos + guion + 1 dígito)';
        } else if (!/^\d{9}-\d{1}$/.test(formData.docNumber)) {
          newErrors.docNumber = 'El NIT/RUT debe tener formato 9 dígitos - guion - 1 dígito de verificación (ej: 123456789-0)';
        }
      } else if (typeUpper === 'CC') {
        if (formData.docNumber.length < 8 || formData.docNumber.length > 10) {
          newErrors.docNumber = 'La cédula de ciudadanía debe tener entre 8 y 10 dígitos';
        } else if (!/^\d+$/.test(formData.docNumber)) {
          newErrors.docNumber = 'La cédula de ciudadanía solo debe contener números';
        }
      } else if (formData.docNumber.length > 15) {
        newErrors.docNumber = 'El documento no puede exceder 15 caracteres';
      }
    }
    
    if (!formData.phone.trim()) newErrors.phone = 'El teléfono es obligatorio';
    else if (!/^\d+$/.test(formData.phone)) newErrors.phone = 'El teléfono solo debe contener números';
    else if (formData.phone.length > 15) newErrors.phone = 'El teléfono no puede exceder 15 caracteres';
    
    if (!formData.email.trim()) newErrors.email = 'El correo es obligatorio';
    else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email)) newErrors.email = 'El correo no es válido';
    else if (formData.email.length > 40) newErrors.email = 'El correo no puede exceder 40 caracteres';
    
    if (!formData.birthDate) newErrors.birthDate = 'La fecha de nacimiento es obligatoria';

    const isDuplicateDoc = data.responsables.some(c => 
      c.docNumber === formData.docNumber && (!editingResponsable || c.id !== editingResponsable.id)
    );
    if (isDuplicateDoc) newErrors.docNumber = 'Este documento ya esta registrado';
    
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0];
      triggerError(firstError);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);

    try {
      const responsableData = {
        ...formData,
        firstName: capitalizeName(formData.firstName),
        lastName: capitalizeName(formData.lastName),
        name: `${capitalizeName(formData.firstName)} ${capitalizeName(formData.lastName)}`.trim(),
      };

      if (editingResponsable) {
        await updateResponsable(editingResponsable.id, responsableData);
        setSuccessMessage('Responsablee actualizado exitosamente');
      } else {
        await addResponsable(responsableData);
        setSuccessMessage('Nuevo responsablee registrado correctamente');
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
      setShowSuccess(true);
      setIsModalOpen(false);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Error al guardar el responsablee';
      setErrorMessage(msg);
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = (responsable: Responsable) => {
    if (!canEdit('responsables')) return;
    setConfirmToggle({
      id: responsable.id,
      name: responsable.name,
      newStatus: responsable.status === 'active' ? 'inactive' : 'active'
    });
  };

  const handleConfirmToggle = async () => {
    if (!confirmToggle) return;
    setIsToggling(true);
    try {
      const { id, newStatus } = confirmToggle;
      // Actualizar el estado en lugar de eliminar
      const responsableData = data.responsables.find(r => r.id === id);
      if (!responsableData) throw new Error('Responsable no encontrado en el estado');
      
      const updateData = {
        firstName: responsableData.name.split(' ')[0],
        lastName: responsableData.name.split(' ').slice(1).join(' '),
        docType: responsableData.docType,
        docNumber: responsableData.docNumber,
        phone: responsableData.phone,
        email: responsableData.email,
        birthDate: responsableData.birthDate,
        status: newStatus
      };

      await updateResponsable(id, updateData);
      setSuccessMessage(`Responsable ${newStatus === 'active' ? 'activado' : 'desactivado'} exitosamente`);
      setShowSuccess(true);
      setToggledResponsableId(id);
      setToggleAction(newStatus === 'active' ? 'activated' : 'deactivated');
      setTimeout(() => { setShowSuccess(false); setToggledResponsableId(null); setToggleAction(null); }, 2500);
      setConfirmToggle(null);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Error al cambiar estado';
      setErrorMessage(msg);
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
      setConfirmToggle(null);
    } finally {
      setIsToggling(false);
    }
  };

  const handleCancelToggle = () => setConfirmToggle(null);

  const handleViewDetail = (responsable: Responsable) => {
    setSelectedResponsable(responsable);
    setIsDetailOpen(true);
  };

  const stats = useMemo(() => {
    const responsablesToCalc = data.responsables;

    const total = responsablesToCalc.length;
    const active = responsablesToCalc.filter(c => c.status === 'active').length;
    const inactive = total - active;
    const recent = responsablesToCalc.filter(c => {
      const regDate = new Date(c.creadoAt);
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return regDate >= monthAgo;
    }).length;

    return { total, active, inactive, recent };
  }, [data.responsables]);

  const requestSort = (key: keyof Responsable) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredResponsables = useMemo(() => {
    const responsablesToFilter = data.responsables;

    const filtered = responsablesToFilter.filter(responsable => {
      const matchesSearch =
        responsable.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        responsable.docNumber.includes(searchTerm) ||
        responsable.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || responsable.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      const aValue = a[sortConfig.key] || '';
      const bValue = b[sortConfig.key] || '';
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data.responsables, searchTerm, statusFilter, sortConfig]);

  const totalPages = Math.ceil(filteredResponsables.length / itemsPerPage);
  const paginatedResponsables = filteredResponsables.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const responsableSales = useMemo(() => {
    return selectedResponsable
      ? data.sales.filter(s => s.responsableId === selectedResponsable.id)
      : [];
  }, [selectedResponsable, data.sales]);

  const responsableFlights = useMemo(() => {
    return selectedResponsable
      ? data.flights.filter(f => f.passenger === selectedResponsable.name)
      : [];
  }, [selectedResponsable, data.flights]);

  if (isLoading && data.responsables.length === 0) {
    return <LoadingScreen fullScreen={false} />;
  }

  return (
    <div className="space-y-6 relative">
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-[200] flex justify-center">
          {[...Array(20)].map((_, i) => (
            <div 
              key={i} 
              className="animate-confetti absolute top-0 text-2xl"
              style={{ 
                left: `${Math.random() * 100}%`, 
                animationDelay: `${Math.random() * 2}s`,
                color: ['#FFD700', '#FF4500', '#00BFFF', '#32CD32', '#FF69B4'][Math.floor(Math.random() * 5)]
              }}
            >
              ★
            </div>
          ))}
        </div>
      )}

      {showSuccess && createPortal(
        <div className="fixed top-20 right-6 z-[200] bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 animate-slide-in-right">
          <div className={`rounded-full p-1 ${toggleAction === 'activated' ? 'bg-green-500 animate-pop-in' : toggleAction === 'deactivated' ? 'bg-orange-500' : 'bg-green-500'}`}>
            {toggleAction === 'activated' ? <UserCheck size={18} /> : toggleAction === 'deactivated' ? <UserX size={18} /> : <CheckCircle size={18} />}
          </div>
          <div>
            <p className="font-bold text-sm">{toggleAction === 'activated' ? 'Responsablee Activado' : toggleAction === 'deactivated' ? 'Responsablee Desactivado' : 'Operación Exitosa'}</p>
            <p className="text-xs opacity-90">{successMessage}</p>
          </div>
        </div>,
        document.body
      )}

      {showError && createPortal(
        <div className="fixed top-20 right-6 z-[200] bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 animate-slide-in-right">
          <div className="bg-red-500 text-white rounded-full p-1">
            <X size={18} />
          </div>
          <div>
            <p className="font-bold text-sm">Error</p>
            <p className="text-xs opacity-90">{errorMessage}</p>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmación de cambio de estado */}
      <Modal
        isOpen={!!confirmToggle}
        onClose={handleCancelToggle}
        title={confirmToggle?.newStatus === 'inactive' ? 'Desactivar Responsablee' : 'Activar Responsablee'}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={handleCancelToggle} disabled={isToggling}>Cancelar</Button>
            <Button 
              variant={confirmToggle?.newStatus === 'inactive' ? 'danger' : 'success'} 
              onClick={handleConfirmToggle}
              disabled={isToggling}
            >
              {isToggling ? 'Procesando...' : `Sí, ${confirmToggle?.newStatus === 'inactive' ? 'desactivar' : 'activar'}`}
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center text-center py-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
            confirmToggle?.newStatus === 'inactive' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
          }`}>
            {confirmToggle?.newStatus === 'inactive' ? <UserX size={32} /> : <UserCheck size={32} />}
          </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              ¿Estás seguro de {confirmToggle?.newStatus === 'active' ? 'activar' : 'desactivar'} a este responsable?
            </h3>
            <p className="text-gray-500 mb-6">
              El responsable <strong>{confirmToggle?.name}</strong> cambiará su estado a {confirmToggle?.newStatus === 'active' ? 'Activo' : 'Inactivo'}.
            </p>
        </div>
      </Modal>

      {/* Header de Sección */}
      <div className="mb-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
              <UsersIcon className="text-accent w-8 h-8" /> Gestión de Responsables
            </h1>
            <p className="text-gray-500 text-sm mt-1">Administra la base de datos de tus viajeros y su historial de compras.</p>
          </div>
        </div>
      </div>





      <Card className="animate-fade-in">
        <CardHeader actions={
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-wrap w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input 
                placeholder="Buscar por nombre, doc o correo..." 
                className="pl-10 pr-9 w-full"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded">
                  <X size={14} />
                </button>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="text-sm border border-gray-border rounded-lg px-3 py-2 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20 w-full sm:w-auto"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Solo Activos</option>
              <option value="inactive">Solo Inactivos</option>
            </select>
            {canCreate('responsables') && (
              <Button onClick={() => handleOpenModal()} className="w-full sm:w-auto justify-center">
                <Plus size={18} />
                Nuevo Responsable
              </Button>
            )}
          </div>
        }>
          Lista de Responsables
        </CardHeader>
        <Table 
          headers={[
            { key: 'id', label: '#' },
            { key: 'name', label: 'Responsable' },
            { key: 'docType', label: 'Tipo Doc' },
            { key: 'docNumber', label: 'Número Doc' },
            { key: 'phone', label: 'Teléfono' },
            { key: 'status', label: 'Estado' },
            { key: 'deudaTotal', label: 'Deuda Total' },
            { key: 'creadoAt', label: 'Registro' },
            { key: null, label: 'Acciones' }
          ].map(header => (
            <div 
              key={header.label}
              className={`flex items-center gap-2 ${header.key ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
              onClick={() => header.key && requestSort(header.key as any)}
            >
              {header.label}
              {header.key && <SortIcon active={sortConfig.key === header.key} direction={sortConfig.direction} />}
            </div>
          ))}
        >
          {paginatedResponsables.map(responsable => (
            <TableRow key={responsable.id} className={toggledResponsableId === responsable.id ? (toggleAction === 'activated' ? 'animate-flash-green' : 'animate-flash-red') : ''}>
              <TableCell>{formatId(responsable.id)}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900">{responsable.name}</span>
                  <span className="text-xs text-gray-500">{responsable.email}</span>
                </div>
              </TableCell>
              <TableCell>{responsable.docType}</TableCell>
              <TableCell>{responsable.docNumber}</TableCell>
              <TableCell>{responsable.phone}</TableCell>
              <TableCell>
                <Badge variant={responsable.status}>{responsable.status === 'active' ? 'Activo' : 'Inactivo'}</Badge>
              </TableCell>
              <TableCell className="font-semibold text-red-600">
                ${(responsable.deudaTotal || 0).toLocaleString()}
              </TableCell>
              <TableCell>{formatDate(responsable.creadoAt)}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleViewDetail(responsable)} title="Ver detalle">
                    <Eye size={14} />
                  </Button>
                  {canEdit('responsables') && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => handleOpenModal(responsable)} title="Editar">
                        <Pencil size={14} />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleToggleStatus(responsable)}
                        title={responsable.status === 'active' ? 'Desactivar' : 'Activar'}
                        className="hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                      >
                        <UserX size={14} className="text-red-500" />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </Table>

        <div className="p-4 bg-gray-50/30 dark:bg-slate-800/50 border-t border-gray-border dark:border-slate-700/50 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-slate-400">
            Mostrando {Math.min(paginatedResponsables.length + (currentPage - 1) * itemsPerPage, filteredResponsables.length)} de {filteredResponsables.length} responsables
            {statusFilter !== 'all' && <span className="ml-1 text-primary dark:text-teal-400 font-medium">· Filtro: {statusFilter === 'active' ? 'Activos' : 'Inactivos'}</span>}
          </span>
          {totalPages > 1 && (
            <div className="flex gap-2">
              <Button 
                variant="outline" size="sm" 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} /> Anterior
              </Button>
              <div className="flex items-center px-3 text-xs font-bold text-primary dark:text-teal-400 bg-white dark:bg-slate-800/80 border border-gray-border dark:border-slate-700 rounded-lg">
                {currentPage} / {totalPages}
              </div>
              <Button 
                variant="outline" size="sm" 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Siguiente <ChevronRight size={16} />
              </Button>
            </div>
          )}
        </div>

        {filteredResponsables.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-gray-500 bg-white">
            <UserX size={48} className="text-gray-200 mb-4" />
            <p className="text-lg font-medium">No se encontraron responsables</p>
            <p className="text-sm">Prueba ajustando los términos de búsqueda.</p>
          </div>
        )}
      </Card>




      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingResponsable ? 'Editar Responsable' : 'Nuevo Responsable'}
        size="lg"
        contentClassName="overflow-visible"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Guardar'}</Button>
          </>
        }
      >

        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wide mb-3 pb-2 border-b border-gray-border flex items-center gap-2">
              <UserCheck size={16} className="text-accent" /> Información Personal
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Nombres" error={errors.firstName}>
                <Input
                  value={formData.firstName}
                  onChange={e => {
                    const cleaned = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
                    setFormData({ ...formData, firstName: cleaned });
                    if (errors.firstName) setErrors(prev => ({ ...prev, firstName: '' }));
                  }}
                  onBlur={e => validateField('firstName', e.target.value)}
                  placeholder="Ej: Juan"
                  error={errors.firstName}
                  maxLength={40}
                />
              </FormField>
              <FormField label="Apellidos" error={errors.lastName}>
                <Input
                  value={formData.lastName}
                  onChange={e => {
                    const cleaned = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
                    setFormData({ ...formData, lastName: cleaned });
                    if (errors.lastName) setErrors(prev => ({ ...prev, lastName: '' }));
                  }}
                  onBlur={e => validateField('lastName', e.target.value)}
                  placeholder="Ej: Perez"
                  error={errors.lastName}
                  maxLength={40}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Tipo de Documento" error={errors.docType}>
                <Select
                  value={formData.docType}
                  onChange={e => {
                    setFormData({ ...formData, docType: e.target.value });
                    if (errors.docType) setErrors(prev => ({ ...prev, docType: '' }));
                    validateField('docType', e.target.value);
                  }}
                  options={[{ value: '', label: 'Seleccionar...' }, ...data.config.documentTypes.map(d => ({ value: d.abreviatura, label: d.abreviatura }))]}
                  error={errors.docType}
                />
              </FormField>
              <FormField label="Número de Documento" error={errors.docNumber}>
                <Input
                  value={formData.docNumber}
                  onChange={e => {
                    let val = e.target.value;
                    const typeUpper = formData.docType ? formData.docType.toUpperCase() : '';
                    if (typeUpper === 'CC') {
                      val = val.replace(/\D/g, '');
                    } else if (typeUpper === 'PASAPORTE' || typeUpper === 'PP' || typeUpper === 'PAS') {
                      val = val.replace(/[^a-zA-Z0-9]/g, '');
                    } else if (typeUpper === 'NIT' || typeUpper === 'RUT') {
                      val = val.replace(/[^0-9-]/g, '');
                    } else {
                      val = val.replace(/[^\w-]/gi, '');
                    }
                    setFormData({ ...formData, docNumber: val });
                    if (errors.docNumber) setErrors(prev => ({ ...prev, docNumber: '' }));
                  }}
                  onBlur={e => validateField('docNumber', e.target.value)}
                  placeholder="Número de documento"
                  error={errors.docNumber}
                  maxLength={
                    formData.docType ? (
                      formData.docType.toUpperCase() === 'CC' ? 10 :
                      ['PASAPORTE', 'PP', 'PAS'].includes(formData.docType.toUpperCase()) ? 12 :
                      ['NIT', 'RUT'].includes(formData.docType.toUpperCase()) ? 11 : 15
                    ) : 15
                  }
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Teléfono" error={errors.phone}>
                <Input
                  value={formData.phone}
                  onChange={e => {
                    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 15);
                    setFormData({ ...formData, phone: cleaned });
                    if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
                  }}
                  onBlur={e => validateField('phone', e.target.value)}
                  placeholder="3001234567"
                  error={errors.phone}
                  maxLength={15}
                />
              </FormField>
              <FormField label="Fecha de Nacimiento" error={errors.birthDate}>
                <DatePicker
                  value={formData.birthDate}
                  onChange={(val) => {
                    setFormData({ ...formData, birthDate: val });
                    if (errors.birthDate) setErrors(prev => ({ ...prev, birthDate: '' }));
                    validateField('birthDate', val);
                  }}
                  max={todayStr()}
                  fieldName="Nacimiento del responsablee"
                  popoverDirection="up"
                  triggerError={triggerError}
                />
              </FormField>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wide mb-3 pb-2 border-b border-gray-border flex items-center gap-2">
              <Search size={16} className="text-accent" /> Información de Contacto y Estado
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Correo Electrónico" error={errors.email}>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={e => {
                    const cleaned = e.target.value.replace(/\s/g, '').toLowerCase(); // Sin espacios en correos
                    setFormData({ ...formData, email: cleaned });
                    if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                  }}
                  onBlur={e => validateField('email', e.target.value)}
                  placeholder="correo@ejemplo.com"
                  error={errors.email}
                  maxLength={40}
                />
              </FormField>
              <FormField label="Estado">
                <Select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                  options={[
                    { value: 'active', label: 'Activo' },
                    { value: 'inactive', label: 'Inactivo' }
                  ]}
                />
              </FormField>
            </div>
          </section>
        </div>
      </Modal>

      <ResponsableDetailModal 
        isOpen={isDetailOpen} 
        onClose={() => setIsDetailOpen(false)} 
        responsable={selectedResponsable} 
        responsableSales={responsableSales} 
        responsableFlights={responsableFlights} 
      />

    </div>
  );
}


