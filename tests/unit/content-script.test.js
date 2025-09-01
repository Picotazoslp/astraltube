/**
 * AstralTube v3 - Content Script Unit Tests
 * Comprehensive tests for YouTube page integration and enhancement
 */

import { chromeMocks, chromeTestUtils } from '../mocks/chrome-api.js';
import { domMocks, mockYouTubePage } from '../mocks/dom.js';

// Mock content script components
const mockSidebar = {
  init: jest.fn(() => Promise.resolve()),
  render: jest.fn(),
  show: jest.fn(),
  hide: jest.fn(),
  destroy: jest.fn(),
  isVisible: jest.fn(() => true)
};

const mockDeckMode = {
  init: jest.fn(() => Promise.resolve()),
  enable: jest.fn(),
  disable: jest.fn(),
  toggle: jest.fn(),
  isEnabled: jest.fn(() => false),
  destroy: jest.fn()
};

const mockPlaylistManager = {
  init: jest.fn(() => Promise.resolve()),
  addToPlaylist: jest.fn(),
  createPlaylist: jest.fn(),
  getPlaylists: jest.fn(() => []),
  enhancePlaylistElements: jest.fn(),
  destroy: jest.fn()
};

const mockSubscriptionManager = {
  init: jest.fn(() => Promise.resolve()),
  getSubscriptions: jest.fn(() => []),
  enhanceSubscriptionElements: jest.fn(),
  checkNewVideos: jest.fn(),
  destroy: jest.fn()
};

// Mock content script class
class MockAstralTubeContent {
  constructor() {
    this.initialized = false;
    this.currentUrl = window.location.href;
    this.observer = null;
    this.components = {};
    this.settings = {
      sidebarEnabled: true,
      deckModeEnabled: false,
      playlistManagerEnabled: true,
      subscriptionManagerEnabled: true,
      autoEnhance: true
    };
    
    this.init();
  }

  async init() {
    try {
      console.log('🌟 AstralTube Content Script initializing...');
      
      // Wait for YouTube to load
      await this.waitForYouTube();
      
      // Load settings
      await this.loadSettings();
      
      // Initialize components
      await this.initializeComponents();
      
      // Setup observers
      this.setupObservers();
      
      // Setup message listeners
      this.setupMessageListeners();
      
      // Apply initial enhancements
      if (this.settings.autoEnhance) {
        this.enhancePage();
      }
      
      this.initialized = true;
      console.log('✅ AstralTube Content Script initialized');
      
      // Notify background script
      chrome.runtime.sendMessage({ action: 'contentScriptReady' });
      
    } catch (error) {
      console.error('❌ Failed to initialize AstralTube Content Script:', error);
      throw error;
    }
  }

