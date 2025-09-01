/**
 * AstralTube v3 - Popup Script
 * Ultimate YouTube Manager - Combined Playlist & Subscription Management
 */

import { AstralTubeAPI } from '../lib/api.js';
import { StorageManager } from '../lib/storage.js';
import { NotificationManager } from '../lib/notifications.js';
import { AnalyticsManager } from '../lib/analytics.js';
import { popupLogger as logger } from '../lib/logger.js';
import { Utils } from '../lib/utils.js';

class AstralTubePopup {
    constructor() {
        this.api = new AstralTubeAPI();
        this.storage = new StorageManager();
        this.notifications = new NotificationManager();
        this.analytics = new AnalyticsManager();
        
        this.currentTab = 'dashboard';
        this.isLoading = false;
        this.data = {
            playlists: [],
            subscriptions: [],
            collections: [],
            stats: {},
            activity: []
        };
        
        this.init();
    }

    async init() {
        try {
            this.showLoading(true);
            
            // Initialize components
            await this.initializeComponents();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load initial data
            await this.loadInitialData();
            
            // Render initial view
            this.renderCurrentTab();
            
            this.showLoading(false);
            
            console.log('🌟 AstralTube Popup initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize AstralTube Popup:', error);
            this.notifications.show('Failed to initialize AstralTube', 'error');
            this.showLoading(false);
        }
    }

    async initializeComponents() {
        // Initialize API connection
        await this.api.initialize();
        
        // Initialize storage
        await this.storage.initialize();
        
        // Initialize notifications
        this.notifications.initialize(document.getElementById('notificationContainer'));
        
        // Initialize analytics
        await this.analytics.initialize();
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Header actions
        document.getElementById('syncBtn').addEventListener('click', () => this.handleSync());
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());

        // Dashboard actions
        document.getElementById('createPlaylistBtn').addEventListener('click', () => this.createPlaylist());
        document.getElementById('createCollectionBtn').addEventListener('click', () => this.createCollection());
        document.getElementById('toggleSidebarBtn').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('toggleDeckBtn').addEventListener('click', () => this.toggleDeckMode());
        document.getElementById('refreshStats').addEventListener('click', () => this.refreshStats());

        // Search functionality
        document.getElementById('playlistSearch').addEventListener('input', (e) => {
            this.searchPlaylists(e.target.value);
        });
        document.getElementById('subscriptionSearch').addEventListener('input', (e) => {
            this.searchSubscriptions(e.target.value);
        });

        // Filter and sort
        document.getElementById('playlistFilter').addEventListener('click', () => this.showPlaylistFilters());
        document.getElementById('playlistSort').addEventListener('click', () => this.showPlaylistSort());
        document.getElementById('subscriptionFilter').addEventListener('click', () => this.showSubscriptionFilters());
        document.getElementById('healthCheck').addEventListener('click', () => this.runHealthCheck());

        // Tools
        document.getElementById('importDataBtn').addEventListener('click', () => this.importData());
        document.getElementById('exportDataBtn').addEventListener('click', () => this.exportData());
        document.getElementById('analyticsBtn').addEventListener('click', () => this.showAnalytics());
        document.getElementById('durationCalcBtn').addEventListener('click', () => this.showDurationCalculator());
        document.getElementById('cleanupBtn').addEventListener('click', () => this.showCleanupTool());
        document.getElementById('backupBtn').addEventListener('click', () => this.showBackupTool());

