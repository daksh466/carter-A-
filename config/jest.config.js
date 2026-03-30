module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 30000,
  transformIgnorePatterns: [
    'node_modules/(?!(uuid/)(?!rate-limiter-flexible/)(?!pdfkit/))'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
