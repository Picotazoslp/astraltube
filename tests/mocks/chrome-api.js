/**
 * AstralTube v3 - Chrome Extension API Mocks
 * Comprehensive mocks for all Chrome extension APIs used in the project
 */

// Storage API Mock
const createStorageAreaMock = () => {
  const storage = new Map();
  
  return {
    get: jest.fn((keys) => {
      return new Promise((resolve) => {
        if (typeof keys === 'string') {
          resolve({ [keys]: storage.get(keys) });
        } else if (Array.isArray(keys)) {
          const result = {};
          keys.forEach(key => {
            result[key] = storage.get(key);
          });
          resolve(result);
        } else if (keys === null || keys === undefined) {
          const result = {};
          storage.forEach((value, key) => {
            result[key] = value;
          });
          resolve(result);
        } else if (typeof keys === 'object') {
          const result = {};
          Object.keys(keys).forEach(key => {
            result[key] = storage.has(key) ? storage.get(key) : keys[key];
          });
          resolve(result);
        }
      });
    }),
    
    set: jest.fn((items) => {
      return new Promise((resolve) => {
        Object.keys(items).forEach(key => {
          storage.set(key, items[key]);
        });
        resolve();
      });
    }),
    
    remove: jest.fn((keys) => {
      return new Promise((resolve) => {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        keysArray.forEach(key => storage.delete(key));
        resolve();
      });
    }),
    
    clear: jest.fn(() => {
      return new Promise((resolve) => {
        storage.clear();
        resolve();
      });
    }),
    
    getBytesInUse: jest.fn(() => Promise.resolve(1024)),
    
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(() => false)
    }
  };
};

// Runtime API Mock
const createRuntimeMock = () => ({
  id: 'test-extension-id',
  
  getManifest: jest.fn(() => ({
    manifest_version: 3,
    name: 'AstralTube',
    version: '3.0.0',
    permissions: [
      'storage',
      'activeTab',
      'scripting',
      'identity',
      'alarms'
    ],
    oauth2: {
      client_id: 'test-client-id',
      scopes: ['https://www.googleapis.com/auth/youtube.readonly']
    },
    content_scripts: [{
      matches: ['*://www.youtube.com/*'],
      js: ['src/content/content-script.js']
    }]
  })),
  
  connect: jest.fn(() => ({
    name: 'test-port',
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onDisconnect: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    postMessage: jest.fn(),
    disconnect: jest.fn()
  })),
  
  sendMessage: jest.fn((message, callback) => {
    return new Promise((resolve) => {
      const response = { success: true, data: {} };
      if (callback) callback(response);
      resolve(response);
    });
  }),
  
  onMessage: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    hasListener: jest.fn(() => false)
  },
  
  onConnect: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    hasListener: jest.fn(() => false)
  },
  
  onInstalled: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    hasListener: jest.fn(() => false)
  },
  
  onStartup: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    hasListener: jest.fn(() => false)
  },
  
  getURL: jest.fn((path) => `chrome-extension://test-extension-id/${path}`),
  
  reload: jest.fn(),
  
  lastError: null
});

// Tabs API Mock
const createTabsMock = () => ({
  query: jest.fn((queryInfo) => {
    return Promise.resolve([
      {
        id: 1,
        url: 'https://www.youtube.com/watch?v=test123',
        title: 'Test YouTube Video',
        active: true,
        windowId: 1
      }
    ]);
  }),
  
  get: jest.fn((tabId) => {
    return Promise.resolve({
      id: tabId,
      url: 'https://www.youtube.com/watch?v=test123',
      title: 'Test YouTube Video',
      active: true,
      windowId: 1
    });
  }),
  
  create: jest.fn((createProperties) => {
    return Promise.resolve({
      id: Math.floor(Math.random() * 1000),
      url: createProperties.url,
      title: 'New Tab',
      active: createProperties.active || false,
      windowId: 1
    });
  }),
  
  update: jest.fn((tabId, updateProperties) => {
    return Promise.resolve({
      id: tabId,
      url: updateProperties.url || 'https://www.youtube.com/',
      title: 'Updated Tab',
      active: updateProperties.active || false,
      windowId: 1
    });
  }),
  
  remove: jest.fn(() => Promise.resolve()),
  
  executeScript: jest.fn(() => Promise.resolve([{}])),
  
  insertCSS: jest.fn(() => Promise.resolve()),
  
  onActivated: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    hasListener: jest.fn(() => false)
  },
  
  onUpdated: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    hasListener: jest.fn(() => false)
  },
  
  onCreated: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    hasListener: jest.fn(() => false)
  },
  
  onRemoved: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    hasListener: jest.fn(() => false)
  }
});

// Identity API Mock
const createIdentityMock = () => ({
  getAuthToken: jest.fn((options) => {
    return Promise.resolve('mock-auth-token-12345');
  }),
  
  removeCachedAuthToken: jest.fn(() => Promise.resolve()),
  
  clearAllCachedAuthTokens: jest.fn(() => Promise.resolve()),
  
  launchWebAuthFlow: jest.fn((options) => {
    return Promise.resolve('https://redirect.url/auth?code=test-auth-code');
  })
});

