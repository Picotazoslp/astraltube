/**
 * AstralTube v3 - Error Handler and Circuit Breaker
 * Comprehensive error handling, recovery, and resilience system
 */

export class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.circuitBreakers = new Map();
        this.errorCounts = new Map();
        this.maxErrors = 50; // Maximum errors to keep in log
        this.initialized = false;
        
        // Error categories for better handling
        this.errorCategories = {
            NETWORK: 'network',
            API: 'api',
            STORAGE: 'storage',
            INITIALIZATION: 'initialization',
            UI: 'ui',
            AUTHENTICATION: 'authentication',
            QUOTA: 'quota',
            UNKNOWN: 'unknown'
        };
        
        // Recovery strategies
        this.recoveryStrategies = new Map();
        this.setupRecoveryStrategies();
        
        this.init();
    }

    init() {
        try {
            this.setupGlobalErrorHandling();
            this.initialized = true;
            console.log('✅ Error Handler initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Error Handler:', error);
        }
    }

    setupGlobalErrorHandling() {
        // Service worker context - use self instead of window
        const globalScope = typeof window !== 'undefined' ? window : self;
        
        // Handle uncaught errors
        globalScope.addEventListener('error', (event) => {
            this.handleError(event.error || new Error(event.message), {
                source: 'global.error',
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        // Handle unhandled promise rejections
        globalScope.addEventListener('unhandledrejection', (event) => {
            this.handleError(event.reason, {
                source: 'unhandledrejection',
                promise: event.promise
            });
        });

        // Handle Chrome extension API errors
        if (chrome && chrome.runtime) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                if (message.action === 'reportError') {
                    this.handleError(new Error(message.error), message.context);
                }
            });
        }
    }

    setupRecoveryStrategies() {
        // Network error recovery
        this.recoveryStrategies.set(this.errorCategories.NETWORK, {
            retry: true,
            maxRetries: 3,
            backoffMultiplier: 2,
            initialDelay: 1000,
            action: async (error, context) => {
                console.log('🔄 Attempting network error recovery...');
                
                // Check network connectivity
                if (navigator.onLine === false) {
                    return this.waitForNetworkRecovery();
                }
                
                // Retry with exponential backoff
                return this.retryWithBackoff(context.originalAction, context);
            }
        });

        // API error recovery
        this.recoveryStrategies.set(this.errorCategories.API, {
            retry: true,
            maxRetries: 2,
            backoffMultiplier: 1.5,
            initialDelay: 2000,
            action: async (error, context) => {
                console.log('🔄 Attempting API error recovery...');
                
                // Check if it's an authentication error
                if (this.isAuthError(error)) {
                    return this.handleAuthError(error, context);
                }
                
                // Check if it's a quota error
                if (this.isQuotaError(error)) {
                    return this.handleQuotaError(error, context);
                }
                
                // Retry with backoff for other API errors
                return this.retryWithBackoff(context.originalAction, context);
            }
        });

        // Storage error recovery
        this.recoveryStrategies.set(this.errorCategories.STORAGE, {
            retry: true,
            maxRetries: 3,
            backoffMultiplier: 1.2,
            initialDelay: 500,
            action: async (error, context) => {
                console.log('🔄 Attempting storage error recovery...');
                
                // Try clearing corrupted data
                if (this.isCorruptionError(error)) {
                    return this.clearCorruptedStorage(context);
                }
                
                // Retry storage operation
                return this.retryWithBackoff(context.originalAction, context);
            }
        });

        // Authentication error recovery
        this.recoveryStrategies.set(this.errorCategories.AUTHENTICATION, {
            retry: false,
            maxRetries: 1,
            action: async (error, context) => {
                console.log('🔄 Attempting authentication recovery...');
                
                // Attempt to refresh authentication
                try {
                    const response = await chrome.runtime.sendMessage({
                        action: 'refreshAuthentication'
                    });
                    
                    if (response?.success) {
                        // Retry original operation if authentication was refreshed
                        if (context.originalAction) {
                            return await context.originalAction();
                        }
                    } else {
                        // Prompt user for re-authentication
                        return this.promptForReauth(context);
                    }
                } catch (authError) {
                    console.error('❌ Authentication recovery failed:', authError);
                    return this.promptForReauth(context);
                }
            }
        });

        // Quota error recovery
        this.recoveryStrategies.set(this.errorCategories.QUOTA, {
            retry: false,
            maxRetries: 0,
            action: async (error, context) => {
                console.log('⚠️ API quota exceeded, implementing rate limiting...');
                
                // Implement rate limiting
                const quotaResetTime = this.calculateQuotaResetTime(error);
                
                // Notify user about quota limitation
                this.notifyQuotaExceeded(quotaResetTime);
                
                // Schedule retry after quota reset
                if (context.originalAction) {
                    setTimeout(() => {
                        context.originalAction();
                    }, quotaResetTime);
                }
                
                return { success: false, reason: 'quota_exceeded', retryAfter: quotaResetTime };
            }
        });
    }

    async handleError(error, context = {}) {
        try {
            // Create error entry
            const errorEntry = {
                id: this.generateErrorId(),
                timestamp: Date.now(),
                error: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                },
                context: {
                    ...context,
                    userAgent: navigator.userAgent,
                    url: window.location?.href,
                    extension: {
                        version: chrome.runtime?.getManifest?.()?.version,
                        id: chrome.runtime?.id
                    }
                },
                category: this.categorizeError(error),
                severity: this.assessSeverity(error, context),
                recovered: false,
                attempts: 0
            };

            // Add to error log
            this.addToErrorLog(errorEntry);

            // Update error counts
            this.updateErrorCounts(errorEntry.category);

            // Check circuit breaker
            if (this.shouldCircuitBreak(errorEntry.category)) {
                return this.handleCircuitBreaker(errorEntry.category, errorEntry);
            }

            // Attempt recovery
            const recoveryResult = await this.attemptRecovery(errorEntry);

            // Update error entry with recovery result
            errorEntry.recovered = recoveryResult?.success || false;
            errorEntry.recoveryDetails = recoveryResult;

            // Report error if not recovered or if severe
            if (!errorEntry.recovered || errorEntry.severity >= 8) {
                this.reportError(errorEntry);
            }

            // Log to console based on severity
            this.logError(errorEntry);

            return errorEntry;
        } catch (handlingError) {
            console.error('❌ Error in error handler:', handlingError);
            // Fallback logging
            console.error('❌ Original error:', error);
        }
    }

    categorizeError(error) {
        const message = error.message?.toLowerCase() || '';
        const name = error.name?.toLowerCase() || '';

        // Network errors
        if (message.includes('network') || message.includes('fetch') || 
            message.includes('connection') || name.includes('networkerror')) {
            return this.errorCategories.NETWORK;
        }

        // API errors
        if (message.includes('api') || message.includes('400') || 
            message.includes('401') || message.includes('403') || 
            message.includes('404') || message.includes('500')) {
            return this.errorCategories.API;
        }

        // Storage errors
        if (message.includes('storage') || message.includes('quota') || 
            message.includes('disk') || name.includes('quotaexceedederror')) {
            return this.errorCategories.STORAGE;
        }

        // Authentication errors
        if (message.includes('auth') || message.includes('unauthorized') || 
            message.includes('forbidden') || message.includes('token')) {
            return this.errorCategories.AUTHENTICATION;
        }

        // Quota errors
        if (message.includes('quota') || message.includes('rate limit') || 
            message.includes('too many requests')) {
            return this.errorCategories.QUOTA;
        }

        // UI errors
        if (message.includes('element') || message.includes('dom') || 
            message.includes('rendering')) {
            return this.errorCategories.UI;
        }

        // Initialization errors
        if (message.includes('init') || message.includes('load') || 
            message.includes('startup')) {
            return this.errorCategories.INITIALIZATION;
        }

        return this.errorCategories.UNKNOWN;
    }

    assessSeverity(error, context) {
        let severity = 5; // Default medium severity (1-10 scale)

        // Increase severity based on error type
        if (error.name === 'TypeError' || error.name === 'ReferenceError') {
            severity += 2;
        }

        // Increase severity based on context
        if (context.source === 'initialization') {
            severity += 3;
        }

        if (context.critical) {
            severity += 2;
        }

        // Decrease severity for known recoverable errors
        if (this.isRecoverableError(error)) {
            severity -= 1;
        }

        return Math.min(10, Math.max(1, severity));
    }

    isRecoverableError(error) {
        const recoverablePatterns = [
            'network error',
            'timeout',
            'connection refused',
            'rate limit',
            'quota exceeded',
            'temporary unavailable'
        ];

        const message = error.message?.toLowerCase() || '';
        return recoverablePatterns.some(pattern => message.includes(pattern));
    }

    async attemptRecovery(errorEntry) {
        const strategy = this.recoveryStrategies.get(errorEntry.category);
        if (!strategy) {
            return { success: false, reason: 'no_strategy' };
        }

        try {
            errorEntry.attempts++;
            
            if (errorEntry.attempts > strategy.maxRetries) {
                return { success: false, reason: 'max_retries_exceeded' };
            }

            console.log(`🔄 Attempting recovery for ${errorEntry.category} error (attempt ${errorEntry.attempts}/${strategy.maxRetries})`);

            const result = await strategy.action(errorEntry.error, errorEntry.context);
            
            if (result?.success) {
                console.log(`✅ Successfully recovered from ${errorEntry.category} error`);
                this.resetErrorCount(errorEntry.category);
            }

            return result;
        } catch (recoveryError) {
            console.error('❌ Recovery attempt failed:', recoveryError);
            return { success: false, reason: 'recovery_failed', error: recoveryError };
        }
    }

    // Circuit Breaker Implementation
    shouldCircuitBreak(category) {
        const breakerConfig = this.getCircuitBreakerConfig(category);
        const errorCount = this.errorCounts.get(category) || 0;
        
        return errorCount >= breakerConfig.threshold;
    }

    getCircuitBreakerConfig(category) {
        const defaultConfig = {
            threshold: 5,
            timeout: 30000, // 30 seconds
            halfOpenRetries: 3
        };

        const categoryConfigs = {
            [this.errorCategories.NETWORK]: { threshold: 3, timeout: 60000 },
            [this.errorCategories.API]: { threshold: 5, timeout: 120000 },
            [this.errorCategories.STORAGE]: { threshold: 3, timeout: 30000 },
            [this.errorCategories.AUTHENTICATION]: { threshold: 2, timeout: 300000 } // 5 minutes
        };

        return { ...defaultConfig, ...categoryConfigs[category] };
    }

    handleCircuitBreaker(category, errorEntry) {
        const breaker = this.circuitBreakers.get(category) || {
            state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
            openedAt: null,
            halfOpenAttempts: 0
        };

        const config = this.getCircuitBreakerConfig(category);

        switch (breaker.state) {
            case 'CLOSED':
                // Open circuit breaker
                breaker.state = 'OPEN';
                breaker.openedAt = Date.now();
                breaker.halfOpenAttempts = 0;
                this.circuitBreakers.set(category, breaker);
                
                console.warn(`🚫 Circuit breaker OPENED for ${category} (${this.errorCounts.get(category)} errors)`);
                
                // Schedule half-open transition
                setTimeout(() => {
                    this.transitionToHalfOpen(category);
                }, config.timeout);
                
                return {
                    success: false,
                    reason: 'circuit_breaker_open',
                    category,
                    retryAfter: config.timeout
                };

            case 'OPEN':
                console.warn(`🚫 Circuit breaker OPEN for ${category} - rejecting request`);
                return {
                    success: false,
                    reason: 'circuit_breaker_open',
                    category,
                    retryAfter: config.timeout - (Date.now() - breaker.openedAt)
                };

            case 'HALF_OPEN':
                breaker.halfOpenAttempts++;
                
                if (breaker.halfOpenAttempts > config.halfOpenRetries) {
                    // Too many failures in half-open, go back to open
                    breaker.state = 'OPEN';
                    breaker.openedAt = Date.now();
                    breaker.halfOpenAttempts = 0;
                    
                    console.warn(`🚫 Circuit breaker back to OPEN for ${category}`);
                    
                    return {
                        success: false,
                        reason: 'circuit_breaker_open',
                        category
                    };
                } else {
                    // Allow limited attempts in half-open state
                    console.log(`🟡 Circuit breaker HALF_OPEN for ${category} - allowing attempt ${breaker.halfOpenAttempts}/${config.halfOpenRetries}`);
                    return null; // Continue with normal error handling
                }
        }

        this.circuitBreakers.set(category, breaker);
        return null;
    }

    transitionToHalfOpen(category) {
        const breaker = this.circuitBreakers.get(category);
        if (breaker && breaker.state === 'OPEN') {
            breaker.state = 'HALF_OPEN';
            breaker.halfOpenAttempts = 0;
            this.circuitBreakers.set(category, breaker);
            
            console.log(`🟡 Circuit breaker transitioned to HALF_OPEN for ${category}`);
        }
    }

    closeCircuitBreaker(category) {
        const breaker = this.circuitBreakers.get(category);
        if (breaker) {
            breaker.state = 'CLOSED';
            breaker.openedAt = null;
            breaker.halfOpenAttempts = 0;
            this.circuitBreakers.set(category, breaker);
            
            console.log(`✅ Circuit breaker CLOSED for ${category}`);
        }
        
        this.resetErrorCount(category);
    }

    // Recovery Helper Methods
    async retryWithBackoff(action, context, attempt = 1) {
        if (!action) {
            return { success: false, reason: 'no_action_to_retry' };
        }

        const strategy = this.recoveryStrategies.get(context.category);
        if (!strategy || attempt > strategy.maxRetries) {
            return { success: false, reason: 'max_retries_exceeded' };
        }

        const delay = strategy.initialDelay * Math.pow(strategy.backoffMultiplier, attempt - 1);
        
        console.log(`🔄 Retrying in ${delay}ms (attempt ${attempt}/${strategy.maxRetries})`);
        
        await this.sleep(delay);

        try {
            const result = await action();
            return { success: true, result, attempts: attempt };
        } catch (error) {
            console.error(`❌ Retry attempt ${attempt} failed:`, error);
            
            if (attempt < strategy.maxRetries) {
                return this.retryWithBackoff(action, context, attempt + 1);
            } else {
                return { success: false, reason: 'all_retries_failed', attempts: attempt };
            }
        }
    }

    async waitForNetworkRecovery(maxWait = 60000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            const checkNetwork = () => {
                if (navigator.onLine) {
                    console.log('✅ Network connectivity restored');
                    resolve({ success: true, reason: 'network_restored' });
                } else if (Date.now() - startTime >= maxWait) {
                    console.log('⏱️ Network recovery timeout');
                    resolve({ success: false, reason: 'network_timeout' });
                } else {
                    setTimeout(checkNetwork, 1000);
                }
            };
            
            window.addEventListener('online', () => {
                resolve({ success: true, reason: 'network_restored' });
            }, { once: true });
            
            checkNetwork();
        });
    }

    async handleAuthError(error, context) {
        try {
            // Clear potentially corrupted auth tokens
            await chrome.runtime.sendMessage({ action: 'clearAuthTokens' });
            
            // Attempt to re-authenticate
            const authResult = await chrome.runtime.sendMessage({ action: 'authenticate' });
            
            if (authResult?.success) {
                // Retry original operation
                if (context.originalAction) {
                    return await context.originalAction();
                }
                return { success: true, reason: 'authentication_restored' };
            } else {
                return this.promptForReauth(context);
            }
        } catch (authError) {
            console.error('❌ Auth error recovery failed:', authError);
            return { success: false, reason: 'auth_recovery_failed' };
        }
    }

    async handleQuotaError(error, context) {
        const quotaResetTime = this.calculateQuotaResetTime(error);
        
        // Notify user about quota limitation
        this.notifyQuotaExceeded(quotaResetTime);
        
        // Implement request queuing for when quota resets
        this.queueRequestForLater(context, quotaResetTime);
        
        return { 
            success: false, 
            reason: 'quota_exceeded', 
            retryAfter: quotaResetTime 
        };
    }

    calculateQuotaResetTime(error) {
        // Try to extract reset time from error headers or message
        const message = error.message || '';
        const match = message.match(/try again in (\d+) seconds?/i);
        
        if (match) {
            return parseInt(match[1]) * 1000;
        }
        
        // Default to 1 hour if no specific time found
        return 60 * 60 * 1000;
    }

    async clearCorruptedStorage(context) {
        try {
            console.log('🗑️ Attempting to clear corrupted storage...');
            
            // Clear specific corrupted keys if known
            if (context.storageKey) {
                await chrome.storage.local.remove(context.storageKey);
                console.log(`✅ Cleared corrupted storage key: ${context.storageKey}`);
            } else {
                // Clear all non-essential storage
                const result = await chrome.storage.local.get(null);
                const essentialKeys = ['settings', 'credentials', 'user_data'];
                const keysToRemove = Object.keys(result).filter(key => 
                    !essentialKeys.some(essential => key.startsWith(essential))
                );
                
                if (keysToRemove.length > 0) {
                    await chrome.storage.local.remove(keysToRemove);
                    console.log(`✅ Cleared ${keysToRemove.length} potentially corrupted storage keys`);
                }
            }
            
            return { success: true, reason: 'storage_cleared' };
        } catch (clearError) {
            console.error('❌ Failed to clear corrupted storage:', clearError);
            return { success: false, reason: 'storage_clear_failed' };
        }
    }

    // Utility Methods
    isAuthError(error) {
        const message = error.message?.toLowerCase() || '';
        return message.includes('unauthorized') || 
               message.includes('forbidden') || 
               message.includes('invalid token') ||
               message.includes('authentication');
    }

    isQuotaError(error) {
        const message = error.message?.toLowerCase() || '';
        return message.includes('quota') || 
               message.includes('rate limit') || 
               message.includes('too many requests') ||
               error.status === 429;
    }

    isCorruptionError(error) {
        const message = error.message?.toLowerCase() || '';
        return message.includes('corrupt') || 
               message.includes('invalid json') || 
               message.includes('parse error') ||
               message.includes('syntax error');
    }

    addToErrorLog(errorEntry) {
        this.errorLog.unshift(errorEntry);
        
        // Keep only the most recent errors
        if (this.errorLog.length > this.maxErrors) {
            this.errorLog = this.errorLog.slice(0, this.maxErrors);
        }
    }

    updateErrorCounts(category) {
        const currentCount = this.errorCounts.get(category) || 0;
        this.errorCounts.set(category, currentCount + 1);
    }

    resetErrorCount(category) {
        this.errorCounts.set(category, 0);
        
        // Close circuit breaker if it was open
        this.closeCircuitBreaker(category);
    }

    generateErrorId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    logError(errorEntry) {
        const { error, severity, category, recovered } = errorEntry;
        
        const prefix = recovered ? '🔧' : '❌';
        const level = severity >= 8 ? 'error' : severity >= 5 ? 'warn' : 'log';
        
        console[level](`${prefix} [${category.toUpperCase()}] ${error.name}: ${error.message}`);
        
        if (severity >= 7) {
            console.error('Stack trace:', error.stack);
            console.error('Context:', errorEntry.context);
        }
    }

    async reportError(errorEntry) {
        try {
            // Send error report to background script for potential telemetry
            await chrome.runtime.sendMessage({
                action: 'reportError',
                errorEntry: {
                    id: errorEntry.id,
                    timestamp: errorEntry.timestamp,
                    category: errorEntry.category,
                    severity: errorEntry.severity,
                    error: {
                        name: errorEntry.error.name,
                        message: errorEntry.error.message,
                        // Don't include full stack trace in reports for privacy
                        stack: errorEntry.error.stack?.split('\n')[0]
                    },
                    recovered: errorEntry.recovered,
                    context: {
                        url: errorEntry.context.url,
                        userAgent: errorEntry.context.userAgent,
                        extension: errorEntry.context.extension
                    }
                }
            });
        } catch (reportError) {
            console.error('❌ Failed to report error:', reportError);
        }
    }

    notifyQuotaExceeded(retryAfter) {
        const minutes = Math.ceil(retryAfter / (1000 * 60));
        
        chrome.runtime.sendMessage({
            action: 'showNotification',
            notification: {
                title: 'AstralTube - API Quota Exceeded',
                message: `API quota exceeded. Service will resume in ~${minutes} minutes.`,
                iconUrl: chrome.runtime.getURL('icons/icon48.png')
            }
        }).catch(() => {
            // Fallback to console if notifications fail
            console.warn(`⚠️ API quota exceeded. Service will resume in ~${minutes} minutes.`);
        });
    }

    async promptForReauth(context) {
        try {
            // Show notification to user
            chrome.runtime.sendMessage({
                action: 'showNotification',
                notification: {
                    title: 'AstralTube - Authentication Required',
                    message: 'Please re-authenticate to continue using AstralTube features.',
                    iconUrl: chrome.runtime.getURL('icons/icon48.png')
                }
            });
            
            // Open options page for re-authentication
            chrome.runtime.sendMessage({
                action: 'openOptions',
                section: 'authentication'
            });
            
            return { success: false, reason: 'user_interaction_required' };
        } catch (error) {
            console.error('❌ Failed to prompt for re-authentication:', error);
            return { success: false, reason: 'prompt_failed' };
        }
    }

    queueRequestForLater(context, delay) {
        if (context.originalAction) {
            setTimeout(async () => {
                try {
                    await context.originalAction();
                    console.log('✅ Queued request executed after quota reset');
                } catch (error) {
                    console.error('❌ Queued request failed after quota reset:', error);
                }
            }, delay);
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Public API Methods
    getErrorStats() {
        const stats = {
            totalErrors: this.errorLog.length,
            errorsByCategory: {},
            circuitBreakers: {},
            recentErrors: this.errorLog.slice(0, 10).map(entry => ({
                id: entry.id,
                timestamp: entry.timestamp,
                category: entry.category,
                severity: entry.severity,
                recovered: entry.recovered,
                message: entry.error.message
            }))
        };
        
        // Count errors by category
        for (const [category, count] of this.errorCounts.entries()) {
            stats.errorsByCategory[category] = count;
        }
        
        // Circuit breaker states
        for (const [category, breaker] of this.circuitBreakers.entries()) {
            stats.circuitBreakers[category] = {
                state: breaker.state,
                openedAt: breaker.openedAt,
                halfOpenAttempts: breaker.halfOpenAttempts
            };
        }
        
        return stats;
    }

    clearErrorLog() {
        this.errorLog = [];
        this.errorCounts.clear();
        console.log('✅ Error log cleared');
    }

    getHealthStatus() {
        const totalErrors = this.errorLog.length;
        const recentErrors = this.errorLog.filter(entry => 
            Date.now() - entry.timestamp < 60000 // Last minute
        ).length;
        
        const openCircuitBreakers = Array.from(this.circuitBreakers.values())
            .filter(breaker => breaker.state === 'OPEN').length;
        
        let health = 'healthy';
        let score = 100;
        
        if (recentErrors > 5) {
            health = 'unhealthy';
            score -= 30;
        } else if (recentErrors > 2) {
            health = 'degraded';
            score -= 15;
        }
        
        if (openCircuitBreakers > 0) {
            health = 'degraded';
            score -= openCircuitBreakers * 20;
        }
        
        score = Math.max(0, score);
        
        return {
            health,
            score,
            totalErrors,
            recentErrors,
            openCircuitBreakers,
            details: this.getErrorStats()
        };
    }

    // Testing and debugging methods
    simulateError(category, message = 'Simulated error') {
        const error = new Error(message);
        this.handleError(error, { 
            source: 'simulation', 
            category,
            originalAction: null 
        });
    }

    forceCircuitBreaker(category) {
        const config = this.getCircuitBreakerConfig(category);
        this.errorCounts.set(category, config.threshold);
        
        const error = new Error(`Forced circuit breaker for ${category}`);
        this.handleError(error, { category, source: 'forced' });
    }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();