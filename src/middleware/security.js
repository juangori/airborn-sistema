const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const config = require('../config');

// Helmet - Headers de seguridad
const helmetMiddleware = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
});

// CORS configurado
const corsMiddleware = cors({
  credentials: true,
  origin: config.isProduction
    ? (origin, callback) => {
        if (!origin || config.allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('No permitido por CORS'));
        }
      }
    : true
});

// Rate limiting general
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.general.windowMs,
  max: config.rateLimit.general.max,
  message: { error: 'Demasiadas solicitudes, intentá más tarde' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting para login (anti brute-force)
const loginLimiter = rateLimit({
  windowMs: config.rateLimit.login.windowMs,
  max: config.rateLimit.login.max,
  message: { error: 'Demasiados intentos de login. Esperá 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

module.exports = {
  helmetMiddleware,
  corsMiddleware,
  generalLimiter,
  loginLimiter
};
