/**
 * AstralTube v3 - Advanced Playlist Manager
 * Comprehensive playlist management with advanced features
 */

import { eventManager } from '../lib/event-manager.js';

export class AstralTubePlaylistManager {
    constructor() {
        this.isInitialized = false;
        this.playlists = new Map();
        this.customPlaylists = new Map();
        this.playlistCache = new Map();
        this.searchIndex = new Map();
        
        // Configuration
        this.config = {
            maxPlaylistsPerPage: 50,
            maxVideosPerPlaylist: 5000,
            searchDebounceMs: 300,
            autoSaveInterval: 30000, // 30 seconds
            bulkOperationBatchSize: 25,
            thumbnailCacheSize: 100,
            enableOfflineSupport: true,
            smartPlaylistFeatures: true
        };
        
        // State management
        this.state = {
            currentView: 'overview', // overview, playlist, create, edit
            selectedPlaylist: null,
            selectedVideos: new Set(),
            searchQuery: '',
            sortBy: 'title',
            sortOrder: 'asc',
            filterBy: 'all',
            isLoading: false,
            error: null,
            hasUnsavedChanges: false,
            draggedItem: null,
            lastSync: null
        };
        
        // Smart playlist configurations
        this.smartPlaylistTypes = {
            recentlyAdded: {
                name: 'Recently Added',
                icon: '🆕',
                query: (videos) => videos.filter(v => Date.now() - v.dateAdded < 7 * 24 * 60 * 60 * 1000),
                sortBy: 'dateAdded',
                sortOrder: 'desc'
            },
            mostViewed: {
                name: 'Most Viewed',
                icon: '👁️',
                query: (videos) => videos.filter(v => v.viewCount > 1000000),
                sortBy: 'viewCount',
                sortOrder: 'desc'
            },
            longVideos: {
                name: 'Long Videos (>20 min)',
                icon: '🎬',
                query: (videos) => videos.filter(v => v.duration > 1200),
                sortBy: 'duration',
                sortOrder: 'desc'
            },
            unwatched: {
                name: 'Unwatched',
                icon: '📺',
                query: (videos) => videos.filter(v => !v.watched),
                sortBy: 'dateAdded',
                sortOrder: 'desc'
            },
            favorites: {
                name: 'Favorites',
                icon: '⭐',
                query: (videos) => videos.filter(v => v.favorite),
                sortBy: 'title',
                sortOrder: 'asc'
            }
        };
        
        // Event handlers - using scoped event manager
        this.eventScope = eventManager.createScope('playlist-manager');
        this.eventHandlers = new Map();
        this.searchDebounceTimer = null;
        this.autoSaveTimer = null;
        
        this.init();
    }

    async init() {
        try {
            console.log('🎵 Initializing AstralTube Playlist Manager...');
            
            // Load existing playlists and settings
            await this.loadData();
            
            // Setup search index
            this.buildSearchIndex();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Start auto-save timer
            this.startAutoSave();
            
            this.isInitialized = true;
            console.log('✅ AstralTube Playlist Manager initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize playlist manager:', error);
            this.handleError('Initialization failed', error);
        }
    }

    async loadData() {
        try {
            this.setState({ isLoading: true });
            
            // Load YouTube playlists
            const ytPlaylistsResponse = await chrome.runtime.sendMessage({
                action: 'getPlaylists'
            });
            
            if (ytPlaylistsResponse?.success) {
                for (const playlist of ytPlaylistsResponse.data) {
                    this.playlists.set(playlist.id, {
                        ...playlist,
                        type: 'youtube',
                        source: 'youtube'
                    });
                }
            }
            
            // Load custom playlists
            const customPlaylistsResponse = await chrome.runtime.sendMessage({
                action: 'getCustomPlaylists'
            });
            
            if (customPlaylistsResponse?.success) {
                for (const playlist of customPlaylistsResponse.data) {
                    this.customPlaylists.set(playlist.id, {
                        ...playlist,
                        type: 'custom',
                        source: 'astraltube'
                    });
                }
            }
            
            // Generate smart playlists
            await this.generateSmartPlaylists();
            
            this.setState({ 
                isLoading: false, 
                lastSync: Date.now() 
            });
            
        } catch (error) {
            console.error('❌ Failed to load playlist data:', error);
            this.setState({ isLoading: false, error: error.message });
        }
    }

    async generateSmartPlaylists() {
        try {
            // Get all videos from all playlists
            const allVideos = [];
            for (const playlist of this.playlists.values()) {
                if (playlist.videos) {
                    allVideos.push(...playlist.videos.map(v => ({
                        ...v,
                        sourcePlaylistId: playlist.id
                    })));
                }
            }
            
            // Generate smart playlists
            for (const [id, config] of Object.entries(this.smartPlaylistTypes)) {
                const filteredVideos = config.query(allVideos);
                const sortedVideos = this.sortVideos(filteredVideos, config.sortBy, config.sortOrder);
                
                const smartPlaylist = {
                    id: `smart_${id}`,
                    title: config.name,
                    description: `Automatically generated ${config.name.toLowerCase()} playlist`,
                    thumbnail: filteredVideos[0]?.thumbnail || '',
                    type: 'smart',
                    source: 'astraltube',
                    icon: config.icon,
                    videos: sortedVideos.slice(0, 100), // Limit to 100 videos
                    videoCount: sortedVideos.length,
                    privacy: 'private',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    isAutoGenerated: true
                };
                
                this.customPlaylists.set(smartPlaylist.id, smartPlaylist);
            }
            
        } catch (error) {
            console.error('❌ Failed to generate smart playlists:', error);
        }
    }

    buildSearchIndex() {
        try {
            this.searchIndex.clear();
            
            const allPlaylists = [
                ...this.playlists.values(),
                ...this.customPlaylists.values()
            ];
            
            for (const playlist of allPlaylists) {
                // Index playlist metadata
                const searchText = [
                    playlist.title,
                    playlist.description,
                    playlist.channelTitle
                ].filter(Boolean).join(' ').toLowerCase();
                
                this.searchIndex.set(playlist.id, {
                    type: 'playlist',
                    data: playlist,
                    searchText: searchText,
                    keywords: searchText.split(/\s+/)
                });
                
                // Index videos in playlist
                if (playlist.videos) {
                    for (const video of playlist.videos) {
                        const videoSearchText = [
                            video.title,
                            video.description,
                            video.channelTitle,
                            video.tags?.join(' ')
                        ].filter(Boolean).join(' ').toLowerCase();
                        
                        this.searchIndex.set(`${playlist.id}_${video.videoId}`, {
                            type: 'video',
                            playlistId: playlist.id,
                            data: video,
                            searchText: videoSearchText,
                            keywords: videoSearchText.split(/\s+/)
                        });
                    }
                }
            }
            
        } catch (error) {
            console.error('❌ Failed to build search index:', error);
        }
    }

