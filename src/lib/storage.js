/**
 * AstralTube v3 - Storage Manager
 * Handles all data storage and retrieval with encryption and optimization
 */

export class StorageManager {
    constructor() {
        this.cache = new Map();
        this.encryptionKey = null;
        this.initialized = false;
        this.compressionEnabled = true;
        this.maxCacheSize = 100; // Maximum number of cached items
    }

    async initialize() {
        try {
            // Initialize encryption key
            await this.initializeEncryption();
            
            // Load cache from storage
            await this.loadCache();
            
            this.initialized = true;
            console.log('💾 Storage Manager initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Storage Manager:', error);
            throw error;
        }
    }

    async initializeEncryption() {
        try {
            // Get or generate encryption key
            const result = await chrome.storage.local.get('encryptionKey');
            
            if (result.encryptionKey) {
                this.encryptionKey = result.encryptionKey;
            } else {
                // Generate new encryption key
                this.encryptionKey = this.generateEncryptionKey();
                await chrome.storage.local.set({ encryptionKey: this.encryptionKey });
            }
        } catch (error) {
            console.error('❌ Failed to initialize encryption:', error);
            // Continue without encryption if it fails
            this.encryptionKey = null;
        }
    }

    generateEncryptionKey() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    async loadCache() {
        try {
            const result = await chrome.storage.local.get('storageCache');
            if (result.storageCache) {
                const cacheData = JSON.parse(result.storageCache);
                this.cache = new Map(cacheData);
            }
        } catch (error) {
            console.error('❌ Failed to load cache:', error);
            this.cache = new Map();
        }
    }

    async saveCache() {
        try {
            // Limit cache size
            if (this.cache.size > this.maxCacheSize) {
                const entries = Array.from(this.cache.entries());
                const sortedEntries = entries.sort((a, b) => (b[1].lastAccessed || 0) - (a[1].lastAccessed || 0));
                this.cache = new Map(sortedEntries.slice(0, this.maxCacheSize));
            }

            const cacheData = JSON.stringify(Array.from(this.cache.entries()));
            await chrome.storage.local.set({ storageCache: cacheData });
        } catch (error) {
            console.error('❌ Failed to save cache:', error);
        }
    }

    // Core Storage Methods
    async get(key, defaultValue = null) {
        try {
            // Check cache first
            if (this.cache.has(key)) {
                const cached = this.cache.get(key);
                cached.lastAccessed = Date.now();
                return cached.value;
            }

            // Get from storage
            const result = await chrome.storage.local.get(key);
            let value = result[key];

            if (value === undefined) {
                return defaultValue;
            }

            // Decrypt if encrypted
            if (this.isEncrypted(value)) {
                value = await this.decrypt(value);
            }

            // Decompress if compressed
            if (this.isCompressed(value)) {
                value = await this.decompress(value);
            }

            // Parse JSON if it's a string
            if (typeof value === 'string' && this.isJSON(value)) {
                value = JSON.parse(value);
            }

            // Cache the result
            this.cache.set(key, {
                value: value,
                lastAccessed: Date.now(),
                cached: Date.now()
            });

            return value;
        } catch (error) {
            console.error(`❌ Failed to get ${key}:`, error);
            return defaultValue;
        }
    }

    async set(key, value, options = {}) {
        try {
            let processedValue = value;

            // Convert to JSON string if it's an object
            if (typeof processedValue === 'object' && processedValue !== null) {
                processedValue = JSON.stringify(processedValue);
            }

            // Compress if enabled and value is large
            if (this.compressionEnabled && processedValue.length > 1000) {
                processedValue = await this.compress(processedValue);
            }

            // Encrypt if sensitive data
            if (options.encrypt && this.encryptionKey) {
                processedValue = await this.encrypt(processedValue);
            }

            // Store in Chrome storage
            await chrome.storage.local.set({ [key]: processedValue });

            // Update cache
            this.cache.set(key, {
                value: value,
                lastAccessed: Date.now(),
                cached: Date.now()
            });

            // Save cache periodically
            if (this.cache.size % 10 === 0) {
                await this.saveCache();
            }

            return true;
        } catch (error) {
            console.error(`❌ Failed to set ${key}:`, error);
            return false;
        }
    }

    async remove(key) {
        try {
            await chrome.storage.local.remove(key);
            this.cache.delete(key);
            return true;
        } catch (error) {
            console.error(`❌ Failed to remove ${key}:`, error);
            return false;
        }
    }

    async clear() {
        try {
            await chrome.storage.local.clear();
            this.cache.clear();
            return true;
        } catch (error) {
            console.error('❌ Failed to clear storage:', error);
            return false;
        }
    }

    // Batch Operations
    async getMultiple(keys) {
        try {
            const result = {};
            const uncachedKeys = [];

            // Check cache first
            for (const key of keys) {
                if (this.cache.has(key)) {
                    const cached = this.cache.get(key);
                    cached.lastAccessed = Date.now();
                    result[key] = cached.value;
                } else {
                    uncachedKeys.push(key);
                }
            }

            // Get uncached keys from storage
            if (uncachedKeys.length > 0) {
                const storageResult = await chrome.storage.local.get(uncachedKeys);
                
                for (const key of uncachedKeys) {
                    let value = storageResult[key];
                    
                    if (value !== undefined) {
                        // Process the value (decrypt, decompress, parse)
                        value = await this.processStoredValue(value);
                        
                        // Cache the result
                        this.cache.set(key, {
                            value: value,
                            lastAccessed: Date.now(),
                            cached: Date.now()
                        });
                    }
                    
                    result[key] = value;
                }
            }

            return result;
        } catch (error) {
            console.error('❌ Failed to get multiple keys:', error);
            return {};
        }
    }

