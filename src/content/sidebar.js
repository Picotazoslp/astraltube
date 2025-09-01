/**
 * AstralTube v3 - Sidebar Manager
 * Core sidebar functionality with YouTube integration
 */

export class AstralTubeSidebar {
    constructor() {
        this.isVisible = false;
        this.isInitialized = false;
        this.sidebarElement = null;
        this.currentTab = 'playlists';
        this.data = {
            playlists: [],
            collections: [],
            subscriptions: [],
            recentActivity: []
        };
        
        // Configuration
        this.config = {
            width: '350px',
            position: 'right',
            animationDuration: '300ms',
            collapsible: true,
            persistent: true
        };
        
        // State management
        this.state = {
            loading: false,
            error: null,
            lastUpdate: null,
            syncStatus: 'idle'
        };
        
        // Event handlers
        this.eventHandlers = new Map();
        
        this.init();
    }

    async init() {
        try {
            console.log('🎨 Initializing AstralTube Sidebar...');
            
            // Load settings
            await this.loadSettings();
            
            // Create sidebar structure
            await this.createSidebar();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load initial data
            await this.loadInitialData();
            
            // Setup periodic updates
            this.setupPeriodicUpdates();
            
            this.isInitialized = true;
            console.log('✅ AstralTube Sidebar initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize sidebar:', error);
            this.handleError('Initialization failed', error);
        }
    }

