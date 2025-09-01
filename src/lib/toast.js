/**
 * AstralTube v3 - Toast Notification System
 * Non-intrusive user feedback with advanced features
 */

export class ToastManager {
    constructor(options = {}) {
        this.options = {
            position: 'top-right', // top-left, top-right, bottom-left, bottom-right, top-center, bottom-center
            maxToasts: 5,
            defaultDuration: 4000,
            pauseOnHover: true,
            closeOnClick: false,
            showProgress: true,
            animations: true,
            ...options
        };
        
        this.container = null;
        this.toasts = new Map();
        this.queue = [];
        this.idCounter = 0;
        
        this.init();
    }

    init() {
        this.createContainer();
        this.addStyles();
        
        console.log('🍞 Toast Manager initialized');
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'astraltube-toast-container';
        this.container.className = `toast-container toast-${this.options.position}`;
        
        // Position styles
        const positions = {
            'top-left': { top: '20px', left: '20px' },
            'top-right': { top: '20px', right: '20px' },
            'top-center': { top: '20px', left: '50%', transform: 'translateX(-50%)' },
            'bottom-left': { bottom: '20px', left: '20px' },
            'bottom-right': { bottom: '20px', right: '20px' },
            'bottom-center': { bottom: '20px', left: '50%', transform: 'translateX(-50%)' }
        };
        
        const pos = positions[this.options.position] || positions['top-right'];
        Object.assign(this.container.style, {
            position: 'fixed',
            zIndex: '10005',
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: this.options.position.includes('bottom') ? 'column-reverse' : 'column',
            gap: '8px',
            maxWidth: '400px',
            ...pos
        });
        
        document.body.appendChild(this.container);
    }

