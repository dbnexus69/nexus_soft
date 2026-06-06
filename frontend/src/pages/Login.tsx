import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ChevronRight, Info, ArrowLeft, Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Input, FormField } from '../components/ui/Form';
import { forgotPassword, verifyCode, resetPassword } from '../api/auth';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Toast de Éxito Flotante */}
      {showSuccess && (
        <div className="fixed top-6 right-6 z-[200] bg-emerald-50 border border-emerald-200 text-emerald-700 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-in-right">
          <div className="bg-emerald-500 text-white rounded-full p-1 flex-shrink-0">
            <Check size={18} className="stroke-[3px]" />
          </div>
          <div>
            <p className="font-bold text-sm">Operación Exitosa</p>
            <p className="text-xs opacity-90">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Toast de Error/Advertencia Flotante */}
      {showErrorToast && (
        <div className="fixed top-6 right-6 z-[200] bg-rose-50 border border-rose-200 text-rose-700 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-in-right">
          <div className="bg-rose-500 text-white rounded-full p-1 flex-shrink-0">
            <X size={18} className="stroke-[3px]" />
          </div>
          <div>
            <p className="font-bold text-sm">Error</p>
            <p className="text-xs opacity-90">{errorToastMessage}</p>
          </div>
        </div>
      )}

      {/* Fondo con Imagen de Aeropuerto y Overlay */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-transform duration-[20s] scale-110 animate-slow-zoom"
        style={{ 
          backgroundImage: 'url("/business_travel_bg.png")',
        }}
      />
      <div className="absolute inset-0 z-10 bg-gradient-to-br from-primary/90 via-primary/70 to-transparent" />
      
      {/* Círculos de luz decorativos */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/20 rounded-full blur-[120px] z-10 animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary-dark/40 rounded-full blur-[120px] z-10" />

      {/* Contenedor del Login */}
      <div className="relative z-20 w-full max-w-md animate-fade-in-up">
        {/* Tarjeta de Login Glassmorphism */}
        <div className="bg-white/65 backdrop-blur-xl rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,130,138,0.15)] p-6 border border-white/40 text-[#002855]">
          {/* Logo Corporativo */}
          <div className="text-center mb-3 flex flex-col items-center">
            <img src="/itea logo.png" className="w-40 h-auto object-contain drop-shadow-md" alt="iCTea Logo" />
          </div>

          <div className="mb-4 text-center">
            <h2 className="text-xl font-bold text-[#002855]">
              {view === 'login' && 'Bienvenido de nuevo'}
              {view === 'forgot' && 'Recuperar contraseña'}
              {view === 'verify' && 'Verificar código'}
              {view === 'reset' && 'Nueva contraseña'}
            </h2>
            <p className="text-gray-500 text-sm">
              {view === 'login' && 'Ingresa tus credenciales para acceder al sistema.'}
              {view === 'forgot' && 'Ingresa tu correo para recibir un código de recuperación.'}
              {view === 'verify' && 'Ingresa el código de 6 dígitos enviado a tu correo.'}
              {view === 'reset' && 'Define y confirma tu nueva contraseña de acceso.'}
            </p>
          </div>

          {/* VISTA: LOGIN PREDETERMINADO */}
          {view === 'login' && (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <FormField label="Correo electrónico" className="mb-1">
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="usuario@itea.com"
                  disabled={isLoading}
                  autoComplete="email"
                  className="transition-all focus:border-[#00828a] focus:ring-[#00828a]/20"
                />
              </FormField>

              <FormField label="Contraseña" className="mb-1">
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isLoading}
                    autoComplete="current-password"
                    className="transition-all focus:border-[#00828a] focus:ring-[#00828a]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#00828a] transition-colors"
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
                  className="text-sm text-[#00828a] font-bold hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <button 
                type="submit" 
                className="w-full h-11 text-base font-bold text-white bg-gradient-to-r from-[#002855] to-[#00828a] rounded-xl shadow-lg shadow-[#00828a]/15 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={20} />
                    <span>Verificando...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>Iniciar Sesión</span>
                    <ChevronRight size={20} />
                  </div>
                )}
              </button>
            </form>
          )}

          {/* VISTA: SOLICITAR CÓDIGO */}
          {view === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-3.5">
              <FormField label="Correo electrónico" className="mb-1">
                <Input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  placeholder="usuario@itea.com"
                  disabled={isLoading}
                  maxLength={41}
                  className="transition-all focus:border-[#00828a] focus:ring-[#00828a]/20"
                />
                {resetEmail.length > 40 && (
                  <p className="text-xs text-red-500 mt-1">El correo no puede exceder los 40 caracteres.</p>
                )}
              </FormField>

              <button 
                type="submit" 
                className="w-full h-11 text-base font-bold text-white bg-gradient-to-r from-[#002855] to-[#00828a] rounded-xl shadow-lg shadow-[#00828a]/15 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100" 
                disabled={isLoading || !isEmailValid}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={20} />
                    <span>Verificando...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>Enviar código</span>
                    <ChevronRight size={20} />
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setView('login'); setErrorToastMessage(''); }}
                className="w-full h-11 text-sm font-bold text-gray-500 hover:text-[#00828a] flex items-center justify-center gap-2 transition-colors"
                disabled={isLoading}
              >
                <ArrowLeft size={16} />
                Volver al inicio de sesión
              </button>
            </form>
          )}

          {/* VISTA: VERIFICAR CÓDIGO */}
          {view === 'verify' && (
            <form onSubmit={handleVerifyCode} className="space-y-3.5">
              <FormField label="Código de recuperación" className="mb-1">
                <Input
                  type="text"
                  required
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  disabled={isLoading}
                  className="transition-all tracking-[0.25em] text-center font-bold text-lg focus:border-[#00828a] focus:ring-[#00828a]/20"
                />
              </FormField>

              <button 
                type="submit" 
                className="w-full h-11 text-base font-bold text-white bg-gradient-to-r from-[#002855] to-[#00828a] rounded-xl shadow-lg shadow-[#00828a]/15 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100" 
                disabled={isLoading || code.length !== 6}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={20} />
                    <span>Verificando...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>Verificar código</span>
                    <ChevronRight size={20} />
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setView('forgot'); setErrorToastMessage(''); setCode(''); }}
                className="w-full h-11 text-sm font-bold text-gray-500 hover:text-[#00828a] flex items-center justify-center gap-2 transition-colors"
                disabled={isLoading}
              >
                <ArrowLeft size={16} />
                Volver a solicitar código
              </button>
            </form>
          )}

          {/* VISTA: RESTABLECER CONTRASEÑA */}
          {view === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-3.5">
              <FormField label="Nueva contraseña" className="mb-1">
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Escribe tu nueva contraseña"
                    disabled={isLoading}
                    className="transition-all focus:border-[#00828a] focus:ring-[#00828a]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#00828a] transition-colors"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </FormField>

              {/* Indicador en vivo de requisitos de contraseña */}
              <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1.5 text-xs text-gray-600">
                <p className="font-bold text-gray-700 mb-1">Tu contraseña debe cumplir con:</p>
                {passwordCriteria.map((criterion, idx) => (
                  <div key={idx} className="flex items-center gap-2 transition-all">
                    {criterion.met ? (
                      <Check size={14} className="text-emerald-500 stroke-[3px]" />
                    ) : (
                      <X size={14} className="text-gray-400 stroke-[3px]" />
                    )}
                    <span className={criterion.met ? 'text-emerald-700 font-medium line-through decoration-emerald-500/30' : 'text-gray-500'}>
                      {criterion.label}
                    </span>
                  </div>
                ))}
              </div>

              <FormField label="Confirmar nueva contraseña" className="mb-1">
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    disabled={isLoading}
                    className="transition-all focus:border-[#00828a] focus:ring-[#00828a]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#00828a] transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </FormField>

              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500">Las contraseñas no coinciden.</p>
              )}

              <button 
                type="submit" 
                className="w-full h-11 text-base font-bold text-white bg-gradient-to-r from-[#002855] to-[#00828a] rounded-xl shadow-lg shadow-[#00828a]/15 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100" 
                disabled={isLoading || !allCriteriaMet || newPassword !== confirmPassword}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={20} />
                    <span>Guardando...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>Guardar contraseña</span>
                    <ChevronRight size={20} />
                  </div>
                )}
              </button>
            </form>
          )}

        </div>

        {/* Footer del Login */}
        <p className="text-center mt-4 text-white/40 text-xs">
          &copy; {new Date().getFullYear()} iTea Sistema Exclusivo Para Agencias de Viajes 
          <br></br>
          Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}