    async setMultiple(data) {
        try {
            const processedData = {};

            for (const [key, value] of Object.entries(data)) {
                let processedValue = value;

                // Convert to JSON string if it's an object
                if (typeof processedValue === 'object' && processedValue !== null) {
                    processedValue = JSON.stringify(processedValue);
                }

                // Compress if enabled and value is large
                if (this.compressionEnabled && processedValue.length > 1000) {
                    processedValue = await this.compress(processedValue);
                }

                processedData[key] = processedValue;

                // Update cache
                this.cache.set(key, {
                    value: value,
                    lastAccessed: Date.now(),
                    cached: Date.now()
                });
            }

            await chrome.storage.local.set(processedData);
            return true;
        } catch (error) {
            console.error('❌ Failed to set multiple keys:', error);
            return false;
        }
    }

    // Specialized Storage Methods
    async storePlaylist(playlist) {
        const key = `playlist_${playlist.id}`;
        return await this.set(key, playlist);
    }

    async getPlaylist(playlistId) {
        const key = `playlist_${playlistId}`;
        return await this.get(key);
    }

    async storeCollection(collection) {
        const key = `collection_${collection.id}`;
        return await this.set(key, collection);
    }

    async getCollection(collectionId) {
        const key = `collection_${collectionId}`;
        return await this.get(key);
    }

    async getAllCollections() {
        try {
            const result = await chrome.storage.local.get(null);
            const collections = [];

            for (const [key, value] of Object.entries(result)) {
                if (key.startsWith('collection_')) {
                    const collection = await this.processStoredValue(value);
                    collections.push(collection);
                }
            }

            return collections.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        } catch (error) {
            console.error('❌ Failed to get all collections:', error);
            return [];
        }
    }

    async getAllPlaylists() {
        try {
            const result = await chrome.storage.local.get(null);
            const playlists = [];

            for (const [key, value] of Object.entries(result)) {
                if (key.startsWith('playlist_')) {
                    const playlist = await this.processStoredValue(value);
                    playlists.push(playlist);
                }
            }

            return playlists.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        } catch (error) {
            console.error('❌ Failed to get all playlists:', error);
            return [];
        }
    }

    // Settings Management
    async getSettings() {
        return await this.get('settings', {
            theme: 'auto',
            sidebarEnabled: true,
            deckModeEnabled: false,
            autoSync: true,
            notifications: true,
            compressionEnabled: true,
            encryptSensitiveData: false
        });
    }

    async updateSettings(newSettings) {
        const currentSettings = await this.getSettings();
        const updatedSettings = { ...currentSettings, ...newSettings };
        return await this.set('settings', updatedSettings);
    }

    // Activity Tracking
    async addActivity(activity) {
        try {
            const activities = await this.get('recentActivity', []);
            
            const newActivity = {
                id: this.generateId(),
                timestamp: Date.now(),
                ...activity
            };

            activities.unshift(newActivity);

            // Keep only last 100 activities
            if (activities.length > 100) {
                activities.splice(100);
            }

            await this.set('recentActivity', activities);
            return newActivity;
        } catch (error) {
            console.error('❌ Failed to add activity:', error);
            return null;
        }
    }

    // Statistics
    async updateStats(stats) {
        const currentStats = await this.get('stats', {});
        const updatedStats = { ...currentStats, ...stats, lastUpdated: Date.now() };
        return await this.set('stats', updatedStats);
    }

    async getStats() {
        return await this.get('stats', {
            totalPlaylists: 0,
            totalSubscriptions: 0,
            totalCollections: 0,
            totalWatchTime: 0,
            lastSync: 0,
            apiQuota: { used: 0, limit: 10000 },
            storageUsed: 0
        });
    }

    // Data Processing Helpers
    async processStoredValue(value) {
        try {
            // Decrypt if encrypted
            if (this.isEncrypted(value)) {
                value = await this.decrypt(value);
            }

            // Decompress if compressed
            if (this.isCompressed(value)) {
                value = await this.decompress(value);
            }

            // Parse JSON if it's a string
            if (typeof value === 'string' && this.isJSON(value)) {
                value = JSON.parse(value);
            }

            return value;
        } catch (error) {
            console.error('❌ Failed to process stored value:', error);
            return value;
        }
    }

    // Compression Methods
    async compress(data) {
        try {
            // Simple compression using built-in compression
            const compressed = await this.simpleCompress(data);
            return {
                __compressed: true,
                data: compressed
            };
        } catch (error) {
            console.error('❌ Compression failed:', error);
            return data;
        }
    }

