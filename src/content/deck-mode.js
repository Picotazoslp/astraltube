/**
 * AstralTube v3 - Deck Mode Manager
 * TweetDeck-style multi-column interface for YouTube
 */

export class AstralTubeDeckMode {
    constructor() {
        this.isEnabled = false;
        this.isInitialized = false;
        this.deckContainer = null;
        this.columns = new Map();
        this.originalLayout = null;
        
        // Configuration
        this.config = {
            columnWidth: '350px',
            minColumnWidth: '280px',
            maxColumnWidth: '500px',
            maxColumns: 5,
            defaultColumns: ['subscriptions', 'trending', 'playlists'],
            animationDuration: '300ms',
            autoRefreshInterval: 5 * 60 * 1000, // 5 minutes
            persistLayout: true
        };
        
        // State management
        this.state = {
            loading: false,
            error: null,
            refreshing: false,
            lastRefresh: null,
            activeColumn: null
        };
        
        // Column types and their configurations
        this.columnTypes = {
            subscriptions: {
                title: 'Subscriptions',
                icon: '👥',
                refreshable: true,
                sortable: true,
                filterable: true,
                endpoint: 'getSubscriptions'
            },
            trending: {
                title: 'Trending',
                icon: '🔥',
                refreshable: true,
                sortable: false,
                filterable: true,
                endpoint: 'getTrending'
            },
            playlists: {
                title: 'My Playlists',
                icon: '📝',
                refreshable: true,
                sortable: true,
                filterable: true,
                endpoint: 'getPlaylists'
            },
            watchLater: {
                title: 'Watch Later',
                icon: '🕒',
                refreshable: true,
                sortable: false,
                filterable: false,
                endpoint: 'getWatchLater'
            },
            history: {
                title: 'History',
                icon: '📺',
                refreshable: true,
                sortable: false,
                filterable: true,
                endpoint: 'getHistory'
            },
            collections: {
                title: 'Collections',
                icon: '📁',
                refreshable: true,
                sortable: true,
                filterable: true,
                endpoint: 'getCollections'
            },
            search: {
                title: 'Search',
                icon: '🔍',
                refreshable: false,
                sortable: false,
                filterable: true,
                endpoint: null,
                customizable: true
            }
        };
        
        // Event handlers
        this.eventHandlers = new Map();
        this.refreshIntervals = new Map();
        
        this.init();
    }

