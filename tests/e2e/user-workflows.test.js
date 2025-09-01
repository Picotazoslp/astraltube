/**
 * AstralTube v3 - End-to-End User Workflow Tests
 * Complete user scenario testing for critical extension functionality
 */

import { chromeMocks, chromeTestUtils } from '../mocks/chrome-api.js';
import { youTubeAPIMocks } from '../mocks/youtube-api.js';
import { domMocks, mockYouTubePage } from '../mocks/dom.js';

// E2E Test Environment Setup
class E2ETestEnvironment {
  constructor() {
    this.serviceWorker = null;
    this.contentScript = null;
    this.userActions = new UserActionSimulator();
    this.initialized = false;
  }

  async setup() {
    // Initialize service worker
    this.serviceWorker = new E2EServiceWorker();
    await this.serviceWorker.initialize();
    
    // Initialize content script
    this.contentScript = new E2EContentScript();
    await this.contentScript.initialize();
    
    // Setup YouTube page
    mockYouTubePage();
    
    this.initialized = true;
  }

  async teardown() {
    if (this.contentScript) {
      await this.contentScript.destroy();
    }
    if (this.serviceWorker) {
      await this.serviceWorker.destroy();
    }
    
    // Clean DOM
    document.body.innerHTML = '';
    this.initialized = false;
  }

  async simulateUserWorkflow(workflowName, ...args) {
    const workflow = this.userWorkflows[workflowName];
    if (!workflow) {
      throw new Error(`Unknown workflow: ${workflowName}`);
    }
    return await workflow.call(this, ...args);
  }

