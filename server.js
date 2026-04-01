// --- Imports ---
const express = require('express');
const dotenv = require('dotenv');
const { logger, httpLogger } = require('./src/utils/logger');
const sanitize = require('./src/middlewares/sanitize');
const validateEnv = require('./src/utils/envValidator');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const notFound = require('./src/middlewares/notFound');
const errorHandler = require('./src/middlewares/errorHandler');
const requestId = require('./src/middlewares/requestId');
const userRoutes = require('./backend/src/routes/userRoutes'); // TODO: verify exists
const storeOrdersRoutes = require('./backend/src/routes/storeOrdersRoutes');
const inventoryRoutes = require('./backend/src/routes/inventoryRoutes');
const machinesRoutes = require('./backend/src/routes/machinesRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const sparePartsRoutes = require('./backend/src/routes/sparePartsRoutes');
const serviceRoutes = require('./src/routes/serviceRoutes');
const connectionRoutes = require('./src/routes/connectionRoutes');
const healthRoutes = require('./src/routes/healthRoutes');
const alertRoutes = require('./backend/src/routes/alertRoutes');
const purchaseOrdersRoutes = require('./backend/src/routes/purchaseOrdersRoutes');
const transferRoutes = require('./backend/src/routes/transferRoutes');
const storeRoutes = require('./backend/src/routes/storeRoutes');
const Store = require('./backend/models/Store');
const connectDB = require('./config/db');
const fs = require('fs');
const path = require('path');

const normalizeStore = (storeDoc = {}) => {
  const store = storeDoc?.toObject ? storeDoc.toObject() : storeDoc;
  return {
    ...store,
    id: String(store._id || ''),
    state: store.state || store.address || '',
    storeHead: store.storeHead || store.name || '',
    contact: store.contact || store.phone || '',
    name: store.name || store.storeHead || '',
    address: store.address || store.state || '',
    phone: store.phone || store.contact || ''
  };
};

// Ensure logs directory exists
const logDir = path.join(__dirname, 'src', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}
dotenv.config();
// Validate environment variables
validateEnv(process.env);

const PORT = process.env.PORT || 5000;
const app = express();

// Ensure PDF storage directory exists
const pdfDir = path.join(__dirname, 'pdfs');
if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir);
}


app.use(helmet());
app.use(httpLogger);
app.use(cors());
app.use(express.json());
app.set('trust proxy', 1);
// Request ID for tracing
app.use(requestId);
// Input sanitization (XSS, NoSQL injection)
app.use(sanitize);

// Enhanced rate limiting (auth strict + API relaxed with env toggle)
const DISABLE_RATE_LIMIT = /^(1|true|yes|on)$/i.test(String(process.env.DISABLE_RATE_LIMIT || '').trim());
const AUTH_RATE_LIMIT_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX || 25);
const GENERAL_RATE_LIMIT_MAX = Number(process.env.GENERAL_RATE_LIMIT_MAX || 1200);

const limiter429Handler = (req, res) => {
  return res.status(429).json({
    success: false,
    message: 'Server busy, try again shortly'
  });
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limiter429Handler,
  skip: () => DISABLE_RATE_LIMIT
});

const relaxedRoutes = ['/api/stores', '/api/orders', '/api/inventory', '/api/alerts'];

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: GENERAL_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limiter429Handler,
  skip: (req) => {
    if (DISABLE_RATE_LIMIT) return true;
    const requestPath = String(req.path || req.originalUrl || '');
    return relaxedRoutes.some((prefix) => requestPath.startsWith(prefix));
  }
});

app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);
app.use('/api', generalLimiter);



// Register all routes
app.use('/api/health', healthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', storeOrdersRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/machines', machinesRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/spares', sparePartsRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/purchase-orders', purchaseOrdersRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/stores', storeRoutes);
app.get('/api/test', (req, res) => {
  res.status(200).json({
    message: 'API + DB Connected Successfully'
  });
});

// Error handling middleware (after routes)
app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Server failed to start due to database connection error', err);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

// --- Export app for Jest compatibility ---
module.exports = app;
