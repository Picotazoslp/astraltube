/**
 * AstralTube v3 - Background Service Worker
 * Handles extension lifecycle, API management, and background tasks
 */

import { AstralTubeAPI } from '../lib/api.js';
import { StorageManager } from '../lib/storage.js';
import { AnalyticsManager } from '../lib/analytics.js';
import { errorHandler } from '../lib/error-handler.js';
import { healthChecker } from '../lib/health-checker.js';
import { configManager } from '../lib/config.js';
import { credentialsManager } from '../lib/credentials.js';
import { logger } from '../lib/logger.js';

class AstralTubeServiceWorker {
    constructor() {
        this.api = new AstralTubeAPI();
        this.storage = new StorageManager();
        this.analytics = new AnalyticsManager();
        this.initialized = false;
        this.activeConnections = new Map();
        this.syncInterval = null;
        this.healthCheckInterval = null;
        
        // Keep-alive mechanism
        this.keepAlivePort = null;
        this.lastActivity = Date.now();
        this.keepAliveInterval = null;
        this.restartAttempts = 0;
        this.maxRestartAttempts = 3;
        
        // State persistence
        this.persistedState = null;
        
        // Error recovery
        this.errorRecovery = errorHandler;
        
        this.init();
    }

    async init() {
        try {
            console.log('🚀 AstralTube Service Worker starting...');
            
            // Restore previous state if available
            await this.restoreState();
            
            // Initialize core services
            await this.initializeServices();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Start background tasks
            this.startBackgroundTasks();
            
            // Setup alarms
            this.setupAlarms();
            
            // Initialize keep-alive mechanism
            this.setupKeepAlive();
            
            // Setup error recovery
            this.setupErrorRecovery();
            
            this.initialized = true;
            console.log('✅ AstralTube Service Worker initialized');
            
            // Track successful initialization
            this.analytics.trackEvent('service_worker_initialized', {
                restartAttempts: this.restartAttempts,
                hasPersistedState: !!this.persistedState
            });
            
        } catch (error) {
            console.error('❌ Failed to initialize Service Worker:', error);
            this.handleInitializationError(error);
        }
    }

    async initializeServices() {
        try {
            console.log('🔧 Initializing core services...');
            
            // Initialize error handler first
            if (errorHandler.initialized) {
                console.log('🛡️ Error handler already initialized');
            } else {
                console.log('🛡️ Error handler not initialized, skipping');
            }
            
            // Initialize credentials manager
            await this.initializeWithErrorHandling(
                () => credentialsManager.initialize(),
                'Credentials Manager'
            );
            
            // Initialize configuration manager
            await this.initializeWithErrorHandling(
                () => configManager.initialize(),
                'Configuration Manager'
            );
            
            // Initialize storage manager
            await this.initializeWithErrorHandling(
                () => this.storage.initialize(),
                'Storage Manager'
            );
            
            // Initialize API manager
            await this.initializeWithErrorHandling(
                () => this.api.initialize(),
                'API Manager'
            );
            
            // Initialize analytics manager
            await this.initializeWithErrorHandling(
                () => this.analytics.initialize(),
                'Analytics Manager'
            );
            
            // Initialize health checker
            if (healthChecker.initialized) {
                console.log('🏥 Health checker already initialized');
            } else {
                console.log('🏥 Health checker not initialized, skipping');
            }
            
            console.log('✅ Core services initialized');
        } catch (error) {
            console.error('❌ Failed to initialize services:', error);
            await errorHandler.handleError(error, {
                source: 'service_initialization',
                critical: true
            });
            throw error;
        }
    }

    async initializeWithErrorHandling(initFunction, serviceName) {
        try {
            await initFunction();
            console.log(`✅ ${serviceName} initialized`);
        } catch (error) {
            console.error(`❌ Failed to initialize ${serviceName}:`, error);
            
            // Try to handle error if error handler is available
            if (errorHandler && errorHandler.initialized) {
                await errorHandler.handleError(error, {
                    source: 'service_initialization',
                    service: serviceName,
                    critical: true,
                    originalAction: initFunction
                });
            }
            
            // For critical services, still throw the error
            if (serviceName.includes('Storage')) {
                throw error;
            }
            
            // For non-critical services, just log and continue
            console.warn(`⚠️ ${serviceName} initialization failed, continuing without it`);
            return;
        }
    }

