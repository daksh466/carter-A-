function notFound(req, res, next) {
  res.status(404).json({ success: false, message: 'API endpoint not found', error: 'Not Found' });
}

module.exports = notFound;
