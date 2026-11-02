require('dotenv').config();

// En producción un JWT_SECRET ausente firmaría con la clave por defecto, que está en el repo.
if (process.env.NODE_ENV === 'production') {
  const faltan = ['JWT_SECRET', 'FRONTEND_URL', 'DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((v) => !process.env[v]);
  if (faltan.length) {
    console.error(`[MISSING_ENV] Refusing to start in production without: ${faltan.join(', ')}`);
    process.exit(1);
  }
} else if (/^https:/.test(process.env.SUPABASE_URL || '') && !process.env.ALMACENAMIENTO_PREFIJO) {
  // Fuera de producción contra un Storage real, las carpetas de las agencias locales (1, 2…) serían las de las reales.
  console.error('[STORAGE_WITHOUT_PREFIX] Refusing to start outside production against a real Storage without ALMACENAMIENTO_PREFIJO.');
  process.exit(1);
}

const env = {
  port: parseInt(process.env.PORT, 10) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'nexus-jwt-secret-change-in-production',
  jwtExpiresIn: '1d',
  jwtRememberExpiresIn: '7d',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',
};

module.exports = env;