    async loadSettings() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getSettings'
            });
            
            if (response?.success && response.data) {
                const settings = response.data;
                this.config = {
                    ...this.config,
                    width: settings.sidebarWidth || this.config.width,
                    position: settings.sidebarPosition || this.config.position,
                    persistent: settings.sidebarPersistent !== false
                };
                
                this.isVisible = settings.sidebarEnabled && settings.sidebarVisible;
            }
        } catch (error) {
            console.error('❌ Failed to load settings:', error);
        }
    }

    async createSidebar() {
        // Remove existing sidebar if present
        this.removeSidebar();
        
        // Create sidebar container
        this.sidebarElement = document.createElement('div');
        this.sidebarElement.id = 'astraltube-sidebar';
        this.sidebarElement.className = `astraltube-sidebar ${this.config.position}`;
        
        // Load sidebar HTML template
        const templateUrl = chrome.runtime.getURL('src/content/sidebar.html');
        console.log('🎨 Loading sidebar template from:', templateUrl);
        
        try {
            const response = await fetch(templateUrl);
            console.log('📥 Template response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            let template = await response.text();
            console.log('✅ Sidebar template loaded, length:', template.length);
            
            // Process template variables
            template = this.processTemplate(template);
            
            this.sidebarElement.innerHTML = template;
        } catch (error) {
            console.error('❌ Failed to load sidebar template:', error);
            console.log('🔧 Using fallback sidebar structure');
            // Fallback to creating basic structure
            this.createFallbackSidebar();
        }
        
        // Apply initial styling
        this.applySidebarStyles();
        
        // Insert into page
        document.body.appendChild(this.sidebarElement);
        
        // Setup resize handle
        this.setupResizeHandle();
        
        // Setup tab navigation
        this.setupTabNavigation();
        
        // Apply visibility state
        if (this.isVisible) {
            this.show();
        } else {
            this.hide();
        }
    }

    createFallbackSidebar() {
        this.sidebarElement.innerHTML = `
            <div class="astraltube-sidebar-header">
                <div class="astraltube-sidebar-logo">
                    <img src="${chrome.runtime.getURL('icons/icon32.png')}" alt="AstralTube">
                    <span>AstralTube</span>
                </div>
                <div class="astraltube-sidebar-controls">
                    <button id="astraltube-sidebar-minimize" title="Minimize">−</button>
                    <button id="astraltube-sidebar-close" title="Close">×</button>
                </div>
            </div>
            
            <div class="astraltube-sidebar-tabs">
                <button class="tab-button active" data-tab="playlists">
                    <span class="tab-icon">📝</span>
                    <span class="tab-label">Playlists</span>
                </button>
                <button class="tab-button" data-tab="collections">
                    <span class="tab-icon">📁</span>
                    <span class="tab-label">Collections</span>
                </button>
                <button class="tab-button" data-tab="subscriptions">
                    <span class="tab-icon">👥</span>
                    <span class="tab-label">Subscriptions</span>
                </button>
                <button class="tab-button" data-tab="activity">
                    <span class="tab-icon">📊</span>
                    <span class="tab-label">Activity</span>
                </button>
            </div>
            
            <div class="astraltube-sidebar-content">
                <div class="tab-content active" data-tab="playlists">
                    <div class="content-header">
                        <h3>My Playlists</h3>
                        <button id="create-playlist-btn" class="action-btn">+ Create</button>
                    </div>
                    <div id="playlists-list" class="content-list">
                        <div class="loading-spinner">Loading playlists...</div>
                    </div>
                </div>
                
                <div class="tab-content" data-tab="collections">
                    <div class="content-header">
                        <h3>Collections</h3>
                        <button id="create-collection-btn" class="action-btn">+ Create</button>
                    </div>
                    <div id="collections-list" class="content-list">
                        <div class="loading-spinner">Loading collections...</div>
                    </div>
                </div>
                
                <div class="tab-content" data-tab="subscriptions">
                    <div class="content-header">
                        <h3>Subscriptions</h3>
                        <button id="manage-subscriptions-btn" class="action-btn">Manage</button>
                    </div>
                    <div id="subscriptions-list" class="content-list">
                        <div class="loading-spinner">Loading subscriptions...</div>
                    </div>
                </div>
                
                <div class="tab-content" data-tab="activity">
                    <div class="content-header">
                        <h3>Recent Activity</h3>
                        <button id="clear-activity-btn" class="action-btn">Clear</button>
                    </div>
                    <div id="activity-list" class="content-list">
                        <div class="loading-spinner">Loading activity...</div>
                    </div>
                </div>
            </div>
            
            <div class="astraltube-sidebar-footer">
                <button id="sync-btn" class="footer-btn" title="Sync Data">🔄 Sync</button>
                <button id="settings-btn" class="footer-btn" title="Settings">⚙️</button>
                <div class="sync-status" id="sync-status">Last sync: Never</div>
            </div>
            
            <div class="astraltube-sidebar-resize-handle"></div>
        `;
    }

    applySidebarStyles() {
        // Check if styles are already applied
        if (document.getElementById('astraltube-sidebar-styles')) {
            return;
        }
        
        const styleElement = document.createElement('style');
        styleElement.id = 'astraltube-sidebar-styles';
        styleElement.textContent = `
            #astraltube-sidebar {
                position: fixed;
                top: 0;
                right: -350px;
                width: ${this.config.width};
                height: 100vh;
                background: #1a1a1a;
                border-left: 1px solid #333;
                z-index: 10000;
                transition: right ${this.config.animationDuration} ease-in-out;
                display: flex;
                flex-direction: column;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                color: #fff;
                box-shadow: -2px 0 10px rgba(0,0,0,0.3);
            }
            
            #astraltube-sidebar.visible {
                right: 0;
            }
            
            #astraltube-sidebar.left {
                right: auto;
                left: -350px;
                border-left: none;
                border-right: 1px solid #333;
            }
            
            #astraltube-sidebar.left.visible {
                left: 0;
            }
            
            .astraltube-sidebar-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px;
                border-bottom: 1px solid #333;
                background: #2a2a2a;
            }
            
            .astraltube-sidebar-logo {
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: 600;
            }
            
            .astraltube-sidebar-logo img {
                width: 24px;
                height: 24px;
            }
            
            .astraltube-sidebar-controls {
                display: flex;
                gap: 4px;
            }
            
            .astraltube-sidebar-controls button {
                background: none;
                border: 1px solid #555;
                color: #fff;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: background 0.2s;
            }
            
            .astraltube-sidebar-controls button:hover {
                background: #444;
            }
            
            .astraltube-sidebar-tabs {
                display: flex;
                border-bottom: 1px solid #333;
                background: #2a2a2a;
            }
            
            .tab-button {
                flex: 1;
                background: none;
                border: none;
                color: #ccc;
                padding: 12px 8px;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                font-size: 11px;
            }
            
            .tab-button:hover {
                background: #333;
                color: #fff;
            }
            
            .tab-button.active {
                background: #1a1a1a;
                color: #fff;
                border-bottom: 2px solid #ff4444;
            }
            
            .tab-icon {
                font-size: 16px;
            }
            
            .tab-label {
                font-size: 10px;
                font-weight: 500;
            }
            
            .astraltube-sidebar-content {
                flex: 1;
                overflow-y: auto;
                padding: 0;
            }
            
            .tab-content {
                display: none;
                height: 100%;
            }
            
            .tab-content.active {
                display: flex;
                flex-direction: column;
            }
            
            .content-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px;
                border-bottom: 1px solid #333;
                background: #242424;
            }
            
            .content-header h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }
            
            .action-btn {
                background: #ff4444;
                border: none;
                color: white;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 500;
                transition: background 0.2s;
            }
            
            .action-btn:hover {
                background: #ff6666;
            }
            
            .content-list {
                flex: 1;
                padding: 16px;
                overflow-y: auto;
            }
            
            .loading-spinner {
                text-align: center;
                color: #888;
                padding: 20px;
            }
            
            .astraltube-sidebar-footer {
                padding: 16px;
                border-top: 1px solid #333;
                background: #2a2a2a;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .footer-btn {
                background: none;
                border: 1px solid #555;
                color: #fff;
                padding: 8px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: background 0.2s;
            }
            
            .footer-btn:hover {
                background: #444;
            }
            
            .sync-status {
                font-size: 10px;
                color: #888;
            }
            
            .astraltube-sidebar-resize-handle {
                position: absolute;
                left: 0;
                top: 0;
                width: 4px;
                height: 100%;
                cursor: col-resize;
                background: transparent;
                transition: background 0.2s;
            }
            
            .astraltube-sidebar-resize-handle:hover {
                background: #ff4444;
            }
            
            /* List items */
            .list-item {
                display: flex;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid #333;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .list-item:hover {
                background: #333;
            }
            
            .list-item-thumbnail {
                width: 40px;
                height: 30px;
                background: #333;
                border-radius: 4px;
                margin-right: 12px;
                object-fit: cover;
            }
            
            .list-item-info {
                flex: 1;
                min-width: 0;
            }
            
            .list-item-title {
                font-weight: 500;
                margin-bottom: 2px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .list-item-subtitle {
                font-size: 12px;
                color: #888;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .list-item-actions {
                display: flex;
                gap: 4px;
                opacity: 0;
                transition: opacity 0.2s;
            }
            
            .list-item:hover .list-item-actions {
                opacity: 1;
            }
            
            .list-item-action {
                background: none;
                border: none;
                color: #888;
                padding: 4px;
                cursor: pointer;
                border-radius: 2px;
                transition: all 0.2s;
            }
            
            .list-item-action:hover {
                background: #444;
                color: #fff;
            }
            
            /* Error states */
            .error-message {
                background: #441111;
                border: 1px solid #662222;
                color: #ffaaaa;
                padding: 12px;
                border-radius: 4px;
                margin: 16px;
                text-align: center;
            }
            
            /* Empty states */
            .empty-state {
                text-align: center;
                color: #888;
                padding: 40px 20px;
            }
            
            .empty-state-icon {
                font-size: 48px;
                margin-bottom: 16px;
                opacity: 0.5;
            }
            
            .empty-state-title {
                font-size: 16px;
                margin-bottom: 8px;
            }
            
            .empty-state-description {
                font-size: 12px;
                line-height: 1.4;
            }
        `;
        
        document.head.appendChild(styleElement);
    }

    setupEventListeners() {
        // Global message listener
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });
        
        // Sidebar controls
        this.addEventListener('click', '#astraltube-sidebar-close', () => this.hide());
        this.addEventListener('click', '#astraltube-sidebar-minimize', () => this.toggleMinimized());
        
        // Tab navigation
        this.addEventListener('click', '.tab-button', (event) => {
            const tab = event.target.closest('.tab-button').dataset.tab;
            this.switchTab(tab);
        });
        
        // Action buttons
        this.addEventListener('click', '#create-playlist-btn', () => this.createPlaylist());
        this.addEventListener('click', '#create-collection-btn', () => this.createCollection());
        this.addEventListener('click', '#manage-subscriptions-btn', () => this.manageSubscriptions());
        this.addEventListener('click', '#clear-activity-btn', () => this.clearActivity());
        this.addEventListener('click', '#sync-btn', () => this.syncData());
        this.addEventListener('click', '#settings-btn', () => this.openSettings());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey || event.metaKey) {
                switch (event.key) {
                    case 'b':
                        if (event.shiftKey) {
                            event.preventDefault();
                            this.toggle();
                        }
                        break;
                }
            }
        });
    }

    setupResizeHandle() {
        const resizeHandle = this.sidebarElement.querySelector('.astraltube-sidebar-resize-handle');
        if (!resizeHandle) return;
        
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;
        
        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = parseInt(window.getComputedStyle(this.sidebarElement).width, 10);
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            e.preventDefault();
        });
        
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            
            const deltaX = this.config.position === 'right' ? startX - e.clientX : e.clientX - startX;
            const newWidth = Math.max(250, Math.min(600, startWidth + deltaX));
            
            this.sidebarElement.style.width = newWidth + 'px';
            this.config.width = newWidth + 'px';
        };
        
        const handleMouseUp = () => {
            isResizing = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            
            // Save new width
            this.saveSettings();
        };
    }

    setupTabNavigation() {
        // Initialize first tab as active
        this.switchTab(this.currentTab);
    }

    setupPeriodicUpdates() {
        // Update data every 5 minutes
        setInterval(() => {
            if (this.isVisible && this.isInitialized) {
                this.refreshCurrentTab();
            }
        }, 5 * 60 * 1000);
    }

    // Event handling helpers
    addEventListener(event, selector, handler) {
        const elements = this.sidebarElement.querySelectorAll(selector);
        elements.forEach(element => {
            element.addEventListener(event, handler);
        });
        
        // Store for cleanup
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push({ selector, handler });
    }

    handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'toggleSidebar':
                this.toggle();
                sendResponse({ success: true });
                break;
                
            case 'showSidebar':
                this.show();
                sendResponse({ success: true });
                break;
                
            case 'hideSidebar':
                this.hide();
                sendResponse({ success: true });
                break;
                
            case 'updateSidebarData':
                this.updateData(message.data);
                sendResponse({ success: true });
                break;
                
            case 'switchSidebarTab':
                this.switchTab(message.tab);
                sendResponse({ success: true });
                break;
        }
    }

    // Public API methods
    show() {
        if (!this.sidebarElement) return;
        
        this.sidebarElement.classList.add('visible');
        this.isVisible = true;
        
        // Adjust YouTube layout
        this.adjustYouTubeLayout(true);
        
        // Save state
        this.saveSettings();
        
        // Load fresh data
        this.refreshCurrentTab();
        
        console.log('📖 Sidebar shown');
    }

    hide() {
        if (!this.sidebarElement) return;
        
        this.sidebarElement.classList.remove('visible');
        this.isVisible = false;
        
        // Restore YouTube layout
        this.adjustYouTubeLayout(false);
        
        // Save state
        this.saveSettings();
        
        console.log('📕 Sidebar hidden');
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    switchTab(tabName) {
        if (!this.sidebarElement) return;
        
        // Update tab buttons
        const tabButtons = this.sidebarElement.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tabName);
        });
        
        // Update tab content
        const tabContents = this.sidebarElement.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
            content.classList.toggle('active', content.dataset.tab === tabName);
        });
        
        this.currentTab = tabName;
        
        // Load tab data
        this.loadTabData(tabName);
        
        console.log(`📑 Switched to ${tabName} tab`);
    }

    // Data management
    async loadInitialData() {
        try {
            this.setState({ loading: true });
            
            // Load all data types
            const [playlists, collections, subscriptions, activity] = await Promise.all([
                this.loadPlaylists(),
                this.loadCollections(),
                this.loadSubscriptions(),
                this.loadActivity()
            ]);
            
            this.data = {
                playlists: playlists || [],
                collections: collections || [],
                subscriptions: subscriptions || [],
                recentActivity: activity || []
            };
            
            this.setState({ loading: false, lastUpdate: Date.now() });
            
            // Update current tab display
            this.refreshCurrentTab();
            
        } catch (error) {
            console.error('❌ Failed to load initial data:', error);
            this.setState({ loading: false, error: error.message });
        }
    }

    async loadTabData(tabName) {
        if (!this.isVisible) return;
        
        try {
            this.setState({ loading: true });
            
            let data = null;
            switch (tabName) {
                case 'playlists':
                    data = await this.loadPlaylists();
                    if (data) this.data.playlists = data;
                    break;
                case 'collections':
                    data = await this.loadCollections();
                    if (data) this.data.collections = data;
                    break;
                case 'subscriptions':
                    data = await this.loadSubscriptions();
                    if (data) this.data.subscriptions = data;
                    break;
                case 'activity':
                    data = await this.loadActivity();
                    if (data) this.data.recentActivity = data;
                    break;
            }
            
            this.setState({ loading: false });
            this.renderTabContent(tabName);
            
        } catch (error) {
            console.error(`❌ Failed to load ${tabName} data:`, error);
            this.setState({ loading: false, error: error.message });
        }
    }

    async loadPlaylists() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getPlaylists' });
            return response?.success ? response.data : [];
        } catch (error) {
            if (error.message.includes('Extension context invalidated')) {
                console.warn('⚠️ Extension reloaded, skipping playlists load');
                return [];
            }
            console.error('❌ Failed to load playlists:', error);
            return [];
        }
    }

    async loadCollections() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getCollections' });
            return response?.success ? response.data : [];
        } catch (error) {
            if (error.message.includes('Extension context invalidated')) {
                console.warn('⚠️ Extension reloaded, skipping collections load');
                return [];
            }
            console.error('❌ Failed to load collections:', error);
            return [];
        }
    }

    async loadSubscriptions() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getSubscriptions' });
            return response?.success ? response.data : [];
        } catch (error) {
            if (error.message.includes('Extension context invalidated')) {
                console.warn('⚠️ Extension reloaded, skipping subscriptions load');
                return [];
            }
            console.error('❌ Failed to load subscriptions:', error);
            return [];
        }
    }

    async loadActivity() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getActivity' });
            return response?.success ? response.data : [];
        } catch (error) {
            if (error.message.includes('Extension context invalidated')) {
                console.warn('⚠️ Extension reloaded, skipping activity load');
                return [];
            }
            console.error('❌ Failed to load activity:', error);
            return [];
        }
    }

    refreshCurrentTab() {
        this.loadTabData(this.currentTab);
    }

    // Rendering methods
    renderTabContent(tabName) {
        const contentElement = this.sidebarElement.querySelector(`[data-tab="${tabName}"] .content-list`);
        if (!contentElement) return;
        
        if (this.state.loading) {
            contentElement.innerHTML = '<div class="loading-spinner">Loading...</div>';
            return;
        }
        
        if (this.state.error) {
            contentElement.innerHTML = `<div class="error-message">${this.state.error}</div>`;
            return;
        }
        
        const data = this.data[tabName === 'activity' ? 'recentActivity' : tabName];
        
        if (!data || data.length === 0) {
            this.renderEmptyState(contentElement, tabName);
            return;
        }
        
        switch (tabName) {
            case 'playlists':
                this.renderPlaylists(contentElement, data);
                break;
            case 'collections':
                this.renderCollections(contentElement, data);
                break;
            case 'subscriptions':
                this.renderSubscriptions(contentElement, data);
                break;
            case 'activity':
                this.renderActivity(contentElement, data);
                break;
        }
    }

    renderEmptyState(container, tabName) {
        const emptyStates = {
            playlists: {
                icon: '📝',
                title: 'No Playlists Yet',
                description: 'Create your first playlist to get started'
            },
            collections: {
                icon: '📁',
                title: 'No Collections Yet',
                description: 'Organize your favorite channels into collections'
            },
            subscriptions: {
                icon: '👥',
                title: 'No Subscriptions',
                description: 'Subscribe to channels to see them here'
            },
            activity: {
                icon: '📊',
                title: 'No Recent Activity',
                description: 'Your recent actions will appear here'
            }
        };
        
        const state = emptyStates[tabName];
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${state.icon}</div>
                <div class="empty-state-title">${state.title}</div>
                <div class="empty-state-description">${state.description}</div>
            </div>
        `;
    }

    renderPlaylists(container, playlists) {
        container.innerHTML = playlists.map(playlist => `
            <div class="list-item" data-playlist-id="${playlist.id}">
                <img class="list-item-thumbnail" src="${playlist.thumbnail || ''}" alt="">
                <div class="list-item-info">
                    <div class="list-item-title">${this.escapeHtml(playlist.title)}</div>
                    <div class="list-item-subtitle">${playlist.videoCount || 0} videos</div>
                </div>
                <div class="list-item-actions">
                    <button class="list-item-action" title="Play">▶</button>
                    <button class="list-item-action" title="Edit">✎</button>
                    <button class="list-item-action" title="Delete">🗑</button>
                </div>
            </div>
        `).join('');
        
        // Add event listeners
        container.querySelectorAll('.list-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('list-item-action')) {
                    this.openPlaylist(item.dataset.playlistId);
                }
            });
        });
    }

    renderCollections(container, collections) {
        container.innerHTML = collections.map(collection => `
            <div class="list-item" data-collection-id="${collection.id}">
                <div class="list-item-thumbnail" style="background: ${collection.color || '#333'}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                    ${collection.title.charAt(0).toUpperCase()}
                </div>
                <div class="list-item-info">
                    <div class="list-item-title">${this.escapeHtml(collection.title)}</div>
                    <div class="list-item-subtitle">${collection.channelCount || 0} channels</div>
                </div>
                <div class="list-item-actions">
                    <button class="list-item-action" title="Open">📂</button>
                    <button class="list-item-action" title="Edit">✎</button>
                    <button class="list-item-action" title="Delete">🗑</button>
                </div>
            </div>
        `).join('');
        
        // Add event listeners
        container.querySelectorAll('.list-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('list-item-action')) {
                    this.openCollection(item.dataset.collectionId);
                }
            });
        });
    }

    renderSubscriptions(container, subscriptions) {
        container.innerHTML = subscriptions.map(sub => `
            <div class="list-item" data-channel-id="${sub.channelId}">
                <img class="list-item-thumbnail" src="${sub.thumbnail || ''}" alt="">
                <div class="list-item-info">
                    <div class="list-item-title">${this.escapeHtml(sub.title)}</div>
                    <div class="list-item-subtitle">${sub.videoCount || 0} videos</div>
                </div>
                <div class="list-item-actions">
                    <button class="list-item-action" title="Visit Channel">🏠</button>
                    <button class="list-item-action" title="Add to Collection">📁</button>
                    <button class="list-item-action" title="Unsubscribe">❌</button>
                </div>
            </div>
        `).join('');
        
        // Add event listeners
        container.querySelectorAll('.list-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('list-item-action')) {
                    this.openChannel(item.dataset.channelId);
                }
            });
        });
    }

    renderActivity(container, activities) {
        container.innerHTML = activities.map(activity => `
            <div class="list-item" data-activity-id="${activity.id}">
                <div class="list-item-thumbnail" style="background: #444; display: flex; align-items: center; justify-content: center; font-size: 16px;">
                    ${this.getActivityIcon(activity.type)}
                </div>
                <div class="list-item-info">
                    <div class="list-item-title">${this.escapeHtml(activity.description)}</div>
                    <div class="list-item-subtitle">${this.formatRelativeTime(activity.timestamp)}</div>
                </div>
            </div>
        `).join('');
    }

    // Action handlers
    async createPlaylist() {
        try {
            const title = prompt('Enter playlist name:');
            if (!title) return;
            
            const response = await chrome.runtime.sendMessage({
                action: 'createPlaylist',
                data: { title, description: '' }
            });
            
            if (response?.success) {
                this.refreshCurrentTab();
                console.log('✅ Playlist created');
            } else {
                this.handleError('Failed to create playlist', new Error(response?.error));
            }
        } catch (error) {
            this.handleError('Failed to create playlist', error);
        }
    }

    async createCollection() {
        try {
            const title = prompt('Enter collection name:');
            if (!title) return;
            
            const response = await chrome.runtime.sendMessage({
                action: 'createCollection',
                data: { title, description: '', channels: [] }
            });
            
            if (response?.success) {
                this.refreshCurrentTab();
                console.log('✅ Collection created');
            } else {
                this.handleError('Failed to create collection', new Error(response?.error));
            }
        } catch (error) {
            this.handleError('Failed to create collection', error);
        }
    }

    manageSubscriptions() {
        // Open subscription manager
        chrome.runtime.sendMessage({ action: 'openSubscriptionManager' });
    }

    async clearActivity() {
        if (confirm('Clear all recent activity?')) {
            try {
                const response = await chrome.runtime.sendMessage({ action: 'clearActivity' });
                if (response?.success) {
                    this.data.recentActivity = [];
                    this.renderTabContent('activity');
                    console.log('✅ Activity cleared');
                }
            } catch (error) {
                this.handleError('Failed to clear activity', error);
            }
        }
    }

    async syncData() {
        try {
            this.setState({ syncStatus: 'syncing' });
            this.updateSyncStatus('Syncing...');
            
            const response = await chrome.runtime.sendMessage({ action: 'syncData' });
            
            if (response?.success) {
                this.setState({ syncStatus: 'success', lastUpdate: Date.now() });
                this.updateSyncStatus('Sync completed');
                this.refreshCurrentTab();
                
                setTimeout(() => {
                    this.updateSyncStatus();
                }, 3000);
            } else {
                this.setState({ syncStatus: 'error' });
                this.updateSyncStatus('Sync failed');
            }
        } catch (error) {
            this.setState({ syncStatus: 'error' });
            this.updateSyncStatus('Sync failed');
            this.handleError('Sync failed', error);
        }
    }

    openSettings() {
        chrome.runtime.sendMessage({ action: 'openOptions' });
    }

    // Helper methods
    setState(newState) {
        this.state = { ...this.state, ...newState };
    }

    updateSyncStatus(message = null) {
        const statusElement = this.sidebarElement?.querySelector('#sync-status');
        if (!statusElement) return;
        
        if (message) {
            statusElement.textContent = message;
        } else if (this.state.lastUpdate) {
            statusElement.textContent = `Last sync: ${this.formatRelativeTime(this.state.lastUpdate)}`;
        } else {
            statusElement.textContent = 'Last sync: Never';
        }
    }

    adjustYouTubeLayout(sidebarVisible) {
        // Adjust YouTube's layout to accommodate sidebar
        const ytdApp = document.querySelector('ytd-app');
        if (ytdApp) {
            if (sidebarVisible) {
                ytdApp.style.marginRight = this.config.position === 'right' ? this.config.width : '0';
                ytdApp.style.marginLeft = this.config.position === 'left' ? this.config.width : '0';
            } else {
                ytdApp.style.marginRight = '0';
                ytdApp.style.marginLeft = '0';
            }
        }
    }

    async saveSettings() {
        try {
            await chrome.runtime.sendMessage({
                action: 'updateSettings',
                settings: {
                    sidebarVisible: this.isVisible,
                    sidebarWidth: this.config.width,
                    sidebarPosition: this.config.position
                }
            });
        } catch (error) {
            console.error('❌ Failed to save settings:', error);
        }
    }

    handleError(message, error) {
        console.error(`❌ ${message}:`, error);
        this.setState({ error: message });
        
        // Show temporary error notification
        if (this.sidebarElement) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = message;
            errorDiv.style.position = 'absolute';
            errorDiv.style.top = '10px';
            errorDiv.style.left = '10px';
            errorDiv.style.right = '10px';
            errorDiv.style.zIndex = '10001';
            
            this.sidebarElement.appendChild(errorDiv);
            
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.parentNode.removeChild(errorDiv);
                }
            }, 5000);
        }
    }

    removeSidebar() {
        if (this.sidebarElement && this.sidebarElement.parentNode) {
            this.sidebarElement.parentNode.removeChild(this.sidebarElement);
        }
        
        // Remove styles
        const styleElement = document.getElementById('astraltube-sidebar-styles');
        if (styleElement) {
            styleElement.parentNode.removeChild(styleElement);
        }
        
        // Restore YouTube layout
        this.adjustYouTubeLayout(false);
    }

    // Utility methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) return 'just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    }

    getActivityIcon(type) {
        const icons = {
            playlist_created: '📝',
            playlist_updated: '✏️',
            video_added: '➕',
            video_removed: '➖',
            collection_created: '📁',
            subscription_added: '👥',
            sync_completed: '🔄'
        };
        return icons[type] || '📊';
    }

    openPlaylist(playlistId) {
        window.location.href = `https://www.youtube.com/playlist?list=${playlistId}`;
    }

    openCollection(collectionId) {
        // Open collection view (implement based on your needs)
        console.log('Opening collection:', collectionId);
    }

    openChannel(channelId) {
        window.location.href = `https://www.youtube.com/channel/${channelId}`;
    }

    // Cleanup
    destroy() {
        console.log('🧹 Cleaning up sidebar...');
        
        // Remove event listeners
        this.eventHandlers.clear();
        
        // Remove DOM elements
        this.removeSidebar();
        
        this.isInitialized = false;
    }
    
    processTemplate(template) {
        // Replace chrome extension URL placeholders
        return template.replace(/\$\{chrome\.runtime\.getURL\('([^']+)'\)\}/g, (match, path) => {
            return chrome.runtime.getURL(path);
        });
    }
}

// Auto-initialize if on YouTube
if (window.location.hostname.includes('youtube.com')) {
    const sidebar = new AstralTubeSidebar();
    
    // Make globally available
    window.astralTubeSidebar = sidebar;
}