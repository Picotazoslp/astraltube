/**
 * AstralTube v3 - API Manager
 * Handles all YouTube API interactions and data management
 */

import { apiLogger as logger } from './logger.js';

export class AstralTubeAPI {
    constructor() {
        this.baseURL = 'https://www.googleapis.com/youtube/v3';
        this.apiKey = null;
        this.accessToken = null;
        this.rateLimiter = new RateLimiter();
        this.cache = new Map();
        this.initialized = false;
    }

    async initialize() {
        try {
            // Get stored API credentials
            const result = await chrome.storage.local.get(['apiKey', 'accessToken']);
            this.apiKey = result.apiKey;
            this.accessToken = result.accessToken;

            // Initialize OAuth if needed
            if (!this.accessToken) {
                await this.initializeOAuth();
            }

            this.initialized = true;
            logger.info('AstralTube API initialized');
        } catch (error) {
            logger.error('Failed to initialize API', error);
            logger.warn('API initialization failed, some features may not work');
            // Mark as initialized anyway to prevent blocking the extension
            this.initialized = true;
        }
    }

    async initializeOAuth() {
        try {
            // Check if OAuth is configured in manifest
            const manifest = chrome.runtime.getManifest();
            if (!manifest.oauth2 || !manifest.oauth2.client_id) {
                console.warn('⚠️ OAuth2 not configured in manifest, skipping OAuth initialization');
                return;
            }

            const token = await chrome.identity.getAuthToken({ interactive: true });
            this.accessToken = token;
            await chrome.storage.local.set({ accessToken: token });
            logger.info('OAuth token obtained');
        } catch (error) {
            logger.error('OAuth initialization failed', error);
            logger.warn('Continuing without OAuth - some features may be limited');
            // Don't throw error, allow extension to continue without OAuth
        }
    }

    async makeRequest(endpoint, options = {}) {
        if (!this.initialized) {
            throw new Error('API not initialized');
        }

        // Apply rate limiting
        await this.rateLimiter.waitForToken();

        const url = new URL(`${this.baseURL}${endpoint}`);
        
        // Add API key to all requests
        url.searchParams.set('key', this.apiKey || 'AIzaSyDummy_Key_For_Development');
        
        // Add additional parameters
        if (options.params) {
            Object.entries(options.params).forEach(([key, value]) => {
                url.searchParams.set(key, value);
            });
        }

        const requestOptions = {
            method: options.method || 'GET',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        if (options.body) {
            requestOptions.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url.toString(), requestOptions);
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('❌ API request failed:', error);
            throw error;
        }
    }

    // Playlist Management
    async getPlaylists() {
        try {
            const cacheKey = 'playlists';
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const response = await this.makeRequest('/playlists', {
                params: {
                    part: 'snippet,contentDetails,status',
                    mine: 'true',
                    maxResults: 50
                }
            });

            const playlists = response.items.map(item => ({
                id: item.id,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnail: item.snippet.thumbnails?.medium?.url || '',
                itemCount: item.contentDetails.itemCount,
                privacy: item.status.privacyStatus,
                createdAt: new Date(item.snippet.publishedAt).getTime(),
                updatedAt: Date.now()
            }));

            this.cache.set(cacheKey, playlists);
            setTimeout(() => this.cache.delete(cacheKey), 300000); // 5 minute cache

            return playlists;
        } catch (error) {
            console.error('❌ Failed to get playlists:', error);
            return [];
        }
    }

    async createPlaylist(playlistData) {
        try {
            const response = await this.makeRequest('/playlists', {
                method: 'POST',
                params: {
                    part: 'snippet,status'
                },
                body: {
                    snippet: {
                        title: playlistData.title,
                        description: playlistData.description || ''
                    },
                    status: {
                        privacyStatus: playlistData.privacy || 'private'
                    }
                }
            });

            const playlist = {
                id: response.id,
                title: response.snippet.title,
                description: response.snippet.description,
                thumbnail: response.snippet.thumbnails?.medium?.url || '',
                itemCount: 0,
                privacy: response.status.privacyStatus,
                createdAt: new Date(response.snippet.publishedAt).getTime(),
                updatedAt: Date.now()
            };

            // Clear cache to force refresh
            this.cache.delete('playlists');

            return playlist;
        } catch (error) {
            console.error('❌ Failed to create playlist:', error);
            throw error;
        }
    }

