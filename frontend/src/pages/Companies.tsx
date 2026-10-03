import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Plus, Upload, Link2, Palette, UserPlus, Users } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, FormField } from '../components/ui/Form';
import { SKELETON } from '../components/ui/Skeleton';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import * as api from '../api';
import type { Empresa } from '../api';

/**
 * Las agencias que usan el sistema. Solo la ve el superadministrador.
 *
 * **La idea de la pantalla:** una lista de empresas es una lista de MARCAS, así
 * que cada fila lleva la suya. El color no decora, identifica: al entrar, lo
 * primero que se distingue de una agencia a otra es su franja y su logo, antes
 * de leer un solo nombre. Por eso no hay una tabla de texto gris con una columna
 * "color" al final.
 *
 * Lo demás va callado a propósito. La única cifra que se repite en cada fila es
 * el uso —usuarios, clientes, ventas—, que es lo que dice si una agencia está
 * viva o si se dio de alta y nadie volvió a entrar.
 */

/** Un identificador a partir del nombre: lo que casi siempre se quiere. */
function comoSlug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

const COLORES_POR_DEFECTO = { primario: '#2B2D42', acento: '#8D99AE', realce: '#0F7B8A' };

/** Las iniciales, para cuando una agencia aún no ha subido su logo. */
const iniciales = (nombre: string) =>
  nombre.split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

// Solo necesita estos tres campos: así sirve tanto para una agencia real como
// para la vista previa en vivo del alta, que no tiene un `Empresa` completo.
type MarcaDe = Pick<Empresa, 'nombre' | 'logoUrl' | 'colorPrimario'>;

function Marca({ empresa, tamano = 44 }: { empresa: MarcaDe; tamano?: number }) {
  const color = empresa.colorPrimario || COLORES_POR_DEFECTO.primario;
  if (empresa.logoUrl) {
    return (
      <img
        src={empresa.logoUrl}
        alt=""
        style={{ width: tamano, height: tamano }}
        className="rounded-xl object-contain bg-white ring-1 ring-slate-200 dark:ring-slate-700"
      />
    );
  }
  return (
    <div
      style={{ width: tamano, height: tamano, backgroundColor: color }}
      className="grid place-items-center rounded-xl font-heading text-sm font-bold text-white"
      aria-hidden
    >
      {iniciales(empresa.nombre)}
    </div>
  );
}

function Cifra({ valor, que }: { valor: number; que: string }) {
  return (
    <div className="text-center">
      <p className="font-heading text-lg font-semibold tabular-nums text-primary dark:text-white">{valor}</p>
      <p className="text-[11px] text-accent">{que}</p>
    </div>
  );
}

