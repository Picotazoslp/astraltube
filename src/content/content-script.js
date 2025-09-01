/**
 * AstralTube v3 - Content Script
 * Main integration with YouTube pages
 */

import { AstralTubeSidebar } from './sidebar.js';
import { AstralTubeDeckMode } from './deck-mode.js';
import { AstralTubePlaylistManager } from './playlist-manager.js';
import { AstralTubeSubscriptionManager } from './subscription-manager.js';
import { StorageManager } from '../lib/storage.js';
import { contentLogger as logger } from '../lib/logger.js';

class AstralTubeContent {
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
            
            // Add visible indicator that the script loaded
            this.addDebugIndicator();
            
            // Show alert for debugging (remove this later)
            console.log('AstralTube: Content script loaded on', window.location.href);
            
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
        }
    }

    async initializeComponents() {
        try {
            // Initialize Sidebar
            if (this.settings.sidebarEnabled) {
                this.components.sidebar = new AstralTubeSidebar();
                await this.components.sidebar.init();
            }

            // Initialize Deck Mode
            this.components.deckMode = new AstralTubeDeckMode();
            await this.components.deckMode.init();

            // Initialize Playlist Manager
            if (this.settings.playlistManagerEnabled) {
                this.components.playlistManager = new AstralTubePlaylistManager();
                await this.components.playlistManager.init();
            }

            // Initialize Subscription Manager
            if (this.settings.subscriptionManagerEnabled) {
                this.components.subscriptionManager = new AstralTubeSubscriptionManager();
                await this.components.subscriptionManager.init();
            }

            console.log('🔧 Components initialized:', Object.keys(this.components));
        } catch (error) {
            console.error('❌ Failed to initialize components:', error);
        }
    }

    setupObservers() {
        // URL change observer
        this.observer = new MutationObserver(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== this.currentUrl) {
                this.currentUrl = currentUrl;
                this.handleUrlChange(currentUrl);
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // YouTube navigation events
        window.addEventListener('yt-navigate-start', () => {
            this.handleNavigationStart();
        });

        window.addEventListener('yt-navigate-finish', () => {
            this.handleNavigationFinish();
        });

        // Page visibility changes
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
    }

    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep channel open for async responses
        });
    }

    handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'toggleSidebar':
                    this.toggleSidebar();
                    sendResponse({ success: true });
                    break;

                case 'toggleDeckMode':
                    this.toggleDeckMode();
                    sendResponse({ success: true });
                    break;

                case 'enhancePage':
                    this.enhancePage();
                    sendResponse({ success: true });
                    break;

                case 'getPageInfo':
                    sendResponse(this.getPageInfo());
                    break;

                case 'updateSettings':
                    this.updateSettings(message.settings);
                    sendResponse({ success: true });
                    break;

                case 'ping':
                    sendResponse({ 
                        status: 'alive', 
                        initialized: this.initialized,
                        url: window.location.href
                    });
                    break;

                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('❌ Error handling message:', error);
            sendResponse({ error: error.message });
        }
    }

    handleUrlChange(url) {
        console.log('🔄 URL changed:', url);
        
        // Notify components of URL change
        Object.values(this.components).forEach(component => {
            if (component.handleUrlChange) {
                component.handleUrlChange(url);
            }
        });

        // Re-enhance page after navigation
        setTimeout(() => {
            if (this.settings.autoEnhance) {
                this.enhancePage();
            }
        }, 1000);
    }

    handleNavigationStart() {
        console.log('🚀 Navigation started');
        
        // Notify components
        Object.values(this.components).forEach(component => {
            if (component.handleNavigationStart) {
                component.handleNavigationStart();
            }
        });
    }

    handleNavigationFinish() {
        console.log('🏁 Navigation finished');
        
        // Notify components
        Object.values(this.components).forEach(component => {
            if (component.handleNavigationFinish) {
                component.handleNavigationFinish();
            }
        });

        // Re-enhance page
        setTimeout(() => {
            if (this.settings.autoEnhance) {
                this.enhancePage();
            }
        }, 500);
    }

    handleVisibilityChange() {
        if (document.hidden) {
            // Page is hidden
            Object.values(this.components).forEach(component => {
                if (component.handlePageHidden) {
                    component.handlePageHidden();
                }
            });
        } else {
            // Page is visible
            Object.values(this.components).forEach(component => {
                if (component.handlePageVisible) {
                    component.handlePageVisible();
                }
            });
        }
    }

    // Component Control Methods
    toggleSidebar() {
        if (this.components.sidebar) {
            this.components.sidebar.toggle();
        } else if (this.settings.sidebarEnabled) {
            // Initialize sidebar if not already done
            this.components.sidebar = new AstralTubeSidebar();
            this.components.sidebar.init().then(() => {
                this.components.sidebar.show();
            });
        }
    }

    toggleDeckMode() {
        if (this.components.deckMode) {
            this.components.deckMode.toggle();
        }
    }

    // Page Enhancement
    enhancePage() {
        try {
            const pageType = this.getPageType();
            console.log('🎨 Enhancing page:', pageType);

            switch (pageType) {
                case 'home':
                    this.enhanceHomePage();
                    break;
                case 'watch':
                    this.enhanceWatchPage();
                    break;
                case 'playlist':
                    this.enhancePlaylistPage();
                    break;
                case 'channel':
                    this.enhanceChannelPage();
                    break;
                case 'subscriptions':
                    this.enhanceSubscriptionsPage();
                    break;
                case 'library':
                    this.enhanceLibraryPage();
                    break;
            }

            // Apply global enhancements
            this.applyGlobalEnhancements();

        } catch (error) {
            console.error('❌ Failed to enhance page:', error);
        }
    }

    enhanceHomePage() {
        // Add AstralTube controls to home page
        this.addHomePageControls();
        
        // Enhance video thumbnails
        this.enhanceVideoThumbnails();
        
        // Add collection filters
        this.addCollectionFilters();
    }

    enhanceWatchPage() {
        // Add playlist controls to watch page
        this.addWatchPageControls();
        
        // Enhance video player
        this.enhanceVideoPlayer();
        
        // Add quick actions
        this.addQuickActions();
    }

    enhancePlaylistPage() {
        // Add playlist management tools
        this.addPlaylistTools();
        
        // Add duration calculator
        this.addDurationCalculator();
        
        // Enhance playlist items
        this.enhancePlaylistItems();
    }

    enhanceChannelPage() {
        // Add channel management tools
        this.addChannelTools();
        
        // Add to collection button
        this.addToCollectionButton();
    }

    enhanceSubscriptionsPage() {
        // Add subscription filters
        this.addSubscriptionFilters();
        
        // Add collection view
        this.addCollectionView();
    }

    enhanceLibraryPage() {
        // Add library enhancements
        this.addLibraryEnhancements();
    }

    applyGlobalEnhancements() {
        // Add global AstralTube styles
        this.injectGlobalStyles();
        
        // Add keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Add context menus
        this.setupContextMenus();
    }

    // Specific Enhancement Methods
    addHomePageControls() {
        const masthead = document.querySelector('#masthead-container');
        if (!masthead || masthead.querySelector('.astraltube-home-controls')) return;

        const controls = document.createElement('div');
        controls.className = 'astraltube-home-controls';
        controls.innerHTML = `
            <div class="astraltube-control-group">
                <button class="astraltube-btn" id="astral-sidebar-toggle" title="Toggle AstralTube Sidebar">
                    <svg viewBox="0 0 24 24" width="20" height="20">
                        <path fill="currentColor" d="M3,9H17V7H3V9M3,13H17V11H3V13M3,17H17V15H3V17M19,17H21V15H19V17M19,7V9H21V7H19M19,13H21V11H19V13Z"/>
                    </svg>
                </button>
                <button class="astraltube-btn" id="astral-deck-toggle" title="Toggle Deck Mode">
                    <svg viewBox="0 0 24 24" width="20" height="20">
                        <path fill="currentColor" d="M3,3H11V11H3V3M13,3H21V11H13V3M3,13H11V21H3V13M13,13H21V21H13V13Z"/>
                    </svg>
                </button>
            </div>
        `;

        // Add event listeners
        controls.querySelector('#astral-sidebar-toggle').addEventListener('click', () => {
            this.toggleSidebar();
        });

        controls.querySelector('#astral-deck-toggle').addEventListener('click', () => {
            this.toggleDeckMode();
        });

        masthead.appendChild(controls);
    }

    addWatchPageControls() {
        const playerControls = document.querySelector('.ytp-right-controls');
        if (!playerControls || playerControls.querySelector('.astraltube-watch-controls')) return;

        const controls = document.createElement('div');
        controls.className = 'astraltube-watch-controls';
        controls.innerHTML = `
            <button class="astraltube-player-btn" id="astral-add-to-playlist" title="Add to AstralTube Playlist">
                <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                </svg>
            </button>
            <button class="astraltube-player-btn" id="astral-quick-collection" title="Add to Collection">
                <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>
                </svg>
            </button>
        `;

        playerControls.insertBefore(controls, playerControls.firstChild);
    }

    addDurationCalculator() {
        const playlistHeader = document.querySelector('ytd-playlist-header-renderer');
        if (!playlistHeader || playlistHeader.querySelector('.astraltube-duration-calc')) return;

        const calculator = document.createElement('button');
        calculator.className = 'astraltube-duration-calc astraltube-btn';
        calculator.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z"/>
            </svg>
            Calculate Duration
        `;

        calculator.addEventListener('click', () => {
            if (this.components.playlistManager) {
                this.components.playlistManager.calculateCurrentPlaylistDuration();
            }
        });

        const statsRow = playlistHeader.querySelector('#stats') || playlistHeader;
        statsRow.appendChild(calculator);
    }

    enhanceVideoThumbnails() {
        const thumbnails = document.querySelectorAll('ytd-thumbnail:not(.astraltube-enhanced)');
        
        thumbnails.forEach(thumbnail => {
            thumbnail.classList.add('astraltube-enhanced');
            
            // Add quick action overlay
            const overlay = document.createElement('div');
            overlay.className = 'astraltube-thumbnail-overlay';
            overlay.innerHTML = `
                <div class="astraltube-quick-actions">
                    <button class="astraltube-quick-btn" data-action="add-to-playlist" title="Add to Playlist">
                        <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                        </svg>
                    </button>
                    <button class="astraltube-quick-btn" data-action="add-to-collection" title="Add to Collection">
                        <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>
                        </svg>
                    </button>
                </div>
            `;

            thumbnail.style.position = 'relative';
            thumbnail.appendChild(overlay);

            // Add event listeners
            overlay.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const action = e.target.closest('[data-action]')?.dataset.action;
                if (action) {
                    this.handleThumbnailAction(action, thumbnail);
                }
            });
        });
    }

    handleThumbnailAction(action, thumbnail) {
        const videoLink = thumbnail.querySelector('a[href*="/watch"]');
        if (!videoLink) return;

        const videoId = new URLSearchParams(new URL(videoLink.href).search).get('v');
        const videoTitle = thumbnail.querySelector('#video-title')?.textContent?.trim();

        switch (action) {
            case 'add-to-playlist':
                if (this.components.playlistManager) {
                    this.components.playlistManager.showAddToPlaylistDialog(videoId, videoTitle);
                }
                break;
            case 'add-to-collection':
                if (this.components.subscriptionManager) {
                    this.components.subscriptionManager.showAddToCollectionDialog(videoId, videoTitle);
                }
                break;
        }
    }

    injectGlobalStyles() {
        if (document.querySelector('#astraltube-global-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'astraltube-global-styles';
        styles.textContent = `
            /* AstralTube Global Styles */
            .astraltube-btn {
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                color: var(--yt-spec-text-primary);
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
            }

            .astraltube-btn:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: translateY(-1px);
            }

            .astraltube-control-group {
                display: flex;
                gap: 8px;
                margin-left: 16px;
            }

            .astraltube-player-btn {
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                padding: 8px;
                border-radius: 4px;
                transition: background 0.2s ease;
            }

            .astraltube-player-btn:hover {
                background: rgba(255, 255, 255, 0.1);
            }

            .astraltube-thumbnail-overlay {
                position: absolute;
                top: 8px;
                right: 8px;
                opacity: 0;
                transition: opacity 0.2s ease;
            }

            .astraltube-enhanced:hover .astraltube-thumbnail-overlay {
                opacity: 1;
            }

            .astraltube-quick-actions {
                display: flex;
                gap: 4px;
            }

            .astraltube-quick-btn {
                background: rgba(0, 0, 0, 0.8);
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
                padding: 6px;
                transition: all 0.2s ease;
            }

            .astraltube-quick-btn:hover {
                background: rgba(0, 0, 0, 0.9);
                transform: scale(1.1);
            }

            /* Dark mode support */
            [dark] .astraltube-btn {
                background: rgba(255, 255, 255, 0.05);
                border-color: rgba(255, 255, 255, 0.1);
            }

            [dark] .astraltube-btn:hover {
                background: rgba(255, 255, 255, 0.1);
            }
        `;

        document.head.appendChild(styles);
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when not typing in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
                return;
            }

            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'b': // Ctrl+B - Toggle Sidebar
                        if (e.shiftKey) {
                            e.preventDefault();
                            this.toggleSidebar();
                        }
                        break;
                    case 'd': // Ctrl+D - Toggle Deck Mode
                        if (e.shiftKey) {
                            e.preventDefault();
                            this.toggleDeckMode();
                        }
                        break;
                    case 'p': // Ctrl+P - Quick add to playlist
                        if (e.shiftKey) {
                            e.preventDefault();
                            this.showQuickAddDialog();
                        }
                        break;
                }
            }
        });
    }

    setupContextMenus() {
        // Add context menu to videos
        document.addEventListener('contextmenu', (e) => {
            const videoElement = e.target.closest('ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer');
            if (videoElement) {
                this.showVideoContextMenu(e, videoElement);
            }
        });
    }

    showVideoContextMenu(e, videoElement) {
        // This would show a custom context menu with AstralTube options
        // For now, we'll just log it
        console.log('🎯 Video context menu requested for:', videoElement);
    }

    showQuickAddDialog() {
        // This would show a quick add dialog
        console.log('⚡ Quick add dialog requested');
    }

    // Utility Methods
    getPageType() {
        const path = window.location.pathname;
        const search = window.location.search;

        if (path === '/' || path === '/feed/subscriptions') {
            return 'home';
        } else if (path === '/watch') {
            return 'watch';
        } else if (path.includes('/playlist')) {
            return 'playlist';
        } else if (path.includes('/channel') || path.includes('/c/') || path.includes('/user/')) {
            return 'channel';
        } else if (path === '/feed/subscriptions') {
            return 'subscriptions';
        } else if (path === '/feed/library') {
            return 'library';
        }

        return 'other';
    }

    getPageInfo() {
        return {
            url: window.location.href,
            type: this.getPageType(),
            title: document.title,
            videoId: this.getCurrentVideoId(),
            playlistId: this.getCurrentPlaylistId(),
            channelId: this.getCurrentChannelId()
        };
    }

    getCurrentVideoId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('v');
    }

    getCurrentPlaylistId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('list');
    }

    getCurrentChannelId() {
        const channelLink = document.querySelector('ytd-channel-name a, .ytd-video-owner-renderer a');
        if (channelLink) {
            const href = channelLink.href;
            const match = href.match(/\/channel\/([^\/\?]+)/);
            return match ? match[1] : null;
        }
        return null;
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        
        // Update components with new settings
        Object.values(this.components).forEach(component => {
            if (component.updateSettings) {
                component.updateSettings(newSettings);
            }
        });
    }

    // Cleanup
    destroy() {
        console.log('🧹 Cleaning up AstralTube Content Script');
        
        if (this.observer) {
            this.observer.disconnect();
        }

        // Cleanup components
        Object.values(this.components).forEach(component => {
            if (component.destroy) {
                component.destroy();
            }
        });

        // Remove global styles
        const globalStyles = document.querySelector('#astraltube-global-styles');
        if (globalStyles) {
            globalStyles.remove();
        }

        this.initialized = false;
    }
    
    addDebugIndicator() {
        // Add a visible indicator that the extension is loaded
        const indicator = document.createElement('div');
        indicator.id = 'astraltube-debug-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #667eea;
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
        `;
        indicator.textContent = 'AstralTube Loaded ✓';
        
        // Remove after 3 seconds
        document.body.appendChild(indicator);
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        }, 3000);
        
        // Click to toggle sidebar for testing
        indicator.addEventListener('click', () => {
            if (this.components.sidebar) {
                this.components.sidebar.toggle();
            } else {
                console.log('Sidebar component not initialized yet');
            }
        });
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.astralTubeContent = new AstralTubeContent();
    });
} else {
    window.astralTubeContent = new AstralTubeContent();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.astralTubeContent) {
        window.astralTubeContent.destroy();
    }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AstralTubeContent;
}