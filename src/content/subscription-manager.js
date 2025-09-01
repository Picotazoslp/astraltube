/**
 * AstralTube v3 - Advanced Subscription Manager
 * Organize, filter, and enhance YouTube subscriptions
 */

export class AstralTubeSubscriptionManager {
    constructor() {
        this.isInitialized = false;
        this.subscriptions = new Map();
        this.collections = new Map();
        this.tags = new Map();
        this.subscriptionCache = new Map();
        
        // Configuration
        this.config = {
            maxSubscriptionsPerPage: 50,
            refreshInterval: 5 * 60 * 1000, // 5 minutes
            bulkOperationBatchSize: 10,
            thumbnailCacheSize: 200,
            notificationSettings: {
                newVideos: true,
                uploads: true,
                livestreams: true,
                communityPosts: false
            },
            viewModes: ['grid', 'list', 'compact'],
            defaultView: 'grid',
            autoOrganize: true
        };
        
        // State management
        this.state = {
            currentView: 'overview', // overview, collection, subscription, analytics
            selectedCollection: null,
            selectedSubscriptions: new Set(),
            searchQuery: '',
            sortBy: 'name',
            sortOrder: 'asc',
            filterBy: {
                activity: 'all', // active, inactive, all
                type: 'all', // channel, topic, all
                uploadFrequency: 'all', // frequent, moderate, rare, all
                subscriberCount: 'all' // small, medium, large, all
            },
            viewMode: 'grid',
            isLoading: false,
            error: null,
            hasUnsavedChanges: false,
            lastSync: null
        };
        
        // Notification tracking
        this.notificationQueue = [];
        this.lastNotificationCheck = null;
        this.unreadCounts = new Map();
        
        // Analytics data
        this.analytics = {
            totalSubscriptions: 0,
            activeSubscriptions: 0,
            averageUploadsPerWeek: 0,
            topCategories: [],
            subscriberGrowth: [],
            watchTimeDistribution: {}
        };
        
        // Event handlers
        this.eventHandlers = new Map();
        this.refreshTimer = null;
        this.notificationTimer = null;
        
        this.init();
    }

    async init() {
        try {
            console.log('📺 Initializing AstralTube Subscription Manager...');
            
            // Load existing data
            await this.loadData();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Start background tasks
            this.startBackgroundTasks();
            
            // Inject UI components
            this.injectSubscriptionUI();
            
            this.isInitialized = true;
            console.log('✅ AstralTube Subscription Manager initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize subscription manager:', error);
            this.handleError('Initialization failed', error);
        }
    }

    async loadData() {
        try {
            this.setState({ isLoading: true });
            
            // Load YouTube subscriptions
            const subscriptionsResponse = await chrome.runtime.sendMessage({
                action: 'getSubscriptions'
            });
            
            if (subscriptionsResponse?.success) {
                for (const subscription of subscriptionsResponse.data) {
                    this.subscriptions.set(subscription.channelId, {
                        ...subscription,
                        lastChecked: Date.now(),
                        unreadCount: 0,
                        tags: [],
                        collections: [],
                        notes: '',
                        priority: 'normal', // high, normal, low
                        notifications: { ...this.config.notificationSettings },
                        statistics: {
                            totalWatchTime: 0,
                            videosWatched: 0,
                            lastVideoWatched: null,
                            averageWatchTime: 0
                        }
                    });
                }
            }
            
            // Load collections
            const collectionsResponse = await chrome.runtime.sendMessage({
                action: 'getSubscriptionCollections'
            });
            
            if (collectionsResponse?.success) {
                for (const collection of collectionsResponse.data) {
                    this.collections.set(collection.id, collection);
                }
            }
            
            // Load tags
            const tagsResponse = await chrome.runtime.sendMessage({
                action: 'getSubscriptionTags'
            });
            
            if (tagsResponse?.success) {
                for (const tag of tagsResponse.data) {
                    this.tags.set(tag.name, tag);
                }
            }
            
            // Generate analytics
            this.calculateAnalytics();
            
            // Auto-organize if enabled
            if (this.config.autoOrganize) {
                await this.autoOrganizeSubscriptions();
            }
            
            this.setState({ 
                isLoading: false, 
                lastSync: Date.now() 
            });
            
        } catch (error) {
            console.error('❌ Failed to load subscription data:', error);
            this.setState({ isLoading: false, error: error.message });
        }
    }

    calculateAnalytics() {
        const subscriptions = Array.from(this.subscriptions.values());
        
        this.analytics = {
            totalSubscriptions: subscriptions.length,
            activeSubscriptions: subscriptions.filter(s => this.isActiveChannel(s)).length,
            averageUploadsPerWeek: this.calculateAverageUploads(subscriptions),
            topCategories: this.getTopCategories(subscriptions),
            subscriberGrowth: this.getSubscriberGrowthData(subscriptions),
            watchTimeDistribution: this.getWatchTimeDistribution(subscriptions)
        };
    }

    isActiveChannel(subscription) {
        if (!subscription.lastUploadDate) return false;
        const daysSinceLastUpload = (Date.now() - new Date(subscription.lastUploadDate)) / (1000 * 60 * 60 * 24);
        return daysSinceLastUpload <= 30; // Active if uploaded within 30 days
    }

    calculateAverageUploads(subscriptions) {
        const activeChannels = subscriptions.filter(s => this.isActiveChannel(s));
        if (activeChannels.length === 0) return 0;
        
        const totalUploads = activeChannels.reduce((sum, s) => sum + (s.uploadsPerWeek || 0), 0);
        return totalUploads / activeChannels.length;
    }

