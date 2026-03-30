exports.healthCheck = (req, res) => {
  res.status(200).json({ success: true, message: 'API is healthy' });
};