    addStyles() {
        if (document.getElementById('astraltube-toast-styles')) return;
        
        const styles = `
            .toast-item {
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1);
                padding: 16px;
                margin: 0;
                pointer-events: auto;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                font-size: 14px;
                line-height: 1.4;
                position: relative;
                overflow: hidden;
                transform: translateX(100%);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                opacity: 0;
                max-width: 100%;
                word-wrap: break-word;
            }
            
            .toast-item.toast-visible {
                transform: translateX(0);
                opacity: 1;
            }
            
            .toast-item.toast-removing {
                transform: translateX(100%);
                opacity: 0;
                margin-top: -60px;
            }
            
            /* Toast types */
            .toast-success {
                border-left: 4px solid #10b981;
            }
            
            .toast-error {
                border-left: 4px solid #ef4444;
            }
            
            .toast-warning {
                border-left: 4px solid #f59e0b;
            }
            
            .toast-info {
                border-left: 4px solid #3b82f6;
            }
            
            .toast-loading {
                border-left: 4px solid #8b5cf6;
            }
            
            /* Toast header */
            .toast-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                margin-bottom: 4px;
            }
            
            .toast-icon {
                flex-shrink: 0;
                width: 20px;
                height: 20px;
                margin-right: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
            }
            
            .toast-content {
                flex: 1;
                min-width: 0;
            }
            
            .toast-title {
                font-weight: 600;
                color: #111827;
                margin: 0 0 4px 0;
                font-size: 14px;
            }
            
            .toast-message {
                color: #6b7280;
                margin: 0;
                line-height: 1.4;
                font-size: 13px;
            }
            
            .toast-close {
                background: none;
                border: none;
                color: #9ca3af;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: all 0.2s;
                font-size: 18px;
                line-height: 1;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                margin-left: 8px;
            }
            
            .toast-close:hover {
                background: #f3f4f6;
                color: #6b7280;
            }
            
            /* Progress bar */
            .toast-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: currentColor;
                opacity: 0.3;
                transition: width linear;
                width: 100%;
            }
            
            .toast-progress.toast-paused {
                transition-play-state: paused;
            }
            
            /* Action buttons */
            .toast-actions {
                margin-top: 12px;
                display: flex;
                gap: 8px;
            }
            
            .toast-action {
                padding: 6px 12px;
                border: 1px solid #d1d5db;
                background: #f9fafb;
                color: #374151;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 500;
                transition: all 0.2s;
            }
            
            .toast-action:hover {
                background: #f3f4f6;
                border-color: #9ca3af;
            }
            
            .toast-action-primary {
                background: #3b82f6;
                color: white;
                border-color: #3b82f6;
            }
            
            .toast-action-primary:hover {
                background: #2563eb;
                border-color: #2563eb;
            }
            
            /* Loading spinner */
            .toast-spinner {
                width: 16px;
                height: 16px;
                border: 2px solid #e5e7eb;
                border-top: 2px solid #3b82f6;
                border-radius: 50%;
                animation: toast-spin 1s linear infinite;
            }
            
            @keyframes toast-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* Position variants for slide in animation */
            .toast-container.toast-top-left .toast-item,
            .toast-container.toast-bottom-left .toast-item {
                transform: translateX(-100%);
            }
            
            .toast-container.toast-top-left .toast-item.toast-removing,
            .toast-container.toast-bottom-left .toast-item.toast-removing {
                transform: translateX(-100%);
            }
            
            .toast-container.toast-top-center .toast-item,
            .toast-container.toast-bottom-center .toast-item {
                transform: translateY(-100%);
            }
            
            .toast-container.toast-top-center .toast-item.toast-visible,
            .toast-container.toast-bottom-center .toast-item.toast-visible {
                transform: translateY(0);
            }
            
            .toast-container.toast-top-center .toast-item.toast-removing,
            .toast-container.toast-bottom-center .toast-item.toast-removing {
                transform: translateY(-100%);
            }
            
            /* Dark mode */
            @media (prefers-color-scheme: dark) {
                .toast-item {
                    background: #1f2937;
                    color: #f9fafb;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2);
                }
                
                .toast-title {
                    color: #f9fafb;
                }
                
                .toast-message {
                    color: #d1d5db;
                }
                
                .toast-close {
                    color: #9ca3af;
                }
                
                .toast-close:hover {
                    background: #374151;
                    color: #d1d5db;
                }
                
                .toast-action {
                    background: #374151;
                    color: #f9fafb;
                    border-color: #4b5563;
                }
                
                .toast-action:hover {
                    background: #4b5563;
                    border-color: #6b7280;
                }
            }
            
            /* Responsive */
            @media (max-width: 480px) {
                .toast-container {
                    left: 10px !important;
                    right: 10px !important;
                    max-width: none;
                    transform: none !important;
                }
                
                .toast-item {
                    margin: 0;
                    max-width: none;
                }
            }
        `;
        
        const styleElement = document.createElement('style');
        styleElement.id = 'astraltube-toast-styles';
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }

    /**
     * Show a toast notification
     */
    show(options = {}) {
        if (typeof options === 'string') {
            options = { message: options };
        }

        const config = {
            type: 'info', // success, error, warning, info, loading
            title: null,
            message: '',
            duration: this.options.defaultDuration,
            closable: true,
            actions: [],
            onClick: null,
            onClose: null,
            persistent: false,
            ...options
        };

        const id = ++this.idCounter;
        
        // Check if we need to queue this toast
        if (this.toasts.size >= this.options.maxToasts) {
            this.queue.push({ id, config });
            return id;
        }

        this.createToast(id, config);
        return id;
    }

    createToast(id, config) {
        const toast = new Toast(id, config, this);
        this.toasts.set(id, toast);
        
        // Add to container
        this.container.appendChild(toast.element);
        
        // Animate in
        requestAnimationFrame(() => {
            toast.element.classList.add('toast-visible');
        });
        
        // Setup auto-dismiss
        if (config.duration > 0 && !config.persistent) {
            toast.startTimer();
        }

        return toast;
    }

    /**
     * Remove a toast
     */
    remove(id) {
        const toast = this.toasts.get(id);
        if (!toast) return;

        toast.remove();
        this.toasts.delete(id);
        
        // Process queue
        this.processQueue();
    }