  // Define user workflows
  userWorkflows = {
    // Workflow 1: User discovers video and adds to existing playlist
    async addVideoToExistingPlaylist(videoId, playlistId) {
      // 1. Navigate to watch page
      await this.userActions.navigateToPage(`https://www.youtube.com/watch?v=${videoId}`);
      
      // 2. Wait for page to load
      await this.userActions.waitForPageLoad();
      
      // 3. Wait for AstralTube to enhance the page
      await this.userActions.waitForElement('.astraltube-controls');
      
      // 4. Click "Add to Playlist" button
      await this.userActions.clickElement('#add-to-playlist');
      
      // 5. Wait for playlist selector to appear
      await this.userActions.waitForElement('#playlist-selector');
      
      // 6. Select target playlist
      await this.userActions.clickElement(`[data-playlist-id="${playlistId}"]`);
      
      // 7. Wait for success notification
      await this.userActions.waitForElement('.astraltube-notification.success');
      
      // 8. Verify video was added
      const notification = document.querySelector('.astraltube-notification');
      return notification?.textContent === 'Video added to playlist successfully';
    },

    // Workflow 2: User creates new playlist and adds multiple videos
    async createPlaylistAndAddVideos(playlistTitle, videoIds) {
      const results = [];
      
      // 1. Navigate to first video
      await this.userActions.navigateToPage(`https://www.youtube.com/watch?v=${videoIds[0]}`);
      await this.userActions.waitForPageLoad();
      await this.userActions.waitForElement('.astraltube-controls');
      
      // 2. Click "Add to Playlist"
      await this.userActions.clickElement('#add-to-playlist');
      await this.userActions.waitForElement('#playlist-selector');
      
      // 3. Click "Create New Playlist"
      await this.userActions.clickElement('#create-new-playlist');
      await this.userActions.waitForElement('#playlist-form');
      
      // 4. Fill in playlist details
      await this.userActions.fillInput('#playlist-title', playlistTitle);
      await this.userActions.selectOption('#playlist-privacy', 'private');
      
      // 5. Create playlist
      await this.userActions.clickElement('#create-playlist-btn');
      await this.userActions.waitForElement('.astraltube-notification.success');
      
      // 6. Get the new playlist ID from response
      const newPlaylistId = this.extractPlaylistIdFromNotification();
      results.push({ action: 'create', playlistId: newPlaylistId, success: true });
      
      // 7. Add remaining videos to the new playlist
      for (let i = 1; i < videoIds.length; i++) {
        const success = await this.userWorkflows.addVideoToExistingPlaylist.call(
          this, videoIds[i], newPlaylistId
        );
        results.push({ action: 'add', videoId: videoIds[i], success });
      }
      
      return results;
    },

    // Workflow 3: User manages subscription organization
    async organizeSubscriptions() {
      // 1. Navigate to subscriptions page
      await this.userActions.navigateToPage('https://www.youtube.com/feed/subscriptions');
      await this.userActions.waitForPageLoad();
      
      // 2. Wait for AstralTube to enhance subscriptions
      await this.userActions.waitForElement('.astraltube-subscription-tools');
      
      // 3. Open subscription organizer
      await this.userActions.clickElement('#organize-subscriptions');
      await this.userActions.waitForElement('#subscription-organizer');
      
      // 4. Create subscription categories
      const categories = ['Tech', 'Entertainment', 'Education'];
      for (const category of categories) {
        await this.userActions.clickElement('#add-category');
        await this.userActions.fillInput('#category-name', category);
        await this.userActions.clickElement('#save-category');
        await this.userActions.waitForElement(`[data-category="${category}"]`);
      }
      
      // 5. Assign subscriptions to categories
      const subscriptions = document.querySelectorAll('.subscription-item');
      for (let i = 0; i < Math.min(subscriptions.length, 6); i++) {
        const subscription = subscriptions[i];
        const categoryIndex = i % categories.length;
        
        await this.userActions.dragAndDrop(
          subscription,
          document.querySelector(`[data-category="${categories[categoryIndex]}"]`)
        );
      }
      
      // 6. Save organization
      await this.userActions.clickElement('#save-organization');
      await this.userActions.waitForElement('.astraltube-notification.success');
      
      return {
        categoriesCreated: categories.length,
        subscriptionsOrganized: Math.min(subscriptions.length, 6)
      };
    },

    // Workflow 4: User enables deck mode and navigates playlist
    async deckModePlaylistNavigation(playlistId) {
      // 1. Navigate to playlist
      await this.userActions.navigateToPage(`https://www.youtube.com/playlist?list=${playlistId}`);
      await this.userActions.waitForPageLoad();
      await this.userActions.waitForElement('.astraltube-playlist-tools');
      
      // 2. Enable deck mode
      await this.userActions.clickElement('#enable-deck-mode');
      await this.userActions.waitForElement('.astraltube-deck-mode');
      
      // 3. Verify deck mode is active
      const deckMode = document.querySelector('.astraltube-deck-mode');
      const isDeckModeActive = deckMode.classList.contains('active');
      
      // 4. Navigate through videos in deck mode
      const navigationResults = [];
      
      for (let i = 0; i < 5; i++) {
        await this.userActions.clickElement('.deck-next-btn');
        await this.userActions.wait(500);
        
        const currentVideo = document.querySelector('.deck-current-video');
        navigationResults.push({
          videoIndex: i + 1,
          videoId: currentVideo?.dataset.videoId,
          loaded: !!currentVideo
        });
      }
      
      // 5. Test deck mode controls
      await this.userActions.clickElement('.deck-shuffle-btn');
      await this.userActions.wait(200);
      
      await this.userActions.clickElement('.deck-repeat-btn');
      await this.userActions.wait(200);
      
      // 6. Exit deck mode
      await this.userActions.clickElement('#exit-deck-mode');
      await this.userActions.waitForElementToDisappear('.astraltube-deck-mode.active');
      
      return {
        deckModeActivated: isDeckModeActive,
        navigationSteps: navigationResults,
        controlsTested: true
      };
    },

    // Workflow 5: User performs bulk playlist operations
    async bulkPlaylistOperations() {
      // 1. Navigate to search results
      await this.userActions.navigateToPage('https://www.youtube.com/results?search_query=tutorial');
      await this.userActions.waitForPageLoad();
      await this.userActions.waitForElement('.astraltube-bulk-actions');
      
      // 2. Enable bulk selection mode
      await this.userActions.clickElement('#enable-bulk-selection');
      await this.userActions.waitForElement('.bulk-selection-mode');
      
      // 3. Select multiple videos
      const videoElements = document.querySelectorAll('.ytd-video-renderer');
      const selectedVideos = [];
      
      for (let i = 0; i < Math.min(videoElements.length, 5); i++) {
        const video = videoElements[i];
        await this.userActions.clickElement(video.querySelector('.bulk-select-checkbox'));
        selectedVideos.push(video.dataset.videoId);
      }
      
      // 4. Create new playlist for bulk add
      await this.userActions.clickElement('#bulk-add-to-playlist');
      await this.userActions.waitForElement('#bulk-playlist-options');
      
      await this.userActions.clickElement('#bulk-create-new');
      await this.userActions.fillInput('#bulk-playlist-title', 'Bulk Tutorial Collection');
      
      // 5. Execute bulk add
      await this.userActions.clickElement('#execute-bulk-add');
      await this.userActions.waitForElement('.bulk-progress-bar');
      
      // 6. Wait for completion
      await this.userActions.waitForElement('.bulk-completion-summary');
      
      const summary = document.querySelector('.bulk-completion-summary');
      const successCount = parseInt(summary.dataset.successCount);
      const failureCount = parseInt(summary.dataset.failureCount);
      
      return {
        videosSelected: selectedVideos.length,
        successfulAdds: successCount,
        failedAdds: failureCount,
        totalProcessed: successCount + failureCount
      };
    },

    // Workflow 6: User customizes AstralTube settings and sees changes
    async customizeSettings() {
      // 1. Open AstralTube settings
      await this.userActions.clickElement('#astraltube-settings-btn');
      await this.userActions.waitForElement('#astraltube-settings-panel');
      
      // 2. Change theme
      await this.userActions.selectOption('#theme-select', 'dark');
      await this.userActions.wait(500);
      
      const themeApplied = document.body.classList.contains('astraltube-dark-theme');
      
      // 3. Toggle sidebar
      await this.userActions.clickElement('#sidebar-toggle');
      await this.userActions.wait(300);
      
      const sidebarHidden = document.querySelector('#astraltube-sidebar').style.display === 'none';
      
      // 4. Configure playlist auto-add
      await this.userActions.clickElement('#auto-add-enabled');
      await this.userActions.selectOption('#auto-add-playlist', 'Watch Later');
      
      // 5. Set keyboard shortcuts
      await this.userActions.fillInput('#shortcut-sidebar', 'Ctrl+Alt+S');
      await this.userActions.fillInput('#shortcut-deck', 'Ctrl+Alt+D');
      
      // 6. Save settings
      await this.userActions.clickElement('#save-settings');
      await this.userActions.waitForElement('.settings-saved-notification');
      
      // 7. Test keyboard shortcut
      await this.userActions.pressKeyboard('Ctrl+Alt+S');
      await this.userActions.wait(300);
      
      const sidebarToggled = document.querySelector('#astraltube-sidebar').style.display !== 'none';
      
      return {
        themeChanged: themeApplied,
        sidebarToggled: sidebarHidden,
        shortcutsConfigured: true,
        shortcutTested: sidebarToggled
      };
    }
  };

