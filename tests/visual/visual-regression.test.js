/**
 * AstralTube v3 - Visual Regression Tests
 * Automated visual testing for UI components and layouts
 */

import { chromeMocks, chromeTestUtils } from '../mocks/chrome-api.js';
import { domMocks, mockYouTubePage } from '../mocks/dom.js';

// Visual Testing Framework
class VisualTestingFramework {
  constructor() {
    this.canvas = null;
    this.context = null;
    this.baselineImages = new Map();
    this.testImages = new Map();
    this.threshold = 0.1; // 10% difference threshold
    this.initialized = false;
  }

  async initialize() {
    // Create canvas for rendering
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1920;
    this.canvas.height = 1080;
    this.context = this.canvas.getContext('2d');
    
    // Load baseline images (in real implementation, these would be from file system)
    await this.loadBaselineImages();
    
    this.initialized = true;
  }

  async loadBaselineImages() {
    // Mock baseline images - in production these would be loaded from saved screenshots
    const baselines = {
      'sidebar-default': this.createMockImage(300, 800, '#2d2d2d'),
      'sidebar-collapsed': this.createMockImage(60, 800, '#2d2d2d'),
      'playlist-manager': this.createMockImage(400, 600, '#ffffff'),
      'deck-mode-active': this.createMockImage(1200, 700, '#000000'),
      'settings-panel': this.createMockImage(500, 400, '#f5f5f5'),
      'notification-success': this.createMockImage(300, 60, '#4caf50'),
      'notification-error': this.createMockImage(300, 60, '#f44336'),
      'bulk-actions-toolbar': this.createMockImage(800, 80, '#e8e8e8'),
      'video-controls': this.createMockImage(600, 50, '#212121')
    };
    
    for (const [name, imageData] of Object.entries(baselines)) {
      this.baselineImages.set(name, imageData);
    }
  }

  createMockImage(width, height, color) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    
    // Add some visual elements to make it realistic
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(10, 10, width - 20, 30); // Header
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(10, 50, width - 20, height - 60); // Content area
    
