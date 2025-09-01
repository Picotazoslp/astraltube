/**
 * AstralTube v3 - Health Checker System
 * Monitors system health and provides startup verification
 */

export class HealthChecker {
    constructor() {
        this.initialized = false;
        this.components = new Map();
        this.healthChecks = new Map();
        this.monitoringActive = false;
        this.healthHistory = [];
        this.maxHistoryEntries = 100;
        
        // Health check intervals
        this.intervals = {
            quick: 30000,   // 30 seconds
            standard: 60000, // 1 minute
            extended: 300000 // 5 minutes
        };
        
        // Component health thresholds
        this.thresholds = {
            response_time: 2000, // 2 seconds
            error_rate: 0.05,    // 5%
            memory_usage: 100,   // 100MB
            storage_usage: 0.8   // 80% of quota
        };
        
        // Current system metrics
        this.metrics = {
            uptime: 0,
            totalRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            memoryUsage: 0,
            storageUsage: 0,
            lastHealthCheck: null
        };
        
        this.init();
    }

    // Helper to safely access window objects (service worker compatible)
    safeWindowAccess(path) {
        if (typeof window === 'undefined') {
            return null;
        }
        
        try {
            const parts = path.split('.');
            let obj = window;
            for (const part of parts) {
                if (obj && typeof obj === 'object' && part in obj) {
                    obj = obj[part];
                } else {
                    return null;
                }
            }
            return obj;
        } catch {
            return null;
        }
    }

    async init() {
        try {
            console.log('🏥 Initializing Health Checker...');
            
            // Register core components
            this.registerCoreComponents();
            
            // Setup health checks
            this.setupHealthChecks();
            
            // Perform initial system check
            await this.performStartupCheck();
            
            this.initialized = true;
            console.log('✅ Health Checker initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize Health Checker:', error);
        }
    }

    registerCoreComponents() {
        // Register all core extension components
        this.registerComponent('serviceWorker', {
            name: 'Service Worker',
            critical: true,
            checkInterval: this.intervals.quick,
            healthCheck: () => this.checkServiceWorker(),
            dependencies: []
        });

        this.registerComponent('storage', {
            name: 'Storage Manager',
            critical: true,
            checkInterval: this.intervals.standard,
            healthCheck: () => this.checkStorage(),
            dependencies: []
        });

        this.registerComponent('api', {
            name: 'YouTube API',
            critical: true,
            checkInterval: this.intervals.standard,
            healthCheck: () => this.checkAPI(),
            dependencies: ['serviceWorker', 'storage']
        });

        this.registerComponent('authentication', {
            name: 'Authentication',
            critical: true,
            checkInterval: this.intervals.extended,
            healthCheck: () => this.checkAuthentication(),
            dependencies: ['api']
        });

        this.registerComponent('contentScript', {
            name: 'Content Scripts',
            critical: false,
            checkInterval: this.intervals.standard,
            healthCheck: () => this.checkContentScripts(),
            dependencies: ['serviceWorker']
        });

        this.registerComponent('sidebar', {
            name: 'Sidebar',
            critical: false,
            checkInterval: this.intervals.extended,
            healthCheck: () => this.checkSidebar(),
            dependencies: ['contentScript', 'storage']
        });

        this.registerComponent('deckMode', {
            name: 'Deck Mode',
            critical: false,
            checkInterval: this.intervals.extended,
            healthCheck: () => this.checkDeckMode(),
            dependencies: ['contentScript', 'api']
        });

        this.registerComponent('playlistManager', {
            name: 'Playlist Manager',
            critical: false,
            checkInterval: this.intervals.extended,
            healthCheck: () => this.checkPlaylistManager(),
            dependencies: ['api', 'storage']
        });

        this.registerComponent('subscriptionManager', {
            name: 'Subscription Manager',
            critical: false,
            checkInterval: this.intervals.extended,
            healthCheck: () => this.checkSubscriptionManager(),
            dependencies: ['api', 'storage']
        });

        this.registerComponent('credentials', {
            name: 'Credentials Manager',
            critical: true,
            checkInterval: this.intervals.extended,
            healthCheck: () => this.checkCredentials(),
            dependencies: ['storage']
        });

        this.registerComponent('errorHandler', {
            name: 'Error Handler',
            critical: true,
            checkInterval: this.intervals.standard,
            healthCheck: () => this.checkErrorHandler(),
            dependencies: []
        });
    }

