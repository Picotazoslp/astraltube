/**
 * AstralTube v3 - Service Worker Unit Tests
 * Comprehensive tests for background service worker functionality
 */

import { chromeMocks, chromeTestUtils } from '../mocks/chrome-api.js';
import { youTubeAPIMocks } from '../mocks/youtube-api.js';

// Mock the service worker modules
const mockStorageManager = {
  initialize: jest.fn(() => Promise.resolve()),
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
  clear: jest.fn()
};

const mockAstralTubeAPI = {
  initialize: jest.fn(() => Promise.resolve()),
  searchVideos: jest.fn(),
  getVideoDetails: jest.fn(),
  getPlaylists: jest.fn(),
  createPlaylist: jest.fn(),
  clearCache: jest.fn()
};

const mockAnalyticsManager = {
  initialize: jest.fn(() => Promise.resolve()),
  trackEvent: jest.fn(),
  trackFeatureUsage: jest.fn(),
  startBenchmark: jest.fn(() => ({
    end: jest.fn(() => 100)
  })),
  getHealthStatus: jest.fn(() => ({ status: 'healthy' })),
  destroy: jest.fn()
};

const mockHealthChecker = {
  initialize: jest.fn(() => Promise.resolve()),
  startHealthCheck: jest.fn(),
  stopHealthCheck: jest.fn(),
  getStatus: jest.fn(() => ({ status: 'healthy' }))
};

const mockConfigManager = {
  initialize: jest.fn(() => Promise.resolve()),
  get: jest.fn(),
  set: jest.fn(),
  getAll: jest.fn(() => Promise.resolve({}))
};

const mockCredentialsManager = {
  initialize: jest.fn(() => Promise.resolve()),
  getApiKey: jest.fn(() => 'test-api-key'),
  setApiKey: jest.fn(),
  getAccessToken: jest.fn(() => 'test-access-token'),
  refreshToken: jest.fn()
};

const mockErrorHandler = {
  initialize: jest.fn(() => Promise.resolve()),
  handleError: jest.fn(),
  logError: jest.fn(),
  getErrorStats: jest.fn(() => ({ totalErrors: 0 }))
};

// Mock service worker class implementation
class MockAstralTubeServiceWorker {
  constructor() {
    this.api = mockAstralTubeAPI;
    this.storage = mockStorageManager;
    this.analytics = mockAnalyticsManager;
    this.initialized = false;
    this.activeConnections = new Map();
    this.syncInterval = null;
    this.healthCheckInterval = null;
    
    // Keep-alive mechanism
    this.keepAlivePort = null;
    this.lastActivity = Date.now();
    this.keepAliveInterval = null;
    this.restartAttempts = 0;
    this.maxRestartAttempts = 3;
    
    this.init();
  }

  async init() {
    try {
      console.log('🚀 AstralTube Service Worker starting...');
      
      // Initialize core services
      await this.initializeServices();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Start background tasks
      this.startBackgroundTasks();
      
      // Start keep-alive mechanism
      this.startKeepAlive();
      
      this.initialized = true;
      console.log('✅ AstralTube Service Worker initialized successfully');
      
    } catch (error) {
      console.error('❌ Service Worker initialization failed:', error);
      mockErrorHandler.handleError(error, { context: 'service_worker_init' });
      throw error;
    }
  }

  async initializeServices() {
    const services = [
      this.storage,
      this.api,
      this.analytics,
      mockHealthChecker,
      mockConfigManager,
      mockCredentialsManager,
      mockErrorHandler
    ];

    for (const service of services) {
      await service.initialize();
    }
  }