export default function Companies() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Empresa | null>(null);
  const [porSuspender, setPorSuspender] = useState<Empresa | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await api.listCompanies({ perPage: 100 });
      setEmpresas(r.data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las agencias');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const activas = useMemo(() => empresas.filter(e => e.estado === 'activa').length, [empresas]);

  const cambiarEstado = async (empresa: Empresa, estado: 'activa' | 'suspendida') => {
    await api.updateCompany(empresa.id, { estado });
    setPorSuspender(null);
    cargar();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-primary dark:text-white">Agencias</h1>
          <p className="mt-0.5 text-sm text-accent">
            {cargando ? 'Cargando…' : `${empresas.length} en el sistema, ${activas} activas`}
          </p>
        </div>
        <Button onClick={() => setCreando(true)}>
          <Plus size={16} />Crear Agencia
        </Button>
      </header>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {cargando ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <div key={i} className={`${SKELETON} h-[76px] rounded-2xl`} />)}
        </div>
      ) : empresas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
          <Building2 size={28} className="mx-auto text-accent" />
          <p className="mt-3 text-sm text-accent">
            No hay ninguna agencia creada.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {empresas.map(empresa => (
            <li key={empresa.id}>
              <button
                type="button"
                onClick={() => setEditando(empresa)}
                className="flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white pr-5 text-left transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-slate-700"
              >
                {/* La franja es la marca de la agencia, no un adorno: es lo que
                    distingue una fila de otra antes de leer nada. */}
                <span
                  aria-hidden
                  style={{ backgroundColor: empresa.colorPrimario || COLORES_POR_DEFECTO.primario }}
                  className="h-[76px] w-1.5 shrink-0"
                />
                <Marca empresa={empresa} />
                <div className="min-w-0 flex-1 py-3">
                  <p className="truncate font-heading font-semibold text-primary dark:text-white">{empresa.nombre}</p>
                  <p className="truncate text-xs text-accent">/{empresa.slug}</p>
                </div>
                {empresa.uso && (
                  <div className="hidden gap-6 sm:flex">
                    <Cifra valor={empresa.uso.usuarios} que="usuarios" />
                    <Cifra valor={empresa.uso.clientes} que="clientes" />
                    <Cifra valor={empresa.uso.ventas} que="ventas" />
                  </div>
                )}
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${empresa.estado === 'activa' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    aria-hidden
                  />
                  {empresa.estado === 'activa' ? 'Activa' : 'Suspendida'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {creando && (
        <AltaDeAgencia onClose={() => setCreando(false)} onCreada={() => { setCreando(false); cargar(); }} />
      )}
      {editando && (
        <FichaDeAgencia
          empresa={editando}
          onClose={() => setEditando(null)}
          onGuardada={() => { setEditando(null); cargar(); }}
          onSuspender={() => { setPorSuspender(editando); setEditando(null); }}
        />
      )}

      <ConfirmDialog
        isOpen={!!porSuspender}
        title={`¿Suspender ${porSuspender?.nombre}?`}
        confirmLabel="Suspender la agencia"
        variant="danger"
        onCancel={() => setPorSuspender(null)}
        onConfirm={() => porSuspender && cambiarEstado(porSuspender, 'suspendida')}
      >
        Sus usuarios dejarán de poder entrar y se cerrarán las sesiones que tengan abiertas
        ahora mismo. Sus datos se conservan y puedes reactivarla cuando quieras.
      </ConfirmDialog>
    </div>
  );
}

/** El selector de los tres colores de marca, compartido por el alta y la ficha. */
function SelectorDeColores({ colores, onChange }: {
  colores: { primario: string; acento: string; realce: string };
  onChange: (clave: 'primario' | 'acento' | 'realce', valor: string) => void;
}) {
  return (
    <fieldset>
      <legend className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
        <Palette size={13} /> Colores de la marca
      </legend>
      {/* Dice dónde se ven, que es lo que hay que saber al elegirlos: si no,
          quien los elige espera que cambien la aplicación entera. */}
      <p className="mt-1 text-xs text-accent">
        Se usan en el voucher que recibe su cliente. La aplicación mantiene siempre
        los mismos colores; el logo y el nombre sí son los de la agencia.
      </p>
      <div className="mt-3 flex flex-wrap gap-5">
        {([['primario', 'Principal'], ['acento', 'Acento'], ['realce', 'Realce']] as const).map(([clave, etiqueta]) => (
          <label key={clave} className="group flex cursor-pointer flex-col items-center gap-1.5">
            {/* El círculo ES el color, no una muestra al lado de un input nativo
                diminuto: aquí el color es lo que se está eligiendo, así que es
                lo que debe verse primero. El input real sigue encima, invisible,
                para que el clic abra el selector del sistema. */}
            <span
              className="relative block h-11 w-11 rounded-full shadow-sm ring-2 ring-white transition-transform group-hover:scale-105 dark:ring-slate-900"
              style={{ backgroundColor: colores[clave] }}
            >
              <input
                type="color"
                value={colores[clave]}
                onChange={e => onChange(clave, e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{etiqueta}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** El alta: la agencia y quien va a entrar en ella, de una vez. */
function AltaDeAgencia({ onClose, onCreada }: { onClose: () => void; onCreada: () => void }) {
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTocado, setSlugTocado] = useState(false);
  const [colores, setColores] = useState(COLORES_POR_DEFECTO);
  const [admin, setAdmin] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const slugEfectivo = slugTocado ? slug : comoSlug(nombre);

  const guardar = async () => {
    setGuardando(true); setError('');
    try {
      await api.createCompany({
        nombre: nombre.trim(),
        slug: slugEfectivo,
        colorPrimario: colores.primario,
        colorAcento: colores.acento,
        colorRealce: colores.realce,
        admin,
      });
      onCreada();
    } catch (e: any) {
      setError(e.response?.data?.error?.message || e.message || 'No se pudo dar de alta la agencia');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Dar de alta una agencia"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando || !nombre.trim() || !admin.email || !admin.firstName || !admin.password}>
            {guardando ? 'Creando…' : 'Crear la agencia'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Vista previa en vivo: la fila que esta agencia va a tener en la lista,
            mientras se escribe el nombre y se eligen los colores. */}
        <div
          className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 transition-colors dark:border-slate-700"
          style={{ backgroundColor: `${colores.primario}0d` }}
        >
          <Marca empresa={{ nombre: nombre || 'Nueva agencia', logoUrl: null, colorPrimario: colores.primario }} tamano={48} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading font-semibold text-primary dark:text-white">
              {nombre || 'Nombre de la agencia'}
            </p>
            <p className="truncate text-xs text-accent">/{slugEfectivo || 'direccion-web'}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nombre de la agencia">
            <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Viajes Sol" />
          </FormField>
          <FormField label={<span className="flex items-center gap-1.5"><Link2 size={13} /> Dirección web</span>}>
            {/* El slug se propone desde el nombre, que es lo que casi siempre se
                quiere, y se puede corregir. Se muestra dónde va a vivir para que
                no haya que imaginárselo. */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 dark:border-slate-700">
              <span className="text-sm text-accent">/</span>
              <input
                value={slugEfectivo}
                onChange={e => { setSlugTocado(true); setSlug(comoSlug(e.target.value)); }}
                placeholder="viajes-sol"
                className="w-full bg-transparent py-2 text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary rounded dark:text-white"
              />
            </div>
          </FormField>
        </div>

        <SelectorDeColores colores={colores} onChange={(clave, valor) => setColores(c => ({ ...c, [clave]: valor }))} />

        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/40">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-primary dark:text-white">
            <UserPlus size={15} /> Quién va a entrar
          </h3>
          <p className="mt-0.5 text-xs text-accent">
            Se crea como administradora de la agencia. Podrá dar de alta al resto del equipo.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <FormField label="Nombre" className="mb-0">
              <Input value={admin.firstName} onChange={e => setAdmin(a => ({ ...a, firstName: e.target.value }))} />
            </FormField>
            <FormField label="Apellidos" className="mb-0">
              <Input value={admin.lastName} onChange={e => setAdmin(a => ({ ...a, lastName: e.target.value }))} />
            </FormField>
            <FormField label="Correo" className="mb-0">
              <Input type="email" value={admin.email} onChange={e => setAdmin(a => ({ ...a, email: e.target.value }))} />
            </FormField>
            <FormField label="Contraseña" className="mb-0">
              <Input type="password" value={admin.password} onChange={e => setAdmin(a => ({ ...a, password: e.target.value }))} />
            </FormField>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

/** La ficha: marca, logo y estado. El identificador no se toca. */
function FichaDeAgencia({ empresa, onClose, onGuardada, onSuspender }: {
  empresa: Empresa;
  onClose: () => void;
  onGuardada: () => void;
  onSuspender: () => void;
}) {
  const [nombre, setNombre] = useState(empresa.nombre);
  const [colores, setColores] = useState({
    primario: empresa.colorPrimario || COLORES_POR_DEFECTO.primario,
    acento: empresa.colorAcento || COLORES_POR_DEFECTO.acento,
    realce: empresa.colorRealce || COLORES_POR_DEFECTO.realce,
  });
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [logo, setLogo] = useState(empresa.logoUrl);
  const [error, setError] = useState('');

  const subirLogo = async (archivo: File) => {
    setSubiendo(true); setError('');
    try {
      const actualizada = await api.uploadCompanyLogo(empresa.id, archivo);
      setLogo(actualizada.logoUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir el logo');
    } finally {
      setSubiendo(false);
    }
  };

  const suplantar = async () => {
    setGuardando(true); setError('');
    try {
      const motivo = window.prompt('Motivo de la suplantación (visible en auditoría):', 'Soporte técnico');
      if (!motivo) { setGuardando(false); return; }
      const res = await api.startImpersonation(empresa.id, motivo);
      
      // Solo si no hay uno guardado ya. Esta pantalla sigue siendo accesible
      // mientras se suplanta —el token de suplantación lleva rol de
      // superadministrador—, así que entrar en una segunda agencia desde dentro
      // de la primera pisaba el token del superadministrador con el de la
      // suplantación en curso. Al salir se restauraba ese, que además caduca en
      // una hora, y no había forma de volver a ser uno mismo.
      const currentToken = localStorage.getItem('nexus_token');
      if (currentToken && !localStorage.getItem('nexus_original_token')) {
        localStorage.setItem('nexus_original_token', currentToken);
      }

      localStorage.setItem('nexus_token', res.token);
      localStorage.setItem('nexus_session_expiry', new Date(res.expiraAt).getTime().toString());
      window.location.href = '/';
    } catch (e: any) {
      setError(e.response?.data?.error?.message || e.message || 'No se pudo suplantar');
      setGuardando(false);
    }
  };

  const guardar = async () => {
    setGuardando(true); setError('');
    try {
      await api.updateCompany(empresa.id, {
        nombre: nombre.trim(),
        colorPrimario: colores.primario,
        colorAcento: colores.acento,
        colorRealce: colores.realce,
      });
      onGuardada();
    } catch (e: any) {
      setError(e.response?.data?.error?.message || e.message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={empresa.nombre}
      size="lg"
      footer={
        // Dos grupos, no cuatro botones sueltos con un `mr-auto` empujando el
        // primero a la izquierda: en la modal angosta el hueco no se notaba,
        // pero al ensancharla dejaba un vacío enorme en el medio. Así quedan
        // agrupados por lo que hacen —estado de la agencia a un lado, la
        // acción del formulario al otro— con un solo espacio entre los dos.
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {empresa.estado === 'activa' ? (
              <Button variant="outline" onClick={onSuspender} className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20">Suspender</Button>
            ) : (
              <Button
                variant="outline"
                onClick={async () => { await api.updateCompany(empresa.id, { estado: 'activa' }); onGuardada(); }}
              >
                Reactivar
              </Button>
            )}
            {empresa.estado === 'activa' && (
              <Button variant="outline" onClick={suplantar} className="hidden sm:flex text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                Entrar
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
            <Button onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* La franja detrás del logo lleva el propio color de la agencia: al
            abrir su ficha, lo primero que se ve es su marca, no un formulario
            gris igual al de cualquier otra. */}
        <div
          className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700"
          style={{ backgroundColor: `${colores.primario}0d` }}
        >
          <Marca empresa={{ nombre, logoUrl: logo, colorPrimario: colores.primario }} tamano={64} />
          <div className="min-w-0 flex-1">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <Upload size={15} />
              {subiendo ? 'Subiendo…' : logo ? 'Cambiar el logo' : 'Subir un logo'}
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.svg,.webp"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) subirLogo(f); e.target.value = ''; }}
              />
            </label>
            <p className="mt-1 text-xs text-accent">PNG, JPG, SVG o WEBP, hasta 2 MB.</p>
          </div>
        </div>

        {empresa.estado === 'activa' && (
          <div className="sm:hidden">
            <Button variant="outline" onClick={suplantar} className="w-full justify-center text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20">
              Entrar como Agencia
            </Button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nombre de la agencia" className="mb-0">
            <Input value={nombre} onChange={e => setNombre(e.target.value)} />
          </FormField>
          {/* Se muestra y no se edita: es por donde entra la agencia y por donde
              comparte enlaces. Cambiarlo rompería todos sus marcadores. */}
          <FormField label={<span className="flex items-center gap-1.5"><Link2 size={13} /> Dirección web</span>} className="mb-0">
            <div className="flex h-full items-center rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm font-medium text-primary dark:border-slate-700 dark:bg-slate-800/40 dark:text-white">
              /{empresa.slug}
            </div>
          </FormField>
        </div>

        <SelectorDeColores colores={colores} onChange={(clave, valor) => setColores(c => ({ ...c, [clave]: valor }))} />

        {empresa.uso && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/40">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
              <Users size={13} /> Uso de la agencia
            </h3>
            <dl className="mt-3 grid grid-cols-3 gap-4">
              <Cifra valor={empresa.uso.usuarios} que="usuarios" />
              <Cifra valor={empresa.uso.clientes} que="clientes" />
              <Cifra valor={empresa.uso.ventas} que="ventas" />
            </dl>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