    async init() {
        try {
            console.log('🎨 Initializing AstralTube Deck Mode...');
            
            // Load settings and configuration
            await this.loadSettings();
            
            // Setup event listeners
            this.setupGlobalEventListeners();
            
            this.isInitialized = true;
            console.log('✅ AstralTube Deck Mode initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize deck mode:', error);
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
                    columnWidth: settings.deckColumnWidth || this.config.columnWidth,
                    maxColumns: settings.deckMaxColumns || this.config.maxColumns,
                    defaultColumns: settings.deckColumns || this.config.defaultColumns,
                    autoRefreshInterval: (settings.deckRefreshInterval || 5) * 60 * 1000
                };
                
                this.isEnabled = settings.deckModeEnabled || false;
            }
        } catch (error) {
            console.error('❌ Failed to load deck mode settings:', error);
        }
    }

    async enable() {
        if (this.isEnabled) return;
        
        try {
            console.log('🚀 Enabling Deck Mode...');
            this.setState({ loading: true });
            
            // Store original YouTube layout
            await this.storeOriginalLayout();
            
            // Create deck interface
            await this.createDeckInterface();
            
            // Load default columns
            await this.loadDefaultColumns();
            
            // Apply deck mode styles
            this.applyDeckStyles();
            
            // Start auto-refresh timers
            this.startAutoRefresh();
            
            this.isEnabled = true;
            this.setState({ loading: false });
            
            // Save state
            await this.saveSettings();
            
            console.log('✅ Deck Mode enabled');
            
        } catch (error) {
            console.error('❌ Failed to enable deck mode:', error);
            this.handleError('Failed to enable deck mode', error);
            this.setState({ loading: false });
        }
    }

    async disable() {
        if (!this.isEnabled) return;
        
        try {
            console.log('⏸️ Disabling Deck Mode...');
            
            // Stop auto-refresh timers
            this.stopAutoRefresh();
            
            // Remove deck interface
            this.removeDeckInterface();
            
            // Restore original YouTube layout
            await this.restoreOriginalLayout();
            
            this.isEnabled = false;
            
            // Save state
            await this.saveSettings();
            
            console.log('✅ Deck Mode disabled');
            
        } catch (error) {
            console.error('❌ Failed to disable deck mode:', error);
            this.handleError('Failed to disable deck mode', error);
        }
    }

    toggle() {
        if (this.isEnabled) {
            this.disable();
        } else {
            this.enable();
        }
    }

    async storeOriginalLayout() {
        try {
            const ytdApp = document.querySelector('ytd-app');
            const masthead = document.querySelector('#masthead');
            const content = document.querySelector('#content');
            
            if (ytdApp && masthead && content) {
                this.originalLayout = {
                    appStyles: ytdApp.style.cssText,
                    mastheadStyles: masthead.style.cssText,
                    contentStyles: content.style.cssText,
                    bodyClasses: [...document.body.classList]
                };
            }
        } catch (error) {
            console.error('❌ Failed to store original layout:', error);
        }
    }

    async restoreOriginalLayout() {
        try {
            if (!this.originalLayout) return;
            
            const ytdApp = document.querySelector('ytd-app');
            const masthead = document.querySelector('#masthead');
            const content = document.querySelector('#content');
            
            if (ytdApp) ytdApp.style.cssText = this.originalLayout.appStyles;
            if (masthead) masthead.style.cssText = this.originalLayout.mastheadStyles;
            if (content) content.style.cssText = this.originalLayout.contentStyles;
            
            // Restore body classes
            document.body.className = this.originalLayout.bodyClasses.join(' ');
            
        } catch (error) {
            console.error('❌ Failed to restore original layout:', error);
        }
    }

    async createDeckInterface() {
        // Remove existing deck if present
        this.removeDeckInterface();
        
        // Create main deck container
        this.deckContainer = document.createElement('div');
        this.deckContainer.id = 'astraltube-deck-mode';
        this.deckContainer.className = 'astraltube-deck-container';
        
        // Load deck HTML template
        const templateUrl = chrome.runtime.getURL('src/content/deck-mode.html');
        try {
            const response = await fetch(templateUrl);
            const template = await response.text();
            this.deckContainer.innerHTML = template;
        } catch (error) {
            console.error('❌ Failed to load deck template:', error);
            // Fallback to creating basic structure
            this.createFallbackDeck();
        }
        
        // Insert into page
        const ytdApp = document.querySelector('ytd-app');
        if (ytdApp) {
            // Hide original YouTube content
            this.hideOriginalContent();
            
            // Insert deck after masthead
            const masthead = document.querySelector('#masthead');
            if (masthead) {
                masthead.after(this.deckContainer);
            } else {
                ytdApp.appendChild(this.deckContainer);
            }
        }
        
        // Setup deck event listeners
        this.setupDeckEventListeners();
    }

    createFallbackDeck() {
        this.deckContainer.innerHTML = `
            <div class="deck-header">
                <div class="deck-title">
                    <h1>AstralTube Deck Mode</h1>
                    <div class="deck-controls">
                        <button id="add-column-btn" class="deck-btn" title="Add Column">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 1v6h6v2H8v6H6V9H0V7h6V1h2z"/>
                            </svg>
                        </button>
                        <button id="deck-settings-btn" class="deck-btn" title="Settings">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M7 4.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM5.5 7a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z"/>
                            </svg>
                        </button>
                        <button id="exit-deck-btn" class="deck-btn" title="Exit Deck Mode">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M4 6l8-8h-2L6 2 2 6l4 4L2 6z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="deck-stats" id="deck-stats">
                    <span class="stat-item">0 columns</span>
                    <span class="stat-item">Last updated: Never</span>
                </div>
            </div>
            <div class="deck-columns-container" id="deck-columns">
                <!-- Columns will be dynamically added here -->
            </div>
            <div class="deck-footer">
                <div class="deck-actions">
                    <button id="refresh-all-btn" class="footer-btn">
                        <svg width="14" height="14" fill="currentColor">
                            <path d="M13 7a6 6 0 01-6 6v-2a4 4 0 004-4h2zM1 7a6 6 0 016-6v2a4 4 0 00-4 4H1z"/>
                        </svg>
                        Refresh All
                    </button>
                    <button id="layout-settings-btn" class="footer-btn">
                        <svg width="14" height="14" fill="currentColor">
                            <path d="M2 2h12v2H2V2zm0 4h12v2H2V6zm0 4h12v2H2v-2z"/>
                        </svg>
                        Layout
                    </button>
                </div>
                <div class="deck-status" id="deck-status">Ready</div>
            </div>
        `;
    }

    hideOriginalContent() {
        const content = document.querySelector('#content');
        const sidebar = document.querySelector('#guide');
        
        if (content) {
            content.style.display = 'none';
        }
        if (sidebar) {
            sidebar.style.display = 'none';
        }
        
        // Add deck mode class to body
        document.body.classList.add('astraltube-deck-mode');
    }

    showOriginalContent() {
        const content = document.querySelector('#content');
        const sidebar = document.querySelector('#guide');
        
        if (content) {
            content.style.display = '';
        }
        if (sidebar) {
            sidebar.style.display = '';
        }
        
        // Remove deck mode class from body
        document.body.classList.remove('astraltube-deck-mode');
    }

    applyDeckStyles() {
        // Check if styles are already applied
        if (document.getElementById('astraltube-deck-styles')) {
            return;
        }
        
        const styleElement = document.createElement('style');
        styleElement.id = 'astraltube-deck-styles';
        styleElement.textContent = `
            body.astraltube-deck-mode {
                overflow: hidden;
            }
            
            .astraltube-deck-container {
                position: fixed;
                top: 56px; /* YouTube masthead height */
                left: 0;
                right: 0;
                bottom: 0;
                background: #0f0f0f;
                color: #fff;
                display: flex;
                flex-direction: column;
                z-index: 9999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .deck-header {
                background: #1a1a1a;
                border-bottom: 1px solid #333;
                padding: 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
            }
            
            .deck-title {
                display: flex;
                align-items: center;
                gap: 16px;
            }
            
            .deck-title h1 {
                margin: 0;
                font-size: 20px;
                font-weight: 600;
                color: #fff;
            }
            
            .deck-controls {
                display: flex;
                gap: 8px;
            }
            
            .deck-btn, .footer-btn {
                background: #333;
                border: 1px solid #555;
                color: #fff;
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 14px;
                transition: all 0.2s;
            }
            
            .deck-btn:hover, .footer-btn:hover {
                background: #444;
                border-color: #666;
            }
            
            .deck-stats {
                display: flex;
                gap: 20px;
                font-size: 12px;
                color: #aaa;
            }
            
            .deck-columns-container {
                flex: 1;
                display: flex;
                overflow-x: auto;
                overflow-y: hidden;
                gap: 12px;
                padding: 12px;
                background: #0f0f0f;
            }
            
            .deck-column {
                flex: 0 0 ${this.config.columnWidth};
                background: #1a1a1a;
                border: 1px solid #333;
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                min-height: 0;
                max-height: 100%;
            }
            
            .column-header {
                background: #2a2a2a;
                padding: 12px 16px;
                border-bottom: 1px solid #333;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
                border-radius: 8px 8px 0 0;
            }
            
            .column-title {
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: 600;
                font-size: 14px;
            }
            
            .column-icon {
                font-size: 16px;
            }
            
            .column-controls {
                display: flex;
                gap: 4px;
                opacity: 0;
                transition: opacity 0.2s;
            }
            
            .deck-column:hover .column-controls {
                opacity: 1;
            }
            
            .column-btn {
                background: none;
                border: none;
                color: #ccc;
                padding: 4px;
                cursor: pointer;
                border-radius: 4px;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .column-btn:hover {
                background: #333;
                color: #fff;
            }
            
            .column-content {
                flex: 1;
                overflow-y: auto;
                padding: 8px;
                min-height: 0;
            }
            
            .column-loading {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 40px 20px;
                color: #888;
            }
            
            .column-loading .spinner {
                width: 24px;
                height: 24px;
                border: 2px solid #333;
                border-top: 2px solid #666;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 12px;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .column-item {
                background: #222;
                border: 1px solid #333;
                border-radius: 6px;
                padding: 8px;
                margin-bottom: 8px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .column-item:hover {
                background: #333;
                border-color: #444;
            }
            
            .item-thumbnail {
                width: 100%;
                height: 120px;
                background: #333;
                border-radius: 4px;
                margin-bottom: 8px;
                object-fit: cover;
                display: block;
            }
            
            .item-title {
                font-size: 13px;
                font-weight: 500;
                line-height: 1.3;
                margin-bottom: 4px;
                overflow: hidden;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
            }
            
            .item-meta {
                font-size: 11px;
                color: #aaa;
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 4px;
            }
            
            .item-channel {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .item-duration {
                background: rgba(0,0,0,0.8);
                padding: 2px 4px;
                border-radius: 2px;
                font-size: 10px;
            }
            
            .item-description {
                font-size: 11px;
                color: #888;
                line-height: 1.3;
                overflow: hidden;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
            }
            
            .deck-footer {
                background: #1a1a1a;
                border-top: 1px solid #333;
                padding: 12px 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
            }
            
            .deck-actions {
                display: flex;
                gap: 8px;
            }
            
            .deck-status {
                font-size: 12px;
                color: #aaa;
            }
            
            .column-empty {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 40px 20px;
                color: #888;
                text-align: center;
            }
            
            .column-empty-icon {
                font-size: 48px;
                margin-bottom: 12px;
                opacity: 0.5;
            }
            
            .column-empty-title {
                font-size: 14px;
                margin-bottom: 4px;
            }
            
            .column-empty-description {
                font-size: 12px;
                line-height: 1.4;
            }
            
            .column-error {
                background: #3a1a1a;
                border: 1px solid #aa4444;
                color: #ffaaaa;
                padding: 12px;
                margin: 8px;
                border-radius: 4px;
                text-align: center;
            }
            
            /* Scrollbar styling */
            .deck-columns-container::-webkit-scrollbar,
            .column-content::-webkit-scrollbar {
                width: 8px;
                height: 8px;
            }
            
            .deck-columns-container::-webkit-scrollbar-track,
            .column-content::-webkit-scrollbar-track {
                background: #0f0f0f;
            }
            
            .deck-columns-container::-webkit-scrollbar-thumb,
            .column-content::-webkit-scrollbar-thumb {
                background: #333;
                border-radius: 4px;
            }
            
            .deck-columns-container::-webkit-scrollbar-thumb:hover,
            .column-content::-webkit-scrollbar-thumb:hover {
                background: #444;
            }
            
            /* Column resizing */
            .column-resize-handle {
                position: absolute;
                right: 0;
                top: 0;
                width: 4px;
                height: 100%;
                cursor: col-resize;
                background: transparent;
                transition: background 0.2s;
            }
            
            .column-resize-handle:hover {
                background: #666;
            }
            
            /* Drag and drop styles */
            .column-dragging {
                opacity: 0.5;
                transform: rotate(2deg);
            }
            
            .column-drop-zone {
                background: rgba(255, 68, 68, 0.1);
                border: 2px dashed #ff4444;
            }
        `;
        
        document.head.appendChild(styleElement);
    }

    setupGlobalEventListeners() {
        // Global message listener
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });
    }

    setupDeckEventListeners() {
        if (!this.deckContainer) return;
        
        // Header controls
        this.addEventListener('click', '#add-column-btn', () => this.showAddColumnDialog());
        this.addEventListener('click', '#deck-settings-btn', () => this.showDeckSettings());
        this.addEventListener('click', '#exit-deck-btn', () => this.disable());
        
        // Footer controls
        this.addEventListener('click', '#refresh-all-btn', () => this.refreshAllColumns());
        this.addEventListener('click', '#layout-settings-btn', () => this.showLayoutSettings());
    }

    async loadDefaultColumns() {
        try {
            const columnsContainer = this.deckContainer.querySelector('#deck-columns');
            if (!columnsContainer) return;
            
            // Clear existing columns
            this.columns.clear();
            columnsContainer.innerHTML = '';
            
            // Load default columns
            for (const columnType of this.config.defaultColumns) {
                await this.addColumn(columnType);
            }
            
            // Update stats
            this.updateDeckStats();
            
        } catch (error) {
            console.error('❌ Failed to load default columns:', error);
        }
    }

    async addColumn(type, config = {}) {
        try {
            const columnConfig = this.columnTypes[type];
            if (!columnConfig) {
                throw new Error(`Unknown column type: ${type}`);
            }
            
            const columnId = `column_${type}_${Date.now()}`;
            const column = {
                id: columnId,
                type: type,
                title: config.title || columnConfig.title,
                icon: config.icon || columnConfig.icon,
                data: [],
                loading: false,
                error: null,
                lastRefresh: null,
                ...columnConfig,
                ...config
            };
            
            // Create column DOM element
            const columnElement = this.createColumnElement(column);
            
            // Add to container
            const columnsContainer = this.deckContainer.querySelector('#deck-columns');
            if (columnsContainer) {
                columnsContainer.appendChild(columnElement);
            }
            
            // Store column reference
            this.columns.set(columnId, column);
            
            // Load column data
            await this.loadColumnData(columnId);
            
            // Setup auto-refresh if enabled
            if (column.refreshable && this.config.autoRefreshInterval > 0) {
                const interval = setInterval(() => {
                    this.refreshColumn(columnId);
                }, this.config.autoRefreshInterval);
                
                this.refreshIntervals.set(columnId, interval);
            }
            
            console.log(`✅ Added ${type} column`);
            this.updateDeckStats();
            
            return columnId;
            
        } catch (error) {
            console.error(`❌ Failed to add ${type} column:`, error);
            throw error;
        }
    }

    createColumnElement(column) {
        const columnEl = document.createElement('div');
        columnEl.className = 'deck-column';
        columnEl.dataset.columnId = column.id;
        columnEl.dataset.columnType = column.type;
        
        columnEl.innerHTML = `
            <div class="column-header">
                <div class="column-title">
                    <span class="column-icon">${column.icon}</span>
                    <span>${column.title}</span>
                </div>
                <div class="column-controls">
                    ${column.refreshable ? `
                        <button class="column-btn" data-action="refresh" title="Refresh">
                            <svg width="12" height="12" fill="currentColor">
                                <path d="M13 7a6 6 0 01-6 6v-2a4 4 0 004-4h2zM1 7a6 6 0 016-6v2a4 4 0 00-4 4H1z"/>
                            </svg>
                        </button>
                    ` : ''}
                    <button class="column-btn" data-action="settings" title="Column Settings">
                        <svg width="12" height="12" fill="currentColor">
                            <path d="M7 4.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"/>
                        </svg>
                    </button>
                    <button class="column-btn" data-action="close" title="Remove Column">
                        <svg width="12" height="12" fill="currentColor">
                            <path d="M4 6l8-8h-2L6 2 2 6l4 4L2 6z"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="column-content" id="content-${column.id}">
                <div class="column-loading">
                    <div class="spinner"></div>
                    <span>Loading...</span>
                </div>
            </div>
        `;
        
        // Add event listeners
        const refreshBtn = columnEl.querySelector('[data-action="refresh"]');
        const settingsBtn = columnEl.querySelector('[data-action="settings"]');
        const closeBtn = columnEl.querySelector('[data-action="close"]');
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshColumn(column.id));
        }
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showColumnSettings(column.id));
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.removeColumn(column.id));
        }
        
        return columnEl;
    }

    async loadColumnData(columnId) {
        try {
            const column = this.columns.get(columnId);
            if (!column || !column.endpoint) return;
            
            column.loading = true;
            this.renderColumnContent(columnId);
            
            // Fetch data from background script
            const response = await chrome.runtime.sendMessage({
                action: column.endpoint,
                columnType: column.type,
                columnId: columnId
            });
            
            if (response?.success) {
                column.data = response.data || [];
                column.error = null;
            } else {
                column.error = response?.error || 'Failed to load data';
                column.data = [];
            }
            
            column.loading = false;
            column.lastRefresh = Date.now();
            
            this.renderColumnContent(columnId);
            
        } catch (error) {
            console.error(`❌ Failed to load data for column ${columnId}:`, error);
            
            const column = this.columns.get(columnId);
            if (column) {
                column.loading = false;
                column.error = error.message;
                column.data = [];
                this.renderColumnContent(columnId);
            }
        }
    }

    renderColumnContent(columnId) {
        const column = this.columns.get(columnId);
        if (!column) return;
        
        const contentEl = this.deckContainer.querySelector(`#content-${columnId}`);
        if (!contentEl) return;
        
        if (column.loading) {
            contentEl.innerHTML = `
                <div class="column-loading">
                    <div class="spinner"></div>
                    <span>Loading ${column.title}...</span>
                </div>
            `;
            return;
        }
        
        if (column.error) {
            contentEl.innerHTML = `
                <div class="column-error">
                    <strong>Error:</strong> ${column.error}
                    <br><br>
                    <button class="deck-btn" onclick="window.astralTubeDeckMode.refreshColumn('${columnId}')">
                        Try Again
                    </button>
                </div>
            `;
            return;
        }
        
        if (!column.data || column.data.length === 0) {
            this.renderEmptyColumn(contentEl, column);
            return;
        }
        
        // Render data based on column type
        switch (column.type) {
            case 'subscriptions':
                this.renderSubscriptionsColumn(contentEl, column.data);
                break;
            case 'trending':
                this.renderTrendingColumn(contentEl, column.data);
                break;
            case 'playlists':
                this.renderPlaylistsColumn(contentEl, column.data);
                break;
            case 'watchLater':
                this.renderWatchLaterColumn(contentEl, column.data);
                break;
            case 'history':
                this.renderHistoryColumn(contentEl, column.data);
                break;
            case 'collections':
                this.renderCollectionsColumn(contentEl, column.data);
                break;
            default:
                this.renderGenericColumn(contentEl, column.data);
        }
    }

    renderEmptyColumn(contentEl, column) {
        const emptyStates = {
            subscriptions: { icon: '👥', title: 'No Subscriptions', description: 'Subscribe to channels to see content here' },
            trending: { icon: '🔥', title: 'No Trending Videos', description: 'Unable to load trending content' },
            playlists: { icon: '📝', title: 'No Playlists', description: 'Create playlists to see them here' },
            watchLater: { icon: '🕒', title: 'Watch Later Empty', description: 'Add videos to watch later' },
            history: { icon: '📺', title: 'No History', description: 'Watch videos to see history here' },
            collections: { icon: '📁', title: 'No Collections', description: 'Create collections to organize channels' }
        };
        
        const state = emptyStates[column.type] || { icon: '📄', title: 'No Content', description: 'No data available' };
        
        contentEl.innerHTML = `
            <div class="column-empty">
                <div class="column-empty-icon">${state.icon}</div>
                <div class="column-empty-title">${state.title}</div>
                <div class="column-empty-description">${state.description}</div>
            </div>
        `;
    }

    renderSubscriptionsColumn(contentEl, data) {
        contentEl.innerHTML = data.map(video => `
            <div class="column-item" data-video-id="${video.videoId}" onclick="window.open('https://www.youtube.com/watch?v=${video.videoId}', '_blank')">
                <img class="item-thumbnail" src="${video.thumbnail}" alt="${video.title}" loading="lazy">
                <div class="item-title">${this.escapeHtml(video.title)}</div>
                <div class="item-meta">
                    <span class="item-channel">${this.escapeHtml(video.channelTitle)}</span>
                    <span class="item-duration">${video.duration || ''}</span>
                </div>
                <div class="item-description">${this.escapeHtml(video.description || '')}</div>
            </div>
        `).join('');
    }

    renderTrendingColumn(contentEl, data) {
        contentEl.innerHTML = data.map(video => `
            <div class="column-item" data-video-id="${video.videoId}" onclick="window.open('https://www.youtube.com/watch?v=${video.videoId}', '_blank')">
                <img class="item-thumbnail" src="${video.thumbnail}" alt="${video.title}" loading="lazy">
                <div class="item-title">${this.escapeHtml(video.title)}</div>
                <div class="item-meta">
                    <span class="item-channel">${this.escapeHtml(video.channelTitle)}</span>
                    <span class="item-views">${video.viewCount || ''} views</span>
                </div>
                <div class="item-description">${this.escapeHtml(video.description || '')}</div>
            </div>
        `).join('');
    }

    renderPlaylistsColumn(contentEl, data) {
        contentEl.innerHTML = data.map(playlist => `
            <div class="column-item" data-playlist-id="${playlist.id}" onclick="window.open('https://www.youtube.com/playlist?list=${playlist.id}', '_blank')">
                <img class="item-thumbnail" src="${playlist.thumbnail}" alt="${playlist.title}" loading="lazy">
                <div class="item-title">${this.escapeHtml(playlist.title)}</div>
                <div class="item-meta">
                    <span class="item-count">${playlist.videoCount || 0} videos</span>
                    <span class="item-privacy">${playlist.privacy || 'Private'}</span>
                </div>
                <div class="item-description">${this.escapeHtml(playlist.description || '')}</div>
            </div>
        `).join('');
    }

    renderWatchLaterColumn(contentEl, data) {
        this.renderSubscriptionsColumn(contentEl, data); // Same format as subscriptions
    }

    renderHistoryColumn(contentEl, data) {
        this.renderSubscriptionsColumn(contentEl, data); // Same format as subscriptions
    }

    renderCollectionsColumn(contentEl, data) {
        contentEl.innerHTML = data.map(collection => `
            <div class="column-item" data-collection-id="${collection.id}">
                <div class="item-thumbnail" style="background: ${collection.color || '#333'}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 24px;">
                    ${collection.title.charAt(0).toUpperCase()}
                </div>
                <div class="item-title">${this.escapeHtml(collection.title)}</div>
                <div class="item-meta">
                    <span class="item-count">${collection.channelCount || 0} channels</span>
                    <span class="item-updated">${this.formatDate(collection.updatedAt)}</span>
                </div>
                <div class="item-description">${this.escapeHtml(collection.description || '')}</div>
            </div>
        `).join('');
    }

    renderGenericColumn(contentEl, data) {
        contentEl.innerHTML = data.map(item => `
            <div class="column-item">
                <div class="item-title">${this.escapeHtml(item.title || item.name || 'Untitled')}</div>
                <div class="item-description">${this.escapeHtml(item.description || '')}</div>
            </div>
        `).join('');
    }

    async refreshColumn(columnId) {
        try {
            const column = this.columns.get(columnId);
            if (!column) return;
            
            console.log(`🔄 Refreshing ${column.title} column...`);
            await this.loadColumnData(columnId);
            
        } catch (error) {
            console.error(`❌ Failed to refresh column ${columnId}:`, error);
        }
    }

    async refreshAllColumns() {
        try {
            console.log('🔄 Refreshing all columns...');
            this.setState({ refreshing: true });
            
            const refreshPromises = Array.from(this.columns.keys()).map(columnId => 
                this.refreshColumn(columnId)
            );
            
            await Promise.allSettled(refreshPromises);
            
            this.setState({ refreshing: false, lastRefresh: Date.now() });
            this.updateDeckStats();
            
            console.log('✅ All columns refreshed');
            
        } catch (error) {
            console.error('❌ Failed to refresh all columns:', error);
            this.setState({ refreshing: false });
        }
    }

    async removeColumn(columnId) {
        try {
            const column = this.columns.get(columnId);
            if (!column) return;
            
            // Stop auto-refresh
            const interval = this.refreshIntervals.get(columnId);
            if (interval) {
                clearInterval(interval);
                this.refreshIntervals.delete(columnId);
            }
            
            // Remove DOM element
            const columnEl = this.deckContainer.querySelector(`[data-column-id="${columnId}"]`);
            if (columnEl) {
                columnEl.remove();
            }
            
            // Remove from state
            this.columns.delete(columnId);
            
            this.updateDeckStats();
            console.log(`✅ Removed ${column.title} column`);
            
        } catch (error) {
            console.error(`❌ Failed to remove column ${columnId}:`, error);
        }
    }

    startAutoRefresh() {
        // Auto-refresh is handled per-column in addColumn method
    }

    stopAutoRefresh() {
        // Clear all refresh intervals
        for (const interval of this.refreshIntervals.values()) {
            clearInterval(interval);
        }
        this.refreshIntervals.clear();
    }

    updateDeckStats() {
        const statsEl = this.deckContainer?.querySelector('#deck-stats');
        if (!statsEl) return;
        
        const columnCount = this.columns.size;
        const lastRefresh = this.state.lastRefresh ? 
            this.formatRelativeTime(this.state.lastRefresh) : 'Never';
        
        statsEl.innerHTML = `
            <span class="stat-item">${columnCount} columns</span>
            <span class="stat-item">Last updated: ${lastRefresh}</span>
        `;
    }

    // Event handlers
    showAddColumnDialog() {
        // Create and show column selection dialog
        const dialog = document.createElement('div');
        dialog.className = 'deck-dialog';
        dialog.innerHTML = `
            <div class="dialog-overlay" onclick="this.parentElement.remove()"></div>
            <div class="dialog-content">
                <h3>Add Column</h3>
                <div class="column-types">
                    ${Object.entries(this.columnTypes).map(([type, config]) => `
                        <button class="column-type-btn" data-type="${type}">
                            <span class="type-icon">${config.icon}</span>
                            <span class="type-title">${config.title}</span>
                        </button>
                    `).join('')}
                </div>
                <div class="dialog-actions">
                    <button onclick="this.closest('.deck-dialog').remove()">Cancel</button>
                </div>
            </div>
        `;
        
        // Add dialog styles if not present
        this.addDialogStyles();
        
        // Add event listeners
        dialog.addEventListener('click', (e) => {
            const typeBtn = e.target.closest('.column-type-btn');
            if (typeBtn) {
                const type = typeBtn.dataset.type;
                this.addColumn(type);
                dialog.remove();
            }
        });
        
        document.body.appendChild(dialog);
    }

    showColumnSettings(columnId) {
        const column = this.columns.get(columnId);
        if (!column) return;
        
        // Implement column-specific settings dialog
        console.log('Column settings for:', column.title);
    }

    showDeckSettings() {
        // Implement deck-wide settings dialog
        console.log('Showing deck settings');
    }

    showLayoutSettings() {
        // Implement layout configuration dialog
        console.log('Showing layout settings');
    }

    addDialogStyles() {
        if (document.getElementById('astraltube-dialog-styles')) return;
        
        const styleEl = document.createElement('style');
        styleEl.id = 'astraltube-dialog-styles';
        styleEl.textContent = `
            .deck-dialog {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .dialog-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.8);
            }
            
            .dialog-content {
                background: #1a1a1a;
                border: 1px solid #333;
                border-radius: 8px;
                padding: 24px;
                max-width: 500px;
                width: 90%;
                max-height: 80%;
                overflow-y: auto;
                position: relative;
                color: #fff;
            }
            
            .dialog-content h3 {
                margin: 0 0 20px 0;
                font-size: 18px;
            }
            
            .column-types {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 12px;
                margin-bottom: 20px;
            }
            
            .column-type-btn {
                background: #2a2a2a;
                border: 1px solid #444;
                color: #fff;
                padding: 16px 12px;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                transition: all 0.2s;
            }
            
            .column-type-btn:hover {
                background: #333;
                border-color: #555;
            }
            
            .type-icon {
                font-size: 24px;
            }
            
            .type-title {
                font-size: 12px;
                text-align: center;
            }
            
            .dialog-actions {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
            }
            
            .dialog-actions button {
                background: #333;
                border: 1px solid #555;
                color: #fff;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .dialog-actions button:hover {
                background: #444;
            }
        `;
        
        document.head.appendChild(styleEl);
    }

    removeDeckInterface() {
        // Stop auto-refresh
        this.stopAutoRefresh();
        
        // Remove deck container
        if (this.deckContainer && this.deckContainer.parentNode) {
            this.deckContainer.parentNode.removeChild(this.deckContainer);
        }
        
        // Remove styles
        const styleElement = document.getElementById('astraltube-deck-styles');
        if (styleElement) {
            styleElement.parentNode.removeChild(styleElement);
        }
        
        // Show original YouTube content
        this.showOriginalContent();
        
        // Clear state
        this.columns.clear();
        this.refreshIntervals.clear();
        this.deckContainer = null;
    }

    // Message handling
    handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'toggleDeckMode':
                this.toggle();
                sendResponse({ success: true });
                break;
                
            case 'enableDeckMode':
                this.enable();
                sendResponse({ success: true });
                break;
                
            case 'disableDeckMode':
                this.disable();
                sendResponse({ success: true });
                break;
                
            case 'refreshDeckColumn':
                this.refreshColumn(message.columnId);
                sendResponse({ success: true });
                break;
                
            case 'addDeckColumn':
                this.addColumn(message.columnType, message.config);
                sendResponse({ success: true });
                break;
        }
    }

    // Helper methods
    addEventListener(event, selector, handler) {
        if (!this.deckContainer) return;
        
        const elements = this.deckContainer.querySelectorAll(selector);
        elements.forEach(element => {
            element.addEventListener(event, handler);
        });
        
        // Store for cleanup
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push({ selector, handler });
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
    }

    async saveSettings() {
        try {
            const settings = {
                deckModeEnabled: this.isEnabled,
                deckColumns: this.config.defaultColumns,
                deckColumnWidth: this.config.columnWidth,
                deckMaxColumns: this.config.maxColumns,
                deckRefreshInterval: this.config.autoRefreshInterval / (60 * 1000)
            };
            
            await chrome.runtime.sendMessage({
                action: 'updateSettings',
                settings: settings
            });
        } catch (error) {
            console.error('❌ Failed to save deck settings:', error);
        }
    }

    handleError(message, error) {
        console.error(`❌ ${message}:`, error);
        this.setState({ error: message });
        
        // Show error notification in deck interface
        const statusEl = this.deckContainer?.querySelector('#deck-status');
        if (statusEl) {
            statusEl.textContent = `Error: ${message}`;
            statusEl.style.color = '#ff6666';
            
            setTimeout(() => {
                statusEl.textContent = 'Ready';
                statusEl.style.color = '';
            }, 5000);
        }
    }

    // Utility methods
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(timestamp) {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleDateString();
    }

    formatRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) return 'just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    }

    // Cleanup
    destroy() {
        console.log('🧹 Cleaning up Deck Mode...');
        
        // Disable if enabled
        if (this.isEnabled) {
            this.disable();
        }
        
        // Clear event handlers
        this.eventHandlers.clear();
        
        this.isInitialized = false;
    }
}

// Auto-initialize if on YouTube
if (window.location.hostname.includes('youtube.com')) {
    const deckMode = new AstralTubeDeckMode();
    
    // Make globally available
    window.astralTubeDeckMode = deckMode;
}