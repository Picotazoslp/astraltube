/**
 * AstralTube v3 - Modal Dialog System
 * Reusable modal components with advanced features
 */

export class ModalManager {
    constructor() {
        this.modals = new Map();
        this.activeModal = null;
        this.zIndexBase = 10000;
        this.backdrop = null;
        this.escapeKeyHandler = null;
        
        this.init();
    }

    init() {
        // Create global backdrop element
        this.createBackdrop();
        
        // Setup global event handlers
        this.setupGlobalHandlers();
        
        console.log('🎭 Modal Manager initialized');
    }

    createBackdrop() {
        this.backdrop = document.createElement('div');
        this.backdrop.id = 'astraltube-modal-backdrop';
        this.backdrop.className = 'astraltube-modal-backdrop';
        this.backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(2px);
            z-index: ${this.zIndexBase - 1};
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        // Click backdrop to close modal
        this.backdrop.addEventListener('click', (e) => {
            if (e.target === this.backdrop) {
                this.closeActive();
            }
        });
        
        document.body.appendChild(this.backdrop);
    }

    setupGlobalHandlers() {
        // ESC key handler
        this.escapeKeyHandler = (e) => {
            if (e.key === 'Escape' && this.activeModal) {
                this.closeActive();
            }
        };
        
        document.addEventListener('keydown', this.escapeKeyHandler);
    }

    /**
     * Create a new modal dialog
     */
    createModal(id, options = {}) {
        if (this.modals.has(id)) {
            console.warn(`Modal "${id}" already exists`);
            return this.modals.get(id);
        }

        const defaultOptions = {
            title: 'Dialog',
            content: '',
            size: 'medium', // small, medium, large, fullscreen
            closable: true,
            backdrop: true,
            keyboard: true,
            animation: 'fade', // fade, slide, zoom
            className: '',
            buttons: [],
            onShow: null,
            onHide: null,
            onDestroy: null
        };

        const config = { ...defaultOptions, ...options };
        const modal = new Modal(id, config, this);
        
        this.modals.set(id, modal);
        return modal;
    }

    /**
     * Show modal by ID
     */
    show(id, data = null) {
        const modal = this.modals.get(id);
        if (!modal) {
            console.error(`Modal "${id}" not found`);
            return false;
        }

        // Close any active modal first
        if (this.activeModal && this.activeModal !== modal) {
            this.closeActive(false);
        }

        this.activeModal = modal;
        modal.show(data);
        
        // Show backdrop
        this.backdrop.style.visibility = 'visible';
        this.backdrop.style.opacity = '1';
        
        return true;
    }

    /**
     * Hide modal by ID
     */
    hide(id) {
        const modal = this.modals.get(id);
        if (!modal) {
            console.error(`Modal "${id}" not found`);
            return false;
        }

        modal.hide();
        
        if (this.activeModal === modal) {
            this.activeModal = null;
            // Hide backdrop
            this.backdrop.style.opacity = '0';
            this.backdrop.style.visibility = 'hidden';
        }
        
        return true;
    }

    /**
     * Close active modal
     */
    closeActive(animate = true) {
        if (this.activeModal) {
            const id = this.activeModal.id;
            this.hide(id);
        }
    }

    /**
     * Destroy modal
     */
    destroy(id) {
        const modal = this.modals.get(id);
        if (!modal) {
            console.error(`Modal "${id}" not found`);
            return false;
        }

        if (this.activeModal === modal) {
            this.closeActive();
        }

        modal.destroy();
        this.modals.delete(id);
        return true;
    }

    /**
     * Get modal instance
     */
    get(id) {
        return this.modals.get(id);
    }

    /**
     * Check if modal exists
     */
    has(id) {
        return this.modals.has(id);
    }

    /**
     * Get all modal IDs
     */
    getAll() {
        return Array.from(this.modals.keys());
    }