    async decompress(compressedData) {
        try {
            if (compressedData.__compressed) {
                return await this.simpleDecompress(compressedData.data);
            }
            return compressedData;
        } catch (error) {
            console.error('❌ Decompression failed:', error);
            return compressedData;
        }
    }

    simpleCompress(str) {
        // Simple run-length encoding for demonstration
        // In production, you might want to use a proper compression library
        return str.replace(/(.)\1+/g, (match, char) => {
            return char + match.length;
        });
    }

    simpleDecompress(compressed) {
        // Reverse of simple compression
        return compressed.replace(/(.)\d+/g, (match, char) => {
            const count = parseInt(match.slice(1));
            return char.repeat(count);
        });
    }

    // Encryption Methods using AES-GCM
    async encrypt(data) {
        if (!this.encryptionKey) return data;
        
        try {
            const encrypted = await this.aesEncrypt(data, this.encryptionKey);
            return {
                __encrypted: true,
                data: encrypted
            };
        } catch (error) {
            console.error('❌ Encryption failed:', error);
            return data;
        }
    }

    async decrypt(encryptedData) {
        if (!this.encryptionKey || !encryptedData.__encrypted) return encryptedData;
        
        try {
            return await this.aesDecrypt(encryptedData.data, this.encryptionKey);
        } catch (error) {
            console.error('❌ Decryption failed:', error);
            return encryptedData;
        }
    }

