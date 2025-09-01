/**
 * AstralTube v3 - Integration Tests
 * Tests for service worker and content script interactions
 */

import { chromeMocks, chromeTestUtils } from '../mocks/chrome-api.js';
import { youTubeAPIMocks } from '../mocks/youtube-api.js';
import { domMocks, mockYouTubePage } from '../mocks/dom.js';

// Mock service worker and content script classes for integration testing
class MockServiceWorkerIntegration {
  constructor() {
    this.initialized = false;
    this.activeConnections = new Map();
    this.messageHandlers = new Map();
    this.init();
  }

  async init() {
    this.setupMessageHandlers();
    this.initialized = true;
  }

  setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const handler = this.messageHandlers.get(message.action);
      if (handler) {
        return handler(message, sender, sendResponse);
      }
      return false;
    });

    chrome.runtime.onConnect.addListener((port) => {
      this.handleConnection(port);
    });
  }

  handleConnection(port) {
    const connectionId = `conn_${Date.now()}`;
    this.activeConnections.set(connectionId, {
      port,
      created: Date.now()
    });

    port.onMessage.addListener((message) => {
      this.handlePortMessage(connectionId, message);
    });

    port.onDisconnect.addListener(() => {
      this.activeConnections.delete(connectionId);
    });
  }

  handlePortMessage(connectionId, message) {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      const connection = this.activeConnections.get(connectionId);
      if (connection) {
        handler(message, { connectionId }, (response) => {
          connection.port.postMessage(response);
        });
      }
    }
  }

  // Register message handlers
  addMessageHandler(action, handler) {
    this.messageHandlers.set(action, handler);
  }

  // Mock API methods that would be called by handlers
  async getPlaylists() {
    return youTubeAPIMocks.playlists.list({ mine: true });
  }

  async createPlaylist(data) {
    return youTubeAPIMocks.playlists.insert({ resource: { snippet: data } });
  }

  async searchVideos(query, options = {}) {
    return youTubeAPIMocks.search.list({ q: query, ...options });
  }

  async getVideoDetails(videoId) {
    return youTubeAPIMocks.videos.list({ id: videoId });
  }
}

class MockContentScriptIntegration {
  constructor() {
    this.initialized = false;
    this.serviceWorkerPort = null;
    this.currentPage = null;
    this.init();
  }