    /**
     * Cleanup
     */
    destroyAll() {
        for (const [id, modal] of this.modals) {
            modal.destroy();
        }
        this.modals.clear();
        
        if (this.backdrop && this.backdrop.parentNode) {
            this.backdrop.parentNode.removeChild(this.backdrop);
        }
        
        if (this.escapeKeyHandler) {
            document.removeEventListener('keydown', this.escapeKeyHandler);
        }
    }
}

class Modal {
    constructor(id, config, manager) {
        this.id = id;
        this.config = config;
        this.manager = manager;
        this.element = null;
        this.headerElement = null;
        this.bodyElement = null;
        this.footerElement = null;
        this.isVisible = false;
        this.data = null;
        
        this.create();
    }

    create() {
        // Create modal container
        this.element = document.createElement('div');
        this.element.id = `astraltube-modal-${this.id}`;
        this.element.className = `astraltube-modal ${this.config.className}`;
        this.element.setAttribute('role', 'dialog');
        this.element.setAttribute('aria-modal', 'true');
        this.element.setAttribute('aria-labelledby', `modal-title-${this.id}`);
        
        // Apply size class
        this.element.classList.add(`modal-${this.config.size}`);
        
        // Create modal structure
        this.createStructure();
        
        // Apply styles
        this.applyStyles();
        
        // Setup event handlers
        this.setupEventHandlers();
        
        // Add to backdrop
        this.manager.backdrop.appendChild(this.element);
    }

