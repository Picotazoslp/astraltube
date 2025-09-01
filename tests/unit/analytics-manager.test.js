/**
 * AstralTube v3 - AnalyticsManager Unit Tests
 * Comprehensive tests for analytics, performance monitoring, and statistics
 */

import { AnalyticsManager } from '../../src/lib/analytics.js';
import { chromeMocks, chromeTestUtils } from '../mocks/chrome-api.js';

// Mock performance and requestAnimationFrame
global.PerformanceObserver = jest.fn().mockImplementation((callback) => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  takeRecords: jest.fn(() => [])
}));

global.requestAnimationFrame = jest.fn((callback) => {
  setTimeout(callback, 16); // ~60fps
  return 1;
});

global.performance = {
  ...global.performance,
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  memory: {
    usedJSHeapSize: 10000000,
    totalJSHeapSize: 20000000,
    jsHeapSizeLimit: 50000000
  },
  getEntriesByType: jest.fn(() => []),
  getEntriesByName: jest.fn(() => [])
};

describe('AnalyticsManager', () => {
  let analyticsManager;
  
  beforeEach(async () => {
    // Reset all mocks
    chromeTestUtils.resetMocks();
    jest.clearAllMocks();
    jest.clearAllTimers();
    
    // Use fake timers
    jest.useFakeTimers();
    
    // Create new AnalyticsManager instance
    analyticsManager = new AnalyticsManager();
  });

  afterEach(() => {
    if (analyticsManager) {
      analyticsManager.destroy();
    }
    analyticsManager = null;
    
    // Restore timers
    jest.useRealTimers();
  });

  describe('Constructor', () => {
    test('should initialize with default values', () => {
      expect(analyticsManager.initialized).toBe(false);
      expect(analyticsManager.sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
      expect(analyticsManager.startTime).toBeCloseTo(Date.now(), -2);
      expect(analyticsManager.events).toEqual([]);
      expect(analyticsManager.metrics).toBeInstanceOf(Map);
      expect(analyticsManager.performanceObserver).toBeNull();
      
      expect(analyticsManager.settings).toEqual({
        enabled: true,
        collectPerformance: true,
        collectUsage: true,
        anonymize: true,
        maxEvents: 1000
      });
    });
  });

  describe('initialize()', () => {
    test('should initialize successfully with default settings', async () => {
      chromeMocks.storage.local.get.mockResolvedValueOnce({});
      
      await analyticsManager.initialize();
      
      expect(analyticsManager.initialized).toBe(true);
      expect(chromeMocks.storage.local.get).toHaveBeenCalledWith('analyticsSettings');
    });

    test('should load custom settings from storage', async () => {
      const customSettings = {
        enabled: false,
        collectPerformance: false,
        anonymize: false,
        maxEvents: 500
      };
      
      chromeMocks.storage.local.get.mockResolvedValueOnce({
        analyticsSettings: customSettings
      });
      
      await analyticsManager.initialize();
      
      expect(analyticsManager.settings.enabled).toBe(false);
      expect(analyticsManager.settings.collectPerformance).toBe(false);
      expect(analyticsManager.settings.anonymize).toBe(false);
      expect(analyticsManager.settings.maxEvents).toBe(500);
    });

    test('should handle storage errors gracefully', async () => {
      chromeMocks.storage.local.get.mockRejectedValueOnce(new Error('Storage error'));
      
      await analyticsManager.initialize();
      
      expect(analyticsManager.initialized).toBe(true);
    });

    test('should not setup monitoring when disabled', async () => {
      chromeMocks.storage.local.get.mockResolvedValueOnce({
        analyticsSettings: { enabled: false }
      });
      
      await analyticsManager.initialize();
      
      expect(PerformanceObserver).not.toHaveBeenCalled();
    });
  });

  describe('Event Tracking', () => {
    beforeEach(async () => {
      await analyticsManager.initialize();
    });

    test('should track events with basic properties', () => {
      const eventName = 'test_event';
      const properties = { key: 'value', number: 42 };
      
      analyticsManager.trackEvent(eventName, properties);
      
      expect(analyticsManager.events).toHaveLength(1);
      
      const event = analyticsManager.events[0];
      expect(event.name).toBe(eventName);
      expect(event.properties).toEqual(properties);
      expect(event.sessionId).toBe(analyticsManager.sessionId);
      expect(event.timestamp).toBeCloseTo(Date.now(), -2);
      expect(event.id).toMatch(/^event_\d+_[a-z0-9]+$/);
    });

    test('should not track events when disabled', () => {
      analyticsManager.settings.enabled = false;
      
      analyticsManager.trackEvent('disabled_event');
      
      expect(analyticsManager.events).toHaveLength(0);
    });

    test('should not track events when usage collection is disabled', () => {
      analyticsManager.settings.collectUsage = false;
      
      analyticsManager.trackEvent('usage_event');
      
      expect(analyticsManager.events).toHaveLength(0);
    });

    test('should anonymize properties when enabled', () => {
      analyticsManager.settings.anonymize = true;
      
      const properties = {
        email: 'user@example.com',
        userId: 'user123',
        channelId: 'UCTest123',
        playlistId: 'PLTest123',
        url: 'https://youtube.com/watch?v=test123'
      };
      
      analyticsManager.trackEvent('sensitive_event', properties);
      
      const event = analyticsManager.events[0];
      expect(event.properties.email).toMatch(/^hash_[a-z0-9]+$/);
      expect(event.properties.userId).toMatch(/^hash_[a-z0-9]+$/);
      expect(event.properties.channelId).toMatch(/^hash_[a-z0-9]+$/);
      expect(event.properties.playlistId).toMatch(/^hash_[a-z0-9]+$/);
      expect(event.properties.domain).toBe('youtube.com');
      expect(event.properties.url).toBeUndefined();
    });

    test('should limit events array size', () => {
      analyticsManager.settings.maxEvents = 3;
      
      analyticsManager.trackEvent('event1');
      analyticsManager.trackEvent('event2');
      analyticsManager.trackEvent('event3');
      analyticsManager.trackEvent('event4'); // Should cause oldest to be removed
      
      expect(analyticsManager.events).toHaveLength(3);
      expect(analyticsManager.events[0].name).toBe('event2');
      expect(analyticsManager.events[2].name).toBe('event4');
    });
  });

  describe('Feature Usage Tracking', () => {
    beforeEach(async () => {
      await analyticsManager.initialize();
    });

    test('should track feature usage', () => {
      analyticsManager.trackFeatureUsage('playlist', 'create', { count: 1 });
      
      const event = analyticsManager.events[0];
      expect(event.name).toBe('playlist_create');
      expect(event.properties.feature).toBe('playlist');
      expect(event.properties.action).toBe('create');
      expect(event.properties.count).toBe(1);
    });

    test('should track playlist actions with anonymization', () => {
      analyticsManager.settings.anonymize = true;
      
      analyticsManager.trackPlaylistAction('view', 'PLTest123', { duration: 5000 });
      
      const event = analyticsManager.events[0];
      expect(event.name).toBe('playlist_view');
      expect(event.properties.playlistId).toMatch(/^hash_[a-z0-9]+$/);
      expect(event.properties.duration).toBe(5000);
    });

    test('should track collection actions', () => {
      analyticsManager.trackCollectionAction('create', 'collection123');
      
      const event = analyticsManager.events[0];
      expect(event.name).toBe('collection_create');
      expect(event.properties.collectionId).toMatch(/^hash_[a-z0-9]+$/);
    });

    test('should track UI interactions', () => {
      analyticsManager.trackUIInteraction('sidebar', 'toggle', { visible: true });
      
      const event = analyticsManager.events[0];
      expect(event.name).toBe('ui_interaction');
      expect(event.properties.element).toBe('sidebar');
      expect(event.properties.action).toBe('toggle');
      expect(event.properties.visible).toBe(true);
    });

    test('should track errors with context', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      
      analyticsManager.trackError(error, { context: 'test' });
      
      const event = analyticsManager.events[0];
      expect(event.name).toBe('error');
      expect(event.properties.message).toBe('Test error');
      expect(event.properties.stack).toBe('[REDACTED]'); // Anonymized
      expect(event.properties.context.context).toBe('test');
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await analyticsManager.initialize();
    });

    test('should setup performance monitoring when enabled', () => {
      analyticsManager.settings.collectPerformance = true;
      
      analyticsManager.setupPerformanceMonitoring();
      
      expect(PerformanceObserver).toHaveBeenCalled();
    });

    test('should not setup performance monitoring when disabled', () => {
      analyticsManager.settings.collectPerformance = false;
      
      analyticsManager.setupPerformanceMonitoring();
      
      expect(PerformanceObserver).not.toHaveBeenCalled();
    });

    test('should track performance entries', () => {
      const mockEntry = {
        name: 'test-resource',
        entryType: 'resource',
        startTime: 100,
        duration: 50,
        transferSize: 1024,
        encodedBodySize: 800
      };
      
      analyticsManager.trackPerformanceEntry(mockEntry);
      
      const event = analyticsManager.events[0];
      expect(event.name).toBe('performance_entry');
      expect(event.properties.name).toBe('test-resource');
      expect(event.properties.type).toBe('resource');
      expect(event.properties.duration).toBe(50);
      expect(event.properties.transferSize).toBe(1024);
    });

    test('should start memory monitoring', () => {
      const originalSetInterval = global.setInterval;
      const mockSetInterval = jest.fn();
      global.setInterval = mockSetInterval;
      
      analyticsManager.startMemoryMonitoring();
      
      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        30000
      );
      
      global.setInterval = originalSetInterval;
    });
  });

  describe('Metrics Management', () => {
    beforeEach(async () => {
      await analyticsManager.initialize();
    });

    test('should update metrics', () => {
      analyticsManager.updateMetric('test_metric', 100);
      analyticsManager.updateMetric('test_metric', 200);
      analyticsManager.updateMetric('test_metric', 150);
      
      const metrics = analyticsManager.getMetric('test_metric');
      expect(metrics).toEqual([100, 200, 150]);
    });

    test('should limit metric data size', () => {
      // Add 150 data points
      for (let i = 0; i < 150; i++) {
        analyticsManager.updateMetric('large_metric', i);
      }
      
      const metrics = analyticsManager.getMetric('large_metric');
      expect(metrics).toHaveLength(100); // Should be limited to 100
      expect(metrics[0]).toBe(50); // First 50 should be removed
      expect(metrics[99]).toBe(149); // Last value should be preserved
    });

    test('should calculate metric summary', () => {
      analyticsManager.updateMetric('summary_metric', 10);
      analyticsManager.updateMetric('summary_metric', 20);
      analyticsManager.updateMetric('summary_metric', 30);
      
      const summary = analyticsManager.getMetricSummary('summary_metric');
      
      expect(summary.count).toBe(3);
      expect(summary.sum).toBe(60);
      expect(summary.average).toBe(20);
      expect(summary.min).toBe(10);
      expect(summary.max).toBe(30);
      expect(summary.latest).toBe(30);
    });

    test('should handle empty metrics', () => {
      const summary = analyticsManager.getMetricSummary('empty_metric');
      expect(summary).toBeNull();
    });

    test('should handle object metrics', () => {
      analyticsManager.updateMetric('object_metric', { value: 100, timestamp: Date.now() });
      analyticsManager.updateMetric('object_metric', { value: 200, timestamp: Date.now() });
      
      const summary = analyticsManager.getMetricSummary('object_metric');
      expect(summary.average).toBe(150);
    });
  });

  describe('Benchmarking', () => {
    beforeEach(async () => {
      await analyticsManager.initialize();
    });

    test('should create and end benchmark', () => {
      const benchmark = analyticsManager.startBenchmark('test_benchmark');
      
      expect(benchmark.name).toBe('test_benchmark');
      expect(benchmark.startTime).toBeCloseTo(performance.now(), -1);
      
      // Simulate some time passing
      performance.now.mockReturnValueOnce(performance.now() + 100);
      
      const duration = benchmark.end();
      
      expect(duration).toBe(100);
      expect(analyticsManager.events).toHaveLength(1);
      expect(analyticsManager.events[0].name).toBe('benchmark');
      expect(analyticsManager.events[0].properties.duration).toBe(100);
    });

    test('should measure async functions', async () => {
      const asyncFunction = jest.fn(async (value) => {
        return value * 2;
      });
      
      const measuredFunction = analyticsManager.measureAsync('async_test', asyncFunction);
      
      const result = await measuredFunction(21);
      
      expect(result).toBe(42);
      expect(asyncFunction).toHaveBeenCalledWith(21);
      expect(analyticsManager.events).toHaveLength(1);
      expect(analyticsManager.events[0].name).toBe('benchmark');
    });

    test('should handle async function errors', async () => {
      const asyncFunction = jest.fn(async () => {
        throw new Error('Async error');
      });
      
      const measuredFunction = analyticsManager.measureAsync('async_error', asyncFunction);
      
      await expect(measuredFunction()).rejects.toThrow('Async error');
      
      expect(analyticsManager.events).toHaveLength(2); // benchmark + error
      expect(analyticsManager.events[1].name).toBe('error');
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      await analyticsManager.initialize();
    });

    test('should start session on initialization', () => {
      analyticsManager.startSession();
      
      const sessionEvent = analyticsManager.events.find(e => e.name === 'session_start');
      expect(sessionEvent).toBeDefined();
      expect(sessionEvent.properties.sessionId).toBe(analyticsManager.sessionId);
    });

    test('should end session and flush data', async () => {
      chromeMocks.storage.local.get.mockResolvedValueOnce({});
      chromeMocks.storage.local.set.mockResolvedValueOnce(undefined);
      
      analyticsManager.trackEvent('test_event'); // Add an event
      
      await analyticsManager.endSession();
      
      const sessionEvent = analyticsManager.events.find(e => e.name === 'session_end');
      expect(sessionEvent).toBeDefined();
      expect(sessionEvent.properties.sessionId).toBe(analyticsManager.sessionId);
      expect(sessionEvent.properties.eventsCount).toBeGreaterThan(0);
    });

    test('should update session history', async () => {
      chromeMocks.storage.local.get.mockResolvedValueOnce({
        sessionHistory: []
      });
      
      await analyticsManager.updateSessionHistory();
      
      expect(chromeMocks.storage.local.set).toHaveBeenCalledWith({
        sessionHistory: expect.arrayContaining([
          expect.objectContaining({
            sessionId: analyticsManager.sessionId,
            duration: expect.any(Number)
          })
        ])
      });
    });
  });

  describe('Data Management', () => {
    beforeEach(async () => {
      await analyticsManager.initialize();
    });

    test('should flush data to storage', async () => {
      chromeMocks.storage.local.get.mockResolvedValueOnce({});
      
      analyticsManager.trackEvent('event1');
      analyticsManager.trackEvent('event2');
      
      await analyticsManager.flushData();
      
      expect(chromeMocks.storage.local.set).toHaveBeenCalledWith({
        analyticsEvents: expect.arrayContaining([
          expect.objectContaining({ name: 'event1' }),
          expect.objectContaining({ name: 'event2' })
        ]),
        lastAnalyticsFlush: expect.any(Number)
      });
      
      expect(analyticsManager.events).toHaveLength(0); // Should be cleared
    });

    test('should limit stored events', async () => {
      // Mock existing events in storage
      const existingEvents = Array(4999).fill(0).map((_, i) => ({
        name: `existing_${i}`,
        timestamp: Date.now() - i * 1000
      }));
      
      chromeMocks.storage.local.get.mockResolvedValueOnce({
        analyticsEvents: existingEvents
      });
      
      analyticsManager.trackEvent('new_event1');
      analyticsManager.trackEvent('new_event2');
      
      await analyticsManager.flushData();
      
      const storedEvents = chromeMocks.storage.local.set.mock.calls[0][0].analyticsEvents;
      expect(storedEvents).toHaveLength(5000); // Should be limited
    });

    test('should export analytics data', async () => {
      const mockData = {
        analyticsEvents: [{ name: 'test_event' }],
        sessionHistory: [{ sessionId: 'session123' }],
        analyticsSettings: { enabled: true }
      };
      
      chromeMocks.storage.local.get.mockResolvedValueOnce(mockData);
      
      const exportData = await analyticsManager.exportAnalyticsData();
      
      expect(exportData.version).toBe('3.0.0');
      expect(exportData.analytics).toEqual(mockData);
      expect(exportData.timestamp).toBeCloseTo(Date.now(), -2);
    });

    test('should clear analytics data', async () => {
      analyticsManager.trackEvent('test_event');
      analyticsManager.updateMetric('test_metric', 100);
      
      await analyticsManager.clearAnalyticsData();
      
      expect(chromeMocks.storage.local.remove).toHaveBeenCalledWith([
        'analyticsEvents',
        'sessionHistory'
      ]);
      
      expect(analyticsManager.events).toHaveLength(0);
      expect(analyticsManager.metrics.size).toBe(0);
    });
  });

  describe('Usage Patterns', () => {
    beforeEach(async () => {
      await analyticsManager.initialize();
    });

    test('should get most used features', () => {
      analyticsManager.trackEvent('playlist_create');
      analyticsManager.trackEvent('playlist_view');
      analyticsManager.trackEvent('playlist_view');
      analyticsManager.trackEvent('collection_create');
      
      const features = analyticsManager.getMostUsedFeatures();
      
      expect(features[0]).toEqual({ feature: 'playlist', count: 3 });
      expect(features[1]).toEqual({ feature: 'collection', count: 1 });
    });

    test('should get peak usage hours', () => {
      const now = new Date();
      const hour10 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10);
      const hour14 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14);
      
      analyticsManager.events = [
        { name: 'event1', timestamp: hour10.getTime() },
        { name: 'event2', timestamp: hour10.getTime() },
        { name: 'event3', timestamp: hour14.getTime() }
      ];
      
      const peakHours = analyticsManager.getPeakUsageHours();
      
      expect(peakHours[0]).toEqual({ hour: 10, count: 2 });
      expect(peakHours[1]).toEqual({ hour: 14, count: 1 });
    });

    test('should calculate average session duration', async () => {
      const sessionHistory = [
        { duration: 5000 },
        { duration: 3000 },
        { duration: 7000 }
      ];
      
      chromeMocks.storage.local.get.mockResolvedValueOnce({ sessionHistory });
      
      const avgDuration = await analyticsManager.getAverageSessionDuration();
      expect(avgDuration).toBe(5000); // (5000 + 3000 + 7000) / 3
    });

    test('should get total sessions', async () => {
      const sessionHistory = Array(50).fill({ sessionId: 'test' });
      
      chromeMocks.storage.local.get.mockResolvedValueOnce({ sessionHistory });
      
      const totalSessions = await analyticsManager.getTotalSessions();
      expect(totalSessions).toBe(50);
    });
  });

  describe('Settings Management', () => {
    beforeEach(async () => {
      await analyticsManager.initialize();
    });

    test('should update settings and save them', () => {
      const newSettings = {
        enabled: false,
        maxEvents: 500
      };
      
      analyticsManager.updateSettings(newSettings);
      
      expect(analyticsManager.settings.enabled).toBe(false);
      expect(analyticsManager.settings.maxEvents).toBe(500);
      expect(analyticsManager.settings.collectPerformance).toBe(true); // Should keep existing
      
      expect(chromeMocks.storage.local.set).toHaveBeenCalledWith({
        analyticsSettings: analyticsManager.settings
      });
    });

    test('should restart performance monitoring when settings change', () => {
      // Setup initial performance monitoring
      analyticsManager.setupPerformanceMonitoring();
      const initialObserver = analyticsManager.performanceObserver;
      
      // Change performance collection setting
      analyticsManager.updateSettings({ collectPerformance: false });
      
      expect(initialObserver.disconnect).toHaveBeenCalled();
      expect(analyticsManager.performanceObserver).toBeNull();
    });
  });

  describe('Privacy and Anonymization', () => {
    beforeEach(async () => {
      await analyticsManager.initialize();
    });

    test('should hash IDs consistently', () => {
      const id = 'test123';
      const hash1 = analyticsManager.hashId(id);
      const hash2 = analyticsManager.hashId(id);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^hash_[a-z0-9]+$/);
    });

    test('should get current URL with anonymization', () => {
      analyticsManager.settings.anonymize = true;
      
      // Mock window.location
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.youtube.com/watch?v=test123' },
        writable: true
      });
      
      const url = analyticsManager.getCurrentUrl();
      expect(url).toBe('www.youtube.com');
    });

    test('should get current URL without anonymization', () => {
      analyticsManager.settings.anonymize = false;
      
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.youtube.com/watch?v=test123' },
        writable: true
      });
      
      const url = analyticsManager.getCurrentUrl();
      expect(url).toBe('https://www.youtube.com/watch?v=test123');
    });
  });

  describe('Health Check', () => {
    beforeEach(async () => {
      await analyticsManager.initialize();
    });

    test('should return health status', () => {
      analyticsManager.trackEvent('test_event');
      analyticsManager.updateMetric('memory_usage', { used: 10000000, timestamp: Date.now() });
      analyticsManager.updateMetric('frame_rate', 60);
      
      const health = analyticsManager.getHealthStatus();
      
      expect(health.status).toBe('healthy');
      expect(health.sessionDuration).toBeGreaterThan(0);
      expect(health.eventsCount).toBe(1);
      expect(health.metricsCount).toBe(2);
      expect(health.memoryUsage).toBeDefined();
      expect(health.frameRate).toBe(60);
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      await analyticsManager.initialize();
    });

    test('should destroy properly', () => {
      analyticsManager.trackEvent('test_event');
      analyticsManager.updateMetric('test_metric', 100);
      
      // Setup performance observer
      analyticsManager.setupPerformanceMonitoring();
      
      analyticsManager.destroy();
      
      expect(analyticsManager.initialized).toBe(false);
      expect(analyticsManager.events).toHaveLength(0);
      expect(analyticsManager.metrics.size).toBe(0);
      
      if (analyticsManager.performanceObserver) {
        expect(analyticsManager.performanceObserver.disconnect).toHaveBeenCalled();
      }
    });
  });
});