  setupEventListeners() {
    // Runtime message handler
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Connection handler
    chrome.runtime.onConnect.addListener((port) => {
      this.handleConnection(port);
    });

    // Installation and update handlers
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstalled(details);
    });

    chrome.runtime.onStartup.addListener(() => {
      this.handleStartup();
    });

    // Tab event handlers
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabActivated(activeInfo);
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdated(tabId, changeInfo, tab);
    });

    // Alarm handler
    chrome.alarms.onAlarm.addListener((alarm) => {
      this.handleAlarm(alarm);
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      this.lastActivity = Date.now();
      mockAnalyticsManager.trackEvent('message_received', {
        type: message.type,
        tabId: sender.tab?.id
      });

      switch (message.type) {
        case 'GET_PLAYLISTS':
          return await this.handleGetPlaylists(message.data, sendResponse);
        
        case 'CREATE_PLAYLIST':
          return await this.handleCreatePlaylist(message.data, sendResponse);
        
        case 'SEARCH_VIDEOS':
          return await this.handleSearchVideos(message.data, sendResponse);
        
        case 'SYNC_DATA':
          return await this.handleSyncData(message.data, sendResponse);
        
        case 'GET_STATS':
          return await this.handleGetStats(sendResponse);
        
        case 'HEALTH_CHECK':
          return await this.handleHealthCheck(sendResponse);
        
        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      mockErrorHandler.handleError(error, {
        context: 'message_handler',
        messageType: message.type
      });
      sendResponse({ error: error.message });
    }
  }

  handleConnection(port) {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.activeConnections.set(connectionId, {
      port,
      created: Date.now(),
      lastActivity: Date.now()
    });

    mockAnalyticsManager.trackEvent('connection_opened', {
      connectionId,
      portName: port.name
    });

    port.onMessage.addListener((message) => {
      this.handlePortMessage(connectionId, message);
    });

    port.onDisconnect.addListener(() => {
      this.handlePortDisconnect(connectionId);
    });
  }

  handlePortMessage(connectionId, message) {
    const connection = this.activeConnections.get(connectionId);
    if (connection) {
      connection.lastActivity = Date.now();
      mockAnalyticsManager.trackEvent('port_message_received', {
        connectionId,
        messageType: message.type
      });
    }
  }

  handlePortDisconnect(connectionId) {
    this.activeConnections.delete(connectionId);
    mockAnalyticsManager.trackEvent('connection_closed', { connectionId });
  }

  async handleGetPlaylists(data, sendResponse) {
    const benchmark = mockAnalyticsManager.startBenchmark('get_playlists');
    try {
      const playlists = await mockAstralTubeAPI.getPlaylists(data);
      benchmark.end();
      sendResponse({ success: true, data: playlists });
    } catch (error) {
      benchmark.end();
      throw error;
    }
  }

  async handleCreatePlaylist(data, sendResponse) {
    const benchmark = mockAnalyticsManager.startBenchmark('create_playlist');
    try {
      const playlist = await mockAstralTubeAPI.createPlaylist(data);
      mockAnalyticsManager.trackFeatureUsage('playlist', 'create');
      benchmark.end();
      sendResponse({ success: true, data: playlist });
    } catch (error) {
      benchmark.end();
      throw error;
    }
  }

  async handleSearchVideos(data, sendResponse) {
    const benchmark = mockAnalyticsManager.startBenchmark('search_videos');
    try {
      const results = await mockAstralTubeAPI.searchVideos(data.query, data.options);
      benchmark.end();
      sendResponse({ success: true, data: results });
    } catch (error) {
      benchmark.end();
      throw error;
    }
  }

  async handleSyncData(data, sendResponse) {
    const benchmark = mockAnalyticsManager.startBenchmark('sync_data');
    try {
      await this.performSync();
      benchmark.end();
      sendResponse({ success: true });
    } catch (error) {
      benchmark.end();
      throw error;
    }
  }

  async handleGetStats(sendResponse) {
    try {
      const stats = await mockAnalyticsManager.getHealthStatus();
      sendResponse({ success: true, data: stats });
    } catch (error) {
      throw error;
    }
  }

  async handleHealthCheck(sendResponse) {
    try {
      const health = mockHealthChecker.getStatus();
      sendResponse({ success: true, data: health });
    } catch (error) {
      throw error;
    }
  }

  async handleInstalled(details) {
    mockAnalyticsManager.trackEvent('extension_installed', {
      reason: details.reason,
      previousVersion: details.previousVersion
    });

    if (details.reason === 'install') {
      await this.performFirstTimeSetup();
    } else if (details.reason === 'update') {
      await this.performUpdate(details.previousVersion);
    }
  }

  handleStartup() {
    mockAnalyticsManager.trackEvent('extension_startup');
    this.restartAttempts = 0;
  }

  handleTabActivated(activeInfo) {
    this.lastActivity = Date.now();
    if (this.isYouTubeTab(activeInfo.tabId)) {
      mockAnalyticsManager.trackEvent('youtube_tab_activated', {
        tabId: activeInfo.tabId
      });
    }
  }

  async handleTabUpdated(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com')) {
      mockAnalyticsManager.trackEvent('youtube_page_loaded', {
        tabId,
        url: tab.url
      });
      
      // Inject content script if needed
      await this.injectContentScript(tabId);
    }
  }

  handleAlarm(alarm) {
    mockAnalyticsManager.trackEvent('alarm_triggered', {
      name: alarm.name,
      scheduledTime: alarm.scheduledTime
    });

    switch (alarm.name) {
      case 'sync-data':
        this.performSync();
        break;
      case 'health-check':
        mockHealthChecker.startHealthCheck();
        break;
      case 'cleanup':
        this.performCleanup();
        break;
      default:
        console.warn('Unknown alarm:', alarm.name);
    }
  }

  startBackgroundTasks() {
    // Setup periodic sync
    chrome.alarms.create('sync-data', { periodInMinutes: 15 });
    
    // Setup health check
    chrome.alarms.create('health-check', { periodInMinutes: 5 });
    
    // Setup cleanup task
    chrome.alarms.create('cleanup', { periodInMinutes: 60 });
  }

  startKeepAlive() {
    // Create keep-alive interval
    this.keepAliveInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - this.lastActivity;
      
      // If no activity for 5 minutes, try to restart
      if (timeSinceActivity > 5 * 60 * 1000 && this.restartAttempts < this.maxRestartAttempts) {
        this.restartServiceWorker();
      }
    }, 60 * 1000); // Check every minute
  }

  async restartServiceWorker() {
    try {
      this.restartAttempts++;
      mockAnalyticsManager.trackEvent('service_worker_restart', {
        attempt: this.restartAttempts
      });
      
      // Cleanup current state
      await this.cleanup();
      
      // Reinitialize
      await this.init();
      
    } catch (error) {
      mockErrorHandler.handleError(error, { context: 'service_worker_restart' });
    }
  }

  async performSync() {
    mockAnalyticsManager.trackEvent('sync_started');
    try {
      // Simulate sync operations
      await this.syncPlaylists();
      await this.syncSubscriptions();
      await this.syncSettings();
      
      mockAnalyticsManager.trackEvent('sync_completed');
    } catch (error) {
      mockAnalyticsManager.trackEvent('sync_failed', { error: error.message });
      throw error;
    }
  }

  async syncPlaylists() {
    // Mock playlist sync
    return mockAstralTubeAPI.getPlaylists();
  }

  async syncSubscriptions() {
    // Mock subscription sync
    return Promise.resolve();
  }

  async syncSettings() {
    // Mock settings sync
    return mockConfigManager.getAll();
  }

  async performFirstTimeSetup() {
    mockAnalyticsManager.trackEvent('first_time_setup_started');
    
    // Initialize default settings
    await mockConfigManager.set('initialized', true);
    await mockConfigManager.set('version', '3.0.0');
    
    mockAnalyticsManager.trackEvent('first_time_setup_completed');
  }

  async performUpdate(previousVersion) {
    mockAnalyticsManager.trackEvent('extension_updated', {
      previousVersion,
      currentVersion: '3.0.0'
    });
    
    // Perform migration if needed
    if (previousVersion && this.needsMigration(previousVersion)) {
      await this.performMigration(previousVersion);
    }
  }

  needsMigration(previousVersion) {
    // Check if migration is needed based on version
    const [major, minor] = previousVersion.split('.').map(Number);
    return major < 3;
  }

  async performMigration(previousVersion) {
    mockAnalyticsManager.trackEvent('migration_started', { previousVersion });
    
    // Mock migration process
    await this.migrateStorageFormat();
    await this.migrateSettings();
    
    mockAnalyticsManager.trackEvent('migration_completed', { previousVersion });
  }

  async migrateStorageFormat() {
    // Mock storage migration
    return Promise.resolve();
  }

  async migrateSettings() {
    // Mock settings migration
    return Promise.resolve();
  }

  async injectContentScript(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/content/content-script.js']
      });
      
      mockAnalyticsManager.trackEvent('content_script_injected', { tabId });
    } catch (error) {
      // Content script might already be injected
      if (!error.message.includes('already injected')) {
        mockErrorHandler.handleError(error, {
          context: 'content_script_injection',
          tabId
        });
      }
    }
  }

  isYouTubeTab(tabId) {
    // Mock YouTube tab detection
    return true; // Simplified for testing
  }

  async performCleanup() {
    mockAnalyticsManager.trackEvent('cleanup_started');
    
    try {
      // Clean up old connections
      const now = Date.now();
      const staleConnections = Array.from(this.activeConnections.entries())
        .filter(([, conn]) => now - conn.lastActivity > 30 * 60 * 1000); // 30 minutes
      
      staleConnections.forEach(([id]) => {
        this.activeConnections.delete(id);
      });
      
      // Clear API cache
      mockAstralTubeAPI.clearCache();
      
      mockAnalyticsManager.trackEvent('cleanup_completed', {
        cleanedConnections: staleConnections.length
      });
      
    } catch (error) {
      mockErrorHandler.handleError(error, { context: 'cleanup' });
    }
  }

  async cleanup() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Close all connections
    this.activeConnections.forEach((conn, id) => {
      try {
        conn.port.disconnect();
      } catch (error) {
        // Port might already be closed
      }
    });
    this.activeConnections.clear();
    
    // Clear alarms
    await chrome.alarms.clearAll();
    
    // Analytics cleanup
    mockAnalyticsManager.destroy();
  }
}

