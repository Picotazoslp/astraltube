/* AstralTube v3 - Enhanced Options Page JavaScript */

class AstralTubeOptionsEnhanced {
    constructor() {
        this.currentSection = 'general';
        this.virtualScrollInstances = new Map();
        this.touchStartY = 0;
        this.isSwiping = false;
        this.swipeThreshold = 50;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupAccessibility();
        this.setupVirtualScrolling();
        this.setupTouchGestures();
        this.setupProgressiveDisclosure();
        this.setupOfflineHandling();
        this.loadSettings();
        
        // Initialize focus management
        this.focusTrap = new FocusTrap();
        
        console.log('AstralTube Options Enhanced initialized');
    }
    
    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-item').forEach(tab => {
            tab.addEventListener('click', (e) => this.handleTabClick(e));
            tab.addEventListener('keydown', (e) => this.handleTabKeydown(e));
        });
        
        // Settings changes
        document.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('change', (e) => this.handleSettingChange(e));
        });
        
        // Button actions
        document.getElementById('exportBtn')?.addEventListener('click', () => this.exportSettings());
        document.getElementById('importBtn')?.addEventListener('click', () => this.importSettings());
        document.getElementById('resetAllBtn')?.addEventListener('click', () => this.resetAllSettings());
        document.getElementById('saveBtn')?.addEventListener('click', () => this.saveSettings());
        
        // Form validation
        document.querySelectorAll('input[required]').forEach(input => {
            input.addEventListener('invalid', (e) => this.handleValidationError(e));
            input.addEventListener('input', (e) => this.clearValidationError(e));
        });
    }
    
    setupAccessibility() {
        // Enhanced keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                this.handleTabNavigation(e);
            } else if (e.key === 'Escape') {
                this.handleEscape(e);
            } else if (e.key === 'Enter' || e.key === ' ') {
                this.handleActivation(e);
            }
        });
        
        // Roving tabindex for tab navigation
        this.setupRovingTabindex();
        
        // Skip links
        document.querySelector('.skip-nav')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('main-content')?.focus();
            this.announceToScreenReader('Skipped to main content');
        });
    }
    
    setupRovingTabindex() {
        const tabs = document.querySelectorAll('.nav-item');
        let currentIndex = 0;
        
        tabs.forEach((tab, index) => {
            tab.addEventListener('keydown', (e) => {
                switch(e.key) {
                    case 'ArrowLeft':
                    case 'ArrowUp':
                        e.preventDefault();
                        currentIndex = (index - 1 + tabs.length) % tabs.length;
                        this.focusTab(tabs[currentIndex]);
                        break;
                    case 'ArrowRight':
                    case 'ArrowDown':
                        e.preventDefault();
                        currentIndex = (index + 1) % tabs.length;
                        this.focusTab(tabs[currentIndex]);
                        break;
                    case 'Home':
                        e.preventDefault();
                        currentIndex = 0;
                        this.focusTab(tabs[currentIndex]);
                        break;
                    case 'End':
                        e.preventDefault();
                        currentIndex = tabs.length - 1;
                        this.focusTab(tabs[currentIndex]);
                        break;
                }
            });
        });
    }
    
    focusTab(tab) {
        // Update tabindex
        document.querySelectorAll('.nav-item').forEach(t => t.tabIndex = -1);
        tab.tabIndex = 0;
        tab.focus();
    }
    
    setupVirtualScrolling() {
        // Virtual scrolling for large lists
        const scrollContainers = document.querySelectorAll('.virtual-scroll');
        scrollContainers.forEach(container => {
            const virtualScroll = new VirtualScroll(container);
            this.virtualScrollInstances.set(container, virtualScroll);
        });
    }
    
    setupTouchGestures() {
        if (!this.isTouchDevice()) return;
        
        const tabContainer = document.querySelector('.nav-container');
        
        tabContainer.addEventListener('touchstart', (e) => {
            this.touchStartY = e.touches[0].clientY;
            this.isSwiping = true;
        }, { passive: true });
        
        tabContainer.addEventListener('touchmove', (e) => {
            if (!this.isSwiping) return;
            
            const touchY = e.touches[0].clientY;
            const deltaY = this.touchStartY - touchY;
            
            if (Math.abs(deltaY) > this.swipeThreshold) {
                e.preventDefault();
                const direction = deltaY > 0 ? 'up' : 'down';
                this.handleSwipeGesture(direction);
                this.isSwiping = false;
            }
        });
        
        tabContainer.addEventListener('touchend', () => {
            this.isSwiping = false;
        });
    }
    
    handleSwipeGesture(direction) {
        const tabs = Array.from(document.querySelectorAll('.nav-item'));
        const activeIndex = tabs.findIndex(tab => tab.classList.contains('active'));
        
        let newIndex;
        if (direction === 'up' && activeIndex > 0) {
            newIndex = activeIndex - 1;
        } else if (direction === 'down' && activeIndex < tabs.length - 1) {
            newIndex = activeIndex + 1;
        }
        
        if (newIndex !== undefined) {
            tabs[newIndex].click();
            this.announceToScreenReader(`Switched to ${tabs[newIndex].textContent.trim()} section`);
        }
    }
    
    setupProgressiveDisclosure() {
        // Enhanced disclosure patterns for complex settings
        document.querySelectorAll('[data-disclosure]').forEach(trigger => {
            const targetId = trigger.getAttribute('data-disclosure');
            const target = document.getElementById(targetId);
            
            if (target) {
                trigger.addEventListener('click', () => {
                    const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
                    trigger.setAttribute('aria-expanded', !isExpanded);
                    target.hidden = isExpanded;
                    
                    // Animate the disclosure
                    if (!isExpanded) {
                        target.style.height = '0';
                        target.hidden = false;
                        target.style.height = target.scrollHeight + 'px';
                    } else {
                        target.style.height = '0';
                        setTimeout(() => {
                            target.hidden = true;
                            target.style.height = '';
                        }, 300);
                    }
                });
            }
        });
    }
    
    setupOfflineHandling() {
        window.addEventListener('online', () => {
            this.updateConnectionStatus(true);
            this.showNotification('Connection restored', 'success');
        });
        
        window.addEventListener('offline', () => {
            this.updateConnectionStatus(false);
            this.showNotification('Working offline - changes will sync when connection is restored', 'warning');
        });
        
        // Initial status
        this.updateConnectionStatus(navigator.onLine);
    }
    
    updateConnectionStatus(isOnline) {
        const indicator = document.querySelector('.connection-indicator');
        if (indicator) {
            indicator.className = `connection-indicator ${isOnline ? 'online' : 'offline'}`;
            indicator.title = isOnline ? 'Online' : 'Offline';
        }
        
        // Update sync button state
        const syncBtn = document.getElementById('syncBtn');
        if (syncBtn) {
            syncBtn.disabled = !isOnline;
            syncBtn.setAttribute('aria-label', isOnline ? 'Sync Status' : 'Offline - Cannot sync');
        }
    }
    
    handleTabClick(e) {
        e.preventDefault();
        const tab = e.currentTarget;
        const section = tab.getAttribute('data-section');
        this.switchToSection(section);
    }
    
    handleTabKeydown(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.currentTarget.click();
        }
    }
    
    switchToSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.options-section').forEach(section => {
            section.classList.remove('active');
            section.setAttribute('aria-hidden', 'true');
        });
        
        // Show target section
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
            targetSection.setAttribute('aria-hidden', 'false');
        }
        
        // Update tab states
        document.querySelectorAll('.nav-item').forEach(tab => {
            tab.classList.remove('active');
            tab.setAttribute('aria-selected', 'false');
            tab.tabIndex = -1;
        });
        
        const activeTab = document.querySelector(`[data-section=\"${sectionId}\"]`);
        if (activeTab) {
            activeTab.classList.add('active');
            activeTab.setAttribute('aria-selected', 'true');
            activeTab.tabIndex = 0;
        }
        
        this.currentSection = sectionId;
        this.announceToScreenReader(`${sectionId} section selected`);
        
        // Update URL without navigation
        if (history.replaceState) {
            history.replaceState(null, null, `#${sectionId}`);
        }
    }
    
    handleSettingChange(e) {
        const input = e.target;
        const settingId = input.id;
        const value = input.type === 'checkbox' ? input.checked : input.value;
        
        // Validate the change
        if (!this.validateSetting(settingId, value)) {
            return;
        }
        
        // Visual feedback
        this.showSettingFeedback(input, 'success');
        
        // Save to storage
        this.saveSetting(settingId, value);
        
        // Handle dependent settings
        this.updateDependentSettings(settingId, value);
        
        this.announceToScreenReader(`${settingId} updated`);
    }
    
    validateSetting(settingId, value) {
        const validators = {
            cacheSize: (val) => val >= 10 && val <= 500,
            syncInterval: (val) => ['15', '30', '60', '180'].includes(val)
        };
        
        if (validators[settingId]) {
            return validators[settingId](value);
        }
        
        return true;
    }
    
    showSettingFeedback(input, type) {
        input.classList.remove('error-state', 'success-state');
        input.classList.add(`${type}-state`);
        
        // Remove the class after animation
        setTimeout(() => {
            input.classList.remove(`${type}-state`);
        }, 2000);
    }
    
    updateDependentSettings(settingId, value) {
        const dependencies = {
            autoSync: (enabled) => {
                const interval = document.getElementById('syncInterval');
                if (interval) {
                    interval.disabled = !enabled;
                    interval.setAttribute('aria-disabled', !enabled);
                }
            },
            notifications: (enabled) => {
                const sounds = document.getElementById('notificationSounds');
                if (sounds) {
                    sounds.disabled = !enabled;
                    sounds.setAttribute('aria-disabled', !enabled);
                }
            }
        };
        
        if (dependencies[settingId]) {
            dependencies[settingId](value);
        }
    }
    
    handleValidationError(e) {
        const input = e.target;
        this.showValidationError(input, input.validationMessage);
    }
    
    showValidationError(input, message) {
        input.classList.add('error-state');
        
        // Find or create error message element
        let errorElement = input.parentNode.querySelector('.error-message');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'error-message';
            errorElement.setAttribute('role', 'alert');
            input.parentNode.appendChild(errorElement);
        }
        
        errorElement.textContent = message;
        errorElement.innerHTML = `<span class=\"error-icon\" aria-hidden=\"true\">⚠</span> ${message}`;
        
        this.announceToScreenReader(`Error: ${message}`);
    }
    
    clearValidationError(e) {
        const input = e.target;
        input.classList.remove('error-state');
        
        const errorElement = input.parentNode.querySelector('.error-message');
        if (errorElement) {
            errorElement.remove();
        }
    }
    
    async exportSettings() {
        try {
            this.showLoadingState(true);
            
            const settings = await this.getAllSettings();
            const dataStr = JSON.stringify(settings, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `astraltube-settings-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            this.showNotification('Settings exported successfully', 'success');
            this.announceToScreenReader('Settings exported successfully');
        } catch (error) {
            this.showNotification('Failed to export settings', 'error');
            console.error('Export failed:', error);
        } finally {
            this.showLoadingState(false);
        }
    }
    
    async importSettings() {
        try {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json';
            
            fileInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                this.showLoadingState(true);
                
                try {
                    const text = await file.text();
                    const settings = JSON.parse(text);
                    
                    await this.applySettings(settings);
                    this.showNotification('Settings imported successfully', 'success');
                    this.announceToScreenReader('Settings imported successfully');
                } catch (error) {
                    this.showNotification('Failed to import settings', 'error');
                    console.error('Import failed:', error);
                } finally {
                    this.showLoadingState(false);
                }
            };
            
            fileInput.click();
        } catch (error) {
            this.showNotification('Failed to import settings', 'error');
        }
    }
    
    showLoadingState(isLoading) {
        const buttons = document.querySelectorAll('.btn');
        buttons.forEach(btn => {
            btn.disabled = isLoading;
            if (isLoading) {
                btn.classList.add('loading');
            } else {
                btn.classList.remove('loading');
            }
        });
    }
    
    showNotification(message, type = 'info') {
        const toast = document.getElementById('statusToast');
        if (!toast) return;
        
        const content = toast.querySelector('.toast-content');
        const messageEl = toast.querySelector('.toast-message');
        const icon = toast.querySelector('.toast-icon');
        
        if (messageEl) messageEl.textContent = message;
        
        // Update icon based on type
        if (icon) {
            const icons = {
                success: '✓',
                error: '✕',
                warning: '⚠',
                info: 'ℹ'
            };
            icon.textContent = icons[type] || icons.info;
        }
        
        toast.className = `toast show ${type}`;
        toast.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.style.display = 'none';
            }, 300);
        }, 5000);
    }
    
    announceToScreenReader(message) {
        const statusRegion = document.getElementById('status-region');
        if (statusRegion) {
            statusRegion.textContent = message;
            
            // Clear after a moment to allow for new announcements
            setTimeout(() => {
                statusRegion.textContent = '';
            }, 1000);
        }
    }
    
    announceAlert(message) {
        const alertRegion = document.getElementById('alert-region');
        if (alertRegion) {
            alertRegion.textContent = message;
            setTimeout(() => {
                alertRegion.textContent = '';
            }, 1000);
        }
    }
    
    isTouchDevice() {
        return (('ontouchstart' in window) ||
               (navigator.maxTouchPoints > 0) ||
               (navigator.msMaxTouchPoints > 0));
    }
    
    async loadSettings() {
        // Implementation would load from chrome.storage or similar
        // For now, just initialize default values
        this.applyDefaultSettings();
    }
    
    applyDefaultSettings() {
        const defaults = {
            sidebarEnabled: true,
            deckModeEnabled: false,
            autoEnhance: true,
            notifications: true,
            theme: 'auto',
            virtualScrolling: true
        };
        
        Object.entries(defaults).forEach(([key, value]) => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = value;
                } else {
                    element.value = value;
                }
            }
        });
    }
    
    async saveSetting(key, value) {
        // Implementation would save to chrome.storage
        console.log(`Saving setting: ${key} = ${value}`);
    }
    
    async getAllSettings() {
        // Implementation would get all from chrome.storage
        return {};
    }
    
    async applySettings(settings) {
        // Implementation would apply imported settings
        console.log('Applying settings:', settings);
    }
}

// Virtual Scroll Implementation for Large Lists
class VirtualScroll {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            itemHeight: 50,
            overscan: 5,
            estimateItemHeight: null,
            renderItem: null,
            getItemKey: null,
            dynamicHeight: false,
            horizontal: false,
            ...options
        };
        
        this.items = [];
        this.visibleItems = [];
        this.itemHeight = this.options.itemHeight;
        this.itemHeights = new Map(); // For dynamic heights
        this.containerHeight = 0;
        this.scrollTop = 0;
        this.startIndex = 0;
        this.endIndex = 0;
        this.totalHeight = 0;
        
        // DOM elements
        this.viewport = null;
        this.scrollArea = null;
        this.itemContainer = null;
        
        // Performance
        this.isScrolling = false;
        this.scrollTimeout = null;
        this.renderScheduled = false;
        
        // Cache
        this.renderedElements = new Map();
        this.elementPool = [];
        
        this.init();
    }
    
    init() {
        this.setupDOM();
        this.measureContainer();
        this.setupScrollListener();
        this.setupResizeObserver();
        this.render();
    }
    
    setupDOM() {
        // Clear container and setup structure
        this.container.innerHTML = '';
        this.container.style.cssText += `
            position: relative;
            overflow: auto;
            will-change: scroll-position;
        `;
        
        // Create viewport
        this.viewport = document.createElement('div');
        this.viewport.className = 'virtual-scroll-viewport';
        this.viewport.style.cssText = `
            position: relative;
            width: 100%;
            height: 100%;
            overflow: hidden;
        `;
        
        // Create scroll area (for scrollbar)
        this.scrollArea = document.createElement('div');
        this.scrollArea.className = 'virtual-scroll-area';
        this.scrollArea.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 1px;
            height: ${this.totalHeight}px;
            pointer-events: none;
        `;
        
        // Create item container
        this.itemContainer = document.createElement('div');
        this.itemContainer.className = 'virtual-scroll-items';
        this.itemContainer.style.cssText = `
            position: relative;
            width: 100%;
            height: 100%;
        `;
        
        this.viewport.appendChild(this.itemContainer);
        this.container.appendChild(this.viewport);
        this.container.appendChild(this.scrollArea);
    }
    
    measureContainer() {
        const rect = this.container.getBoundingClientRect();
        this.containerHeight = rect.height;
        this.containerWidth = rect.width;
    }
    
    setupScrollListener() {
        let ticking = false;
        
        const handleScroll = () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    this.scrollTop = this.container.scrollTop;
                    this.onScroll();
                    ticking = false;
                });
                ticking = true;
            }
        };
        
        this.container.addEventListener('scroll', handleScroll, { passive: true });
    }
    
    setupResizeObserver() {
        if (typeof ResizeObserver !== 'undefined') {
            const resizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    if (entry.target === this.container) {
                        this.measureContainer();
                        this.calculateVisibleRange();
                        this.scheduleRender();
                    }
                }
            });
            
            resizeObserver.observe(this.container);
        }
    }
    
    onScroll() {
        this.isScrolling = true;
        
        // Clear previous timeout
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
        
        // Set scrolling to false after scroll stops
        this.scrollTimeout = setTimeout(() => {
            this.isScrolling = false;
        }, 150);
        
        this.calculateVisibleRange();
        this.scheduleRender();
    }
    
    calculateVisibleRange() {
        if (this.items.length === 0) {
            this.startIndex = 0;
            this.endIndex = 0;
            return;
        }
        
        if (this.options.dynamicHeight) {
            this.calculateDynamicRange();
        } else {
            this.calculateFixedRange();
        }
    }
    
    calculateFixedRange() {
        this.startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.options.overscan);
        this.endIndex = Math.min(
            this.items.length - 1,
            Math.ceil((this.scrollTop + this.containerHeight) / this.itemHeight) + this.options.overscan
        );
    }
    
    calculateDynamicRange() {
        let accumulatedHeight = 0;
        this.startIndex = 0;
        
        // Find start index
        for (let i = 0; i < this.items.length; i++) {
            const height = this.getItemHeight(i);
            if (accumulatedHeight + height > this.scrollTop) {
                this.startIndex = Math.max(0, i - this.options.overscan);
                break;
            }
            accumulatedHeight += height;
        }
        
        // Find end index
        accumulatedHeight = this.getOffsetForIndex(this.startIndex);
        this.endIndex = this.startIndex;
        
        for (let i = this.startIndex; i < this.items.length; i++) {
            if (accumulatedHeight > this.scrollTop + this.containerHeight + this.options.overscan * this.itemHeight) {
                break;
            }
            this.endIndex = i;
            accumulatedHeight += this.getItemHeight(i);
        }
    }
    
    getItemHeight(index) {
        if (this.options.dynamicHeight) {
            return this.itemHeights.get(index) || this.estimateItemHeight(index);
        }
        return this.itemHeight;
    }
    
    estimateItemHeight(index) {
        if (this.options.estimateItemHeight) {
            return this.options.estimateItemHeight(this.items[index], index);
        }
        return this.itemHeight;
    }
    
    getOffsetForIndex(index) {
        if (!this.options.dynamicHeight) {
            return index * this.itemHeight;
        }
        
        let offset = 0;
        for (let i = 0; i < index; i++) {
            offset += this.getItemHeight(i);
        }
        return offset;
    }
    
    updateTotalHeight() {
        if (this.options.dynamicHeight) {
            this.totalHeight = 0;
            for (let i = 0; i < this.items.length; i++) {
                this.totalHeight += this.getItemHeight(i);
            }
        } else {
            this.totalHeight = this.items.length * this.itemHeight;
        }
        
        // Update scroll area height
        if (this.scrollArea) {
            this.scrollArea.style.height = this.totalHeight + 'px';
        }
    }
    
    scheduleRender() {
        if (!this.renderScheduled) {
            this.renderScheduled = true;
            requestAnimationFrame(() => {
                this.render();
                this.renderScheduled = false;
            });
        }
    }
    
    render() {
        if (!this.itemContainer) return;
        
        // Clear existing items
        const currentElements = Array.from(this.itemContainer.children);
        currentElements.forEach(el => {
            this.returnElementToPool(el);
        });
        this.itemContainer.innerHTML = '';
        
        // Render visible items
        for (let i = this.startIndex; i <= this.endIndex && i < this.items.length; i++) {
            const element = this.renderItem(i);
            if (element) {
                this.itemContainer.appendChild(element);
            }
        }
        
        // Update container transform for positioning
        const offset = this.getOffsetForIndex(this.startIndex);
        this.itemContainer.style.transform = `translateY(${offset}px)`;
    }
    
    renderItem(index) {
        const item = this.items[index];
        const key = this.options.getItemKey ? this.options.getItemKey(item, index) : index;
        
        // Check if element is already rendered
        let element = this.renderedElements.get(key);
        
        if (!element) {
            // Get element from pool or create new
            element = this.getElementFromPool();
            
            if (!element) {
                element = this.createElement();
            }
            
            this.renderedElements.set(key, element);
        }
        
        // Update element content
        if (this.options.renderItem) {
            this.options.renderItem(element, item, index);
        } else {
            this.defaultRenderItem(element, item, index);
        }
        
        // Set element position and size
        element.style.cssText += `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: ${this.getItemHeight(index)}px;
        `;
        
        // Store height if dynamic
        if (this.options.dynamicHeight && element.offsetHeight) {
            this.itemHeights.set(index, element.offsetHeight);
        }
        
        return element;
    }
    
    createElement() {
        const element = document.createElement('div');
        element.className = 'virtual-scroll-item';
        return element;
    }
    
    getElementFromPool() {
        return this.elementPool.pop() || null;
    }
    
    returnElementToPool(element) {
        if (this.elementPool.length < 20) { // Limit pool size
            this.elementPool.push(element);
        }
    }
    
    defaultRenderItem(element, item, index) {
        element.textContent = typeof item === 'string' ? item : JSON.stringify(item);
    }
    
    setItems(items) {
        this.items = items || [];
        this.renderedElements.clear(); // Clear render cache
        this.updateTotalHeight();
        this.calculateVisibleRange();
        this.scheduleRender();
    }
    
    appendItems(newItems) {
        this.items.push(...newItems);
        this.updateTotalHeight();
        this.calculateVisibleRange();
        this.scheduleRender();
    }
    
    prependItems(newItems) {
        this.items.unshift(...newItems);
        this.updateTotalHeight();
        this.calculateVisibleRange();
        this.scheduleRender();
    }
    
    removeItem(index) {
        if (index >= 0 && index < this.items.length) {
            this.items.splice(index, 1);
            this.renderedElements.clear();
            this.updateTotalHeight();
            this.calculateVisibleRange();
            this.scheduleRender();
        }
    }
    
    updateItem(index, newItem) {
        if (index >= 0 && index < this.items.length) {
            this.items[index] = newItem;
            this.scheduleRender();
        }
    }
    
    scrollToIndex(index, behavior = 'smooth') {
        const offset = this.getOffsetForIndex(index);
        this.container.scrollTo({
            top: offset,
            behavior
        });
    }
    
    scrollToTop(behavior = 'smooth') {
        this.container.scrollTo({
            top: 0,
            behavior
        });
    }
    
    scrollToBottom(behavior = 'smooth') {
        this.container.scrollTo({
            top: this.totalHeight,
            behavior
        });
    }
    
    getVisibleRange() {
        return {
            start: this.startIndex,
            end: this.endIndex,
            count: this.endIndex - this.startIndex + 1
        };
    }
    
    getStats() {
        return {
            totalItems: this.items.length,
            visibleItems: this.endIndex - this.startIndex + 1,
            containerHeight: this.containerHeight,
            totalHeight: this.totalHeight,
            scrollTop: this.scrollTop,
            renderedElements: this.renderedElements.size,
            poolSize: this.elementPool.length
        };
    }
    
    destroy() {
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
        
        this.renderedElements.clear();
        this.elementPool = [];
        this.items = [];
        
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

// Focus Trap for Modals and Complex UI
class FocusTrap {
    constructor() {
        this.focusableSelectors = [
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
            'a[href]'
        ].join(',');
    }
    
    trap(container) {
        const focusableElements = container.querySelectorAll(this.focusableSelectors);
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        const handleTabKey = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        };
        
        container.addEventListener('keydown', handleTabKey);
        
        // Focus first element
        if (firstElement) {
            firstElement.focus();
        }
        
        return () => {
            container.removeEventListener('keydown', handleTabKey);
        };
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new AstralTubeOptionsEnhanced());
} else {
    new AstralTubeOptionsEnhanced();
}