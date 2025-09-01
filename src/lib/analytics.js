/**
 * AstralTube v3 - Analytics Manager
 * Handles usage analytics, performance monitoring, and statistics
 */

export class AnalyticsManager {
    constructor() {
        this.initialized = false;
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        this.events = [];
        this.metrics = new Map();
        this.performanceObserver = null;
        this.settings = {
            enabled: true,
            collectPerformance: true,
            collectUsage: true,
            anonymize: true,
            maxEvents: 1000
        };
    }

    async initialize() {
        try {
            await this.loadSettings();
            
            if (this.settings.enabled) {
                this.setupPerformanceMonitoring();
                this.startSession();
                this.scheduleDataFlush();
            }
            
            this.initialized = true;
            console.log('📊 Analytics Manager initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Analytics Manager:', error);
        }
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get('analyticsSettings');
            if (result.analyticsSettings) {
                this.settings = { ...this.settings, ...result.analyticsSettings };
            }
        } catch (error) {
            console.error('❌ Failed to load analytics settings:', error);
        }
    }

    async saveSettings() {
        try {
            await chrome.storage.local.set({ analyticsSettings: this.settings });
        } catch (error) {
            console.error('❌ Failed to save analytics settings:', error);
        }
    }

    // Session Management
    startSession() {
        this.trackEvent('session_start', {
            sessionId: this.sessionId,
            timestamp: this.startTime,
            userAgent: navigator.userAgent,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
    }

    endSession() {
        const duration = Date.now() - this.startTime;
        this.trackEvent('session_end', {
            sessionId: this.sessionId,
            duration: duration,
            eventsCount: this.events.length
        });
        
        this.flushData();
    }

    // Event Tracking
    trackEvent(eventName, properties = {}) {
        if (!this.settings.enabled || !this.settings.collectUsage) {
            return;
        }

        const event = {
            id: this.generateEventId(),
            name: eventName,
            properties: this.settings.anonymize ? this.anonymizeProperties(properties) : properties,
            timestamp: Date.now(),
            sessionId: this.sessionId,
            url: this.getCurrentUrl()
        };

        this.events.push(event);

        // Limit events array size
        if (this.events.length > this.settings.maxEvents) {
            this.events = this.events.slice(-this.settings.maxEvents);
        }

        console.log('📈 Event tracked:', eventName, properties);
    }

    // Performance Monitoring
    setupPerformanceMonitoring() {
        if (!this.settings.collectPerformance) return;

        try {
            // Check if we're in browser context (not service worker)
            const hasWindow = typeof window !== 'undefined';
            const globalScope = hasWindow ? window : self;

            // Monitor performance entries
            if ('PerformanceObserver' in globalScope) {
                this.performanceObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        this.trackPerformanceEntry(entry);
                    }
                });

                this.performanceObserver.observe({ 
                    entryTypes: ['navigation', 'resource', 'measure', 'mark'] 
                });
            }

            // Monitor memory usage (works in both contexts)
            this.startMemoryMonitoring();

            // Monitor frame rate only in browser context (not service worker)
            if (hasWindow && 'requestAnimationFrame' in window) {
                this.startFrameRateMonitoring();
            }

        } catch (error) {
            console.error('❌ Failed to setup performance monitoring:', error);
        }
    }

    trackPerformanceEntry(entry) {
        const performanceData = {
            name: entry.name,
            type: entry.entryType,
            startTime: entry.startTime,
            duration: entry.duration,
            timestamp: Date.now()
        };

        // Add specific properties based on entry type
        switch (entry.entryType) {
            case 'navigation':
                performanceData.loadEventEnd = entry.loadEventEnd;
                performanceData.domContentLoadedEventEnd = entry.domContentLoadedEventEnd;
                break;
            case 'resource':
                performanceData.transferSize = entry.transferSize;
                performanceData.encodedBodySize = entry.encodedBodySize;
                break;
        }

        this.trackEvent('performance_entry', performanceData);
    }

    startMemoryMonitoring() {
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                this.updateMetric('memory_usage', {
                    used: memory.usedJSHeapSize,
                    total: memory.totalJSHeapSize,
                    limit: memory.jsHeapSizeLimit,
                    timestamp: Date.now()
                });
            }, 30000); // Every 30 seconds
        }
    }

    startFrameRateMonitoring() {
        let lastTime = performance.now();
        let frameCount = 0;

        const measureFrameRate = (currentTime) => {
            frameCount++;
            
            if (currentTime - lastTime >= 1000) {
                const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                this.updateMetric('frame_rate', {
                    fps: fps,
                    timestamp: Date.now()
                });
                
                frameCount = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(measureFrameRate);
        };

        requestAnimationFrame(measureFrameRate);
    }

    // Metrics Management
    updateMetric(name, value) {
        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }

        const metricData = this.metrics.get(name);
        metricData.push(value);

        // Keep only last 100 entries per metric
        if (metricData.length > 100) {
            metricData.splice(0, metricData.length - 100);
        }
    }

    getMetric(name) {
        return this.metrics.get(name) || [];
    }

    getMetricSummary(name) {
        const data = this.getMetric(name);
        if (data.length === 0) return null;

        const values = data.map(item => typeof item === 'object' ? item.value || 0 : item);
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);

        return {
            count: values.length,
            sum,
            average: avg,
            min,
            max,
            latest: values[values.length - 1]
        };
    }

    // Usage Statistics
    async getStats() {
        try {
            const stats = await chrome.storage.local.get([
                'totalPlaylists',
                'totalSubscriptions', 
                'totalCollections',
                'totalWatchTime',
                'lastSync',
                'apiQuota',
                'storageUsed'
            ]);

            // Add session stats
            stats.sessionDuration = Date.now() - this.startTime;
            stats.eventsThisSession = this.events.length;
            stats.sessionId = this.sessionId;

            // Add performance stats
            stats.memoryUsage = this.getMetricSummary('memory_usage');
            stats.frameRate = this.getMetricSummary('frame_rate');

            // Add usage patterns
            stats.usagePatterns = await this.getUsagePatterns();

            return stats;
        } catch (error) {
            console.error('❌ Failed to get stats:', error);
            return {};
        }
    }

    async getUsagePatterns() {
        try {
            const patterns = {
                mostUsedFeatures: this.getMostUsedFeatures(),
                peakUsageHours: this.getPeakUsageHours(),
                averageSessionDuration: await this.getAverageSessionDuration(),
                totalSessions: await this.getTotalSessions()
            };

            return patterns;
        } catch (error) {
            console.error('❌ Failed to get usage patterns:', error);
            return {};
        }
    }

    getMostUsedFeatures() {
        const featureCounts = {};
        
        this.events.forEach(event => {
            if (event.name.includes('_')) {
                const feature = event.name.split('_')[0];
                featureCounts[feature] = (featureCounts[feature] || 0) + 1;
            }
        });

        return Object.entries(featureCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([feature, count]) => ({ feature, count }));
    }

    getPeakUsageHours() {
        const hourCounts = new Array(24).fill(0);
        
        this.events.forEach(event => {
            const hour = new Date(event.timestamp).getHours();
            hourCounts[hour]++;
        });

        return hourCounts.map((count, hour) => ({ hour, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }

    async getAverageSessionDuration() {
        try {
            const sessions = await chrome.storage.local.get('sessionHistory');
            if (!sessions.sessionHistory || sessions.sessionHistory.length === 0) {
                return 0;
            }

            const totalDuration = sessions.sessionHistory.reduce((sum, session) => {
                return sum + (session.duration || 0);
            }, 0);

            return Math.round(totalDuration / sessions.sessionHistory.length);
        } catch (error) {
            return 0;
        }
    }

    async getTotalSessions() {
        try {
            const sessions = await chrome.storage.local.get('sessionHistory');
            return sessions.sessionHistory ? sessions.sessionHistory.length : 0;
        } catch (error) {
            return 0;
        }
    }

    // Feature Usage Tracking
    trackFeatureUsage(feature, action, metadata = {}) {
        this.trackEvent(`${feature}_${action}`, {
            feature,
            action,
            ...metadata
        });
    }

    trackPlaylistAction(action, playlistId, metadata = {}) {
        this.trackFeatureUsage('playlist', action, {
            playlistId: this.settings.anonymize ? this.hashId(playlistId) : playlistId,
            ...metadata
        });
    }

    trackCollectionAction(action, collectionId, metadata = {}) {
        this.trackFeatureUsage('collection', action, {
            collectionId: this.settings.anonymize ? this.hashId(collectionId) : collectionId,
            ...metadata
        });
    }

    trackUIInteraction(element, action, metadata = {}) {
        this.trackEvent('ui_interaction', {
            element,
            action,
            ...metadata
        });
    }

    trackError(error, context = {}) {
        this.trackEvent('error', {
            message: error.message,
            stack: this.settings.anonymize ? '[REDACTED]' : error.stack,
            context,
            timestamp: Date.now()
        });
    }

    // Performance Benchmarking
    startBenchmark(name) {
        const startTime = performance.now();
        return {
            name,
            startTime,
            end: () => {
                const endTime = performance.now();
                const duration = endTime - startTime;
                
                this.trackEvent('benchmark', {
                    name,
                    duration,
                    startTime,
                    endTime
                });

                this.updateMetric(`benchmark_${name}`, duration);
                return duration;
            }
        };
    }

    measureAsync(name, asyncFunction) {
        return async (...args) => {
            const benchmark = this.startBenchmark(name);
            try {
                const result = await asyncFunction(...args);
                benchmark.end();
                return result;
            } catch (error) {
                benchmark.end();
                this.trackError(error, { benchmark: name });
                throw error;
            }
        };
    }

    // Data Management
    async flushData() {
        try {
            if (this.events.length === 0) return;

            // Store events in local storage
            const existingEvents = await chrome.storage.local.get('analyticsEvents');
            const allEvents = [...(existingEvents.analyticsEvents || []), ...this.events];
            
            // Keep only last 5000 events
            const eventsToStore = allEvents.slice(-5000);
            
            await chrome.storage.local.set({ 
                analyticsEvents: eventsToStore,
                lastAnalyticsFlush: Date.now()
            });

            // Store session history
            await this.updateSessionHistory();

            // Clear current events
            this.events = [];

            console.log('��� Analytics data flushed');
        } catch (error) {
            console.error('❌ Failed to flush analytics data:', error);
        }
    }

    async updateSessionHistory() {
        try {
            const sessionData = {
                sessionId: this.sessionId,
                startTime: this.startTime,
                endTime: Date.now(),
                duration: Date.now() - this.startTime,
                eventsCount: this.events.length
            };

            const existing = await chrome.storage.local.get('sessionHistory');
            const sessions = existing.sessionHistory || [];
            sessions.push(sessionData);

            // Keep only last 100 sessions
            const sessionsToStore = sessions.slice(-100);
            
            await chrome.storage.local.set({ sessionHistory: sessionsToStore });
        } catch (error) {
            console.error('❌ Failed to update session history:', error);
        }
    }

    scheduleDataFlush() {
        // Flush data every 5 minutes
        setInterval(() => {
            this.flushData();
        }, 5 * 60 * 1000);

        // Flush data when page is about to unload (service worker context)
        const globalScope = typeof window !== 'undefined' ? window : self;
        if (globalScope.addEventListener) {
            globalScope.addEventListener('beforeunload', () => {
                this.endSession();
            });
        }
    }

    // Export/Import Analytics Data
    async exportAnalyticsData() {
        try {
            const data = await chrome.storage.local.get([
                'analyticsEvents',
                'sessionHistory',
                'analyticsSettings'
            ]);

            const exportData = {
                version: '3.0.0',
                timestamp: Date.now(),
                analytics: data
            };

            return exportData;
        } catch (error) {
            console.error('❌ Failed to export analytics data:', error);
            return null;
        }
    }

    async clearAnalyticsData() {
        try {
            await chrome.storage.local.remove([
                'analyticsEvents',
                'sessionHistory'
            ]);
            
            this.events = [];
            this.metrics.clear();
            
            console.log('🗑️ Analytics data cleared');
        } catch (error) {
            console.error('❌ Failed to clear analytics data:', error);
        }
    }

    // Privacy and Anonymization
    anonymizeProperties(properties) {
        const anonymized = { ...properties };
        
        // Remove or hash sensitive data
        const sensitiveKeys = ['email', 'username', 'id', 'userId', 'channelId', 'playlistId'];
        
        sensitiveKeys.forEach(key => {
            if (anonymized[key]) {
                anonymized[key] = this.hashId(anonymized[key]);
            }
        });

        // Remove URLs and replace with domain only
        if (anonymized.url) {
            try {
                const url = new URL(anonymized.url);
                anonymized.domain = url.hostname;
                delete anonymized.url;
            } catch {
                delete anonymized.url;
            }
        }

        return anonymized;
    }

    hashId(id) {
        // Simple hash function for anonymization
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            const char = id.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return 'hash_' + Math.abs(hash).toString(36);
    }

    getCurrentUrl() {
        // Service worker context doesn't have location
        if (typeof window !== 'undefined' && window.location) {
            if (this.settings.anonymize) {
                try {
                    return new URL(window.location.href).hostname;
                } catch {
                    return 'unknown';
                }
            }
            return window.location.href;
        }
        return 'service-worker-context';
    }

    // Utility Methods
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateEventId() {
        return 'event_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Settings Management
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
        
        // Restart performance monitoring if settings changed
        if (newSettings.collectPerformance !== undefined) {
            if (this.performanceObserver) {
                this.performanceObserver.disconnect();
                this.performanceObserver = null;
            }
            
            if (newSettings.collectPerformance) {
                this.setupPerformanceMonitoring();
            }
        }
    }

    // Health Check
    getHealthStatus() {
        const now = Date.now();
        const sessionDuration = now - this.startTime;
        const memoryUsage = this.getMetricSummary('memory_usage');
        const frameRate = this.getMetricSummary('frame_rate');

        return {
            status: 'healthy',
            sessionDuration,
            eventsCount: this.events.length,
            metricsCount: this.metrics.size,
            memoryUsage: memoryUsage ? memoryUsage.latest : null,
            frameRate: frameRate ? frameRate.average : null,
            timestamp: now
        };
    }

    // Advanced Analytics Features
    performMemoryCleanup() {
        // Limit events array
        if (this.events.length > this.settings.maxEvents * 2) {
            this.events = this.events.slice(-this.settings.maxEvents);
        }
        
        // Clean old metrics
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
        for (const [key, values] of this.metrics.entries()) {
            const filtered = values.filter(v => 
                (typeof v === 'object' && v.timestamp > cutoffTime) || 
                typeof v !== 'object'
            );
            
            if (filtered.length < values.length) {
                this.metrics.set(key, filtered);
            }
        }
        
        console.log('📊 Analytics memory cleanup completed');
    }
    
    createRealTimeDashboard() {
        const dashboard = {
            timestamp: Date.now(),
            session: {
                id: this.sessionId,
                duration: Date.now() - this.startTime,
                eventsCount: this.events.length
            },
            performance: {
                memory: this.getMetricSummary('memory_usage'),
                frameRate: this.getMetricSummary('frame_rate')
            },
            usage: {
                mostUsedFeatures: this.getMostUsedFeatures().slice(0, 5),
                recentActivity: this.events.slice(-10).map(e => ({
                    name: e.name,
                    timestamp: e.timestamp
                }))
            },
            health: this.getHealthStatus(),
            alerts: this.getActiveAlerts()
        };
        
        return dashboard;
    }
    
    getActiveAlerts() {
        const alerts = [];
        
        // Memory alerts
        const memoryUsage = this.getMetricSummary('memory_usage');
        if (memoryUsage && memoryUsage.latest > 80) {
            alerts.push({
                type: 'memory',
                severity: memoryUsage.latest > 90 ? 'critical' : 'warning',
                message: `High memory usage: ${memoryUsage.latest.toFixed(1)}%`
            });
        }
        
        // Frame rate alerts
        const frameRate = this.getMetricSummary('frame_rate');
        if (frameRate && frameRate.average < 30) {
            alerts.push({
                type: 'performance',
                severity: frameRate.average < 15 ? 'critical' : 'warning',
                message: `Low frame rate: ${frameRate.average.toFixed(1)} FPS`
            });
        }
        
        // Session duration alert
        const sessionDuration = Date.now() - this.startTime;
        if (sessionDuration > 8 * 60 * 60 * 1000) { // 8 hours
            alerts.push({
                type: 'session',
                severity: 'info',
                message: `Long session: ${Math.round(sessionDuration / (60 * 60 * 1000))} hours`
            });
        }
        
        return alerts;
    }
    
    // Advanced performance tracking
    trackAPIPerformance(endpoint, responseTime, success, quotaUsed = 0) {
        this.trackEvent('api_performance', {
            endpoint,
            responseTime,
            success,
            quotaUsed,
            timestamp: Date.now()
        });
        
        // Update API metrics
        this.updateMetric(`api_response_time_${endpoint}`, responseTime);
        this.updateMetric('api_quota_usage', quotaUsed);
        
        if (!success) {
            this.updateMetric(`api_errors_${endpoint}`, 1);
        }
    }
    
    trackStoragePerformance(operation, duration, cacheHit = false) {
        this.trackEvent('storage_performance', {
            operation,
            duration,
            cacheHit,
            timestamp: Date.now()
        });
        
        this.updateMetric(`storage_${operation}_time`, duration);
        if (cacheHit) {
            this.updateMetric('storage_cache_hits', 1);
        } else {
            this.updateMetric('storage_cache_misses', 1);
        }
    }
    
    trackServiceWorkerHealth(healthData) {
        this.trackEvent('service_worker_health', {
            ...healthData,
            timestamp: Date.now()
        });
        
        // Track specific metrics
        if (healthData.memoryUtilization) {
            this.updateMetric('sw_memory_utilization', healthData.memoryUtilization);
        }
        
        if (healthData.activeConnections !== undefined) {
            this.updateMetric('sw_active_connections', healthData.activeConnections);
        }
    }
    
    generatePerformanceReport() {
        const report = {
            timestamp: Date.now(),
            period: {
                start: this.startTime,
                end: Date.now(),
                duration: Date.now() - this.startTime
            },
            summary: {
                totalEvents: this.events.length,
                uniqueFeatures: new Set(this.events.map(e => e.name.split('_')[0])).size,
                errorEvents: this.events.filter(e => e.name === 'error').length,
                performanceEvents: this.events.filter(e => e.name.includes('performance')).length
            },
            performance: {
                api: this.getAPIPerformanceStats(),
                storage: this.getStoragePerformanceStats(),
                serviceWorker: this.getServiceWorkerStats(),
                ui: this.getUIPerformanceStats()
            },
            usage: {
                mostUsedFeatures: this.getMostUsedFeatures(),
                peakUsageHours: this.getPeakUsageHours(),
                userPatterns: this.analyzeUserPatterns()
            },
            issues: this.identifyPerformanceIssues()
        };
        
        return report;
    }
    
    getAPIPerformanceStats() {
        const apiEvents = this.events.filter(e => e.name === 'api_performance');
        
        if (apiEvents.length === 0) {
            return { noData: true };
        }
        
        const responseTimes = apiEvents.map(e => e.properties.responseTime);
        const successCount = apiEvents.filter(e => e.properties.success).length;
        const totalQuotaUsed = apiEvents.reduce((sum, e) => sum + (e.properties.quotaUsed || 0), 0);
        
        return {
            totalRequests: apiEvents.length,
            successRate: (successCount / apiEvents.length) * 100,
            averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
            minResponseTime: Math.min(...responseTimes),
            maxResponseTime: Math.max(...responseTimes),
            totalQuotaUsed,
            averageQuotaPerRequest: totalQuotaUsed / apiEvents.length
        };
    }

    getStoragePerformanceStats() {
        const storageEvents = this.events.filter(e => e.name.includes('storage'));
        
        if (storageEvents.length === 0) {
            return { noData: true };
        }

        const operationTimes = storageEvents
            .filter(e => e.properties && e.properties.duration)
            .map(e => e.properties.duration);

        const readEvents = storageEvents.filter(e => e.name.includes('read') || e.name.includes('get'));
        const writeEvents = storageEvents.filter(e => e.name.includes('write') || e.name.includes('set'));
        const errorEvents = storageEvents.filter(e => e.name.includes('error'));

        return {
            totalOperations: storageEvents.length,
            readOperations: readEvents.length,
            writeOperations: writeEvents.length,
            errorCount: errorEvents.length,
            errorRate: (errorEvents.length / storageEvents.length) * 100,
            averageOperationTime: operationTimes.length > 0 
                ? operationTimes.reduce((sum, time) => sum + time, 0) / operationTimes.length 
                : 0,
            cacheHitRate: this.calculateCacheHitRate()
        };
    }

    getServiceWorkerStats() {
        const swEvents = this.events.filter(e => e.name.includes('service_worker') || e.name.includes('background'));
        
        if (swEvents.length === 0) {
            return { noData: true };
        }

        const restartEvents = swEvents.filter(e => e.name.includes('restart'));
        const healthEvents = swEvents.filter(e => e.name.includes('health'));
        const keepAliveEvents = swEvents.filter(e => e.name.includes('keep_alive'));

        return {
            totalEvents: swEvents.length,
            restartCount: restartEvents.length,
            healthChecks: healthEvents.length,
            keepAliveEvents: keepAliveEvents.length,
            uptime: Date.now() - this.startTime,
            averageEventInterval: swEvents.length > 1 
                ? (Date.now() - this.startTime) / swEvents.length 
                : 0
        };
    }

    getUIPerformanceStats() {
        const uiEvents = this.events.filter(e => e.name.includes('ui') || e.name.includes('interaction'));
        
        if (uiEvents.length === 0) {
            return { noData: true };
        }

        const clickEvents = uiEvents.filter(e => e.name.includes('click'));
        const loadEvents = uiEvents.filter(e => e.name.includes('load') || e.name.includes('render'));
        const dragEvents = uiEvents.filter(e => e.name.includes('drag'));

        const renderTimes = loadEvents
            .filter(e => e.properties && e.properties.duration)
            .map(e => e.properties.duration);

        return {
            totalInteractions: uiEvents.length,
            clickEvents: clickEvents.length,
            renderEvents: loadEvents.length,
            dragAndDropEvents: dragEvents.length,
            averageRenderTime: renderTimes.length > 0
                ? renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length
                : 0,
            interactionRate: uiEvents.length / ((Date.now() - this.startTime) / 1000) // events per second
        };
    }

    analyzeUserPatterns() {
        const patterns = {
            sessionStartTimes: [],
            featureSequences: [],
            errorPatterns: [],
            performancePatterns: []
        };

        // Analyze session start times
        const sessionEvents = this.events.filter(e => e.name === 'session_start');
        patterns.sessionStartTimes = sessionEvents.map(e => new Date(e.timestamp).getHours());

        // Analyze feature usage sequences
        const featureEvents = this.events.filter(e => e.name.includes('_'));
        let currentSequence = [];
        
        featureEvents.forEach(event => {
            const feature = event.name.split('_')[0];
            if (currentSequence.length === 0 || currentSequence[currentSequence.length - 1] !== feature) {
                currentSequence.push(feature);
                if (currentSequence.length > 3) {
                    patterns.featureSequences.push([...currentSequence.slice(-3)]);
                }
            }
        });

        // Analyze error patterns
        const errorEvents = this.events.filter(e => e.name === 'error');
        patterns.errorPatterns = errorEvents.map(e => ({
            type: e.properties.context?.operation || 'unknown',
            frequency: errorEvents.filter(err => 
                err.properties.context?.operation === e.properties.context?.operation
            ).length
        }));

        // Analyze performance patterns
        const perfEvents = this.events.filter(e => e.name.includes('performance') || e.name === 'benchmark');
        patterns.performancePatterns = this.groupPerformanceByTimeOfDay(perfEvents);

        return patterns;
    }

    groupPerformanceByTimeOfDay(perfEvents) {
        const hourlyPerf = new Array(24).fill(0).map(() => ({ count: 0, totalTime: 0 }));
        
        perfEvents.forEach(event => {
            const hour = new Date(event.timestamp).getHours();
            const duration = event.properties.duration || 0;
            
            hourlyPerf[hour].count++;
            hourlyPerf[hour].totalTime += duration;
        });

        return hourlyPerf.map((data, hour) => ({
            hour,
            averageTime: data.count > 0 ? data.totalTime / data.count : 0,
            eventCount: data.count
        }));
    }

    identifyPerformanceIssues() {
        const issues = [];

        // Check for high error rate
        const errorEvents = this.events.filter(e => e.name === 'error');
        const errorRate = (errorEvents.length / this.events.length) * 100;
        
        if (errorRate > 5) {
            issues.push({
                type: 'high_error_rate',
                severity: errorRate > 10 ? 'critical' : 'warning',
                value: errorRate,
                description: `High error rate: ${errorRate.toFixed(2)}%`
            });
        }

        // Check for slow API responses
        const apiEvents = this.events.filter(e => e.name === 'api_performance');
        if (apiEvents.length > 0) {
            const avgResponseTime = apiEvents.reduce((sum, e) => sum + (e.properties.responseTime || 0), 0) / apiEvents.length;
            
            if (avgResponseTime > 2000) {
                issues.push({
                    type: 'slow_api_response',
                    severity: avgResponseTime > 5000 ? 'critical' : 'warning',
                    value: avgResponseTime,
                    description: `Slow API responses: ${avgResponseTime.toFixed(0)}ms average`
                });
            }
        }

        // Check for memory issues
        const memoryMetric = this.getMetricSummary('memory_usage');
        if (memoryMetric && memoryMetric.latest) {
            const memoryUsage = memoryMetric.latest.used / memoryMetric.latest.total;
            
            if (memoryUsage > 0.8) {
                issues.push({
                    type: 'high_memory_usage',
                    severity: memoryUsage > 0.9 ? 'critical' : 'warning',
                    value: memoryUsage * 100,
                    description: `High memory usage: ${(memoryUsage * 100).toFixed(1)}%`
                });
            }
        }

        // Check for frame rate issues
        const frameRateMetric = this.getMetricSummary('frame_rate');
        if (frameRateMetric && frameRateMetric.average < 30) {
            issues.push({
                type: 'low_frame_rate',
                severity: frameRateMetric.average < 15 ? 'critical' : 'warning',
                value: frameRateMetric.average,
                description: `Low frame rate: ${frameRateMetric.average.toFixed(1)} FPS`
            });
        }

        return issues;
    }

    calculateCacheHitRate() {
        const cacheEvents = this.events.filter(e => e.name.includes('cache'));
        const hitEvents = cacheEvents.filter(e => e.name.includes('hit'));
        
        return cacheEvents.length > 0 ? (hitEvents.length / cacheEvents.length) * 100 : 0;
    }
    
    // Export analytics data in different formats
    async exportAnalyticsReport(format = 'json') {
        const report = this.generatePerformanceReport();
        
        switch (format) {
            case 'csv':
                return this.exportToCSV(report);
            case 'json':
            default:
                return JSON.stringify(report, null, 2);
        }
    }
    
    exportToCSV(report) {
        // Convert key metrics to CSV format
        const rows = [
            ['Metric', 'Value', 'Timestamp'],
            ['Session Duration', report.period.duration, report.timestamp],
            ['Total Events', report.summary.totalEvents, report.timestamp],
            ['Error Events', report.summary.errorEvents, report.timestamp]
        ];
        
        if (report.performance.api && !report.performance.api.noData) {
            rows.push(
                ['API Success Rate', `${report.performance.api.successRate}%`, report.timestamp],
                ['API Avg Response Time', `${report.performance.api.averageResponseTime}ms`, report.timestamp],
                ['API Total Requests', report.performance.api.totalRequests, report.timestamp]
            );
        }
        
        return rows.map(row => row.join(',')).join('\n');
    }

    // Cleanup
    destroy() {
        if (this.performanceObserver) {
            this.performanceObserver.disconnect();
        }
        
        this.endSession();
        this.events = [];
        this.metrics.clear();
        this.initialized = false;
    }
}