/**
 * AstralTube v3 - Utility Functions
 * Common utility functions for date/time, URL validation, data transformation, and more
 */

// Date and Time Utilities
export const DateTimeUtils = {
    /**
     * Format time ago (e.g., "2 hours ago")
     */
    formatTimeAgo(timestamp) {
        if (!timestamp) return 'Unknown';
        
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const weeks = Math.floor(days / 7);
        const months = Math.floor(days / 30);
        const years = Math.floor(days / 365);

        if (seconds < 60) return seconds <= 1 ? 'Just now' : `${seconds} seconds ago`;
        if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
        if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
        if (days < 7) return days === 1 ? '1 day ago' : `${days} days ago`;
        if (weeks < 4) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
        if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;
        return years === 1 ? '1 year ago' : `${years} years ago`;
    },

    /**
     * Format duration in seconds to human readable format (e.g., "2:30", "1:30:45")
     */
    formatDuration(seconds) {
        if (!seconds || seconds < 0) return '0:00';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    },

    /**
     * Parse ISO 8601 duration (PT4M13S) to seconds
     */
    parseISO8601Duration(duration) {
        if (!duration) return 0;
        
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return 0;
        
        const hours = parseInt(match[1]) || 0;
        const minutes = parseInt(match[2]) || 0;
        const seconds = parseInt(match[3]) || 0;
        
        return hours * 3600 + minutes * 60 + seconds;
    },

    /**
     * Format date for display
     */
    formatDate(timestamp, options = {}) {
        if (!timestamp) return 'Unknown';
        
        const date = new Date(timestamp);
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        
        return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(date);
    },

    /**
     * Get relative time (e.g., "in 2 hours", "2 hours ago")
     */
    getRelativeTime(timestamp) {
        if (!timestamp) return 'Unknown';
        
        const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
        const now = Date.now();
        const diff = timestamp - now;
        const absDiff = Math.abs(diff);
        
        const minute = 60 * 1000;
        const hour = minute * 60;
        const day = hour * 24;
        const week = day * 7;
        const month = day * 30;
        const year = day * 365;

        if (absDiff < minute) return rtf.format(Math.round(diff / 1000), 'second');
        if (absDiff < hour) return rtf.format(Math.round(diff / minute), 'minute');
        if (absDiff < day) return rtf.format(Math.round(diff / hour), 'hour');
        if (absDiff < week) return rtf.format(Math.round(diff / day), 'day');
        if (absDiff < month) return rtf.format(Math.round(diff / week), 'week');
        if (absDiff < year) return rtf.format(Math.round(diff / month), 'month');
        return rtf.format(Math.round(diff / year), 'year');
    }
};