    registerComponent(id, config) {
        this.components.set(id, {
            id,
            ...config,
            status: 'unknown',
            lastCheck: null,
            lastSuccess: null,
            consecutiveFailures: 0,
            averageResponseTime: 0,
            errorRate: 0,
            enabled: true,
            metadata: {}
        });
    }

    setupHealthChecks() {
        // Setup periodic health checks for each component
        for (const [id, component] of this.components.entries()) {
            if (component.enabled) {
                this.scheduleHealthCheck(id, component.checkInterval);
            }
        }
    }

    scheduleHealthCheck(componentId, interval) {
        const component = this.components.get(componentId);
        if (!component) return;

        // Clear existing timer if any
        if (component.timer) {
            clearInterval(component.timer);
        }

        // Schedule recurring health check
        component.timer = setInterval(async () => {
            await this.performHealthCheck(componentId);
        }, interval);
    }

    async performStartupCheck() {
        console.log('🚀 Performing startup health check...');
        
        const startupResults = {
            timestamp: Date.now(),
            overall: 'unknown',
            components: {},
            criticalFailures: [],
            warnings: [],
            duration: 0
        };

        const startTime = Date.now();
        
        try {
            // Check critical components first in dependency order
            const criticalComponents = this.getSortedCriticalComponents();
            
            for (const componentId of criticalComponents) {
                const result = await this.performHealthCheck(componentId, { startup: true });
                startupResults.components[componentId] = result;
                
                if (result.status === 'unhealthy' || result.status === 'error') {
                    startupResults.criticalFailures.push({
                        component: componentId,
                        error: result.error,
                        details: result.details
                    });
                }
            }
            
            // Check non-critical components
            const nonCriticalComponents = Array.from(this.components.keys())
                .filter(id => !this.components.get(id).critical);
            
            for (const componentId of nonCriticalComponents) {
                const result = await this.performHealthCheck(componentId, { startup: true });
                startupResults.components[componentId] = result;
                
                if (result.status === 'unhealthy' || result.status === 'error') {
                    startupResults.warnings.push({
                        component: componentId,
                        error: result.error,
                        details: result.details
                    });
                }
            }
            
            // Determine overall startup health
            if (startupResults.criticalFailures.length > 0) {
                startupResults.overall = 'critical_failure';
            } else if (startupResults.warnings.length > 3) {
                startupResults.overall = 'degraded';
            } else if (startupResults.warnings.length > 0) {
                startupResults.overall = 'healthy_with_warnings';
            } else {
                startupResults.overall = 'healthy';
            }
            
            startupResults.duration = Date.now() - startTime;
            
            // Log startup results
            this.logStartupResults(startupResults);
            
            // Start continuous monitoring if startup was successful
            if (startupResults.overall !== 'critical_failure') {
                this.startContinuousMonitoring();
            }
            
            return startupResults;
            
        } catch (error) {
            console.error('❌ Startup health check failed:', error);
            startupResults.overall = 'startup_error';
            startupResults.error = error;
            startupResults.duration = Date.now() - startTime;
            
            return startupResults;
        }
    }

    getSortedCriticalComponents() {
        // Sort critical components by dependencies
        const critical = Array.from(this.components.entries())
            .filter(([id, component]) => component.critical)
            .map(([id]) => id);
        
        const sorted = [];
        const visited = new Set();
        
        const visit = (componentId) => {
            if (visited.has(componentId)) return;
            visited.add(componentId);
            
            const component = this.components.get(componentId);
            if (component && component.dependencies) {
                for (const dep of component.dependencies) {
                    if (critical.includes(dep)) {
                        visit(dep);
                    }
                }
            }
            
            sorted.push(componentId);
        };
        
        for (const componentId of critical) {
            visit(componentId);
        }
        
        return sorted;
    }

