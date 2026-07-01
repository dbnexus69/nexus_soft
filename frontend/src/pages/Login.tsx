import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ChevronRight, Info, ArrowLeft, Check, X, Mail, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Input, FormField } from '../components/ui/Form';
import { forgotPassword, verifyCode, resetPassword } from '../api/auth';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { isDarkMode } = useTheme();

  useEffect(() => {
    // Force light mode on login page
    document.documentElement.classList.remove('dark');
    return () => {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      }
    };
  }, [isDarkMode]);

  // Password Recovery States
  const [view, setView] = useState<'login' | 'forgot' | 'verify' | 'reset'>('login');
  const [resetEmail, setResetEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Toast States
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorToastMessage, setErrorToastMessage] = useState('');

  // Live Password Validation Criteria
  const passwordCriteria = [
    { label: 'Mínimo 8 caracteres', met: newPassword.length >= 8 },
    { label: 'Una letra minúscula', met: /[a-z]/.test(newPassword) },
    { label: 'Una letra mayúscula', met: /[A-Z]/.test(newPassword) },
    { label: 'Un número', met: /\d/.test(newPassword) },
    { label: 'Un carácter especial (ej: @, $, !, %, *, ?)', met: /[^A-Za-z0-9]/.test(newPassword) },
  ];
  const allCriteriaMet = passwordCriteria.every(c => c.met);

  // Email Validation (valid format and max 40 characters)
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const isEmailValid = emailRegex.test(resetEmail) && resetEmail.length <= 40;

  const triggerSuccessToast = (msg: string) => {
    setSuccessMessage(msg);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
    }, 4000);
  };

  const triggerErrorToast = (msg: string) => {
    setErrorToastMessage(msg);
    setShowErrorToast(true);
    setTimeout(() => {
      setShowErrorToast(false);
    }, 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await login(email, password, false);
    
    setIsLoading(false);

    if (result.success) {
      navigate('/');
    } else {
      triggerErrorToast(result.error || 'Credenciales incorrectas. Intenta de nuevo.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailValid) return;
    setIsLoading(true);
    try {
      await forgotPassword(resetEmail);
      triggerSuccessToast('Código enviado. Revisa tu bandeja de entrada.');
      setTimeout(() => {
        setView('verify');
      }, 1500);
    } catch (err: any) {
      triggerErrorToast(err?.response?.data?.error?.message || err?.message || 'Error al enviar el código de recuperación.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setIsLoading(true);
    try {
      await verifyCode(resetEmail, code);
      triggerSuccessToast('Código verificado correctamente.');
      setTimeout(() => {
        setView('reset');
      }, 1500);
    } catch (err: any) {
      triggerErrorToast(err?.response?.data?.error?.message || err?.message || 'Código incorrecto o expirado.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allCriteriaMet) return;
    setConfirmPassword('');

    if (newPassword !== confirmPassword) {
      triggerErrorToast('Las contraseñas no coinciden.');
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(resetEmail, code, newPassword);
      triggerSuccessToast('Contraseña restablecida con éxito. Redirigiendo...');
      setEmail(resetEmail);
      setTimeout(() => {
        setView('login');
        setResetEmail('');
        setCode('');
        setNewPassword('');
        setConfirmPassword('');
      }, 2000);
    } catch (err: any) {
      triggerErrorToast(err?.response?.data?.error?.message || err?.message || 'Error al restablecer la contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc] dark:bg-[#090b11] overflow-x-hidden font-body text-slate-800 dark:text-slate-200">
      
      {/* Toast de Éxito Flotante */}
      {showSuccess && (
        <div className="fixed top-6 right-6 z-[200] bg-emerald-50/95 dark:bg-emerald-950/95 backdrop-blur-md border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-in-right">
          <div className="bg-emerald-500 text-white rounded-full p-1.5 flex-shrink-0">
            <Check size={16} className="stroke-[3px]" />
          </div>
          <div>
            <p className="font-bold text-sm">Operación Exitosa</p>
            <p className="text-xs opacity-90">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Toast de Error/Advertencia Flotante */}
      {showErrorToast && (
        <div className="fixed top-6 right-6 z-[200] bg-rose-50/95 dark:bg-rose-950/95 backdrop-blur-md border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-in-right">
          <div className="bg-rose-500 text-white rounded-full p-1.5 flex-shrink-0">
            <X size={16} className="stroke-[3px]" />
          </div>
          <div>
            <p className="font-bold text-sm">Error</p>
            <p className="text-xs opacity-90">{errorToastMessage}</p>
          </div>
        </div>
      )}

      {/* PANEL IZQUIERDO: Formularios */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 lg:p-16 z-20">
        <div className="w-full max-w-md space-y-8 animate-fade-in-up">
          {/* Logo Premium */}
          <div className="flex justify-center mb-4">
            <img 
              src="/db_nexus_logo.png" 
              className="h-28 w-auto object-contain select-none dark:invert" 
              alt="DB NEXUS Logo" 
            />
          </div>

          {/* Encabezado */}
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-heading">
              {view === 'login' && 'Bienvenido de nuevo'}
              {view === 'forgot' && 'Recuperar contraseña'}
              {view === 'verify' && 'Verificar código'}
              {view === 'reset' && 'Nueva contraseña'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
              {view === 'login' && 'Ingresa tus credenciales para acceder a la suite.'}
              {view === 'forgot' && 'Ingresa tu correo para recibir un código de recuperación.'}
              {view === 'verify' && 'Ingresa el código de 6 dígitos enviado a tu correo.'}
              {view === 'reset' && 'Define y confirma tu nueva contraseña de acceso.'}
            </p>
          </div>

          {/* VISTA: LOGIN PREDETERMINADO */}
          {view === 'login' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <FormField label="Correo electrónico" className="mb-0">
                <div className="relative group font-body">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors z-10">
                    <Mail size={18} />
                  </span>
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="usuario@itea.com"
                    disabled={isLoading}
                    autoComplete="email"
                    className="pl-12 pr-4 py-3 bg-white dark:bg-[#131524] border border-slate-200 dark:border-slate-800 rounded-2xl text-sm transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 w-full"
                  />
                </div>
              </FormField>

              <FormField label="Contraseña" className="mb-0">
                <div className="relative group font-body">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors z-10">
                    <Lock size={18} />
                  </span>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isLoading}
                    autoComplete="current-password"
                    className="pl-12 pr-12 py-3 bg-white dark:bg-[#131524] border border-slate-200 dark:border-slate-800 rounded-2xl text-sm transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 w-full"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors z-10"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </FormField>

              <div className="flex items-center justify-end">
                <button 
                  type="button" 
                  onClick={() => { setView('forgot'); setErrorToastMessage(''); setResetEmail(email); }}
                  className="text-xs text-primary font-bold hover:underline tracking-wide hover:text-primary-dark transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <button 
                type="submit" 
                className="w-full py-3.5 px-6 text-sm font-bold text-white bg-gradient-to-r from-primary to-accent hover:from-primary-dark hover:to-accent-dark rounded-2xl shadow-lg shadow-primary/10 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 hover:shadow-xl hover:shadow-primary/20" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={18} />
                    <span>Verificando credenciales...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>Ingresar a la plataforma</span>
                    <ChevronRight size={18} />
                  </div>
                )}
              </button>
            </form>
          )}

          {/* VISTA: SOLICITAR CÓDIGO */}
          {view === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <FormField label="Correo electrónico" className="mb-0">
                <div className="relative group font-body">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors z-10">
                    <Mail size={18} />
                  </span>
                  <Input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    placeholder="usuario@itea.com"
                    disabled={isLoading}
                    maxLength={41}
                    className="pl-12 pr-4 py-3 bg-white dark:bg-[#131524] border border-slate-200 dark:border-slate-800 rounded-2xl text-sm transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 w-full"
                  />
                </div>
                {resetEmail.length > 40 && (
                  <p className="text-xs text-rose-500 mt-1">El correo no puede exceder los 40 caracteres.</p>
                )}
              </FormField>

              <button 
                type="submit" 
                className="w-full py-3.5 px-6 text-sm font-bold text-white bg-gradient-to-r from-primary to-accent hover:from-primary-dark hover:to-accent-dark rounded-2xl shadow-lg shadow-primary/10 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={isLoading || !isEmailValid}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={18} />
                    <span>Verificando...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>Enviar código</span>
                    <ChevronRight size={18} />
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setView('login'); setErrorToastMessage(''); }}
                className="w-full py-3.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center gap-2 transition-colors border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-900"
                disabled={isLoading}
              >
                <ArrowLeft size={14} />
                Volver al inicio de sesión
              </button>
            </form>
          )}

          {/* VISTA: VERIFICAR CÓDIGO */}
          {view === 'verify' && (
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <FormField label="Código de recuperación" className="mb-0">
                <div className="relative group font-body">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors z-10">
                    <ShieldCheck size={18} />
                  </span>
                  <Input
                    type="text"
                    required
                    maxLength={6}
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    disabled={isLoading}
                    className="pl-12 pr-4 py-3 bg-white dark:bg-[#131524] border border-slate-200 dark:border-slate-800 rounded-2xl text-lg font-bold tracking-[0.25em] text-center focus:border-primary focus:ring-4 focus:ring-primary/10 w-full"
                  />
                </div>
              </FormField>

              <button 
                type="submit" 
                className="w-full py-3.5 px-6 text-sm font-bold text-white bg-gradient-to-r from-primary to-accent hover:from-primary-dark hover:to-accent-dark rounded-2xl shadow-lg shadow-primary/10 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={isLoading || code.length !== 6}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={18} />
                    <span>Verificando...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>Verificar código</span>
                    <ChevronRight size={18} />
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setView('forgot'); setErrorToastMessage(''); setCode(''); }}
                className="w-full py-3.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center gap-2 transition-colors border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-900"
                disabled={isLoading}
              >
                <ArrowLeft size={14} />
                Volver a solicitar código
              </button>
            </form>
          )}

          {/* VISTA: RESTABLECER CONTRASEÑA */}
          {view === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <FormField label="Nueva contraseña" className="mb-0">
                <div className="relative group font-body">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors z-10">
                    <Lock size={18} />
                  </span>
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Escribe tu nueva contraseña"
                    disabled={isLoading}
                    className="pl-12 pr-12 py-3 bg-white dark:bg-[#131524] border border-slate-200 dark:border-slate-800 rounded-2xl text-sm transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 w-full"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors z-10"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </FormField>

              {/* Requisitos de contraseña */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2 text-xs text-slate-500 dark:text-slate-400 font-body">
                <p className="font-bold text-slate-700 dark:text-slate-300">Tu contraseña debe cumplir con:</p>
                {passwordCriteria.map((criterion, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    {criterion.met ? (
                      <Check size={14} className="text-emerald-500 stroke-[3.5px]" />
                    ) : (
                      <X size={14} className="text-slate-400 stroke-[3.5px]" />
                    )}
                    <span className={criterion.met ? 'text-emerald-700 dark:text-emerald-400 font-medium line-through' : 'text-slate-500'}>
                      {criterion.label}
                    </span>
                  </div>
                ))}
              </div>

              <FormField label="Confirmar nueva contraseña" className="mb-0">
                <div className="relative group font-body">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors z-10">
                    <Lock size={18} />
                  </span>
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    disabled={isLoading}
                    className="pl-12 pr-12 py-3 bg-white dark:bg-[#131524] border border-slate-200 dark:border-slate-800 rounded-2xl text-sm transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 w-full"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors z-10"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </FormField>

              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-rose-500 font-body">Las contraseñas no coinciden.</p>
              )}

              <button 
                type="submit" 
                className="w-full py-3.5 px-6 text-sm font-bold text-white bg-gradient-to-r from-primary to-accent hover:from-primary-dark hover:to-accent-dark rounded-2xl shadow-lg shadow-primary/10 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={isLoading || !allCriteriaMet || newPassword !== confirmPassword}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={18} />
                    <span>Guardando...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>Guardar contraseña</span>
                    <ChevronRight size={18} />
                  </div>
                )}
              </button>
            </form>
          )}

          {/* Footer del Formulario */}
          <div className="pt-6 border-t border-slate-100 dark:border-slate-800/80 font-body">
            <p className="text-center text-slate-400 text-xs">
              &copy; {new Date().getFullYear()} NEXUS Suite. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </div>

      {/* PANEL DERECHO: Visual y Marketing (Desktop) */}
      <div className="hidden md:flex flex-1 relative overflow-hidden">
        {/* Fondo con Imagen de Viajes de Lujo */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat animate-slow-zoom"
          style={{ 
            backgroundImage: 'url("/luxury_travel_bg.png")',
          }}
        />
        {/* Overlay con degradado premium */}
        <div className="absolute inset-0 z-10 bg-gradient-to-tr from-[#090b11] via-[#090b11]/70 to-[#4f46e5]/40" />

        {/* Círculos de luz decorativos sobre la imagen */}
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-accent/20 rounded-full blur-[100px] z-10 animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-primary/20 rounded-full blur-[120px] z-10" />

        {/* Contenido Visual */}
        <div className="relative z-20 flex flex-col justify-between p-16 w-full text-white">
          <div className="text-right">
            <span className="px-4 py-1.5 text-xs font-semibold tracking-widest uppercase bg-white/10 backdrop-blur-md border border-white/20 rounded-full">
              Enterprise v2.0
            </span>
          </div>

          <div className="space-y-6 max-w-lg">
            <h1 className="text-4xl lg:text-5xl font-black tracking-tight leading-none font-heading text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-amber-200">
              Explore.<br />Manage.<br />Elevate.
            </h1>
            <p className="text-slate-300 text-base leading-relaxed font-body">
              La plataforma de administración de viajes de lujo y corporativos definitiva. Automatiza reservas, controla comisiones y gestiona itinerarios en segundos.
            </p>

            {/* Widget de Estadísticas Flotante */}
            <div className="pt-4">
              <div className="inline-flex items-center gap-6 p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Disponibilidad</p>
                  <p className="text-lg font-bold text-emerald-400">99.98%</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Soporte</p>
                  <p className="text-lg font-bold text-amber-400">24/7 Premium</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-400 font-medium font-body">
              Tecnología de desarrollo exclusiva para DBNEXUS Software.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}