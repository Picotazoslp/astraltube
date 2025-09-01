/**
 * AstralTube v3 - Jest Configuration
 * Comprehensive testing setup for Chrome extension with mocks and coverage
 */

module.exports = {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup-simple.js'
  ],
  
  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/src/**/*.test.js'
  ],
  
  // Test file ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
  
  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // Transform files
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/lib/vendor/**',
    '!src/**/*.config.js'
  ],
  
  // Coverage thresholds (lowered for initial setup)
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 10,
      lines: 10,
      statements: 10
    }
  },
  
  // Coverage reporting
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],
  
  // Extension testing globals (mocks are set up in setup.js)
  globals: {
    __DEV__: false,
    __TEST__: true
  },
  
  // Configure test environment globals
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons']
  },
  
  // Test timeout (30 seconds for integration tests)
  testTimeout: 30000,
  
  // Verbose output
  verbose: true,
  
  // Error handling
  errorOnDeprecated: true,
  
  // Parallel testing
  maxWorkers: '50%',
  
  // Cache
  clearMocks: true,
  restoreMocks: true,
  
  // Extensions
  moduleFileExtensions: ['js', 'json'],
  
  // Custom test reporters
  reporters: [
    'default'
  ]
};