        // Footer actions
        document.getElementById('helpBtn').addEventListener('click', () => this.showHelp());
        document.getElementById('shortcutsBtn').addEventListener('click', () => this.showShortcuts());
        document.getElementById('feedbackBtn').addEventListener('click', () => this.sendFeedback());
        document.getElementById('donateBtn').addEventListener('click', () => this.showDonation());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));

        // Window events
        window.addEventListener('beforeunload', () => this.cleanup());
    }

    async loadInitialData() {
        try {
            // Load data in parallel for better performance
            const [playlists, subscriptions, collections, stats, activity] = await Promise.all([
                this.api.getPlaylists(),
                this.api.getSubscriptions(),
                this.storage.get('collections', []),
                this.analytics.getStats(),
                this.storage.get('recentActivity', [])
            ]);

            this.data = {
                playlists: playlists || [],
                subscriptions: subscriptions || [],
                collections: collections || [],
                stats: stats || {},
                activity: activity || []
            };

            console.log('📊 Loaded initial data:', {
                playlists: this.data.playlists.length,
                subscriptions: this.data.subscriptions.length,
                collections: this.data.collections.length
            });
        } catch (error) {
            console.error('❌ Failed to load initial data:', error);
            this.notifications.show('Failed to load data', 'error');
        }
    }

    switchTab(tabName) {
        if (this.currentTab === tabName) return;

        // Update tab buttons
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update tab panes
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tabName}Pane`);
        });

        this.currentTab = tabName;
        this.renderCurrentTab();

        // Track tab switch
        this.analytics.trackEvent('tab_switch', { tab: tabName });
    }

    renderCurrentTab() {
        switch (this.currentTab) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'playlists':
                this.renderPlaylists();
                break;
            case 'subscriptions':
                this.renderSubscriptions();
                break;
            case 'tools':
                this.renderTools();
                break;
        }
    }

    renderDashboard() {
        // Update stats
        document.getElementById('totalPlaylists').textContent = this.data.playlists.length;
        document.getElementById('totalSubscriptions').textContent = this.data.subscriptions.length;
        document.getElementById('totalCollections').textContent = this.data.collections.length;
        document.getElementById('watchTime').textContent = this.formatWatchTime(this.data.stats.totalWatchTime || 0);

        // Update activity
        this.renderActivity();

        // Update health status
        this.renderHealthStatus();
    }

    renderActivity() {
        const activityList = document.getElementById('activityList');
        
        if (this.data.activity.length === 0) {
            activityList.innerHTML = `
                <div class="empty-activity">
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }

        activityList.innerHTML = this.data.activity.slice(0, 5).map(activity => `
            <div class="activity-item">
                <div class="activity-icon">
                    <svg viewBox="0 0 24 24">
                        <path d="${this.getActivityIcon(activity.type)}"/>
                    </svg>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-time">${this.formatTimeAgo(activity.timestamp)}</div>
                </div>
            </div>
        `).join('');
    }

    renderHealthStatus() {
        // Update sync health
        const syncHealth = document.getElementById('syncHealth');
        const apiHealth = document.getElementById('apiHealth');
        const storageHealth = document.getElementById('storageHealth');

        // Check sync status
        const lastSync = this.data.stats.lastSync || 0;
        const syncAge = Date.now() - lastSync;
        const syncStatus = syncAge < 300000 ? 'healthy' : syncAge < 900000 ? 'good' : 'poor';
        
        syncHealth.className = `health-status ${syncStatus}`;
        syncHealth.querySelector('span').textContent = this.getSyncStatusText(syncAge);

        // Check API quota
        const apiQuota = this.data.stats.apiQuota || { used: 0, limit: 10000 };
        const quotaPercent = (apiQuota.used / apiQuota.limit) * 100;
        const apiStatus = quotaPercent < 70 ? 'healthy' : quotaPercent < 90 ? 'good' : 'poor';
        
        apiHealth.className = `health-status ${apiStatus}`;
        apiHealth.querySelector('span').textContent = `${Math.round(100 - quotaPercent)}% Available`;

        // Check storage usage
        const storageUsed = this.data.stats.storageUsed || 0;
        const storageStatus = storageUsed < 50 ? 'healthy' : storageUsed < 100 ? 'good' : 'poor';
        
        storageHealth.className = `health-status ${storageStatus}`;
        storageHealth.querySelector('span').textContent = `${storageUsed}MB Used`;
    }

    renderPlaylists() {
        const playlistList = document.getElementById('playlistList');
        
        if (this.data.playlists.length === 0) {
            playlistList.innerHTML = this.getEmptyState('playlists');
            return;
        }

        playlistList.innerHTML = this.data.playlists.map(playlist => `
            <div class="playlist-item" data-id="${playlist.id}">
                <div class="playlist-thumbnail">
                    <img src="${playlist.thumbnail}" alt="${playlist.title}" loading="lazy">
                    <div class="playlist-overlay">
                        <div class="playlist-count">${playlist.itemCount} videos</div>
                    </div>
                </div>
                <div class="playlist-content">
                    <div class="playlist-title">${playlist.title}</div>
                    <div class="playlist-meta">
                        <span class="playlist-privacy">${playlist.privacy}</span>
                        <span class="playlist-updated">${this.formatTimeAgo(playlist.updatedAt)}</span>
                    </div>
                    <div class="playlist-actions">
                        <button class="playlist-action" data-action="open" title="Open on YouTube">
                            <svg viewBox="0 0 24 24">
                                <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
                            </svg>
                        </button>
                        <button class="playlist-action" data-action="edit" title="Edit Playlist">
                            <svg viewBox="0 0 24 24">
                                <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                            </svg>
                        </button>
                        <button class="playlist-action" data-action="duration" title="Calculate Duration">
                            <svg viewBox="0 0 24 24">
                                <path d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Add event listeners to playlist actions
        this.setupPlaylistActions();
    }

    renderSubscriptions() {
        const collectionsList = document.getElementById('collectionsList');
        
        if (this.data.collections.length === 0) {
            collectionsList.innerHTML = this.getEmptyState('collections');
            return;
        }

        collectionsList.innerHTML = this.data.collections.map(collection => `
            <div class="collection-item" data-id="${collection.id}">
                <div class="collection-header">
                    <div class="collection-icon" style="background: ${collection.color}">
                        ${collection.icon || '📁'}
                    </div>
                    <div class="collection-info">
                        <div class="collection-title">${collection.name}</div>
                        <div class="collection-count">${collection.channels?.length || 0} channels</div>
                    </div>
                    <div class="collection-health">
                        <div class="health-indicator ${this.getCollectionHealth(collection)}"></div>
                    </div>
                </div>
                <div class="collection-actions">
                    <button class="collection-action" data-action="open" title="View Collection">
                        <svg viewBox="0 0 24 24">
                            <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
                        </svg>
                    </button>
                    <button class="collection-action" data-action="edit" title="Edit Collection">
                        <svg viewBox="0 0 24 24">
                            <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                        </svg>
                    </button>
                    <button class="collection-action" data-action="health" title="Health Check">
                        <svg viewBox="0 0 24 24">
                            <path d="M12.5,8C9.85,8 7.45,9 5.6,10.6L2,7V16H11L7.4,12.4C8.8,11.3 10.4,10.5 12.5,10.5C16.28,10.5 19.5,13.22 20,17H22C21.5,12.17 17.39,8 12.5,8Z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');

        // Add event listeners to collection actions
        this.setupCollectionActions();
    }

    renderTools() {
        // Tools are static HTML, no dynamic rendering needed
        console.log('🔧 Tools tab rendered');
    }

    // Event Handlers
    async handleSync() {
        try {
            this.showLoading(true, 'Syncing data...');
            
            await this.api.syncData();
            await this.loadInitialData();
            this.renderCurrentTab();
            
            this.notifications.show('Data synced successfully', 'success');
            this.analytics.trackEvent('sync_completed');
        } catch (error) {
            console.error('❌ Sync failed:', error);
            this.notifications.show('Sync failed', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    openSettings() {
        chrome.runtime.openOptionsPage();
        this.analytics.trackEvent('settings_opened');
    }

    async createPlaylist() {
        try {
            const result = await this.showCreatePlaylistDialog();
            if (result) {
                const playlist = await this.api.createPlaylist(result);
                this.data.playlists.unshift(playlist);
                this.renderCurrentTab();
                this.notifications.show('Playlist created successfully', 'success');
                this.analytics.trackEvent('playlist_created');
            }
        } catch (error) {
            console.error('❌ Failed to create playlist:', error);
            this.notifications.show('Failed to create playlist', 'error');
        }
    }

    async createCollection() {
        try {
            const result = await this.showCreateCollectionDialog();
            if (result) {
                const collection = {
                    id: this.generateId(),
                    ...result,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
                
                this.data.collections.unshift(collection);
                await this.storage.set('collections', this.data.collections);
                this.renderCurrentTab();
                this.notifications.show('Collection created successfully', 'success');
                this.analytics.trackEvent('collection_created');
            }
        } catch (error) {
            console.error('❌ Failed to create collection:', error);
            this.notifications.show('Failed to create collection', 'error');
        }
    }

    async toggleSidebar() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.url.includes('youtube.com')) {
                await chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' });
                this.analytics.trackEvent('sidebar_toggled');
            } else {
                this.notifications.show('Please navigate to YouTube first', 'info');
            }
        } catch (error) {
            console.error('❌ Failed to toggle sidebar:', error);
            this.notifications.show('Failed to toggle sidebar', 'error');
        }
    }

    async toggleDeckMode() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.url.includes('youtube.com')) {
                await chrome.tabs.sendMessage(tab.id, { action: 'toggleDeckMode' });
                this.analytics.trackEvent('deck_mode_toggled');
            } else {
                this.notifications.show('Please navigate to YouTube first', 'info');
            }
        } catch (error) {
            console.error('❌ Failed to toggle deck mode:', error);
            this.notifications.show('Failed to toggle deck mode', 'error');
        }
    }

    async refreshStats() {
        try {
            this.showLoading(true, 'Refreshing stats...');
            
            this.data.stats = await this.analytics.getStats();
            this.renderDashboard();
            
            this.notifications.show('Stats refreshed', 'success');
        } catch (error) {
            console.error('❌ Failed to refresh stats:', error);
            this.notifications.show('Failed to refresh stats', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Search functionality
    searchPlaylists(query) {
        const items = document.querySelectorAll('.playlist-item');
        items.forEach(item => {
            const title = item.querySelector('.playlist-title').textContent.toLowerCase();
            const matches = title.includes(query.toLowerCase());
            item.style.display = matches ? '' : 'none';
        });
    }

    searchSubscriptions(query) {
        const items = document.querySelectorAll('.collection-item');
        items.forEach(item => {
            const title = item.querySelector('.collection-title').textContent.toLowerCase();
            const matches = title.includes(query.toLowerCase());
            item.style.display = matches ? '' : 'none';
        });
    }

    // Utility methods
    showLoading(show, text = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const loadingText = overlay.querySelector('.loading-text');
        
        if (show) {
            loadingText.textContent = text;
            overlay.style.display = 'flex';
        } else {
            overlay.style.display = 'none';
        }
        
        this.isLoading = show;
    }

    formatWatchTime(minutes) {
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h`;
        const days = Math.floor(hours / 24);
        return `${days}d`;
    }

    formatTimeAgo(timestamp) {
        return Utils.DateTime.formatTimeAgo(timestamp);
    }

    getActivityIcon(type) {
        const icons = {
            playlist_created: 'M15,6H3V8H15V6M15,10H3V12H15V10M3,16H11V14H3V16M17,6V14.18C16.69,14.07 16.35,14 16,14A3,3 0 0,0 13,17A3,3 0 0,0 16,20A3,3 0 0,0 19,17V8H22V6H17Z',
            collection_created: 'M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z',
            sync_completed: 'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z'
        };
        return icons[type] || icons.playlist_created;
    }

    getSyncStatusText(ageMs) {
        const minutes = Math.floor(ageMs / 60000);
        if (minutes < 5) return 'Just synced';
        if (minutes < 15) return 'Recently synced';
        if (minutes < 60) return `${minutes}m ago`;
        return 'Needs sync';
    }

    getCollectionHealth(collection) {
        // Simple health calculation based on channel activity
        const channelCount = collection.channels?.length || 0;
        if (channelCount === 0) return 'poor';
        if (channelCount < 5) return 'good';
        return 'healthy';
    }

    getEmptyState(type) {
        const states = {
            playlists: `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" class="empty-icon">
                        <path d="M15,6H3V8H15V6M15,10H3V12H15V10M3,16H11V14H3V16M17,6V14.18C16.69,14.07 16.35,14 16,14A3,3 0 0,0 13,17A3,3 0 0,0 16,20A3,3 0 0,0 19,17V8H22V6H17Z"/>
                    </svg>
                    <h3>No playlists found</h3>
                    <p>Create your first playlist to get started</p>
                    <button class="empty-action-btn" onclick="astralTube.createPlaylist()">Create Playlist</button>
                </div>
            `,
            collections: `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" class="empty-icon">
                        <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>
                    </svg>
                    <h3>No collections found</h3>
                    <p>Create your first collection to organize subscriptions</p>
                    <button class="empty-action-btn" onclick="astralTube.createCollection()">Create Collection</button>
                </div>
            `
        };
        return states[type] || '';
    }

    generateId() {
        return 'astral_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    handleKeyboardShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case '1':
                    e.preventDefault();
                    this.switchTab('dashboard');
                    break;
                case '2':
                    e.preventDefault();
                    this.switchTab('playlists');
                    break;
                case '3':
                    e.preventDefault();
                    this.switchTab('subscriptions');
                    break;
                case '4':
                    e.preventDefault();
                    this.switchTab('tools');
                    break;
                case 'f':
                    if (e.shiftKey) {
                        e.preventDefault();
                        const searchInput = document.querySelector(`#${this.currentTab}Search`);
                        if (searchInput) searchInput.focus();
                    }
                    break;
            }
        }
    }

    setupPlaylistActions() {
        document.querySelectorAll('.playlist-action').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = e.currentTarget.dataset.action;
                const playlistId = e.currentTarget.closest('.playlist-item').dataset.id;
                
                switch (action) {
                    case 'open':
                        this.openPlaylist(playlistId);
                        break;
                    case 'edit':
                        this.editPlaylist(playlistId);
                        break;
                    case 'duration':
                        this.calculatePlaylistDuration(playlistId);
                        break;
                }
            });
        });
    }

    setupCollectionActions() {
        document.querySelectorAll('.collection-action').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = e.currentTarget.dataset.action;
                const collectionId = e.currentTarget.closest('.collection-item').dataset.id;
                
                switch (action) {
                    case 'open':
                        this.openCollection(collectionId);
                        break;
                    case 'edit':
                        this.editCollection(collectionId);
                        break;
                    case 'health':
                        this.checkCollectionHealth(collectionId);
                        break;
                }
            });
        });
    }

    // Placeholder methods for dialog implementations
    async showCreatePlaylistDialog() {
        // This would show a modal dialog for creating playlists
        // For now, return a simple prompt result
        const title = prompt('Enter playlist title:');
        if (title) {
            return {
                title,
                description: '',
                privacy: 'private'
            };
        }
        return null;
    }

    async showCreateCollectionDialog() {
        // This would show a modal dialog for creating collections
        // For now, return a simple prompt result
        const name = prompt('Enter collection name:');
        if (name) {
            return {
                name,
                description: '',
                color: '#667eea',
                icon: '📁',
                channels: []
            };
        }
        return null;
    }

    // Placeholder methods for various actions
    openPlaylist(id) { console.log('Opening playlist:', id); }
    editPlaylist(id) { console.log('Editing playlist:', id); }
    calculatePlaylistDuration(id) { console.log('Calculating duration for playlist:', id); }
    openCollection(id) { console.log('Opening collection:', id); }
    editCollection(id) { console.log('Editing collection:', id); }
    checkCollectionHealth(id) { console.log('Checking health for collection:', id); }
    
    showPlaylistFilters() { console.log('Showing playlist filters'); }
    showPlaylistSort() { console.log('Showing playlist sort options'); }
    showSubscriptionFilters() { console.log('Showing subscription filters'); }
    runHealthCheck() { console.log('Running health check'); }
    
    importData() { console.log('Importing data'); }
    exportData() { console.log('Exporting data'); }
    showAnalytics() { console.log('Showing analytics'); }
    showDurationCalculator() { console.log('Showing duration calculator'); }
    showCleanupTool() { console.log('Showing cleanup tool'); }
    showBackupTool() { console.log('Showing backup tool'); }
    
    showHelp() { console.log('Showing help'); }
    showShortcuts() { console.log('Showing shortcuts'); }
    sendFeedback() { console.log('Sending feedback'); }
    showDonation() { console.log('Showing donation'); }

    cleanup() {
        console.log('🧹 Cleaning up AstralTube Popup');
        // Cleanup resources
    }
}

// Initialize the popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.astralTube = new AstralTubePopup();
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AstralTubePopup;
}