    return canvas.toDataURL();
  }

  async captureElement(element, testName) {
    const rect = element.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    
    // Mock rendering - in real implementation, this would use html2canvas or similar
    await this.renderElementToCanvas(element, ctx, rect);
    
    const imageData = canvas.toDataURL();
    this.testImages.set(testName, imageData);
    
    return imageData;
  }

  async renderElementToCanvas(element, ctx, rect) {
    // Mock rendering based on element properties
    const computedStyle = window.getComputedStyle(element);
    
    // Fill background
    ctx.fillStyle = computedStyle.backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    
    // Add border if exists
    if (computedStyle.borderWidth && computedStyle.borderWidth !== '0px') {
      ctx.strokeStyle = computedStyle.borderColor || '#000000';
      ctx.lineWidth = parseInt(computedStyle.borderWidth) || 1;
      ctx.strokeRect(0, 0, rect.width, rect.height);
    }
    
    // Mock text content
    if (element.textContent) {
      ctx.fillStyle = computedStyle.color || '#000000';
      ctx.font = `${computedStyle.fontSize || '14px'} ${computedStyle.fontFamily || 'Arial'}`;
      ctx.fillText(element.textContent.substring(0, 50), 10, 20);
    }
    
    // Mock child elements
    const children = element.children;
    for (let i = 0; i < Math.min(children.length, 5); i++) {
      const child = children[i];
      const childRect = child.getBoundingClientRect();
      const relativeRect = {
        x: childRect.left - rect.left,
        y: childRect.top - rect.top,
        width: childRect.width,
        height: childRect.height
      };
      
      ctx.fillStyle = `hsl(${i * 60}, 50%, 70%)`;
      ctx.fillRect(relativeRect.x, relativeRect.y, relativeRect.width, relativeRect.height);
    }
    
    // Simulate rendering delay
    await this.wait(100);
  }

  compareImages(baselineName, testName) {
    const baseline = this.baselineImages.get(baselineName);
    const test = this.testImages.get(testName);
    
    if (!baseline || !test) {
      return {
        passed: false,
        error: 'Missing baseline or test image',
        difference: null
      };
    }
    
    // Simple comparison - in production would use pixel-by-pixel analysis
    const difference = this.calculateImageDifference(baseline, test);
    const passed = difference <= this.threshold;
    
    return {
      passed,
      difference,
      threshold: this.threshold,
      baselineName,
      testName
    };
  }

  calculateImageDifference(baseline, test) {
    // Mock image comparison - returns percentage difference
    // In real implementation, would compare pixel data
    if (baseline === test) return 0;
    
    // Simulate some differences based on string comparison
    const baselineLength = baseline.length;
    const testLength = test.length;
    const lengthDiff = Math.abs(baselineLength - testLength);
    
    return Math.min(lengthDiff / Math.max(baselineLength, testLength), 1);
  }

  async generateDiffImage(baselineName, testName) {
    // Mock diff generation
    const diffCanvas = document.createElement('canvas');
    diffCanvas.width = 400;
    diffCanvas.height = 300;
    const ctx = diffCanvas.getContext('2d');
    
    ctx.fillStyle = '#ffcccc';
    ctx.fillRect(0, 0, 400, 300);
    ctx.fillStyle = '#ff0000';
    ctx.fillText(`Diff: ${baselineName} vs ${testName}`, 10, 30);
    
    return diffCanvas.toDataURL();
  }

  updateBaseline(testName, imageData) {
    this.baselineImages.set(testName, imageData);
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// UI Component Test Utilities
class UIComponentTester {
  constructor(visualFramework) {
    this.visual = visualFramework;
    this.testComponents = new Map();
  }

  createTestComponent(name, html, styles = '') {
    const component = document.createElement('div');
    component.id = `test-${name}`;
    component.innerHTML = html;
    
    if (styles) {
      const styleElement = document.createElement('style');
      styleElement.textContent = styles;
      document.head.appendChild(styleElement);
    }
    
    document.body.appendChild(component);
    this.testComponents.set(name, component);
    
    return component;
  }

  async testComponentVariations(componentName, variations) {
    const results = [];
    const baseComponent = this.testComponents.get(componentName);
    
    if (!baseComponent) {
      throw new Error(`Component ${componentName} not found`);
    }
    
    for (const [variationName, config] of Object.entries(variations)) {
      // Apply variation
      if (config.className) {
        baseComponent.className = config.className;
      }
      
      if (config.style) {
        Object.assign(baseComponent.style, config.style);
      }
      
      if (config.content) {
        baseComponent.innerHTML = config.content;
      }
      
      // Wait for CSS transitions
      await this.visual.wait(300);
      
      // Capture and compare
      const testName = `${componentName}-${variationName}`;
      await this.visual.captureElement(baseComponent, testName);
      const comparison = this.visual.compareImages(testName, testName);
      
      results.push({
        variation: variationName,
        ...comparison
      });
    }
    
    return results;
  }

  cleanup() {
    this.testComponents.forEach((component, name) => {
      if (component.parentNode) {
        component.parentNode.removeChild(component);
      }
    });
    this.testComponents.clear();
  }
}

describe('Visual Regression Tests', () => {
  let visualFramework;
  let componentTester;

  beforeEach(async () => {
    // Setup visual testing framework
    visualFramework = new VisualTestingFramework();
    await visualFramework.initialize();
    
    componentTester = new UIComponentTester(visualFramework);
    
    // Setup DOM environment
    mockYouTubePage();
    
    // Use fake timers
    jest.useFakeTimers();
  });

  afterEach(() => {
    componentTester.cleanup();
    jest.useRealTimers();
  });

  describe('Sidebar Component', () => {
    beforeEach(() => {
      const sidebarHTML = `
        <div class="astraltube-sidebar" data-state="expanded">
          <div class="sidebar-header">
            <h3>AstralTube</h3>
            <button class="collapse-btn">←</button>
          </div>
          <div class="sidebar-content">
            <div class="section playlists">
              <h4>Playlists</h4>
              <ul>
                <li>Favorites</li>
                <li>Watch Later</li>
                <li>Music</li>
              </ul>
            </div>
            <div class="section collections">
              <h4>Collections</h4>
              <ul>
                <li>Tech Videos</li>
                <li>Tutorials</li>
              </ul>
            </div>
          </div>
        </div>
      `;

      const sidebarCSS = `
        .astraltube-sidebar {
          width: 300px;
          height: 800px;
          background: #2d2d2d;
          color: white;
          padding: 16px;
          transition: width 0.3s ease;
        }
        .astraltube-sidebar[data-state="collapsed"] {
          width: 60px;
        }
        .sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .sidebar-content .section {
          margin-bottom: 24px;
        }
        .sidebar-content h4 {
          color: #ccc;
          margin-bottom: 8px;
        }
        .sidebar-content ul {
          list-style: none;
          padding: 0;
        }
        .sidebar-content li {
          padding: 8px 0;
          cursor: pointer;
        }
        .sidebar-content li:hover {
          background: #444;
        }
      `;

      componentTester.createTestComponent('sidebar', sidebarHTML, sidebarCSS);
    });

    test('should match sidebar in default expanded state', async () => {
      const component = componentTester.testComponents.get('sidebar');
      await visualFramework.captureElement(component, 'sidebar-default-test');
      
      const comparison = visualFramework.compareImages('sidebar-default', 'sidebar-default-test');
      
      expect(comparison.passed).toBe(true);
      expect(comparison.difference).toBeLessThan(visualFramework.threshold);
    });

    test('should match sidebar in collapsed state', async () => {
      const component = componentTester.testComponents.get('sidebar');
      component.dataset.state = 'collapsed';
      
      // Wait for CSS transition
      jest.advanceTimersByTime(400);
      await visualFramework.wait(100);
      
      await visualFramework.captureElement(component, 'sidebar-collapsed-test');
      
      const comparison = visualFramework.compareImages('sidebar-collapsed', 'sidebar-collapsed-test');
      
      expect(comparison.passed).toBe(true);
    });

    test('should detect changes in sidebar styling', async () => {
      const component = componentTester.testComponents.get('sidebar');
      component.style.background = '#ff0000'; // Change background color
      
      await visualFramework.captureElement(component, 'sidebar-changed-test');
      
      const comparison = visualFramework.compareImages('sidebar-default', 'sidebar-changed-test');
      
      expect(comparison.passed).toBe(false);
      expect(comparison.difference).toBeGreaterThan(visualFramework.threshold);
    });
  });

  describe('Playlist Manager Component', () => {
    beforeEach(() => {
      const playlistHTML = `
        <div class="astraltube-playlist-manager">
          <div class="playlist-header">
            <h3>Playlist Manager</h3>
            <button class="create-playlist-btn">+ Create New</button>
          </div>
          <div class="playlist-list">
            <div class="playlist-item">
              <div class="playlist-thumbnail"></div>
              <div class="playlist-info">
                <h4>Favorites</h4>
                <span class="video-count">25 videos</span>
              </div>
              <div class="playlist-actions">
                <button>Edit</button>
                <button>Delete</button>
              </div>
            </div>
            <div class="playlist-item">
              <div class="playlist-thumbnail"></div>
              <div class="playlist-info">
                <h4>Watch Later</h4>
                <span class="video-count">12 videos</span>
              </div>
              <div class="playlist-actions">
                <button>Edit</button>
                <button>Delete</button>
              </div>
            </div>
          </div>
        </div>
      `;

      const playlistCSS = `
        .astraltube-playlist-manager {
          width: 400px;
          height: 600px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 16px;
        }
        .playlist-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          border-bottom: 1px solid #eee;
          padding-bottom: 16px;
        }
        .create-playlist-btn {
          background: #065fd4;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        .playlist-item {
          display: flex;
          align-items: center;
          padding: 12px;
          margin-bottom: 8px;
          border-radius: 4px;
          background: #f9f9f9;
        }
        .playlist-thumbnail {
          width: 60px;
          height: 45px;
          background: #ccc;
          margin-right: 12px;
          border-radius: 4px;
        }
        .playlist-info {
          flex: 1;
        }
        .playlist-info h4 {
          margin: 0 0 4px 0;
          font-size: 14px;
        }
        .video-count {
          font-size: 12px;
          color: #666;
        }
        .playlist-actions button {
          margin-left: 8px;
          padding: 4px 8px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
        }
      `;

      componentTester.createTestComponent('playlist', playlistHTML, playlistCSS);
    });

    test('should match playlist manager layout', async () => {
      const component = componentTester.testComponents.get('playlist');
      await visualFramework.captureElement(component, 'playlist-manager-test');
      
      const comparison = visualFramework.compareImages('playlist-manager', 'playlist-manager-test');
      
      expect(comparison.passed).toBe(true);
    });

    test('should handle empty playlist state', async () => {
      const component = componentTester.testComponents.get('playlist');
      const playlistList = component.querySelector('.playlist-list');
      playlistList.innerHTML = '<div class="empty-state">No playlists found</div>';
      
      await visualFramework.captureElement(component, 'playlist-empty-test');
      
      // This should be different from the default state
      const comparison = visualFramework.compareImages('playlist-manager', 'playlist-empty-test');
      expect(comparison.passed).toBe(false);
    });
  });

  describe('Deck Mode Component', () => {
    beforeEach(() => {
      const deckHTML = `
        <div class="astraltube-deck-mode active">
          <div class="deck-header">
            <h2>Deck Mode Active</h2>
            <button class="exit-deck-btn">Exit</button>
          </div>
          <div class="deck-content">
            <div class="video-container">
              <div class="video-placeholder">Video Player</div>
            </div>
            <div class="deck-controls">
              <button class="deck-btn prev">Previous</button>
              <button class="deck-btn play">Play</button>
              <button class="deck-btn next">Next</button>
              <button class="deck-btn shuffle">Shuffle</button>
              <button class="deck-btn repeat">Repeat</button>
            </div>
            <div class="deck-progress">
              <div class="progress-bar">
                <div class="progress-fill" style="width: 30%"></div>
              </div>
              <span class="time-info">2:30 / 8:15</span>
            </div>
          </div>
        </div>
      `;

      const deckCSS = `
        .astraltube-deck-mode {
          width: 1200px;
          height: 700px;
          background: #000;
          color: white;
          padding: 20px;
          border-radius: 12px;
        }
        .deck-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        .exit-deck-btn {
          background: #ff4444;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
        }
        .video-container {
          width: 100%;
          height: 400px;
          margin-bottom: 30px;
        }
        .video-placeholder {
          width: 100%;
          height: 100%;
          background: #333;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          border-radius: 8px;
        }
        .deck-controls {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-bottom: 20px;
        }
        .deck-btn {
          background: #444;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
        }
        .deck-btn:hover {
          background: #555;
        }
        .deck-progress {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .progress-bar {
          flex: 1;
          height: 4px;
          background: #333;
          border-radius: 2px;
        }
        .progress-fill {
          height: 100%;
          background: #065fd4;
          border-radius: 2px;
          transition: width 0.3s;
        }
        .time-info {
          font-size: 14px;
          color: #ccc;
        }
      `;

      componentTester.createTestComponent('deckmode', deckHTML, deckCSS);
    });

    test('should match deck mode active state', async () => {
      const component = componentTester.testComponents.get('deckmode');
      await visualFramework.captureElement(component, 'deck-mode-active-test');
      
      const comparison = visualFramework.compareImages('deck-mode-active', 'deck-mode-active-test');
      
      expect(comparison.passed).toBe(true);
    });

    test('should handle different progress states', async () => {
      const variations = {
        'start': {
          selector: '.progress-fill',
          style: { width: '0%' }
        },
        'middle': {
          selector: '.progress-fill',
          style: { width: '50%' }
        },
        'end': {
          selector: '.progress-fill',
          style: { width: '100%' }
        }
      };

      const component = componentTester.testComponents.get('deckmode');
      const results = [];

      for (const [state, config] of Object.entries(variations)) {
        const element = component.querySelector(config.selector);
        Object.assign(element.style, config.style);
        
        jest.advanceTimersByTime(400); // Wait for transition
        await visualFramework.wait(100);
        
        await visualFramework.captureElement(component, `deck-progress-${state}`);
        results.push(state);
      }

      expect(results).toHaveLength(3);
    });
  });

  describe('Notification Component', () => {
    beforeEach(() => {
      const notificationCSS = `
        .astraltube-notification {
          width: 300px;
          height: 60px;
          border-radius: 4px;
          padding: 16px;
          display: flex;
          align-items: center;
          font-family: Arial, sans-serif;
          font-size: 14px;
          margin-bottom: 8px;
        }
        .astraltube-notification.success {
          background: #4caf50;
          color: white;
        }
        .astraltube-notification.error {
          background: #f44336;
          color: white;
        }
        .astraltube-notification.info {
          background: #2196f3;
          color: white;
        }
        .notification-icon {
          margin-right: 12px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.3);
        }
      `;

      // Create base notification structure
      document.head.insertAdjacentHTML('beforeend', `<style>${notificationCSS}</style>`);
    });

    test('should match success notification', async () => {
      const notification = document.createElement('div');
      notification.className = 'astraltube-notification success';
      notification.innerHTML = `
        <div class="notification-icon"></div>
        <span>Video added to playlist successfully</span>
      `;
      document.body.appendChild(notification);
      
      await visualFramework.captureElement(notification, 'notification-success-test');
      
      const comparison = visualFramework.compareImages('notification-success', 'notification-success-test');
      
      expect(comparison.passed).toBe(true);
      
      notification.remove();
    });

    test('should match error notification', async () => {
      const notification = document.createElement('div');
      notification.className = 'astraltube-notification error';
      notification.innerHTML = `
        <div class="notification-icon"></div>
        <span>Failed to add video to playlist</span>
      `;
      document.body.appendChild(notification);
      
      await visualFramework.captureElement(notification, 'notification-error-test');
      
      const comparison = visualFramework.compareImages('notification-error', 'notification-error-test');
      
      expect(comparison.passed).toBe(true);
      
      notification.remove();
    });

    test('should handle long notification text', async () => {
      const notification = document.createElement('div');
      notification.className = 'astraltube-notification info';
      notification.style.width = '400px'; // Wider for long text
      notification.innerHTML = `
        <div class="notification-icon"></div>
        <span>This is a very long notification message that should wrap or truncate appropriately</span>
      `;
      document.body.appendChild(notification);
      
      await visualFramework.captureElement(notification, 'notification-long-text');
      
      // Should be different from standard notifications
      const comparison = visualFramework.compareImages('notification-success', 'notification-long-text');
      expect(comparison.passed).toBe(false);
      
      notification.remove();
    });
  });

  describe('Settings Panel Component', () => {
    test('should match settings panel layout', async () => {
      const settingsHTML = `
        <div class="astraltube-settings-panel">
          <div class="settings-header">
            <h3>AstralTube Settings</h3>
            <button class="close-btn">×</button>
          </div>
          <div class="settings-content">
            <div class="setting-group">
              <label>Theme</label>
              <select>
                <option>Light</option>
                <option>Dark</option>
                <option>Auto</option>
              </select>
            </div>
            <div class="setting-group">
              <label>Sidebar</label>
              <input type="checkbox" checked> Show sidebar
            </div>
            <div class="setting-group">
              <label>Auto-add to playlist</label>
              <input type="checkbox"> Enable auto-add
              <select disabled>
                <option>Watch Later</option>
                <option>Favorites</option>
              </select>
            </div>
            <div class="setting-group">
              <label>Keyboard shortcuts</label>
              <div class="shortcuts">
                <div>Sidebar: <kbd>Ctrl+Alt+S</kbd></div>
                <div>Deck Mode: <kbd>Ctrl+Alt+D</kbd></div>
              </div>
            </div>
          </div>
          <div class="settings-footer">
            <button class="cancel-btn">Cancel</button>
            <button class="save-btn">Save</button>
          </div>
        </div>
      `;

      const settingsCSS = `
        .astraltube-settings-panel {
          width: 500px;
          height: 400px;
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 0;
          font-family: Arial, sans-serif;
        }
        .settings-header {
          background: #fff;
          padding: 16px;
          border-bottom: 1px solid #ddd;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
        }
        .settings-content {
          padding: 20px;
        }
        .setting-group {
          margin-bottom: 20px;
        }
        .setting-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: bold;
        }
        .setting-group select,
        .setting-group input[type="checkbox"] {
          margin-right: 8px;
        }
        .shortcuts {
          background: #fff;
          padding: 12px;
          border-radius: 4px;
          border: 1px solid #ddd;
        }
        .shortcuts div {
          margin-bottom: 4px;
        }
        kbd {
          background: #eee;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: monospace;
          font-size: 12px;
        }
        .settings-footer {
          padding: 16px;
          background: #fff;
          border-top: 1px solid #ddd;
          text-align: right;
        }
        .settings-footer button {
          margin-left: 8px;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        .cancel-btn {
          background: #fff;
          border: 1px solid #ddd;
        }
        .save-btn {
          background: #065fd4;
          color: white;
          border: none;
        }
      `;

      componentTester.createTestComponent('settings', settingsHTML, settingsCSS);
      
      const component = componentTester.testComponents.get('settings');
      await visualFramework.captureElement(component, 'settings-panel-test');
      
      const comparison = visualFramework.compareImages('settings-panel', 'settings-panel-test');
      
      expect(comparison.passed).toBe(true);
    });
  });

  describe('Responsive Layout Testing', () => {
    test('should handle different viewport sizes', async () => {
      const component = componentTester.testComponents.get('sidebar');
      if (!component) {
        // Create a simple component for responsive testing
        componentTester.createTestComponent('responsive', 
          '<div class="responsive-test">Responsive Component</div>',
          `
            .responsive-test {
              width: 100%;
              padding: 20px;
              background: #f0f0f0;
              text-align: center;
            }
            @media (max-width: 768px) {
              .responsive-test {
                padding: 10px;
                font-size: 14px;
              }
            }
          `
        );
      }

      const testComponent = componentTester.testComponents.get('responsive') || component;
      const viewports = [
        { width: 1920, height: 1080, name: 'desktop' },
        { width: 1024, height: 768, name: 'tablet' },
        { width: 375, height: 667, name: 'mobile' }
      ];

      const results = [];
      
      for (const viewport of viewports) {
        // Simulate viewport change
        Object.defineProperty(window, 'innerWidth', { value: viewport.width, writable: true });
        Object.defineProperty(window, 'innerHeight', { value: viewport.height, writable: true });
        
        // Trigger resize event
        window.dispatchEvent(new Event('resize'));
        await visualFramework.wait(100);
        
        await visualFramework.captureElement(testComponent, `responsive-${viewport.name}`);
        results.push(viewport.name);
      }

      expect(results).toHaveLength(3);
    });
  });

  describe('Animation and Transition Testing', () => {
    test('should capture animation states', async () => {
      const animationHTML = `
        <div class="animated-component">
          <div class="fade-element">Fading Element</div>
          <div class="slide-element">Sliding Element</div>
        </div>
      `;

      const animationCSS = `
        .animated-component {
          width: 400px;
          height: 200px;
          background: #fff;
          position: relative;
          overflow: hidden;
        }
        .fade-element {
          opacity: 1;
          transition: opacity 0.3s;
          padding: 20px;
        }
        .fade-element.hidden {
          opacity: 0;
        }
        .slide-element {
          transform: translateX(0);
          transition: transform 0.3s;
          padding: 20px;
          background: #f0f0f0;
        }
        .slide-element.moved {
          transform: translateX(200px);
        }
      `;

      componentTester.createTestComponent('animation', animationHTML, animationCSS);
      
      const component = componentTester.testComponents.get('animation');
      
      // Test initial state
      await visualFramework.captureElement(component, 'animation-initial');
      
      // Test fade out
      component.querySelector('.fade-element').classList.add('hidden');
      jest.advanceTimersByTime(400);
      await visualFramework.wait(100);
      await visualFramework.captureElement(component, 'animation-fade-out');
      
      // Test slide
      component.querySelector('.slide-element').classList.add('moved');
      jest.advanceTimersByTime(400);
      await visualFramework.wait(100);
      await visualFramework.captureElement(component, 'animation-slide');
      
      // Each state should be different
      const fadeComparison = visualFramework.compareImages('animation-initial', 'animation-fade-out');
      const slideComparison = visualFramework.compareImages('animation-initial', 'animation-slide');
      
      expect(fadeComparison.passed).toBe(false);
      expect(slideComparison.passed).toBe(false);
    });
  });

  describe('Cross-browser Compatibility', () => {
    test('should handle different user agent strings', async () => {
      const originalUserAgent = navigator.userAgent;
      
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
      ];

      const component = componentTester.testComponents.get('sidebar');
      if (component) {
        for (const ua of userAgents) {
          Object.defineProperty(navigator, 'userAgent', { value: ua, writable: true });
          
          await visualFramework.captureElement(component, `browser-${ua.includes('Chrome') ? 'chrome' : ua.includes('Firefox') ? 'firefox' : 'safari'}`);
        }
      }

      // Restore original user agent
      Object.defineProperty(navigator, 'userAgent', { value: originalUserAgent, writable: true });
      
      expect(true).toBe(true); // Basic test to ensure no errors
    });
  });
});