/**
 * AstralTube v3 - Notification Manager
 * Handles all user notifications with advanced features
 */

export class NotificationManager {
    constructor() {
        this.container = null;
        this.notifications = new Map();
        this.queue = [];
        this.maxNotifications = 5;
        this.defaultDuration = 5000;
        this.initialized = false;
        this.settings = {
            enabled: true,
            position: 'top-right',
            animations: true,
            sounds: false,
            maxVisible: 5
        };
    }

    initialize(container) {
        try {
            this.container = container || this.createContainer();
            this.loadSettings();
            this.initialized = true;
            console.log('🔔 Notification Manager initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Notification Manager:', error);
        }
    }

    createContainer() {
        const container = document.createElement('div');
        container.id = 'astral-notifications';
        container.className = 'astral-notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-width: 400px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
        return container;
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get('notificationSettings');
            if (result.notificationSettings) {
                this.settings = { ...this.settings, ...result.notificationSettings };
            }
        } catch (error) {
            console.error('❌ Failed to load notification settings:', error);
        }
    }

    async saveSettings() {
        try {
            await chrome.storage.local.set({ notificationSettings: this.settings });
        } catch (error) {
            console.error('❌ Failed to save notification settings:', error);
        }
    }

    // Main notification method
    show(message, type = 'info', options = {}) {
        if (!this.settings.enabled || !this.initialized) {
            return null;
        }

        const notification = this.createNotification(message, type, options);
        
        // Add to queue if too many notifications are visible
        if (this.notifications.size >= this.settings.maxVisible) {
            this.queue.push({ message, type, options });
            return null;
        }

        this.displayNotification(notification);
        return notification.id;
    }

    // Specialized notification methods
    success(message, options = {}) {
        return this.show(message, 'success', options);
    }

    error(message, options = {}) {
        return this.show(message, 'error', { ...options, duration: 8000 });
    }

    warning(message, options = {}) {
        return this.show(message, 'warning', { ...options, duration: 6000 });
    }

    info(message, options = {}) {
        return this.show(message, 'info', options);
    }

    // Progress notification
    showProgress(message, options = {}) {
        const notification = this.createNotification(message, 'progress', {
            ...options,
            persistent: true,
            showProgress: true
        });
        
        this.displayNotification(notification);
        return {
            id: notification.id,
            update: (progress, newMessage) => this.updateProgress(notification.id, progress, newMessage),
            complete: (message) => this.completeProgress(notification.id, message),
            error: (message) => this.errorProgress(notification.id, message)
        };
    }

    updateProgress(id, progress, message) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        const progressBar = notification.element.querySelector('.progress-bar');
        const messageEl = notification.element.querySelector('.notification-message');
        
        if (progressBar) {
            progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
        }
        
        if (message && messageEl) {
            messageEl.textContent = message;
        }
    }

    completeProgress(id, message) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        // Transform to success notification
        notification.type = 'success';
        notification.element.className = notification.element.className.replace('progress', 'success');
        
        const messageEl = notification.element.querySelector('.notification-message');
        if (message && messageEl) {
            messageEl.textContent = message;
        }

        // Remove progress bar
        const progressBar = notification.element.querySelector('.progress-container');
        if (progressBar) {
            progressBar.remove();
        }

        // Auto-dismiss after delay
        setTimeout(() => this.dismiss(id), 3000);
    }

    errorProgress(id, message) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        // Transform to error notification
        notification.type = 'error';
        notification.element.className = notification.element.className.replace('progress', 'error');
        
        const messageEl = notification.element.querySelector('.notification-message');
        if (message && messageEl) {
            messageEl.textContent = message;
        }

        // Remove progress bar
        const progressBar = notification.element.querySelector('.progress-container');
        if (progressBar) {
            progressBar.remove();
        }

        // Auto-dismiss after delay
        setTimeout(() => this.dismiss(id), 5000);
    }

    // Action notification
    showAction(message, actions, options = {}) {
        return this.show(message, 'action', {
            ...options,
            actions: actions,
            persistent: true
        });
    }

    // Confirmation notification
    showConfirmation(message, onConfirm, onCancel, options = {}) {
        const actions = [
            {
                text: 'Confirm',
                style: 'primary',
                action: () => {
                    onConfirm && onConfirm();
                    this.dismiss(notification);
                }
            },
            {
                text: 'Cancel',
                style: 'secondary',
                action: () => {
                    onCancel && onCancel();
                    this.dismiss(notification);
                }
            }
        ];

        const notification = this.showAction(message, actions, {
            ...options,
            type: 'confirmation'
        });

        return notification;
    }

    createNotification(message, type, options) {
        const id = this.generateId();
        const duration = options.duration || this.defaultDuration;
        const persistent = options.persistent || false;

        const notification = {
            id,
            message,
            type,
            options,
            duration,
            persistent,
            createdAt: Date.now(),
            element: null
        };

        // Create DOM element
        notification.element = this.createNotificationElement(notification);
        
        return notification;
    }

    createNotificationElement(notification) {
        const element = document.createElement('div');
        element.className = `astral-notification astral-notification-${notification.type}`;
        element.dataset.id = notification.id;
        element.style.pointerEvents = 'auto';

        // Base styles
        element.style.cssText += `
            background: white;
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
            border-left: 4px solid ${this.getTypeColor(notification.type)};
            display: flex;
            align-items: flex-start;
            gap: 12px;
            min-width: 300px;
            max-width: 400px;
            transform: translateX(100%);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        // Icon
        const icon = document.createElement('div');
        icon.className = 'notification-icon';
        icon.innerHTML = this.getTypeIcon(notification.type);
        icon.style.cssText = `
            width: 24px;
            height: 24px;
            flex-shrink: 0;
            color: ${this.getTypeColor(notification.type)};
        `;

        // Content
        const content = document.createElement('div');
        content.className = 'notification-content';
        content.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        // Message
        const messageEl = document.createElement('div');
        messageEl.className = 'notification-message';
        messageEl.textContent = notification.message;
        messageEl.style.cssText = `
            color: #1f2937;
            font-size: 14px;
            font-weight: 500;
            line-height: 1.4;
        `;

        content.appendChild(messageEl);

        // Progress bar for progress notifications
        if (notification.options.showProgress) {
            const progressContainer = document.createElement('div');
            progressContainer.className = 'progress-container';
            progressContainer.style.cssText = `
                width: 100%;
                height: 4px;
                background: #e5e7eb;
                border-radius: 2px;
                overflow: hidden;
                margin-top: 8px;
            `;

            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            progressBar.style.cssText = `
                height: 100%;
                background: ${this.getTypeColor(notification.type)};
                width: 0%;
                transition: width 0.3s ease;
            `;

            progressContainer.appendChild(progressBar);
            content.appendChild(progressContainer);
        }

        // Actions
        if (notification.options.actions) {
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'notification-actions';
            actionsContainer.style.cssText = `
                display: flex;
                gap: 8px;
                margin-top: 8px;
            `;

            notification.options.actions.forEach(action => {
                const button = document.createElement('button');
                button.textContent = action.text;
                button.className = `notification-action notification-action-${action.style || 'secondary'}`;
                button.style.cssText = `
                    padding: 6px 12px;
                    border-radius: 6px;
                    border: none;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    ${action.style === 'primary' ? 
                        `background: ${this.getTypeColor(notification.type)}; color: white;` :
                        'background: #f3f4f6; color: #374151;'
                    }
                `;

                button.addEventListener('click', () => {
                    action.action && action.action();
                    if (!action.keepOpen) {
                        this.dismiss(notification.id);
                    }
                });

                actionsContainer.appendChild(button);
            });

            content.appendChild(actionsContainer);
        }

        // Close button
        if (!notification.persistent) {
            const closeButton = document.createElement('button');
            closeButton.className = 'notification-close';
            closeButton.innerHTML = '×';
            closeButton.style.cssText = `
                background: none;
                border: none;
                font-size: 20px;
                color: #9ca3af;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                transition: all 0.2s ease;
                flex-shrink: 0;
            `;

            closeButton.addEventListener('click', () => this.dismiss(notification.id));
            closeButton.addEventListener('mouseenter', () => {
                closeButton.style.background = '#f3f4f6';
                closeButton.style.color = '#374151';
            });
            closeButton.addEventListener('mouseleave', () => {
                closeButton.style.background = 'none';
                closeButton.style.color = '#9ca3af';
            });

            element.appendChild(closeButton);
        }

        element.appendChild(icon);
        element.appendChild(content);

        return element;
    }

    displayNotification(notification) {
        // Add to container
        this.container.appendChild(notification.element);
        this.notifications.set(notification.id, notification);

        // Animate in
        requestAnimationFrame(() => {
            notification.element.style.transform = 'translateX(0)';
            notification.element.style.opacity = '1';
        });

        // Play sound if enabled
        if (this.settings.sounds) {
            this.playNotificationSound(notification.type);
        }

        // Auto-dismiss if not persistent
        if (!notification.persistent) {
            setTimeout(() => {
                this.dismiss(notification.id);
            }, notification.duration);
        }

        // Process queue
        this.processQueue();
    }

    dismiss(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        // Animate out
        notification.element.style.transform = 'translateX(100%)';
        notification.element.style.opacity = '0';

        // Remove from DOM after animation
        setTimeout(() => {
            if (notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
            this.notifications.delete(id);
            this.processQueue();
        }, 300);
    }

    dismissAll() {
        const ids = Array.from(this.notifications.keys());
        ids.forEach(id => this.dismiss(id));
        this.queue = [];
    }

    processQueue() {
        if (this.queue.length > 0 && this.notifications.size < this.settings.maxVisible) {
            const { message, type, options } = this.queue.shift();
            this.show(message, type, options);
        }
    }

    // Utility methods
    getTypeColor(type) {
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6',
            progress: '#8b5cf6',
            action: '#6366f1',
            confirmation: '#f59e0b'
        };
        return colors[type] || colors.info;
    }

    getTypeIcon(type) {
        const icons = {
            success: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
            error: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
            warning: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`,
            info: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`,
            progress: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>`,
            action: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
            confirmation: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-8 8z"/></svg>`
        };
        return icons[type] || icons.info;
    }

    playNotificationSound(type) {
        // Simple beep sound using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Different frequencies for different types
            const frequencies = {
                success: 800,
                error: 400,
                warning: 600,
                info: 500
            };

            oscillator.frequency.setValueAtTime(frequencies[type] || 500, audioContext.currentTime);
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (error) {
            console.warn('Could not play notification sound:', error);
        }
    }

    generateId() {
        return 'notification_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Settings management
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
        
        // Update container position if changed
        if (newSettings.position) {
            this.updateContainerPosition();
        }
    }

    updateContainerPosition() {
        const positions = {
            'top-right': { top: '20px', right: '20px', left: 'auto', bottom: 'auto' },
            'top-left': { top: '20px', left: '20px', right: 'auto', bottom: 'auto' },
            'bottom-right': { bottom: '20px', right: '20px', top: 'auto', left: 'auto' },
            'bottom-left': { bottom: '20px', left: '20px', top: 'auto', right: 'auto' },
            'top-center': { top: '20px', left: '50%', transform: 'translateX(-50%)', right: 'auto', bottom: 'auto' },
            'bottom-center': { bottom: '20px', left: '50%', transform: 'translateX(-50%)', top: 'auto', right: 'auto' }
        };

        const position = positions[this.settings.position] || positions['top-right'];
        Object.assign(this.container.style, position);
    }

    // Chrome Extension Notification API integration
    async showChromeNotification(title, message, options = {}) {
        try {
            if (!chrome.notifications) {
                console.warn('Chrome notifications API not available');
                return null;
            }

            const notificationOptions = {
                type: 'basic',
                iconUrl: chrome.runtime.getURL('icons/icon48.png'),
                title: title,
                message: message,
                priority: options.priority || 1,
                requireInteraction: options.requireInteraction || false,
                silent: options.silent || false,
                ...options
            };

            const notificationId = await new Promise((resolve, reject) => {
                chrome.notifications.create('', notificationOptions, (id) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(id);
                    }
                });
            });

            // Handle notification clicks
            if (options.onClick) {
                this.addNotificationClickHandler(notificationId, options.onClick);
            }

            // Auto-clear notification after timeout
            if (options.timeout && !options.requireInteraction) {
                setTimeout(() => {
                    chrome.notifications.clear(notificationId);
                }, options.timeout);
            }

            return notificationId;
        } catch (error) {
            console.error('Failed to show Chrome notification:', error);
            return null;
        }
    }

    addNotificationClickHandler(notificationId, callback) {
        const listener = (clickedId) => {
            if (clickedId === notificationId) {
                callback();
                chrome.notifications.onClicked.removeListener(listener);
            }
        };
        chrome.notifications.onClicked.addListener(listener);
    }

    // Rich notifications with Chrome API
    async showRichNotification(options = {}) {
        try {
            const notificationOptions = {
                type: options.type || 'basic',
                iconUrl: chrome.runtime.getURL('icons/icon48.png'),
                title: options.title || 'AstralTube',
                message: options.message || '',
                priority: 1,
                ...options
            };

            // Handle different notification types
            switch (options.type) {
                case 'list':
                    notificationOptions.items = options.items || [];
                    break;
                case 'progress':
                    notificationOptions.progress = options.progress || 0;
                    break;
                case 'image':
                    notificationOptions.imageUrl = options.imageUrl;
                    break;
            }

            const notificationId = await new Promise((resolve, reject) => {
                chrome.notifications.create('', notificationOptions, (id) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(id);
                    }
                });
            });

            return notificationId;
        } catch (error) {
            console.error('Failed to show rich notification:', error);
            return null;
        }
    }

    // Update existing Chrome notification
    async updateChromeNotification(notificationId, options = {}) {
        try {
            if (!chrome.notifications) return false;

            return await new Promise((resolve) => {
                chrome.notifications.update(notificationId, options, (wasUpdated) => {
                    resolve(wasUpdated);
                });
            });
        } catch (error) {
            console.error('Failed to update Chrome notification:', error);
            return false;
        }
    }

    // Clear Chrome notification
    async clearChromeNotification(notificationId) {
        try {
            if (!chrome.notifications) return false;

            return await new Promise((resolve) => {
                chrome.notifications.clear(notificationId, (wasCleared) => {
                    resolve(wasCleared);
                });
            });
        } catch (error) {
            console.error('Failed to clear Chrome notification:', error);
            return false;
        }
    }

    // Get all Chrome notifications
    async getAllChromeNotifications() {
        try {
            if (!chrome.notifications) return {};

            return await new Promise((resolve) => {
                chrome.notifications.getAll((notifications) => {
                    resolve(notifications);
                });
            });
        } catch (error) {
            console.error('Failed to get Chrome notifications:', error);
            return {};
        }
    }

    // Browser notification integration (fallback)
    async requestPermission() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        return false;
    }

    showBrowserNotification(title, options = {}) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(title, {
                icon: chrome.runtime.getURL('icons/icon48.png'),
                badge: chrome.runtime.getURL('icons/icon16.png'),
                ...options
            });

            // Auto-close after 5 seconds
            setTimeout(() => notification.close(), 5000);

            return notification;
        }
        return null;
    }

    // Unified notification method that chooses best available API
    async notify(title, message, options = {}) {
        // Try Chrome notifications first (better for extensions)
        if (chrome.notifications) {
            return await this.showChromeNotification(title, message, options);
        }
        
        // Fallback to browser notifications
        if ('Notification' in window && Notification.permission === 'granted') {
            return this.showBrowserNotification(title, { body: message, ...options });
        }

        // Fallback to in-page notification
        return this.show(`${title}: ${message}`, options.type || 'info', options);
    }

    // AstralTube-specific notification methods
    async notifySync(status, details = {}) {
        const messages = {
            'started': 'Synchronizing your YouTube data...',
            'completed': `Sync completed! ${details.playlists || 0} playlists, ${details.subscriptions || 0} subscriptions updated.`,
            'failed': 'Sync failed. Check your connection and API settings.',
            'quota_exceeded': 'YouTube API quota exceeded. Sync will resume tomorrow.'
        };

        const types = {
            'started': 'progress',
            'completed': 'success',
            'failed': 'error',
            'quota_exceeded': 'warning'
        };

        return await this.notify(
            'AstralTube Sync',
            messages[status] || 'Sync status update',
            {
                type: types[status] || 'info',
                priority: status === 'failed' ? 2 : 1,
                timeout: status === 'started' ? 0 : 5000,
                requireInteraction: status === 'failed'
            }
        );
    }

    async notifyPlaylistUpdated(playlistName, action = 'updated') {
        const messages = {
            'created': `New playlist "${playlistName}" created successfully`,
            'updated': `Playlist "${playlistName}" updated`,
            'deleted': `Playlist "${playlistName}" deleted`,
            'exported': `Playlist "${playlistName}" exported successfully`
        };

        return await this.notify(
            'Playlist Update',
            messages[action] || `Playlist "${playlistName}" ${action}`,
            {
                type: action === 'deleted' ? 'warning' : 'success',
                timeout: 3000
            }
        );
    }

    async notifyDownload(status, details = {}) {
        const messages = {
            'started': `Download started: ${details.title || 'Unknown'}`,
            'progress': `Downloading: ${details.progress || 0}% - ${details.title || 'Unknown'}`,
            'completed': `Download completed: ${details.title || 'Unknown'}`,
            'failed': `Download failed: ${details.title || 'Unknown'}`,
            'paused': `Download paused: ${details.title || 'Unknown'}`
        };

        const types = {
            'started': 'info',
            'progress': 'progress',
            'completed': 'success',
            'failed': 'error',
            'paused': 'warning'
        };

        if (status === 'progress') {
            // Use rich notification for progress updates
            return await this.showRichNotification({
                type: 'progress',
                title: 'AstralTube Download',
                message: messages[status],
                progress: details.progress || 0,
                priority: 0,
                silent: true
            });
        }

        return await this.notify(
            'AstralTube Download',
            messages[status] || `Download ${status}`,
            {
                type: types[status] || 'info',
                timeout: status === 'completed' ? 3000 : 5000,
                requireInteraction: status === 'failed'
            }
        );
    }

    async notifyAPIError(error, context = '') {
        const errorMessages = {
            'quota_exceeded': 'YouTube API quota exceeded. Some features may be limited.',
            'invalid_credentials': 'Invalid API credentials. Please check your settings.',
            'network_error': 'Network connection issue. Please check your internet.',
            'rate_limited': 'Too many requests. Please wait before trying again.',
            'unauthorized': 'Authentication failed. Please re-authorize the app.'
        };

        const message = errorMessages[error] || `API Error: ${error}`;
        const fullMessage = context ? `${message} (${context})` : message;

        return await this.notify(
            'AstralTube API Error',
            fullMessage,
            {
                type: 'error',
                priority: 2,
                requireInteraction: true,
                timeout: 10000,
                onClick: () => {
                    // Open options page for configuration
                    chrome.tabs?.create({ url: chrome.runtime.getURL('src/options/options.html') });
                }
            }
        );
    }

    async notifyExtensionUpdate(version, features = []) {
        const message = features.length > 0 
            ? `New features: ${features.slice(0, 2).join(', ')}${features.length > 2 ? '...' : ''}`
            : 'Check out the latest improvements!';

        return await this.notify(
            `AstralTube Updated to v${version}`,
            message,
            {
                type: 'success',
                priority: 1,
                timeout: 8000,
                onClick: () => {
                    // Open changelog or options page
                    chrome.tabs?.create({ url: chrome.runtime.getURL('src/options/options.html#changelog') });
                }
            }
        );
    }

    async notifyQuotaWarning(usage, limit) {
        const percentage = Math.round((usage / limit) * 100);
        const message = `API quota at ${percentage}%. Consider upgrading your API key.`;

        return await this.notify(
            'AstralTube Quota Warning',
            message,
            {
                type: 'warning',
                priority: 1,
                timeout: 6000,
                onClick: () => {
                    chrome.tabs?.create({ url: 'https://console.developers.google.com/apis/api/youtube/quotas' });
                }
            }
        );
    }

    // Batch notification for multiple events
    async notifyBatch(notifications) {
        const results = [];
        
        for (const notification of notifications) {
            const result = await this.show(
                notification.message,
                notification.type || 'info',
                { ...notification.options, duration: 2000 }
            );
            results.push(result);
            
            // Small delay between notifications
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        return results;
    }

    // Cleanup
    destroy() {
        this.dismissAll();
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.notifications.clear();
        this.queue = [];
        this.initialized = false;
    }
}