    async getPlaylistItems(playlistId) {
        try {
            const cacheKey = `playlist_items_${playlistId}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const response = await this.makeRequest('/playlistItems', {
                params: {
                    part: 'snippet,contentDetails',
                    playlistId: playlistId,
                    maxResults: 50
                }
            });

            const items = response.items.map(item => ({
                id: item.id,
                videoId: item.snippet.resourceId.videoId,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnail: item.snippet.thumbnails?.medium?.url || '',
                position: item.snippet.position,
                addedAt: new Date(item.snippet.publishedAt).getTime()
            }));

            this.cache.set(cacheKey, items);
            setTimeout(() => this.cache.delete(cacheKey), 300000); // 5 minute cache

            return items;
        } catch (error) {
            console.error('❌ Failed to get playlist items:', error);
            return [];
        }
    }

    // Subscription Management
    async getSubscriptions() {
        try {
            const cacheKey = 'subscriptions';
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const response = await this.makeRequest('/subscriptions', {
                params: {
                    part: 'snippet,contentDetails',
                    mine: 'true',
                    maxResults: 50
                }
            });

            const subscriptions = response.items.map(item => ({
                id: item.id,
                channelId: item.snippet.resourceId.channelId,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnail: item.snippet.thumbnails?.medium?.url || '',
                subscribedAt: new Date(item.snippet.publishedAt).getTime(),
                totalItemCount: item.contentDetails.totalItemCount || 0
            }));

            this.cache.set(cacheKey, subscriptions);
            setTimeout(() => this.cache.delete(cacheKey), 300000); // 5 minute cache

            return subscriptions;
        } catch (error) {
            console.error('❌ Failed to get subscriptions:', error);
            return [];
        }
    }

    async getChannelInfo(channelId) {
        try {
            const cacheKey = `channel_${channelId}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const response = await this.makeRequest('/channels', {
                params: {
                    part: 'snippet,statistics,contentDetails',
                    id: channelId
                }
            });

            if (response.items.length === 0) {
                return null;
            }

            const channel = response.items[0];
            const channelInfo = {
                id: channel.id,
                title: channel.snippet.title,
                description: channel.snippet.description,
                thumbnail: channel.snippet.thumbnails?.medium?.url || '',
                subscriberCount: parseInt(channel.statistics.subscriberCount) || 0,
                videoCount: parseInt(channel.statistics.videoCount) || 0,
                viewCount: parseInt(channel.statistics.viewCount) || 0,
                uploadsPlaylistId: channel.contentDetails.relatedPlaylists.uploads,
                createdAt: new Date(channel.snippet.publishedAt).getTime()
            };

            this.cache.set(cacheKey, channelInfo);
            setTimeout(() => this.cache.delete(cacheKey), 600000); // 10 minute cache

            return channelInfo;
        } catch (error) {
            console.error('❌ Failed to get channel info:', error);
            return null;
        }
    }

    async getChannelVideos(channelId, maxResults = 10) {
        try {
            const channelInfo = await this.getChannelInfo(channelId);
            if (!channelInfo || !channelInfo.uploadsPlaylistId) {
                return [];
            }

            const response = await this.makeRequest('/playlistItems', {
                params: {
                    part: 'snippet,contentDetails',
                    playlistId: channelInfo.uploadsPlaylistId,
                    maxResults: maxResults
                }
            });

            return response.items.map(item => ({
                id: item.snippet.resourceId.videoId,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnail: item.snippet.thumbnails?.medium?.url || '',
                publishedAt: new Date(item.snippet.publishedAt).getTime(),
                channelId: channelId,
                channelTitle: item.snippet.channelTitle
            }));
        } catch (error) {
            console.error('❌ Failed to get channel videos:', error);
            return [];
        }
    }

