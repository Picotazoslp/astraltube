/**
 * AstralTube v3 - Event Handler Management System
 * Centralized event management to prevent memory leaks and improve performance
 */

export class EventManager {
    constructor() {
        this.handlers = new Map();
        this.delegatedHandlers = new Map();
        this.throttledHandlers = new Map();
        this.debouncedHandlers = new Map();
        this.onceHandlers = new Set();
        
        console.log('📡 Event Manager initialized');
    }

    /**
     * Add event listener with automatic cleanup tracking
     */
    on(element, event, handler, options = {}) {
        if (!element || typeof handler !== 'function') {
            console.warn('EventManager.on: Invalid element or handler');
            return null;
        }

        const id = this.generateId();
        const actualHandler = this.wrapHandler(handler, options);
        
        // Store for cleanup
        this.handlers.set(id, {
            element,
            event,
            handler: actualHandler,
            originalHandler: handler,
            options,
            timestamp: Date.now()
        });
        
        // Add the event listener
        element.addEventListener(event, actualHandler, options);
        
        return id;
    }

    /**
     * Remove event listener by ID
     */
    off(id) {
        const handlerInfo = this.handlers.get(id);
        if (!handlerInfo) {
            console.warn(`EventManager.off: Handler ${id} not found`);
            return false;
        }

        const { element, event, handler, options } = handlerInfo;
        element.removeEventListener(event, handler, options);
        this.handlers.delete(id);
        
        // Clean up related handlers
        this.throttledHandlers.delete(id);
        this.debouncedHandlers.delete(id);
        this.onceHandlers.delete(id);
        
        return true;
    }

    /**
     * Add throttled event listener
     */
    throttle(element, event, handler, delay = 100, options = {}) {
        let lastExecution = 0;
        
        const throttledHandler = (...args) => {
            const now = Date.now();
            if (now - lastExecution >= delay) {
                lastExecution = now;
                handler.apply(this, args);
            }
        };
        
        const id = this.on(element, event, throttledHandler, options);
        this.throttledHandlers.set(id, { delay, lastExecution });
        
        return id;
    }