    async aesEncrypt(data, keyString) {
        try {
            // Convert string data to buffer
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(typeof data === 'string' ? data : JSON.stringify(data));
            
            // Derive key from string
            const key = await this.deriveKey(keyString);
            
            // Generate random IV
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            // Encrypt data
            const encrypted = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                key,
                dataBuffer
            );
            
            // Combine IV and encrypted data
            const combinedBuffer = new Uint8Array(iv.byteLength + encrypted.byteLength);
            combinedBuffer.set(iv, 0);
            combinedBuffer.set(new Uint8Array(encrypted), iv.byteLength);
            
            // Convert to base64 for storage
            return btoa(String.fromCharCode(...combinedBuffer));
        } catch (error) {
            console.error('❌ AES encryption failed:', error);
            throw error;
        }
    }

    async aesDecrypt(encryptedData, keyString) {
        try {
            // Decode from base64
            const combinedBuffer = new Uint8Array(
                atob(encryptedData).split('').map(char => char.charCodeAt(0))
            );
            
            // Extract IV and encrypted data
            const iv = combinedBuffer.slice(0, 12);
            const encrypted = combinedBuffer.slice(12);
            
            // Derive key from string
            const key = await this.deriveKey(keyString);
            
            // Decrypt data
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                key,
                encrypted
            );
            
            const decoder = new TextDecoder();
            const decryptedString = decoder.decode(decrypted);
            
            // Try to parse as JSON, otherwise return as string
            try {
                return JSON.parse(decryptedString);
            } catch {
                return decryptedString;
            }
        } catch (error) {
            console.error('❌ AES decryption failed:', error);
            throw error;
        }
    }

    async deriveKey(keyString) {
        try {
            const encoder = new TextEncoder();
            const keyBuffer = encoder.encode(keyString);
            
            // Import the key material
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                keyBuffer,
                'PBKDF2',
                false,
                ['deriveBits', 'deriveKey']
            );
            
            // Use a fixed salt for consistency (in production, consider using a stored salt)
            const salt = encoder.encode('AstralTube-Salt-v3');
            
            // Derive the key
            return await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                {
                    name: 'AES-GCM',
                    length: 256
                },
                false,
                ['encrypt', 'decrypt']
            );
        } catch (error) {
            console.error('❌ Key derivation failed:', error);
            throw error;
        }
    }

    // Utility Methods
    isEncrypted(value) {
        return typeof value === 'object' && value !== null && value.__encrypted === true;
    }

    isCompressed(value) {
        return typeof value === 'object' && value !== null && value.__compressed === true;
    }

    isJSON(str) {
        try {
            JSON.parse(str);
            return true;
        } catch {
            return false;
        }
    }

    generateId() {
        return 'astral_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Storage Usage Analysis
    async getStorageUsage() {
        try {
            const result = await chrome.storage.local.get(null);
            const usage = {
                totalItems: Object.keys(result).length,
                totalSize: 0,
                categories: {
                    playlists: { count: 0, size: 0 },
                    collections: { count: 0, size: 0 },
                    cache: { count: 0, size: 0 },
                    settings: { count: 0, size: 0 },
                    other: { count: 0, size: 0 }
                }
            };

            for (const [key, value] of Object.entries(result)) {
                const size = JSON.stringify(value).length;
                usage.totalSize += size;

                if (key.startsWith('playlist_')) {
                    usage.categories.playlists.count++;
                    usage.categories.playlists.size += size;
                } else if (key.startsWith('collection_')) {
                    usage.categories.collections.count++;
                    usage.categories.collections.size += size;
                } else if (key.includes('cache') || key.includes('Cache')) {
                    usage.categories.cache.count++;
                    usage.categories.cache.size += size;
                } else if (key === 'settings') {
                    usage.categories.settings.count++;
                    usage.categories.settings.size += size;
                } else {
                    usage.categories.other.count++;
                    usage.categories.other.size += size;
                }
            }

            return usage;
        } catch (error) {
            console.error('❌ Failed to get storage usage:', error);
            return null;
        }
    }

    // Cleanup Methods
    async cleanup() {
        try {
            console.log('🧹 Starting storage cleanup...');
            
            // Clear expired cache entries
            const now = Date.now();
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            
            for (const [key, cached] of this.cache.entries()) {
                if (now - cached.cached > maxAge) {
                    this.cache.delete(key);
                }
            }

            // Save cleaned cache
            await this.saveCache();

            // Remove old activity entries (keep only last 100)
            const activities = await this.get('recentActivity', []);
            if (activities.length > 100) {
                await this.set('recentActivity', activities.slice(0, 100));
            }

            console.log('✅ Storage cleanup completed');
        } catch (error) {
            console.error('❌ Storage cleanup failed:', error);
        }
    }

    // Export/Import Methods
    async exportData() {
        try {
            const result = await chrome.storage.local.get(null);
            const exportData = {
                version: '3.0.0',
                timestamp: Date.now(),
                data: {}
            };

            // Process and clean data for export
            for (const [key, value] of Object.entries(result)) {
                if (!key.includes('cache') && !key.includes('temp')) {
                    exportData.data[key] = await this.processStoredValue(value);
                }
            }

            return exportData;
        } catch (error) {
            console.error('❌ Failed to export data:', error);
            return null;
        }
    }

    async importData(importData) {
        try {
            if (!importData.data) {
                throw new Error('Invalid import data format');
            }

            // Backup current data
            const backup = await this.exportData();
            await this.set('backup_' + Date.now(), backup);

            // Import new data
            await this.setMultiple(importData.data);

            // Clear cache to force refresh
            this.cache.clear();

            console.log('✅ Data import completed');
            return true;
        } catch (error) {
            console.error('❌ Failed to import data:', error);
            return false;
        }
    }
    
    // Advanced Storage Features
    
    async optimizeCache() {
        if (Date.now() - this.lastOptimization < 60000) {
            return; // Don't optimize more than once per minute
        }
        
        try {
            console.log('🔧 Optimizing storage cache...');
            
            // Apply intelligent eviction policy
            const evicted = await this.cacheEvictionPolicy.optimize(this.cache, this.maxCacheSize);
            
            // Defragment cache
            await this.defragmentCache();
            
            // Update optimization timestamp
            this.lastOptimization = Date.now();
            
            console.log(`✅ Cache optimized - evicted ${evicted} entries, hit rate: ${(this.hitRate * 100).toFixed(1)}%`);
        } catch (error) {
            console.error('❌ Cache optimization failed:', error);
        }
    }
    
    async defragmentCache() {
        // Sort cache entries by access frequency and recency
        const entries = Array.from(this.cache.entries());
        const sortedEntries = entries.sort((a, b) => {
            const scoreA = this.calculateCacheScore(a[1]);
            const scoreB = this.calculateCacheScore(b[1]);
            return scoreB - scoreA; // Higher score first
        });
        
        this.cache.clear();
        sortedEntries.forEach(([key, value]) => {
            this.cache.set(key, value);
        });
    }
    
    calculateCacheScore(cacheEntry) {
        const now = Date.now();
        const accessCount = cacheEntry.accessCount || 1;
        const recency = Math.max(1, now - cacheEntry.lastAccessed);
        const frequency = accessCount / (now - cacheEntry.cached);
        
        // Higher score = more valuable cache entry
        return (accessCount * 1000) + (frequency * 10000) - (recency / 1000);
    }
    
    async checkStorageQuota(forceCleanup = false) {
        try {
            if (chrome.storage.local.getBytesInUse) {
                const usage = await chrome.storage.local.getBytesInUse();
                const quota = chrome.storage.local.QUOTA_BYTES || 5242880; // 5MB default
                const utilization = usage / quota;
                
                if (utilization > this.quotaThreshold || forceCleanup) {
                    console.log(`⚠️ Storage quota at ${(utilization * 100).toFixed(1)}%, performing cleanup...`);
                    await this.performQuotaCleanup(utilization);
                }
                
                return { usage, quota, utilization };
            }
        } catch (error) {
            console.error('❌ Failed to check storage quota:', error);
        }
    }
    
    async performQuotaCleanup(utilization) {
        try {
            // Remove expired TTL entries first
            await this.ttlManager.cleanupExpired();
            
            // If still over quota, remove least recently used items
            if (utilization > 0.9) {
                const sortedEntries = Array.from(this.cache.entries())
                    .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
                
                const itemsToRemove = Math.ceil(sortedEntries.length * 0.2); // Remove 20%
                for (let i = 0; i < itemsToRemove; i++) {
                    const [key] = sortedEntries[i];
                    await this.remove(key);
                }
                
                console.log(`🗑️ Removed ${itemsToRemove} items due to quota pressure`);
            }
        } catch (error) {
            console.error('❌ Quota cleanup failed:', error);
        }
    }
    
    async performMigrationsIfNeeded() {
        try {
            const pendingMigrations = await this.migrationManager.getPendingMigrations();
            if (pendingMigrations.length > 0) {
                console.log(`🔄 Running ${pendingMigrations.length} data migrations...`);
                
                for (const migration of pendingMigrations) {
                    await this.migrationManager.runMigration(migration);
                }
                
                console.log('✅ All migrations completed');
            }
        } catch (error) {
            console.error('❌ Migration failed:', error);
        }
    }
    
    startBackgroundOptimization() {
        // Run optimization every 10 minutes
        setInterval(() => {
            this.optimizeCache();
        }, 10 * 60 * 1000);
        
        // Run TTL cleanup every 5 minutes
        setInterval(() => {
            this.ttlManager.cleanupExpired();
        }, 5 * 60 * 1000);
        
        // Check quota every hour
        setInterval(() => {
            this.checkStorageQuota();
        }, 60 * 60 * 1000);
    }
    
    // Batch Operations
    async batchSet(operations) {
        return await this.batchOperationManager.executeBatchSet(operations);
    }
    
    async batchGet(keys) {
        return await this.batchOperationManager.executeBatchGet(keys);
    }
    
    async batchRemove(keys) {
        return await this.batchOperationManager.executeBatchRemove(keys);
    }
    
    // Backup and Restore
    async createBackup(options = {}) {
        return await this.backupManager.createBackup(options);
    }
    
    async restoreBackup(backupData, options = {}) {
        return await this.backupManager.restoreBackup(backupData, options);
    }
    
    async listBackups() {
        return await this.backupManager.listBackups();
    }
    
    // Performance Stats
    getPerformanceStats() {
        return {
            hitRate: this.hitRate,
            accessCount: this.accessCount,
            cacheSize: this.cache.size,
            lastOptimization: this.lastOptimization,
            ttlEntries: this.ttlManager.getStats(),
            compressionStats: this.getCompressionStats()
        };
    }
    
    getCompressionStats() {
        let totalOriginal = 0;
        let totalCompressed = 0;
        let compressedCount = 0;
        
        for (const entry of this.cache.values()) {
            if (entry.compressionRatio) {
                totalOriginal += entry.size;
                totalCompressed += entry.size / entry.compressionRatio;
                compressedCount++;
            }
        }
        
        return {
            compressedEntries: compressedCount,
            totalSavings: totalOriginal - totalCompressed,
            averageCompressionRatio: compressedCount > 0 ? totalOriginal / totalCompressed : 1
        };
    }
}