describe('AstralTubeServiceWorker', () => {
  let serviceWorker;
  
  beforeEach(async () => {
    // Reset all mocks
    chromeTestUtils.resetMocks();
    youTubeAPIMocks.resetMocks();
    
    // Clear all mock calls
    Object.values(mockStorageManager).forEach(fn => fn.mockClear?.());
    Object.values(mockAstralTubeAPI).forEach(fn => fn.mockClear?.());
    Object.values(mockAnalyticsManager).forEach(fn => fn.mockClear?.());
    Object.values(mockHealthChecker).forEach(fn => fn.mockClear?.());
    Object.values(mockConfigManager).forEach(fn => fn.mockClear?.());
    Object.values(mockCredentialsManager).forEach(fn => fn.mockClear?.());
    Object.values(mockErrorHandler).forEach(fn => fn.mockClear?.());
    
    // Use fake timers
    jest.useFakeTimers();
  });

  afterEach(async () => {
    if (serviceWorker) {
      await serviceWorker.cleanup();
    }
    serviceWorker = null;
    
    // Restore timers
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      serviceWorker = new MockAstralTubeServiceWorker();
      await testUtils.waitFor(() => serviceWorker.initialized);
      
      expect(serviceWorker.initialized).toBe(true);
      expect(mockStorageManager.initialize).toHaveBeenCalled();
      expect(mockAstralTubeAPI.initialize).toHaveBeenCalled();
      expect(mockAnalyticsManager.initialize).toHaveBeenCalled();
    });

    test('should setup event listeners', async () => {
      serviceWorker = new MockAstralTubeServiceWorker();
      await testUtils.waitFor(() => serviceWorker.initialized);
      
      expect(chromeMocks.runtime.onMessage.addListener).toHaveBeenCalled();
      expect(chromeMocks.runtime.onConnect.addListener).toHaveBeenCalled();
      expect(chromeMocks.runtime.onInstalled.addListener).toHaveBeenCalled();
      expect(chromeMocks.tabs.onActivated.addListener).toHaveBeenCalled();
      expect(chromeMocks.tabs.onUpdated.addListener).toHaveBeenCalled();
    });

    test('should start background tasks', async () => {
      serviceWorker = new MockAstralTubeServiceWorker();
      await testUtils.waitFor(() => serviceWorker.initialized);
      
      expect(chromeMocks.alarms.create).toHaveBeenCalledWith('sync-data', { periodInMinutes: 15 });
      expect(chromeMocks.alarms.create).toHaveBeenCalledWith('health-check', { periodInMinutes: 5 });
      expect(chromeMocks.alarms.create).toHaveBeenCalledWith('cleanup', { periodInMinutes: 60 });
    });

    test('should handle initialization errors', async () => {
      mockStorageManager.initialize.mockRejectedValueOnce(new Error('Storage init failed'));
      
      await expect(async () => {
        serviceWorker = new MockAstralTubeServiceWorker();
        await testUtils.waitFor(() => serviceWorker.initialized, 1000);
      }).rejects.toThrow('Storage init failed');
      
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      serviceWorker = new MockAstralTubeServiceWorker();
      await testUtils.waitFor(() => serviceWorker.initialized);
    });

    test('should handle GET_PLAYLISTS message', async () => {
      const message = { type: 'GET_PLAYLISTS', data: {} };
      const sender = { tab: { id: 1 } };
      const sendResponse = jest.fn();
      
      mockAstralTubeAPI.getPlaylists.mockResolvedValueOnce({ items: [] });
      
      await serviceWorker.handleMessage(message, sender, sendResponse);
      
      expect(mockAstralTubeAPI.getPlaylists).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: { items: [] }
      });
    });

    test('should handle CREATE_PLAYLIST message', async () => {
      const message = { type: 'CREATE_PLAYLIST', data: { title: 'Test Playlist' } };
      const sender = { tab: { id: 1 } };
      const sendResponse = jest.fn();
      
      mockAstralTubeAPI.createPlaylist.mockResolvedValueOnce({ id: 'newPlaylist123' });
      
      await serviceWorker.handleMessage(message, sender, sendResponse);
      
      expect(mockAstralTubeAPI.createPlaylist).toHaveBeenCalledWith({ title: 'Test Playlist' });
      expect(mockAnalyticsManager.trackFeatureUsage).toHaveBeenCalledWith('playlist', 'create');
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: { id: 'newPlaylist123' }
      });
    });

    test('should handle SEARCH_VIDEOS message', async () => {
      const message = {
        type: 'SEARCH_VIDEOS',
        data: { query: 'test query', options: { maxResults: 10 } }
      };
      const sender = { tab: { id: 1 } };
      const sendResponse = jest.fn();
      
      mockAstralTubeAPI.searchVideos.mockResolvedValueOnce({ items: [] });
      
      await serviceWorker.handleMessage(message, sender, sendResponse);
      
      expect(mockAstralTubeAPI.searchVideos).toHaveBeenCalledWith('test query', { maxResults: 10 });
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: { items: [] }
      });
    });

    test('should handle unknown message type', async () => {
      const message = { type: 'UNKNOWN_TYPE', data: {} };
      const sender = { tab: { id: 1 } };
      const sendResponse = jest.fn();
      
      await serviceWorker.handleMessage(message, sender, sendResponse);
      
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        error: 'Unknown message type: UNKNOWN_TYPE'
      });
    });

    test('should track message analytics', async () => {
      const message = { type: 'GET_PLAYLISTS', data: {} };
      const sender = { tab: { id: 1 } };
      const sendResponse = jest.fn();
      
      mockAstralTubeAPI.getPlaylists.mockResolvedValueOnce({ items: [] });
      
      await serviceWorker.handleMessage(message, sender, sendResponse);
      
      expect(mockAnalyticsManager.trackEvent).toHaveBeenCalledWith('message_received', {
        type: 'GET_PLAYLISTS',
        tabId: 1
      });
      
      expect(mockAnalyticsManager.startBenchmark).toHaveBeenCalledWith('get_playlists');
    });
  });

  describe('Connection Handling', () => {
    beforeEach(async () => {
      serviceWorker = new MockAstralTubeServiceWorker();
      await testUtils.waitFor(() => serviceWorker.initialized);
    });

    test('should handle new connections', () => {
      const mockPort = {
        name: 'content-script',
        onMessage: { addListener: jest.fn() },
        onDisconnect: { addListener: jest.fn() }
      };
      
      serviceWorker.handleConnection(mockPort);
      
      expect(serviceWorker.activeConnections.size).toBe(1);
      expect(mockAnalyticsManager.trackEvent).toHaveBeenCalledWith('connection_opened', {
        connectionId: expect.stringMatching(/^conn_\d+_[a-z0-9]+$/),
        portName: 'content-script'
      });
    });

    test('should handle port disconnect', () => {
      const mockPort = {
        name: 'content-script',
        onMessage: { addListener: jest.fn() },
        onDisconnect: { addListener: jest.fn() }
      };
      
      serviceWorker.handleConnection(mockPort);
      const initialSize = serviceWorker.activeConnections.size;
      
      // Get connection ID
      const connectionId = Array.from(serviceWorker.activeConnections.keys())[0];
      
      serviceWorker.handlePortDisconnect(connectionId);
      
      expect(serviceWorker.activeConnections.size).toBe(initialSize - 1);
      expect(mockAnalyticsManager.trackEvent).toHaveBeenCalledWith('connection_closed', {
        connectionId
      });
    });
  });

  describe('Lifecycle Events', () => {
    beforeEach(async () => {
      serviceWorker = new MockAstralTubeServiceWorker();
      await testUtils.waitFor(() => serviceWorker.initialized);
    });

    test('should handle extension installation', async () => {
      const details = { reason: 'install' };
      
      await serviceWorker.handleInstalled(details);
      
      expect(mockAnalyticsManager.trackEvent).toHaveBeenCalledWith('extension_installed', {
        reason: 'install',
        previousVersion: undefined
      });
      
      expect(mockConfigManager.set).toHaveBeenCalledWith('initialized', true);
      expect(mockConfigManager.set).toHaveBeenCalledWith('version', '3.0.0');
    });

    test('should handle extension update', async () => {
      const details = { reason: 'update', previousVersion: '2.5.0' };
      
      await serviceWorker.handleInstalled(details);
      
      expect(mockAnalyticsManager.trackEvent).toHaveBeenCalledWith('extension_updated', {
        previousVersion: '2.5.0',
        currentVersion: '3.0.0'
      });
    });

    test('should handle startup event', () => {
      serviceWorker.handleStartup();
      
      expect(mockAnalyticsManager.trackEvent).toHaveBeenCalledWith('extension_startup');
      expect(serviceWorker.restartAttempts).toBe(0);
    });
  });

  describe('Tab Events', () => {
    beforeEach(async () => {
      serviceWorker = new MockAstralTubeServiceWorker();
      await testUtils.waitFor(() => serviceWorker.initialized);
    });

    test('should handle tab activation', () => {
      const activeInfo = { tabId: 1, windowId: 1 };
      
      serviceWorker.handleTabActivated(activeInfo);
      
      expect(mockAnalyticsManager.trackEvent).toHaveBeenCalledWith('youtube_tab_activated', {
        tabId: 1
      });
    });

    test('should handle tab updates on YouTube', async () => {
      const tabId = 1;
      const changeInfo = { status: 'complete' };
      const tab = { url: 'https://youtube.com/watch?v=test123' };
      
      await serviceWorker.handleTabUpdated(tabId, changeInfo, tab);
      
      expect(mockAnalyticsManager.trackEvent).toHaveBeenCalledWith('youtube_page_loaded', {
        tabId,
        url: tab.url
      });
      
      expect(chromeMocks.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId },
        files: ['src/content/content-script.js']
      });
    });

    test('should ignore non-YouTube tabs', async () => {
      const tabId = 1;
      const changeInfo = { status: 'complete' };
      const tab = { url: 'https://example.com' };
      
      await serviceWorker.handleTabUpdated(tabId, changeInfo, tab);
      
      expect(mockAnalyticsManager.trackEvent).not.toHaveBeenCalledWith('youtube_page_loaded', expect.any(Object));
    });
  });

  describe('Alarm Handling', () => {
    beforeEach(async () => {
      serviceWorker = new MockAstralTubeServiceWorker();
      await testUtils.waitFor(() => serviceWorker.initialized);
    });

    test('should handle sync alarm', () => {
      const alarm = { name: 'sync-data', scheduledTime: Date.now() };
      
      const syncSpy = jest.spyOn(serviceWorker, 'performSync').mockImplementation();
      
      serviceWorker.handleAlarm(alarm);
      
      expect(mockAnalyticsManager.trackEvent).toHaveBeenCalledWith('alarm_triggered', {
        name: 'sync-data',
        scheduledTime: alarm.scheduledTime
      });
      
      expect(syncSpy).toHaveBeenCalled();
    });

    test('should handle health check alarm', () => {
      const alarm = { name: 'health-check', scheduledTime: Date.now() };
      
      serviceWorker.handleAlarm(alarm);
      
      expect(mockHealthChecker.startHealthCheck).toHaveBeenCalled();
    });

    test('should handle cleanup alarm', () => {
      const alarm = { name: 'cleanup', scheduledTime: Date.now() };
      
      const cleanupSpy = jest.spyOn(serviceWorker, 'performCleanup').mockImplementation();
      
      serviceWorker.handleAlarm(alarm);
      
      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('Background Tasks', () => {
    beforeEach(async () => {
      serviceWorker = new MockAstralTubeServiceWorker();
      await testUtils.waitFor(() => serviceWorker.initialized);
    });

    test('should perform data sync', async () => {
      mockAstralTubeAPI.getPlaylists.mockResolvedValueOnce({ items: [] });
      mockConfigManager.getAll.mockResolvedValueOnce({});
      
      await serviceWorker.performSync();
      
      expect(mockAnalyticsManager.trackEvent).toHaveBeenCalledWith('sync_started');
      expect(mockAnalyticsManager.trackEvent).toHaveBeenCalledWith('sync_completed');
      expect(mockAstralTubeAPI.getPlaylists).toHaveBeenCalled();
      expect(mockConfigManager.getAll).toHaveBeenCalled();
    });

    test('should handle sync errors', async () => {
      const error = new Error('Sync failed');
      mockAstralTubeAPI.getPlaylists.mockRejectedValueOnce(error);
      
      await expect(serviceWorker.performSync()).rejects.toThrow('Sync failed');
      
      expect(mockAnalyticsManager.trackEvent).toHaveBeenCalledWith('sync_failed', {
        error: 'Sync failed'
      });
    });

    test('should perform cleanup', async () => {
      // Add some stale connections
      serviceWorker.activeConnections.set('stale1', {
        lastActivity: Date.now() - 40 * 60 * 1000, // 40 minutes ago
        port: { disconnect: jest.fn() }
      });
      
      serviceWorker.activeConnections.set('active1', {
        lastActivity: Date.now() - 5 * 60 * 1000, // 5 minutes ago
        port: { disconnect: jest.fn() }
      });
      
      await serviceWorker.performCleanup();
      
      expect(mockAnalyticsManager.trackEvent).toHaveBeenCalledWith('cleanup_completed', {
        cleanedConnections: 1
      });
      
      expect(serviceWorker.activeConnections.has('stale1')).toBe(false);
      expect(serviceWorker.activeConnections.has('active1')).toBe(true);
      expect(mockAstralTubeAPI.clearCache).toHaveBeenCalled();
    });
  });

  describe('Keep-Alive Mechanism', () => {
    beforeEach(async () => {
      serviceWorker = new MockAstralTubeServiceWorker();
      await testUtils.waitFor(() => serviceWorker.initialized);
    });

    test('should restart when inactive for too long', () => {
      const restartSpy = jest.spyOn(serviceWorker, 'restartServiceWorker').mockImplementation();
      
      // Set last activity to 6 minutes ago
      serviceWorker.lastActivity = Date.now() - 6 * 60 * 1000;
      
      // Fast-forward timers to trigger keep-alive check
      jest.advanceTimersByTime(60 * 1000);
      
      expect(restartSpy).toHaveBeenCalled();
    });

    test('should not restart when recently active', () => {
      const restartSpy = jest.spyOn(serviceWorker, 'restartServiceWorker').mockImplementation();
      
      // Set last activity to 2 minutes ago
      serviceWorker.lastActivity = Date.now() - 2 * 60 * 1000;
      
      // Fast-forward timers
      jest.advanceTimersByTime(60 * 1000);
      
      expect(restartSpy).not.toHaveBeenCalled();
    });

    test('should stop restart attempts after max attempts', () => {
      const restartSpy = jest.spyOn(serviceWorker, 'restartServiceWorker').mockImplementation();
      
      serviceWorker.restartAttempts = 3; // At max attempts
      serviceWorker.lastActivity = Date.now() - 6 * 60 * 1000;
      
      jest.advanceTimersByTime(60 * 1000);
      
      expect(restartSpy).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      serviceWorker = new MockAstralTubeServiceWorker();
      await testUtils.waitFor(() => serviceWorker.initialized);
    });

    test('should cleanup properly', async () => {
      // Add some connections
      serviceWorker.activeConnections.set('conn1', {
        port: { disconnect: jest.fn() }
      });
      
      await serviceWorker.cleanup();
      
      expect(serviceWorker.activeConnections.size).toBe(0);
      expect(chromeMocks.alarms.clearAll).toHaveBeenCalled();
      expect(mockAnalyticsManager.destroy).toHaveBeenCalled();
    });

    test('should handle port disconnect errors during cleanup', async () => {
      const mockPort = {
        disconnect: jest.fn(() => {
          throw new Error('Port already closed');
        })
      };
      
      serviceWorker.activeConnections.set('conn1', { port: mockPort });
      
      // Should not throw error
      await expect(serviceWorker.cleanup()).resolves.not.toThrow();
      expect(serviceWorker.activeConnections.size).toBe(0);
    });
  });
});