    async performHealthCheck(componentId, context = {}) {
        const component = this.components.get(componentId);
        if (!component || !component.enabled) {
            return { status: 'disabled', timestamp: Date.now() };
        }

        const startTime = Date.now();
        component.lastCheck = startTime;

        try {
            console.log(`🔍 Checking health of ${component.name}...`);
            
            // Perform the actual health check
            const result = await component.healthCheck();
            
            const responseTime = Date.now() - startTime;
            
            // Update component metrics
            component.averageResponseTime = this.calculateRunningAverage(
                component.averageResponseTime,
                responseTime,
                10 // window size
            );

            if (result.status === 'healthy') {
                component.lastSuccess = Date.now();
                component.consecutiveFailures = 0;
                component.status = 'healthy';
            } else {
                component.consecutiveFailures++;
                component.status = result.status || 'unhealthy';
                
                // Update error rate
                component.errorRate = Math.min(1, component.consecutiveFailures / 10);
            }

            // Add context and timing information
            const healthResult = {
                ...result,
                componentId,
                timestamp: Date.now(),
                responseTime,
                consecutiveFailures: component.consecutiveFailures,
                context
            };

            // Store in health history
            this.addToHealthHistory(healthResult);

            // Log result
            this.logHealthCheckResult(component, healthResult);

            return healthResult;

        } catch (error) {
            console.error(`❌ Health check failed for ${component.name}:`, error);
            
            component.consecutiveFailures++;
            component.status = 'error';
            component.errorRate = Math.min(1, component.consecutiveFailures / 10);
            
            const errorResult = {
                status: 'error',
                componentId,
                timestamp: Date.now(),
                responseTime: Date.now() - startTime,
                error: error.message,
                consecutiveFailures: component.consecutiveFailures,
                context
            };

            this.addToHealthHistory(errorResult);
            
            return errorResult;
        }
    }

    // Individual component health checks
    async checkServiceWorker() {
        try {
            // Check if service worker is responding
            const response = await chrome.runtime.sendMessage({ action: 'ping' });
            
            if (response && response.status === 'alive') {
                return {
                    status: 'healthy',
                    details: {
                        version: response.version,
                        initialized: response.initialized
                    }
                };
            } else {
                return {
                    status: 'unhealthy',
                    details: { error: 'Service worker not responding' }
                };
            }
        } catch (error) {
            return {
                status: 'error',
                details: { error: error.message }
            };
        }
    }

    async checkStorage() {
        try {
            // Test storage read/write
            const testKey = 'health_check_test';
            const testValue = Date.now().toString();
            
            await chrome.storage.local.set({ [testKey]: testValue });
            const result = await chrome.storage.local.get(testKey);
            await chrome.storage.local.remove(testKey);
            
            if (result[testKey] === testValue) {
                // Check storage usage
                const usage = await this.getStorageUsage();
                
                return {
                    status: usage.percentage > this.thresholds.storage_usage ? 'unhealthy' : 'healthy',
                    details: {
                        usage: usage,
                        test: 'passed'
                    }
                };
            } else {
                return {
                    status: 'unhealthy',
                    details: { error: 'Storage read/write test failed' }
                };
            }
        } catch (error) {
            return {
                status: 'error',
                details: { error: error.message }
            };
        }
    }

    async checkAPI() {
        try {
            // Test basic API connectivity
            const response = await chrome.runtime.sendMessage({ action: 'checkAPIHealth' });
            
            if (response?.success) {
                const apiHealth = response.data;
                
                return {
                    status: apiHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
                    details: apiHealth
                };
            } else {
                return {
                    status: 'unhealthy',
                    details: { error: response?.error || 'API health check failed' }
                };
            }
        } catch (error) {
            return {
                status: 'error',
                details: { error: error.message }
            };
        }
    }

