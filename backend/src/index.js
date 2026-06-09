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
  'https://itea-samturtravel.com',
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
    
    const isAllowed = cleanAllowedOrigins.includes(cleanOrigin) || 
                      cleanAllowedOrigins.includes('*') ||
                      cleanOrigin.endsWith('.vercel.app'); // Permite URLs de Vercel de producción y vistas previas
    
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
  max: 5,
  message: { success: false, error: { message: 'Demasiados intentos de login' } }
});
app.use('/api/auth/login', authLimiter);

// Parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Logging
if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rutas
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
