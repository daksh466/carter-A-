/**
 * Configuration file for backend
 * Loaded by modules in src/src/
 */

module.exports = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/carter-crm',
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  bcryptSaltRounds: 10,
  pdfStoragePath: process.env.PDF_STORAGE_PATH || './pdfs',
};
