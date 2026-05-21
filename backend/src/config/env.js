require('dotenv').config();

const env = {
  port: parseInt(process.env.PORT, 10) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'itea-jwt-secret-change-in-production',
  jwtExpiresIn: '30m',
  jwtRememberExpiresIn: '7d',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',
};

module.exports = env;