    /**
     * Remove all toasts
     */
    removeAll() {
        for (const [id, toast] of this.toasts) {
            toast.remove();
        }
        this.toasts.clear();
        this.queue = [];
    }

    /**
     * Update existing toast
     */
    update(id, options) {
        const toast = this.toasts.get(id);
        if (!toast) return false;

        toast.update(options);
        return true;
    }

    /**
     * Process queued toasts
     */
    processQueue() {
        if (this.queue.length > 0 && this.toasts.size < this.options.maxToasts) {
            const { id, config } = this.queue.shift();
            this.createToast(id, config);
        }
    }

    // Convenience methods
    success(options) {
        return this.show({ type: 'success', ...this.normalizeOptions(options) });
    }

    error(options) {
        return this.show({ type: 'error', ...this.normalizeOptions(options) });
    }

    warning(options) {
        return this.show({ type: 'warning', ...this.normalizeOptions(options) });
    }

    info(options) {
        return this.show({ type: 'info', ...this.normalizeOptions(options) });
    }

    loading(options) {
        return this.show({ 
            type: 'loading', 
            persistent: true, 
            closable: false,
            ...this.normalizeOptions(options) 
        });
    }

    normalizeOptions(options) {
        if (typeof options === 'string') {
            return { message: options };
        }
        return options || {};
    }

    /**
     * Destroy the toast manager
     */
    destroy() {
        this.removeAll();
        
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        const styles = document.getElementById('astraltube-toast-styles');
        if (styles && styles.parentNode) {
            styles.parentNode.removeChild(styles);
        }
    }
}

class Toast {
    constructor(id, config, manager) {
        this.id = id;
        this.config = config;
        this.manager = manager;
        this.element = null;
        this.timer = null;
        this.progress = null;
        this.progressAnimation = null;
        this.isPaused = false;
        this.startTime = null;
        this.remainingTime = null;
        
        this.create();
    }

    create() {
        this.element = document.createElement('div');
        this.element.className = `toast-item toast-${this.config.type}`;
        this.element.setAttribute('role', 'alert');
        this.element.setAttribute('aria-live', 'polite');
        
        // Create content
        this.createContent();
        
        // Setup event handlers
        this.setupEventHandlers();
    }

    createContent() {
        const icon = this.getIcon();
        const hasTitle = this.config.title && this.config.title.trim();
        
        this.element.innerHTML = `
            <div class="toast-header">
                <div style="display: flex; align-items: flex-start;">
                    <div class="toast-icon">${icon}</div>
                    <div class="toast-content">
                        ${hasTitle ? `<div class="toast-title">${this.escapeHtml(this.config.title)}</div>` : ''}
                        <div class="toast-message">${this.escapeHtml(this.config.message)}</div>
                    </div>
                </div>
                ${this.config.closable ? '<button class="toast-close" aria-label="Close">&times;</button>' : ''}
            </div>
            ${this.config.actions.length > 0 ? this.createActions() : ''}
            ${this.manager.options.showProgress && this.config.duration > 0 && !this.config.persistent ? '<div class="toast-progress"></div>' : ''}
        `;
        
        this.progress = this.element.querySelector('.toast-progress');
    }

    createActions() {
        const actionsHtml = this.config.actions.map((action, index) => {
            const isPrimary = action.primary ? ' toast-action-primary' : '';
            return `<button class="toast-action${isPrimary}" data-action="${index}">${this.escapeHtml(action.text || 'Action')}</button>`;
        }).join('');
        
        return `<div class="toast-actions">${actionsHtml}</div>`;
    }