// TTL Cache Manager
class TTLCacheManager {
    constructor() {
        this.ttlEntries = new Map();
        this.cleanupInterval = null;
    }
    
    async initialize() {
        // Load existing TTL entries from storage
        const stored = await chrome.storage.local.get('ttlEntries');
        if (stored.ttlEntries) {
            this.ttlEntries = new Map(stored.ttlEntries);
        }
        
        // Start cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpired();
        }, 60000); // Check every minute
    }
    
    addEntry(key, ttl, baseTime = Date.now()) {
        const expiresAt = baseTime + ttl;
        this.ttlEntries.set(key, expiresAt);
        this.persistTTLEntries();
    }
    
    hasExpired(key) {
        const expiresAt = this.ttlEntries.get(key);
        if (!expiresAt) return false;
        
        const now = Date.now();
        return now > expiresAt;
    }
    
    async cleanupExpired() {
        const now = Date.now();
        const expiredKeys = [];
        
        for (const [key, expiresAt] of this.ttlEntries.entries()) {
            if (now > expiresAt) {
                expiredKeys.push(key);
                this.ttlEntries.delete(key);
            }
        }
        
        // Remove expired keys from storage
        if (expiredKeys.length > 0) {
            await chrome.storage.local.remove(expiredKeys);
            this.persistTTLEntries();
        }
        
        return expiredKeys;
    }
    
    async persistTTLEntries() {
        await chrome.storage.local.set({
            ttlEntries: Array.from(this.ttlEntries.entries())
        });
    }
    
    getStats() {
        const now = Date.now();
        let expired = 0;
        let active = 0;
        
        for (const expiresAt of this.ttlEntries.values()) {
            if (now > expiresAt) {
                expired++;
            } else {
                active++;
            }
        }
        
        return { total: this.ttlEntries.size, active, expired };
    }
}

// Intelligent Eviction Policy
class IntelligentEvictionPolicy {
    constructor() {
        this.algorithms = {
            lru: this.lruEviction.bind(this),
            lfu: this.lfuEviction.bind(this),
            adaptive: this.adaptiveEviction.bind(this)
        };
        this.currentAlgorithm = 'adaptive';
    }
    
    async optimize(cache, maxSize) {
        if (cache.size <= maxSize) return 0;
        
        const algorithm = this.algorithms[this.currentAlgorithm];
        return await algorithm(cache, maxSize);
    }
    
    async evictIfNeeded(cache, maxSize) {
        if (cache.size <= maxSize) return 0;
        
        const toEvict = cache.size - maxSize;
        return await this.optimize(cache, maxSize);
    }
    
    lruEviction(cache, maxSize) {
        const entries = Array.from(cache.entries())
            .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        
        const toRemove = entries.length - maxSize;
        for (let i = 0; i < toRemove; i++) {
            cache.delete(entries[i][0]);
        }
        
        return toRemove;
    }
    
