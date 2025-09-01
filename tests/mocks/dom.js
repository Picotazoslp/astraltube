/**
 * AstralTube v3 - DOM Mocks
 * Mock DOM elements and methods for YouTube page testing
 */

// Mock YouTube video element
const createMockVideoElement = () => {
  const element = document.createElement('div');
  element.className = 'video-stream html5-main-video';
  element.id = 'movie_player';
  
  // Mock video properties
  Object.defineProperties(element, {
    currentTime: { value: 120, writable: true },
    duration: { value: 300, writable: true },
    paused: { value: false, writable: true },
    volume: { value: 0.8, writable: true },
    muted: { value: false, writable: true },
    playbackRate: { value: 1, writable: true },
    videoWidth: { value: 1920, writable: true },
    videoHeight: { value: 1080, writable: true },
    readyState: { value: 4, writable: true }
  });
  
  // Mock video methods
  element.play = jest.fn(() => Promise.resolve());
  element.pause = jest.fn();
  element.load = jest.fn();
  element.canPlayType = jest.fn(() => 'probably');
  
  return element;
};

// Mock YouTube playlist element
const createMockPlaylistElement = () => {
  const element = document.createElement('div');
  element.className = 'ytd-playlist-video-renderer';
  element.innerHTML = `
    <div class="ytd-thumbnail">
      <img src="https://i.ytimg.com/vi/test123/hqdefault.jpg" alt="Video thumbnail">
    </div>
    <div class="details">
      <h3>
        <a href="/watch?v=test123&list=PLTest123" class="yt-simple-endpoint">
          Test Video Title
        </a>
      </h3>
      <div class="meta">
        <a href="/channel/UCTestChannel" class="yt-simple-endpoint">Test Channel</a>
        <span class="style-scope ytd-video-meta-block">1M views</span>
      </div>
    </div>
  `;
  
  return element;
};

// Mock YouTube channel element
const createMockChannelElement = () => {
  const element = document.createElement('div');
  element.className = 'ytd-channel-renderer';
  element.innerHTML = `
    <div class="ytd-channel-avatar">
      <img src="https://yt3.ggpht.com/test/avatar.jpg" alt="Channel avatar">
    </div>
    <div class="details">
      <h3>
        <a href="/channel/UCTestChannel" class="yt-simple-endpoint">
          Test Channel
        </a>
      </h3>
      <div class="meta">
        <span class="subscriber-count">100K subscribers</span>
        <span class="video-count">500 videos</span>
      </div>
    </div>
  `;
  
  return element;
};

// Mock YouTube sidebar element
const createMockSidebarElement = () => {
  const element = document.createElement('div');
  element.id = 'secondary';
  element.className = 'style-scope ytd-watch-flexy';
  element.innerHTML = `
    <div id="secondary-inner">
      <div class="ytd-watch-next-secondary-results-renderer">
        <!-- Related videos and playlist content -->
      </div>
    </div>
  `;
  
  return element;
};

// Mock YouTube navigation elements
const createMockNavigationElements = () => {
  const nav = document.createElement('div');
  nav.id = 'guide';
  nav.innerHTML = `
    <div class="guide-section">
      <div class="guide-entry" data-guide-entry-id="subscriptions">
        <span class="guide-entry-text">Subscriptions</span>
      </div>
      <div class="guide-entry" data-guide-entry-id="library">
        <span class="guide-entry-text">Library</span>
      </div>
      <div class="guide-entry" data-guide-entry-id="history">
        <span class="guide-entry-text">History</span>
      </div>
    </div>
  `;
  
  return nav;
};

// Mock YouTube page header
const createMockHeaderElement = () => {
  const header = document.createElement('div');
  header.id = 'masthead';
  header.innerHTML = `
    <div id="container">
      <div id="start">
        <div id="logo">YouTube</div>
      </div>
      <div id="center">
        <form id="search-form">
          <input id="search" type="text" placeholder="Search">
          <button id="search-icon-legacy" type="submit">Search</button>
        </form>
      </div>
      <div id="end">
        <div id="buttons">
          <button id="avatar-btn">Account</button>
        </div>
      </div>
    </div>
  `;
  
  return header;
};

// Mock YouTube player controls
const createMockPlayerControls = () => {
  const controls = document.createElement('div');
  controls.className = 'ytp-chrome-bottom';
  controls.innerHTML = `
    <div class="ytp-chrome-controls">
      <div class="ytp-left-controls">
        <button class="ytp-play-button" data-title-no-tooltip="Play"></button>
        <button class="ytp-next-button" data-title-no-tooltip="Next"></button>
        <div class="ytp-time-display">
          <span class="ytp-time-current">2:00</span>
          <span class="ytp-time-separator">/</span>
          <span class="ytp-time-duration">5:00</span>
        </div>
      </div>
      <div class="ytp-right-controls">
        <button class="ytp-mute-button" data-title-no-tooltip="Mute"></button>
        <div class="ytp-volume-slider"></div>
        <button class="ytp-settings-button" data-title-no-tooltip="Settings"></button>
        <button class="ytp-size-button" data-title-no-tooltip="Theater mode"></button>
        <button class="ytp-fullscreen-button" data-title-no-tooltip="Full screen"></button>
      </div>
    </div>
    <div class="ytp-progress-bar-container">
      <div class="ytp-progress-bar">
        <div class="ytp-progress-list"></div>
      </div>
    </div>
  `;
  
  return controls;
};

