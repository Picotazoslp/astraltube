/**
 * AstralTube v3 - Jest Test Setup
 * Global test environment configuration with Chrome API mocks
 */

import { chromeMocks } from './mocks/chrome-api.js';
import { youTubeAPIMocks } from './mocks/youtube-api.js';
import { domMocks } from './mocks/dom.js';

// Set test environment flag
global.__TEST__ = true;
global.__DEV__ = false;

// Configure JSDOM environment
import 'jsdom-global/register';

// Increase timeout for async operations
jest.setTimeout(30000);

// Mock Chrome APIs globally
global.chrome = chromeMocks;
global.browser = chromeMocks; // For cross-browser compatibility

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock console methods to reduce test noise while keeping errors
const originalError = console.error;
const originalWarn = console.warn;

console.log = jest.fn();
console.info = jest.fn();
console.debug = jest.fn();
console.warn = jest.fn((message) => {
  // Show warnings in tests if they contain 'test' or are critical
  if (message.includes('test') || message.includes('critical')) {
    originalWarn(message);
  }
});
console.error = jest.fn((message) => {
  // Always show errors in tests
  originalError(message);
});

// Mock window objects commonly used in extension
Object.defineProperty(window, 'location', {
  value: {
    href: 'https://www.youtube.com/watch?v=test123',
    hostname: 'www.youtube.com',
    pathname: '/watch',
    search: '?v=test123',
    hash: '',
    origin: 'https://www.youtube.com'
  },
  writable: true
});

Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    language: 'en-US',
    languages: ['en-US', 'en'],
    onLine: true,
    cookieEnabled: true
  },
  writable: true
});

// Mock YouTube page elements
Object.defineProperty(document, 'querySelector', {
  value: jest.fn((selector) => {
    return domMocks.querySelector(selector);
  }),
  writable: true
});

Object.defineProperty(document, 'querySelectorAll', {
  value: jest.fn((selector) => {
    return domMocks.querySelectorAll(selector);
  }),
  writable: true
});

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByType: jest.fn(() => []),
  getEntriesByName: jest.fn(() => [])
};

// Mock crypto API for encryption tests
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: jest.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    subtle: {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
      generateKey: jest.fn(),
      importKey: jest.fn(),
      exportKey: jest.fn()
    }
  }
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock MutationObserver
global.MutationObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  takeRecords: jest.fn(() => [])
}));

// Setup and teardown hooks
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset fetch mock
  fetch.mockClear();
  
  // Reset Chrome API call tracking
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get.mockClear();
    chrome.storage.local.set.mockClear();
    chrome.storage.local.remove.mockClear();
    chrome.storage.local.clear.mockClear();
  }
  
  // Reset console mocks
  console.log.mockClear();
  console.info.mockClear();
  console.debug.mockClear();
  console.warn.mockClear();
  console.error.mockClear();
});

afterEach(() => {
  // Clean up any lingering timers
  jest.clearAllTimers();
  
  // Clean up any event listeners
  if (document.removeEventListener) {
    document.removeEventListener = jest.fn();
  }
  
  // Reset DOM modifications
  document.body.innerHTML = '';
});

// Global test utilities
global.testUtils = {
  // Wait for async operations
  waitFor: (condition, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const check = () => {
        if (condition()) {
          resolve();
        } else if (Date.now() - startTime >= timeout) {
          reject(new Error('Timeout waiting for condition'));
        } else {
          setTimeout(check, 10);
        }
      };
      check();
    });
  },
  
  // Create mock YouTube video element
  createMockVideoElement: () => {
    return domMocks.createVideoElement();
  },
  
  // Create mock YouTube playlist element
  createMockPlaylistElement: () => {
    return domMocks.createPlaylistElement();
  },
  
  // Simulate user interaction
  simulateClick: (element) => {
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    element.dispatchEvent(event);
  },
  
  // Mock Chrome extension message passing
  mockChromeMessage: (message, response = {}) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (chrome.runtime.onMessage.addListener.mock) {
          const listeners = chrome.runtime.onMessage.addListener.mock.calls;
          listeners.forEach(([callback]) => {
            callback(message, {}, (resp) => resolve(resp || response));
          });
        } else {
          resolve(response);
        }
      }, 0);
    });
  }
};

// Export for use in other test files
export { chromeMocks, youTubeAPIMocks, domMocks };