    lfuEviction(cache, maxSize) {
        const entries = Array.from(cache.entries())
            .sort((a, b) => (a[1].accessCount || 1) - (b[1].accessCount || 1));
        
        const toRemove = entries.length - maxSize;
        for (let i = 0; i < toRemove; i++) {
            cache.delete(entries[i][0]);
        }
        
        return toRemove;
    }
    
    adaptiveEviction(cache, maxSize) {
        // Hybrid approach considering both recency and frequency
        const entries = Array.from(cache.entries())
            .map(([key, value]) => ({
                key,
                value,
                score: this.calculateEvictionScore(value)
            }))
            .sort((a, b) => a.score - b.score); // Lower score = more likely to evict
        
        const toRemove = entries.length - maxSize;
        for (let i = 0; i < toRemove; i++) {
            cache.delete(entries[i].key);
        }
        
        return toRemove;
    }
    
    calculateEvictionScore(cacheEntry) {
        const now = Date.now();
        const accessCount = cacheEntry.accessCount || 1;
        const timeSinceAccess = now - cacheEntry.lastAccessed;
        const age = now - cacheEntry.cached;
        const size = cacheEntry.size || 1000;
        
        // Higher score = less likely to evict
        // Consider frequency, recency, age, and size
        const frequencyScore = Math.log(accessCount + 1);
        const recencyScore = 1 / (timeSinceAccess + 1000);
        const ageScore = 1 / (age + 1000);
        const sizeScore = 1 / Math.log(size + 1);
        
        return frequencyScore + recencyScore + ageScore + sizeScore;
    }
}

// Data Schema Validator
class DataSchemaValidator {
    constructor() {
        this.schemas = new Map();
    }
    
    async initialize() {
        // Register common schemas
        this.registerSchema('playlist', {
            type: 'object',
            required: ['id', 'title'],
            properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                itemCount: { type: 'number', minimum: 0 },
                privacy: { type: 'string', enum: ['public', 'private', 'unlisted'] },
                createdAt: { type: 'number' },
                updatedAt: { type: 'number' }
            }
        });
        
        this.registerSchema('collection', {
            type: 'object',
            required: ['id', 'name'],
            properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                channels: { type: 'array', items: { type: 'string' } },
                createdAt: { type: 'number' },
                updatedAt: { type: 'number' }
            }
        });
        
        this.registerSchema('settings', {
            type: 'object',
            properties: {
                theme: { type: 'string', enum: ['auto', 'light', 'dark'] },
                sidebarEnabled: { type: 'boolean' },
                deckModeEnabled: { type: 'boolean' },
                autoSync: { type: 'boolean' },
                notifications: { type: 'boolean' }
            }
        });
    }
    
    registerSchema(name, schema) {
        this.schemas.set(name, schema);
    }
    
    validate(data, schemaName) {
        const schema = this.schemas.get(schemaName);
        if (!schema) {
            return { valid: false, errors: [`Schema '${schemaName}' not found`] };
        }
        
        return this.validateAgainstSchema(data, schema);
    }
    
    validateAgainstSchema(data, schema) {
        const errors = [];
        
        if (schema.type && typeof data !== schema.type) {
            errors.push(`Expected type ${schema.type}, got ${typeof data}`);
        }
        
        if (schema.required && schema.type === 'object') {
            for (const field of schema.required) {
                if (!(field in data)) {
                    errors.push(`Missing required field: ${field}`);
                }
            }
        }
        
        if (schema.properties && schema.type === 'object') {
            for (const [key, value] of Object.entries(data)) {
                const propSchema = schema.properties[key];
                if (propSchema) {
                    const propResult = this.validateAgainstSchema(value, propSchema);
                    errors.push(...propResult.errors.map(e => `${key}: ${e}`));
                }
            }
        }
        
        if (schema.enum && !schema.enum.includes(data)) {
            errors.push(`Value must be one of: ${schema.enum.join(', ')}`);
        }
        
        if (schema.minimum !== undefined && data < schema.minimum) {
            errors.push(`Value must be >= ${schema.minimum}`);
        }
        
        if (schema.maximum !== undefined && data > schema.maximum) {
            errors.push(`Value must be <= ${schema.maximum}`);
        }
        
        return { valid: errors.length === 0, errors };
    }
}

// Data Migration Manager
class DataMigrationManager {
    constructor() {
        this.migrations = new Map();
        this.currentVersion = '3.0.0';
    }
    
    async initialize() {
        this.registerMigrations();
    }
    
    registerMigrations() {
        // Migration from v2.x to v3.0
        this.registerMigration('2.0.0', '3.0.0', {
            description: 'Migrate to v3.0 data format',
            migrate: (data) => {
                // Convert old playlist format
                if (data.playlists && Array.isArray(data.playlists)) {
                    data.playlists = data.playlists.map(playlist => ({
                        ...playlist,
                        updatedAt: Date.now(),
                        version: '3.0.0'
                    }));
                }
                
                // Add missing fields to settings
                if (data.settings) {
                    data.settings = {
                        theme: 'auto',
                        sidebarEnabled: true,
                        deckModeEnabled: false,
                        autoSync: true,
                        notifications: true,
                        ...data.settings,
                        version: '3.0.0'
                    };
                }
                
                return data;
            }
        });
    }
    
