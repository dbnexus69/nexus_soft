const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const env = require('./config/env');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// Seguridad
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.frontendUrl, credentials: true }));

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
