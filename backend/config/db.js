const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const ensureIndexes = async () => {
  try {
    const SparePart = require('../src/models/SparePart');
    const Transfer = require('../src/models/Transfer');

    await Promise.all([
      SparePart.createIndexes(),
      Transfer.createIndexes()
    ]);

    console.log('MongoDB indexes ensured for SparePart and Transfer');
  } catch (error) {
    console.warn('Index bootstrap warning:', error.message);
  }
};

const connectDB = async () => {
  const mongoUri = process.env.DB_URI || process.env.MONGO_URI;

  if (!mongoUri) {
    console.warn('MongoDB connection skipped: DB_URI/MONGO_URI is not set. API will run in degraded mode.');
    return false;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected');
    await ensureIndexes();
    return true;
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    console.warn('Continuing without MongoDB. API will run in degraded mode.');
    return false;
  }
};

module.exports = connectDB;
