// Middleware de autenticación

function requireAuth(obtenerDbUsuario) {
  return (req, res, next) => {
    if (req.session && req.session.usuario) {
      req.db = obtenerDbUsuario(req.session.usuario);
      return next();
    }
    return res.status(401).json({ error: 'No autenticado' });
  };
}

module.exports = { requireAuth };
