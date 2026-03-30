const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');

// XSS sanitization middleware
const xssSanitizer = (req, res, next) => {
  const sanitizeObject = (obj) => {
    if (!obj) return obj;
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = xss(obj[key]);
      } else if (typeof obj[key] === 'object') {
        sanitizeObject(obj[key]);
      }
    }
    return obj;
  };
  
  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  
  next();
};

module.exports = [
  mongoSanitize(),
  xssSanitizer
];