    getTopCategories(subscriptions) {
        const categories = {};
        
        for (const sub of subscriptions) {
            const category = sub.category || 'Unknown';
            categories[category] = (categories[category] || 0) + 1;
        }
        
        return Object.entries(categories)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([category, count]) => ({ category, count }));
    }

    getSubscriberGrowthData(subscriptions) {
        // This would track subscriber growth over time
        // For now, return mock data structure
        return subscriptions
            .filter(s => s.subscriberHistory)
            .map(s => ({
                channelId: s.channelId,
                channelTitle: s.channelTitle,
                growth: s.subscriberHistory
            }));
    }

    getWatchTimeDistribution(subscriptions) {
        const distribution = {};
        
        for (const sub of subscriptions) {
            const watchTime = sub.statistics?.totalWatchTime || 0;
            const bucket = this.getWatchTimeBucket(watchTime);
            distribution[bucket] = (distribution[bucket] || 0) + 1;
        }
        
        return distribution;
    }

    getWatchTimeBucket(watchTime) {
        if (watchTime < 3600) return '< 1 hour'; // Less than 1 hour
        if (watchTime < 36000) return '1-10 hours';
        if (watchTime < 360000) return '10-100 hours';
        return '100+ hours';
    }

    setupEventListeners() {
        // Global message listener
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });
        
        // YouTube page events
        this.observeYouTubeChanges();
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcut(e));
    }

    observeYouTubeChanges() {
        // Observe for YouTube page changes to inject subscription management UI
        const observer = new MutationObserver(() => {
            this.injectSubscriptionUI();
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Initial injection
        setTimeout(() => this.injectSubscriptionUI(), 1000);
    }

    injectSubscriptionUI() {
        try {
            // Inject on subscriptions page
            if (window.location.pathname === '/feed/subscriptions') {
                this.injectSubscriptionsPageEnhancements();
            }
            
            // Inject on channel pages
            if (window.location.pathname.startsWith('/channel') || 
                window.location.pathname.startsWith('/@')) {
                this.injectChannelPageEnhancements();
            }
            
            // Inject global subscription manager button
            this.injectGlobalButton();
            
        } catch (error) {
            console.error('❌ Failed to inject subscription UI:', error);
        }
    }

    injectSubscriptionsPageEnhancements() {
        // Enhanced filtering and organization for subscriptions page
        const subscriptionsContainer = document.querySelector('ytd-browse[page-subtype="subscriptions"]');
        if (subscriptionsContainer && !document.querySelector('#astraltube-sub-enhancements')) {
            const enhancementsPanel = document.createElement('div');
            enhancementsPanel.id = 'astraltube-sub-enhancements';
            enhancementsPanel.className = 'astraltube-sub-panel';
            enhancementsPanel.innerHTML = `
                <div class="sub-panel-header">
                    <h3>🎯 AstralTube Subscriptions</h3>
                    <div class="sub-panel-controls">
                        <button id="sub-filter-btn" class="panel-btn" title="Filter Subscriptions">
                            <svg width="16" height="16" fill="currentColor">
                                <path d="M1 3h14l-5 6v4l-4-2V9L1 3z"/>
                            </svg>
                            Filter
                        </button>
                        <button id="sub-organize-btn" class="panel-btn" title="Organize">
                            <svg width="16" height="16" fill="currentColor">
                                <path d="M2 2h12v2H2V2zm0 4h12v2H2V6zm0 4h12v2H2v-2z"/>
                            </svg>
                            Organize
                        </button>
                        <button id="sub-analytics-btn" class="panel-btn" title="Analytics">
                            <svg width="16" height="16" fill="currentColor">
                                <path d="M3 3v18l4-4h8a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2z"/>
                            </svg>
                            Analytics
                        </button>
                    </div>
                </div>
                
                <div class="sub-panel-content" style="display: none;">
                    <div class="sub-filters">
                        <div class="filter-group">
                            <label>Activity:</label>
                            <select id="filter-activity">
                                <option value="all">All Channels</option>
                                <option value="active">Active (30 days)</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label>Upload Frequency:</label>
                            <select id="filter-frequency">
                                <option value="all">All Frequencies</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="rare">Rarely</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label>Collection:</label>
                            <select id="filter-collection">
                                <option value="all">All Collections</option>
                                ${Array.from(this.collections.values()).map(c => 
                                    `<option value="${c.id}">${c.name}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div class="sub-actions">
                        <button id="bulk-tag-btn" class="action-btn">Bulk Tag</button>
                        <button id="bulk-collect-btn" class="action-btn">Add to Collection</button>
                        <button id="export-subs-btn" class="action-btn">Export OPML</button>
                    </div>
                </div>
            `;
            
            // Insert at the top of the subscriptions page
            const contentContainer = subscriptionsContainer.querySelector('#contents');
            if (contentContainer) {
                contentContainer.insertBefore(enhancementsPanel, contentContainer.firstChild);
            }
            
            // Setup event listeners
            this.setupSubscriptionPageEvents(enhancementsPanel);
        }
        
        // Inject subscription cards enhancements
        this.enhanceSubscriptionCards();
    }

    enhanceSubscriptionCards() {
        const subscriptionCards = document.querySelectorAll('ytd-grid-video-renderer:not(.astraltube-enhanced)');
        
        for (const card of subscriptionCards) {
            card.classList.add('astraltube-enhanced');
            
            // Add channel info button
            const channelElement = card.querySelector('#channel-name');
            if (channelElement) {
                const channelLink = channelElement.querySelector('a');
                const channelId = this.extractChannelId(channelLink?.href);
                
                if (channelId) {
                    const subscription = this.subscriptions.get(channelId);
                    if (subscription) {
                        const infoButton = document.createElement('button');
                        infoButton.className = 'astraltube-channel-info';
                        infoButton.title = 'Channel Info';
                        infoButton.innerHTML = 'ℹ️';
                        infoButton.onclick = (e) => {
                            e.stopPropagation();
                            this.showChannelInfo(channelId);
                        };
                        
                        channelElement.appendChild(infoButton);
                    }
                }
            }
        }
    }

    injectChannelPageEnhancements() {
        const channelHeader = document.querySelector('ytd-c4-tabbed-header-renderer');
        if (channelHeader && !document.querySelector('#astraltube-channel-tools')) {
            const channelId = this.extractChannelIdFromUrl();
            const subscription = this.subscriptions.get(channelId);
            
            const toolsContainer = document.createElement('div');
            toolsContainer.id = 'astraltube-channel-tools';
            toolsContainer.className = 'astraltube-channel-tools';
            toolsContainer.innerHTML = `
                <div class="channel-tool-panel">
                    <div class="channel-subscription-status">
                        ${subscription ? `
                            <div class="subscribed-info">
                                <span class="status-icon">✓</span>
                                <span>Subscribed</span>
                                <div class="subscription-details">
                                    <div class="detail-item">
                                        <span class="label">Priority:</span>
                                        <select id="channel-priority" data-channel-id="${channelId}">
                                            <option value="low" ${subscription.priority === 'low' ? 'selected' : ''}>Low</option>
                                            <option value="normal" ${subscription.priority === 'normal' ? 'selected' : ''}>Normal</option>
                                            <option value="high" ${subscription.priority === 'high' ? 'selected' : ''}>High</option>
                                        </select>
                                    </div>
                                    <div class="detail-item">
                                        <span class="label">Collections:</span>
                                        <div class="collection-tags">
                                            ${subscription.collections.map(c => 
                                                `<span class="tag">${c}</span>`
                                            ).join('')}
                                        </div>
                                        <button id="manage-collections" class="mini-btn">Manage</button>
                                    </div>
                                    <div class="detail-item">
                                        <span class="label">Tags:</span>
                                        <div class="subscription-tags">
                                            ${subscription.tags.map(t => 
                                                `<span class="tag">${t}</span>`
                                            ).join('')}
                                        </div>
                                        <button id="manage-tags" class="mini-btn">Edit</button>
                                    </div>
                                </div>
                            </div>
                        ` : `
                            <div class="not-subscribed">
                                <span class="status-icon">○</span>
                                <span>Not Subscribed</span>
                            </div>
                        `}
                    </div>
                    
                    <div class="channel-tools">
                        <button id="channel-analytics-btn" class="tool-btn" title="View Analytics">
                            <svg width="16" height="16" fill="currentColor">
                                <path d="M3 3v18l4-4h8a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2z"/>
                            </svg>
                            Analytics
                        </button>
                        <button id="notification-settings-btn" class="tool-btn" title="Notification Settings">
                            <svg width="16" height="16" fill="currentColor">
                                <path d="M8 2a6 6 0 016 6c0 7-3 9-6 9s-6-2-6-9a6 6 0 016-6z"/>
                            </svg>
                            Notifications
                        </button>
                        <button id="export-channel-btn" class="tool-btn" title="Export Channel Data">
                            <svg width="16" height="16" fill="currentColor">
                                <path d="M14 2H6a2 2 0 00-2 2v16l4-4h6a2 2 0 002-2V4a2 2 0 00-2-2z"/>
                            </svg>
                            Export
                        </button>
                    </div>
                </div>
            `;
            
            channelHeader.appendChild(toolsContainer);
            
            // Setup event listeners
            this.setupChannelPageEvents(toolsContainer, channelId);
        }
    }

    injectGlobalButton() {
        const masthead = document.querySelector('#masthead');
        if (masthead && !document.querySelector('#astraltube-sub-manager-btn')) {
            const managerButton = document.createElement('button');
            managerButton.id = 'astraltube-sub-manager-btn';
            managerButton.className = 'astraltube-global-btn';
            managerButton.title = 'Subscription Manager';
            managerButton.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <div class="notification-badge" id="sub-notification-badge" style="display: none;">0</div>
            `;
            
            managerButton.addEventListener('click', () => {
                this.showSubscriptionManager();
            });
            
            // Insert into masthead
            const endContainer = masthead.querySelector('#end');
            if (endContainer) {
                endContainer.insertBefore(managerButton, endContainer.firstChild);
            }
        }
        
        // Update notification badge
        this.updateNotificationBadge();
    }

    updateNotificationBadge() {
        const badge = document.querySelector('#sub-notification-badge');
        if (badge) {
            const totalUnread = Array.from(this.unreadCounts.values()).reduce((sum, count) => sum + count, 0);
            
            if (totalUnread > 0) {
                badge.textContent = totalUnread > 99 ? '99+' : totalUnread.toString();
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    // Collection Management
    async createCollection(collectionData) {
        try {
            const collection = {
                id: `collection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: collectionData.name,
                description: collectionData.description || '',
                color: collectionData.color || '#4285f4',
                icon: collectionData.icon || '📁',
                channelIds: [],
                tags: collectionData.tags || [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                rules: collectionData.rules || null, // Auto-collection rules
                isAutoCollection: !!collectionData.rules
            };
            
            const response = await chrome.runtime.sendMessage({
                action: 'createSubscriptionCollection',
                data: collection
            });
            
            if (response?.success) {
                this.collections.set(collection.id, collection);
                
                // Apply auto-collection rules if present
                if (collection.isAutoCollection) {
                    await this.applyCollectionRules(collection.id);
                }
                
                this.trackActivity('collection_created', {
                    collectionId: collection.id,
                    name: collection.name
                });
                
                console.log('✅ Collection created:', collection.name);
                return collection;
            } else {
                throw new Error(response?.error || 'Failed to create collection');
            }
            
        } catch (error) {
            console.error('❌ Failed to create collection:', error);
            this.handleError('Failed to create collection', error);
            throw error;
        }
    }

    async addToCollection(collectionId, channelIds) {
        try {
            const collection = this.collections.get(collectionId);
            if (!collection) {
                throw new Error('Collection not found');
            }
            
            // Add channel IDs to collection
            const newChannelIds = channelIds.filter(id => !collection.channelIds.includes(id));
            collection.channelIds.push(...newChannelIds);
            collection.updatedAt = Date.now();
            
            // Update subscriptions with collection reference
            for (const channelId of newChannelIds) {
                const subscription = this.subscriptions.get(channelId);
                if (subscription) {
                    if (!subscription.collections.includes(collection.name)) {
                        subscription.collections.push(collection.name);
                    }
                }
            }
            
            const response = await chrome.runtime.sendMessage({
                action: 'updateSubscriptionCollection',
                data: collection
            });
            
            if (response?.success) {
                console.log(`✅ Added ${newChannelIds.length} channels to collection: ${collection.name}`);
                return true;
            } else {
                throw new Error(response?.error || 'Failed to update collection');
            }
            
        } catch (error) {
            console.error('❌ Failed to add to collection:', error);
            throw error;
        }
    }

    async applyCollectionRules(collectionId) {
        const collection = this.collections.get(collectionId);
        if (!collection || !collection.rules) return;
        
        const matchingChannels = [];
        
        for (const subscription of this.subscriptions.values()) {
            if (this.matchesCollectionRules(subscription, collection.rules)) {
                matchingChannels.push(subscription.channelId);
            }
        }
        
        if (matchingChannels.length > 0) {
            await this.addToCollection(collectionId, matchingChannels);
        }
    }

    matchesCollectionRules(subscription, rules) {
        // Match based on keywords in channel title/description
        if (rules.keywords && rules.keywords.length > 0) {
            const searchText = `${subscription.channelTitle} ${subscription.description}`.toLowerCase();
            const hasKeyword = rules.keywords.some(keyword => 
                searchText.includes(keyword.toLowerCase())
            );
            if (!hasKeyword) return false;
        }
        
        // Match based on category
        if (rules.categories && rules.categories.length > 0) {
            if (!rules.categories.includes(subscription.category)) {
                return false;
            }
        }
        
        // Match based on subscriber count
        if (rules.subscriberCount) {
            const count = subscription.subscriberCount || 0;
            if (rules.subscriberCount.min && count < rules.subscriberCount.min) return false;
            if (rules.subscriberCount.max && count > rules.subscriberCount.max) return false;
        }
        
        // Match based on upload frequency
        if (rules.uploadFrequency) {
            const frequency = subscription.uploadsPerWeek || 0;
            switch (rules.uploadFrequency) {
                case 'daily': return frequency >= 7;
                case 'weekly': return frequency >= 1 && frequency < 7;
                case 'monthly': return frequency >= 0.25 && frequency < 1;
                case 'rare': return frequency < 0.25;
            }
        }
        
        return true;
    }

    // Tagging System
    async addTagToSubscription(channelId, tag) {
        try {
            const subscription = this.subscriptions.get(channelId);
            if (!subscription) {
                throw new Error('Subscription not found');
            }
            
            if (!subscription.tags.includes(tag)) {
                subscription.tags.push(tag);
                
                // Update tag registry
                if (!this.tags.has(tag)) {
                    this.tags.set(tag, {
                        name: tag,
                        color: this.generateTagColor(tag),
                        channelCount: 0,
                        createdAt: Date.now()
                    });
                }
                
                const tagData = this.tags.get(tag);
                tagData.channelCount++;
                
                // Save changes
                await this.saveSubscriptionData(channelId, subscription);
                await this.saveTagData(tag, tagData);
                
                console.log(`✅ Added tag "${tag}" to ${subscription.channelTitle}`);
                return true;
            }
            
        } catch (error) {
            console.error('❌ Failed to add tag:', error);
            throw error;
        }
    }

    async bulkTag(channelIds, tags) {
        try {
            const results = [];
            
            for (const channelId of channelIds) {
                for (const tag of tags) {
                    try {
                        await this.addTagToSubscription(channelId, tag);
                        results.push({ channelId, tag, success: true });
                    } catch (error) {
                        results.push({ channelId, tag, success: false, error: error.message });
                    }
                }
            }
            
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;
            
            console.log(`✅ Bulk tagging completed: ${successful} successful, ${failed} failed`);
            return { successful, failed, results };
            
        } catch (error) {
            console.error('❌ Bulk tagging failed:', error);
            throw error;
        }
    }

    generateTagColor(tag) {
        // Generate a consistent color based on tag name
        let hash = 0;
        for (let i = 0; i < tag.length; i++) {
            hash = tag.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 50%)`;
    }

    // Auto-Organization
    async autoOrganizeSubscriptions() {
        try {
            console.log('🎯 Auto-organizing subscriptions...');
            
            // Group by category
            const categoryCollections = await this.createCategoryCollections();
            
            // Group by upload frequency
            const frequencyCollections = await this.createFrequencyCollections();
            
            // Auto-tag based on channel names and descriptions
            await this.autoTagChannels();
            
            console.log('✅ Auto-organization completed');
            
        } catch (error) {
            console.error('❌ Auto-organization failed:', error);
        }
    }

    async createCategoryCollections() {
        const categories = {};
        
        for (const subscription of this.subscriptions.values()) {
            const category = subscription.category || 'Uncategorized';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(subscription.channelId);
        }
        
        for (const [category, channelIds] of Object.entries(categories)) {
            if (channelIds.length >= 3) { // Only create collection if at least 3 channels
                const existingCollection = Array.from(this.collections.values())
                    .find(c => c.name === category && c.isAutoCollection);
                
                if (!existingCollection) {
                    await this.createCollection({
                        name: category,
                        description: `Auto-generated collection for ${category} channels`,
                        rules: { categories: [category] },
                        color: this.generateCategoryColor(category),
                        icon: this.getCategoryIcon(category)
                    });
                }
            }
        }
    }

    async createFrequencyCollections() {
        const frequencyGroups = {
            'Daily Uploaders': [],
            'Weekly Uploaders': [],
            'Monthly Uploaders': [],
            'Rare Uploaders': []
        };
        
        for (const subscription of this.subscriptions.values()) {
            const frequency = subscription.uploadsPerWeek || 0;
            
            if (frequency >= 7) {
                frequencyGroups['Daily Uploaders'].push(subscription.channelId);
            } else if (frequency >= 1) {
                frequencyGroups['Weekly Uploaders'].push(subscription.channelId);
            } else if (frequency >= 0.25) {
                frequencyGroups['Monthly Uploaders'].push(subscription.channelId);
            } else {
                frequencyGroups['Rare Uploaders'].push(subscription.channelId);
            }
        }
        
        for (const [name, channelIds] of Object.entries(frequencyGroups)) {
            if (channelIds.length >= 5) {
                const existingCollection = Array.from(this.collections.values())
                    .find(c => c.name === name && c.isAutoCollection);
                
                if (!existingCollection) {
                    await this.createCollection({
                        name,
                        description: `Auto-generated collection for ${name.toLowerCase()}`,
                        rules: { uploadFrequency: this.getFrequencyFromName(name) },
                        color: this.getFrequencyColor(name),
                        icon: this.getFrequencyIcon(name)
                    });
                }
            }
        }
    }

    async autoTagChannels() {
        const tagRules = [
            { keywords: ['gaming', 'game', 'gameplay'], tag: 'Gaming' },
            { keywords: ['tech', 'technology', 'review'], tag: 'Technology' },
            { keywords: ['music', 'song', 'artist'], tag: 'Music' },
            { keywords: ['cooking', 'recipe', 'food'], tag: 'Cooking' },
            { keywords: ['tutorial', 'how to', 'guide'], tag: 'Educational' },
            { keywords: ['vlog', 'daily', 'life'], tag: 'Lifestyle' },
            { keywords: ['news', 'politics', 'current'], tag: 'News' },
            { keywords: ['comedy', 'funny', 'humor'], tag: 'Comedy' }
        ];
        
        for (const subscription of this.subscriptions.values()) {
            const searchText = `${subscription.channelTitle} ${subscription.description}`.toLowerCase();
            
            for (const rule of tagRules) {
                const hasKeyword = rule.keywords.some(keyword => searchText.includes(keyword));
                if (hasKeyword && !subscription.tags.includes(rule.tag)) {
                    await this.addTagToSubscription(subscription.channelId, rule.tag);
                }
            }
        }
    }

    // Notification Management
    async checkForNotifications() {
        try {
            this.lastNotificationCheck = Date.now();
            
            for (const subscription of this.subscriptions.values()) {
                if (!subscription.notifications.newVideos) continue;
                
                // Check for new videos since last check
                const newVideos = await this.getNewVideosForChannel(subscription.channelId);
                
                if (newVideos.length > 0) {
                    this.queueNotifications(subscription, newVideos);
                    this.unreadCounts.set(subscription.channelId, 
                        (this.unreadCounts.get(subscription.channelId) || 0) + newVideos.length);
                }
            }
            
            // Process notification queue
            this.processNotificationQueue();
            this.updateNotificationBadge();
            
        } catch (error) {
            console.error('❌ Failed to check notifications:', error);
        }
    }

    async getNewVideosForChannel(channelId) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getChannelVideos',
                channelId,
                since: this.lastNotificationCheck
            });
            
            return response?.success ? response.data : [];
        } catch (error) {
            console.error('❌ Failed to get new videos:', error);
            return [];
        }
    }

    queueNotifications(subscription, videos) {
        for (const video of videos) {
            this.notificationQueue.push({
                type: 'new_video',
                channelId: subscription.channelId,
                channelTitle: subscription.channelTitle,
                video: video,
                priority: subscription.priority,
                timestamp: Date.now()
            });
        }
    }

    processNotificationQueue() {
        // Sort by priority and timestamp
        this.notificationQueue.sort((a, b) => {
            const priorityOrder = { high: 3, normal: 2, low: 1 };
            const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
            return priorityDiff !== 0 ? priorityDiff : b.timestamp - a.timestamp;
        });
        
        // Process high-priority notifications immediately
        const highPriorityNotifications = this.notificationQueue.filter(n => n.priority === 'high');
        for (const notification of highPriorityNotifications) {
            this.showNotification(notification);
        }
        
        // Batch process normal/low priority notifications
        const otherNotifications = this.notificationQueue.filter(n => n.priority !== 'high');
        if (otherNotifications.length > 0) {
            this.showBatchedNotifications(otherNotifications);
        }
        
        this.notificationQueue = [];
    }

    showNotification(notification) {
        if (!('Notification' in window)) return;
        
        const notif = new Notification(`New video from ${notification.channelTitle}`, {
            body: notification.video.title,
            icon: notification.video.thumbnail,
            tag: `astraltube-${notification.channelId}`,
            data: {
                videoId: notification.video.videoId,
                channelId: notification.channelId
            }
        });
        
        notif.onclick = () => {
            window.open(`https://www.youtube.com/watch?v=${notification.video.videoId}`, '_blank');
            notif.close();
        };
    }

    showBatchedNotifications(notifications) {
        if (notifications.length === 1) {
            this.showNotification(notifications[0]);
            return;
        }
        
        const channelGroups = {};
        for (const notif of notifications) {
            if (!channelGroups[notif.channelId]) {
                channelGroups[notif.channelId] = {
                    channelTitle: notif.channelTitle,
                    videos: []
                };
            }
            channelGroups[notif.channelId].videos.push(notif.video);
        }
        
        for (const group of Object.values(channelGroups)) {
            const batchNotif = new Notification(
                `${group.videos.length} new videos from ${group.channelTitle}`, {
                icon: group.videos[0].thumbnail,
                tag: `astraltube-batch-${group.channelId}`
            });
            
            batchNotif.onclick = () => {
                window.open(`https://www.youtube.com/feed/subscriptions`, '_blank');
                batchNotif.close();
            };
        }
    }

    // UI Methods
    showSubscriptionManager() {
        const dialog = this.createDialog('subscription-manager', {
            title: 'Subscription Manager',
            content: this.renderSubscriptionManager(),
            size: 'large',
            actions: [
                { text: 'Close', action: 'close' }
            ]
        });
        
        this.showDialog(dialog);
    }

    showChannelInfo(channelId) {
        const subscription = this.subscriptions.get(channelId);
        if (!subscription) return;
        
        const analytics = this.analyzeChannel(channelId);
        
        const dialog = this.createDialog('channel-info', {
            title: `${subscription.channelTitle} - Info`,
            content: this.renderChannelInfo(subscription, analytics),
            actions: [
                { text: 'Close', action: 'close' },
                { text: 'Edit', action: 'edit' }
            ]
        });
        
        this.showDialog(dialog);
    }

    renderSubscriptionManager() {
        return `
            <div class="subscription-manager">
                <div class="manager-sidebar">
                    <div class="sidebar-section">
                        <h4>📊 Overview</h4>
                        <div class="stats-summary">
                            <div class="stat">
                                <span class="stat-value">${this.analytics.totalSubscriptions}</span>
                                <span class="stat-label">Total Subscriptions</span>
                            </div>
                            <div class="stat">
                                <span class="stat-value">${this.analytics.activeSubscriptions}</span>
                                <span class="stat-label">Active Channels</span>
                            </div>
                            <div class="stat">
                                <span class="stat-value">${this.collections.size}</span>
                                <span class="stat-label">Collections</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="sidebar-section">
                        <h4>📁 Collections</h4>
                        <div class="collections-list">
                            ${Array.from(this.collections.values()).map(collection => `
                                <div class="collection-item" data-collection-id="${collection.id}">
                                    <span class="collection-icon">${collection.icon}</span>
                                    <span class="collection-name">${collection.name}</span>
                                    <span class="collection-count">${collection.channelIds.length}</span>
                                </div>
                            `).join('')}
                        </div>
                        <button id="create-collection-btn" class="sidebar-btn">+ New Collection</button>
                    </div>
                    
                    <div class="sidebar-section">
                        <h4>🏷️ Tags</h4>
                        <div class="tags-list">
                            ${Array.from(this.tags.values()).map(tag => `
                                <span class="tag-item" style="background-color: ${tag.color}">
                                    ${tag.name} (${tag.channelCount})
                                </span>
                            `).join('')}
                        </div>
                    </div>
                </div>
                
                <div class="manager-main">
                    <div class="main-header">
                        <div class="search-controls">
                            <input type="text" id="subscription-search" placeholder="Search subscriptions...">
                            <button id="filter-btn">🔽 Filter</button>
                            <button id="sort-btn">↕️ Sort</button>
                        </div>
                        <div class="view-controls">
                            <button class="view-btn active" data-view="grid">⊞</button>
                            <button class="view-btn" data-view="list">☰</button>
                            <button class="view-btn" data-view="compact">⋯</button>
                        </div>
                    </div>
                    
                    <div class="filter-panel" style="display: none;">
                        <!-- Filter controls populated dynamically -->
                    </div>
                    
                    <div class="subscriptions-content">
                        <div id="subscriptions-grid" class="subscriptions-grid">
                            ${this.renderSubscriptionGrid()}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderSubscriptionGrid() {
        const subscriptions = this.getFilteredAndSortedSubscriptions();
        
        return subscriptions.map(subscription => `
            <div class="subscription-card" data-channel-id="${subscription.channelId}">
                <div class="card-thumbnail">
                    <img src="${subscription.thumbnail}" alt="${subscription.channelTitle}">
                    <div class="priority-indicator priority-${subscription.priority}"></div>
                </div>
                <div class="card-content">
                    <h4 class="channel-title">${this.escapeHtml(subscription.channelTitle)}</h4>
                    <div class="channel-stats">
                        <span class="subscriber-count">${this.formatCount(subscription.subscriberCount)} subs</span>
                        <span class="upload-frequency">${this.getUploadFrequencyText(subscription.uploadsPerWeek)}</span>
                    </div>
                    <div class="channel-tags">
                        ${subscription.tags.map(tag => `
                            <span class="tag" style="background-color: ${this.tags.get(tag)?.color || '#ccc'}">
                                ${tag}
                            </span>
                        `).join('')}
                    </div>
                    <div class="channel-collections">
                        ${subscription.collections.map(collectionName => `
                            <span class="collection">${collectionName}</span>
                        `).join('')}
                    </div>
                </div>
                <div class="card-actions">
                    <button class="action-btn" data-action="info" title="Channel Info">ℹ️</button>
                    <button class="action-btn" data-action="analytics" title="Analytics">📊</button>
                    <button class="action-btn" data-action="notifications" title="Notifications">🔔</button>
                    <button class="action-btn" data-action="organize" title="Organize">🏷️</button>
                </div>
            </div>
        `).join('');
    }

    renderChannelInfo(subscription, analytics) {
        return `
            <div class="channel-info">
                <div class="info-header">
                    <img src="${subscription.thumbnail}" alt="${subscription.channelTitle}" class="channel-avatar">
                    <div class="header-content">
                        <h3>${this.escapeHtml(subscription.channelTitle)}</h3>
                        <p class="channel-description">${this.escapeHtml(subscription.description || '')}</p>
                        <div class="channel-metrics">
                            <div class="metric">
                                <span class="metric-value">${this.formatCount(subscription.subscriberCount)}</span>
                                <span class="metric-label">Subscribers</span>
                            </div>
                            <div class="metric">
                                <span class="metric-value">${this.formatCount(subscription.videoCount)}</span>
                                <span class="metric-label">Videos</span>
                            </div>
                            <div class="metric">
                                <span class="metric-value">${Math.round(subscription.uploadsPerWeek * 10) / 10}</span>
                                <span class="metric-label">Videos/Week</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="info-sections">
                    <div class="info-section">
                        <h4>🏷️ Organization</h4>
                        <div class="organization-controls">
                            <div class="control-group">
                                <label>Priority:</label>
                                <select id="channel-priority-select">
                                    <option value="low" ${subscription.priority === 'low' ? 'selected' : ''}>Low</option>
                                    <option value="normal" ${subscription.priority === 'normal' ? 'selected' : ''}>Normal</option>
                                    <option value="high" ${subscription.priority === 'high' ? 'selected' : ''}>High</option>
                                </select>
                            </div>
                            <div class="control-group">
                                <label>Tags:</label>
                                <div class="tags-input">
                                    ${subscription.tags.map(tag => `
                                        <span class="tag removable" data-tag="${tag}">
                                            ${tag} <button class="remove-tag">×</button>
                                        </span>
                                    `).join('')}
                                    <input type="text" id="add-tag-input" placeholder="Add tag...">
                                </div>
                            </div>
                            <div class="control-group">
                                <label>Collections:</label>
                                <div class="collections-select">
                                    ${Array.from(this.collections.values()).map(collection => `
                                        <label class="collection-checkbox">
                                            <input type="checkbox" value="${collection.id}" 
                                                   ${subscription.collections.includes(collection.name) ? 'checked' : ''}>
                                            <span>${collection.name}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="info-section">
                        <h4>🔔 Notifications</h4>
                        <div class="notification-controls">
                            <label class="notification-option">
                                <input type="checkbox" ${subscription.notifications.newVideos ? 'checked' : ''}>
                                <span>New Videos</span>
                            </label>
                            <label class="notification-option">
                                <input type="checkbox" ${subscription.notifications.livestreams ? 'checked' : ''}>
                                <span>Livestreams</span>
                            </label>
                            <label class="notification-option">
                                <input type="checkbox" ${subscription.notifications.communityPosts ? 'checked' : ''}>
                                <span>Community Posts</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="info-section">
                        <h4>📊 Analytics</h4>
                        <div class="analytics-summary">
                            <div class="analytic-item">
                                <span class="analytic-label">Watch Time:</span>
                                <span class="analytic-value">${this.formatDuration(analytics.totalWatchTime)}</span>
                            </div>
                            <div class="analytic-item">
                                <span class="analytic-label">Videos Watched:</span>
                                <span class="analytic-value">${analytics.videosWatched}</span>
                            </div>
                            <div class="analytic-item">
                                <span class="analytic-label">Avg. Watch Time:</span>
                                <span class="analytic-value">${this.formatDuration(analytics.averageWatchTime)}</span>
                            </div>
                            <div class="analytic-item">
                                <span class="analytic-label">Last Watched:</span>
                                <span class="analytic-value">
                                    ${analytics.lastVideoWatched ? 
                                        this.formatRelativeDate(analytics.lastVideoWatched) : 
                                        'Never'
                                    }
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Helper Methods
    getFilteredAndSortedSubscriptions() {
        let subscriptions = Array.from(this.subscriptions.values());
        
        // Apply search filter
        if (this.state.searchQuery) {
            const query = this.state.searchQuery.toLowerCase();
            subscriptions = subscriptions.filter(sub => 
                sub.channelTitle.toLowerCase().includes(query) ||
                sub.description.toLowerCase().includes(query) ||
                sub.tags.some(tag => tag.toLowerCase().includes(query))
            );
        }
        
        // Apply other filters
        subscriptions = subscriptions.filter(sub => {
            if (this.state.filterBy.activity !== 'all') {
                const isActive = this.isActiveChannel(sub);
                if (this.state.filterBy.activity === 'active' && !isActive) return false;
                if (this.state.filterBy.activity === 'inactive' && isActive) return false;
            }
            
            if (this.state.filterBy.uploadFrequency !== 'all') {
                const frequency = sub.uploadsPerWeek || 0;
                switch (this.state.filterBy.uploadFrequency) {
                    case 'frequent': return frequency >= 3;
                    case 'moderate': return frequency >= 0.5 && frequency < 3;
                    case 'rare': return frequency < 0.5;
                }
            }
            
            return true;
        });
        
        // Apply sorting
        subscriptions.sort((a, b) => {
            let valueA, valueB;
            
            switch (this.state.sortBy) {
                case 'name':
                    valueA = a.channelTitle.toLowerCase();
                    valueB = b.channelTitle.toLowerCase();
                    break;
                case 'subscribers':
                    valueA = a.subscriberCount || 0;
                    valueB = b.subscriberCount || 0;
                    break;
                case 'activity':
                    valueA = a.lastUploadDate ? new Date(a.lastUploadDate) : new Date(0);
                    valueB = b.lastUploadDate ? new Date(b.lastUploadDate) : new Date(0);
                    break;
                case 'priority':
                    const priorities = { high: 3, normal: 2, low: 1 };
                    valueA = priorities[a.priority] || 2;
                    valueB = priorities[b.priority] || 2;
                    break;
                default:
                    return 0;
            }
            
            if (valueA < valueB) return this.state.sortOrder === 'asc' ? -1 : 1;
            if (valueA > valueB) return this.state.sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        
        return subscriptions;
    }

    analyzeChannel(channelId) {
        const subscription = this.subscriptions.get(channelId);
        if (!subscription) return null;
        
        return {
            totalWatchTime: subscription.statistics?.totalWatchTime || 0,
            videosWatched: subscription.statistics?.videosWatched || 0,
            averageWatchTime: subscription.statistics?.averageWatchTime || 0,
            lastVideoWatched: subscription.statistics?.lastVideoWatched
        };
    }

    startBackgroundTasks() {
        // Start periodic refresh
        this.refreshTimer = setInterval(() => {
            this.loadData();
        }, this.config.refreshInterval);
        
        // Start notification checking
        this.notificationTimer = setInterval(() => {
            this.checkForNotifications();
        }, 2 * 60 * 1000); // Check every 2 minutes
    }

    // Event Handlers
    setupSubscriptionPageEvents(container) {
        // Filter button
        container.querySelector('#sub-filter-btn')?.addEventListener('click', () => {
            const panel = container.querySelector('.sub-panel-content');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });
        
        // Filter changes
        const filters = container.querySelectorAll('select');
        filters.forEach(filter => {
            filter.addEventListener('change', () => {
                this.applySubscriptionPageFilters();
            });
        });
        
        // Bulk operations
        container.querySelector('#bulk-tag-btn')?.addEventListener('click', () => {
            this.showBulkTagDialog();
        });
        
        container.querySelector('#bulk-collect-btn')?.addEventListener('click', () => {
            this.showBulkCollectionDialog();
        });
        
        container.querySelector('#export-subs-btn')?.addEventListener('click', () => {
            this.exportSubscriptions();
        });
    }

    setupChannelPageEvents(container, channelId) {
        // Priority change
        container.querySelector('#channel-priority')?.addEventListener('change', (e) => {
            this.updateSubscriptionPriority(channelId, e.target.value);
        });
        
        // Tool buttons
        container.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.id.replace('-btn', '').replace('channel-', '').replace('-', '_');
                this.handleChannelTool(channelId, action);
            });
        });
    }

    handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'openSubscriptionManager':
                this.showSubscriptionManager();
                sendResponse({ success: true });
                break;
                
            case 'refreshSubscriptions':
                this.loadData();
                sendResponse({ success: true });
                break;
                
            case 'getSubscriptionStats':
                sendResponse({ success: true, data: this.analytics });
                break;
        }
    }

    handleKeyboardShortcut(event) {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 's':
                    if (event.shiftKey) {
                        event.preventDefault();
                        this.showSubscriptionManager();
                    }
                    break;
            }
        }
    }

    // Utility methods
    extractChannelId(url) {
        if (!url) return null;
        const match = url.match(/\/channel\/([^\/\?]+)/);
        return match ? match[1] : null;
    }

    extractChannelIdFromUrl() {
        const path = window.location.pathname;
        const match = path.match(/\/channel\/([^\/]+)/) || path.match(/\/@([^\/]+)/);
        return match ? match[1] : null;
    }

    formatCount(count) {
        if (!count) return '0';
        if (count < 1000) return count.toString();
        if (count < 1000000) return (count / 1000).toFixed(1) + 'K';
        return (count / 1000000).toFixed(1) + 'M';
    }

    formatDuration(seconds) {
        if (!seconds) return '0s';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m ${secs}s`;
        return `${secs}s`;
    }

    formatRelativeDate(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        if (days < 365) return `${Math.floor(days / 30)} months ago`;
        return `${Math.floor(days / 365)} years ago`;
    }

    getUploadFrequencyText(uploadsPerWeek) {
        if (!uploadsPerWeek) return 'Rarely';
        if (uploadsPerWeek >= 7) return 'Daily';
        if (uploadsPerWeek >= 3) return 'Frequent';
        if (uploadsPerWeek >= 1) return 'Weekly';
        if (uploadsPerWeek >= 0.25) return 'Monthly';
        return 'Rarely';
    }

    generateCategoryColor(category) {
        const colors = {
            'Gaming': '#4CAF50',
            'Technology': '#2196F3',
            'Music': '#E91E63',
            'Education': '#FF9800',
            'Entertainment': '#9C27B0',
            'News': '#F44336',
            'Sports': '#00BCD4',
            'Comedy': '#FFEB3B'
        };
        return colors[category] || '#757575';
    }

    getCategoryIcon(category) {
        const icons = {
            'Gaming': '🎮',
            'Technology': '💻',
            'Music': '🎵',
            'Education': '📚',
            'Entertainment': '🎭',
            'News': '📰',
            'Sports': '⚽',
            'Comedy': '😂'
        };
        return icons[category] || '📁';
    }

    getFrequencyFromName(name) {
        const mapping = {
            'Daily Uploaders': 'daily',
            'Weekly Uploaders': 'weekly',
            'Monthly Uploaders': 'monthly',
            'Rare Uploaders': 'rare'
        };
        return mapping[name];
    }

    getFrequencyColor(name) {
        const colors = {
            'Daily Uploaders': '#4CAF50',
            'Weekly Uploaders': '#2196F3',
            'Monthly Uploaders': '#FF9800',
            'Rare Uploaders': '#9E9E9E'
        };
        return colors[name] || '#757575';
    }

    getFrequencyIcon(name) {
        const icons = {
            'Daily Uploaders': '📅',
            'Weekly Uploaders': '📆',
            'Monthly Uploaders': '🗓️',
            'Rare Uploaders': '⏰'
        };
        return icons[name] || '📁';
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
    }

    handleError(message, error) {
        console.error(`❌ ${message}:`, error);
        this.setState({ error: message });
    }

    trackActivity(type, data) {
        chrome.runtime.sendMessage({
            action: 'trackActivity',
            activity: {
                type,
                data,
                timestamp: Date.now()
            }
        }).catch(error => {
            console.error('❌ Failed to track activity:', error);
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async saveSubscriptionData(channelId, subscription) {
        return chrome.runtime.sendMessage({
            action: 'updateSubscription',
            channelId,
            data: subscription
        });
    }

    async saveTagData(tagName, tagData) {
        return chrome.runtime.sendMessage({
            action: 'updateSubscriptionTag',
            tag: tagName,
            data: tagData
        });
    }

    createDialog(id, config) {
        // Implementation for creating modal dialogs
        // Return dialog element
    }

    showDialog(dialog) {
        // Implementation for showing modal dialogs
    }

    // Cleanup
    destroy() {
        console.log('🧹 Cleaning up Subscription Manager...');
        
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
        
        if (this.notificationTimer) {
            clearInterval(this.notificationTimer);
        }
        
        this.eventHandlers.clear();
        this.isInitialized = false;
    }
}

// Auto-initialize if on YouTube
if (window.location.hostname.includes('youtube.com')) {
    const subscriptionManager = new AstralTubeSubscriptionManager();
    
    // Make globally available
    window.astralTubeSubscriptionManager = subscriptionManager;
}