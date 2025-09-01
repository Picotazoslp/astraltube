/**
 * Simple Jest Test Setup
 * Basic mocks for AstralTube extension testing without external dependencies
 */

// Mock Chrome Extension APIs
global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        const mockData = {};
        if (typeof keys === 'string') {
          mockData[keys] = null;
        } else if (Array.isArray(keys)) {
          keys.forEach(key => mockData[key] = null);
        }
        if (callback) callback(mockData);
        return Promise.resolve(mockData);
      }),
      set: jest.fn((data, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      remove: jest.fn((keys, callback) => {
        if (callback) callback();
        return Promise.resolve();
      })
    }
  },
  runtime: {
    sendMessage: jest.fn((message, callback) => {
      if (callback) callback({ success: true });
      return Promise.resolve({ success: true });
    }),
    onMessage: {
      addListener: jest.fn()
    },
    getManifest: jest.fn(() => ({
      version: '3.0.0',
      manifest_version: 3,
      name: 'AstralTube Test'
    })),
    openOptionsPage: jest.fn()
  },
  tabs: {
    query: jest.fn((queryInfo, callback) => {
      const mockTab = { id: 1, url: 'https://youtube.com', active: true };
      if (callback) callback([mockTab]);
      return Promise.resolve([mockTab]);
    }),
    sendMessage: jest.fn((tabId, message, callback) => {
      if (callback) callback({ success: true });
      return Promise.resolve({ success: true });
    })
  },
  identity: {
    getAuthToken: jest.fn((options, callback) => {
      const token = 'mock-auth-token';
      if (callback) callback(token);
      return Promise.resolve(token);
    })
  }
};

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'https://youtube.com',
    pathname: '/',
    search: '',
    hash: '',
    hostname: 'youtube.com'
  },
  writable: true
});

// Mock crypto API
global.crypto = {
  subtle: {
    generateKey: jest.fn(() => Promise.resolve({})),
    exportKey: jest.fn(() => Promise.resolve({})),
    importKey: jest.fn(() => Promise.resolve({})),
    encrypt: jest.fn(() => Promise.resolve(new ArrayBuffer(8))),
    decrypt: jest.fn(() => Promise.resolve(new ArrayBuffer(8)))
  },
  getRandomValues: jest.fn((array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  })
};

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now())
};

// Mock fetch API
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ items: [] }),
    text: () => Promise.resolve('')
  })
);

// Mock console to reduce noise in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn((message, ...args) => {
    // Still show actual errors
    if (typeof message === 'string' && !message.includes('Warning') && !message.includes('deprecated')) {
      originalError.call(console, message, ...args);
    }
  });
  
  console.warn = jest.fn((message, ...args) => {
    // Suppress warnings in tests unless they contain 'test'
    if (typeof message === 'string' && message.includes('test')) {
      originalWarn.call(console, message, ...args);
    }
  });
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  document.body.innerHTML = '';
});

// Mock timers
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});