import { useEffect, useRef, useState } from 'react';
import { Building2, Eye, Plus, Trash2, ArrowUp, ArrowDown, Upload, RotateCcw, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { FormField, Input, Textarea } from '../components/ui/Form';
import { SelectorDeColores } from '../components/empresa/SelectorDeColores';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as api from '../api';
import type { PerfilEmpresa, CambiosPerfil, Clausula } from '../api';

/**
 * Mi empresa (spec 011): el perfil de la agencia, que ve cualquiera de ella, y su configuración, que solo edita su
 * admin. Lo que se configura aquí es lo que sale en el voucher que recibe el cliente; la vista previa es el PDF real
 * que genera el servidor con lo que hay en el formulario, sin guardarlo.
 */

const COLORES_POR_DEFECTO = { primario: '#1e293b', acento: '#2563eb', realce: '#f59e0b' };
const CAMPOS: Array<[keyof CambiosPerfil, string, string?]> = [
  ['nombreComercial', 'Nombre comercial'],
  ['nit', 'NIT', '900123456'],
  ['direccion', 'Dirección'],
  ['telefono', 'Teléfono', '+57 300 123 4567'],
  ['emailContacto', 'Correo de contacto', 'reservas@agencia.com'],
  ['sitioWeb', 'Sitio web', 'https://agencia.com'],
];

type Formulario = Record<'nombreComercial' | 'nit' | 'direccion' | 'telefono' | 'emailContacto' | 'sitioWeb' | 'voucherPie', string> & {
  colores: typeof COLORES_POR_DEFECTO;
  terminos: Clausula[] | null;
};

const aFormulario = (p: PerfilEmpresa): Formulario => ({
  nombreComercial: p.nombreComercial ?? '', nit: p.nit ?? '', direccion: p.direccion ?? '', telefono: p.telefono ?? '',
  emailContacto: p.emailContacto ?? '', sitioWeb: p.sitioWeb ?? '', voucherPie: p.voucherPie ?? '',
  colores: {
    primario: p.colorPrimario ?? COLORES_POR_DEFECTO.primario,
    acento: p.colorAcento ?? COLORES_POR_DEFECTO.acento,
    realce: p.colorRealce ?? COLORES_POR_DEFECTO.realce,
  },
  terminos: p.voucherTerminos,
});

const aCambios = (f: Formulario): CambiosPerfil => ({
  nombreComercial: f.nombreComercial, nit: f.nit, direccion: f.direccion, telefono: f.telefono,
  emailContacto: f.emailContacto, sitioWeb: f.sitioWeb, voucherPie: f.voucherPie,
  colorPrimario: f.colores.primario, colorAcento: f.colores.acento, colorRealce: f.colores.realce,
  voucherTerminos: f.terminos,
});

/** Los errores 422 por campo; los de una cláusula (`voucherTerminos.2.texto`) se juntan en `voucherTerminos`. */
function erroresDe(err: any): Record<string, string> {
  const detalles: Array<{ field: string; message: string }> = err?.response?.data?.error?.details || [];
  const out: Record<string, string> = {};
  for (const d of detalles) {
    const [campo, i, sub] = d.field.split('.');
    out[campo] = out[campo] || (i !== undefined ? `Cláusula ${Number(i) + 1}${sub ? ` (${sub})` : ''}: ${d.message}` : d.message);
  }
  return out;
}

export default function Empresa() {
  const { user, refrescarMarca } = useAuth();
  const toast = useToast();
  const puedeEditar = user?.role === 'admin' || user?.role === 'superadmin';
  const [pestana, setPestana] = useState<'perfil' | 'configuracion'>('perfil');
  const [perfil, setPerfil] = useState<PerfilEmpresa | null>(null);
  const [form, setForm] = useState<Formulario | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [previa, setPrevia] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const urlPrevia = useRef<string | null>(null);

  useEffect(() => {
    api.getCompanyProfile()
      .then(p => { setPerfil(p); setForm(aFormulario(p)); })
      .catch(() => toast.error('No se pudo cargar el perfil de la empresa'));
    return () => { if (urlPrevia.current) URL.revokeObjectURL(urlPrevia.current); };
  }, []);

  if (!perfil || !form) {
    return <div className="flex justify-center py-20 text-slate-500"><Loader2 className="animate-spin" aria-label="Cargando" /></div>;
  }

  const poner = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => {
    setForm(f => (f ? { ...f, [campo]: valor } : f));
    setErrores(e => ({ ...e, [campo === 'terminos' ? 'voucherTerminos' : campo]: '' }));
  };
  const terminos = form.terminos ?? [];
  const ponerClausula = (i: number, cambio: Partial<Clausula>) =>
    poner('terminos', terminos.map((c, j) => (j === i ? { ...c, ...cambio } : c)));
  const mover = (i: number, d: -1 | 1) => {
    const lista = [...terminos];
    [lista[i], lista[i + d]] = [lista[i + d], lista[i]];
    poner('terminos', lista);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const p = await api.updateCompanyProfile(aCambios(form));
      setPerfil(p); setForm(aFormulario(p)); setErrores({});
      await refrescarMarca();
      toast.success('Cambios guardados');
    } catch (err) {
      setErrores(erroresDe(err));
      toast.error((err as any)?.response?.data?.error?.message || 'No se pudieron guardar los cambios');
    } finally {
      setGuardando(false);
    }
  };

  const subirLogo = async (archivo: File) => {
    setSubiendo(true);
    try {
      const p = await api.uploadCompanyProfileLogo(archivo);
      setPerfil(p);
      await refrescarMarca();
      toast.success('Logo actualizado');
    } catch (err) {
      toast.error((err as any)?.response?.data?.error?.message || 'No se pudo subir el logo');
    } finally {
      setSubiendo(false);
    }
  };

  const verPrevia = async () => {
    setGenerando(true);
    try {
      const pdf = await api.previewVoucher(aCambios(form));
      if (urlPrevia.current) URL.revokeObjectURL(urlPrevia.current);
      urlPrevia.current = URL.createObjectURL(pdf);
      setPrevia(urlPrevia.current);
      setErrores({});
    } catch (err) {
      // El error de un blob viene como blob: se lee para pintar cada campo.
      const cuerpo = (err as any)?.response?.data;
      const json = cuerpo instanceof Blob ? JSON.parse(await cuerpo.text()) : cuerpo;
      setErrores(erroresDe({ response: { data: json } }));
      toast.error(json?.error?.message || 'No se pudo generar la vista previa');
    } finally {
      setGenerando(false);
    }
  };

  const datos: Array<[string, string | null]> = [
    ['NIT', perfil.nit], ['Dirección', perfil.direccion], ['Teléfono', perfil.telefono],
    ['Correo de contacto', perfil.emailContacto], ['Sitio web', perfil.sitioWeb],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-primary dark:text-white"><Building2 size={24} /> Mi empresa</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Los datos de la agencia y cómo se ve el voucher que recibe el cliente.</p>
        </div>
        {puedeEditar && (
          <div role="tablist" className="flex w-fit gap-1 rounded-xl border border-gray-border bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
            {(['perfil', 'configuracion'] as const).map(p => (
              <button key={p} role="tab" aria-selected={pestana === p} onClick={() => setPestana(p)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${pestana === p ? 'bg-primary text-white' : 'text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                {p === 'perfil' ? 'Perfil' : 'Configuración'}
              </button>
            ))}
          </div>
        )}
      </div>

      {pestana === 'perfil' || !puedeEditar ? (
        <Card>
          <CardBody className="space-y-6">
            <div className="flex items-center gap-4">
              {perfil.logoUrl
                ? <img src={perfil.logoUrl} alt={`Logo de ${perfil.nombreComercial || perfil.nombre}`} className="h-16 w-auto max-w-[160px] object-contain" />
                : <div className="flex h-16 w-16 items-center justify-center rounded-xl text-xl font-bold text-white" style={{ backgroundColor: form.colores.primario }} aria-hidden>{(perfil.nombreComercial || perfil.nombre).charAt(0)}</div>}
              <div>
                <p className="text-lg font-bold text-primary dark:text-white">{perfil.nombreComercial || perfil.nombre}</p>
                {perfil.nombreComercial && <p className="text-sm text-slate-500">{perfil.nombre}</p>}
              </div>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              {datos.map(([etiqueta, valor]) => (
                <div key={etiqueta}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{etiqueta}</dt>
                  <dd className="text-sm text-slate-800 dark:text-slate-200">{valor || <span className="text-slate-500">Sin registrar</span>}</dd>
                </div>
              ))}
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Colores de la marca</dt>
                <dd className="mt-1 flex gap-2">
                  {Object.entries(form.colores).map(([k, c]) => <span key={k} title={c} className="h-6 w-6 rounded-full ring-1 ring-slate-200" style={{ backgroundColor: c }} />)}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader>Datos de la empresa</CardHeader>
              <CardBody className="grid gap-x-4 sm:grid-cols-2">
                {CAMPOS.map(([campo, etiqueta, ejemplo]) => (
                  <FormField key={campo} label={etiqueta} error={errores[campo]}>
                    <Input value={form[campo as keyof Formulario] as string} placeholder={ejemplo}
                      onChange={e => poner(campo as keyof Formulario, e.target.value as never)} />
                  </FormField>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>Logo y colores</CardHeader>
              <CardBody className="space-y-5">
                <div className="flex items-center gap-4">
                  {perfil.logoUrl && <img src={perfil.logoUrl} alt="Logo actual" className="h-12 w-auto max-w-[140px] object-contain" />}
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-border px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800">
                    {subiendo ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {perfil.logoUrl ? 'Cambiar logo' : 'Subir logo'}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={subiendo}
                      onChange={e => { const f = e.target.files?.[0]; if (f) subirLogo(f); e.target.value = ''; }} />
                  </label>
                  <span className="text-xs text-slate-500">PNG, JPG o WebP, hasta 2 MB.</span>
                </div>
                <SelectorDeColores colores={form.colores} onChange={(clave, valor) => poner('colores', { ...form.colores, [clave]: valor })} />
                {(errores.colorPrimario || errores.colorAcento || errores.colorRealce) && (
                  <p className="text-xs text-red-600" role="alert">{errores.colorPrimario || errores.colorAcento || errores.colorRealce}</p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader actions={form.terminos !== null && (
                <Button variant="outline" size="sm" onClick={() => poner('terminos', null)}><RotateCcw size={14} /> Usar los de por defecto</Button>
              )}>Términos y condiciones</CardHeader>
              <CardBody className="space-y-4">
                {form.terminos === null ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-500">El voucher lleva los términos por defecto de la aplicación (presentación, documentación, check-in, responsabilidad).</p>
                    <Button variant="outline" size="sm" onClick={() => poner('terminos', [{ titulo: '', texto: '' }])}><Plus size={14} /> Escribir los míos</Button>
                  </div>
                ) : (
                  <>
                    {terminos.map((c, i) => (
                      <fieldset key={i} className="space-y-2 rounded-xl border border-gray-border p-3 dark:border-slate-700">
                        <legend className="px-1 text-xs font-semibold text-slate-500">Cláusula {i + 1}</legend>
                        <FormField label="Título">
                          <Input value={c.titulo} maxLength={80} onChange={e => ponerClausula(i, { titulo: e.target.value })} />
                        </FormField>
                        <FormField label="Texto">
                          <Textarea value={c.texto} maxLength={600} rows={3} onChange={e => ponerClausula(i, { texto: e.target.value })} />
                        </FormField>
                        <div className="flex justify-end gap-1">
                          <Button variant="outline" size="sm" aria-label={`Subir la cláusula ${i + 1}`} disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUp size={14} /></Button>
                          <Button variant="outline" size="sm" aria-label={`Bajar la cláusula ${i + 1}`} disabled={i === terminos.length - 1} onClick={() => mover(i, 1)}><ArrowDown size={14} /></Button>
                          <Button variant="outline" size="sm" aria-label={`Quitar la cláusula ${i + 1}`} onClick={() => poner('terminos', terminos.filter((_, j) => j !== i))}><Trash2 size={14} /></Button>
                        </div>
                      </fieldset>
                    ))}
                    {terminos.length < 15 && (
                      <Button variant="outline" size="sm" onClick={() => poner('terminos', [...terminos, { titulo: '', texto: '' }])}><Plus size={14} /> Añadir cláusula</Button>
                    )}
                  </>
                )}
                {errores.voucherTerminos && <p className="text-xs text-red-600" role="alert">{errores.voucherTerminos}</p>}
                <FormField label="Pie del voucher" error={errores.voucherPie}>
                  <Input value={form.voucherPie} maxLength={300} placeholder="Gracias por viajar con nosotros" onChange={e => poner('voucherPie', e.target.value)} />
                </FormField>
              </CardBody>
            </Card>

            <div className="flex justify-end">
              <Button onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</Button>
            </div>
          </div>

          <Card className="xl:sticky xl:top-4 xl:self-start">
            {/* El botón vive junto a la vista previa: abajo del formulario largo quedaba fuera de la pantalla. */}
            <CardHeader actions={
              <Button size="sm" variant="outline" onClick={verPrevia} disabled={generando}>
                {generando ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} {previa ? 'Actualizar' : 'Ver vista previa'}
              </Button>
            }>Vista previa del voucher</CardHeader>
            <CardBody>
              {previa
                ? <iframe title="Vista previa del voucher" src={previa} className="h-[75vh] w-full rounded-lg border border-gray-border dark:border-slate-700" />
                : (
                  <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-slate-500">
                    <p>Mira cómo queda el voucher con los cambios, antes de guardarlos.</p>
                    <Button onClick={verPrevia} disabled={generando}>
                      {generando ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />} Ver vista previa
                    </Button>
                  </div>
                )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