    /**
     * Add debounced event listener
     */
    debounce(element, event, handler, delay = 300, options = {}) {
        let timeoutId;
        
        const debouncedHandler = (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                handler.apply(this, args);
            }, delay);
        };
        
        const id = this.on(element, event, debouncedHandler, options);
        this.debouncedHandlers.set(id, { delay, timeoutId });
        
        return id;
    }

    /**
     * Add one-time event listener
     */
    once(element, event, handler, options = {}) {
        const onceHandler = (...args) => {
            const result = handler.apply(this, args);
            this.off(id);
            return result;
        };
        
        const id = this.on(element, event, onceHandler, options);
        this.onceHandlers.add(id);
        
        return id;
    }

    /**
     * Event delegation
     */
    delegate(container, event, selector, handler, options = {}) {
        const delegatedHandler = (e) => {
            const target = e.target.closest(selector);
            if (target && container.contains(target)) {
                handler.call(target, e);
            }
        };
        
        const id = this.on(container, event, delegatedHandler, options);
        this.delegatedHandlers.set(id, { selector, originalHandler: handler });
        
        return id;
    }

    /**
     * Add multiple event listeners to the same element
     */
    onMultiple(element, events, handler, options = {}) {
        const ids = [];
        const eventList = Array.isArray(events) ? events : events.split(' ');
        
        eventList.forEach(event => {
            const id = this.on(element, event.trim(), handler, options);
            ids.push(id);
        });
        
        return ids;
    }

    /**
     * Remove multiple event listeners
     */
    offMultiple(ids) {
        return ids.map(id => this.off(id)).every(Boolean);
    }

    /**
     * Add conditional event listener
     */
    onIf(element, event, condition, handler, options = {}) {
        const conditionalHandler = (...args) => {
            if (typeof condition === 'function' ? condition() : condition) {
                return handler.apply(this, args);
            }
        };
        
        return this.on(element, event, conditionalHandler, options);
    }

    /**
     * Add event listener with automatic cleanup after timeout
     */
    onTimeout(element, event, handler, timeout = 30000, options = {}) {
        const id = this.on(element, event, handler, options);
        
        setTimeout(() => {
            this.off(id);
        }, timeout);
        
        return id;
    }

    /**
     * Add event listener that only fires when element is visible
     */
    onVisible(element, event, handler, options = {}) {
        const visibleHandler = (...args) => {
            if (this.isElementVisible(element)) {
                return handler.apply(this, args);
            }
        };
        
        return this.on(element, event, visibleHandler, options);
    }

    /**
     * Wrap handler with additional functionality
     */
    wrapHandler(handler, options = {}) {
        let wrappedHandler = handler;
        
        // Add error handling
        if (options.catchErrors !== false) {
            wrappedHandler = this.addErrorHandling(wrappedHandler);
        }
        
        // Add performance monitoring
        if (options.monitor) {
            wrappedHandler = this.addPerformanceMonitoring(wrappedHandler, options.monitor);
        }
        
        // Add logging
        if (options.log) {
            wrappedHandler = this.addLogging(wrappedHandler, options.log);
        }
        
        return wrappedHandler;
    }

    /**
     * Add error handling wrapper
     */
    addErrorHandling(handler) {
        return (...args) => {
            try {
                return handler.apply(this, args);
            } catch (error) {
                console.error('Event handler error:', error);
                
                // Report to error handler if available
                if (window.astralTubeErrorHandler) {
                    window.astralTubeErrorHandler.reportError(error, 'event_handler');
                }
                
                return undefined;
            }
        };
    }

    /**
     * Add performance monitoring wrapper
     */
    addPerformanceMonitoring(handler, label) {
        return (...args) => {
            const start = performance.now();
            const result = handler.apply(this, args);
            const end = performance.now();
            
            if (end - start > 16) { // > 1 frame at 60fps
                console.warn(`Slow event handler "${label}": ${(end - start).toFixed(2)}ms`);
            }
            
            return result;
        };
    }

    /**
     * Add logging wrapper
     */
    addLogging(handler, label) {
        return (...args) => {
            console.log(`Event fired: ${label}`, args[0]);
            return handler.apply(this, args);
        };
    }

    /**
     * Remove all event listeners for a specific element
     */
    offElement(element) {
        const toRemove = [];
        
        for (const [id, handlerInfo] of this.handlers) {
            if (handlerInfo.element === element) {
                toRemove.push(id);
            }
        }
        
        return toRemove.map(id => this.off(id)).every(Boolean);
    }

    /**
     * Remove all event listeners of a specific type
     */
    offEvent(event) {
        const toRemove = [];
        
        for (const [id, handlerInfo] of this.handlers) {
            if (handlerInfo.event === event) {
                toRemove.push(id);
            }
        }
        
        return toRemove.map(id => this.off(id)).every(Boolean);
    }

    /**
     * Get statistics about registered handlers
     */
    getStats() {
        const stats = {
            total: this.handlers.size,
            throttled: this.throttledHandlers.size,
            debounced: this.debouncedHandlers.size,
            delegated: this.delegatedHandlers.size,
            once: this.onceHandlers.size,
            byEvent: {},
            byElement: {},
            oldestHandler: null,
            newestHandler: null
        };
        
        let oldestTime = Infinity;
        let newestTime = 0;
        
        for (const [id, handlerInfo] of this.handlers) {
            // By event type
            stats.byEvent[handlerInfo.event] = (stats.byEvent[handlerInfo.event] || 0) + 1;
            
            // By element type
            const elementType = handlerInfo.element.tagName || 'unknown';
            stats.byElement[elementType] = (stats.byElement[elementType] || 0) + 1;
            
            // Oldest/newest
            if (handlerInfo.timestamp < oldestTime) {
                oldestTime = handlerInfo.timestamp;
                stats.oldestHandler = { id, age: Date.now() - handlerInfo.timestamp };
            }
            
            if (handlerInfo.timestamp > newestTime) {
                newestTime = handlerInfo.timestamp;
                stats.newestHandler = { id, age: Date.now() - handlerInfo.timestamp };
            }
        }
        
        return stats;
    }

    /**
     * Clean up old handlers (memory leak prevention)
     */
    cleanupOld(maxAge = 3600000) { // 1 hour default
        const cutoff = Date.now() - maxAge;
        const toRemove = [];
        
        for (const [id, handlerInfo] of this.handlers) {
            if (handlerInfo.timestamp < cutoff) {
                // Check if element still exists in DOM
                if (!document.contains(handlerInfo.element)) {
                    toRemove.push(id);
                }
            }
        }
        
        const removed = toRemove.map(id => this.off(id)).filter(Boolean).length;
        
        if (removed > 0) {
            console.log(`EventManager: Cleaned up ${removed} orphaned handlers`);
        }
        
        return removed;
    }

    /**
     * Remove all handlers
     */
    removeAll() {
        const ids = Array.from(this.handlers.keys());
        const removed = ids.map(id => this.off(id)).filter(Boolean).length;
        
        // Clear all maps
        this.handlers.clear();
        this.delegatedHandlers.clear();
        this.throttledHandlers.clear();
        this.debouncedHandlers.clear();
        this.onceHandlers.clear();
        
        console.log(`EventManager: Removed all ${removed} handlers`);
        return removed;
    }

    /**
     * Check if element is visible
     */
    isElementVisible(element) {
        if (!element || !element.offsetParent) return false;
        
        const rect = element.getBoundingClientRect();
        return (
            rect.width > 0 &&
            rect.height > 0 &&
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return 'event_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Create a scoped event manager for specific components
     */
    createScope(name) {
        return new ScopedEventManager(this, name);
    }

    /**
     * Auto-cleanup setup for common scenarios
     */
    setupAutoCleanup() {
        // Clean up on page unload
        this.on(window, 'beforeunload', () => {
            this.removeAll();
        });
        
        // Periodic cleanup
        setInterval(() => {
            this.cleanupOld();
        }, 300000); // Every 5 minutes
        
        // Clean up on visibility change (tab switch)
        this.on(document, 'visibilitychange', () => {
            if (document.hidden) {
                this.cleanupOld(600000); // 10 minutes when hidden
            }
        });
    }
}

/**
 * Scoped Event Manager for component-specific event handling
 */
class ScopedEventManager {
    constructor(globalManager, scopeName) {
        this.globalManager = globalManager;
        this.scopeName = scopeName;
        this.scopedHandlers = new Set();
    }

    on(element, event, handler, options = {}) {
        const id = this.globalManager.on(element, event, handler, {
            ...options,
            scope: this.scopeName
        });
        
        this.scopedHandlers.add(id);
        return id;
    }

    off(id) {
        const result = this.globalManager.off(id);
        this.scopedHandlers.delete(id);
        return result;
    }

    throttle(element, event, handler, delay, options) {
        const id = this.globalManager.throttle(element, event, handler, delay, {
            ...options,
            scope: this.scopeName
        });
        
        this.scopedHandlers.add(id);
        return id;
    }

    debounce(element, event, handler, delay, options) {
        const id = this.globalManager.debounce(element, event, handler, delay, {
            ...options,
            scope: this.scopeName
        });
        
        this.scopedHandlers.add(id);
        return id;
    }

    once(element, event, handler, options) {
        const id = this.globalManager.once(element, event, handler, {
            ...options,
            scope: this.scopeName
        });
        
        this.scopedHandlers.add(id);
        return id;
    }

    delegate(container, event, selector, handler, options) {
        const id = this.globalManager.delegate(container, event, selector, handler, {
            ...options,
            scope: this.scopeName
        });
        
        this.scopedHandlers.add(id);
        return id;
    }

    removeAll() {
        const removed = Array.from(this.scopedHandlers)
            .map(id => this.globalManager.off(id))
            .filter(Boolean).length;
        
        this.scopedHandlers.clear();
        
        console.log(`EventManager[${this.scopeName}]: Removed ${removed} scoped handlers`);
        return removed;
    }

    getStats() {
        return {
            scope: this.scopeName,
            totalHandlers: this.scopedHandlers.size,
            handlerIds: Array.from(this.scopedHandlers)
        };
    }
}

// Create global instance
export const eventManager = new EventManager();

// Setup auto-cleanup
eventManager.setupAutoCleanup();

// Convenience functions
export const on = (element, event, handler, options) => eventManager.on(element, event, handler, options);
export const off = (id) => eventManager.off(id);
export const throttle = (element, event, handler, delay, options) => eventManager.throttle(element, event, handler, delay, options);
export const debounce = (element, event, handler, delay, options) => eventManager.debounce(element, event, handler, delay, options);
export const once = (element, event, handler, options) => eventManager.once(element, event, handler, options);
export const delegate = (container, event, selector, handler, options) => eventManager.delegate(container, event, selector, handler, options);

// Export classes for advanced usage
export { ScopedEventManager };