    setupEventHandlers() {
        // Close button
        const closeBtn = this.element.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.close();
            });
        }
        
        // Action buttons
        const actionButtons = this.element.querySelectorAll('.toast-action');
        actionButtons.forEach((button, index) => {
            button.addEventListener('click', () => {
                const action = this.config.actions[index];
                if (action.onClick) {
                    const result = action.onClick(this);
                    // Close toast unless action returns false
                    if (result !== false) {
                        this.close();
                    }
                }
            });
        });
        
        // Click to close
        if (this.manager.options.closeOnClick && this.config.closable) {
            this.element.addEventListener('click', (e) => {
                if (!e.target.closest('.toast-action')) {
                    this.close();
                }
            });
        }
        
        // Custom click handler
        if (this.config.onClick) {
            this.element.addEventListener('click', (e) => {
                if (!e.target.closest('.toast-close, .toast-action')) {
                    this.config.onClick(this);
                }
            });
        }
        
        // Pause on hover
        if (this.manager.options.pauseOnHover && this.config.duration > 0) {
            this.element.addEventListener('mouseenter', () => {
                this.pause();
            });
            
            this.element.addEventListener('mouseleave', () => {
                this.resume();
            });
        }
    }

    getIcon() {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            loading: '<div class="toast-spinner"></div>'
        };
        
        return icons[this.config.type] || icons.info;
    }

    startTimer() {
        if (this.config.persistent || this.config.duration <= 0) return;
        
        this.startTime = Date.now();
        this.remainingTime = this.config.duration;
        
        // Start progress bar animation
        if (this.progress) {
            this.progress.style.transition = `width ${this.config.duration}ms linear`;
            requestAnimationFrame(() => {
                this.progress.style.width = '0%';
            });
        }
        
        this.timer = setTimeout(() => {
            this.close();
        }, this.config.duration);
    }

    pause() {
        if (this.isPaused || !this.timer) return;
        
        this.isPaused = true;
        clearTimeout(this.timer);
        
        // Calculate remaining time
        const elapsed = Date.now() - this.startTime;
        this.remainingTime = Math.max(0, this.config.duration - elapsed);
        
        // Pause progress bar
        if (this.progress) {
            this.progress.classList.add('toast-paused');
        }
    }

    resume() {
        if (!this.isPaused || this.remainingTime <= 0) return;
        
        this.isPaused = false;
        this.startTime = Date.now();
        
        // Resume progress bar
        if (this.progress) {
            this.progress.classList.remove('toast-paused');
            const remainingPercent = (this.remainingTime / this.config.duration) * 100;
            this.progress.style.transition = `width ${this.remainingTime}ms linear`;
            this.progress.style.width = '0%';
        }
        
        this.timer = setTimeout(() => {
            this.close();
        }, this.remainingTime);
    }

    close() {
        if (this.config.onClose) {
            this.config.onClose(this);
        }
        
        this.manager.remove(this.id);
    }

    remove() {
        // Clear timer
        if (this.timer) {
            clearTimeout(this.timer);
        }
        
        // Animate out
        this.element.classList.add('toast-removing');
        
        // Remove after animation
        setTimeout(() => {
            if (this.element && this.element.parentNode) {
                this.element.parentNode.removeChild(this.element);
            }
        }, 300);
    }

    update(options) {
        // Update config
        Object.assign(this.config, options);
        
        // Update content
        const messageEl = this.element.querySelector('.toast-message');
        if (messageEl && options.message !== undefined) {
            messageEl.textContent = options.message;
        }
        
        const titleEl = this.element.querySelector('.toast-title');
        if (titleEl && options.title !== undefined) {
            titleEl.textContent = options.title;
        }
        
        // Update type class
        if (options.type) {
            this.element.className = `toast-item toast-${options.type}`;
        }
        
        // Reset timer if duration changed
        if (options.duration !== undefined && options.duration !== this.config.duration) {
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
            }
            
            if (options.duration > 0 && !this.config.persistent) {
                this.startTimer();
            }
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export singleton instance
export const toastManager = new ToastManager();

// Convenience exports
export const showToast = (options) => toastManager.show(options);
export const toast = {
    success: (options) => toastManager.success(options),
    error: (options) => toastManager.error(options),
    warning: (options) => toastManager.warning(options),
    info: (options) => toastManager.info(options),
    loading: (options) => toastManager.loading(options),
    remove: (id) => toastManager.remove(id),
    removeAll: () => toastManager.removeAll(),
    update: (id, options) => toastManager.update(id, options)
};

export default toastManager;