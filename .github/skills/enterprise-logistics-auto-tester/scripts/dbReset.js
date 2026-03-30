/**
 * Database Reset Utility
 * Clears test data and optionally seeds minimal base data
 */

const mongoose = require('mongoose');
const config = require('./config');
const logger = require('./logger');

class DatabaseReset {
  constructor() {
    this.mongoUri = config.database.mongoUri;
    this.connected = false;
  }

  /**
   * Connect to MongoDB
   */
  async connect() {
    if (this.connected) {
      return;
    }

    try {
      logger.info(`Connecting to MongoDB at ${this.mongoUri}...`);
      await mongoose.connect(this.mongoUri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
      });
      this.connected = true;
      logger.info('✓ Connected to MongoDB');
    } catch (error) {
      logger.error(
        `✗ Failed to connect to MongoDB: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    if (!this.connected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.connected = false;
      logger.info('✓ Disconnected from MongoDB');
    } catch (error) {
      logger.warn(`Warning: Failed to gracefully disconnect: ${error.message}`);
    }
  }

  /**
   * Clear all collections
   */
  async clearDatabase() {
    try {
      logger.info('Clearing all collections...');
      const collections = mongoose.connection.collections;

      for (const name in collections) {
        const collection = collections[name];
        await collection.deleteMany({});
        logger.debug(`✓ Cleared collection: ${name}`);
      }

      logger.info('✓ Database cleared');
    } catch (error) {
      logger.error(`✗ Failed to clear database: ${error.message}`);
      throw error;
    }
  }

  /**
   * Seed minimal base data (5 empty stores)
   */
  async seedMinimalBase() {
    try {
      logger.info('Seeding minimal base data...');

      const Store = mongoose.model('Store', {
        name: String,
        location: String,
        createdAt: { type: Date, default: Date.now },
      });

      const stores = config.testData.stores.map((name) => ({
        name,
        location: name.toLowerCase(),
      }));

      const result = await Store.insertMany(stores);
      logger.info(`✓ Seeded ${result.length} stores`);

      return result;
    } catch (error) {
      logger.error(`✗ Failed to seed minimal base data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reset database: clear + optionally seed
   */
  async reset(seed = config.database.seedMinimalBase) {
    try {
      await this.connect();
      await this.clearDatabase();

      if (seed) {
        await this.seedMinimalBase();
      }

      logger.info('✓ Database reset complete');
    } catch (error) {
      logger.error(`✗ Database reset failed: ${error.message}`);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

module.exports = DatabaseReset;