    async checkAuthentication() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'checkAuthStatus' });
            
            if (response?.success) {
                const authStatus = response.data;
                
                return {
                    status: authStatus.authenticated ? 'healthy' : 'unhealthy',
                    details: {
                        authenticated: authStatus.authenticated,
                        tokenExpiry: authStatus.tokenExpiry,
                        lastRefresh: authStatus.lastRefresh
                    }
                };
            } else {
                return {
                    status: 'unhealthy',
                    details: { error: response?.error || 'Auth status check failed' }
                };
            }
        } catch (error) {
            return {
                status: 'error',
                details: { error: error.message }
            };
        }
    }

    async checkContentScripts() {
        try {
            // Check if on YouTube and content scripts are loaded
            // Service worker context doesn't have location
            const location = this.safeWindowAccess('location');
            if (location && !location.hostname.includes('youtube.com')) {
                return {
                    status: 'not_applicable',
                    details: { reason: 'Not on YouTube' }
                };
            }

            // Try to query active tab content scripts
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab && tab.url.includes('youtube.com')) {
                try {
                    const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
                    
                    if (response?.status === 'alive') {
                        return {
                            status: 'healthy',
                            details: { tabId: tab.id, response }
                        };
                    }
                } catch (tabError) {
                    return {
                        status: 'unhealthy',
                        details: { error: 'Content script not responding', tabId: tab.id }
                    };
                }
            }

            return {
                status: 'unknown',
                details: { reason: 'No active YouTube tab found' }
            };
        } catch (error) {
            return {
                status: 'error',
                details: { error: error.message }
            };
        }
    }

    async checkSidebar() {
        try {
            // Check if sidebar component is available
            const sidebar = this.safeWindowAccess('astralTubeSidebar');
            const sidebarExists = sidebar && sidebar.isInitialized;
            
            return {
                status: sidebarExists ? 'healthy' : 'not_loaded',
                details: {
                    initialized: sidebarExists,
                    visible: sidebarExists ? sidebar.isVisible : false
                }
            };
        } catch (error) {
            return {
                status: 'error',
                details: { error: error.message }
            };
        }
    }

    async checkDeckMode() {
        try {
            // Check if deck mode component is available
            const deckMode = this.safeWindowAccess('astralTubeDeckMode');
            const deckModeExists = deckMode && deckMode.isInitialized;
            
            return {
                status: deckModeExists ? 'healthy' : 'not_loaded',
                details: {
                    initialized: deckModeExists,
                    enabled: deckModeExists ? deckMode.isEnabled : false
                }
            };
        } catch (error) {
            return {
                status: 'error',
                details: { error: error.message }
            };
        }
    }

    async checkPlaylistManager() {
        try {
            const playlistManager = this.safeWindowAccess('astralTubePlaylistManager');
            const managerExists = playlistManager && playlistManager.isInitialized;
            
            return {
                status: managerExists ? 'healthy' : 'not_loaded',
                details: {
                    initialized: managerExists,
                    playlistCount: managerExists ? playlistManager.getAllPlaylists().length : 0
                }
            };
        } catch (error) {
            return {
                status: 'error',
                details: { error: error.message }
            };
        }
    }

    async checkSubscriptionManager() {
        try {
            const subscriptionManager = this.safeWindowAccess('astralTubeSubscriptionManager');
            const managerExists = subscriptionManager && subscriptionManager.isInitialized;
            
            return {
                status: managerExists ? 'healthy' : 'not_loaded',
                details: {
                    initialized: managerExists,
                    subscriptionCount: managerExists ? subscriptionManager.subscriptions.size : 0
                }
            };
        } catch (error) {
            return {
                status: 'error',
                details: { error: error.message }
            };
        }
    }

    async checkCredentials() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'checkCredentialsHealth' });
            
            if (response?.success) {
                return {
                    status: response.data.healthy ? 'healthy' : 'unhealthy',
                    details: response.data
                };
            } else {
                return {
                    status: 'unhealthy',
                    details: { error: response?.error || 'Credentials check failed' }
                };
            }
        } catch (error) {
            return {
                status: 'error',
                details: { error: error.message }
            };
        }
    }

    async checkErrorHandler() {
        try {
            // Check if error handler is available and functioning
            const errorHandler = this.safeWindowAccess('errorHandler');
            if (errorHandler) {
                const healthStatus = errorHandler.getHealthStatus();
                
                return {
                    status: healthStatus.health === 'healthy' ? 'healthy' : 'unhealthy',
                    details: healthStatus
                };
            } else {
                return {
                    status: 'not_loaded',
                    details: { error: 'Error handler not available' }
                };
            }
        } catch (error) {
            return {
                status: 'error',
                details: { error: error.message }
            };
        }
    }

    // Monitoring and reporting methods
    startContinuousMonitoring() {
        if (this.monitoringActive) return;
        
        console.log('📊 Starting continuous health monitoring...');
        this.monitoringActive = true;
        
        // Start system metrics collection
        this.metricsTimer = setInterval(() => {
            this.collectSystemMetrics();
        }, 30000); // Every 30 seconds
        
        // Start periodic full health reports
        this.reportTimer = setInterval(() => {
            this.generateHealthReport();
        }, 300000); // Every 5 minutes
    }

    stopContinuousMonitoring() {
        console.log('📊 Stopping continuous health monitoring...');
        this.monitoringActive = false;
        
        // Clear component timers
        for (const component of this.components.values()) {
            if (component.timer) {
                clearInterval(component.timer);
                component.timer = null;
            }
        }
        
        // Clear system timers
        if (this.metricsTimer) {
            clearInterval(this.metricsTimer);
            this.metricsTimer = null;
        }
        
        if (this.reportTimer) {
            clearInterval(this.reportTimer);
            this.reportTimer = null;
        }
    }

    async collectSystemMetrics() {
        try {
            // Update uptime
            this.metrics.uptime = Date.now() - (this.startTime || Date.now());
            
            // Get memory usage estimate (available in both browser and service worker contexts)
            if (typeof performance !== 'undefined' && performance.memory) {
                this.metrics.memoryUsage = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
            } else {
                this.metrics.memoryUsage = 0;
            }
            
            // Get storage usage
            const storageUsage = await this.getStorageUsage();
            this.metrics.storageUsage = storageUsage.percentage;
            
            // Calculate error rates from components
            let totalRequests = 0;
            let failedRequests = 0;
            let totalResponseTime = 0;
            let componentCount = 0;
            
            for (const component of this.components.values()) {
                if (component.lastCheck) {
                    totalRequests++;
                    componentCount++;
                    
                    if (component.status === 'error' || component.status === 'unhealthy') {
                        failedRequests++;
                    }
                    
                    totalResponseTime += component.averageResponseTime || 0;
                }
            }
            
            this.metrics.totalRequests = totalRequests;
            this.metrics.failedRequests = failedRequests;
            this.metrics.averageResponseTime = componentCount > 0 ? totalResponseTime / componentCount : 0;
            this.metrics.lastHealthCheck = Date.now();
            
        } catch (error) {
            console.error('❌ Failed to collect system metrics:', error);
        }
    }

    async getStorageUsage() {
        try {
            // Check if navigator.storage is available (works in both contexts)
            const globalScope = typeof window !== 'undefined' ? window : self;
            if (globalScope.navigator && globalScope.navigator.storage) {
                const quota = await globalScope.navigator.storage.estimate();
                
                return {
                    used: quota.usage || 0,
                    total: quota.quota || 0,
                    percentage: quota.quota ? (quota.usage || 0) / quota.quota : 0,
                    available: quota.quota ? quota.quota - (quota.usage || 0) : 0
                };
            } else {
                // Fallback for contexts where navigator.storage is not available
                return { used: 0, total: 0, percentage: 0, available: 0 };
            }
        } catch (error) {
            console.error('❌ Failed to get storage usage:', error);
            return { used: 0, total: 0, percentage: 0, available: 0 };
        }
    }

    generateHealthReport() {
        const report = {
            timestamp: Date.now(),
            overall: this.calculateOverallHealth(),
            components: {},
            metrics: { ...this.metrics },
            recommendations: []
        };

        // Component status summary
        for (const [id, component] of this.components.entries()) {
            report.components[id] = {
                name: component.name,
                status: component.status,
                critical: component.critical,
                lastCheck: component.lastCheck,
                lastSuccess: component.lastSuccess,
                consecutiveFailures: component.consecutiveFailures,
                averageResponseTime: component.averageResponseTime,
                errorRate: component.errorRate
            };
        }

        // Generate recommendations
        report.recommendations = this.generateRecommendations(report);

        // Store in health history
        this.addToHealthHistory(report);

        // Log summary
        console.log(`🏥 Health Report - Overall: ${report.overall}`, {
            healthy: Object.values(report.components).filter(c => c.status === 'healthy').length,
            unhealthy: Object.values(report.components).filter(c => c.status === 'unhealthy').length,
            errors: Object.values(report.components).filter(c => c.status === 'error').length,
            recommendations: report.recommendations.length
        });

        return report;
    }

    calculateOverallHealth() {
        const criticalComponents = Array.from(this.components.values()).filter(c => c.critical);
        const nonCriticalComponents = Array.from(this.components.values()).filter(c => !c.critical);

        // Check critical components
        const criticalHealthy = criticalComponents.filter(c => c.status === 'healthy').length;
        const criticalTotal = criticalComponents.length;
        
        if (criticalHealthy < criticalTotal) {
            return 'critical'; // Any critical component failure is critical
        }

        // Check non-critical components
        const nonCriticalHealthy = nonCriticalComponents.filter(c => c.status === 'healthy').length;
        const nonCriticalTotal = nonCriticalComponents.length;
        
        if (nonCriticalTotal > 0) {
            const healthyRatio = nonCriticalHealthy / nonCriticalTotal;
            
            if (healthyRatio >= 0.8) {
                return 'healthy';
            } else if (healthyRatio >= 0.6) {
                return 'degraded';
            } else {
                return 'unhealthy';
            }
        }

        return 'healthy';
    }

    generateRecommendations(report) {
        const recommendations = [];

        // Check memory usage
        if (report.metrics.memoryUsage > this.thresholds.memory_usage) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                message: `High memory usage detected (${report.metrics.memoryUsage}MB). Consider restarting the extension.`,
                action: 'restart_extension'
            });
        }

        // Check storage usage
        if (report.metrics.storageUsage > this.thresholds.storage_usage) {
            recommendations.push({
                type: 'storage',
                priority: 'medium',
                message: `Storage usage is high (${Math.round(report.metrics.storageUsage * 100)}%). Consider clearing old data.`,
                action: 'cleanup_storage'
            });
        }

        // Check error rates
        if (report.metrics.failedRequests > 0) {
            const errorRate = report.metrics.failedRequests / report.metrics.totalRequests;
            if (errorRate > this.thresholds.error_rate) {
                recommendations.push({
                    type: 'reliability',
                    priority: 'high',
                    message: `High error rate detected (${Math.round(errorRate * 100)}%). Check error logs.`,
                    action: 'check_error_logs'
                });
            }
        }

        // Check response times
        if (report.metrics.averageResponseTime > this.thresholds.response_time) {
            recommendations.push({
                type: 'performance',
                priority: 'medium',
                message: `Slow response times detected (${Math.round(report.metrics.averageResponseTime)}ms avg).`,
                action: 'optimize_performance'
            });
        }

        // Check component failures
        for (const [id, component] of Object.entries(report.components)) {
            if (component.consecutiveFailures > 3) {
                recommendations.push({
                    type: 'component',
                    priority: component.critical ? 'critical' : 'high',
                    message: `Component "${component.name}" has ${component.consecutiveFailures} consecutive failures.`,
                    action: 'restart_component',
                    componentId: id
                });
            }
        }

        return recommendations;
    }

    // Utility methods
    addToHealthHistory(entry) {
        this.healthHistory.unshift(entry);
        
        if (this.healthHistory.length > this.maxHistoryEntries) {
            this.healthHistory = this.healthHistory.slice(0, this.maxHistoryEntries);
        }
    }

    calculateRunningAverage(currentAvg, newValue, windowSize) {
        if (currentAvg === 0) return newValue;
        
        const weight = 1 / Math.min(windowSize, 10);
        return (1 - weight) * currentAvg + weight * newValue;
    }

    logStartupResults(results) {
        const { overall, criticalFailures, warnings, duration } = results;
        
        console.log(`🚀 Startup Health Check Complete (${duration}ms):`);
        console.log(`   Overall Status: ${overall}`);
        
        if (criticalFailures.length > 0) {
            console.error(`   ❌ Critical Failures: ${criticalFailures.length}`);
            criticalFailures.forEach(failure => {
                console.error(`      - ${failure.component}: ${failure.error}`);
            });
        }
        
        if (warnings.length > 0) {
            console.warn(`   ⚠️ Warnings: ${warnings.length}`);
            warnings.forEach(warning => {
                console.warn(`      - ${warning.component}: ${warning.error}`);
            });
        }
        
        const healthyComponents = Object.values(results.components)
            .filter(c => c.status === 'healthy').length;
        const totalComponents = Object.keys(results.components).length;
        
        console.log(`   ✅ Healthy Components: ${healthyComponents}/${totalComponents}`);
    }

    logHealthCheckResult(component, result) {
        const statusEmoji = {
            healthy: '✅',
            unhealthy: '⚠️',
            error: '❌',
            disabled: '⏸️',
            not_applicable: 'ℹ️',
            not_loaded: '⏳',
            unknown: '❓'
        };

        const emoji = statusEmoji[result.status] || '❓';
        const responseTime = result.responseTime ? ` (${result.responseTime}ms)` : '';
        
        console.log(`${emoji} ${component.name}: ${result.status}${responseTime}`);
        
        if (result.status === 'error' || result.status === 'unhealthy') {
            console.warn(`   Details:`, result.details);
        }
    }

    // Public API methods
    getComponentHealth(componentId) {
        const component = this.components.get(componentId);
        if (!component) return null;

        return {
            id: componentId,
            name: component.name,
            status: component.status,
            critical: component.critical,
            lastCheck: component.lastCheck,
            lastSuccess: component.lastSuccess,
            consecutiveFailures: component.consecutiveFailures,
            averageResponseTime: component.averageResponseTime,
            errorRate: component.errorRate
        };
    }

    getAllComponentsHealth() {
        const health = {};
        
        for (const [id, component] of this.components.entries()) {
            health[id] = this.getComponentHealth(id);
        }
        
        return health;
    }

    getSystemHealth() {
        return {
            overall: this.calculateOverallHealth(),
            components: this.getAllComponentsHealth(),
            metrics: { ...this.metrics },
            uptime: this.metrics.uptime,
            lastCheck: this.metrics.lastHealthCheck,
            monitoringActive: this.monitoringActive
        };
    }

    getHealthHistory(limit = 10) {
        return this.healthHistory.slice(0, limit);
    }

    async forceHealthCheck(componentId = null) {
        if (componentId) {
            return await this.performHealthCheck(componentId, { forced: true });
        } else {
            const results = {};
            
            for (const id of this.components.keys()) {
                results[id] = await this.performHealthCheck(id, { forced: true });
            }
            
            return results;
        }
    }

    enableComponent(componentId) {
        const component = this.components.get(componentId);
        if (component) {
            component.enabled = true;
            this.scheduleHealthCheck(componentId, component.checkInterval);
            console.log(`✅ Enabled health monitoring for ${component.name}`);
        }
    }

    disableComponent(componentId) {
        const component = this.components.get(componentId);
        if (component) {
            component.enabled = false;
            if (component.timer) {
                clearInterval(component.timer);
                component.timer = null;
            }
            console.log(`⏸️ Disabled health monitoring for ${component.name}`);
        }
    }

    // Cleanup
    destroy() {
        console.log('🧹 Cleaning up Health Checker...');
        
        this.stopContinuousMonitoring();
        this.components.clear();
        this.healthChecks.clear();
        this.healthHistory = [];
        this.initialized = false;
    }
}

// Export singleton instance
export const healthChecker = new HealthChecker();