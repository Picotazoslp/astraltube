/**
 * AstralTube v3 - Performance Benchmarking & Regression Tests
 * Comprehensive performance testing and monitoring for optimization
 */

import { chromeMocks, chromeTestUtils } from '../mocks/chrome-api.js';
import { youTubeAPIMocks } from '../mocks/youtube-api.js';
import { domMocks, mockYouTubePage } from '../mocks/dom.js';

// Performance Testing Framework
class PerformanceTestFramework {
  constructor() {
    this.benchmarks = new Map();
    this.baselines = new Map();
    this.thresholds = {
      apiCall: 1000,        // 1 second max for API calls
      domOperation: 100,    // 100ms max for DOM operations
      initialization: 2000, // 2 seconds max for initialization
      rendering: 16.67,     // 60fps = 16.67ms per frame
      memory: 50 * 1024 * 1024 // 50MB memory threshold
    };
    this.performanceObserver = null;
    this.memoryBaseline = null;
  }

  initialize() {
    this.setupPerformanceObserver();
    this.recordMemoryBaseline();
  }

  setupPerformanceObserver() {
    if (typeof PerformanceObserver !== 'undefined') {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordPerformanceEntry(entry);
        }
      });
      
      this.performanceObserver.observe({ 
        entryTypes: ['measure', 'mark', 'navigation', 'resource'] 
      });
    }
  }

  recordMemoryBaseline() {
    if (performance.memory) {
      this.memoryBaseline = {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
        timestamp: performance.now()
      };
    }
  }

  recordPerformanceEntry(entry) {
    const benchmarkName = `${entry.entryType}_${entry.name}`;
    if (!this.benchmarks.has(benchmarkName)) {
      this.benchmarks.set(benchmarkName, []);
    }
    
    this.benchmarks.get(benchmarkName).push({
      duration: entry.duration,
      startTime: entry.startTime,
      timestamp: Date.now()
    });
  }

  async benchmark(name, asyncFunction, options = {}) {
    const iterations = options.iterations || 1;
    const warmupRuns = options.warmup || 0;
    const results = [];
    
    // Warm up runs
    for (let i = 0; i < warmupRuns; i++) {
      try {
        await asyncFunction();
      } catch (error) {
        // Ignore warmup errors
      }
    }
    
    // Actual benchmark runs
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      const startMemory = this.getCurrentMemoryUsage();
      
      try {
        performance.mark(`${name}_start`);
        const result = await asyncFunction();
        performance.mark(`${name}_end`);
        performance.measure(name, `${name}_start`, `${name}_end`);
        
        const endTime = performance.now();
        const endMemory = this.getCurrentMemoryUsage();
        const duration = endTime - startTime;
        
        results.push({
          duration,
          memoryDelta: endMemory - startMemory,
          success: true,
          result,
          iteration: i + 1
        });
        
      } catch (error) {
        const endTime = performance.now();
        results.push({
          duration: endTime - startTime,
          memoryDelta: 0,
          success: false,
          error: error.message,
          iteration: i + 1
        });
      }
    }
    
    const stats = this.calculateStatistics(results);
    this.baselines.set(name, stats);
    
    return {
      name,
      stats,
      results,
      threshold: this.thresholds[this.categorizeTest(name)] || 1000
    };
  }

  calculateStatistics(results) {
    const successfulResults = results.filter(r => r.success);
    const durations = successfulResults.map(r => r.duration);
    const memoryDeltas = successfulResults.map(r => r.memoryDelta);
    
    if (durations.length === 0) {
      return {
        avg: 0,
        min: 0,
        max: 0,
        median: 0,
        p95: 0,
        p99: 0,
        successRate: 0,
        totalRuns: results.length,
        avgMemoryDelta: 0
      };
    }
    
    durations.sort((a, b) => a - b);
    
    return {
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
      median: durations[Math.floor(durations.length / 2)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)],
      successRate: (successfulResults.length / results.length) * 100,
      totalRuns: results.length,
      avgMemoryDelta: memoryDeltas.reduce((a, b) => a + b, 0) / memoryDeltas.length
    };
  }

  categorizeTest(testName) {
    const name = testName.toLowerCase();
    if (name.includes('api') || name.includes('fetch') || name.includes('request')) {
      return 'apiCall';
    }
    if (name.includes('dom') || name.includes('render') || name.includes('ui')) {
      return 'domOperation';
    }
    if (name.includes('init') || name.includes('setup') || name.includes('start')) {
      return 'initialization';
    }
    if (name.includes('render') || name.includes('animation') || name.includes('frame')) {
      return 'rendering';
    }
    return 'general';
  }

  compareWithBaseline(testName, currentStats) {
    const baseline = this.baselines.get(testName);
    if (!baseline) {
      return { status: 'no-baseline', message: 'No baseline available for comparison' };
    }
    
    const regressionThreshold = 1.2; // 20% slower is considered regression
    const improvementThreshold = 0.9; // 10% faster is considered improvement
    
    const avgRatio = currentStats.avg / baseline.avg;
    const p95Ratio = currentStats.p95 / baseline.p95;
    
    if (avgRatio > regressionThreshold || p95Ratio > regressionThreshold) {
      return {
        status: 'regression',
        message: `Performance regression detected: ${((avgRatio - 1) * 100).toFixed(1)}% slower`,
        details: {
          avgChange: ((avgRatio - 1) * 100).toFixed(1),
          p95Change: ((p95Ratio - 1) * 100).toFixed(1),
          baseline,
          current: currentStats
        }
      };
    }
    
    if (avgRatio < improvementThreshold && p95Ratio < improvementThreshold) {
      return {
        status: 'improvement',
        message: `Performance improvement: ${((1 - avgRatio) * 100).toFixed(1)}% faster`,
        details: {
          avgChange: ((1 - avgRatio) * 100).toFixed(1),
          p95Change: ((1 - p95Ratio) * 100).toFixed(1),
          baseline,
          current: currentStats
        }
      };
    }
    
    return {
      status: 'stable',
      message: 'Performance is stable compared to baseline',
      details: {
        avgChange: ((avgRatio - 1) * 100).toFixed(1),
        p95Change: ((p95Ratio - 1) * 100).toFixed(1),
        baseline,
        current: currentStats
      }
    };
  }

  getCurrentMemoryUsage() {
    return performance.memory ? performance.memory.usedJSHeapSize : 0;
  }

  measureMemoryLeak(testFunction, iterations = 10) {
    const memoryMeasurements = [];
    
    return new Promise(async (resolve) => {
      for (let i = 0; i < iterations; i++) {
        const beforeMemory = this.getCurrentMemoryUsage();
        
        try {
          await testFunction();
        } catch (error) {
          // Continue measuring even if test fails
        }
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        // Wait a bit for GC
        await new Promise(r => setTimeout(r, 100));
        
        const afterMemory = this.getCurrentMemoryUsage();
        memoryMeasurements.push({
          iteration: i + 1,
          before: beforeMemory,
          after: afterMemory,
          delta: afterMemory - beforeMemory
        });
      }
      
      const totalMemoryGrowth = memoryMeasurements.reduce((sum, m) => sum + m.delta, 0);
      const avgGrowthPerIteration = totalMemoryGrowth / iterations;
      
      resolve({
        measurements: memoryMeasurements,
        totalGrowth: totalMemoryGrowth,
        avgGrowthPerIteration,
        hasMemoryLeak: avgGrowthPerIteration > 1024 * 1024, // 1MB per iteration is concerning
        memoryEfficiency: totalMemoryGrowth < this.thresholds.memory
      });
    });
  }

  async measureRenderPerformance(renderFunction, frames = 60) {
    const frameTimes = [];
    let frameCount = 0;
    
    return new Promise((resolve) => {
      const measureFrame = (timestamp) => {
        if (frameCount === 0) {
          frameTimes.push(timestamp);
        } else {
          const frameTime = timestamp - frameTimes[frameTimes.length - 1];
          frameTimes.push(timestamp);
          
          if (frameTime > this.thresholds.rendering) {
            // Frame took longer than 16.67ms (60fps threshold)
          }
        }
        
        frameCount++;
        
        if (frameCount < frames) {
          try {
            renderFunction();
          } catch (error) {
            // Continue measuring even if render fails
          }
          requestAnimationFrame(measureFrame);
        } else {
          // Calculate render performance metrics
          const frameDeltas = [];
          for (let i = 1; i < frameTimes.length; i++) {
            frameDeltas.push(frameTimes[i] - frameTimes[i - 1]);
          }
          
          const avgFrameTime = frameDeltas.reduce((a, b) => a + b, 0) / frameDeltas.length;
          const maxFrameTime = Math.max(...frameDeltas);
          const fps = 1000 / avgFrameTime;
          const droppedFrames = frameDeltas.filter(t => t > this.thresholds.rendering).length;
          
          resolve({
            avgFrameTime,
            maxFrameTime,
            fps,
            droppedFrames,
            frameDropPercentage: (droppedFrames / frameDeltas.length) * 100,
            smooth: droppedFrames < frameDeltas.length * 0.1 // Less than 10% dropped frames
          });
        }
      };
      
      requestAnimationFrame(measureFrame);
    });
  }

  generatePerformanceReport() {
    const report = {
      timestamp: Date.now(),
      summary: {
        totalBenchmarks: this.benchmarks.size,
        memoryBaseline: this.memoryBaseline,
        currentMemory: this.getCurrentMemoryUsage()
      },
      benchmarks: {},
      regressions: [],
      improvements: []
    };
    
    for (const [name, baseline] of this.baselines.entries()) {
      report.benchmarks[name] = baseline;
      
      // Check against thresholds
      const threshold = this.thresholds[this.categorizeTest(name)] || 1000;
      if (baseline.avg > threshold) {
        report.regressions.push({
          name,
          threshold,
          actual: baseline.avg,
          severity: baseline.avg > threshold * 2 ? 'critical' : 'warning'
        });
      }
    }
    
    return report;
  }

  cleanup() {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    this.benchmarks.clear();
    this.baselines.clear();
  }
}