// Alarms API Mock
const createAlarmsMock = () => ({
  create: jest.fn((name, alarmInfo) => {
    // Simulate alarm creation
  }),
  
  get: jest.fn((name) => {
    return Promise.resolve({
      name: name,
      scheduledTime: Date.now() + 60000,
      periodInMinutes: 1
    });
  }),
  
  getAll: jest.fn(() => {
    return Promise.resolve([
      {
        name: 'sync-alarm',
        scheduledTime: Date.now() + 60000,
        periodInMinutes: 5
      }
    ]);
  }),
  
  clear: jest.fn(() => Promise.resolve(true)),
  
  clearAll: jest.fn(() => Promise.resolve(true)),
  
  onAlarm: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    hasListener: jest.fn(() => false)
  }
});

// Scripting API Mock (Manifest v3)
const createScriptingMock = () => ({
  executeScript: jest.fn((injection) => {
    return Promise.resolve([{ result: 'mock-execution-result' }]);
  }),
  
  insertCSS: jest.fn((injection) => {
    return Promise.resolve();
  }),
  
  removeCSS: jest.fn((injection) => {
    return Promise.resolve();
  }),
  
  registerContentScripts: jest.fn(() => Promise.resolve()),
  
  unregisterContentScripts: jest.fn(() => Promise.resolve()),
  
  getRegisteredContentScripts: jest.fn(() => Promise.resolve([]))
});

// Action API Mock (Manifest v3 replacement for browserAction)
const createActionMock = () => ({
  setTitle: jest.fn(() => Promise.resolve()),
  
  getTitle: jest.fn(() => Promise.resolve('AstralTube')),
  
  setIcon: jest.fn(() => Promise.resolve()),
  
  setBadgeText: jest.fn(() => Promise.resolve()),
  
  getBadgeText: jest.fn(() => Promise.resolve('')),
  
  setBadgeBackgroundColor: jest.fn(() => Promise.resolve()),
  
  getBadgeBackgroundColor: jest.fn(() => Promise.resolve([255, 0, 0, 255])),
  
  enable: jest.fn(() => Promise.resolve()),
  
  disable: jest.fn(() => Promise.resolve()),
  
  onClicked: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    hasListener: jest.fn(() => false)
  }
});

// Notifications API Mock
const createNotificationsMock = () => ({
  create: jest.fn((id, options) => {
    return Promise.resolve(id || 'notification-' + Date.now());
  }),
  
  update: jest.fn(() => Promise.resolve(true)),
  
  clear: jest.fn(() => Promise.resolve(true)),
  
  getAll: jest.fn(() => Promise.resolve({})),
  
  getPermissionLevel: jest.fn(() => Promise.resolve('granted')),
  
  onClicked: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    hasListener: jest.fn(() => false)
  },
  
  onClosed: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    hasListener: jest.fn(() => false)
  },
  
  onButtonClicked: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    hasListener: jest.fn(() => false)
  }
});

// Main Chrome API Mock
export const chromeMocks = {
  storage: {
    local: createStorageAreaMock(),
    sync: createStorageAreaMock(),
    managed: createStorageAreaMock(),
    session: createStorageAreaMock(),
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(() => false)
    }
  },
  
  runtime: createRuntimeMock(),
  tabs: createTabsMock(),
  identity: createIdentityMock(),
  alarms: createAlarmsMock(),
  scripting: createScriptingMock(),
  action: createActionMock(),
  notifications: createNotificationsMock(),
  
  // Additional Chrome APIs
  webNavigation: {
    onCompleted: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(() => false)
    },
    onDOMContentLoaded: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(() => false)
    }
  },
  
  permissions: {
    contains: jest.fn(() => Promise.resolve(true)),
    request: jest.fn(() => Promise.resolve(true)),
    remove: jest.fn(() => Promise.resolve(true)),
    getAll: jest.fn(() => Promise.resolve({
      permissions: ['storage', 'activeTab', 'scripting', 'identity', 'alarms'],
      origins: ['*://www.youtube.com/*']
    }))
  },
  
  contextMenus: {
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    removeAll: jest.fn(),
    onClicked: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(() => false)
    }
  }
};

// Utility functions for tests
export const chromeTestUtils = {
  // Reset all chrome mock call counts
  resetMocks: () => {
    Object.values(chromeMocks).forEach(api => {
      if (typeof api === 'object') {
        Object.values(api).forEach(method => {
          if (typeof method === 'function' && method.mockClear) {
            method.mockClear();
          } else if (typeof method === 'object' && method !== null) {
            Object.values(method).forEach(subMethod => {
              if (typeof subMethod === 'function' && subMethod.mockClear) {
                subMethod.mockClear();
              }
            });
          }
        });
      }
    });
  },
  
  // Simulate storage change events
  triggerStorageChange: (changes, areaName = 'local') => {
    const listeners = chromeMocks.storage.onChanged.addListener.mock.calls;
    listeners.forEach(([callback]) => {
      callback(changes, areaName);
    });
  },
  
  // Simulate runtime message
  triggerRuntimeMessage: (message, sender = {}, sendResponse = jest.fn()) => {
    const listeners = chromeMocks.runtime.onMessage.addListener.mock.calls;
    listeners.forEach(([callback]) => {
      callback(message, sender, sendResponse);
    });
  },
  
  // Simulate tab updates
  triggerTabUpdate: (tabId, changeInfo, tab) => {
    const listeners = chromeMocks.tabs.onUpdated.addListener.mock.calls;
    listeners.forEach(([callback]) => {
      callback(tabId, changeInfo, tab);
    });
  },
  
  // Simulate alarms
  triggerAlarm: (alarm) => {
    const listeners = chromeMocks.alarms.onAlarm.addListener.mock.calls;
    listeners.forEach(([callback]) => {
      callback(alarm);
    });
  }
};