import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Plane, ShieldCheck, UserRound, ChevronRight, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Input, FormField } from '../components/ui/Form';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(email, password, rememberMe);
    
    setIsLoading(false);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Credenciales incorrectas. Intenta de nuevo.');
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
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
        <div className="bg-white/65 backdrop-blur-xl rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,130,138,0.15)] p-8 border border-white/40 text-[#002855]">
          {/* Logo Corporativo */}
          <div className="text-center mb-6 flex flex-col items-center">
            <img src="/itea logo.png" className="w-52 h-auto object-contain drop-shadow-md" alt="iCTea Logo" />
          </div>

          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold text-[#002855]">Bienvenido de nuevo</h2>
            <p className="text-gray-500 text-sm">Ingresa tus credenciales para acceder al sistema.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField label="Correo electrónico">
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="usuario@itea.com"
                disabled={isLoading}
                autoComplete="email"
                className="transition-all focus:border-[#00828a] focus:ring-[#00828a]/20"
              />
            </FormField>

            <FormField label="Contraseña">
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
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

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                  className="w-4 h-4 text-[#00828a] border-gray-300 rounded focus:ring-[#00828a]/30 transition-all bg-slate-50"
                />
                <span className="text-sm text-gray-600 group-hover:text-[#00828a] transition-colors font-medium">Recordarme</span>
              </label>
              <button type="button" className="text-sm text-[#00828a] font-bold hover:underline">
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-center gap-2 animate-shake">
                <Info size={16} className="text-red-500" />
                {error}
              </div>
            )}

            <button 
              type="submit" 
              className="w-full h-12 text-lg font-bold text-white bg-gradient-to-r from-[#002855] to-[#00828a] rounded-xl shadow-lg shadow-[#00828a]/15 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2" 
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

          {/* Sección de Cuentas Demo Mejorada */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <button 
              onClick={() => setShowDemo(!showDemo)}
              className="w-full flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-[#00828a] transition-colors"
            >
              <span>Cuentas de demostración</span>
              <div className={`transition-transform duration-300 ${showDemo ? 'rotate-180' : ''}`}>
                <ChevronRight size={14} className="rotate-90" />
              </div>
            </button>
            
            {showDemo && (
              <div className="mt-4 grid grid-cols-1 gap-2 animate-fade-in">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between group hover:border-[#00828a]/30 transition-all cursor-pointer" onClick={() => {setEmail('admin@itea.com'); setPassword('Admin123');}}>
                  <div>
                    <p className="text-[10px] font-bold text-[#00828a] uppercase">Administrador</p>
                    <p className="text-xs text-slate-600">admin@itea.com</p>
                  </div>
                  <ShieldCheck size={16} className="text-slate-300 group-hover:text-[#00828a] transition-colors" />
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between group hover:border-[#00828a]/30 transition-all cursor-pointer" onClick={() => {setEmail('juan@itea.com'); setPassword('Vendor123');}}>
                  <div>
                    <p className="text-[10px] font-bold text-[#00828a] uppercase">Asesor</p>
                    <p className="text-xs text-slate-600">juan@itea.com</p>
                  </div>
                  <Plane size={16} className="text-slate-300 group-hover:text-[#00828a] transition-colors" />
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between group hover:border-[#00828a]/30 transition-all cursor-pointer" onClick={() => {setEmail('maria@itea.com'); setPassword('Vendor123');}}>
                  <div>
                    <p className="text-[10px] font-bold text-[#00828a] uppercase">Asesora</p>
                    <p className="text-xs text-slate-600">maria@itea.com</p>
                  </div>
                  <UserRound size={16} className="text-slate-300 group-hover:text-[#00828a] transition-colors" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer del Login */}
        <p className="text-center mt-8 text-white/40 text-xs">
          &copy; {new Date().getFullYear()} iTea Servicio Exclusivo Para Agencias de Viajes 
          <br></br>
          Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}