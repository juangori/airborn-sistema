const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  isProduction,
  port: process.env.PORT || 3000,

  // Paths
  DATOS_DIR: './datos',
  BACKUPS_DIR: path.join('./datos', 'backups'),
  USUARIOS_DB: path.join('./datos', 'usuarios.db'),
  CONFIG_FILE: './config.json',

  // Sesión
  session: {
    secret: process.env.SESSION_SECRET || 'dev_secret_cambiar_en_prod',
    cookie: {
      secure: isProduction,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
  },

  // CORS
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:5000'],

  // Rate limiting
  rateLimit: {
    general: {
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 1000
    },
    login: {
      windowMs: 15 * 60 * 1000,
      max: 5
    }
  }
};
