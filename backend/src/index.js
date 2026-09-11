const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// Seguridad
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Configuración dinámica de CORS para soportar producción y desarrollo local
const allowedOrigins = [
  env.frontendUrl,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir solicitudes sin origen (como curl, postman o apps de celular)
    if (!origin) return callback(null, true);
    
    // Normalizar eliminando barras diagonales al final (trailing slashes)
    const cleanOrigin = origin.replace(/\/$/, '');
    const cleanAllowedOrigins = allowedOrigins.map(url => url.replace(/\/$/, ''));
    
    // Se retiró el comodín `.endsWith('.vercel.app')`.
    //
    // Con `credentials: true`, ese comodín dejaba que CUALQUIER sitio
    // alojado en vercel.app —no solo los nuestros— hiciera peticiones
    // autenticadas desde el navegador de un usuario con la sesión abierta.
    // Cuando haya un dominio de despliegue, va en FRONTEND_URL, explícito.
    const isAllowed = cleanAllowedOrigins.includes(cleanOrigin) ||
                      cleanAllowedOrigins.includes('*');
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS. Origen: ' + origin));
    }
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  message: { success: false, error: { message: 'Demasiadas solicitudes, intente de nuevo' } }
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  // Cinco por minuto y por IP. Configurable porque una oficina entera sale por
  // la misma IP y cinco intentos entre todos es poco, y porque las pruebas de
  // estos endpoints necesitan más de cinco peticiones seguidas.
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 5,
  message: { success: false, error: { message: 'Demasiados intentos, espera un minuto' } }
});
// El límite estrecho es para todo lo que prueba credenciales, no solo el login:
// `verify-code` y `reset-password` comprueban un código de seis cifras, y con
// el límite general de 1000 por minuto se recorren en pocos minutos. Y
// `forgot-password` manda un correo por petición, así que sin límite es un
// generador de correo para cualquiera.
// Los dos prefijos, /api y /api/v1: montar el limitador solo en uno dejaría el
// otro como puerta abierta para probar contraseñas y códigos sin freno.
for (const ruta of ['login', 'forgot-password', 'verify-code', 'reset-password']) {
  app.use([`/api/auth/${ruta}`, `/api/v1/auth/${ruta}`], authLimiter);
}

// Parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Logging
if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Archivos estáticos
// Los logos son marca pública y los carga una etiqueta <img>, que no manda
// cabeceras de sesión: se sirven estáticos. El resto —vouchers y documentos de
// check-in— pasa por una ruta que comprueba que el fichero sea de tu agencia.
app.use('/uploads/logos', express.static(path.join(__dirname, '../uploads/logos')));
app.use('/uploads', require('./routes/uploads.routes'));

// Rutas
// La API se sirve en /api/v1 y en /api.
//
// No estaba versionada: cualquier cambio incompatible —el que hizo falta en
// PUT /sales/:id, por ejemplo, que ya no acepta el total ni el estado— rompe a
// la vez a todos los clientes, sin forma de fijar una versión. /api/v1 es el
// camino nuevo; /api se mantiene como alias del actual para no romper nada de
// lo que ya hay desplegado, y el frontend apunta ya a /api/v1.
app.use('/api/v1', routes);
app.use('/api', routes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } });
});

// Error handler
app.use(errorHandler);

// Iniciar servidor
app.listen(env.port, () => {
  console.log(`🚀 Servidor corriendo en puerto ${env.port}`);
  console.log(`🌐 Frontend URL: ${env.frontendUrl}`);
  console.log(`⚙️  Modo: ${env.nodeEnv}`);
});