    registerMigration(fromVersion, toVersion, migration) {
        const key = `${fromVersion}->${toVersion}`;
        this.migrations.set(key, {
            fromVersion,
            toVersion,
            ...migration
        });
    }
    
    needsMigration(key, version) {
        if (!version || version === this.currentVersion) return false;
        
        // Check if there's a migration path from version to current
        return this.getMigrationPath(version, this.currentVersion).length > 0;
    }
    
    async migrate(key, data, fromVersion) {
        const migrationPath = this.getMigrationPath(fromVersion, this.currentVersion);
        
        if (migrationPath.length === 0) {
            return null; // No migration needed or available
        }
        
        let currentData = data;
        let currentVersion = fromVersion;
        
        for (const migration of migrationPath) {
            console.log(`🔄 Migrating ${key} from ${currentVersion} to ${migration.toVersion}`);
            currentData = migration.migrate(currentData);
            currentVersion = migration.toVersion;
        }
        
        return {
            data: currentData,
            version: currentVersion
        };
    }
    
    getMigrationPath(fromVersion, toVersion) {
        const path = [];
        let currentVersion = fromVersion;
        
        // Simple linear migration path for now
        while (currentVersion !== toVersion) {
            let found = false;
            for (const [key, migration] of this.migrations.entries()) {
                if (migration.fromVersion === currentVersion) {
                    path.push(migration);
                    currentVersion = migration.toVersion;
                    found = true;
                    break;
                }
            }
            if (!found) break;
        }
        
        return currentVersion === toVersion ? path : [];
    }
    
    async getPendingMigrations() {
        // Check all stored data for migration needs
        const result = await chrome.storage.local.get(null);
        const pending = [];
        
        for (const [key, value] of Object.entries(result)) {
            if (value && value.metadata && value.metadata.version) {
                if (this.needsMigration(key, value.metadata.version)) {
                    pending.push({
                        key,
                        fromVersion: value.metadata.version,
                        toVersion: this.currentVersion
                    });
                }
            }
        }
        
        return pending;
    }
    
    async runMigration(migrationInfo) {
        const { key, fromVersion, toVersion } = migrationInfo;
        const result = await chrome.storage.local.get(key);
        const data = result[key];
        
        if (data) {
            const migrated = await this.migrate(key, data.data || data, fromVersion);
            if (migrated) {
                await chrome.storage.local.set({
                    [key]: {
                        data: migrated.data,
                        metadata: {
                            ...data.metadata,
                            version: migrated.version,
                            migratedAt: Date.now()
                        }
                    }
                });
            }
        }
    }
}

// Batch Operation Manager
class BatchOperationManager {
    constructor() {
        this.batchSize = 10;
        this.concurrency = 3;
    }
    