    createStructure() {
        this.element.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title" id="modal-title-${this.id}">${this.config.title}</h2>
                    ${this.config.closable ? '<button class="modal-close" aria-label="Close">&times;</button>' : ''}
                </div>
                <div class="modal-body">
                    ${typeof this.config.content === 'string' ? this.config.content : ''}
                </div>
                ${this.config.buttons.length > 0 ? '<div class="modal-footer"></div>' : ''}
            </div>
        `;
        
        // Get references to elements
        this.headerElement = this.element.querySelector('.modal-header');
        this.bodyElement = this.element.querySelector('.modal-body');
        this.footerElement = this.element.querySelector('.modal-footer');
        
        // Add custom content if it's a DOM element
        if (this.config.content instanceof HTMLElement) {
            this.bodyElement.innerHTML = '';
            this.bodyElement.appendChild(this.config.content);
        }
        
        // Create buttons
        this.createButtons();
    }

    createButtons() {
        if (!this.footerElement || this.config.buttons.length === 0) return;
        
        this.config.buttons.forEach((buttonConfig, index) => {
            const button = document.createElement('button');
            button.className = `modal-button ${buttonConfig.className || ''}`;
            button.textContent = buttonConfig.text || `Button ${index + 1}`;
            
            if (buttonConfig.primary) {
                button.classList.add('modal-button-primary');
            }
            
            if (buttonConfig.disabled) {
                button.disabled = true;
            }
            
            if (buttonConfig.onClick) {
                button.addEventListener('click', (e) => {
                    const result = buttonConfig.onClick(this.data, this);
                    
                    // Close modal if onClick returns true or undefined
                    if (result !== false) {
                        this.hide();
                    }
                });
            }
            
            this.footerElement.appendChild(button);
        });
    }

    applyStyles() {
        const baseStyles = `
            .astraltube-modal {
                position: relative;
                max-width: 90vw;
                max-height: 90vh;
                margin: 20px;
                opacity: 0;
                transform: scale(0.9);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: ${this.manager.zIndexBase};
            }
            
            .astraltube-modal.modal-visible {
                opacity: 1;
                transform: scale(1);
            }
            
            .astraltube-modal.modal-small .modal-content { max-width: 400px; }
            .astraltube-modal.modal-medium .modal-content { max-width: 600px; }
            .astraltube-modal.modal-large .modal-content { max-width: 900px; }
            .astraltube-modal.modal-fullscreen .modal-content { 
                width: 100vw; 
                height: 100vh; 
                max-width: none; 
                max-height: none; 
                border-radius: 0; 
            }
            
            .modal-content {
                background: white;
                border-radius: 12px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                display: flex;
                flex-direction: column;
                max-height: inherit;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            
            .modal-header {
                padding: 24px 24px 0 24px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #e5e7eb;
                margin-bottom: 0;
                flex-shrink: 0;
            }
            
            .modal-title {
                margin: 0;
                font-size: 1.25rem;
                font-weight: 600;
                color: #111827;
                line-height: 1.5;
            }
            
            .modal-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #6b7280;
                padding: 8px;
                border-radius: 6px;
                transition: all 0.2s;
                line-height: 1;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .modal-close:hover {
                background: #f3f4f6;
                color: #374151;
            }
            
            .modal-body {
                padding: 24px;
                overflow-y: auto;
                flex: 1;
                color: #374151;
                line-height: 1.6;
            }
            
            .modal-footer {
                padding: 16px 24px 24px 24px;
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                border-top: 1px solid #e5e7eb;
                flex-shrink: 0;
            }
            
            .modal-button {
                padding: 8px 16px;
                border: 1px solid #d1d5db;
                background: white;
                color: #374151;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s;
                min-width: 80px;
            }
            
            .modal-button:hover {
                background: #f9fafb;
                border-color: #9ca3af;
            }
            
            .modal-button-primary {
                background: #3b82f6;
                color: white;
                border-color: #3b82f6;
            }
            
            .modal-button-primary:hover {
                background: #2563eb;
                border-color: #2563eb;
            }
            
            .modal-button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            /* Animation variants */
            .astraltube-modal.modal-slide {
                transform: translateY(20px);
            }
            
            .astraltube-modal.modal-slide.modal-visible {
                transform: translateY(0);
            }
            
            .astraltube-modal.modal-zoom {
                transform: scale(0.8);
            }
            
            .astraltube-modal.modal-zoom.modal-visible {
                transform: scale(1);
            }
            
            /* Dark mode support */
            @media (prefers-color-scheme: dark) {
                .modal-content {
                    background: #1f2937;
                    color: #f9fafb;
                }
                
                .modal-title {
                    color: #f9fafb;
                }
                
                .modal-header,
                .modal-footer {
                    border-color: #374151;
                }
                
                .modal-close {
                    color: #9ca3af;
                }
                
                .modal-close:hover {
                    background: #374151;
                    color: #f3f4f6;
                }
                
                .modal-button {
                    background: #374151;
                    color: #f9fafb;
                    border-color: #4b5563;
                }
                
                .modal-button:hover {
                    background: #4b5563;
                    border-color: #6b7280;
                }
            }
        `;
        
        // Add styles to head if not already present
        if (!document.getElementById('astraltube-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'astraltube-modal-styles';
            style.textContent = baseStyles;
            document.head.appendChild(style);
        }
    }

    setupEventHandlers() {
        // Close button
        const closeBtn = this.element.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hide();
            });
        }
        
        // Prevent closing when clicking modal content
        const modalContent = this.element.querySelector('.modal-content');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }

    show(data = null) {
        this.data = data;
        this.isVisible = true;
        
        // Apply animation class
        if (this.config.animation !== 'fade') {
            this.element.classList.add(`modal-${this.config.animation}`);
        }
        
        // Trigger show callback
        if (this.config.onShow) {
            this.config.onShow(data, this);
        }
        
        // Show modal with animation
        requestAnimationFrame(() => {
            this.element.classList.add('modal-visible');
        });
        
        // Focus first focusable element
        this.focusFirst();
    }

    hide() {
        if (!this.isVisible) return;
        
        this.isVisible = false;
        
        // Hide with animation
        this.element.classList.remove('modal-visible');
        
        // Trigger hide callback
        if (this.config.onHide) {
            this.config.onHide(this.data, this);
        }
        
        this.data = null;
    }

    destroy() {
        // Trigger destroy callback
        if (this.config.onDestroy) {
            this.config.onDestroy(this);
        }
        
        // Remove from DOM
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        this.element = null;
        this.headerElement = null;
        this.bodyElement = null;
        this.footerElement = null;
    }

    // Utility methods
    setTitle(title) {
        const titleElement = this.element.querySelector('.modal-title');
        if (titleElement) {
            titleElement.textContent = title;
        }
        this.config.title = title;
    }

    setContent(content) {
        if (!this.bodyElement) return;
        
        if (typeof content === 'string') {
            this.bodyElement.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            this.bodyElement.innerHTML = '';
            this.bodyElement.appendChild(content);
        }
        
        this.config.content = content;
    }

    updateData(data) {
        this.data = data;
    }

    focusFirst() {
        const focusable = this.element.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusable.length > 0) {
            focusable[0].focus();
        }
    }

    getButton(index) {
        const buttons = this.element.querySelectorAll('.modal-button');
        return buttons[index] || null;
    }

    enableButton(index) {
        const button = this.getButton(index);
        if (button) button.disabled = false;
    }

    disableButton(index) {
        const button = this.getButton(index);
        if (button) button.disabled = true;
    }
}

// Predefined modal templates
export class ModalTemplates {
    static confirm(manager, options = {}) {
        const config = {
            title: options.title || 'Confirm',
            content: options.message || 'Are you sure?',
            size: 'small',
            buttons: [
                {
                    text: options.cancelText || 'Cancel',
                    onClick: () => {
                        if (options.onCancel) options.onCancel();
                        return true; // Close modal
                    }
                },
                {
                    text: options.confirmText || 'Confirm',
                    primary: true,
                    onClick: () => {
                        if (options.onConfirm) options.onConfirm();
                        return true; // Close modal
                    }
                }
            ],
            ...options
        };
        
        const id = options.id || 'confirm-' + Date.now();
        return manager.createModal(id, config);
    }

    static alert(manager, options = {}) {
        const config = {
            title: options.title || 'Alert',
            content: options.message || '',
            size: 'small',
            buttons: [
                {
                    text: options.buttonText || 'OK',
                    primary: true,
                    onClick: () => {
                        if (options.onOK) options.onOK();
                        return true; // Close modal
                    }
                }
            ],
            ...options
        };
        
        const id = options.id || 'alert-' + Date.now();
        return manager.createModal(id, config);
    }

    static prompt(manager, options = {}) {
        const inputId = 'prompt-input-' + Date.now();
        const content = `
            <p>${options.message || 'Please enter a value:'}</p>
            <input type="text" id="${inputId}" 
                   value="${options.defaultValue || ''}" 
                   placeholder="${options.placeholder || ''}"
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; margin-top: 8px;">
        `;
        
        const config = {
            title: options.title || 'Input Required',
            content: content,
            size: 'small',
            buttons: [
                {
                    text: options.cancelText || 'Cancel',
                    onClick: () => {
                        if (options.onCancel) options.onCancel();
                        return true;
                    }
                },
                {
                    text: options.confirmText || 'OK',
                    primary: true,
                    onClick: (data, modal) => {
                        const input = modal.element.querySelector(`#${inputId}`);
                        const value = input ? input.value : '';
                        
                        if (options.onConfirm) options.onConfirm(value);
                        return true;
                    }
                }
            ],
            onShow: (data, modal) => {
                // Focus the input after modal is shown
                setTimeout(() => {
                    const input = modal.element.querySelector(`#${inputId}`);
                    if (input) {
                        input.focus();
                        input.select();
                    }
                }, 100);
            },
            ...options
        };
        
        const id = options.id || 'prompt-' + Date.now();
        return manager.createModal(id, config);
    }
}

// Create global modal manager instance
export const modalManager = new ModalManager();

// Convenience functions
export const showModal = (id, data) => modalManager.show(id, data);
export const hideModal = (id) => modalManager.hide(id);
export const createModal = (id, options) => modalManager.createModal(id, options);

// Export for direct use
export { Modal };