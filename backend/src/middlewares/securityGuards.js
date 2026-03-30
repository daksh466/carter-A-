const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { jwtSecret } = require('../config');

const isProduction = () => String(process.env.NODE_ENV || '').toLowerCase() === 'production';
const allowUnsafeBypass = () => {
  if (isProduction()) return false;
  const raw = String(process.env.ALLOW_UNSAFE_DESTRUCTIVE_AUTH_BYPASS || 'true').trim().toLowerCase();
  return !(raw === 'false' || raw === '0' || raw === 'no');
};

const logSecurityEvent = (level, message, meta = {}) => {
  const payload = {
    at: new Date().toISOString(),
    ...meta
  };
  if (level === 'error') {
    console.error(message, payload);
    return;
  }
  console.warn(message, payload);
};

const parseBearerToken = (req) => {
  const authHeader = req.headers?.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return '';
  return authHeader.slice(7).trim();
};

const requireDestructiveAuth = (req, res, next) => {
  const token = parseBearerToken(req);

  if (!token) {
    if (allowUnsafeBypass()) {
      req.user = req.user || { id: 'dev-unsafe-user', role: 'developer' };
      logSecurityEvent(
        'warn',
        'Destructive route accessed without token using explicit unsafe bypass',
        { method: req.method, path: req.originalUrl }
      );
      return next();
    }

    return res.status(401).json({
      success: false,
      message: 'Authorization token is required for destructive actions'
    });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;

    console.log('Destructive action authorized', {
      at: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      userId: decoded?.id || decoded?.sub || 'unknown'
    });

    return next();
  } catch (error) {
    logSecurityEvent('error', 'Invalid token for destructive action', {
      method: req.method,
      path: req.originalUrl,
      error: error.message
    });

    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authorization token'
    });
  }
};

const requireDbConnected = (req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    return next();
  }

  console.error('Critical write blocked: database disconnected', {
    at: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl
  });

  return res.status(503).json({
    success: false,
    message: 'Database is unavailable. Write operations are temporarily disabled.'
  });
};

module.exports = {
  requireDestructiveAuth,
  requireDbConnected
};