  async init() {
    this.setupMessageListeners();
    this.connectToServiceWorker();
    this.initialized = true;
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      return this.handleMessage(message, sender, sendResponse);
    });
  }

  connectToServiceWorker() {
    this.serviceWorkerPort = chrome.runtime.connect({ name: 'content-script' });
    
    this.serviceWorkerPort.onMessage.addListener((message) => {
      this.handlePortMessage(message);
    });
  }

  async handleMessage(message, sender, sendResponse) {
    switch (message.action) {
      case 'getPageInfo':
        sendResponse({ success: true, data: this.getPageInfo() });
        return false;
      
      case 'enhancePage':
        this.enhancePage();
        sendResponse({ success: true });
        return false;
      
      case 'injectUI':
        this.injectUI(message.data);
        sendResponse({ success: true });
        return false;
      
      default:
        sendResponse({ error: 'Unknown action' });
        return false;
    }
  }

  handlePortMessage(message) {
    switch (message.type) {
      case 'playlistUpdated':
        this.updatePlaylistUI(message.data);
        break;
      
      case 'subscriptionUpdated':
        this.updateSubscriptionUI(message.data);
        break;
      
      case 'settingsChanged':
        this.applySettings(message.data);
        break;
    }
  }

  sendToServiceWorker(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response);
      });
    });
  }

  sendPortMessage(message) {
    if (this.serviceWorkerPort) {
      this.serviceWorkerPort.postMessage(message);
    }
  }

  getPageInfo() {
    const url = window.location.href;
    return {
      url,
      pageType: this.getPageType(url),
      videoId: this.getVideoId(),
      playlistId: this.getPlaylistId(),
      timestamp: Date.now()
    };
  }

  getPageType(url = window.location.href) {
    if (url.includes('/watch')) return 'watch';
    if (url.includes('/playlist')) return 'playlist';
    if (url.includes('/channel')) return 'channel';
    return 'other';
  }

  getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  getPlaylistId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('list');
  }

  enhancePage() {
    this.currentPage = this.getPageInfo();
    
    // Simulate page enhancement based on type
    switch (this.currentPage.pageType) {
      case 'watch':
        this.enhanceWatchPage();
        break;
      case 'playlist':
        this.enhancePlaylistPage();
        break;
      case 'channel':
        this.enhanceChannelPage();
        break;
    }
  }

  enhanceWatchPage() {
    // Simulate adding video controls
    const player = document.querySelector('.ytp-chrome-bottom');
    if (player && !player.querySelector('.astraltube-controls')) {
      const controls = document.createElement('div');
      controls.className = 'astraltube-controls';
      controls.innerHTML = '<button id="add-to-playlist">Add to Playlist</button>';
      player.appendChild(controls);
      
      // Add event listener
      controls.querySelector('#add-to-playlist').addEventListener('click', () => {
        this.handleAddToPlaylist();
      });
    }
  }

  enhancePlaylistPage() {
    // Simulate enhancing playlist interface
    const playlist = document.querySelector('#playlist');
    if (playlist && !playlist.querySelector('.astraltube-playlist-tools')) {
      const tools = document.createElement('div');
      tools.className = 'astraltube-playlist-tools';
      tools.innerHTML = '<button id="bulk-add">Bulk Add</button>';
      playlist.appendChild(tools);
    }
  }

  enhanceChannelPage() {
    // Simulate enhancing channel interface
    const channel = document.querySelector('#channel-header');
    if (channel && !channel.querySelector('.astraltube-channel-tools')) {
      const tools = document.createElement('div');
      tools.className = 'astraltube-channel-tools';
      tools.innerHTML = '<button id="subscribe-all">Subscribe to All</button>';
      channel.appendChild(tools);
    }
  }

  async handleAddToPlaylist() {
    const videoId = this.getVideoId();
    if (!videoId) return;
    
    // Get playlists from service worker
    const response = await this.sendToServiceWorker({
      action: 'getPlaylists'
    });
    
    if (response.success) {
      this.showPlaylistSelector(response.data, videoId);
    }
  }

  showPlaylistSelector(playlists, videoId) {
    // Simulate showing playlist selector UI
    const selector = document.createElement('div');
    selector.id = 'playlist-selector';
    selector.innerHTML = `
      <div class="playlist-options">
        ${playlists.items?.map(playlist => 
          `<button data-playlist-id="${playlist.id}">${playlist.snippet.title}</button>`
        ).join('') || '<p>No playlists found</p>'}
      </div>
    `;
    
    document.body.appendChild(selector);
    
    // Add event listeners
    selector.querySelectorAll('button[data-playlist-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const playlistId = e.target.dataset.playlistId;
        await this.addVideoToPlaylist(videoId, playlistId);
        selector.remove();
      });
    });
  }

  async addVideoToPlaylist(videoId, playlistId) {
    const response = await this.sendToServiceWorker({
      action: 'addToPlaylist',
      data: { videoId, playlistId }
    });
    
    if (response.success) {
      this.showNotification('Video added to playlist successfully');
    } else {
      this.showNotification('Failed to add video to playlist', 'error');
    }
  }

  showNotification(message, type = 'success') {
    // Simulate notification
    const notification = document.createElement('div');
    notification.className = `astraltube-notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  injectUI(data) {
    // Simulate injecting UI based on data
    const container = document.createElement('div');
    container.id = 'astraltube-ui';
    container.innerHTML = data.html || '<div>AstralTube UI</div>';
    document.body.appendChild(container);
  }

  updatePlaylistUI(data) {
    // Simulate updating playlist UI
    const playlistElements = document.querySelectorAll('.playlist-item');
    playlistElements.forEach(element => {
      if (element.dataset.playlistId === data.playlistId) {
        element.classList.add('updated');
      }
    });
  }

  updateSubscriptionUI(data) {
    // Simulate updating subscription UI
    const subscriptionElements = document.querySelectorAll('.subscription-item');
    subscriptionElements.forEach(element => {
      if (element.dataset.channelId === data.channelId) {
        element.classList.add('updated');
      }
    });
  }

  applySettings(settings) {
    // Simulate applying new settings
    if (settings.theme) {
      document.body.className = `theme-${settings.theme}`;
    }
    
    if (settings.sidebarEnabled === false) {
      const sidebar = document.querySelector('#astraltube-sidebar');
      if (sidebar) sidebar.style.display = 'none';
    }
  }

  destroy() {
    if (this.serviceWorkerPort) {
      this.serviceWorkerPort.disconnect();
    }
    
    // Remove injected elements
    const injectedElements = document.querySelectorAll('[id^="astraltube-"], .astraltube-controls, .astraltube-playlist-tools');
    injectedElements.forEach(element => element.remove());
    
    this.initialized = false;
  }
}

describe('Service Worker and Content Script Integration', () => {
  let serviceWorker;
  let contentScript;
  
  beforeEach(() => {
    // Reset all mocks
    chromeTestUtils.resetMocks();
    youTubeAPIMocks.resetMocks();
    domMocks.resetMocks();
    
    // Setup YouTube page
    mockYouTubePage();
    
    // Use fake timers
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (serviceWorker) {
      serviceWorker = null;
    }
    if (contentScript) {
      contentScript.destroy();
      contentScript = null;
    }
    
    // Restore timers
    jest.useRealTimers();
  });

  describe('Basic Communication', () => {
    beforeEach(async () => {
      serviceWorker = new MockServiceWorkerIntegration();
      await testUtils.waitFor(() => serviceWorker.initialized);
      
      contentScript = new MockContentScriptIntegration();
      await testUtils.waitFor(() => contentScript.initialized);
    });

    test('should establish connection between service worker and content script', () => {
      expect(serviceWorker.activeConnections.size).toBe(1);
      expect(contentScript.serviceWorkerPort).toBeDefined();
      expect(chromeMocks.runtime.connect).toHaveBeenCalledWith({ name: 'content-script' });
    });

    test('should handle message passing from content script to service worker', async () => {
      const mockHandler = jest.fn((message, sender, sendResponse) => {
        sendResponse({ success: true, data: 'test response' });
        return false;
      });
      
      serviceWorker.addMessageHandler('testMessage', mockHandler);
      
      const response = await contentScript.sendToServiceWorker({
        action: 'testMessage',
        data: { test: 'data' }
      });
      
      expect(mockHandler).toHaveBeenCalled();
      expect(response.success).toBe(true);
      expect(response.data).toBe('test response');
    });

    test('should handle port-based communication', (done) => {
      const testMessage = { type: 'settingsChanged', data: { theme: 'dark' } };
      
      // Mock the port message handler
      const originalHandlePortMessage = contentScript.handlePortMessage;
      contentScript.handlePortMessage = jest.fn((message) => {
        expect(message).toEqual(testMessage);
        originalHandlePortMessage.call(contentScript, message);
        done();
      });
      
      // Simulate service worker sending message through port
      const connection = Array.from(serviceWorker.activeConnections.values())[0];
      connection.port.onMessage.addListener.mock.calls[0][0](testMessage);
    });

    test('should handle connection cleanup', () => {
      const initialConnections = serviceWorker.activeConnections.size;
      
      // Simulate content script disconnect
      const connection = Array.from(serviceWorker.activeConnections.values())[0];
      connection.port.onDisconnect.addListener.mock.calls[0][0]();
      
      expect(serviceWorker.activeConnections.size).toBe(initialConnections - 1);
    });
  });

  describe('Page Enhancement Workflow', () => {
    beforeEach(async () => {
      serviceWorker = new MockServiceWorkerIntegration();
      await testUtils.waitFor(() => serviceWorker.initialized);
      
      contentScript = new MockContentScriptIntegration();
      await testUtils.waitFor(() => contentScript.initialized);
    });

    test('should enhance watch page and enable playlist functionality', async () => {
      // Setup watch page
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://www.youtube.com/watch?v=test123',
          search: '?v=test123'
        },
        writable: true
      });
      
      // Mock playlists response
      const mockPlaylists = {
        items: [
          { id: 'PLTest1', snippet: { title: 'Test Playlist 1' } },
          { id: 'PLTest2', snippet: { title: 'Test Playlist 2' } }
        ]
      };
      
      youTubeAPIMocks.playlists.list.mockResolvedValueOnce(mockPlaylists);
      
      serviceWorker.addMessageHandler('getPlaylists', async (message, sender, sendResponse) => {
        const playlists = await serviceWorker.getPlaylists();
        sendResponse({ success: true, data: playlists });
      });
      
      // Enhance the page
      contentScript.enhancePage();
      
      // Verify controls were added
      expect(document.querySelector('.astraltube-controls')).toBeTruthy();
      expect(document.querySelector('#add-to-playlist')).toBeTruthy();
      
      // Simulate clicking add to playlist
      const addBtn = document.querySelector('#add-to-playlist');
      addBtn.click();
      
      // Wait for async operations
      await testUtils.waitFor(() => document.querySelector('#playlist-selector'));
      
      expect(youTubeAPIMocks.playlists.list).toHaveBeenCalled();
      expect(document.querySelector('#playlist-selector')).toBeTruthy();
      
      // Verify playlist options are shown
      const playlistButtons = document.querySelectorAll('[data-playlist-id]');
      expect(playlistButtons).toHaveLength(2);
    });

    test('should handle adding video to playlist end-to-end', async () => {
      // Setup
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://www.youtube.com/watch?v=test123',
          search: '?v=test123'
        },
        writable: true
      });
      
      const mockPlaylists = {
        items: [{ id: 'PLTest1', snippet: { title: 'Test Playlist 1' } }]
      };
      
      youTubeAPIMocks.playlists.list.mockResolvedValueOnce(mockPlaylists);
      youTubeAPIMocks.playlistItems.insert.mockResolvedValueOnce({
        id: 'newItem123',
        snippet: { playlistId: 'PLTest1', resourceId: { videoId: 'test123' } }
      });
      
      // Setup service worker handlers
      serviceWorker.addMessageHandler('getPlaylists', async (message, sender, sendResponse) => {
        const playlists = await serviceWorker.getPlaylists();
        sendResponse({ success: true, data: playlists });
      });
      
      serviceWorker.addMessageHandler('addToPlaylist', async (message, sender, sendResponse) => {
        try {
          const result = await youTubeAPIMocks.playlistItems.insert({
            resource: {
              snippet: {
                playlistId: message.data.playlistId,
                resourceId: { videoId: message.data.videoId }
              }
            }
          });
          sendResponse({ success: true, data: result });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      });
      
      // Enhance page and trigger add to playlist
      contentScript.enhancePage();
      const addBtn = document.querySelector('#add-to-playlist');
      addBtn.click();
      
      await testUtils.waitFor(() => document.querySelector('#playlist-selector'));
      
      // Click on first playlist
      const playlistBtn = document.querySelector('[data-playlist-id="PLTest1"]');
      playlistBtn.click();
      
      // Wait for completion
      await testUtils.waitFor(() => document.querySelector('.astraltube-notification'));
      
      expect(youTubeAPIMocks.playlistItems.insert).toHaveBeenCalledWith({
        resource: {
          snippet: {
            playlistId: 'PLTest1',
            resourceId: { videoId: 'test123' }
          }
        }
      });
      
      expect(document.querySelector('.astraltube-notification')).toBeTruthy();
      expect(document.querySelector('.astraltube-notification').textContent)
        .toBe('Video added to playlist successfully');
    });

    test('should handle playlist page enhancement', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://www.youtube.com/playlist?list=PLTest123',
          search: '?list=PLTest123'
        },
        writable: true
      });
      
      // Add playlist element to DOM
      const playlistElement = document.createElement('div');
      playlistElement.id = 'playlist';
      document.body.appendChild(playlistElement);
      
      contentScript.enhancePage();
      
      expect(document.querySelector('.astraltube-playlist-tools')).toBeTruthy();
      expect(document.querySelector('#bulk-add')).toBeTruthy();
    });

    test('should handle channel page enhancement', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://www.youtube.com/channel/UCTest123',
          search: ''
        },
        writable: true
      });
      
      // Add channel element to DOM
      const channelElement = document.createElement('div');
      channelElement.id = 'channel-header';
      document.body.appendChild(channelElement);
      
      contentScript.enhancePage();
      
      expect(document.querySelector('.astraltube-channel-tools')).toBeTruthy();
      expect(document.querySelector('#subscribe-all')).toBeTruthy();
    });
  });

  describe('Data Synchronization', () => {
    beforeEach(async () => {
      serviceWorker = new MockServiceWorkerIntegration();
      await testUtils.waitFor(() => serviceWorker.initialized);
      
      contentScript = new MockContentScriptIntegration();
      await testUtils.waitFor(() => contentScript.initialized);
    });

    test('should sync playlist updates from service worker to content script', () => {
      // Add a playlist item to DOM
      const playlistItem = document.createElement('div');
      playlistItem.className = 'playlist-item';
      playlistItem.dataset.playlistId = 'PLTest123';
      document.body.appendChild(playlistItem);
      
      // Simulate service worker sending playlist update
      const connection = Array.from(serviceWorker.activeConnections.values())[0];
      const updateMessage = {
        type: 'playlistUpdated',
        data: { playlistId: 'PLTest123', action: 'videoAdded' }
      };
      
      connection.port.onMessage.addListener.mock.calls[0][0](updateMessage);
      
      expect(playlistItem.classList.contains('updated')).toBe(true);
    });

    test('should sync subscription updates', () => {
      // Add subscription item to DOM
      const subscriptionItem = document.createElement('div');
      subscriptionItem.className = 'subscription-item';
      subscriptionItem.dataset.channelId = 'UCTest123';
      document.body.appendChild(subscriptionItem);
      
      // Simulate service worker sending subscription update
      const connection = Array.from(serviceWorker.activeConnections.values())[0];
      const updateMessage = {
        type: 'subscriptionUpdated',
        data: { channelId: 'UCTest123', hasNewVideos: true }
      };
      
      connection.port.onMessage.addListener.mock.calls[0][0](updateMessage);
      
      expect(subscriptionItem.classList.contains('updated')).toBe(true);
    });

    test('should apply settings changes from service worker', () => {
      const connection = Array.from(serviceWorker.activeConnections.values())[0];
      const settingsMessage = {
        type: 'settingsChanged',
        data: { theme: 'dark', sidebarEnabled: false }
      };
      
      // Add sidebar to test
      const sidebar = document.createElement('div');
      sidebar.id = 'astraltube-sidebar';
      document.body.appendChild(sidebar);
      
      connection.port.onMessage.addListener.mock.calls[0][0](settingsMessage);
      
      expect(document.body.className).toBe('theme-dark');
      expect(sidebar.style.display).toBe('none');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      serviceWorker = new MockServiceWorkerIntegration();
      await testUtils.waitFor(() => serviceWorker.initialized);
      
      contentScript = new MockContentScriptIntegration();
      await testUtils.waitFor(() => contentScript.initialized);
    });

    test('should handle service worker errors gracefully', async () => {
      const errorHandler = jest.fn((message, sender, sendResponse) => {
        sendResponse({ success: false, error: 'Service worker error' });
        return false;
      });
      
      serviceWorker.addMessageHandler('errorTest', errorHandler);
      
      const response = await contentScript.sendToServiceWorker({
        action: 'errorTest'
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('Service worker error');
    });

    test('should handle API errors during playlist operations', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://www.youtube.com/watch?v=test123',
          search: '?v=test123'
        },
        writable: true
      });
      
      // Mock API error
      youTubeAPIMocks.playlists.list.mockRejectedValueOnce(new Error('API quota exceeded'));
      
      serviceWorker.addMessageHandler('getPlaylists', async (message, sender, sendResponse) => {
        try {
          const playlists = await serviceWorker.getPlaylists();
          sendResponse({ success: true, data: playlists });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      });
      
      contentScript.enhancePage();
      const addBtn = document.querySelector('#add-to-playlist');
      addBtn.click();
      
      // Wait for error handling
      await testUtils.waitFor(() => document.querySelector('.astraltube-notification'));
      
      const notification = document.querySelector('.astraltube-notification');
      expect(notification.classList.contains('error')).toBe(true);
    });

    test('should handle connection loss', () => {
      const initialConnections = serviceWorker.activeConnections.size;
      
      // Simulate unexpected disconnect
      contentScript.serviceWorkerPort = null;
      
      // Try to send message after disconnect
      const response = contentScript.sendToServiceWorker({ action: 'test' });
      
      // Should handle gracefully without throwing
      expect(response).resolves.toBeDefined();
      
      // Simulate connection cleanup
      const connection = Array.from(serviceWorker.activeConnections.values())[0];
      connection.port.onDisconnect.addListener.mock.calls[0][0]();
      
      expect(serviceWorker.activeConnections.size).toBe(initialConnections - 1);
    });
  });

  describe('Performance and Resource Management', () => {
    beforeEach(async () => {
      serviceWorker = new MockServiceWorkerIntegration();
      await testUtils.waitFor(() => serviceWorker.initialized);
      
      contentScript = new MockContentScriptIntegration();
      await testUtils.waitFor(() => contentScript.initialized);
    });

    test('should handle multiple concurrent requests', async () => {
      const handler = jest.fn((message, sender, sendResponse) => {
        setTimeout(() => {
          sendResponse({ success: true, requestId: message.requestId });
        }, 100);
        return true; // Async response
      });
      
      serviceWorker.addMessageHandler('concurrentTest', handler);
      
      // Send multiple requests concurrently
      const requests = Array(5).fill(0).map((_, i) => 
        contentScript.sendToServiceWorker({
          action: 'concurrentTest',
          requestId: i
        })
      );
      
      jest.advanceTimersByTime(150);
      const responses = await Promise.all(requests);
      
      expect(handler).toHaveBeenCalledTimes(5);
      responses.forEach((response, i) => {
        expect(response.success).toBe(true);
        expect(response.requestId).toBe(i);
      });
    });

    test('should manage memory by cleaning up old connections', () => {
      // Create multiple connections
      for (let i = 0; i < 5; i++) {
        const mockPort = {
          onMessage: { addListener: jest.fn() },
          onDisconnect: { addListener: jest.fn() },
          postMessage: jest.fn(),
          disconnect: jest.fn()
        };
        serviceWorker.handleConnection(mockPort);
      }
      
      expect(serviceWorker.activeConnections.size).toBe(6); // 5 new + 1 existing
      
      // Simulate cleanup of old connections
      const connectionIds = Array.from(serviceWorker.activeConnections.keys()).slice(0, 3);
      connectionIds.forEach(id => {
        const connection = serviceWorker.activeConnections.get(id);
        connection.port.onDisconnect.addListener.mock.calls[0][0]();
      });
      
      expect(serviceWorker.activeConnections.size).toBe(3);
    });

    test('should handle rapid page navigation without memory leaks', () => {
      const originalDestroy = contentScript.destroy;
      const destroySpy = jest.spyOn(contentScript, 'destroy');
      
      // Simulate rapid navigation
      for (let i = 0; i < 10; i++) {
        Object.defineProperty(window, 'location', {
          value: {
            href: `https://www.youtube.com/watch?v=test${i}`,
            search: `?v=test${i}`
          },
          writable: true
        });
        
        contentScript.enhancePage();
      }
      
      // Verify no excessive element accumulation
      const astraltubeElements = document.querySelectorAll('[id^="astraltube-"], [class*="astraltube-"]');
      expect(astraltubeElements.length).toBeLessThan(20); // Should not accumulate indefinitely
      
      // Cleanup
      contentScript.destroy();
      expect(destroySpy).toHaveBeenCalled();
      
      // Verify cleanup was effective
      const remainingElements = document.querySelectorAll('[id^="astraltube-"], [class*="astraltube-"]');
      expect(remainingElements.length).toBe(0);
    });
  });
});