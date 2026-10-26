'use strict';

// Доступ лише для адміністратора; використовується після requireAuth
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    const err = new Error('Доступ лише для адміністратора');
    err.status = 403;
    return next(err);
  }
  next();
}

module.exports = requireAdmin;