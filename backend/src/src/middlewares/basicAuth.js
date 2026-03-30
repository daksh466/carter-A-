function basicAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ success: false, message: 'Missing Basic Auth', error: 'Unauthorized' });
  }
  // Add your basic auth logic here (decode, validate user/pass)
  next();
}

module.exports = basicAuth;