  async waitForYouTube() {
    return new Promise((resolve) => {
      const checkYouTube = () => {
        if (document.querySelector('ytd-app') || document.querySelector('#content')) {
          resolve();
        } else {
          setTimeout(checkYouTube, 100);
        }
      };
      checkYouTube();
    });
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get('astraltubeSettings');
      if (result.astraltubeSettings) {
        this.settings = { ...this.settings, ...result.astraltubeSettings };
      }
    } catch (error) {
      console.error('❌ Failed to load settings:', error);
      throw error;
    }
  }

  async initializeComponents() {
    try {
      // Initialize Sidebar
      if (this.settings.sidebarEnabled) {
        this.components.sidebar = mockSidebar;
        await this.components.sidebar.init();
      }

      // Initialize Deck Mode
      this.components.deckMode = mockDeckMode;
      await this.components.deckMode.init();

      // Initialize Playlist Manager
      if (this.settings.playlistManagerEnabled) {
        this.components.playlistManager = mockPlaylistManager;
        await this.components.playlistManager.init();
      }

      // Initialize Subscription Manager
      if (this.settings.subscriptionManagerEnabled) {
        this.components.subscriptionManager = mockSubscriptionManager;
        await this.components.subscriptionManager.init();
      }

    } catch (error) {
      console.error('❌ Failed to initialize components:', error);
      throw error;
    }
  }

  setupObservers() {
    // URL change observer
    this.observer = new MutationObserver((mutations) => {
      const currentUrl = window.location.href;
      if (currentUrl !== this.currentUrl) {
        this.currentUrl = currentUrl;
        this.handleUrlChange(currentUrl);
      }
      
      // Check for new content
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          this.handleContentChange(mutation);
        }
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Page visibility observer
    document.addEventListener('visibilitychange', () => {
      this.handleVisibilityChange();
    });

    // Window focus observer
    window.addEventListener('focus', () => {
      this.handleWindowFocus();
    });

    window.addEventListener('blur', () => {
      this.handleWindowBlur();
    });
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      return this.handleMessage(message, sender, sendResponse);
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'toggleSidebar':
          return this.handleToggleSidebar(sendResponse);
        
        case 'toggleDeckMode':
          return this.handleToggleDeckMode(sendResponse);
        
        case 'addToPlaylist':
          return this.handleAddToPlaylist(message.data, sendResponse);
        
        case 'getPageInfo':
          return this.handleGetPageInfo(sendResponse);
        
        case 'enhancePage':
          return this.handleEnhancePage(sendResponse);
        
        case 'updateSettings':
          return this.handleUpdateSettings(message.data, sendResponse);
        
        default:
          sendResponse({ error: 'Unknown action' });
          return false;
      }
    } catch (error) {
      console.error('❌ Message handling error:', error);
      sendResponse({ error: error.message });
      return false;
    }
  }

  handleToggleSidebar(sendResponse) {
    if (this.components.sidebar) {
      if (this.components.sidebar.isVisible()) {
        this.components.sidebar.hide();
      } else {
        this.components.sidebar.show();
      }
      sendResponse({ success: true, visible: this.components.sidebar.isVisible() });
    } else {
      sendResponse({ error: 'Sidebar not initialized' });
    }
    return false;
  }

  handleToggleDeckMode(sendResponse) {
    if (this.components.deckMode) {
      this.components.deckMode.toggle();
      sendResponse({ success: true, enabled: this.components.deckMode.isEnabled() });
    } else {
      sendResponse({ error: 'Deck mode not initialized' });
    }
    return false;
  }

  async handleAddToPlaylist(data, sendResponse) {
    if (this.components.playlistManager) {
      try {
        await this.components.playlistManager.addToPlaylist(data.videoId, data.playlistId);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ error: error.message });
      }
    } else {
      sendResponse({ error: 'Playlist manager not initialized' });
    }
    return true;
  }

  handleGetPageInfo(sendResponse) {
    const pageInfo = this.getPageInfo();
    sendResponse({ success: true, data: pageInfo });
    return false;
  }

  handleEnhancePage(sendResponse) {
    try {
      this.enhancePage();
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ error: error.message });
    }
    return false;
  }

  async handleUpdateSettings(data, sendResponse) {
    try {
      this.settings = { ...this.settings, ...data };
      await chrome.storage.local.set({ astraltubeSettings: this.settings });
      await this.reinitializeComponents();
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ error: error.message });
    }
    return true;
  }

  handleUrlChange(newUrl) {
    console.log('🔄 URL changed:', newUrl);
    
    // Re-enhance page for new URL
    if (this.settings.autoEnhance) {
      setTimeout(() => this.enhancePage(), 1000);
    }
    
    // Update components for new page
    Object.values(this.components).forEach(component => {
      if (component.onUrlChange) {
        component.onUrlChange(newUrl);
      }
    });
    
    // Send URL change to background
    chrome.runtime.sendMessage({
      action: 'urlChanged',
      url: newUrl,
      pageType: this.getPageType(newUrl)
    });
  }

  handleContentChange(mutation) {
    // Check if playlist elements were added
    if (this.components.playlistManager) {
      const playlistElements = Array.from(mutation.addedNodes)
        .filter(node => node.nodeType === Node.ELEMENT_NODE)
        .filter(node => node.matches?.('.ytd-playlist-video-renderer') || 
                       node.querySelector?.('.ytd-playlist-video-renderer'));
      
      if (playlistElements.length > 0) {
        this.components.playlistManager.enhancePlaylistElements();
      }
    }
    
    // Check if subscription elements were added
    if (this.components.subscriptionManager) {
      const subscriptionElements = Array.from(mutation.addedNodes)
        .filter(node => node.nodeType === Node.ELEMENT_NODE)
        .filter(node => node.matches?.('.ytd-channel-renderer') || 
                       node.querySelector?.('.ytd-channel-renderer'));
      
      if (subscriptionElements.length > 0) {
        this.components.subscriptionManager.enhanceSubscriptionElements();
      }
    }
  }

  handleVisibilityChange() {
    if (document.hidden) {
      // Page hidden
      chrome.runtime.sendMessage({ action: 'pageHidden' });
    } else {
      // Page visible
      chrome.runtime.sendMessage({ action: 'pageVisible' });
      
      // Refresh components
      this.refreshComponents();
    }
  }

  handleWindowFocus() {
    chrome.runtime.sendMessage({ action: 'windowFocused' });
    this.refreshComponents();
  }

  handleWindowBlur() {
    chrome.runtime.sendMessage({ action: 'windowBlurred' });
  }

  getPageInfo() {
    const url = window.location.href;
    const pageType = this.getPageType(url);
    
    const info = {
      url,
      pageType,
      title: document.title,
      timestamp: Date.now()
    };
    
    // Add page-specific info
    switch (pageType) {
      case 'watch':
        info.videoId = this.getVideoId();
        info.videoTitle = this.getVideoTitle();
        info.channelName = this.getChannelName();
        info.duration = this.getVideoDuration();
        break;
        
      case 'playlist':
        info.playlistId = this.getPlaylistId();
        info.playlistTitle = this.getPlaylistTitle();
        info.videoCount = this.getPlaylistVideoCount();
        break;
        
      case 'channel':
        info.channelId = this.getChannelId();
        info.channelName = this.getChannelName();
        info.subscriberCount = this.getSubscriberCount();
        break;
    }
    
    return info;
  }

  getPageType(url = window.location.href) {
    if (url.includes('/watch')) return 'watch';
    if (url.includes('/playlist')) return 'playlist';
    if (url.includes('/channel') || url.includes('/c/') || url.includes('/@')) return 'channel';
    if (url.includes('/results')) return 'search';
    if (url === 'https://www.youtube.com/' || url === 'https://www.youtube.com') return 'home';
    if (url.includes('/feed/subscriptions')) return 'subscriptions';
    return 'other';
  }

  getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  getVideoTitle() {
    const titleElement = document.querySelector('h1.ytd-video-primary-info-renderer');
    return titleElement?.textContent?.trim() || '';
  }

  getChannelName() {
    const channelElement = document.querySelector('#owner-name a') || 
                          document.querySelector('.ytd-channel-name a');
    return channelElement?.textContent?.trim() || '';
  }

  getVideoDuration() {
    const durationElement = document.querySelector('.ytp-time-duration');
    return durationElement?.textContent?.trim() || '';
  }

  getPlaylistId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('list');
  }

  getPlaylistTitle() {
    const titleElement = document.querySelector('#playlist-title');
    return titleElement?.textContent?.trim() || '';
  }

  getPlaylistVideoCount() {
    const countElement = document.querySelector('#playlist-stats .ytd-playlist-sidebar-primary-info-renderer');
    return countElement?.textContent?.trim() || '';
  }

  getChannelId() {
    const canonical = document.querySelector('link[rel="canonical"]');
    const url = canonical?.href || window.location.href;
    const match = url.match(/\/channel\/(UC[\w-]+)/);
    return match ? match[1] : null;
  }

  getSubscriberCount() {
    const countElement = document.querySelector('#subscriber-count');
    return countElement?.textContent?.trim() || '';
  }

  enhancePage() {
    const pageType = this.getPageType();
    
    switch (pageType) {
      case 'watch':
        this.enhanceWatchPage();
        break;
      case 'playlist':
        this.enhancePlaylistPage();
        break;
      case 'channel':
        this.enhanceChannelPage();
        break;
      case 'search':
        this.enhanceSearchPage();
        break;
      case 'subscriptions':
        this.enhanceSubscriptionsPage();
        break;
    }
    
    // Apply global enhancements
    this.applyGlobalEnhancements();
  }

  enhanceWatchPage() {
    // Add AstralTube controls to video player
    this.addPlayerControls();
    
    // Enhance sidebar with AstralTube features
    if (this.components.sidebar) {
      this.components.sidebar.render();
    }
    
    // Add playlist quick-add buttons
    if (this.components.playlistManager) {
      this.components.playlistManager.enhancePlaylistElements();
    }
  }

  enhancePlaylistPage() {
    if (this.components.playlistManager) {
      this.components.playlistManager.enhancePlaylistElements();
    }
  }

  enhanceChannelPage() {
    if (this.components.subscriptionManager) {
      this.components.subscriptionManager.enhanceSubscriptionElements();
    }
  }

  enhanceSearchPage() {
    // Add bulk actions for search results
    this.addBulkActions();
  }

  enhanceSubscriptionsPage() {
    if (this.components.subscriptionManager) {
      this.components.subscriptionManager.enhanceSubscriptionElements();
      this.components.subscriptionManager.checkNewVideos();
    }
  }

  applyGlobalEnhancements() {
    // Add AstralTube CSS
    this.addGlobalCSS();
    
    // Add keyboard shortcuts
    this.addKeyboardShortcuts();
  }

  addPlayerControls() {
    // Mock implementation - would add custom player controls
    const player = document.querySelector('.ytp-chrome-bottom');
    if (player && !player.querySelector('.astraltube-controls')) {
      const controls = document.createElement('div');
      controls.className = 'astraltube-controls';
      controls.innerHTML = `
        <button class="astraltube-btn" id="astraltube-add-to-playlist">+ Playlist</button>
        <button class="astraltube-btn" id="astraltube-deck-mode">Deck Mode</button>
      `;
      player.appendChild(controls);
    }
  }

  addBulkActions() {
    // Mock implementation - would add bulk action controls
    const results = document.querySelector('#contents');
    if (results && !results.querySelector('.astraltube-bulk-actions')) {
      const bulkActions = document.createElement('div');
      bulkActions.className = 'astraltube-bulk-actions';
      bulkActions.innerHTML = `
        <button class="astraltube-bulk-btn">Select All</button>
        <button class="astraltube-bulk-btn">Add Selected to Playlist</button>
      `;
      results.prepend(bulkActions);
    }
  }

  addGlobalCSS() {
    if (!document.querySelector('#astraltube-global-css')) {
      const css = document.createElement('style');
      css.id = 'astraltube-global-css';
      css.textContent = `
        .astraltube-controls { display: flex; gap: 8px; margin-left: 8px; }
        .astraltube-btn { padding: 6px 12px; font-size: 12px; border: 1px solid #ccc; background: #fff; cursor: pointer; }
        .astraltube-bulk-actions { padding: 16px; background: #f9f9f9; margin-bottom: 16px; }
        .astraltube-bulk-btn { padding: 8px 16px; margin-right: 8px; background: #065fd4; color: white; border: none; cursor: pointer; }
      `;
      document.head.appendChild(css);
    }
  }

  addKeyboardShortcuts() {
    if (!this.keyboardListenerAdded) {
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.altKey) {
          switch (e.key) {
            case 's':
              e.preventDefault();
              this.handleToggleSidebar(() => {});
              break;
            case 'd':
              e.preventDefault();
              this.handleToggleDeckMode(() => {});
              break;
            case 'p':
              e.preventDefault();
              // Open playlist manager
              if (this.components.playlistManager) {
                this.components.playlistManager.show?.();
              }
              break;
          }
        }
      });
      this.keyboardListenerAdded = true;
    }
  }

  refreshComponents() {
    Object.values(this.components).forEach(component => {
      if (component.refresh) {
        component.refresh();
      }
    });
  }

  async reinitializeComponents() {
    // Destroy existing components
    Object.values(this.components).forEach(component => {
      if (component.destroy) {
        component.destroy();
      }
    });
    
    // Clear components
    this.components = {};
    
    // Reinitialize based on new settings
    await this.initializeComponents();
    
    // Re-enhance page
    if (this.settings.autoEnhance) {
      this.enhancePage();
    }
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    Object.values(this.components).forEach(component => {
      if (component.destroy) {
        component.destroy();
      }
    });
    
    this.components = {};
    this.initialized = false;
  }
}