// Mock implementations for testing
class MockServiceWorkerPerformance {
  constructor() {
    this.initialized = false;
    this.storage = new Map();
    this.apiCalls = 0;
  }

  async initialize() {
    // Simulate initialization time
    await this.delay(Math.random() * 100 + 50);
    this.initialized = true;
  }

  async fetchPlaylists() {
    this.apiCalls++;
    // Simulate network delay with some variance
    await this.delay(Math.random() * 200 + 100);
    
    // Simulate memory allocation
    const data = Array(100).fill(0).map((_, i) => ({
      id: `playlist_${i}`,
      name: `Playlist ${i}`,
      videos: Array(10).fill(0).map((_, j) => ({ id: `video_${i}_${j}` }))
    }));
    
    return data;
  }

  async createPlaylist(data) {
    await this.delay(Math.random() * 150 + 50);
    const playlist = {
      id: `new_playlist_${Date.now()}`,
      ...data,
      created: Date.now()
    };
    this.storage.set(playlist.id, playlist);
    return playlist;
  }

  async bulkOperation(items) {
    // Simulate processing multiple items
    const results = [];
    for (const item of items) {
      await this.delay(10); // Small delay per item
      results.push({ id: item.id, processed: true });
    }
    return results;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class MockContentScriptPerformance {
  constructor() {
    this.elements = [];
    this.observers = [];
  }

  renderSidebar() {
    // Simulate DOM operations
    for (let i = 0; i < 50; i++) {
      const element = document.createElement('div');
      element.className = 'sidebar-item';
      element.textContent = `Item ${i}`;
      this.elements.push(element);
      document.body.appendChild(element);
    }
  }

  updatePlaylistUI(playlists) {
    // Simulate UI updates
    this.elements.forEach((element, index) => {
      if (playlists[index]) {
        element.textContent = playlists[index].name;
        element.classList.add('updated');
      }
    });
  }

  setupObservers() {
    // Simulate setting up multiple observers
    for (let i = 0; i < 5; i++) {
      const observer = new MutationObserver(() => {});
      observer.observe(document.body, { childList: true });
      this.observers.push(observer);
    }
  }

  cleanup() {
    this.elements.forEach(el => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    this.elements = [];
    
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

describe('Performance Benchmarking & Regression Tests', () => {
  let performanceFramework;
  let mockServiceWorker;
  let mockContentScript;

  beforeEach(async () => {
    performanceFramework = new PerformanceTestFramework();
    performanceFramework.initialize();
    
    mockServiceWorker = new MockServiceWorkerPerformance();
    mockContentScript = new MockContentScriptPerformance();
    
    // Setup DOM environment
    mockYouTubePage();
    
    // Use fake timers for consistent testing
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (mockContentScript) {
      mockContentScript.cleanup();
    }
    performanceFramework.cleanup();
    
    jest.useRealTimers();
  });

  describe('Service Worker Performance', () => {
    test('should initialize service worker within performance threshold', async () => {
      const benchmark = await performanceFramework.benchmark(
        'serviceWorkerInit',
        () => mockServiceWorker.initialize(),
        { iterations: 5 }
      );

      expect(benchmark.stats.avg).toBeLessThan(performanceFramework.thresholds.initialization);
      expect(benchmark.stats.successRate).toBe(100);
      expect(benchmark.stats.p95).toBeLessThan(performanceFramework.thresholds.initialization * 1.5);
    });

    test('should fetch playlists within API call threshold', async () => {
      await mockServiceWorker.initialize();
      
      const benchmark = await performanceFramework.benchmark(
        'fetchPlaylists',
        () => mockServiceWorker.fetchPlaylists(),
        { iterations: 10, warmup: 2 }
      );

      expect(benchmark.stats.avg).toBeLessThan(performanceFramework.thresholds.apiCall);
      expect(benchmark.stats.successRate).toBe(100);
      
      // Check for consistency
      const coefficient = (benchmark.stats.max - benchmark.stats.min) / benchmark.stats.avg;
      expect(coefficient).toBeLessThan(1.0); // Variance should not be too high
    });

    test('should handle bulk operations efficiently', async () => {
      await mockServiceWorker.initialize();
      
      const bulkItems = Array(100).fill(0).map((_, i) => ({ id: `item_${i}` }));
      
      const benchmark = await performanceFramework.benchmark(
        'bulkOperation',
        () => mockServiceWorker.bulkOperation(bulkItems),
        { iterations: 3 }
      );

      expect(benchmark.stats.avg).toBeLessThan(2000); // 2 seconds for 100 items
      expect(benchmark.stats.successRate).toBe(100);
    });

    test('should not have memory leaks in repeated API calls', async () => {
      await mockServiceWorker.initialize();
      
      const memoryTest = await performanceFramework.measureMemoryLeak(
        () => mockServiceWorker.fetchPlaylists(),
        20
      );

      expect(memoryTest.hasMemoryLeak).toBe(false);
      expect(memoryTest.avgGrowthPerIteration).toBeLessThan(100 * 1024); // Less than 100KB growth per iteration
      expect(memoryTest.memoryEfficiency).toBe(true);
    });
  });

  describe('Content Script Performance', () => {
    test('should render sidebar within DOM operation threshold', async () => {
      const benchmark = await performanceFramework.benchmark(
        'renderSidebar',
        () => mockContentScript.renderSidebar(),
        { iterations: 5 }
      );

      expect(benchmark.stats.avg).toBeLessThan(performanceFramework.thresholds.domOperation * 2); // Allow some flexibility for DOM
      expect(benchmark.stats.successRate).toBe(100);
      
      // Clean up after each test
      mockContentScript.cleanup();
    });

    test('should update UI efficiently', async () => {
      // Setup initial sidebar
      mockContentScript.renderSidebar();
      
      const mockPlaylists = Array(50).fill(0).map((_, i) => ({
        id: `playlist_${i}`,
        name: `Playlist ${i}`
      }));

      const benchmark = await performanceFramework.benchmark(
        'updatePlaylistUI',
        () => mockContentScript.updatePlaylistUI(mockPlaylists),
        { iterations: 10 }
      );

      expect(benchmark.stats.avg).toBeLessThan(performanceFramework.thresholds.domOperation);
      expect(benchmark.stats.successRate).toBe(100);
    });

    test('should maintain smooth rendering performance', async () => {
      let frame = 0;
      const renderPerformance = await performanceFramework.measureRenderPerformance(
        () => {
          // Simulate animation frame
          frame++;
          const element = document.createElement('div');
          element.style.transform = `translateX(${frame}px)`;
          document.body.appendChild(element);
          
          if (frame > 100) {
            element.remove();
          }
        },
        120 // Measure 120 frames (2 seconds at 60fps)
      );

      expect(renderPerformance.fps).toBeGreaterThan(55); // Should maintain close to 60fps
      expect(renderPerformance.frameDropPercentage).toBeLessThan(10); // Less than 10% dropped frames
      expect(renderPerformance.smooth).toBe(true);
    });

    test('should setup observers without performance impact', async () => {
      const benchmark = await performanceFramework.benchmark(
        'setupObservers',
        () => mockContentScript.setupObservers(),
        { iterations: 5 }
      );

      expect(benchmark.stats.avg).toBeLessThan(performanceFramework.thresholds.domOperation);
      expect(benchmark.stats.successRate).toBe(100);
    });
  });

  describe('Integration Performance', () => {
    test('should handle service worker and content script communication efficiently', async () => {
      await mockServiceWorker.initialize();
      
      const integrationTest = async () => {
        // Simulate full workflow
        const playlists = await mockServiceWorker.fetchPlaylists();
        mockContentScript.renderSidebar();
        mockContentScript.updatePlaylistUI(playlists);
        return playlists.length;
      };

      const benchmark = await performanceFramework.benchmark(
        'integrationWorkflow',
        integrationTest,
        { iterations: 3 }
      );

      expect(benchmark.stats.avg).toBeLessThan(1500); // 1.5 seconds for full workflow
      expect(benchmark.stats.successRate).toBe(100);
    });

    test('should handle concurrent operations without degradation', async () => {
      await mockServiceWorker.initialize();
      
      const concurrentTest = async () => {
        const promises = [];
        
        // Simulate multiple concurrent operations
        for (let i = 0; i < 5; i++) {
          promises.push(mockServiceWorker.fetchPlaylists());
        }
        
        const results = await Promise.all(promises);
        return results.length;
      };

      const benchmark = await performanceFramework.benchmark(
        'concurrentOperations',
        concurrentTest,
        { iterations: 3 }
      );

      expect(benchmark.stats.avg).toBeLessThan(2000); // Should handle concurrency well
      expect(benchmark.stats.successRate).toBe(100);
    });
  });

  describe('Regression Testing', () => {
    test('should detect performance regression', async () => {
      // Set a baseline
      const baselineBenchmark = await performanceFramework.benchmark(
        'regressionTest',
        () => mockServiceWorker.fetchPlaylists(),
        { iterations: 5 }
      );

      // Simulate a slower version
      const slowFunction = async () => {
        await mockServiceWorker.fetchPlaylists();
        await new Promise(resolve => setTimeout(resolve, 500)); // Add 500ms delay
      };

      const currentBenchmark = await performanceFramework.benchmark(
        'regressionTestSlow',
        slowFunction,
        { iterations: 5 }
      );

      const comparison = performanceFramework.compareWithBaseline('regressionTest', currentBenchmark.stats);
      
      expect(comparison.status).toBe('regression');
      expect(parseFloat(comparison.details.avgChange)).toBeGreaterThan(20); // More than 20% slower
    });

    test('should detect performance improvement', async () => {
      // Set a baseline with artificial delay
      const slowFunction = async () => {
        await mockServiceWorker.fetchPlaylists();
        await new Promise(resolve => setTimeout(resolve, 200));
      };

      await performanceFramework.benchmark(
        'improvementTest',
        slowFunction,
        { iterations: 3 }
      );

      // Test faster version (just the original function)
      const fastBenchmark = await performanceFramework.benchmark(
        'improvementTestFast',
        () => mockServiceWorker.fetchPlaylists(),
        { iterations: 3 }
      );

      const comparison = performanceFramework.compareWithBaseline('improvementTest', fastBenchmark.stats);
      
      expect(comparison.status).toBe('improvement');
    });
  });

  describe('Memory Performance', () => {
    test('should not exceed memory thresholds during heavy operations', async () => {
      const memoryIntensiveOperation = async () => {
        // Simulate memory-intensive operations
        const largeArray = new Array(10000).fill(0).map((_, i) => ({
          id: i,
          data: new Array(100).fill(`data_${i}`)
        }));
        
        // Process the data
        return largeArray.filter(item => item.id % 2 === 0);
      };

      const memoryTest = await performanceFramework.measureMemoryLeak(
        memoryIntensiveOperation,
        10
      );

      expect(memoryTest.totalGrowth).toBeLessThan(performanceFramework.thresholds.memory);
      expect(memoryTest.memoryEfficiency).toBe(true);
    });

    test('should properly clean up resources', async () => {
      const resourceTest = async () => {
        // Create and immediately clean up resources
        mockContentScript.renderSidebar();
        mockContentScript.setupObservers();
        mockContentScript.cleanup();
      };

      const memoryTest = await performanceFramework.measureMemoryLeak(resourceTest, 15);

      expect(memoryTest.avgGrowthPerIteration).toBeLessThan(500 * 1024); // Less than 500KB growth per iteration
      expect(memoryTest.hasMemoryLeak).toBe(false);
    });
  });

  describe('Load Testing', () => {
    test('should handle high load scenarios', async () => {
      await mockServiceWorker.initialize();
      
      const highLoadTest = async () => {
        const promises = [];
        
        // Simulate 20 concurrent API calls
        for (let i = 0; i < 20; i++) {
          promises.push(mockServiceWorker.fetchPlaylists());
        }
        
        const results = await Promise.all(promises);
        return results;
      };

      const benchmark = await performanceFramework.benchmark(
        'highLoadTest',
        highLoadTest,
        { iterations: 2 }
      );

      expect(benchmark.stats.successRate).toBe(100);
      expect(benchmark.stats.avg).toBeLessThan(5000); // Should handle high load within 5 seconds
    });

    test('should maintain performance with large datasets', async () => {
      const largeDataTest = async () => {
        // Create large dataset
        const items = Array(1000).fill(0).map((_, i) => ({ id: `item_${i}` }));
        
        // Process large dataset
        return await mockServiceWorker.bulkOperation(items);
      };

      const benchmark = await performanceFramework.benchmark(
        'largeDatasetTest',
        largeDataTest,
        { iterations: 2 }
      );

      expect(benchmark.stats.successRate).toBe(100);
      expect(benchmark.stats.avg).toBeLessThan(15000); // Should process 1000 items within 15 seconds
    });
  });

  describe('Performance Monitoring', () => {
    test('should generate comprehensive performance report', () => {
      // Run several benchmarks first
      return Promise.all([
        performanceFramework.benchmark('reportTest1', () => mockServiceWorker.fetchPlaylists()),
        performanceFramework.benchmark('reportTest2', () => mockContentScript.renderSidebar()),
        performanceFramework.benchmark('reportTest3', () => mockServiceWorker.createPlaylist({ name: 'Test' }))
      ]).then(() => {
        mockContentScript.cleanup();
        
        const report = performanceFramework.generatePerformanceReport();
        
        expect(report).toHaveProperty('timestamp');
        expect(report.summary.totalBenchmarks).toBeGreaterThan(0);
        expect(report).toHaveProperty('benchmarks');
        expect(report).toHaveProperty('regressions');
        expect(report).toHaveProperty('improvements');
        
        // Check that benchmarks contain expected data
        Object.values(report.benchmarks).forEach(benchmark => {
          expect(benchmark).toHaveProperty('avg');
          expect(benchmark).toHaveProperty('min');
          expect(benchmark).toHaveProperty('max');
          expect(benchmark).toHaveProperty('successRate');
        });
      });
    });
  });

  describe('Stress Testing', () => {
    test('should maintain stability under stress', async () => {
      await mockServiceWorker.initialize();
      
      const stressTest = async () => {
        // Rapid-fire operations
        const operations = [];
        
        for (let i = 0; i < 50; i++) {
          operations.push(mockServiceWorker.fetchPlaylists());
          
          if (i % 10 === 0) {
            operations.push(mockServiceWorker.createPlaylist({ name: `Stress ${i}` }));
          }
        }
        
        const results = await Promise.allSettled(operations);
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        
        return { total: operations.length, successful: successCount };
      };

      const benchmark = await performanceFramework.benchmark(
        'stressTest',
        stressTest,
        { iterations: 1 }
      );

      expect(benchmark.stats.successRate).toBe(100);
      
      // Check that most operations succeeded even under stress
      expect(benchmark.results[0].result.successful / benchmark.results[0].result.total).toBeGreaterThan(0.9);
    });
  });
});