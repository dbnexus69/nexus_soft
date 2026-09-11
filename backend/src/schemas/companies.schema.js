const { z } = require('zod');

/**
 * Alta y edición de una agencia cliente.
 *
 * El slug es lo único con reglas de verdad: va en la URL del navegador, así que
 * no puede parecerse a una sección de la aplicación. Si una agencia se llamara
 * `sales`, `app.com/sales` dejaría de tener un significado único.
 */

/**
 * Palabras que no pueden ser slug.
 *
 * Las nueve primeras son las rutas que hoy declara `App.tsx`; las otras, caminos
 * del servidor. Está aquí y no en el frontend porque quien crea la empresa es el
 * backend: si la lista viviera en la interfaz, bastaría una llamada directa al
 * API para colarse.
 */
const SLUGS_RESERVADOS = new Set([
  'login', 'sales', 'clients', 'users', 'config', 'commissions', 'flights',
  'stats', 'itineraries', 'responsables', 'dashboard',
  'api', 'uploads', 'assets', 'admin', 'public', 'static', 'health',
]);

const slug = z.string()
  .trim()
  .toLowerCase()
  .min(3, 'Mínimo 3 caracteres')
  .max(40, 'Máximo 40 caracteres')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones entre medias')
  .refine(v => !SLUGS_RESERVADOS.has(v), v => ({
    message: `"${v}" es una sección de la aplicación y no puede ser el identificador de una empresa`,
  }));

/** Color de marca en hexadecimal, que es lo que devuelve un selector de color. */
const color = z.string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Debe ser un color hexadecimal, por ejemplo #2B2D42')
  .nullable()
  .optional();

const marca = {
  nombre: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120),
  nombreComercial: z.string().trim().max(120).nullable().optional(),
  colorPrimario: color,
  colorAcento: color,
  colorRealce: color,
  emailRemitente: z.string().trim().email('No parece un correo válido').max(180).nullable().optional(),
  emailNombre: z.string().trim().max(120).nullable().optional(),
};

/**
 * Al crear una agencia se crea también su primer administrador.
 *
 * Una empresa sin nadie que pueda entrar no sirve de nada, y dejarlo para un
 * segundo paso obliga al superadministrador a suplantar para poder crear al
 * primer usuario. Se hace de una vez, en la misma transacción.
 */
const createCompanySchema = z.object({
  ...marca,
  slug,
  admin: z.object({
    firstName: z.string().trim().min(2).max(60),
    lastName: z.string().trim().min(2).max(60),
    email: z.string().trim().toLowerCase().email('No parece un correo válido').max(180),
    password: z.string()
      .min(8, 'Mínimo 8 caracteres')
      .max(200)
      .regex(/[a-z]/, 'Debe llevar una minúscula')
      .regex(/[A-Z]/, 'Debe llevar una mayúscula')
      .regex(/\d/, 'Debe llevar un número')
      .regex(/[^A-Za-z0-9]/, 'Debe llevar un carácter especial'),
  }),
}).strict();

/**
 * La edición es parcial de verdad: PATCH, y solo lo que llegue.
 *
 * El slug no se puede cambiar. Es la dirección por la que la agencia entra y por
 * la que comparte enlaces; cambiarlo rompe todos los marcadores de golpe. Si
 * algún día hace falta, será una operación propia con su redirección, no un
 * campo más de un formulario.
 */
const updateCompanySchema = z.object({
  ...marca,
  nombre: marca.nombre.optional(),
  estado: z.enum(['activa', 'suspendida']).optional(),
}).strict().refine(o => Object.keys(o).length > 0, 'No se envió ningún campo que editar');

/**
 * Entrar en una agencia exige decir para qué.
 *
 * El motivo no es burocracia: es lo que convierte el registro en algo que sirve
 * para rendir cuentas. "Revisando" no explica nada, así que se pide una frase.
 */
const suplantacionSchema = z.object({
  motivo: z.string().trim().min(10, 'Explica en una frase para qué necesitas entrar').max(300),
}).strict();

module.exports = { createCompanySchema, updateCompanySchema, suplantacionSchema, SLUGS_RESERVADOS };
