const config = require('../config');
const logger = require('../utils/logger');

// Middleware para errores no capturados
function errorHandler(err, req, res, next) {
  logger.error('Error no manejado:', err);

  const mensaje = config.isProduction
    ? 'Error interno del servidor'
    : err.message;

  res.status(err.status || 500).json({
    error: mensaje,
    ...(config.isProduction ? {} : { stack: err.stack })
  });
}

// Ruta 404 para APIs
function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Endpoint no encontrado' });
}

module.exports = { errorHandler, notFoundHandler };
