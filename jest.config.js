/**
 * AstralTube v3 - Jest Configuration
 * Comprehensive testing setup for Chrome extension with mocks and coverage
 */

module.exports = {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
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
  
  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/lib/vendor/**',
    '!src/**/*.config.js'
  ],
  
  // Coverage thresholds (80% minimum requirement)
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
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
  
  // Transform files
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // Extension testing globals
  globals: {
    chrome: {},
    browser: {},
    __DEV__: false,
    __TEST__: true
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