// URL and Validation Utilities
export const ValidationUtils = {
    /**
     * Validate URL format
     */
    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch {
            return false;
        }
    },

    /**
     * Validate YouTube URL and extract video ID
     */
    extractYouTubeVideoId(url) {
        if (!url) return null;
        
        const patterns = [
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&\n?#]+)/,
            /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^&\n?#]+)/,
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^&\n?#]+)/,
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([^&\n?#]+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        
        return null;
    },

    /**
     * Validate YouTube playlist URL and extract playlist ID
     */
    extractYouTubePlaylistId(url) {
        if (!url) return null;
        
        const pattern = /[?&]list=([^&\n?#]+)/;
        const match = url.match(pattern);
        return match ? match[1] : null;
    },

    /**
     * Validate email format
     */
    isValidEmail(email) {
        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return pattern.test(email);
    },

    /**
     * Sanitize HTML string to prevent XSS
     */
    sanitizeHtml(html) {
        if (!html) return '';
        
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    },

    /**
     * Validate JSON string
     */
    isValidJson(str) {
        try {
            JSON.parse(str);
            return true;
        } catch {
            return false;
        }
    }
};

// Data Transformation Utilities
export const DataUtils = {
    /**
     * Format bytes to human readable format
     */
    formatBytes(bytes, decimals = 2) {
        if (!bytes || bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
    },

    /**
     * Format number with commas
     */
    formatNumber(num) {
        if (!num && num !== 0) return '0';
        return new Intl.NumberFormat().format(num);
    },

    /**
     * Deep clone object
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = this.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
        return obj;
    },

    /**
     * Merge objects deeply
     */
    deepMerge(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();

        if (this.isObject(target) && this.isObject(source)) {
            for (const key in source) {
                if (this.isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    this.deepMerge(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }

        return this.deepMerge(target, ...sources);
    },

    /**
     * Check if value is object
     */
    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    },

    /**
     * Generate unique ID
     */
    generateId(prefix = '') {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return prefix + timestamp + random;
    },

    /**
     * Shuffle array
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    },

    /**
     * Group array by property
     */
    groupBy(array, key) {
        return array.reduce((groups, item) => {
            const group = item[key];
            if (!groups[group]) {
                groups[group] = [];
            }
            groups[group].push(item);
            return groups;
        }, {});
    },

    /**
     * Remove duplicates from array
     */
    removeDuplicates(array, key = null) {
        if (key) {
            const seen = new Set();
            return array.filter(item => {
                const value = item[key];
                if (seen.has(value)) return false;
                seen.add(value);
                return true;
            });
        }
        return [...new Set(array)];
    },

    /**
     * Flatten nested array
     */
    flatten(arr, depth = Infinity) {
        return depth > 0 
            ? arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? this.flatten(val, depth - 1) : val), [])
            : arr.slice();
    }
};

// Performance Utilities
export const PerformanceUtils = {
    /**
     * Debounce function
     */
    debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(this, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(this, args);
        };
    },

    /**
     * Throttle function
     */
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Measure execution time
     */
    async measureTime(label, asyncFunc) {
        const start = performance.now();
        const result = await asyncFunc();
        const end = performance.now();
        console.log(`${label} took ${(end - start).toFixed(2)}ms`);
        return result;
    },

    /**
     * Create a simple cache with TTL
     */
    createCache(ttlMs = 300000) { // 5 minutes default
        const cache = new Map();
        const timers = new Map();

        return {
            get(key) {
                return cache.get(key);
            },

            set(key, value, customTtl = ttlMs) {
                // Clear existing timer
                if (timers.has(key)) {
                    clearTimeout(timers.get(key));
                }

                cache.set(key, value);
                
                // Set new timer
                const timer = setTimeout(() => {
                    cache.delete(key);
                    timers.delete(key);
                }, customTtl);
                
                timers.set(key, timer);
            },

            has(key) {
                return cache.has(key);
            },

            delete(key) {
                if (timers.has(key)) {
                    clearTimeout(timers.get(key));
                    timers.delete(key);
                }
                return cache.delete(key);
            },

            clear() {
                for (const timer of timers.values()) {
                    clearTimeout(timer);
                }
                cache.clear();
                timers.clear();
            },

            size() {
                return cache.size;
            }
        };
    },

    /**
     * Batch async operations
     */
    async batchAsync(items, batchSize, asyncOperation) {
        const results = [];
        
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResults = await Promise.allSettled(
                batch.map(item => asyncOperation(item))
            );
            
            results.push(...batchResults.map((result, index) => ({
                item: batch[index],
                success: result.status === 'fulfilled',
                value: result.status === 'fulfilled' ? result.value : null,
                error: result.status === 'rejected' ? result.reason : null
            })));
        }
        
        return results;
    }
};

// DOM Utilities
export const DOMUtils = {
    /**
     * Wait for element to exist
     */
    waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver((mutations) => {
                const element = document.querySelector(selector);
                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    },

    /**
     * Create element with attributes and children
     */
    createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else {
                element.setAttribute(key, value);
            }
        });

        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            }
        });

        return element;
    },

    /**
     * Check if element is visible
     */
    isElementVisible(element) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0'
        );
    },

    /**
     * Scroll element into view smoothly
     */
    scrollIntoView(element, options = {}) {
        if (!element) return;
        
        const defaultOptions = {
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        };
        
        element.scrollIntoView({ ...defaultOptions, ...options });
    },

    /**
     * Add CSS styles to head
     */
    addStyles(css, id = null) {
        if (id && document.getElementById(id)) {
            return; // Styles already added
        }

        const style = document.createElement('style');
        if (id) style.id = id;
        style.textContent = css;
        document.head.appendChild(style);
        return style;
    }
};

// String Utilities
export const StringUtils = {
    /**
     * Capitalize first letter
     */
    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },

    /**
     * Convert to title case
     */
    titleCase(str) {
        if (!str) return '';
        return str.replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    },

    /**
     * Convert to camelCase
     */
    camelCase(str) {
        if (!str) return '';
        return str.replace(/[^a-zA-Z0-9]+(.)/g, (match, char) => char.toUpperCase());
    },

    /**
     * Convert to kebab-case
     */
    kebabCase(str) {
        if (!str) return '';
        return str.replace(/([a-z])([A-Z])/g, '$1-$2')
                 .replace(/[^a-zA-Z0-9]+/g, '-')
                 .toLowerCase();
    },

    /**
     * Truncate string with ellipsis
     */
    truncate(str, length, suffix = '...') {
        if (!str || str.length <= length) return str;
        return str.substr(0, length) + suffix;
    },

    /**
     * Remove HTML tags
     */
    stripHtml(html) {
        if (!html) return '';
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    },

    /**
     * Escape regex special characters
     */
    escapeRegex(str) {
        if (!str) return '';
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    /**
     * Generate slug from string
     */
    slugify(str) {
        if (!str) return '';
        return str.toLowerCase()
                 .replace(/[^\w ]+/g, '')
                 .replace(/ +/g, '-');
    }
};

// Export all utilities as a single object for convenience
export const Utils = {
    DateTime: DateTimeUtils,
    Validation: ValidationUtils,
    Data: DataUtils,
    Performance: PerformanceUtils,
    DOM: DOMUtils,
    String: StringUtils
};

// Default export
export default Utils;