// Mock comments section
const createMockCommentsSection = () => {
  const comments = document.createElement('div');
  comments.id = 'comments';
  comments.innerHTML = `
    <div class="ytd-comments">
      <div class="ytd-comment-thread-renderer">
        <div class="ytd-comment-renderer">
          <div class="comment-content">
            <span class="author">Test User</span>
            <div class="comment-text">This is a test comment</div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  return comments;
};

// DOM Mock Implementation
export const domMocks = {
  // Main querySelector mock
  querySelector: jest.fn((selector) => {
    switch (selector) {
      case 'video':
      case '.video-stream':
      case '#movie_player video':
        return createMockVideoElement();
      
      case '#secondary':
      case '.ytd-watch-flexy #secondary':
        return createMockSidebarElement();
      
      case '#guide':
      case '.ytd-app #guide':
        return createMockNavigationElements();
      
      case '#masthead':
      case 'ytd-masthead':
        return createMockHeaderElement();
      
      case '.ytp-chrome-bottom':
      case '.ytp-chrome-controls':
        return createMockPlayerControls();
      
      case '#comments':
      case 'ytd-comments':
        return createMockCommentsSection();
      
      case '.ytd-playlist-video-renderer':
        return createMockPlaylistElement();
      
      case '.ytd-channel-renderer':
        return createMockChannelElement();
      
      default:
        return null;
    }
  }),
  
  // Main querySelectorAll mock
  querySelectorAll: jest.fn((selector) => {
    const mockElement = domMocks.querySelector(selector);
    if (mockElement) {
      return [mockElement, mockElement, mockElement]; // Return array of 3 elements
    }
    return [];
  }),
  
  // Element creation utilities
  createVideoElement: createMockVideoElement,
  createPlaylistElement: createMockPlaylistElement,
  createChannelElement: createMockChannelElement,
  createSidebarElement: createMockSidebarElement,
  createNavigationElements: createMockNavigationElements,
  createHeaderElement: createMockHeaderElement,
  createPlayerControls: createMockPlayerControls,
  createCommentsSection: createMockCommentsSection,
  
  // Utility methods for testing
  simulateVideoLoad: (videoElement = null) => {
    const video = videoElement || createMockVideoElement();
    
    // Simulate video loading events
    setTimeout(() => {
      video.dispatchEvent(new Event('loadstart'));
      video.dispatchEvent(new Event('loadedmetadata'));
      video.dispatchEvent(new Event('loadeddata'));
      video.dispatchEvent(new Event('canplay'));
      video.dispatchEvent(new Event('canplaythrough'));
    }, 100);
    
    return video;
  },
  
  simulateVideoProgress: (videoElement, currentTime) => {
    videoElement.currentTime = currentTime;
    videoElement.dispatchEvent(new Event('timeupdate'));
  },
  
  simulateVideoEnd: (videoElement) => {
    videoElement.currentTime = videoElement.duration;
    videoElement.dispatchEvent(new Event('ended'));
  },
  
  simulatePageNavigation: (url) => {
    // Mock history API
    const event = new PopStateEvent('popstate', {
      state: { url }
    });
    window.dispatchEvent(event);
    
    // Update location mock
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        href: url,
        pathname: new URL(url).pathname,
        search: new URL(url).search
      },
      writable: true
    });
  },
  
  simulateUserInteraction: (element, eventType = 'click') => {
    const event = new MouseEvent(eventType, {
      bubbles: true,
      cancelable: true,
      view: window
    });
    element.dispatchEvent(event);
  },
  
  simulateKeyboardInput: (element, key, code = key) => {
    const event = new KeyboardEvent('keydown', {
      key,
      code,
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(event);
  },
  
  // Mock MutationObserver for DOM changes
  createMutationObserver: (callback) => {
    const observer = new MutationObserver(callback);
    
    // Override observe method to simulate mutations
    const originalObserve = observer.observe;
    observer.observe = jest.fn((target, options) => {
      originalObserve.call(observer, target, options);
      
      // Simulate some mutations after a delay
      setTimeout(() => {
        callback([{
          type: 'childList',
          target,
          addedNodes: [createMockVideoElement()],
          removedNodes: []
        }]);
      }, 100);
    });
    
    return observer;
  },
  
  // Reset all DOM mocks
  resetMocks: () => {
    domMocks.querySelector.mockClear();
    domMocks.querySelectorAll.mockClear();
    
    // Clear document body
    if (document.body) {
      document.body.innerHTML = '';
    }
  }
};

// YouTube page structure mock
export const mockYouTubePage = () => {
  const page = document.createElement('div');
  page.id = 'page-manager';
  
  page.appendChild(createMockHeaderElement());
  page.appendChild(createMockNavigationElements());
  
  const content = document.createElement('div');
  content.id = 'contents';
  
  const primary = document.createElement('div');
  primary.id = 'primary';
  primary.appendChild(createMockVideoElement());
  primary.appendChild(createMockPlayerControls());
  primary.appendChild(createMockCommentsSection());
  
  const secondary = createMockSidebarElement();
  
  content.appendChild(primary);
  content.appendChild(secondary);
  page.appendChild(content);
  
  document.body.appendChild(page);
  
  return page;
};