/**
 * Database Reset Utility
 * Clears logistics data and optionally seeds minimal base structure
 */

const mongoose = require('mongoose');

const DB_CONNECTION_STRING = process.env.DB_CONNECTION_STRING || process.env.MONGO_URI || 'mongodb://localhost:27017/logistics-test';

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    await mongoose.connect(DB_CONNECTION_STRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✓ Connected to MongoDB:', DB_CONNECTION_STRING);
  } catch (error) {
    console.error('✗ Failed to connect to MongoDB:', error.message);
    throw error;
  }
}

/**
 * Disconnect from MongoDB
 */
async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
  } catch (error) {
    console.error('✗ Failed to disconnect:', error.message);
  }
}

/**
 * CLEAR ALL DATA
 * Drops all collections in the logistics database
 */
async function clearAllData() {
  try {
    const collections = Object.keys(mongoose.connection.collections);
    console.log(`Clearing ${collections.length} collections...`);
    
    for (const collectionName of collections) {
      const collection = mongoose.connection.collections[collectionName];
      await collection.deleteMany({});
      console.log(`  ✓ Cleared ${collectionName}`);
    }
    console.log('✓ All data cleared');
  } catch (error) {
    console.error('✗ Failed to clear data:', error.message);
    throw error;
  }
}

/**
 * RESET DATABASE
 * 1. Kill existing connections
 * 2. Drop database (cleanest approach)
 * 3. Recreate via schema validation (optional)
 */
async function resetDatabase() {
  try {
    console.log('🔄 Resetting database...');
    
    // Approach 1: Drop entire database (cleanest for test environment)
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
      console.log('✓ Database dropped and reset');
    } else {
      // Fallback: Clear collections
      await clearAllData();
    }
  } catch (error) {
    console.error('✗ Failed to reset database:', error.message);
    throw error;
  }
}

/**
 * VERIFY DATABASE STATE
 * Check if database is clean (empty)
 */
async function verifyDatabaseClean() {
  try {
    const collections = Object.keys(mongoose.connection.collections);
    let totalDocuments = 0;

    for (const collectionName of collections) {
      const collection = mongoose.connection.collections[collectionName];
      const count = await collection.countDocuments();
      if (count > 0) {
        console.warn(`  ⚠ Collection ${collectionName} has ${count} documents`);
      }
      totalDocuments += count;
    }

    if (totalDocuments === 0) {
      console.log('✓ Database is clean (empty)');
      return true;
    } else {
      console.warn(`⚠ Database has ${totalDocuments} documents remaining`);
      return false;
    }
  } catch (error) {
    console.error('✗ Failed to verify database:', error.message);
    throw error;
  }
}

/**
 * FULL RESET WORKFLOW
 * 1. Connect
 * 2. Drop database
 * 3. Verify clean
 * 4. Disconnect
 */
async function fullReset() {
  try {
    console.log('='.repeat(60));
    console.log('DATABASE RESET WORKFLOW');
    console.log('='.repeat(60));

    await connectDB();
    await resetDatabase();
    const isClean = await verifyDatabaseClean();
    await disconnectDB();

    if (isClean) {
      console.log('\n✓ Full reset complete. Database ready for testing.\n');
      return true;
    } else {
      console.warn('\n⚠ Reset completed, but database has residual documents.\n');
      return false;
    }
  } catch (error) {
    console.error('\n✗ Reset workflow failed:', error.message);
    throw error;
  }
}

/**
 * CLI INVOCATION
 * node db-reset.js [--verify-only]
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--verify-only')) {
    (async () => {
      try {
        await connectDB();
        const isClean = await verifyDatabaseClean();
        await disconnectDB();
        process.exit(isClean ? 0 : 1);
      } catch (error) {
        console.error(error.message);
        process.exit(1);
      }
    })();
  } else {
    (async () => {
      try {
        const success = await fullReset();
        process.exit(success ? 0 : 1);
      } catch (error) {
        console.error(error.message);
        process.exit(1);
      }
    })();
  }
}

module.exports = {
  connectDB,
  disconnectDB,
  clearAllData,
  resetDatabase,
  verifyDatabaseClean,
  fullReset,
};