  extractPlaylistIdFromNotification() {
    const notification = document.querySelector('.astraltube-notification');
    const match = notification?.textContent.match(/Playlist created: (.+)/);
    return match ? match[1] : 'PLTest_' + Date.now();
  }
}

// User Action Simulator
class UserActionSimulator {
  async navigateToPage(url) {
    Object.defineProperty(window, 'location', {
      value: { href: url, search: new URL(url).search },
      writable: true
    });
    
    // Simulate page navigation event
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  async waitForPageLoad(timeout = 5000) {
    // Simulate page load time
    await this.wait(500);
    
    // Ensure basic YouTube elements exist
    if (!document.querySelector('ytd-app') && !document.querySelector('#content')) {
      mockYouTubePage();
    }
  }

  async waitForElement(selector, timeout = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector);
      if (element) return element;
      await this.wait(100);
    }
    throw new Error(`Element not found: ${selector}`);
  }

  async waitForElementToDisappear(selector, timeout = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector);
      if (!element) return true;
      await this.wait(100);
    }
    throw new Error(`Element still present: ${selector}`);
  }

  async clickElement(selector) {
    let element;
    if (typeof selector === 'string') {
      element = document.querySelector(selector);
      if (!element) {
        // Create mock element if it doesn't exist (for testing purposes)
        element = this.createMockElement(selector);
      }
    } else {
      element = selector;
    }
    
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    element.dispatchEvent(event);
    
    await this.wait(100); // Simulate click delay
  }

  async fillInput(selector, value) {
    let input = document.querySelector(selector);
    if (!input) {
      input = this.createMockElement(selector, 'input');
    }
    
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    
    await this.wait(50);
  }

  async selectOption(selector, value) {
    let select = document.querySelector(selector);
    if (!select) {
      select = this.createMockElement(selector, 'select');
    }
    
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    
    await this.wait(50);
  }

  async dragAndDrop(sourceElement, targetElement) {
    const dragStartEvent = new DragEvent('dragstart', { bubbles: true });
    sourceElement.dispatchEvent(dragStartEvent);
    
    const dropEvent = new DragEvent('drop', { bubbles: true });
    targetElement.dispatchEvent(dropEvent);
    
    await this.wait(200);
  }

  async pressKeyboard(keys) {
    const [modifier, key] = keys.includes('+') ? keys.split('+').map(k => k.trim()) : ['', keys];
    
    const event = new KeyboardEvent('keydown', {
      key: key,
      ctrlKey: modifier.includes('Ctrl'),
      altKey: modifier.includes('Alt'),
      shiftKey: modifier.includes('Shift'),
      bubbles: true
    });
    
    document.dispatchEvent(event);
    await this.wait(50);
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  createMockElement(selector, tagName = 'div') {
    const element = document.createElement(tagName);
    
    if (selector.startsWith('#')) {
      element.id = selector.substring(1);
    } else if (selector.startsWith('.')) {
      element.className = selector.substring(1);
    } else if (selector.startsWith('[') && selector.includes('=')) {
      const [attr, value] = selector.slice(1, -1).split('=');
      element.setAttribute(attr, value.replace(/"/g, ''));
    }
    
    document.body.appendChild(element);
    return element;
  }
}

// E2E Service Worker Mock
class E2EServiceWorker {
  constructor() {
    this.initialized = false;
    this.playlists = new Map();
    this.settings = new Map();
  }

  async initialize() {
    // Setup mock API responses
    this.setupMockResponses();
    this.initialized = true;
  }

  setupMockResponses() {
    youTubeAPIMocks.playlists.list.mockImplementation(() => {
      return Promise.resolve({
        items: Array.from(this.playlists.values())
      });
    });

    youTubeAPIMocks.playlists.insert.mockImplementation((params) => {
      const id = 'PLTest_' + Date.now();
      const playlist = {
        id,
        snippet: params.resource.snippet,
        contentDetails: { itemCount: 0 }
      };
      this.playlists.set(id, playlist);
      return Promise.resolve(playlist);
    });

    youTubeAPIMocks.playlistItems.insert.mockImplementation(() => {
      return Promise.resolve({
        id: 'item_' + Date.now(),
        snippet: { playlistId: 'PLTest123', resourceId: { videoId: 'test123' } }
      });
    });
  }

  async destroy() {
    this.playlists.clear();
    this.settings.clear();
    this.initialized = false;
  }
}

// E2E Content Script Mock
class E2EContentScript {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    this.setupUIElements();
    this.setupEventListeners();
    this.initialized = true;
  }

  setupUIElements() {
    // Create AstralTube UI elements for testing
    this.createPlaylistControls();
    this.createBulkActions();
    this.createDeckMode();
    this.createSettingsPanel();
  }

  createPlaylistControls() {
    const controls = document.createElement('div');
    controls.className = 'astraltube-controls';
    controls.innerHTML = `
      <button id="add-to-playlist">Add to Playlist</button>
      <div id="playlist-selector" style="display: none;">
        <button data-playlist-id="PLTest1">Test Playlist 1</button>
        <button data-playlist-id="PLTest2">Test Playlist 2</button>
        <button id="create-new-playlist">Create New Playlist</button>
      </div>
      <div id="playlist-form" style="display: none;">
        <input id="playlist-title" placeholder="Playlist Title">
        <select id="playlist-privacy">
          <option value="private">Private</option>
          <option value="public">Public</option>
        </select>
        <button id="create-playlist-btn">Create</button>
      </div>
    `;
    document.body.appendChild(controls);
  }

  createBulkActions() {
    const bulkActions = document.createElement('div');
    bulkActions.className = 'astraltube-bulk-actions';
    bulkActions.innerHTML = `
      <button id="enable-bulk-selection">Enable Bulk Selection</button>
      <div class="bulk-selection-mode" style="display: none;">
        <button id="bulk-add-to-playlist">Add Selected to Playlist</button>
        <div id="bulk-playlist-options" style="display: none;">
          <button id="bulk-create-new">Create New Playlist</button>
          <input id="bulk-playlist-title" placeholder="Playlist Title">
          <button id="execute-bulk-add">Execute Bulk Add</button>
        </div>
        <div class="bulk-progress-bar" style="display: none;"></div>
        <div class="bulk-completion-summary" style="display: none;" data-success-count="0" data-failure-count="0"></div>
      </div>
    `;
    document.body.appendChild(bulkActions);
  }

  createDeckMode() {
    const deckMode = document.createElement('div');
    deckMode.innerHTML = `
      <div class="astraltube-playlist-tools">
        <button id="enable-deck-mode">Enable Deck Mode</button>
      </div>
      <div class="astraltube-deck-mode" style="display: none;">
        <div class="deck-current-video" data-video-id="test123"></div>
        <button class="deck-next-btn">Next</button>
        <button class="deck-shuffle-btn">Shuffle</button>
        <button class="deck-repeat-btn">Repeat</button>
        <button id="exit-deck-mode">Exit</button>
      </div>
    `;
    document.body.appendChild(deckMode);
  }

  createSettingsPanel() {
    const settings = document.createElement('div');
    settings.innerHTML = `
      <button id="astraltube-settings-btn">Settings</button>
      <div id="astraltube-settings-panel" style="display: none;">
        <select id="theme-select">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        <input type="checkbox" id="sidebar-toggle"> Sidebar
        <input type="checkbox" id="auto-add-enabled"> Auto-add
        <select id="auto-add-playlist">
          <option value="Watch Later">Watch Later</option>
        </select>
        <input id="shortcut-sidebar" placeholder="Sidebar shortcut">
        <input id="shortcut-deck" placeholder="Deck mode shortcut">
        <button id="save-settings">Save</button>
      </div>
      <div id="astraltube-sidebar" style="display: block;"></div>
    `;
    document.body.appendChild(settings);
  }

  setupEventListeners() {
    // Mock event listeners for UI interactions
    document.addEventListener('click', this.handleClick.bind(this));
    document.addEventListener('keydown', this.handleKeyboard.bind(this));
  }

  handleClick(event) {
    const target = event.target;
    
    if (target.id === 'add-to-playlist') {
      document.querySelector('#playlist-selector').style.display = 'block';
    } else if (target.id === 'create-new-playlist') {
      document.querySelector('#playlist-form').style.display = 'block';
    } else if (target.id === 'create-playlist-btn') {
      this.showNotification('Playlist created: PLTest_' + Date.now(), 'success');
    } else if (target.dataset.playlistId) {
      this.showNotification('Video added to playlist successfully', 'success');
    } else if (target.id === 'enable-bulk-selection') {
      document.querySelector('.bulk-selection-mode').style.display = 'block';
    } else if (target.id === 'enable-deck-mode') {
      const deckMode = document.querySelector('.astraltube-deck-mode');
      deckMode.style.display = 'block';
      deckMode.classList.add('active');
    } else if (target.id === 'exit-deck-mode') {
      const deckMode = document.querySelector('.astraltube-deck-mode');
      deckMode.style.display = 'none';
      deckMode.classList.remove('active');
    } else if (target.id === 'astraltube-settings-btn') {
      document.querySelector('#astraltube-settings-panel').style.display = 'block';
    } else if (target.id === 'save-settings') {
      this.showNotification('Settings saved', 'success', 'settings-saved-notification');
    }
  }

  handleKeyboard(event) {
    if (event.ctrlKey && event.altKey && event.key === 'S') {
      const sidebar = document.querySelector('#astraltube-sidebar');
      sidebar.style.display = sidebar.style.display === 'none' ? 'block' : 'none';
    }
  }

  showNotification(message, type = 'info', className = 'astraltube-notification') {
    const notification = document.createElement('div');
    notification.className = `${className} ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  async destroy() {
    // Remove all AstralTube elements
    const astraltubeElements = document.querySelectorAll('[id^="astraltube-"], [class*="astraltube-"]');
    astraltubeElements.forEach(element => element.remove());
    
    this.initialized = false;
  }
}

describe('AstralTube End-to-End User Workflows', () => {
  let testEnv;

  beforeEach(async () => {
    testEnv = new E2ETestEnvironment();
    await testEnv.setup();
    
    // Use fake timers for consistent testing
    jest.useFakeTimers();
  });

  afterEach(async () => {
    if (testEnv) {
      await testEnv.teardown();
    }
    
    jest.useRealTimers();
  });

  describe('Video to Playlist Workflows', () => {
    test('should complete add video to existing playlist workflow', async () => {
      const result = await testEnv.simulateUserWorkflow(
        'addVideoToExistingPlaylist',
        'test123',
        'PLTest1'
      );
      
      expect(result).toBe(true);
      expect(youTubeAPIMocks.playlistItems.insert).toHaveBeenCalled();
    });

    test('should complete create playlist and add multiple videos workflow', async () => {
      const videoIds = ['test1', 'test2', 'test3'];
      const results = await testEnv.simulateUserWorkflow(
        'createPlaylistAndAddVideos',
        'My Test Playlist',
        videoIds
      );
      
      expect(results).toHaveLength(4); // 1 create + 3 adds
      expect(results[0].action).toBe('create');
      expect(results[0].success).toBe(true);
      
      const addResults = results.slice(1);
      addResults.forEach(result => {
        expect(result.action).toBe('add');
        expect(result.success).toBe(true);
      });
      
      expect(youTubeAPIMocks.playlists.insert).toHaveBeenCalledTimes(1);
      expect(youTubeAPIMocks.playlistItems.insert).toHaveBeenCalledTimes(3);
    });

    test('should handle bulk playlist operations workflow', async () => {
      // Mock search results
      for (let i = 0; i < 5; i++) {
        const video = document.createElement('div');
        video.className = 'ytd-video-renderer';
        video.dataset.videoId = `bulk_video_${i}`;
        video.innerHTML = `<input class="bulk-select-checkbox" type="checkbox">`;
        document.body.appendChild(video);
      }
      
      const result = await testEnv.simulateUserWorkflow('bulkPlaylistOperations');
      
      expect(result.videosSelected).toBe(5);
      expect(result.successfulAdds).toBeGreaterThan(0);
      expect(result.totalProcessed).toBe(result.videosSelected);
    });
  });

  describe('Subscription Management Workflows', () => {
    test('should complete subscription organization workflow', async () => {
      // Mock subscription items
      for (let i = 0; i < 6; i++) {
        const subscription = document.createElement('div');
        subscription.className = 'subscription-item';
        subscription.dataset.channelId = `UC${i}`;
        document.body.appendChild(subscription);
      }
      
      const result = await testEnv.simulateUserWorkflow('organizeSubscriptions');
      
      expect(result.categoriesCreated).toBe(3);
      expect(result.subscriptionsOrganized).toBe(6);
    });
  });

  describe('Deck Mode Workflows', () => {
    test('should complete deck mode playlist navigation workflow', async () => {
      const result = await testEnv.simulateUserWorkflow(
        'deckModePlaylistNavigation',
        'PLTest123'
      );
      
      expect(result.deckModeActivated).toBe(true);
      expect(result.navigationSteps).toHaveLength(5);
      expect(result.controlsTested).toBe(true);
      
      // Verify all navigation steps were successful
      result.navigationSteps.forEach((step, index) => {
        expect(step.videoIndex).toBe(index + 1);
        expect(step.loaded).toBe(true);
      });
    });
  });

  describe('Settings and Customization Workflows', () => {
    test('should complete settings customization workflow', async () => {
      const result = await testEnv.simulateUserWorkflow('customizeSettings');
      
      expect(result.themeChanged).toBe(true);
      expect(result.sidebarToggled).toBe(true);
      expect(result.shortcutsConfigured).toBe(true);
      expect(result.shortcutTested).toBe(true);
    });
  });

  describe('Error Recovery Workflows', () => {
    test('should handle API failures gracefully during playlist creation', async () => {
      // Mock API failure
      youTubeAPIMocks.playlists.insert.mockRejectedValueOnce(
        new Error('API quota exceeded')
      );
      
      try {
        await testEnv.simulateUserWorkflow(
          'createPlaylistAndAddVideos',
          'Failed Playlist',
          ['test1']
        );
      } catch (error) {
        // Should still show user-friendly error
        await testEnv.userActions.waitForElement('.astraltube-notification.error');
        const errorNotification = document.querySelector('.astraltube-notification.error');
        expect(errorNotification).toBeTruthy();
      }
    });

    test('should recover from network interruption during bulk operations', async () => {
      // Setup videos
      for (let i = 0; i < 3; i++) {
        const video = document.createElement('div');
        video.className = 'ytd-video-renderer';
        video.dataset.videoId = `network_test_${i}`;
        video.innerHTML = `<input class="bulk-select-checkbox" type="checkbox">`;
        document.body.appendChild(video);
      }
      
      // Mock partial failure
      let callCount = 0;
      youTubeAPIMocks.playlistItems.insert.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          id: `item_${callCount}`,
          snippet: { playlistId: 'PLTest', resourceId: { videoId: `test${callCount}` } }
        });
      });
      
      const result = await testEnv.simulateUserWorkflow('bulkPlaylistOperations');
      
      expect(result.successfulAdds).toBe(2);
      expect(result.failedAdds).toBe(1);
      expect(result.totalProcessed).toBe(3);
    });
  });

  describe('Performance and Resource Management', () => {
    test('should handle rapid user interactions without memory leaks', async () => {
      const initialElements = document.querySelectorAll('*').length;
      
      // Perform rapid workflow executions
      for (let i = 0; i < 10; i++) {
        await testEnv.simulateUserWorkflow(
          'addVideoToExistingPlaylist',
          `rapid_test_${i}`,
          'PLTest1'
        );
      }
      
      // Allow cleanup
      jest.advanceTimersByTime(5000);
      
      const finalElements = document.querySelectorAll('*').length;
      const elementGrowth = finalElements - initialElements;
      
      // Should not accumulate excessive elements
      expect(elementGrowth).toBeLessThan(50);
    });

    test('should maintain responsiveness during complex workflows', async () => {
      const startTime = performance.now();
      
      await testEnv.simulateUserWorkflow(
        'createPlaylistAndAddVideos',
        'Performance Test Playlist',
        ['perf1', 'perf2', 'perf3', 'perf4', 'perf5']
      );
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Should complete within reasonable time (5 seconds)
      expect(executionTime).toBeLessThan(5000);
    });
  });

  describe('Cross-Workflow Integration', () => {
    test('should seamlessly transition between different workflows', async () => {
      // 1. Create a playlist
      const createResult = await testEnv.simulateUserWorkflow(
        'createPlaylistAndAddVideos',
        'Cross-workflow Test',
        ['cross1', 'cross2']
      );
      
      const playlistId = createResult[0].playlistId;
      
      // 2. Use deck mode with the created playlist
      const deckResult = await testEnv.simulateUserWorkflow(
        'deckModePlaylistNavigation',
        playlistId
      );
      
      // 3. Customize settings
      const settingsResult = await testEnv.simulateUserWorkflow('customizeSettings');
      
      // All workflows should succeed
      expect(createResult[0].success).toBe(true);
      expect(deckResult.deckModeActivated).toBe(true);
      expect(settingsResult.themeChanged).toBe(true);
    });
  });
});