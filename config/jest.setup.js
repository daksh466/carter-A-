// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/carter-test';

const mongoose = require('mongoose');

// Increase test timeout
jest.setTimeout(30000);

// Connect to MongoDB if not already connected
if (mongoose.connection.readyState === 0) {
  // Connection not established, attempt to connect
  mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000
  }).catch(err => {
    console.warn('MongoDB connection warning:', err.message);
    // Don't exit, just warn - tests can handle MongoDB unavailability
  });
}