    setupEventListeners() {
        // Check if Chrome APIs are available
        if (typeof chrome === 'undefined' || !chrome.runtime) {
            console.error('❌ Chrome APIs not available');
            return;
        }
        
        // Extension installation/update
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstalled(details);
        });

        // Extension startup
        chrome.runtime.onStartup.addListener(() => {
            this.handleStartup();
        });

        // Message handling
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep channel open for async responses
        });

        // Connection handling (for long-lived connections)
        chrome.runtime.onConnect.addListener((port) => {
            this.handleConnection(port);
        });

        // Tab updates
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdated(tabId, changeInfo, tab);
        });

        // Tab activation
        chrome.tabs.onActivated.addListener((activeInfo) => {
            this.handleTabActivated(activeInfo);
        });

        // Command handling (keyboard shortcuts)
        chrome.commands.onCommand.addListener((command) => {
            this.handleCommand(command);
        });

        // Alarm handling
        chrome.alarms.onAlarm.addListener((alarm) => {
            this.handleAlarm(alarm);
        });

        // Context menu clicks (check if available)
        if (chrome.contextMenus && chrome.contextMenus.onClicked) {
            chrome.contextMenus.onClicked.addListener((info, tab) => {
                this.handleContextMenuClick(info, tab);
            });
        }

        // Notification clicks (check if available)
        if (chrome.notifications && chrome.notifications.onClicked) {
            chrome.notifications.onClicked.addListener((notificationId) => {
                this.handleNotificationClick(notificationId);
            });
        }
    }

    startBackgroundTasks() {
        // Start periodic sync
        this.startPeriodicSync();
        
        // Start health monitoring
        this.startHealthMonitoring();
        
        // Start cleanup tasks
        this.startCleanupTasks();
    }

    setupAlarms() {
        // Setup periodic alarms
        chrome.alarms.create('periodicSync', { 
            delayInMinutes: 30, 
            periodInMinutes: 30 
        });
        
        chrome.alarms.create('healthCheck', { 
            delayInMinutes: 5, 
            periodInMinutes: 5 
        });
        
        chrome.alarms.create('cleanup', { 
            delayInMinutes: 60, 
            periodInMinutes: 60 
        });
        
        // Keep-alive alarm (every 25 seconds to prevent 30-second timeout)
        chrome.alarms.create('keepAlive', {
            delayInMinutes: 0.4,
            periodInMinutes: 0.4
        });
        
        // State persistence alarm (every 2 minutes)
        chrome.alarms.create('persistState', {
            delayInMinutes: 2,
            periodInMinutes: 2
        });
    }

    // Event Handlers
    async handleInstalled(details) {
        console.log('📦 Extension installed/updated:', details.reason);
        
        try {
            if (details.reason === 'install') {
                await this.handleFirstInstall();
            } else if (details.reason === 'update') {
                await this.handleUpdate(details.previousVersion);
            }
            
            // Setup context menus
            this.setupContextMenus();
            
            // Track installation
            this.analytics.trackEvent('extension_installed', {
                reason: details.reason,
                previousVersion: details.previousVersion
            });
            
        } catch (error) {
            console.error('❌ Error handling installation:', error);
        }
    }

    async handleFirstInstall() {
        console.log('🎉 First time installation');
        
        // Set default settings
        await this.storage.set('astraltubeSettings', {
            sidebarEnabled: true,
            deckModeEnabled: false,
            autoSync: true,
            notifications: true,
            theme: 'auto'
        });
        
        // Initialize user data
        await this.storage.set('collections', []);
        await this.storage.set('customPlaylists', []);
        
        // Show welcome notification
        this.showNotification('welcome', {
            title: 'Welcome to AstralTube!',
            message: 'Your ultimate YouTube management experience starts now.',
            iconUrl: chrome.runtime.getURL('icons/icon48.png')
        });
        
        // Open options page
        chrome.tabs.create({ url: chrome.runtime.getURL('src/options/options.html') });
    }

    async handleUpdate(previousVersion) {
        console.log('🔄 Extension updated from:', previousVersion);
        
        // Perform migration if needed
        await this.performMigration(previousVersion);
        
        // Show update notification
        this.showNotification('update', {
            title: 'AstralTube Updated!',
            message: `Updated to v${chrome.runtime.getManifest().version}`,
            iconUrl: chrome.runtime.getURL('icons/icon48.png')
        });
    }

    async performMigration(fromVersion) {
        try {
            console.log('🔄 Performing migration from:', fromVersion);
            
            // Version-specific migrations
            if (this.compareVersions(fromVersion, '3.0.0') < 0) {
                await this.migrateToV3();
            }
            
            console.log('✅ Migration completed');
        } catch (error) {
            console.error('❌ Migration failed:', error);
        }
    }

    async migrateToV3() {
        // Migrate old data structures to v3 format
        console.log('🔄 Migrating to v3.0.0...');
        
        // This would contain specific migration logic
        // For now, just ensure new structure exists
        const settings = await this.storage.get('astraltubeSettings', {});
        if (!settings.version) {
            settings.version = '3.0.0';
            await this.storage.set('astraltubeSettings', settings);
        }
    }

    handleStartup() {
        console.log('🌅 Extension startup');
        this.analytics.trackEvent('extension_startup');
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            console.log('📨 Received message:', message.action, 'from:', sender.tab?.url);
            
            switch (message.action) {
                case 'ping':
                    sendResponse({ success: true, message: 'pong', timestamp: Date.now() });
                    break;
                    
                case 'testYouTubeAPI':
                    sendResponse({ 
                        success: true, 
                        message: 'YouTube API test placeholder',
                        apiStatus: 'Not implemented yet',
                        timestamp: Date.now() 
                    });
                    break;
                    
                case 'getPlaylists':
                    const playlists = await this.executeWithErrorHandling(
                        () => this.api.getPlaylists(),
                        'getPlaylists'
                    );
                    sendResponse({ success: true, data: playlists });
                    break;

                case 'getSubscriptions':
                    const subscriptions = await this.executeWithErrorHandling(
                        () => this.api.getSubscriptions(),
                        'getSubscriptions'
                    );
                    sendResponse({ success: true, data: subscriptions });
                    break;

                case 'createPlaylist':
                    const newPlaylist = await this.executeWithErrorHandling(
                        () => this.api.createPlaylist(message.data),
                        'createPlaylist'
                    );
                    sendResponse({ success: true, data: newPlaylist });
                    break;

                case 'syncData':
                    const syncResult = await this.executeWithErrorHandling(
                        () => this.api.syncData(),
                        'syncData'
                    );
                    sendResponse({ success: true, data: syncResult });
                    break;

                case 'getStats':
                    const stats = await this.executeWithErrorHandling(
                        () => this.analytics.getStats(),
                        'getStats'
                    );
                    sendResponse({ success: true, data: stats });
                    break;

                case 'updateSettings':
                    await this.executeWithErrorHandling(
                        () => this.storage.set('astraltubeSettings', message.settings),
                        'updateSettings'
                    );
                    sendResponse({ success: true });
                    break;

                case 'exportData':
                    const exportData = await this.executeWithErrorHandling(
                        () => this.storage.exportData(),
                        'exportData'
                    );
                    sendResponse({ success: true, data: exportData });
                    break;

                case 'importData':
                    const importResult = await this.executeWithErrorHandling(
                        () => this.storage.importData(message.data),
                        'importData'
                    );
                    sendResponse({ success: importResult });
                    break;

                case 'contentScriptReady':
                    this.handleContentScriptReady(sender.tab);
                    sendResponse({ success: true });
                    break;

                case 'trackEvent':
                    await this.executeWithErrorHandling(
                        () => this.analytics.trackEvent(message.event, message.properties),
                        'trackEvent'
                    );
                    sendResponse({ success: true });
                    break;

                // Health and monitoring endpoints
                case 'ping':
                    sendResponse({ 
                        status: 'alive', 
                        initialized: this.initialized,
                        version: chrome.runtime.getManifest().version,
                        health: healthChecker.getSystemHealth().overall
                    });
                    break;

                case 'getHealthStatus':
                    const healthStatus = healthChecker.getSystemHealth();
                    sendResponse({ success: true, data: healthStatus });
                    break;

                case 'getErrorStats':
                    const errorStats = errorHandler.getErrorStats();
                    sendResponse({ success: true, data: errorStats });
                    break;

                case 'checkAPIHealth':
                    const apiHealth = await this.checkAPIHealth();
                    sendResponse({ success: true, data: apiHealth });
                    break;

                case 'checkAuthStatus':
                    const authStatus = await this.checkAuthStatus();
                    sendResponse({ success: true, data: authStatus });
                    break;

                case 'checkCredentialsHealth':
                    const credentialsHealth = await this.checkCredentialsHealth();
                    sendResponse({ success: true, data: credentialsHealth });
                    break;

                case 'forceHealthCheck':
                    const healthCheckResults = await healthChecker.forceHealthCheck(message.componentId);
                    sendResponse({ success: true, data: healthCheckResults });
                    break;

                // Authentication and credentials
                case 'refreshAuthentication':
                    const refreshResult = await this.refreshAuthentication();
                    sendResponse({ success: refreshResult.success, data: refreshResult });
                    break;

                case 'clearAuthTokens':
                    const clearResult = await this.clearAuthTokens();
                    sendResponse({ success: clearResult });
                    break;

                case 'authenticate':
                    const authResult = await this.authenticate();
                    sendResponse({ success: authResult.success, data: authResult });
                    break;

                // Error reporting
                case 'reportError':
                    await errorHandler.handleError(
                        new Error(message.error), 
                        message.context
                    );
                    sendResponse({ success: true });
                    break;

                // Notifications
                case 'showNotification':
                    const notificationResult = await this.showNotification(message.notification);
                    sendResponse({ success: notificationResult });
                    break;

                // Options page
                case 'openOptions':
                    chrome.runtime.openOptionsPage();
                    sendResponse({ success: true });
                    break;
                    
                // Enhanced monitoring and health checks
                case 'getServiceWorkerHealth':
                    const swHealth = this.getServiceWorkerHealth();
                    sendResponse({ success: true, data: swHealth });
                    break;
                    
                case 'getPerformanceMetrics':
                    const perfMetrics = this.performanceMonitor?.getMetrics() || {};
                    sendResponse({ success: true, data: perfMetrics });
                    break;
                    
                case 'getMemoryStats':
                    const memStats = this.memoryManager?.getMemoryStats() || {};
                    sendResponse({ success: true, data: memStats });
                    break;
                    
                case 'getBackgroundTaskStats':
                    const taskStats = this.backgroundTaskQueue?.getQueueStats() || {};
                    sendResponse({ success: true, data: taskStats });
                    break;
                    
                case 'getSyncQueueStats':
                    const syncStats = this.syncQueue?.getQueueStats() || {};
                    sendResponse({ success: true, data: syncStats });
                    break;
                    
                case 'forcePersistState':
                    await this.persistCurrentState();
                    sendResponse({ success: true });
                    break;
                    
                case 'forceMemoryCleanup':
                    await this.memoryManager?.forceMemoryCleanup();
                    sendResponse({ success: true });
                    break;
                    
                case 'restartServiceWorker':
                    await this.restartServiceWorker();
                    sendResponse({ success: true });
                    break;

                default:
                    console.warn('Unknown message action:', message.action);
                    sendResponse({ success: false, error: 'Unknown action' });
            }
            
        } catch (error) {
            console.error('❌ Error handling message:', error);
            
            // Handle error through error handler
            await errorHandler.handleError(error, {
                source: 'message_handler',
                action: message.action,
                sender: sender.tab?.url
            });
            
            sendResponse({ success: false, error: error.message });
        }
    }

    async executeWithErrorHandling(operation, operationName) {
        try {
            return await operation();
        } catch (error) {
            console.error(`❌ Error in ${operationName}:`, error);
            
            await errorHandler.handleError(error, {
                source: 'api_operation',
                operation: operationName,
                originalAction: operation
            });
            
            throw error;
        }
    }

    // Health check methods
    async checkAPIHealth() {
        try {
            // Perform a simple API test
            const testResult = await this.api.testConnection();
            
            return {
                status: testResult.success ? 'healthy' : 'unhealthy',
                responseTime: testResult.responseTime,
                lastCheck: Date.now(),
                details: testResult
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                lastCheck: Date.now()
            };
        }
    }

    async checkAuthStatus() {
        try {
            const hasValidAuth = await credentialsManager.getOAuthCredentials();
            
            return {
                authenticated: !!hasValidAuth,
                lastCheck: Date.now()
            };
        } catch (error) {
            return {
                authenticated: false,
                error: error.message,
                lastCheck: Date.now()
            };
        }
    }

    async checkCredentialsHealth() {
        try {
            if (!credentialsManager.initialized) {
                return {
                    healthy: false,
                    error: 'Credentials manager not initialized'
                };
            }

            // Perform security audit
            const audit = await credentialsManager.performSecurityAudit();
            
            return {
                healthy: audit.issues.length === 0,
                audit: audit,
                lastCheck: Date.now()
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                lastCheck: Date.now()
            };
        }
    }

    // Authentication methods
    async refreshAuthentication() {
        try {
            // This would implement the actual authentication refresh logic
            console.log('🔄 Attempting to refresh authentication...');
            
            // For now, return a mock result
            return {
                success: false,
                reason: 'not_implemented'
            };
        } catch (error) {
            await errorHandler.handleError(error, {
                source: 'authentication',
                operation: 'refresh'
            });
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    async clearAuthTokens() {
        try {
            console.log('🗑️ Clearing authentication tokens...');
            
            // Clear any stored auth tokens
            await credentialsManager.deleteCredential('oauth_google');
            
            return true;
        } catch (error) {
            await errorHandler.handleError(error, {
                source: 'authentication',
                operation: 'clear_tokens'
            });
            
            return false;
        }
    }

    async authenticate() {
        try {
            console.log('🔐 Attempting authentication...');
            
            // This would implement the actual authentication logic
            // For now, return a mock result
            return {
                success: false,
                reason: 'not_implemented'
            };
        } catch (error) {
            await errorHandler.handleError(error, {
                source: 'authentication',
                operation: 'authenticate'
            });
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    async showNotification(notification) {
        try {
            chrome.notifications.create(notification.id || Date.now().toString(), {
                type: 'basic',
                iconUrl: notification.iconUrl || chrome.runtime.getURL('icons/icon48.png'),
                title: notification.title,
                message: notification.message
            });
            
            return true;
        } catch (error) {
            console.error('❌ Failed to show notification:', error);
            return false;
        }
    }

    handleConnection(port) {
        console.log('🔌 New connection:', port.name);
        
        this.activeConnections.set(port.name, port);
        
        port.onMessage.addListener((message) => {
            this.handlePortMessage(message, port);
        });
        
        port.onDisconnect.addListener(() => {
            console.log('🔌 Connection closed:', port.name);
            this.activeConnections.delete(port.name);
        });
    }

    handlePortMessage(message, port) {
        // Handle long-lived connection messages
        console.log('📨 Port message:', message, 'from:', port.name);
    }

    handleTabUpdated(tabId, changeInfo, tab) {
        // Handle tab updates (e.g., URL changes)
        if (changeInfo.status === 'complete' && tab.url?.includes('youtube.com')) {
            this.injectContentScriptIfNeeded(tab);
        }
    }

    handleTabActivated(activeInfo) {
        // Handle tab activation
        this.analytics.trackEvent('tab_activated', { tabId: activeInfo.tabId });
    }

    async handleCommand(command) {
        console.log('⌨️ Command received:', command);
        
        try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!activeTab || !activeTab.url?.includes('youtube.com')) {
                return;
            }
            
            switch (command) {
                case 'toggle-sidebar':
                    await chrome.tabs.sendMessage(activeTab.id, { action: 'toggleSidebar' });
                    break;
                    
                case 'toggle-deck-mode':
                    await chrome.tabs.sendMessage(activeTab.id, { action: 'toggleDeckMode' });
                    break;
                    
                case 'quick-add':
                    await chrome.tabs.sendMessage(activeTab.id, { action: 'showQuickAdd' });
                    break;
                    
                case 'focus-search':
                    await chrome.tabs.sendMessage(activeTab.id, { action: 'focusSearch' });
                    break;
                    
                case 'mark-watched':
                    await chrome.tabs.sendMessage(activeTab.id, { action: 'markWatched' });
                    break;
            }
            
            this.analytics.trackEvent('command_executed', { command });
            
        } catch (error) {
            console.error('❌ Error handling command:', error);
        }
    }

    async handleAlarm(alarm) {
        console.log('⏰ Alarm triggered:', alarm.name);
        
        this.lastActivity = Date.now();
        
        switch (alarm.name) {
            case 'periodicSync':
                this.performPeriodicSync();
                break;
                
            case 'healthCheck':
                this.performHealthCheck();
                break;
                
            case 'cleanup':
                this.performCleanup();
                break;
                
            case 'keepAlive':
                await this.performKeepAlive();
                break;
                
            case 'heartbeat':
                await this.performHeartbeat();
                break;
                
            case 'memoryCleanup':
                await this.performMemoryCleanup();
                break;
                
            case 'persistState':
                await this.persistCurrentState();
                break;
        }
    }

    handleContextMenuClick(info, tab) {
        console.log('🖱️ Context menu clicked:', info.menuItemId);
        
        switch (info.menuItemId) {
            case 'addToPlaylist':
                this.handleAddToPlaylist(info, tab);
                break;
                
            case 'addToCollection':
                this.handleAddToCollection(info, tab);
                break;
        }
    }

    handleNotificationClick(notificationId) {
        console.log('🔔 Notification clicked:', notificationId);
        
        // Handle notification clicks
        switch (notificationId) {
            case 'welcome':
                chrome.tabs.create({ url: chrome.runtime.getURL('src/options/options.html') });
                break;
                
            case 'update':
                chrome.tabs.create({ url: 'https://github.com/astraltube/changelog' });
                break;
        }
        
        // Clear the notification
        chrome.notifications.clear(notificationId);
    }

    // Background Tasks
    startPeriodicSync() {
        // Sync data every 30 minutes
        this.syncInterval = setInterval(async () => {
            try {
                await this.performPeriodicSync();
            } catch (error) {
                console.error('❌ Periodic sync failed:', error);
            }
        }, 30 * 60 * 1000);
    }

    startHealthMonitoring() {
        // Check health every 5 minutes
        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.performHealthCheck();
            } catch (error) {
                console.error('❌ Health check failed:', error);
            }
        }, 5 * 60 * 1000);
    }

    startCleanupTasks() {
        // Cleanup every hour
        setInterval(async () => {
            try {
                await this.performCleanup();
            } catch (error) {
                console.error('❌ Cleanup failed:', error);
            }
        }, 60 * 60 * 1000);
    }

    async performPeriodicSync() {
        console.log('🔄 Performing periodic sync...');
        
        try {
            const settings = await this.storage.get('astraltubeSettings', {});
            if (!settings.autoSync) {
                console.log('⏸️ Auto-sync disabled, skipping');
                return;
            }
            
            const syncResult = await this.api.syncData();
            console.log('✅ Periodic sync completed:', syncResult);
            
            this.analytics.trackEvent('periodic_sync_completed', {
                playlists: syncResult.playlists?.length || 0,
                subscriptions: syncResult.subscriptions?.length || 0
            });
            
        } catch (error) {
            console.error('❌ Periodic sync failed:', error);
            this.analytics.trackEvent('periodic_sync_failed', { error: error.message });
        }
    }

    async performHealthCheck() {
        console.log('🏥 Performing health check...');
        
        try {
            const health = await this.api.checkAPIHealth();
            await this.storage.updateStats({ apiHealth: health });
            
            // Check for issues and notify if needed
            if (health.status === 'unhealthy') {
                this.showNotification('health_warning', {
                    title: 'AstralTube Health Warning',
                    message: 'API connectivity issues detected. Some features may be limited.',
                    iconUrl: chrome.runtime.getURL('icons/icon48.png')
                });
            }
            
        } catch (error) {
            console.error('❌ Health check failed:', error);
        }
    }

    async handleSyncError(error) {
        console.error('🔄 Sync error occurred:', error);
        
        // Add sync operation to offline queue for retry
        if (this.syncQueue) {
            this.syncQueue.addSyncOperation({
                type: 'periodicSync',
                execute: () => this.performPeriodicSync(),
                priority: 1
            });
        }
    }

    async performKeepAlive() {
        try {
            this.lastActivity = Date.now();
            
            // Update activity in storage for persistence
            await chrome.storage.local.set({ 
                lastServiceWorkerActivity: this.lastActivity 
            });
            
            // Persist current state
            await this.persistCurrentState();
            
            console.log('💓 Keep-alive heartbeat');
        } catch (error) {
            console.error('❌ Keep-alive failed:', error);
        }
    }
    
    async performHeartbeat() {
        try {
            // More frequent heartbeat for critical monitoring
            const now = Date.now();
            
            // Check if service worker is responsive
            const timeSinceLastActivity = now - this.lastActivity;
            if (timeSinceLastActivity > 60000) { // 1 minute
                console.warn('⚠️ Service worker appears unresponsive, attempting recovery');
                await this.attemptSelfRecovery();
            }
            
            // Update performance metrics
            if (this.performanceMonitor) {
                this.performanceMonitor.collectMetrics();
            }
            
            console.log('💗 Heartbeat pulse');
        } catch (error) {
            console.error('❌ Heartbeat failed:', error);
        }
    }
    
    async attemptSelfRecovery() {
        try {
            console.log('🔧 Attempting service worker self-recovery...');
            
            // Reinitialize critical services
            if (!this.api?.initialized) {
                await this.api.initialize();
            }
            
            if (!this.storage?.initialized) {
                await this.storage.initialize();
            }
            
            // Restart keep-alive mechanisms
            if (this.keepAliveStrategies) {
                await this.keepAliveStrategies.activate();
            }
            
            // Clear and restart intervals
            this.restartBackgroundTasks();
            
            this.lastActivity = Date.now();
            console.log('✅ Self-recovery completed');
        } catch (error) {
            console.error('❌ Self-recovery failed:', error);
        }
    }
    
    restartBackgroundTasks() {
        // Clear existing intervals
        if (this.syncInterval) clearInterval(this.syncInterval);
        if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
        
        // Restart background tasks
        this.startBackgroundTasks();
    }
    
    async restoreState() {
        try {
            if (!this.stateManager) return;
            
            const savedState = await this.stateManager.loadState();
            if (savedState) {
                this.persistedState = savedState;
                
                // Restore essential state
                this.restartAttempts = savedState.restartAttempts || 0;
                this.lastActivity = savedState.lastActivity || Date.now();
                
                // Restore settings if available
                if (savedState.settings) {
                    await this.storage.set('astraltubeSettings', savedState.settings);
                }
                
                console.log('📂 Service worker state restored', {
                    restartAttempts: this.restartAttempts,
                    timeSinceLastActivity: Date.now() - this.lastActivity
                });
            }
        } catch (error) {
            console.error('❌ Failed to restore state:', error);
        }
    }
    
    async persistCurrentState() {
        try {
            if (!this.stateManager) return;
            
            const state = {
                initialized: this.initialized,
                restartAttempts: this.restartAttempts,
                lastActivity: this.lastActivity,
                activeConnections: Array.from(this.activeConnections.keys()),
                settings: await this.storage.get('astraltubeSettings', {})
            };
            
            await this.stateManager.saveState(state);
        } catch (error) {
            console.error('❌ Failed to persist state:', error);
        }
    }
    
    setupKeepAlive() {
        try {
            // Initialize multiple keep-alive strategies
            if (this.keepAliveStrategies) {
                this.keepAliveStrategies.activate();
            }
            
            // Start performance monitoring
            if (this.performanceMonitor) {
                this.performanceMonitor.start();
            }
            
            // Start memory management
            if (this.memoryManager) {
                this.memoryManager.start();
            }
            
            console.log('💓 Advanced keep-alive mechanisms activated');
        } catch (error) {
            console.error('❌ Failed to setup keep-alive:', error);
        }
    }
    
    setupErrorRecovery() {
        try {
            // Enhanced error recovery with state persistence
            this.errorRecovery.onRecovery = async (category, success) => {
                if (success) {
                    // Reset restart attempts on successful recovery
                    if (category === 'initialization') {
                        this.restartAttempts = 0;
                        await this.persistCurrentState();
                    }
                }
            };
            
            console.log('🛡️ Enhanced error recovery activated');
        } catch (error) {
            console.error('❌ Failed to setup error recovery:', error);
        }
    }

    async performCleanup() {
        console.log('🧹 Performing comprehensive cleanup...');
        
        try {
            // Storage cleanup
            await this.storage.cleanup();
            
            // Analytics data flush
            await this.analytics.flushData();
            
            // Memory cleanup
            await this.performMemoryCleanup();
            
            // Cache optimization
            await this.optimizeCaches();
            
            console.log('✅ Comprehensive cleanup completed');
        } catch (error) {
            console.error('❌ Cleanup failed:', error);
            await errorHandler.handleError(error, {
                source: 'cleanup',
                operation: 'performCleanup'
            });
        }
    }
    
    async performMemoryCleanup() {
        try {
            console.log('🧠 Performing memory cleanup...');
            
            // Clear expired caches
            this.api.cache.clear();
            
            // Cleanup analytics
            this.analytics.performMemoryCleanup?.();
            
            // Force garbage collection if available
            // Service worker context - check for global gc function
            const globalScope = typeof window !== 'undefined' ? window : self;
            if (globalScope.gc) {
                globalScope.gc();
            }
            
            // Update memory metrics
            this.memoryManager.recordCleanup();
            
            console.log('✅ Memory cleanup completed');
        } catch (error) {
            console.error('❌ Memory cleanup failed:', error);
        }
    }
    
    async optimizeCaches() {
        try {
            console.log('🗃️ Optimizing caches...');
            
            // Optimize storage cache
            await this.storage.optimizeCache();
            
            // Optimize API cache
            this.api.optimizeCache?.();
            
            console.log('✅ Cache optimization completed');
        } catch (error) {
            console.error('❌ Cache optimization failed:', error);
        }
    }

    // Helper Methods
    async injectContentScriptIfNeeded(tab) {
        try {
            // Check if content script is already injected
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
            if (response?.status === 'alive') {
                return; // Already injected
            }
        } catch (error) {
            // Content script not injected, inject it
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['src/content/content-script.js']
                });
                
                await chrome.scripting.insertCSS({
                    target: { tabId: tab.id },
                    files: ['src/content/styles.css']
                });
                
                console.log('✅ Content script injected into tab:', tab.id);
            } catch (injectionError) {
                console.error('❌ Failed to inject content script:', injectionError);
            }
        }
    }

    setupContextMenus() {
        chrome.contextMenus.removeAll(() => {
            chrome.contextMenus.create({
                id: 'addToPlaylist',
                title: 'Add to AstralTube Playlist',
                contexts: ['link'],
                targetUrlPatterns: ['*://www.youtube.com/watch*', '*://youtube.com/watch*']
            });
            
            chrome.contextMenus.create({
                id: 'addToCollection',
                title: 'Add Channel to Collection',
                contexts: ['link'],
                targetUrlPatterns: ['*://www.youtube.com/channel/*', '*://www.youtube.com/c/*', '*://www.youtube.com/user/*']
            });
        });
    }

    handleContentScriptReady(tab) {
        console.log('✅ Content script ready in tab:', tab.id);
        
        // Send initial configuration to content script
        chrome.tabs.sendMessage(tab.id, {
            action: 'updateSettings',
            settings: this.storage.get('astraltubeSettings', {})
        });
    }

    async handleAddToPlaylist(info, tab) {
        try {
            const videoId = this.extractVideoId(info.linkUrl);
            if (videoId) {
                // Show add to playlist dialog
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'showAddToPlaylist',
                    videoId: videoId
                });
            }
        } catch (error) {
            console.error('❌ Error adding to playlist:', error);
        }
    }

    async handleAddToCollection(info, tab) {
        try {
            const channelId = this.extractChannelId(info.linkUrl);
            if (channelId) {
                // Show add to collection dialog
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'showAddToCollection',
                    channelId: channelId
                });
            }
        } catch (error) {
            console.error('❌ Error adding to collection:', error);
        }
    }

    showNotification(id, options) {
        chrome.notifications.create(id, {
            type: 'basic',
            ...options
        });
    }

    extractVideoId(url) {
        const match = url.match(/[?&]v=([^&]+)/);
        return match ? match[1] : null;
    }

    extractChannelId(url) {
        const match = url.match(/\/channel\/([^\/\?]+)/);
        return match ? match[1] : null;
    }

    compareVersions(a, b) {
        const aParts = a.split('.').map(Number);
        const bParts = b.split('.').map(Number);
        
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aPart = aParts[i] || 0;
            const bPart = bParts[i] || 0;
            
            if (aPart < bPart) return -1;
            if (aPart > bPart) return 1;
        }
        
        return 0;
    }
    
    getServiceWorkerHealth() {
        const now = Date.now();
        const timeSinceLastActivity = now - this.lastActivity;
        
        let health = 'healthy';
        let score = 100;
        const issues = [];
        
        // Check activity
        if (timeSinceLastActivity > 120000) { // 2 minutes
            health = 'unhealthy';
            score -= 50;
            issues.push('Service worker appears inactive for >2 minutes');
        } else if (timeSinceLastActivity > 60000) { // 1 minute
            health = 'degraded';
            score -= 20;
            issues.push('Service worker activity reduced');
        }
        
        // Check initialization
        if (!this.initialized) {
            health = 'unhealthy';
            score -= 30;
            issues.push('Service worker not properly initialized');
        }
        
        // Check restart attempts
        if (this.restartAttempts > 0) {
            score -= this.restartAttempts * 10;
            issues.push(`${this.restartAttempts} restart attempts`);
            if (this.restartAttempts >= this.maxRestartAttempts) {
                health = 'unhealthy';
                issues.push('Maximum restart attempts reached');
            }
        }
        
        // Check performance metrics
        const perfMetrics = this.performanceMonitor?.getMetrics() || {};
        if (perfMetrics.alerts && perfMetrics.alerts.length > 0) {
            score -= perfMetrics.alerts.length * 5;
            const criticalAlerts = perfMetrics.alerts.filter(a => a.type === 'critical');
            if (criticalAlerts.length > 0) {
                health = 'degraded';
                issues.push(`${criticalAlerts.length} critical performance alerts`);
            } else {
                issues.push(`${perfMetrics.alerts.length} performance warnings`);
            }
        }
        
        // Check memory usage
        const memoryStats = this.memoryManager?.getMemoryStats();
        if (memoryStats?.current?.utilization > 90) {
            health = 'unhealthy';
            score -= 25;
            issues.push('Critical memory usage (>90%)');
        } else if (memoryStats?.current?.utilization > 80) {
            if (health === 'healthy') health = 'degraded';
            score -= 15;
            issues.push('High memory usage (>80%)');
        }
        
        // Check background task queue
        const taskStats = this.backgroundTaskQueue?.getQueueStats() || {};
        if (taskStats.successRate < 80) {
            if (health === 'healthy') health = 'degraded';
            score -= 10;
            issues.push(`Low task success rate (${taskStats.successRate.toFixed(1)}%)`);
        }
        
        score = Math.max(0, score);
        
        return {
            health,
            score,
            issues,
            details: {
                initialized: this.initialized,
                lastActivity: this.lastActivity,
                timeSinceLastActivity,
                restartAttempts: this.restartAttempts,
                activeConnections: this.activeConnections.size,
                uptime: now - (this.startTime || now),
                memoryStats: memoryStats,
                performanceAlerts: perfMetrics.alerts || [],
                backgroundTasks: {
                    running: this.backgroundTaskQueue?.currentTasks || 0,
                    queued: this.backgroundTaskQueue?.queue?.length || 0,
                    successRate: taskStats.successRate || 100
                },
                syncQueue: {
                    length: this.syncQueue?.queue?.length || 0,
                    processing: this.syncQueue?.processing || false,
                    isOnline: this.syncQueue?.isOnline ?? true
                },
                keepAlive: {
                    active: this.keepAliveStrategies?.activeStrategy?.name || 'none',
                    lastHeartbeat: this.lastActivity
                }
            }
        };
    }
    
    async restartServiceWorker() {
        try {
            console.log('🔄 Restarting service worker...');
            
            // Persist current state before restart
            await this.persistCurrentState();
            
            // Clean up resources
            this.destroy();
            
            // Wait a moment for cleanup
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Reinitialize
            await this.init();
            
            console.log('✅ Service worker restart completed');
            return true;
        } catch (error) {
            console.error('❌ Service worker restart failed:', error);
            return false;
        }
    }

    async handleInitializationError(error) {
        this.restartAttempts++;
        
        console.error(`❌ Initialization failed (attempt ${this.restartAttempts}/${this.maxRestartAttempts}):`, error);
        
        // Report initialization error
        await errorHandler.handleError(error, {
            source: 'initialization',
            critical: true,
            attempt: this.restartAttempts,
            maxAttempts: this.maxRestartAttempts
        });
        
        if (this.restartAttempts < this.maxRestartAttempts) {
            // Exponential backoff with jitter for restart attempts
            const baseDelay = Math.pow(2, this.restartAttempts) * 1000;
            const jitter = Math.random() * 1000; // Add up to 1 second jitter
            const delay = baseDelay + jitter;
            
            console.log(`🔄 Retrying initialization in ${Math.round(delay)}ms...`);
        
            setTimeout(() => {
                this.init();
            }, delay);
        } else {
            console.error('❌ Maximum restart attempts reached, service worker in degraded mode');
        
            // Enter degraded mode - basic functionality only
            this.enterDegradedMode();
        }
        
        // Persist failure state
        await this.persistCurrentState();
    }
    
    enterDegradedMode() {
        console.warn('⚠️ Entering degraded mode - limited functionality available');
        
        // Set up basic error handling only
        this.setupEventListeners();
        
        // Show user notification about degraded mode
        this.showNotification('degraded_mode', {
            title: 'AstralTube - Limited Functionality',
            message: 'Extension is running in degraded mode. Some features may not be available.',
            iconUrl: chrome.runtime.getURL('icons/icon48.png')
        });
        
        // Set up periodic recovery attempts
        setInterval(() => {
            this.attemptRecoveryFromDegradedMode();
        }, 5 * 60 * 1000); // Every 5 minutes
    }
    
    async attemptRecoveryFromDegradedMode() {
        try {
            console.log('🔄 Attempting recovery from degraded mode...');
            
            // Reset restart attempts
            this.restartAttempts = 0;
            
            // Try to reinitialize
            await this.init();
            
            if (this.initialized) {
                console.log('✅ Successfully recovered from degraded mode');
                this.showNotification('recovery_success', {
                    title: 'AstralTube - Recovery Successful',
                    message: 'Extension has recovered and all features are now available.',
                    iconUrl: chrome.runtime.getURL('icons/icon48.png')
                });
            }
        } catch (error) {
            console.error('❌ Recovery from degraded mode failed:', error);
        }
    }

    // Cleanup
    destroy() {
        console.log('🧹 Cleaning up Service Worker...');
        
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        
        this.activeConnections.clear();
        this.initialized = false;
    }
}

// Initialize the service worker
const serviceWorker = new AstralTubeServiceWorker();

// Handle service worker lifecycle
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker installing...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker activating...');
    event.waitUntil(clients.claim());
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AstralTubeServiceWorker;
}