    // Video Management
    async getVideoDetails(videoIds) {
        try {
            if (!Array.isArray(videoIds)) {
                videoIds = [videoIds];
            }

            const response = await this.makeRequest('/videos', {
                params: {
                    part: 'snippet,contentDetails,statistics',
                    id: videoIds.join(',')
                }
            });

            return response.items.map(item => ({
                id: item.id,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnail: item.snippet.thumbnails?.medium?.url || '',
                duration: item.contentDetails.duration,
                viewCount: parseInt(item.statistics.viewCount) || 0,
                likeCount: parseInt(item.statistics.likeCount) || 0,
                publishedAt: new Date(item.snippet.publishedAt).getTime(),
                channelId: item.snippet.channelId,
                channelTitle: item.snippet.channelTitle
            }));
        } catch (error) {
            console.error('❌ Failed to get video details:', error);
            return [];
        }
    }

    async calculatePlaylistDuration(playlistId) {
        try {
            const items = await this.getPlaylistItems(playlistId);
            const videoIds = items.map(item => item.videoId);
            
            if (videoIds.length === 0) {
                return { totalDuration: 0, totalVideos: 0, averageDuration: 0 };
            }

            // Process in batches of 50 (API limit)
            const batchSize = 50;
            let totalSeconds = 0;
            let validVideos = 0;

            for (let i = 0; i < videoIds.length; i += batchSize) {
                const batch = videoIds.slice(i, i + batchSize);
                const videos = await this.getVideoDetails(batch);
                
                videos.forEach(video => {
                    const duration = this.parseDuration(video.duration);
                    if (duration > 0) {
                        totalSeconds += duration;
                        validVideos++;
                    }
                });
            }

            return {
                totalDuration: totalSeconds,
                totalVideos: validVideos,
                averageDuration: validVideos > 0 ? Math.round(totalSeconds / validVideos) : 0,
                formattedDuration: this.formatDuration(totalSeconds)
            };
        } catch (error) {
            console.error('❌ Failed to calculate playlist duration:', error);
            return { totalDuration: 0, totalVideos: 0, averageDuration: 0 };
        }
    }

    // Data Synchronization
    async syncData() {
        try {
            console.log('🔄 Starting data sync...');
            
            // Clear all caches to force fresh data
            this.cache.clear();
            
            // Sync playlists and subscriptions in parallel
            const [playlists, subscriptions] = await Promise.all([
                this.getPlaylists(),
                this.getSubscriptions()
            ]);

            // Store sync timestamp
            await chrome.storage.local.set({
                lastSync: Date.now(),
                syncedPlaylists: playlists.length,
                syncedSubscriptions: subscriptions.length
            });

            console.log('✅ Data sync completed:', {
                playlists: playlists.length,
                subscriptions: subscriptions.length
            });

            return {
                playlists,
                subscriptions,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('❌ Data sync failed:', error);
            throw error;
        }
    }

    // Utility Methods
    parseDuration(duration) {
        // Parse ISO 8601 duration (PT4M13S) to seconds
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return 0;
        
        const hours = parseInt(match[1]) || 0;
        const minutes = parseInt(match[2]) || 0;
        const seconds = parseInt(match[3]) || 0;
        
        return hours * 3600 + minutes * 60 + seconds;
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    // Health Check
    async checkAPIHealth() {
        try {
            // Simple quota check
            const response = await this.makeRequest('/channels', {
                params: {
                    part: 'snippet',
                    mine: 'true'
                }
            });

            return {
                status: 'healthy',
                quotaUsed: response.quotaUsed || 0,
                timestamp: Date.now()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: Date.now()
            };
        }
    }
}

// Rate Limiter Class
class RateLimiter {
    constructor(requestsPerSecond = 10) {
        this.requestsPerSecond = requestsPerSecond;
        this.tokens = requestsPerSecond;
        this.lastRefill = Date.now();
        this.refillInterval = 1000 / requestsPerSecond;
    }

    async waitForToken() {
        return new Promise((resolve) => {
            const checkToken = () => {
                this.refillTokens();
                
                if (this.tokens >= 1) {
                    this.tokens -= 1;
                    resolve();
                } else {
                    setTimeout(checkToken, this.refillInterval);
                }
            };
            
            checkToken();
        });
    }

    refillTokens() {
        const now = Date.now();
        const timePassed = now - this.lastRefill;
        const tokensToAdd = Math.floor(timePassed / this.refillInterval);
        
        if (tokensToAdd > 0) {
            this.tokens = Math.min(this.requestsPerSecond, this.tokens + tokensToAdd);
            this.lastRefill = now;
        }
    }
}