    async executeBatchSet(operations) {
        const batches = this.createBatches(operations, this.batchSize);
        const results = [];
        
        for (const batch of batches) {
            const batchPromises = batch.map(async (op) => {
                try {
                    const result = await chrome.storage.local.set({ [op.key]: op.value });
                    return { key: op.key, success: true };
                } catch (error) {
                    return { key: op.key, success: false, error: error.message };
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }
        
        return results;
    }
    
    async executeBatchGet(keys) {
        const batches = this.createBatches(keys, this.batchSize);
        const results = {};
        
        for (const batch of batches) {
            const batchResult = await chrome.storage.local.get(batch);
            Object.assign(results, batchResult);
        }
        
        return results;
    }
    
    async executeBatchRemove(keys) {
        const batches = this.createBatches(keys, this.batchSize);
        const results = [];
        
        for (const batch of batches) {
            try {
                await chrome.storage.local.remove(batch);
                results.push(...batch.map(key => ({ key, success: true })));
            } catch (error) {
                results.push(...batch.map(key => ({ key, success: false, error: error.message })));
            }
        }
        
        return results;
    }
    
    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }
}

// Backup and Restore Manager
class BackupRestoreManager {
    constructor() {
        this.maxBackups = 10;
        this.compressionEnabled = true;
        this.encryptionEnabled = true;
    }
    
    async initialize() {
        // Initialize backup storage area
        await this.ensureBackupStructure();
    }
    
    async ensureBackupStructure() {
        const backups = await chrome.storage.local.get('backupRegistry');
        if (!backups.backupRegistry) {
            await chrome.storage.local.set({ backupRegistry: [] });
        }
    }
    
    async createBackup(options = {}) {
        try {
            const backupId = this.generateBackupId();
            const timestamp = Date.now();
            
            // Get all data to backup
            const allData = await chrome.storage.local.get(null);
            
            // Filter data based on options
            const dataToBackup = this.filterDataForBackup(allData, options);
            
            // Create backup metadata
            const backup = {
                id: backupId,
                timestamp,
                type: options.type || 'full',
                description: options.description || `Backup created at ${new Date(timestamp).toISOString()}`,
                dataKeys: Object.keys(dataToBackup),
                size: JSON.stringify(dataToBackup).length,
                compressed: false,
                encrypted: false
            };
            
            let backupData = dataToBackup;
            
            // Compress if enabled
            if (this.compressionEnabled) {
                backupData = await this.compressBackup(backupData);
                backup.compressed = true;
            }
            
            // Encrypt if enabled
            if (this.encryptionEnabled && options.password) {
                backupData = await this.encryptBackup(backupData, options.password);
                backup.encrypted = true;
            }
            
            // Store backup
            await chrome.storage.local.set({
                [`backup_${backupId}`]: backupData
            });
            
            // Update backup registry
            await this.updateBackupRegistry(backup);
            
            // Cleanup old backups if needed
            await this.cleanupOldBackups();
            
            console.log(`✅ Backup created: ${backupId}`);
            return backup;
        } catch (error) {
            console.error('❌ Backup creation failed:', error);
            throw error;
        }
    }
    
    async createIncrementalBackup() {
        // Create a backup of only recently changed data
        const lastFullBackup = await this.getLastBackup('full');
        const cutoffTime = lastFullBackup ? lastFullBackup.timestamp : 0;
        
        return await this.createBackup({
            type: 'incremental',
            filter: (key, value) => {
                return value.metadata && value.metadata.timestamp > cutoffTime;
            }
        });
    }
    
    async restoreBackup(backupId, options = {}) {
        try {
            console.log(`🔄 Restoring backup: ${backupId}`);
            
            // Get backup data
            const backupKey = typeof backupId === 'string' ? `backup_${backupId}` : backupId;
            const result = await chrome.storage.local.get([backupKey, 'backupRegistry']);
            
            if (!result[backupKey]) {
                throw new Error(`Backup ${backupId} not found`);
            }
            
            let backupData = result[backupKey];
            const backupInfo = result.backupRegistry?.find(b => b.id === backupId);
            
            // Decrypt if needed
            if (backupInfo?.encrypted && options.password) {
                backupData = await this.decryptBackup(backupData, options.password);
            }
            
            // Decompress if needed
            if (backupInfo?.compressed) {
                backupData = await this.decompressBackup(backupData);
            }
            
            // Create current backup before restoring
            if (!options.skipCurrentBackup) {
                await this.createBackup({ description: 'Pre-restore backup' });
            }
            
            // Restore data
            if (options.selective && options.keys) {
                // Selective restore
                const filteredData = {};
                for (const key of options.keys) {
                    if (backupData[key]) {
                        filteredData[key] = backupData[key];
                    }
                }
                await chrome.storage.local.set(filteredData);
            } else {
                // Full restore
                if (options.clearExisting) {
                    await chrome.storage.local.clear();
                }
                await chrome.storage.local.set(backupData);
            }
            
            console.log('✅ Backup restored successfully');
            return true;
        } catch (error) {
            console.error('❌ Backup restore failed:', error);
            throw error;
        }
    }
    
    async listBackups() {
        const result = await chrome.storage.local.get('backupRegistry');
        return result.backupRegistry || [];
    }
    
    async getLastBackup(type = null) {
        const backups = await this.listBackups();
        const filtered = type ? backups.filter(b => b.type === type) : backups;
        return filtered.sort((a, b) => b.timestamp - a.timestamp)[0];
    }
    
    filterDataForBackup(data, options) {
        const filtered = {};
        
        for (const [key, value] of Object.entries(data)) {
            // Skip backup-related keys
            if (key.startsWith('backup_') || key === 'backupRegistry') {
                continue;
            }
            
            // Apply custom filter if provided
            if (options.filter && !options.filter(key, value)) {
                continue;
            }
            
            // Include by default
            filtered[key] = value;
        }
        
        return filtered;
    }
    
    async updateBackupRegistry(backup) {
        const result = await chrome.storage.local.get('backupRegistry');
        const registry = result.backupRegistry || [];
        
        registry.push(backup);
        registry.sort((a, b) => b.timestamp - a.timestamp);
        
        await chrome.storage.local.set({ backupRegistry: registry });
    }
    
    async cleanupOldBackups() {
        const registry = await this.listBackups();
        
        if (registry.length > this.maxBackups) {
            const toRemove = registry.slice(this.maxBackups);
            const keysToRemove = toRemove.map(b => `backup_${b.id}`);
            
            await chrome.storage.local.remove(keysToRemove);
            
            const updatedRegistry = registry.slice(0, this.maxBackups);
            await chrome.storage.local.set({ backupRegistry: updatedRegistry });
            
            console.log(`🗑️ Removed ${toRemove.length} old backups`);
        }
    }
    
    generateBackupId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    async compressBackup(data) {
        // Simple JSON string compression
        const jsonString = JSON.stringify(data);
        return {
            __compressed: true,
            data: jsonString // In a real implementation, use a proper compression algorithm
        };
    }
    
    async decompressBackup(compressedData) {
        if (compressedData.__compressed) {
            return JSON.parse(compressedData.data);
        }
        return compressedData;
    }
    
    async encryptBackup(data, password) {
        // Simple encryption placeholder
        return {
            __encrypted: true,
            data: btoa(JSON.stringify(data)) // In a real implementation, use proper encryption
        };
    }
    
    async decryptBackup(encryptedData, password) {
        if (encryptedData.__encrypted) {
            return JSON.parse(atob(encryptedData.data));
        }
        return encryptedData;
    }
}