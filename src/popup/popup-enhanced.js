/* AstralTube v3 - Enhanced Popup JavaScript */

class AstralTubePopupEnhanced {
    constructor() {
        this.currentTab = 'dashboard';
        this.selectedItems = new Set();
        this.bulkActionMode = false;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.isSwiping = false;
        this.virtualScrollInstances = new Map();
        this.offlineQueue = [];
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupAccessibility();
        this.setupTouchGestures();
        this.setupVirtualScrolling();
        this.setupBulkSelection();
        this.setupOfflineHandling();
        this.setupQuickActions();
        this.loadDashboardData();
        
        console.log('AstralTube Popup Enhanced initialized');
    }
    
    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.handleTabClick(e));
            tab.addEventListener('keydown', (e) => this.handleTabKeydown(e));
        });
        
        // Quick actions
        document.getElementById('createPlaylistBtn')?.addEventListener('click', () => this.showCreatePlaylistModal());
        document.getElementById('createCollectionBtn')?.addEventListener('click', () => this.showCreateCollectionModal());
        document.getElementById('toggleSidebarBtn')?.addEventListener('click', () => this.toggleSidebar());
        document.getElementById('toggleDeckBtn')?.addEventListener('click', () => this.toggleDeckMode());
        
        // Settings and sync
        document.getElementById('settingsBtn')?.addEventListener('click', () => this.openSettings());
        document.getElementById('syncBtn')?.addEventListener('click', () => this.performSync());
        
        // Search functionality
        document.getElementById('playlistSearch')?.addEventListener('input', (e) => this.handleSearch(e, 'playlists'));
        document.getElementById('subscriptionSearch')?.addEventListener('input', (e) => this.handleSearch(e, 'subscriptions'));
        
        // Filter and sort
        document.getElementById('playlistFilter')?.addEventListener('click', () => this.showFilterModal('playlists'));
        document.getElementById('playlistSort')?.addEventListener('click', () => this.showSortModal('playlists'));
        
        // Stats refresh
        document.getElementById('refreshStats')?.addEventListener('click', () => this.refreshStats());
        
        // Bulk actions
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.exitBulkMode();
            } else if (e.ctrlKey || e.metaKey) {
                if (e.key === 'a') {
                    e.preventDefault();
                    this.selectAll();
                }
            }
        });
    }
    
    setupAccessibility() {
        // Enhanced keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                this.handleTabNavigation(e);
            } else if (e.key === 'Enter' || e.key === ' ') {
                this.handleActivation(e);
            }
        });
        
        // Roving tabindex for tab navigation
        this.setupRovingTabindex();
        
        // Announce tab changes
        const tabs = document.querySelectorAll('.nav-tab');
        tabs.forEach(tab => {
            tab.addEventListener('focus', () => {
                this.announceToScreenReader(`${tab.textContent.trim()} tab focused`);
            });
        });
    }
    
    setupRovingTabindex() {
        const tabs = document.querySelectorAll('.nav-tab');
        let currentIndex = 0;
        
        tabs.forEach((tab, index) => {
            tab.addEventListener('keydown', (e) => {
                switch(e.key) {
                    case 'ArrowLeft':
                        e.preventDefault();
                        currentIndex = (index - 1 + tabs.length) % tabs.length;
                        this.focusTab(tabs[currentIndex]);
                        break;
                    case 'ArrowRight':
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
        document.querySelectorAll('.nav-tab').forEach(t => t.tabIndex = -1);
        tab.tabIndex = 0;
        tab.focus();
    }
    
    setupTouchGestures() {
        if (!this.isTouchDevice()) return;
        
        const tabContainer = document.querySelector('.nav-tabs');
        
        // Swipe for tab navigation
        tabContainer.addEventListener('touchstart', (e) => {
            this.touchStartX = e.touches[0].clientX;
            this.touchStartY = e.touches[0].clientY;
            this.isSwiping = true;
        }, { passive: true });
        
        tabContainer.addEventListener('touchmove', (e) => {
            if (!this.isSwiping) return;
            
            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            const deltaX = this.touchStartX - touchX;
            const deltaY = Math.abs(this.touchStartY - touchY);
            
            // Only swipe horizontally if not scrolling vertically
            if (deltaY < 30 && Math.abs(deltaX) > 50) {
                e.preventDefault();
                const direction = deltaX > 0 ? 'left' : 'right';
                this.handleSwipeGesture(direction);
                this.isSwiping = false;
            }
        });
        
        tabContainer.addEventListener('touchend', () => {
            this.isSwiping = false;
        });
        
        // Add mobile-specific quick actions
        this.addMobileQuickActions();
    }
    
    addMobileQuickActions() {
        const quickActionsContainer = document.createElement('div');
        quickActionsContainer.className = 'mobile-quick-actions';
        quickActionsContainer.innerHTML = `
            <button class="mobile-quick-btn" data-action="add-current-video" aria-label="Add current video to playlist">
                <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                    <path fill="currentColor" d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                </svg>
            </button>
            <button class="mobile-quick-btn" data-action="quick-sync" aria-label="Quick sync">
                <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                    <path fill="currentColor" d="M12,18A6,6 0 0,1 6,12C6,11 6.25,10.03 6.7,9.2L5.24,7.74C4.46,8.97 4,10.43 4,12A8,8 0 0,0 12,20V23L16,19L12,15M12,4V1L8,5L12,9V6A6,6 0 0,1 18,12C18,13 17.75,13.97 17.3,14.8L18.76,16.26C19.54,15.03 20,13.57 20,12A8,8 0 0,0 12,4Z"/>
                </svg>
            </button>
            <button class="mobile-quick-btn" data-action="bulk-select" aria-label="Toggle bulk selection mode">
                <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                    <path fill="currentColor" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
                </svg>
            </button>
        `;
        
        const popupFooter = document.querySelector('.popup-footer');
        popupFooter?.parentNode.insertBefore(quickActionsContainer, popupFooter);
        
        // Add event listeners
        quickActionsContainer.addEventListener('click', (e) => {
            const button = e.target.closest('.mobile-quick-btn');
            if (button) {
                const action = button.dataset.action;
                this.handleMobileQuickAction(action);
            }
        });
    }
    
    handleMobileQuickAction(action) {
        switch (action) {
            case 'add-current-video':
                this.addCurrentVideoToPlaylist();
                break;
            case 'quick-sync':
                this.performQuickSync();
                break;
            case 'bulk-select':
                this.toggleBulkMode();
                break;
        }
    }
    
    setupVirtualScrolling() {
        const scrollContainers = document.querySelectorAll('.playlist-list, .subscriptions-list, .collections-list');
        scrollContainers.forEach(container => {
            const virtualScroll = new VirtualScrollPopup(container);
            this.virtualScrollInstances.set(container, virtualScroll);
        });
    }
    
    setupBulkSelection() {
        // Bulk selection indicators
        this.createBulkSelectionUI();
        
        // Item selection handlers
        document.addEventListener('click', (e) => {
            if (this.bulkActionMode) {
                const item = e.target.closest('.selectable-item');
                if (item) {
                    this.toggleItemSelection(item);
                }
            }
        });
        
        // Keyboard shortcuts for bulk actions
        document.addEventListener('keydown', (e) => {
            if (this.bulkActionMode) {
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    e.preventDefault();
                    this.bulkDelete();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    this.bulkEdit();
                }
            }
        });
    }
    
    createBulkSelectionUI() {
        const bulkToolbar = document.createElement('div');
        bulkToolbar.id = 'bulk-toolbar';
        bulkToolbar.className = 'bulk-toolbar hidden';
        bulkToolbar.setAttribute('role', 'toolbar');
        bulkToolbar.setAttribute('aria-label', 'Bulk actions');
        
        bulkToolbar.innerHTML = `
            <div class="bulk-info">
                <span id="bulk-count">0</span> selected
            </div>
            <div class="bulk-actions">
                <button class="bulk-action-btn" data-action="move" aria-label="Move selected items">
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                        <path fill="currentColor" d="M13,6V11H18V7.75L22.25,12L18,16.25V13H13V18H16.25L12,22.25L7.75,18H11V13H6V16.25L1.75,12L6,7.75V11H11V6H7.75L12,1.75L16.25,6H13Z"/>
                    </svg>
                </button>
                <button class="bulk-action-btn" data-action="delete" aria-label="Delete selected items">
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                        <path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                    </svg>
                </button>
                <button class="bulk-action-btn" data-action="export" aria-label="Export selected items">
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                        <path fill="currentColor" d="M23,12L19,8V11H10V13H19V16M1,18V6C1,4.89 1.89,4 3,4H15A2,2 0 0,1 17,6V9H15V6H3V18H15V15H17V18A2,2 0 0,1 15,20H3C1.89,20 1,19.11 1,18Z"/>
                    </svg>
                </button>
                <button class="bulk-action-btn" data-action="cancel" aria-label="Cancel bulk selection">
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                        <path fill="currentColor" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                    </svg>
                </button>
            </div>
        `;
        
        document.querySelector('#app').appendChild(bulkToolbar);
        
        // Bulk action handlers
        bulkToolbar.addEventListener('click', (e) => {
            const button = e.target.closest('.bulk-action-btn');
            if (button) {
                const action = button.dataset.action;
                this.handleBulkAction(action);
            }
        });
    }
    
    setupOfflineHandling() {
        window.addEventListener('online', () => {
            this.updateConnectionStatus(true);
            this.processOfflineQueue();
        });
        
        window.addEventListener('offline', () => {
            this.updateConnectionStatus(false);
        });
        
        this.updateConnectionStatus(navigator.onLine);
    }
    
    setupQuickActions() {
        // Context menus for items
        document.addEventListener('contextmenu', (e) => {
            const item = e.target.closest('.playlist-item, .subscription-item, .collection-item');
            if (item) {
                e.preventDefault();
                this.showContextMenu(e, item);
            }
        });
        
        // Long press for touch devices
        let longPressTimer;
        document.addEventListener('touchstart', (e) => {
            const item = e.target.closest('.playlist-item, .subscription-item, .collection-item');
            if (item) {
                longPressTimer = setTimeout(() => {
                    this.showContextMenu(e, item);
                    navigator.vibrate?.(50); // Haptic feedback if available
                }, 500);
            }
        });
        
        document.addEventListener('touchend', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });
        
        document.addEventListener('touchmove', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });
    }
    
    handleSwipeGesture(direction) {
        const tabs = Array.from(document.querySelectorAll('.nav-tab'));
        const activeIndex = tabs.findIndex(tab => tab.classList.contains('active'));
        
        let newIndex;
        if (direction === 'left' && activeIndex < tabs.length - 1) {
            newIndex = activeIndex + 1;
        } else if (direction === 'right' && activeIndex > 0) {
            newIndex = activeIndex - 1;
        }
        
        if (newIndex !== undefined) {
            tabs[newIndex].click();
            this.announceToScreenReader(`Switched to ${tabs[newIndex].querySelector('span').textContent.trim()} tab`);
        }
    }
    
    handleTabClick(e) {
        e.preventDefault();
        const tab = e.currentTarget;
        const tabName = tab.getAttribute('data-tab');
        this.switchToTab(tabName);
    }
    
    handleTabKeydown(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.currentTarget.click();
        }
    }
    
    switchToTab(tabName) {
        // Hide all tab panes
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
            pane.setAttribute('aria-hidden', 'true');
        });
        
        // Show target pane
        const targetPane = document.getElementById(`${tabName}Pane`);
        if (targetPane) {
            targetPane.classList.add('active');
            targetPane.setAttribute('aria-hidden', 'false');
        }
        
        // Update tab states
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
            tab.setAttribute('aria-selected', 'false');
            tab.tabIndex = -1;
        });
        
        const activeTab = document.querySelector(`[data-tab=\"${tabName}\"]`);
        if (activeTab) {
            activeTab.classList.add('active');
            activeTab.setAttribute('aria-selected', 'true');
            activeTab.tabIndex = 0;
        }
        
        this.currentTab = tabName;
        this.announceToScreenReader(`${tabName} tab selected`);
        
        // Load tab-specific data
        this.loadTabData(tabName);
    }
    
    toggleBulkMode() {
        this.bulkActionMode = !this.bulkActionMode;
        const toolbar = document.getElementById('bulk-toolbar');
        const items = document.querySelectorAll('.selectable-item');
        
        if (this.bulkActionMode) {
            toolbar?.classList.remove('hidden');
            items.forEach(item => {
                item.classList.add('bulk-mode');
                // Add selection checkbox
                if (!item.querySelector('.selection-checkbox')) {
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'selection-checkbox';
                    checkbox.setAttribute('aria-label', 'Select item');
                    item.appendChild(checkbox);
                }
            });
            this.announceToScreenReader('Bulk selection mode activated');
        } else {
            toolbar?.classList.add('hidden');
            items.forEach(item => {
                item.classList.remove('bulk-mode', 'selected');
                const checkbox = item.querySelector('.selection-checkbox');
                checkbox?.remove();
            });
            this.selectedItems.clear();
            this.announceToScreenReader('Bulk selection mode deactivated');
        }
    }
    
    toggleItemSelection(item) {
        const itemId = item.dataset.id;
        const checkbox = item.querySelector('.selection-checkbox');
        
        if (this.selectedItems.has(itemId)) {
            this.selectedItems.delete(itemId);
            item.classList.remove('selected');
            if (checkbox) checkbox.checked = false;
        } else {
            this.selectedItems.add(itemId);
            item.classList.add('selected');
            if (checkbox) checkbox.checked = true;
        }
        
        this.updateBulkToolbar();
        this.announceToScreenReader(`${this.selectedItems.size} items selected`);
    }
    
    updateBulkToolbar() {
        const countElement = document.getElementById('bulk-count');
        if (countElement) {
            countElement.textContent = this.selectedItems.size;
        }
        
        const toolbar = document.getElementById('bulk-toolbar');
        const hasSelection = this.selectedItems.size > 0;
        
        toolbar?.querySelectorAll('.bulk-action-btn:not([data-action="cancel"])').forEach(btn => {
            btn.disabled = !hasSelection;
            btn.setAttribute('aria-disabled', !hasSelection);
        });
    }
    
    selectAll() {
        if (!this.bulkActionMode) return;
        
        const items = document.querySelectorAll('.selectable-item');
        items.forEach(item => {
            const itemId = item.dataset.id;
            this.selectedItems.add(itemId);
            item.classList.add('selected');
            const checkbox = item.querySelector('.selection-checkbox');
            if (checkbox) checkbox.checked = true;
        });
        
        this.updateBulkToolbar();
        this.announceToScreenReader(`All ${this.selectedItems.size} items selected`);
    }
    
    exitBulkMode() {
        if (this.bulkActionMode) {
            this.toggleBulkMode();
        }
    }
    
    handleBulkAction(action) {
        switch (action) {
            case 'move':
                this.bulkMove();
                break;
            case 'delete':
                this.bulkDelete();
                break;
            case 'export':
                this.bulkExport();
                break;
            case 'cancel':
                this.exitBulkMode();
                break;
        }
    }
    
    async bulkDelete() {
        if (this.selectedItems.size === 0) return;
        
        const confirmed = await this.showConfirmDialog(
            `Delete ${this.selectedItems.size} items?`,
            'This action cannot be undone.'
        );
        
        if (confirmed) {
            // Implementation would delete selected items
            this.announceToScreenReader(`${this.selectedItems.size} items deleted`);
            this.selectedItems.clear();
            this.exitBulkMode();
        }
    }
    
    async bulkMove() {
        if (this.selectedItems.size === 0) return;
        
        // Show folder/collection selection modal
        const destination = await this.showMoveDialog();
        if (destination) {
            // Implementation would move items
            this.announceToScreenReader(`${this.selectedItems.size} items moved to ${destination}`);
            this.selectedItems.clear();
            this.exitBulkMode();
        }
    }
    
    async bulkExport() {
        if (this.selectedItems.size === 0) return;
        
        try {
            // Implementation would export selected items
            this.showNotification(`${this.selectedItems.size} items exported successfully`, 'success');
        } catch (error) {
            this.showNotification('Export failed', 'error');
        }
    }
    
    updateConnectionStatus(isOnline) {
        const syncBtn = document.getElementById('syncBtn');
        const status = document.getElementById('syncStatus');
        
        if (syncBtn && status) {
            if (isOnline) {
                syncBtn.classList.remove('offline');
                status.textContent = 'Synced';
                syncBtn.disabled = false;
            } else {
                syncBtn.classList.add('offline');
                status.textContent = 'Offline';
                syncBtn.disabled = true;
            }
        }
        
        // Show offline indicator
        this.showOfflineIndicator(!isOnline);
    }
    
    showOfflineIndicator(show) {
        let indicator = document.getElementById('offline-indicator');
        
        if (show && !indicator) {
            indicator = document.createElement('div');
            indicator.id = 'offline-indicator';
            indicator.className = 'offline-indicator';
            indicator.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path fill="currentColor" d="M23,9V7H19.5L21,5.5L19.5,4L17,6.5H15V7L13,5V11H23V9H23Z"/>
                </svg>
                Working offline
            `;
            indicator.setAttribute('aria-live', 'polite');
            document.querySelector('.popup-header').appendChild(indicator);
        } else if (!show && indicator) {
            indicator.remove();
        }
    }
    
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'assertive');
        
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };
        
        notification.innerHTML = `
            <span class="notification-icon" aria-hidden="true">${icons[type] || icons.info}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" aria-label="Close notification">×</button>
        `;
        
        const container = document.getElementById('notificationContainer') || document.body;
        container.appendChild(notification);
        
        // Auto-remove
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, duration);
        
        // Manual close
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
        
        this.announceToScreenReader(message);
    }
    
    announceToScreenReader(message) {
        // Implementation would announce to screen reader
        console.log('Screen reader announcement:', message);
    }
    
    isTouchDevice() {
        return (('ontouchstart' in window) ||
               (navigator.maxTouchPoints > 0) ||
               (navigator.msMaxTouchPoints > 0));
    }
    
    async loadDashboardData() {
        // Implementation would load dashboard data
        this.showLoadingState(document.getElementById('dashboardPane'), false);
    }
    
    async loadTabData(tabName) {
        const pane = document.getElementById(`${tabName}Pane`);
        if (!pane) return;
        
        this.showLoadingState(pane, true);
        
        try {
            // Implementation would load tab-specific data
            await this.delay(1000); // Simulate loading
            this.showLoadingState(pane, false);
        } catch (error) {
            this.showLoadingState(pane, false);
            this.showNotification(`Failed to load ${tabName} data`, 'error');
        }
    }
    
    showLoadingState(container, show) {
        if (show) {
            container.classList.add('loading');
            // Add skeleton loading elements
            if (!container.querySelector('.loading-skeleton')) {
                const skeleton = this.createSkeleton();
                container.appendChild(skeleton);
            }
        } else {
            container.classList.remove('loading');
            const skeleton = container.querySelector('.loading-skeleton');
            skeleton?.remove();
        }
    }
    
    createSkeleton() {
        const skeleton = document.createElement('div');
        skeleton.className = 'loading-skeleton';
        skeleton.innerHTML = `
            <div class="skeleton-item">
                <div class="skeleton-avatar"></div>
                <div class="skeleton-content">
                    <div class="skeleton-line skeleton-line-title"></div>
                    <div class="skeleton-line skeleton-line-subtitle"></div>
                </div>
            </div>
        `.repeat(5);
        
        return skeleton;
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Specialized Virtual Scroll for Popup
class VirtualScrollPopup extends VirtualScrollPopup {
    constructor(container) {
        super(container);
        this.itemHeight = 60; // Popup items are typically smaller
        this.buffer = 5; // Extra items to render for smooth scrolling
    }
    
    render() {
        // Implementation specific to popup layouts
        super.render();
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new AstralTubePopupEnhanced());
} else {
    new AstralTubePopupEnhanced();
}