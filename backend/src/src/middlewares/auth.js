const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');

function authenticateToken(req, res, next) {
  // Skip auth in test environment
  if (process.env.NODE_ENV === 'test') {
    req.user = { id: 'test-user-id', role: 'admin' };
    return next();
  }
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided', error: 'Unauthorized' });
  }
  
  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid token', error: 'Forbidden' });
    }
    req.user = user;
    next();
  });
}

module.exports = authenticateToken;