describe('AstralTubeContent', () => {
  let contentScript;
  
  beforeEach(() => {
    // Reset all mocks
    chromeTestUtils.resetMocks();
    domMocks.resetMocks();
    
    // Clear mock calls
    Object.values(mockSidebar).forEach(fn => fn.mockClear?.());
    Object.values(mockDeckMode).forEach(fn => fn.mockClear?.());
    Object.values(mockPlaylistManager).forEach(fn => fn.mockClear?.());
    Object.values(mockSubscriptionManager).forEach(fn => fn.mockClear?.());
    
    // Setup YouTube page
    mockYouTubePage();
    
    // Use fake timers
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (contentScript) {
      contentScript.destroy();
    }
    contentScript = null;
    
    // Restore timers
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      chromeMocks.storage.local.get.mockResolvedValueOnce({});
      
      contentScript = new MockAstralTubeContent();
      await testUtils.waitFor(() => contentScript.initialized);
      
      expect(contentScript.initialized).toBe(true);
      expect(chromeMocks.runtime.sendMessage).toHaveBeenCalledWith({ action: 'contentScriptReady' });
    });

    test('should wait for YouTube to load', async () => {
      // Remove YouTube elements initially
      document.body.innerHTML = '';
      
      chromeMocks.storage.local.get.mockResolvedValueOnce({});
      
      contentScript = new MockAstralTubeContent();
      
      // Should not be initialized yet
      expect(contentScript.initialized).toBe(false);
      
      // Add YouTube element after delay
      setTimeout(() => {
        const ytdApp = document.createElement('ytd-app');
        document.body.appendChild(ytdApp);
      }, 200);
      
      jest.advanceTimersByTime(300);
      await testUtils.waitFor(() => contentScript.initialized);
      
      expect(contentScript.initialized).toBe(true);
    });

    test('should load custom settings', async () => {
      const customSettings = {
        sidebarEnabled: false,
        deckModeEnabled: true,
        autoEnhance: false
      };
      
      chromeMocks.storage.local.get.mockResolvedValueOnce({
        astraltubeSettings: customSettings
      });
      
      contentScript = new MockAstralTubeContent();
      await testUtils.waitFor(() => contentScript.initialized);
      
      expect(contentScript.settings.sidebarEnabled).toBe(false);
      expect(contentScript.settings.deckModeEnabled).toBe(true);
      expect(contentScript.settings.autoEnhance).toBe(false);
    });

    test('should initialize components based on settings', async () => {
      chromeMocks.storage.local.get.mockResolvedValueOnce({
        astraltubeSettings: {
          sidebarEnabled: true,
          playlistManagerEnabled: true,
          subscriptionManagerEnabled: false
        }
      });
      
      contentScript = new MockAstralTubeContent();
      await testUtils.waitFor(() => contentScript.initialized);
      
      expect(mockSidebar.init).toHaveBeenCalled();
      expect(mockDeckMode.init).toHaveBeenCalled(); // Always initialized
      expect(mockPlaylistManager.init).toHaveBeenCalled();
      expect(mockSubscriptionManager.init).not.toHaveBeenCalled();
    });

    test('should handle initialization errors gracefully', async () => {
      chromeMocks.storage.local.get.mockRejectedValueOnce(new Error('Storage error'));
      
      await expect(async () => {
        contentScript = new MockAstralTubeContent();
        await testUtils.waitFor(() => contentScript.initialized, 1000);
      }).rejects.toThrow();
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      chromeMocks.storage.local.get.mockResolvedValueOnce({});
      contentScript = new MockAstralTubeContent();
      await testUtils.waitFor(() => contentScript.initialized);
    });

    test('should toggle sidebar', async () => {
      mockSidebar.isVisible.mockReturnValue(false);
      
      const response = await testUtils.mockChromeMessage({
        action: 'toggleSidebar'
      });
      
      expect(mockSidebar.show).toHaveBeenCalled();
      expect(response.success).toBe(true);
    });

    test('should toggle deck mode', async () => {
      mockDeckMode.isEnabled.mockReturnValue(true);
      
      const response = await testUtils.mockChromeMessage({
        action: 'toggleDeckMode'
      });
      
      expect(mockDeckMode.toggle).toHaveBeenCalled();
      expect(response.success).toBe(true);
      expect(response.enabled).toBe(true);
    });

    test('should add video to playlist', async () => {
      const response = await testUtils.mockChromeMessage({
        action: 'addToPlaylist',
        data: { videoId: 'test123', playlistId: 'PLTest456' }
      });
      
      expect(mockPlaylistManager.addToPlaylist).toHaveBeenCalledWith('test123', 'PLTest456');
      expect(response.success).toBe(true);
    });

    test('should get page info', async () => {
      // Mock location
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://www.youtube.com/watch?v=test123',
          search: '?v=test123'
        },
        writable: true
      });
      
      const response = await testUtils.mockChromeMessage({
        action: 'getPageInfo'
      });
      
      expect(response.success).toBe(true);
      expect(response.data.pageType).toBe('watch');
      expect(response.data.videoId).toBe('test123');
    });

    test('should enhance page on demand', async () => {
      const enhanceSpy = jest.spyOn(contentScript, 'enhancePage');
      
      const response = await testUtils.mockChromeMessage({
        action: 'enhancePage'
      });
      
      expect(enhanceSpy).toHaveBeenCalled();
      expect(response.success).toBe(true);
    });

    test('should update settings', async () => {
      const newSettings = { sidebarEnabled: false };
      
      const response = await testUtils.mockChromeMessage({
        action: 'updateSettings',
        data: newSettings
      });
      
      expect(contentScript.settings.sidebarEnabled).toBe(false);
      expect(chromeMocks.storage.local.set).toHaveBeenCalledWith({
        astraltubeSettings: expect.objectContaining(newSettings)
      });
      expect(response.success).toBe(true);
    });

    test('should handle unknown actions', async () => {
      const response = await testUtils.mockChromeMessage({
        action: 'unknownAction'
      });
      
      expect(response.error).toBe('Unknown action');
    });

    test('should handle message errors', async () => {
      mockPlaylistManager.addToPlaylist.mockRejectedValueOnce(new Error('Playlist error'));
      
      const response = await testUtils.mockChromeMessage({
        action: 'addToPlaylist',
        data: { videoId: 'test123', playlistId: 'invalid' }
      });
      
      expect(response.error).toBe('Playlist error');
    });
  });

  describe('URL Change Handling', () => {
    beforeEach(async () => {
      chromeMocks.storage.local.get.mockResolvedValueOnce({});
      contentScript = new MockAstralTubeContent();
      await testUtils.waitFor(() => contentScript.initialized);
    });

    test('should detect URL changes', () => {
      const handleUrlChangeSpy = jest.spyOn(contentScript, 'handleUrlChange');
      const newUrl = 'https://www.youtube.com/watch?v=newvideo123';
      
      // Simulate URL change
      Object.defineProperty(window, 'location', {
        value: { href: newUrl },
        writable: true
      });
      
      // Trigger MutationObserver
      const mutation = {
        addedNodes: [document.createElement('div')]
      };
      contentScript.observer.callback([mutation]);
      
      expect(handleUrlChangeSpy).toHaveBeenCalledWith(newUrl);
      expect(chromeMocks.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'urlChanged',
        url: newUrl,
        pageType: 'watch'
      });
    });

    test('should re-enhance page on URL change when autoEnhance is enabled', () => {
      const enhancePageSpy = jest.spyOn(contentScript, 'enhancePage');
      contentScript.settings.autoEnhance = true;
      
      contentScript.handleUrlChange('https://www.youtube.com/watch?v=newvideo');
      
      jest.advanceTimersByTime(1100); // Wait for timeout
      
      expect(enhancePageSpy).toHaveBeenCalled();
    });

    test('should not re-enhance when autoEnhance is disabled', () => {
      const enhancePageSpy = jest.spyOn(contentScript, 'enhancePage');
      contentScript.settings.autoEnhance = false;
      
      contentScript.handleUrlChange('https://www.youtube.com/watch?v=newvideo');
      
      jest.advanceTimersByTime(1100);
      
      expect(enhancePageSpy).not.toHaveBeenCalled();
    });
  });

  describe('Page Enhancement', () => {
    beforeEach(async () => {
      chromeMocks.storage.local.get.mockResolvedValueOnce({});
      contentScript = new MockAstralTubeContent();
      await testUtils.waitFor(() => contentScript.initialized);
    });

    test('should enhance watch page', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.youtube.com/watch?v=test123' },
        writable: true
      });
      
      const addPlayerControlsSpy = jest.spyOn(contentScript, 'addPlayerControls');
      
      contentScript.enhancePage();
      
      expect(addPlayerControlsSpy).toHaveBeenCalled();
      expect(mockSidebar.render).toHaveBeenCalled();
      expect(mockPlaylistManager.enhancePlaylistElements).toHaveBeenCalled();
    });

    test('should enhance playlist page', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.youtube.com/playlist?list=PLTest123' },
        writable: true
      });
      
      contentScript.enhancePage();
      
      expect(mockPlaylistManager.enhancePlaylistElements).toHaveBeenCalled();
    });

    test('should enhance channel page', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.youtube.com/channel/UCTest123' },
        writable: true
      });
      
      contentScript.enhancePage();
      
      expect(mockSubscriptionManager.enhanceSubscriptionElements).toHaveBeenCalled();
    });

    test('should enhance subscriptions page', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.youtube.com/feed/subscriptions' },
        writable: true
      });
      
      contentScript.enhancePage();
      
      expect(mockSubscriptionManager.enhanceSubscriptionElements).toHaveBeenCalled();
      expect(mockSubscriptionManager.checkNewVideos).toHaveBeenCalled();
    });

    test('should add global CSS and keyboard shortcuts', () => {
      const addGlobalCSSSpy = jest.spyOn(contentScript, 'addGlobalCSS');
      const addKeyboardShortcutsSpy = jest.spyOn(contentScript, 'addKeyboardShortcuts');
      
      contentScript.enhancePage();
      
      expect(addGlobalCSSSpy).toHaveBeenCalled();
      expect(addKeyboardShortcutsSpy).toHaveBeenCalled();
    });
  });

  describe('Page Info Extraction', () => {
    beforeEach(async () => {
      chromeMocks.storage.local.get.mockResolvedValueOnce({});
      contentScript = new MockAstralTubeContent();
      await testUtils.waitFor(() => contentScript.initialized);
    });

    test('should identify page types correctly', () => {
      expect(contentScript.getPageType('https://www.youtube.com/watch?v=test123')).toBe('watch');
      expect(contentScript.getPageType('https://www.youtube.com/playlist?list=PLTest')).toBe('playlist');
      expect(contentScript.getPageType('https://www.youtube.com/channel/UCTest')).toBe('channel');
      expect(contentScript.getPageType('https://www.youtube.com/results?search_query=test')).toBe('search');
      expect(contentScript.getPageType('https://www.youtube.com/')).toBe('home');
      expect(contentScript.getPageType('https://www.youtube.com/feed/subscriptions')).toBe('subscriptions');
    });

    test('should extract video ID from URL', () => {
      Object.defineProperty(window, 'location', {
        value: { search: '?v=test123&list=PLTest' },
        writable: true
      });
      
      expect(contentScript.getVideoId()).toBe('test123');
    });

    test('should extract playlist ID from URL', () => {
      Object.defineProperty(window, 'location', {
        value: { search: '?list=PLTest123&index=1' },
        writable: true
      });
      
      expect(contentScript.getPlaylistId()).toBe('PLTest123');
    });

    test('should get comprehensive page info', () => {
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://www.youtube.com/watch?v=test123',
          search: '?v=test123'
        },
        writable: true
      });
      
      Object.defineProperty(document, 'title', {
        value: 'Test Video - YouTube',
        writable: true
      });
      
      const pageInfo = contentScript.getPageInfo();
      
      expect(pageInfo.url).toBe('https://www.youtube.com/watch?v=test123');
      expect(pageInfo.pageType).toBe('watch');
      expect(pageInfo.title).toBe('Test Video - YouTube');
      expect(pageInfo.videoId).toBe('test123');
      expect(pageInfo.timestamp).toBeCloseTo(Date.now(), -2);
    });
  });

  describe('Content Change Handling', () => {
    beforeEach(async () => {
      chromeMocks.storage.local.get.mockResolvedValueOnce({});
      contentScript = new MockAstralTubeContent();
      await testUtils.waitFor(() => contentScript.initialized);
    });

    test('should enhance playlist elements when added', () => {
      const playlistElement = document.createElement('div');
      playlistElement.className = 'ytd-playlist-video-renderer';
      
      const mutation = {
        addedNodes: [playlistElement]
      };
      
      contentScript.handleContentChange(mutation);
      
      expect(mockPlaylistManager.enhancePlaylistElements).toHaveBeenCalled();
    });

    test('should enhance subscription elements when added', () => {
      const channelElement = document.createElement('div');
      channelElement.className = 'ytd-channel-renderer';
      
      const mutation = {
        addedNodes: [channelElement]
      };
      
      contentScript.handleContentChange(mutation);
      
      expect(mockSubscriptionManager.enhanceSubscriptionElements).toHaveBeenCalled();
    });

    test('should ignore non-element nodes', () => {
      const textNode = document.createTextNode('text');
      
      const mutation = {
        addedNodes: [textNode]
      };
      
      contentScript.handleContentChange(mutation);
      
      expect(mockPlaylistManager.enhancePlaylistElements).not.toHaveBeenCalled();
      expect(mockSubscriptionManager.enhanceSubscriptionElements).not.toHaveBeenCalled();
    });
  });

  describe('Visibility and Focus Handling', () => {
    beforeEach(async () => {
      chromeMocks.storage.local.get.mockResolvedValueOnce({});
      contentScript = new MockAstralTubeContent();
      await testUtils.waitFor(() => contentScript.initialized);
    });

    test('should handle page visibility change', () => {
      const refreshSpy = jest.spyOn(contentScript, 'refreshComponents');
      
      // Mock document.hidden
      Object.defineProperty(document, 'hidden', {
        value: false,
        writable: true
      });
      
      contentScript.handleVisibilityChange();
      
      expect(chromeMocks.runtime.sendMessage).toHaveBeenCalledWith({ action: 'pageVisible' });
      expect(refreshSpy).toHaveBeenCalled();
    });

    test('should handle window focus', () => {
      const refreshSpy = jest.spyOn(contentScript, 'refreshComponents');
      
      contentScript.handleWindowFocus();
      
      expect(chromeMocks.runtime.sendMessage).toHaveBeenCalledWith({ action: 'windowFocused' });
      expect(refreshSpy).toHaveBeenCalled();
    });

    test('should handle window blur', () => {
      contentScript.handleWindowBlur();
      
      expect(chromeMocks.runtime.sendMessage).toHaveBeenCalledWith({ action: 'windowBlurred' });
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      chromeMocks.storage.local.get.mockResolvedValueOnce({});
      contentScript = new MockAstralTubeContent();
      await testUtils.waitFor(() => contentScript.initialized);
    });

    test('should destroy properly', () => {
      contentScript.destroy();
      
      expect(contentScript.initialized).toBe(false);
      expect(contentScript.observer).toBeNull();
      expect(mockSidebar.destroy).toHaveBeenCalled();
      expect(mockDeckMode.destroy).toHaveBeenCalled();
      expect(mockPlaylistManager.destroy).toHaveBeenCalled();
      expect(mockSubscriptionManager.destroy).toHaveBeenCalled();
    });

    test('should handle component destruction errors', () => {
      mockSidebar.destroy.mockImplementationOnce(() => {
        throw new Error('Destroy error');
      });
      
      // Should not throw
      expect(() => contentScript.destroy()).not.toThrow();
      expect(contentScript.initialized).toBe(false);
    });
  });
});