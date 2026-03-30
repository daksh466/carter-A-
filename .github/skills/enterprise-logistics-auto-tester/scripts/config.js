/**
 * Enterprise Logistics Auto Tester - Configuration
 * Central constants, endpoints, and test parameters
 */

module.exports = {
  // API Configuration
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:5000/api',
    timeout: 15000,
    retryAttempts: 3,
    retryDelay: 1000, // ms, increases exponentially
  },

  // Frontend Configuration (Playwright)
  frontend: {
    baseUrl: process.env.FRONTEND_BASE_URL || 'http://localhost:5173',
    timeout: 30000,
    headless: process.env.HEADLESS !== 'false', // Set HEADLESS=false to see browser
  },

  // Database Configuration
  database: {
    mongoUri:
      process.env.MONGO_URI || 'mongodb://localhost:27017/logistics-test',
    resetBeforeEachRun: true,
    seedMinimalBase: true, // Seeds 5 empty stores if true
  },

  // Test Execution
  execution: {
    failFast: true, // Stop on first error
    runStressTest: true, // Run 2-3 iterations
    stressIterations: 3,
    verifyAfterEachAction: true,
  },

  // Test Data
  testData: {
    stores: ['Store_A', 'Store_B', 'Store_C', 'Store_D', 'Store_E'],
    machinesPerStore: 3,
    sparePartsCount: 10,
    spareParts: [
      { name: 'Bearing 6201 Small', category: 'Bearings' },
      { name: 'Bearing 6201 Large', category: 'Bearings' },
      { name: 'Sheet 5mm', category: 'Materials' },
      { name: 'Sheet 10mm', category: 'Materials' },
      { name: 'Bolt M10', category: 'Hardware' },
      { name: 'Bolt M12', category: 'Hardware' },
      { name: 'Gasket Type-A', category: 'Seals' },
      { name: 'Gasket Type-B', category: 'Seals' },
      { name: 'Filter Element', category: 'Filters' },
      { name: 'Chain Link', category: 'Chains' },
    ],
    inventory: {
      lowStock: { min: 1, max: 5 },
      normalStock: { min: 10, max: 30 },
      highStock: { min: 50, max: 100 },
    },
  },

  // Report Configuration
  reports: {
    outputDir: process.env.REPORT_DIR || './reports/test-results',
    includeMarkdown: true,
    includeJson: true,
    timestampFormat: 'YYYY-MM-DD_HH-mm-ss',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info', // error, warn, info, debug
    file: './reports/test-results/test.log',
    console: true,
  },

  // Timeouts (ms)
  timeouts: {
    apiCall: 10000,
    uiInteraction: 5000,
    pageLoad: 15000,
    formSubmit: 8000,
    databaseReset: 20000,
  },
};