    setupEventListeners() {
        // Global message listener
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });
        
        // YouTube page events
        this.observeYouTubeChanges();
        
        // Keyboard shortcuts - using event manager with error handling
        this.eventScope.on(document, 'keydown', (e) => this.handleKeyboardShortcut(e), {
            catchErrors: true,
            monitor: 'keyboard-shortcuts'
        });
        
        // Setup drag and drop functionality
        this.setupDragAndDrop();
    }

    observeYouTubeChanges() {
        // Observe for YouTube page changes to inject playlist management UI
        const observer = new MutationObserver(() => {
            this.injectPlaylistControls();
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Initial injection
        setTimeout(() => this.injectPlaylistControls(), 1000);
    }

    injectPlaylistControls() {
        try {
            // Inject on video pages
            if (window.location.pathname === '/watch') {
                this.injectVideoPageControls();
            }
            
            // Inject on playlist pages
            if (window.location.pathname === '/playlist') {
                this.injectPlaylistPageControls();
            }
            
            // Inject on channel pages
            if (window.location.pathname.startsWith('/channel') || 
                window.location.pathname.startsWith('/@')) {
                this.injectChannelPageControls();
            }
            
        } catch (error) {
            console.error('❌ Failed to inject playlist controls:', error);
        }
    }

    // Comprehensive Drag-and-Drop Implementation
    setupDragAndDrop() {
        console.log('🎯 Setting up drag-and-drop functionality...');
        
        // Set up global drop zones for playlist items
        this.createGlobalDropZones();
        
        // Enable drag on existing playlist items
        this.enableDragOnExistingItems();
        
        // Setup drag visual feedback system
        this.setupDragVisualFeedback();
        
        console.log('✅ Drag-and-drop functionality initialized');
    }

    createGlobalDropZones() {
        // Create floating drop zones for playlists
        const dropZoneContainer = document.createElement('div');
        dropZoneContainer.id = 'astraltube-drop-zones';
        dropZoneContainer.className = 'astraltube-drop-zones hidden';
        dropZoneContainer.innerHTML = `
            <div class="drop-zone-header">
                <h3>Drop video here to add to playlist</h3>
                <button class="drop-zone-close">×</button>
            </div>
            <div class="drop-zone-list" id="drop-zone-list">
                <!-- Playlist drop zones will be populated here -->
            </div>
        `;
        
        // Style the drop zones
        dropZoneContainer.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 2px dashed #ccc;
            border-radius: 12px;
            padding: 20px;
            z-index: 10000;
            max-width: 400px;
            max-height: 500px;
            overflow-y: auto;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        `;
        
        // Append to body
        document.body.appendChild(dropZoneContainer);
        
        // Setup close button with event manager
        const closeBtn = dropZoneContainer.querySelector('.drop-zone-close');
        this.eventScope.on(closeBtn, 'click', () => {
            this.hideDragDropZones();
        }, { catchErrors: true });
        
        this.dropZoneContainer = dropZoneContainer;
    }

    enableDragOnExistingItems() {
        // Observe for new video items and make them draggable
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this.makeDraggableIfVideo(node);
                        // Also check child nodes
                        const videoElements = node.querySelectorAll?.(
                            'ytd-video-renderer, ytd-compact-video-renderer, ytd-playlist-video-renderer, .ytd-thumbnail'
                        );
                        videoElements?.forEach(el => this.makeDraggableIfVideo(el));
                    }
                });
            });
        });
        
        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Enable drag on existing video elements
        this.enableDragOnCurrentVideoItems();
    }

    enableDragOnCurrentVideoItems() {
        // Find all video thumbnail elements and make them draggable
        const videoSelectors = [
            'ytd-video-renderer',
            'ytd-compact-video-renderer', 
            'ytd-playlist-video-renderer',
            'ytd-grid-video-renderer',
            '.ytd-thumbnail',
            '#movie_player'
        ];
        
        videoSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => this.makeDraggableIfVideo(el));
        });
    }

    makeDraggableIfVideo(element) {
        if (!element || element.hasAttribute('astraltube-draggable')) return;
        
        // Extract video information
        const videoInfo = this.extractVideoInfo(element);
        if (!videoInfo) return;
        
        // Make element draggable
        element.setAttribute('draggable', 'true');
        element.setAttribute('astraltube-draggable', 'true');
        element.style.cursor = 'grab';
        
        // Add drag event listeners with event manager
        this.eventScope.on(element, 'dragstart', (e) => {
            this.handleDragStart(e, videoInfo);
        }, { catchErrors: true });
        
        this.eventScope.on(element, 'dragend', (e) => {
            this.handleDragEnd(e);
        }, { catchErrors: true });
        
        // Visual feedback on hover with event manager
        this.eventScope.on(element, 'mouseenter', (e) => {
            if (!this.state.draggedItem) {
                element.style.opacity = '0.8';
                element.style.transform = 'scale(0.98)';
                element.style.transition = 'all 0.2s ease';
            }
        }, { catchErrors: true });
        
        this.eventScope.on(element, 'mouseleave', (e) => {
            if (!this.state.draggedItem) {
                element.style.opacity = '';
                element.style.transform = '';
                element.style.transition = '';
            }
        }, { catchErrors: true });
    }

    extractVideoInfo(element) {
        try {
            // Try different methods to extract video info
            let videoId = null;
            let title = null;
            let thumbnail = null;
            let duration = null;
            let channelName = null;
            
            // Method 1: From href/link
            const linkElement = element.querySelector('a[href*="/watch"]') || element.closest('a[href*="/watch"]');
            if (linkElement) {
                const url = new URL(linkElement.href, window.location.origin);
                videoId = url.searchParams.get('v');
            }
            
            // Method 2: From current playing video
            if (!videoId && window.location.pathname === '/watch') {
                const urlParams = new URLSearchParams(window.location.search);
                videoId = urlParams.get('v');
            }
            
            // Method 3: From data attributes
            if (!videoId) {
                const videoRenderer = element.closest('[data-video-id]');
                if (videoRenderer) {
                    videoId = videoRenderer.getAttribute('data-video-id');
                }
            }
            
            if (!videoId) return null;
            
            // Extract title
            const titleSelectors = [
                '#video-title', 
                '.ytd-video-meta-block #video-title',
                'h3 a[href*="/watch"]',
                '.video-title',
                '#container h1'
            ];
            
            for (const selector of titleSelectors) {
                const titleEl = element.querySelector(selector) || document.querySelector(selector);
                if (titleEl) {
                    title = titleEl.textContent?.trim() || titleEl.getAttribute('title')?.trim();
                    if (title) break;
                }
            }
            
            // Extract thumbnail
            const thumbnailEl = element.querySelector('img') || element.closest('*').querySelector('img');
            if (thumbnailEl) {
                thumbnail = thumbnailEl.src || thumbnailEl.getAttribute('data-src');
            }
            
            // Extract duration
            const durationEl = element.querySelector('.ytd-thumbnail-overlay-time-status-renderer') ||
                             element.querySelector('.video-time') ||
                             element.querySelector('[data-duration]');
            if (durationEl) {
                duration = durationEl.textContent?.trim() || durationEl.getAttribute('data-duration');
            }
            
            // Extract channel name
            const channelSelectors = [
                '.ytd-video-meta-block .ytd-channel-name a',
                '.byline a',
                '#channel-name a',
                '.channel-name'
            ];
            
            for (const selector of channelSelectors) {
                const channelEl = element.querySelector(selector) || document.querySelector(selector);
                if (channelEl) {
                    channelName = channelEl.textContent?.trim();
                    if (channelName) break;
                }
            }
            
            return {
                id: videoId,
                title: title || 'Unknown Video',
                thumbnail: thumbnail,
                duration: duration,
                channelName: channelName,
                url: `https://www.youtube.com/watch?v=${videoId}`,
                extractedAt: Date.now()
            };
            
        } catch (error) {
            console.error('❌ Failed to extract video info:', error);
            return null;
        }
    }

    handleDragStart(event, videoInfo) {
        console.log('🎯 Drag started for video:', videoInfo.title);
        
        // Store dragged item info
        this.state.draggedItem = videoInfo;
        
        // Set drag data
        event.dataTransfer.setData('text/plain', JSON.stringify(videoInfo));
        event.dataTransfer.setData('application/x-astraltube-video', videoInfo.id);
        event.dataTransfer.effectAllowed = 'copy';
        
        // Visual feedback
        event.target.style.opacity = '0.5';
        event.target.style.transform = 'rotate(5deg)';
        
        // Show drop zones after small delay
        setTimeout(() => {
            this.showDragDropZones();
        }, 100);
        
        // Track drag event
        this.trackAnalytics('drag_start', {
            videoId: videoInfo.id,
            videoTitle: videoInfo.title
        });
    }

    handleDragEnd(event) {
        console.log('🎯 Drag ended');
        
        // Reset visual state
        event.target.style.opacity = '';
        event.target.style.transform = '';
        
        // Hide drop zones
        setTimeout(() => {
            this.hideDragDropZones();
        }, 100);
        
        // Clear dragged item
        this.state.draggedItem = null;
    }

    async showDragDropZones() {
        if (!this.dropZoneContainer) return;
        
        // Populate with current playlists
        await this.populateDropZones();
        
        // Show the container
        this.dropZoneContainer.classList.remove('hidden');
        this.dropZoneContainer.style.display = 'block';
        
        // Animate in
        requestAnimationFrame(() => {
            this.dropZoneContainer.style.opacity = '0';
            this.dropZoneContainer.style.transform = 'translate(-50%, -50%) scale(0.8)';
            this.dropZoneContainer.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            
            requestAnimationFrame(() => {
                this.dropZoneContainer.style.opacity = '1';
                this.dropZoneContainer.style.transform = 'translate(-50%, -50%) scale(1)';
            });
        });
    }

    hideDragDropZones() {
        if (!this.dropZoneContainer) return;
        
        // Animate out
        this.dropZoneContainer.style.opacity = '0';
        this.dropZoneContainer.style.transform = 'translate(-50%, -50%) scale(0.8)';
        
        setTimeout(() => {
            this.dropZoneContainer.style.display = 'none';
            this.dropZoneContainer.classList.add('hidden');
        }, 300);
    }

    async populateDropZones() {
        const dropZoneList = this.dropZoneContainer.querySelector('#drop-zone-list');
        if (!dropZoneList) return;
        
        // Clear existing zones
        dropZoneList.innerHTML = '';
        
        // Add all available playlists as drop zones
        const allPlaylists = [...this.playlists.values(), ...this.customPlaylists.values()];
        
        for (const playlist of allPlaylists) {
            const dropZone = document.createElement('div');
            dropZone.className = 'playlist-drop-zone';
            dropZone.dataset.playlistId = playlist.id;
            dropZone.dataset.playlistType = playlist.type;
            
            dropZone.innerHTML = `
                <div class="playlist-icon">
                    ${playlist.type === 'youtube' ? '📺' : '📝'}
                </div>
                <div class="playlist-info">
                    <div class="playlist-title">${playlist.title}</div>
                    <div class="playlist-meta">${playlist.itemCount || 0} videos</div>
                </div>
                <div class="drop-indicator">+</div>
            `;
            
            // Style the drop zone
            dropZone.style.cssText = `
                display: flex;
                align-items: center;
                padding: 12px;
                margin: 8px 0;
                border: 2px dashed #ddd;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
                background: #f9f9f9;
            `;
            
            // Setup drop zone events
            this.setupDropZoneEvents(dropZone, playlist);
            
            dropZoneList.appendChild(dropZone);
        }
        
        // Add "Create New Playlist" option
        const createNewZone = document.createElement('div');
        createNewZone.className = 'playlist-drop-zone create-new';
        createNewZone.innerHTML = `
            <div class="playlist-icon">✨</div>
            <div class="playlist-info">
                <div class="playlist-title">Create New Playlist</div>
                <div class="playlist-meta">Add to a new playlist</div>
            </div>
            <div class="drop-indicator">+</div>
        `;
        
        createNewZone.style.cssText = `
            display: flex;
            align-items: center;
            padding: 12px;
            margin: 8px 0;
            border: 2px dashed #4285f4;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            background: #f0f8ff;
        `;
        
        this.setupCreateNewPlaylistDropZone(createNewZone);
        dropZoneList.appendChild(createNewZone);
    }

    setupDropZoneEvents(dropZone, playlist) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            
            // Visual feedback
            dropZone.style.borderColor = '#4285f4';
            dropZone.style.backgroundColor = '#e3f2fd';
            dropZone.style.transform = 'scale(1.02)';
        });
        
        dropZone.addEventListener('dragleave', (e) => {
            // Reset visual state
            dropZone.style.borderColor = '#ddd';
            dropZone.style.backgroundColor = '#f9f9f9';
            dropZone.style.transform = 'scale(1)';
        });
        
        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            
            // Reset visual state
            dropZone.style.borderColor = '#ddd';
            dropZone.style.backgroundColor = '#f9f9f9';
            dropZone.style.transform = 'scale(1)';
            
            // Get dropped video info
            const videoData = e.dataTransfer.getData('text/plain');
            let videoInfo;
            
            try {
                videoInfo = JSON.parse(videoData);
            } catch (error) {
                videoInfo = this.state.draggedItem;
            }
            
            if (videoInfo) {
                await this.addVideoToPlaylist(playlist, videoInfo);
                this.hideDragDropZones();
            }
        });
        
        // Click handler as alternative to drag-and-drop
        dropZone.addEventListener('click', async (e) => {
            if (this.state.draggedItem) {
                await this.addVideoToPlaylist(playlist, this.state.draggedItem);
                this.hideDragDropZones();
            }
        });
    }

    setupCreateNewPlaylistDropZone(dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            
            dropZone.style.borderColor = '#4285f4';
            dropZone.style.backgroundColor = '#e8f4fd';
            dropZone.style.transform = 'scale(1.02)';
        });
        
        dropZone.addEventListener('dragleave', (e) => {
            dropZone.style.borderColor = '#4285f4';
            dropZone.style.backgroundColor = '#f0f8ff';
            dropZone.style.transform = 'scale(1)';
        });
        
        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            
            // Reset visual state
            dropZone.style.borderColor = '#4285f4';
            dropZone.style.backgroundColor = '#f0f8ff';
            dropZone.style.transform = 'scale(1)';
            
            const videoData = e.dataTransfer.getData('text/plain');
            let videoInfo;
            
            try {
                videoInfo = JSON.parse(videoData);
            } catch (error) {
                videoInfo = this.state.draggedItem;
            }
            
            if (videoInfo) {
                await this.createNewPlaylistWithVideo(videoInfo);
                this.hideDragDropZones();
            }
        });
        
        dropZone.addEventListener('click', async (e) => {
            if (this.state.draggedItem) {
                await this.createNewPlaylistWithVideo(this.state.draggedItem);
                this.hideDragDropZones();
            }
        });
    }

    async addVideoToPlaylist(playlist, videoInfo) {
        try {
            console.log(`🎵 Adding video "${videoInfo.title}" to playlist "${playlist.title}"`);
            
            // Show loading feedback
            this.showNotification(`Adding "${videoInfo.title}" to "${playlist.title}"...`, 'info');
            
            // Add to YouTube playlist or custom playlist
            let result;
            if (playlist.type === 'youtube') {
                result = await chrome.runtime.sendMessage({
                    action: 'addVideoToYouTubePlaylist',
                    playlistId: playlist.id,
                    videoId: videoInfo.id
                });
            } else {
                result = await chrome.runtime.sendMessage({
                    action: 'addVideoToCustomPlaylist',
                    playlistId: playlist.id,
                    videoInfo: videoInfo
                });
            }
            
            if (result?.success) {
                this.showNotification(`✅ Added "${videoInfo.title}" to "${playlist.title}"`, 'success');
                
                // Update playlist item count
                if (playlist.itemCount !== undefined) {
                    playlist.itemCount++;
                }
                
                // Track success
                this.trackAnalytics('video_added_to_playlist', {
                    playlistId: playlist.id,
                    playlistType: playlist.type,
                    videoId: videoInfo.id,
                    method: 'drag_and_drop'
                });
            } else {
                throw new Error(result?.error || 'Failed to add video to playlist');
            }
            
        } catch (error) {
            console.error('❌ Failed to add video to playlist:', error);
            this.showNotification(`❌ Failed to add video: ${error.message}`, 'error');
            
            // Track error
            this.trackAnalytics('video_add_failed', {
                playlistId: playlist.id,
                videoId: videoInfo.id,
                error: error.message
            });
        }
    }

    async createNewPlaylistWithVideo(videoInfo) {
        try {
            console.log(`🆕 Creating new playlist with video: ${videoInfo.title}`);
            
            // Prompt for playlist name
            const playlistName = prompt(`Create new playlist with "${videoInfo.title}".\n\nPlaylist name:`, `My Playlist - ${new Date().toLocaleDateString()}`);
            
            if (!playlistName) return;
            
            this.showNotification(`Creating playlist "${playlistName}"...`, 'info');
            
            // Create playlist
            const createResult = await chrome.runtime.sendMessage({
                action: 'createPlaylist',
                data: {
                    title: playlistName,
                    description: `Created with AstralTube on ${new Date().toLocaleDateString()}`,
                    privacy: 'private'
                }
            });
            
            if (createResult?.success) {
                const newPlaylist = createResult.data;
                
                // Add video to the new playlist
                await this.addVideoToPlaylist(newPlaylist, videoInfo);
                
                // Update local playlists
                this.playlists.set(newPlaylist.id, {
                    ...newPlaylist,
                    type: 'youtube',
                    source: 'youtube'
                });
                
                this.trackAnalytics('playlist_created_with_video', {
                    playlistId: newPlaylist.id,
                    videoId: videoInfo.id,
                    method: 'drag_and_drop'
                });
            } else {
                throw new Error(createResult?.error || 'Failed to create playlist');
            }
            
        } catch (error) {
            console.error('❌ Failed to create playlist with video:', error);
            this.showNotification(`❌ Failed to create playlist: ${error.message}`, 'error');
        }
    }

    setupDragVisualFeedback() {
        // Create drag ghost/preview element
        const dragGhost = document.createElement('div');
        dragGhost.id = 'astraltube-drag-ghost';
        dragGhost.style.cssText = `
            position: fixed;
            top: -1000px;
            left: -1000px;
            pointer-events: none;
            z-index: 10001;
            background: white;
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            max-width: 200px;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 12px;
        `;
        document.body.appendChild(dragGhost);
        
        // Update ghost position during drag
        document.addEventListener('dragover', (e) => {
            if (this.state.draggedItem) {
                dragGhost.style.top = (e.clientY + 10) + 'px';
                dragGhost.style.left = (e.clientX + 10) + 'px';
                
                if (!dragGhost.innerHTML) {
                    dragGhost.innerHTML = `
                        <div style="font-weight: bold; margin-bottom: 4px;">
                            🎵 ${this.state.draggedItem.title}
                        </div>
                        <div style="color: #666; font-size: 10px;">
                            Drop on playlist to add
                        </div>
                    `;
                }
            }
        });
        
        // Hide ghost when not dragging
        document.addEventListener('dragend', () => {
            dragGhost.style.top = '-1000px';
            dragGhost.innerHTML = '';
        });
    }

    injectVideoPageControls() {
        // Add video to playlist button
        const actionsContainer = document.querySelector('#actions');
        if (actionsContainer && !document.querySelector('#astraltube-add-to-playlist')) {
            const addButton = document.createElement('button');
            addButton.id = 'astraltube-add-to-playlist';
            addButton.className = 'astraltube-add-btn';
            addButton.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z"/>
                </svg>
                <span>Add to Playlist</span>
            `;
            
            addButton.addEventListener('click', () => {
                this.showAddToPlaylistDialog();
            });
            
            // Insert after like/dislike buttons
            const likeButton = actionsContainer.querySelector('ytd-toggle-button-renderer');
            if (likeButton) {
                likeButton.parentNode.insertBefore(addButton, likeButton.nextSibling);
            }
        }
        
        // Add quick playlist creation
        this.injectQuickPlaylistButton();
    }

    injectQuickPlaylistButton() {
        const masthead = document.querySelector('#masthead');
        if (masthead && !document.querySelector('#astraltube-quick-playlist')) {
            const quickButton = document.createElement('button');
            quickButton.id = 'astraltube-quick-playlist';
            quickButton.className = 'astraltube-quick-btn';
            quickButton.title = 'Quick Playlist Manager';
            quickButton.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
                </svg>
            `;
            
            quickButton.addEventListener('click', () => {
                this.showQuickPlaylistManager();
            });
            
            // Insert into masthead
            const endContainer = masthead.querySelector('#end');
            if (endContainer) {
                endContainer.insertBefore(quickButton, endContainer.firstChild);
            }
        }
    }

    injectPlaylistPageControls() {
        // Enhanced playlist management on playlist pages
        const playlistHeader = document.querySelector('ytd-playlist-header-renderer');
        if (playlistHeader && !document.querySelector('#astraltube-playlist-tools')) {
            const toolsContainer = document.createElement('div');
            toolsContainer.id = 'astraltube-playlist-tools';
            toolsContainer.className = 'astraltube-tools-container';
            toolsContainer.innerHTML = `
                <button class="playlist-tool-btn" data-action="export">
                    <svg width="20" height="20" fill="currentColor">
                        <path d="M14 2H6a2 2 0 00-2 2v16l4-4h6a2 2 0 002-2V4a2 2 0 00-2-2z"/>
                    </svg>
                    Export
                </button>
                <button class="playlist-tool-btn" data-action="analyze">
                    <svg width="20" height="20" fill="currentColor">
                        <path d="M3 3v18l18-9L3 3z"/>
                    </svg>
                    Analyze
                </button>
                <button class="playlist-tool-btn" data-action="optimize">
                    <svg width="20" height="20" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9l-5 4.87L18.18 22 12 18.77 5.82 22 7 13.87 2 9l6.91-.74L12 2z"/>
                    </svg>
                    Optimize
                </button>
            `;
            
            playlistHeader.appendChild(toolsContainer);
            
            // Add event listeners
            toolsContainer.addEventListener('click', (e) => {
                const action = e.target.closest('[data-action]')?.dataset.action;
                if (action) {
                    this.handlePlaylistTool(action);
                }
            });
        }
    }

    injectChannelPageControls() {
        // Add channel playlist organization tools
        const channelHeader = document.querySelector('ytd-c4-tabbed-header-renderer');
        if (channelHeader && !document.querySelector('#astraltube-channel-tools')) {
            // Implementation for channel-specific playlist tools
        }
    }

    // Playlist Management Methods
    async createPlaylist(config) {
        try {
            this.setState({ isLoading: true });
            
            const playlistData = {
                id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                title: config.title,
                description: config.description || '',
                privacy: config.privacy || 'private',
                type: 'custom',
                source: 'astraltube',
                videos: [],
                videoCount: 0,
                thumbnail: config.thumbnail || '',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                tags: config.tags || [],
                category: config.category || 'general',
                isSmartPlaylist: config.isSmartPlaylist || false,
                smartRules: config.smartRules || null
            };
            
            // Save to storage
            const response = await chrome.runtime.sendMessage({
                action: 'createCustomPlaylist',
                data: playlistData
            });
            
            if (response?.success) {
                this.customPlaylists.set(playlistData.id, playlistData);
                this.buildSearchIndex(); // Update search index
                
                // Track activity
                this.trackActivity('playlist_created', {
                    playlistId: playlistData.id,
                    title: playlistData.title
                });
                
                this.setState({ 
                    isLoading: false,
                    hasUnsavedChanges: false 
                });
                
                console.log('✅ Playlist created:', playlistData.title);
                return playlistData;
            } else {
                throw new Error(response?.error || 'Failed to create playlist');
            }
            
        } catch (error) {
            console.error('❌ Failed to create playlist:', error);
            this.setState({ isLoading: false });
            this.handleError('Failed to create playlist', error);
            throw error;
        }
    }

    async updatePlaylist(playlistId, updates) {
        try {
            const playlist = this.getPlaylist(playlistId);
            if (!playlist) {
                throw new Error('Playlist not found');
            }
            
            const updatedPlaylist = {
                ...playlist,
                ...updates,
                updatedAt: Date.now()
            };
            
            // Save to appropriate storage
            const response = await chrome.runtime.sendMessage({
                action: playlist.source === 'youtube' ? 'updateYouTubePlaylist' : 'updateCustomPlaylist',
                data: updatedPlaylist
            });
            
            if (response?.success) {
                // Update local cache
                if (playlist.source === 'youtube') {
                    this.playlists.set(playlistId, updatedPlaylist);
                } else {
                    this.customPlaylists.set(playlistId, updatedPlaylist);
                }
                
                this.buildSearchIndex(); // Update search index
                this.setState({ hasUnsavedChanges: false });
                
                console.log('✅ Playlist updated:', updatedPlaylist.title);
                return updatedPlaylist;
            } else {
                throw new Error(response?.error || 'Failed to update playlist');
            }
            
        } catch (error) {
            console.error('❌ Failed to update playlist:', error);
            this.handleError('Failed to update playlist', error);
            throw error;
        }
    }

    async deletePlaylist(playlistId) {
        try {
            const playlist = this.getPlaylist(playlistId);
            if (!playlist) {
                throw new Error('Playlist not found');
            }
            
            // Only allow deletion of custom playlists
            if (playlist.source !== 'astraltube') {
                throw new Error('Cannot delete YouTube playlists from AstralTube');
            }
            
            const response = await chrome.runtime.sendMessage({
                action: 'deleteCustomPlaylist',
                playlistId: playlistId
            });
            
            if (response?.success) {
                this.customPlaylists.delete(playlistId);
                this.buildSearchIndex();
                
                // Track activity
                this.trackActivity('playlist_deleted', {
                    playlistId: playlistId,
                    title: playlist.title
                });
                
                console.log('✅ Playlist deleted:', playlist.title);
                return true;
            } else {
                throw new Error(response?.error || 'Failed to delete playlist');
            }
            
        } catch (error) {
            console.error('❌ Failed to delete playlist:', error);
            this.handleError('Failed to delete playlist', error);
            throw error;
        }
    }

    async addVideoToPlaylist(playlistId, video) {
        try {
            const playlist = this.getPlaylist(playlistId);
            if (!playlist) {
                throw new Error('Playlist not found');
            }
            
            // Check if video already exists
            const existingVideo = playlist.videos?.find(v => v.videoId === video.videoId);
            if (existingVideo) {
                throw new Error('Video already in playlist');
            }
            
            const videoData = {
                videoId: video.videoId,
                title: video.title,
                description: video.description,
                thumbnail: video.thumbnail,
                channelTitle: video.channelTitle,
                channelId: video.channelId,
                duration: video.duration,
                publishedAt: video.publishedAt,
                addedAt: Date.now(),
                position: playlist.videos?.length || 0
            };
            
            const response = await chrome.runtime.sendMessage({
                action: playlist.source === 'youtube' ? 'addToYouTubePlaylist' : 'addToCustomPlaylist',
                playlistId: playlistId,
                video: videoData
            });
            
            if (response?.success) {
                // Update local cache
                if (!playlist.videos) playlist.videos = [];
                playlist.videos.push(videoData);
                playlist.videoCount = playlist.videos.length;
                playlist.updatedAt = Date.now();
                
                this.buildSearchIndex();
                
                // Track activity
                this.trackActivity('video_added', {
                    playlistId: playlistId,
                    videoId: video.videoId,
                    videoTitle: video.title
                });
                
                console.log('✅ Video added to playlist');
                return true;
            } else {
                throw new Error(response?.error || 'Failed to add video');
            }
            
        } catch (error) {
            console.error('❌ Failed to add video to playlist:', error);
            this.handleError('Failed to add video', error);
            throw error;
        }
    }

    async removeVideoFromPlaylist(playlistId, videoId) {
        try {
            const playlist = this.getPlaylist(playlistId);
            if (!playlist || !playlist.videos) {
                throw new Error('Playlist or video not found');
            }
            
            const videoIndex = playlist.videos.findIndex(v => v.videoId === videoId);
            if (videoIndex === -1) {
                throw new Error('Video not found in playlist');
            }
            
            const video = playlist.videos[videoIndex];
            
            const response = await chrome.runtime.sendMessage({
                action: playlist.source === 'youtube' ? 'removeFromYouTubePlaylist' : 'removeFromCustomPlaylist',
                playlistId: playlistId,
                videoId: videoId
            });
            
            if (response?.success) {
                // Update local cache
                playlist.videos.splice(videoIndex, 1);
                playlist.videoCount = playlist.videos.length;
                playlist.updatedAt = Date.now();
                
                this.buildSearchIndex();
                
                // Track activity
                this.trackActivity('video_removed', {
                    playlistId: playlistId,
                    videoId: videoId,
                    videoTitle: video.title
                });
                
                console.log('✅ Video removed from playlist');
                return true;
            } else {
                throw new Error(response?.error || 'Failed to remove video');
            }
            
        } catch (error) {
            console.error('❌ Failed to remove video from playlist:', error);
            this.handleError('Failed to remove video', error);
            throw error;
        }
    }

    async reorderPlaylistVideos(playlistId, fromIndex, toIndex) {
        try {
            const playlist = this.getPlaylist(playlistId);
            if (!playlist || !playlist.videos) {
                throw new Error('Playlist not found');
            }
            
            const videos = [...playlist.videos];
            const movedVideo = videos.splice(fromIndex, 1)[0];
            videos.splice(toIndex, 0, movedVideo);
            
            // Update positions
            videos.forEach((video, index) => {
                video.position = index;
            });
            
            const response = await chrome.runtime.sendMessage({
                action: playlist.source === 'youtube' ? 'reorderYouTubePlaylist' : 'reorderCustomPlaylist',
                playlistId: playlistId,
                videos: videos
            });
            
            if (response?.success) {
                playlist.videos = videos;
                playlist.updatedAt = Date.now();
                
                console.log('✅ Playlist reordered');
                return true;
            } else {
                throw new Error(response?.error || 'Failed to reorder playlist');
            }
            
        } catch (error) {
            console.error('❌ Failed to reorder playlist:', error);
            this.handleError('Failed to reorder playlist', error);
            throw error;
        }
    }

    // Bulk Operations
    async bulkAddVideos(playlistId, videos) {
        try {
            this.setState({ isLoading: true });
            
            const batches = this.chunkArray(videos, this.config.bulkOperationBatchSize);
            const results = [];
            
            for (const batch of batches) {
                const batchPromises = batch.map(video => 
                    this.addVideoToPlaylist(playlistId, video)
                        .then(() => ({ success: true, video }))
                        .catch(error => ({ success: false, video, error }))
                );
                
                const batchResults = await Promise.allSettled(batchPromises);
                results.push(...batchResults);
                
                // Small delay between batches to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const successful = results.filter(r => r.value?.success).length;
            const failed = results.filter(r => !r.value?.success).length;
            
            this.setState({ isLoading: false });
            
            console.log(`✅ Bulk add completed: ${successful} successful, ${failed} failed`);
            return { successful, failed, results };
            
        } catch (error) {
            console.error('❌ Bulk add operation failed:', error);
            this.setState({ isLoading: false });
            throw error;
        }
    }

    async bulkRemoveVideos(playlistId, videoIds) {
        try {
            this.setState({ isLoading: true });
            
            const batches = this.chunkArray(videoIds, this.config.bulkOperationBatchSize);
            const results = [];
            
            for (const batch of batches) {
                const batchPromises = batch.map(videoId => 
                    this.removeVideoFromPlaylist(playlistId, videoId)
                        .then(() => ({ success: true, videoId }))
                        .catch(error => ({ success: false, videoId, error }))
                );
                
                const batchResults = await Promise.allSettled(batchPromises);
                results.push(...batchResults);
                
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const successful = results.filter(r => r.value?.success).length;
            const failed = results.filter(r => !r.value?.success).length;
            
            this.setState({ isLoading: false });
            
            console.log(`✅ Bulk remove completed: ${successful} successful, ${failed} failed`);
            return { successful, failed, results };
            
        } catch (error) {
            console.error('❌ Bulk remove operation failed:', error);
            this.setState({ isLoading: false });
            throw error;
        }
    }

    // Search and Filter Methods
    searchPlaylists(query) {
        if (!query.trim()) {
            return this.getAllPlaylists();
        }
        
        const searchTerms = query.toLowerCase().split(/\s+/);
        const results = [];
        
        for (const [id, indexEntry] of this.searchIndex.entries()) {
            if (indexEntry.type === 'playlist') {
                const score = this.calculateSearchScore(searchTerms, indexEntry.keywords);
                if (score > 0) {
                    results.push({
                        ...indexEntry.data,
                        searchScore: score
                    });
                }
            }
        }
        
        return results.sort((a, b) => b.searchScore - a.searchScore);
    }

    searchVideosInPlaylists(query) {
        if (!query.trim()) return [];
        
        const searchTerms = query.toLowerCase().split(/\s+/);
        const results = [];
        
        for (const [id, indexEntry] of this.searchIndex.entries()) {
            if (indexEntry.type === 'video') {
                const score = this.calculateSearchScore(searchTerms, indexEntry.keywords);
                if (score > 0) {
                    results.push({
                        ...indexEntry.data,
                        playlistId: indexEntry.playlistId,
                        searchScore: score
                    });
                }
            }
        }
        
        return results.sort((a, b) => b.searchScore - a.searchScore);
    }

    calculateSearchScore(searchTerms, keywords) {
        let score = 0;
        
        for (const term of searchTerms) {
            for (const keyword of keywords) {
                if (keyword.includes(term)) {
                    score += keyword === term ? 10 : 5; // Exact match vs partial match
                }
            }
        }
        
        return score;
    }

    filterPlaylists(criteria) {
        const playlists = this.getAllPlaylists();
        
        return playlists.filter(playlist => {
            if (criteria.type && playlist.type !== criteria.type) return false;
            if (criteria.source && playlist.source !== criteria.source) return false;
            if (criteria.privacy && playlist.privacy !== criteria.privacy) return false;
            if (criteria.minVideos && (playlist.videoCount || 0) < criteria.minVideos) return false;
            if (criteria.maxVideos && (playlist.videoCount || 0) > criteria.maxVideos) return false;
            if (criteria.category && playlist.category !== criteria.category) return false;
            if (criteria.tags && criteria.tags.length > 0) {
                const playlistTags = playlist.tags || [];
                if (!criteria.tags.some(tag => playlistTags.includes(tag))) return false;
            }
            
            return true;
        });
    }

    sortPlaylists(playlists, sortBy = 'title', order = 'asc') {
        const sorted = [...playlists].sort((a, b) => {
            let valueA, valueB;
            
            switch (sortBy) {
                case 'title':
                    valueA = (a.title || '').toLowerCase();
                    valueB = (b.title || '').toLowerCase();
                    break;
                case 'created':
                    valueA = a.createdAt || 0;
                    valueB = b.createdAt || 0;
                    break;
                case 'updated':
                    valueA = a.updatedAt || 0;
                    valueB = b.updatedAt || 0;
                    break;
                case 'videoCount':
                    valueA = a.videoCount || 0;
                    valueB = b.videoCount || 0;
                    break;
                case 'duration':
                    valueA = this.calculateTotalDuration(a);
                    valueB = this.calculateTotalDuration(b);
                    break;
                default:
                    return 0;
            }
            
            if (valueA < valueB) return order === 'asc' ? -1 : 1;
            if (valueA > valueB) return order === 'asc' ? 1 : -1;
            return 0;
        });
        
        return sorted;
    }

    sortVideos(videos, sortBy = 'position', order = 'asc') {
        return [...videos].sort((a, b) => {
            let valueA, valueB;
            
            switch (sortBy) {
                case 'title':
                    valueA = (a.title || '').toLowerCase();
                    valueB = (b.title || '').toLowerCase();
                    break;
                case 'duration':
                    valueA = a.duration || 0;
                    valueB = b.duration || 0;
                    break;
                case 'publishedAt':
                    valueA = new Date(a.publishedAt || 0).getTime();
                    valueB = new Date(b.publishedAt || 0).getTime();
                    break;
                case 'addedAt':
                    valueA = a.addedAt || 0;
                    valueB = b.addedAt || 0;
                    break;
                case 'viewCount':
                    valueA = a.viewCount || 0;
                    valueB = b.viewCount || 0;
                    break;
                case 'position':
                default:
                    valueA = a.position || 0;
                    valueB = b.position || 0;
                    break;
            }
            
            if (valueA < valueB) return order === 'asc' ? -1 : 1;
            if (valueA > valueB) return order === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // Analytics and Insights
    analyzePlaylist(playlistId) {
        const playlist = this.getPlaylist(playlistId);
        if (!playlist || !playlist.videos) {
            return null;
        }
        
        const videos = playlist.videos;
        const analysis = {
            totalVideos: videos.length,
            totalDuration: videos.reduce((sum, v) => sum + (v.duration || 0), 0),
            averageDuration: videos.length ? videos.reduce((sum, v) => sum + (v.duration || 0), 0) / videos.length : 0,
            channels: {},
            categories: {},
            publishDateRange: {
                earliest: null,
                latest: null
            },
            duplicates: [],
            quality: {
                score: 0,
                issues: []
            }
        };
        
        // Analyze channels
        for (const video of videos) {
            const channel = video.channelTitle || 'Unknown';
            analysis.channels[channel] = (analysis.channels[channel] || 0) + 1;
        }
        
        // Find date range
        const publishDates = videos
            .map(v => v.publishedAt ? new Date(v.publishedAt) : null)
            .filter(Boolean)
            .sort((a, b) => a.getTime() - b.getTime());
        
        if (publishDates.length > 0) {
            analysis.publishDateRange.earliest = publishDates[0];
            analysis.publishDateRange.latest = publishDates[publishDates.length - 1];
        }
        
        // Find duplicates
        const videoIds = new Set();
        const duplicateIds = new Set();
        for (const video of videos) {
            if (videoIds.has(video.videoId)) {
                duplicateIds.add(video.videoId);
            } else {
                videoIds.add(video.videoId);
            }
        }
        analysis.duplicates = Array.from(duplicateIds);
        
        // Quality analysis
        let qualityScore = 100;
        if (analysis.duplicates.length > 0) {
            analysis.quality.issues.push(`${analysis.duplicates.length} duplicate videos found`);
            qualityScore -= analysis.duplicates.length * 5;
        }
        
        const missingThumbnails = videos.filter(v => !v.thumbnail).length;
        if (missingThumbnails > 0) {
            analysis.quality.issues.push(`${missingThumbnails} videos missing thumbnails`);
            qualityScore -= missingThumbnails * 2;
        }
        
        const missingDescriptions = videos.filter(v => !v.description).length;
        if (missingDescriptions > videos.length * 0.5) {
            analysis.quality.issues.push('Many videos missing descriptions');
            qualityScore -= 10;
        }
        
        analysis.quality.score = Math.max(0, qualityScore);
        
        return analysis;
    }

    // UI Methods
    showAddToPlaylistDialog(videoData = null) {
        // Get current video if none provided
        if (!videoData) {
            videoData = this.getCurrentVideoData();
        }
        
        if (!videoData) {
            this.showError('No video data available');
            return;
        }
        
        // Create dialog
        const dialog = this.createDialog('add-to-playlist', {
            title: 'Add to Playlist',
            content: this.renderAddToPlaylistForm(videoData),
            actions: [
                { text: 'Cancel', action: 'close' },
                { text: 'Add to Playlist', action: 'add', primary: true }
            ]
        });
        
        this.showDialog(dialog);
    }

    showQuickPlaylistManager() {
        const dialog = this.createDialog('quick-playlist-manager', {
            title: 'Playlist Manager',
            content: this.renderQuickPlaylistManager(),
            size: 'large',
            actions: [
                { text: 'Close', action: 'close' }
            ]
        });
        
        this.showDialog(dialog);
    }

    renderAddToPlaylistForm(videoData) {
        const playlists = this.getAllPlaylists()
            .filter(p => p.type === 'custom' || p.source === 'youtube')
            .sort((a, b) => a.title.localeCompare(b.title));
        
        return `
            <div class="add-to-playlist-form">
                <div class="video-preview">
                    <img src="${videoData.thumbnail}" alt="${videoData.title}">
                    <div class="video-info">
                        <h4>${this.escapeHtml(videoData.title)}</h4>
                        <p>${this.escapeHtml(videoData.channelTitle)}</p>
                    </div>
                </div>
                
                <div class="playlist-selection">
                    <h5>Select Playlists:</h5>
                    <div class="playlist-list">
                        ${playlists.map(playlist => `
                            <label class="playlist-option">
                                <input type="checkbox" value="${playlist.id}">
                                <span class="playlist-name">${this.escapeHtml(playlist.title)}</span>
                                <span class="playlist-count">${playlist.videoCount || 0} videos</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
                
                <div class="create-new-playlist">
                    <label>
                        <input type="checkbox" id="create-new-playlist-check">
                        Create new playlist
                    </label>
                    <div id="new-playlist-form" style="display: none;">
                        <input type="text" id="new-playlist-title" placeholder="Playlist title">
                        <textarea id="new-playlist-description" placeholder="Description (optional)"></textarea>
                        <select id="new-playlist-privacy">
                            <option value="private">Private</option>
                            <option value="unlisted">Unlisted</option>
                            <option value="public">Public</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }

    renderQuickPlaylistManager() {
        const recentPlaylists = this.getAllPlaylists()
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            .slice(0, 10);
        
        const smartPlaylists = Array.from(this.customPlaylists.values())
            .filter(p => p.type === 'smart');
        
        return `
            <div class="quick-playlist-manager">
                <div class="manager-tabs">
                    <button class="tab-btn active" data-tab="recent">Recent</button>
                    <button class="tab-btn" data-tab="smart">Smart</button>
                    <button class="tab-btn" data-tab="all">All</button>
                </div>
                
                <div class="tab-content active" data-tab="recent">
                    <div class="playlist-grid">
                        ${recentPlaylists.map(playlist => `
                            <div class="playlist-card" data-playlist-id="${playlist.id}">
                                <img src="${playlist.thumbnail}" alt="${playlist.title}">
                                <div class="playlist-info">
                                    <h4>${this.escapeHtml(playlist.title)}</h4>
                                    <p>${playlist.videoCount || 0} videos</p>
                                </div>
                                <div class="playlist-actions">
                                    <button data-action="edit">Edit</button>
                                    <button data-action="analyze">Analyze</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="tab-content" data-tab="smart">
                    <div class="smart-playlists">
                        ${smartPlaylists.map(playlist => `
                            <div class="smart-playlist-card" data-playlist-id="${playlist.id}">
                                <div class="playlist-icon">${playlist.icon}</div>
                                <div class="playlist-info">
                                    <h4>${this.escapeHtml(playlist.title)}</h4>
                                    <p>${playlist.videoCount || 0} videos • Auto-generated</p>
                                </div>
                                <button class="refresh-btn" data-action="refresh">↻</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="tab-content" data-tab="all">
                    <div class="playlist-search">
                        <input type="text" placeholder="Search playlists..." id="playlist-search">
                        <div class="filter-controls">
                            <select id="playlist-filter-type">
                                <option value="all">All Types</option>
                                <option value="youtube">YouTube</option>
                                <option value="custom">Custom</option>
                                <option value="smart">Smart</option>
                            </select>
                            <select id="playlist-sort">
                                <option value="title">Title A-Z</option>
                                <option value="updated">Recently Updated</option>
                                <option value="created">Recently Created</option>
                                <option value="videoCount">Video Count</option>
                            </select>
                        </div>
                    </div>
                    <div id="all-playlists-container">
                        <!-- Populated dynamically -->
                    </div>
                </div>
            </div>
        `;
    }

    // Helper Methods
    getPlaylist(playlistId) {
        return this.playlists.get(playlistId) || this.customPlaylists.get(playlistId);
    }

    getAllPlaylists() {
        return [
            ...this.playlists.values(),
            ...this.customPlaylists.values()
        ];
    }

    getCurrentVideoData() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const videoId = urlParams.get('v');
            
            if (!videoId) return null;
            
            // Extract video data from page
            const title = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim();
            const channelTitle = document.querySelector('#channel-name a')?.textContent?.trim();
            const description = document.querySelector('#description-text')?.textContent?.trim();
            
            // Get thumbnail
            const thumbnail = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
            
            return {
                videoId,
                title: title || 'Unknown Title',
                channelTitle: channelTitle || 'Unknown Channel',
                description: description || '',
                thumbnail,
                duration: null, // Would need to parse from page
                publishedAt: null // Would need to parse from page
            };
        } catch (error) {
            console.error('❌ Failed to get current video data:', error);
            return null;
        }
    }

    calculateTotalDuration(playlist) {
        if (!playlist.videos) return 0;
        return playlist.videos.reduce((total, video) => total + (video.duration || 0), 0);
    }

    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    startAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        
        this.autoSaveTimer = setInterval(() => {
            if (this.state.hasUnsavedChanges) {
                this.saveChanges();
            }
        }, this.config.autoSaveInterval);
    }

    async saveChanges() {
        try {
            // Save any pending changes
            // Implementation depends on what changes need to be saved
            this.setState({ hasUnsavedChanges: false });
        } catch (error) {
            console.error('❌ Auto-save failed:', error);
        }
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

    // Event Handlers
    handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'openPlaylistManager':
                this.showQuickPlaylistManager();
                sendResponse({ success: true });
                break;
                
            case 'addToPlaylist':
                this.showAddToPlaylistDialog(message.videoData);
                sendResponse({ success: true });
                break;
                
            case 'refreshPlaylists':
                this.loadData();
                sendResponse({ success: true });
                break;
        }
    }

    handleKeyboardShortcut(event) {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 'p':
                    if (event.shiftKey) {
                        event.preventDefault();
                        this.showQuickPlaylistManager();
                    }
                    break;
                case 'a':
                    if (event.shiftKey && window.location.pathname === '/watch') {
                        event.preventDefault();
                        this.showAddToPlaylistDialog();
                    }
                    break;
            }
        }
    }

    handlePlaylistTool(action) {
        const currentPlaylistId = this.getCurrentPlaylistId();
        if (!currentPlaylistId) return;
        
        switch (action) {
            case 'export':
                this.exportPlaylist(currentPlaylistId);
                break;
            case 'analyze':
                this.showPlaylistAnalysis(currentPlaylistId);
                break;
            case 'optimize':
                this.showPlaylistOptimization(currentPlaylistId);
                break;
        }
    }

    getCurrentPlaylistId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('list');
    }

    // Utility Methods
    setState(newState) {
        this.state = { ...this.state, ...newState };
    }

    handleError(message, error) {
        console.error(`❌ ${message}:`, error);
        this.setState({ error: message });
        // Show user-friendly error notification
    }

    showError(message) {
        // Implementation for showing error to user
        console.error(message);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    createDialog(id, config) {
        // Implementation for creating modal dialogs
        // This would create and return a dialog element
    }

    showDialog(dialog) {
        // Implementation for showing modal dialogs
        // This would add the dialog to the page and handle events
    }

    // Notification and Analytics Methods for Drag-and-Drop
    showNotification(message, type = 'info') {
        try {
            // Create notification element if not exists
            let notificationContainer = document.getElementById('astraltube-notifications');
            if (!notificationContainer) {
                notificationContainer = document.createElement('div');
                notificationContainer.id = 'astraltube-notifications';
                notificationContainer.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10002;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    pointer-events: none;
                `;
                document.body.appendChild(notificationContainer);
            }

            // Create notification
            const notification = document.createElement('div');
            notification.className = `astraltube-notification astraltube-notification-${type}`;
            notification.style.cssText = `
                background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                font-size: 14px;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: auto;
                max-width: 300px;
                word-wrap: break-word;
            `;
            notification.textContent = message;

            notificationContainer.appendChild(notification);

            // Animate in
            requestAnimationFrame(() => {
                notification.style.opacity = '1';
                notification.style.transform = 'translateX(0)';
            });

            // Auto-remove after delay
            const duration = type === 'error' ? 6000 : 3000;
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, duration);

        } catch (error) {
            console.error('❌ Failed to show notification:', error);
            // Fallback to console
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    trackAnalytics(eventName, properties = {}) {
        try {
            // Send analytics event to background script
            chrome.runtime.sendMessage({
                action: 'trackEvent',
                event: `playlist_manager_${eventName}`,
                properties: {
                    ...properties,
                    timestamp: Date.now(),
                    userAgent: navigator.userAgent,
                    url: window.location.href
                }
            }).catch(error => {
                console.warn('❌ Failed to track analytics:', error);
            });
        } catch (error) {
            console.warn('❌ Failed to track analytics:', error);
        }
    }

    // Cleanup
    destroy() {
        console.log('🧹 Cleaning up Playlist Manager...');
        
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
        }
        
        // Clean up all event handlers using scoped event manager
        if (this.eventScope) {
            this.eventScope.removeAll();
        }
        
        this.eventHandlers.clear();
        this.isInitialized = false;
    }
}

// Auto-initialize if on YouTube
if (window.location.hostname.includes('youtube.com')) {
    const playlistManager = new AstralTubePlaylistManager();
    
    // Make globally available
    window.astralTubePlaylistManager = playlistManager;
}