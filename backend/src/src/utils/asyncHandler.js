// asyncHandler: wraps async route handlers to catch errors and pass to next()
module.exports = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};