/**
 * AstralTube v3 - Keyboard Shortcut Management System
 * Advanced keyboard shortcut handling with conflict resolution and customization
 */

export class KeyboardManager {
    constructor(options = {}) {
        this.options = {
            preventDefault: true,
            allowInInputs: false,
            caseSensitive: false,
            debug: false,
            ...options
        };
        
        this.shortcuts = new Map();
        this.contexts = new Map();
        this.sequences = new Map();
        this.currentSequence = [];
        this.sequenceTimer = null;
        this.sequenceTimeout = 1000; // 1 second for key sequences
        
        // Key state tracking
        this.pressedKeys = new Set();
        this.lastKeyTime = 0;
        
        // Event listeners
        this.keydownHandler = null;
        this.keyupHandler = null;
        this.blurHandler = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadDefaultShortcuts();
        
        console.log('⌨️ Keyboard Manager initialized');
    }

    setupEventListeners() {
        this.keydownHandler = (e) => this.handleKeyDown(e);
        this.keyupHandler = (e) => this.handleKeyUp(e);
        this.blurHandler = () => this.handleBlur();
        
        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);
        window.addEventListener('blur', this.blurHandler);
    }

    /**
     * Register a keyboard shortcut
     */
    register(shortcut, handler, options = {}) {
        const config = {
            description: '',
            context: 'global',
            preventDefault: this.options.preventDefault,
            allowInInputs: this.options.allowInInputs,
            priority: 0,
            enabled: true,
            ...options
        };

        const normalizedShortcut = this.normalizeShortcut(shortcut);
        const key = `${config.context}:${normalizedShortcut}`;
        
        if (this.shortcuts.has(key)) {
            console.warn(`Keyboard shortcut "${shortcut}" already registered in context "${config.context}"`);
        }

        this.shortcuts.set(key, {
            shortcut: normalizedShortcut,
            originalShortcut: shortcut,
            handler,
            config,
            lastTriggered: 0
        });

        if (this.options.debug) {
            console.log(`Registered shortcut: ${shortcut} -> ${normalizedShortcut} in context ${config.context}`);
        }

        return key;
    }

    /**
     * Unregister a keyboard shortcut
     */
    unregister(shortcutOrKey, context = 'global') {
        let key;
        if (shortcutOrKey.includes(':')) {
            key = shortcutOrKey;
        } else {
            const normalizedShortcut = this.normalizeShortcut(shortcutOrKey);
            key = `${context}:${normalizedShortcut}`;
        }

        const removed = this.shortcuts.delete(key);
        
        if (this.options.debug && removed) {
            console.log(`Unregistered shortcut: ${key}`);
        }

        return removed;
    }

    /**
     * Register a key sequence (like vim commands)
     */
    registerSequence(sequence, handler, options = {}) {
        const config = {
            description: '',
            context: 'global',
            timeout: this.sequenceTimeout,
            ...options
        };

        const normalizedSequence = sequence.split(' ').map(key => this.normalizeShortcut(key));
        const key = `${config.context}:${normalizedSequence.join(' ')}`;

        this.sequences.set(key, {
            sequence: normalizedSequence,
            originalSequence: sequence,
            handler,
            config
        });

        if (this.options.debug) {
            console.log(`Registered sequence: ${sequence} -> ${normalizedSequence.join(' ')}`);
        }

        return key;
    }

    /**
     * Create a context for scoped shortcuts
     */
    createContext(name, options = {}) {
        const config = {
            priority: 0,
            exclusive: false, // If true, only this context's shortcuts are active
            element: document, // Element to attach listeners to
            ...options
        };

        this.contexts.set(name, {
            ...config,
            active: false,
            shortcuts: new Set()
        });

        return new KeyboardContext(this, name);
    }

    /**
     * Activate a context
     */
    activateContext(name) {
        const context = this.contexts.get(name);
        if (context) {
            context.active = true;
            
            if (this.options.debug) {
                console.log(`Activated context: ${name}`);
            }
        }
    }

    /**
     * Deactivate a context
     */
    deactivateContext(name) {
        const context = this.contexts.get(name);
        if (context) {
            context.active = false;
            
            if (this.options.debug) {
                console.log(`Deactivated context: ${name}`);
            }
        }
    }

    /**
     * Handle keydown events
     */
    handleKeyDown(e) {
        const currentTime = Date.now();
        this.lastKeyTime = currentTime;
        
        // Track pressed keys
        const keyCode = this.getKeyCode(e);
        this.pressedKeys.add(keyCode);

        // Check if we should ignore this event
        if (this.shouldIgnoreEvent(e)) {
            return;
        }

        // Generate shortcut string
        const shortcut = this.eventToShortcut(e);
        
        if (this.options.debug) {
            console.log(`Key pressed: ${shortcut}`, {
                key: e.key,
                code: e.code,
                ctrlKey: e.ctrlKey,
                altKey: e.altKey,
                shiftKey: e.shiftKey,
                metaKey: e.metaKey
            });
        }

        // Check for sequence continuation
        this.handleSequence(shortcut);

        // Check for direct shortcut match
        const matched = this.findMatchingShortcut(shortcut);
        if (matched) {
            this.executeShortcut(matched, e);
        }
    }

    /**
     * Handle keyup events
     */
    handleKeyUp(e) {
        const keyCode = this.getKeyCode(e);
        this.pressedKeys.delete(keyCode);
    }

    /**
     * Handle window blur (clear all pressed keys)
     */
    handleBlur() {
        this.pressedKeys.clear();
        this.currentSequence = [];
        if (this.sequenceTimer) {
            clearTimeout(this.sequenceTimer);
            this.sequenceTimer = null;
        }
    }

    /**
     * Handle key sequences
     */
    handleSequence(shortcut) {
        this.currentSequence.push(shortcut);
        
        // Clear existing timer
        if (this.sequenceTimer) {
            clearTimeout(this.sequenceTimer);
        }

        // Check for sequence matches
        const sequenceString = this.currentSequence.join(' ');
        const matched = this.findMatchingSequence(sequenceString);
        
        if (matched) {
            this.executeSequence(matched);
            this.currentSequence = [];
        } else {
            // Check if current sequence could be the start of a longer sequence
            const possibleMatch = this.findPossibleSequence(sequenceString);
            
            if (possibleMatch) {
                // Wait for more keys
                this.sequenceTimer = setTimeout(() => {
                    this.currentSequence = [];
                }, this.sequenceTimeout);
            } else {
                // No possible match, reset sequence
                this.currentSequence = [];
            }
        }
    }

    /**
     * Convert keyboard event to shortcut string
     */
    eventToShortcut(e) {
        const parts = [];
        
        // Add modifiers in consistent order
        if (e.ctrlKey) parts.push('ctrl');
        if (e.altKey) parts.push('alt');
        if (e.shiftKey) parts.push('shift');
        if (e.metaKey) parts.push('meta');
        
        // Add the main key
        let key = e.key.toLowerCase();
        
        // Special key mappings
        const keyMappings = {
            ' ': 'space',
            'enter': 'enter',
            'escape': 'esc',
            'backspace': 'backspace',
            'delete': 'del',
            'tab': 'tab',
            'arrowup': 'up',
            'arrowdown': 'down',
            'arrowleft': 'left',
            'arrowright': 'right',
            'home': 'home',
            'end': 'end',
            'pageup': 'pageup',
            'pagedown': 'pagedown',
            'insert': 'ins'
        };
        
        key = keyMappings[key] || key;
        parts.push(key);
        
        return parts.join('+');
    }

    /**
     * Normalize shortcut string
     */
    normalizeShortcut(shortcut) {
        if (!this.options.caseSensitive) {
            shortcut = shortcut.toLowerCase();
        }
        
        // Split and normalize parts
        const parts = shortcut.split('+').map(part => part.trim());
        const modifiers = [];
        let key = '';
        
        // Separate modifiers from key
        for (const part of parts) {
            if (['ctrl', 'alt', 'shift', 'meta', 'cmd', 'control', 'option'].includes(part)) {
                let modifier = part;
                if (modifier === 'cmd') modifier = 'meta';
                if (modifier === 'control') modifier = 'ctrl';
                if (modifier === 'option') modifier = 'alt';
                modifiers.push(modifier);
            } else {
                key = part;
            }
        }
        
        // Sort modifiers for consistency
        modifiers.sort();
        
        return [...modifiers, key].join('+');
    }

    /**
     * Find matching shortcut
     */
    findMatchingShortcut(shortcut) {
        const activeContexts = this.getActiveContexts();
        
        // Check shortcuts in order of context priority
        for (const context of activeContexts) {
            const key = `${context.name}:${shortcut}`;
            const shortcutInfo = this.shortcuts.get(key);
            
            if (shortcutInfo && shortcutInfo.config.enabled) {
                return { ...shortcutInfo, context: context.name };
            }
        }
        
        return null;
    }

    /**
     * Find matching sequence
     */
    findMatchingSequence(sequenceString) {
        const activeContexts = this.getActiveContexts();
        
        for (const context of activeContexts) {
            const key = `${context.name}:${sequenceString}`;
            const sequenceInfo = this.sequences.get(key);
            
            if (sequenceInfo) {
                return { ...sequenceInfo, context: context.name };
            }
        }
        
        return null;
    }

    /**
     * Check if current sequence could be start of a longer sequence
     */
    findPossibleSequence(partialSequence) {
        const activeContexts = this.getActiveContexts();
        
        for (const context of activeContexts) {
            for (const [key, sequenceInfo] of this.sequences) {
                if (key.startsWith(`${context.name}:${partialSequence}`)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Execute a shortcut
     */
    executeShortcut(shortcutInfo, event) {
        try {
            if (shortcutInfo.config.preventDefault) {
                event.preventDefault();
                event.stopPropagation();
            }
            
            shortcutInfo.lastTriggered = Date.now();
            
            if (this.options.debug) {
                console.log(`Executing shortcut: ${shortcutInfo.originalShortcut} in context ${shortcutInfo.context}`);
            }
            
            shortcutInfo.handler(event, shortcutInfo);
            
        } catch (error) {
            console.error('Error executing shortcut:', error);
        }
    }

    /**
     * Execute a sequence
     */
    executeSequence(sequenceInfo) {
        try {
            if (this.options.debug) {
                console.log(`Executing sequence: ${sequenceInfo.originalSequence} in context ${sequenceInfo.context}`);
            }
            
            sequenceInfo.handler(sequenceInfo);
            
        } catch (error) {
            console.error('Error executing sequence:', error);
        }
    }

    /**
     * Get active contexts sorted by priority
     */
    getActiveContexts() {
        const activeContexts = [];
        
        for (const [name, context] of this.contexts) {
            if (context.active || name === 'global') {
                activeContexts.push({ name, ...context });
            }
        }
        
        // Sort by priority (higher priority first)
        activeContexts.sort((a, b) => b.priority - a.priority);
        
        return activeContexts;
    }

    /**
     * Check if event should be ignored
     */
    shouldIgnoreEvent(e) {
        // Don't handle shortcuts in input fields unless explicitly allowed
        if (!this.options.allowInInputs) {
            const target = e.target;
            if (target && (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.tagName === 'SELECT' ||
                target.isContentEditable ||
                target.getAttribute('contenteditable') === 'true'
            )) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Get consistent key code for tracking
     */
    getKeyCode(e) {
        return e.code || e.key;
    }

    /**
     * Load default AstralTube shortcuts
     */
    loadDefaultShortcuts() {
        const defaults = [
            // Global shortcuts
            ['ctrl+shift+s', () => this.triggerSync(), { description: 'Sync data' }],
            ['ctrl+shift+o', () => this.openOptions(), { description: 'Open options' }],
            ['ctrl+shift+d', () => this.toggleDeckMode(), { description: 'Toggle deck mode' }],
            ['ctrl+shift+p', () => this.showPlaylistManager(), { description: 'Show playlist manager' }],
            ['esc', () => this.closeModals(), { description: 'Close modals/overlays' }],
            
            // YouTube shortcuts
            ['s', () => this.toggleSidebar(), { description: 'Toggle sidebar', context: 'youtube' }],
            ['d', () => this.toggleDeckMode(), { description: 'Toggle deck mode', context: 'youtube' }],
            ['p', () => this.addToPlaylist(), { description: 'Add to playlist', context: 'youtube' }],
            ['f', () => this.toggleFullscreen(), { description: 'Toggle fullscreen', context: 'youtube' }],
        ];

        defaults.forEach(([shortcut, handler, options = {}]) => {
            this.register(shortcut, handler, options);
        });

        // Create YouTube context
        this.createContext('youtube', { priority: 1 });
        
        // Activate YouTube context when on YouTube
        if (window.location.hostname.includes('youtube.com')) {
            this.activateContext('youtube');
        }
    }

    // Default action implementations
    triggerSync() {
        console.log('🔄 Triggering data sync...');
        chrome.runtime.sendMessage({ action: 'syncData' });
    }

    openOptions() {
        console.log('⚙️ Opening options page...');
        chrome.runtime.sendMessage({ action: 'openOptions' });
    }

    toggleDeckMode() {
        console.log('🎯 Toggling deck mode...');
        if (window.astralTubeDeckMode) {
            window.astralTubeDeckMode.toggle();
        }
    }

    showPlaylistManager() {
        console.log('📝 Showing playlist manager...');
        // Implementation would show playlist manager
    }

    closeModals() {
        console.log('❌ Closing modals...');
        // Implementation would close any open modals
        if (window.astralTubeModalManager) {
            window.astralTubeModalManager.closeActive();
        }
    }

    toggleSidebar() {
        console.log('📋 Toggling sidebar...');
        if (window.astralTubeSidebar) {
            window.astralTubeSidebar.toggle();
        }
    }

    addToPlaylist() {
        console.log('➕ Adding to playlist...');
        // Implementation would show add to playlist dialog
    }

    toggleFullscreen() {
        console.log('📺 Toggling fullscreen...');
        // Implementation would toggle fullscreen mode
    }

    /**
     * Get all registered shortcuts
     */
    getShortcuts(context = null) {
        const shortcuts = [];
        
        for (const [key, shortcutInfo] of this.shortcuts) {
            const [contextName, shortcut] = key.split(':', 2);
            
            if (!context || contextName === context) {
                shortcuts.push({
                    key,
                    context: contextName,
                    shortcut: shortcutInfo.originalShortcut,
                    description: shortcutInfo.config.description,
                    enabled: shortcutInfo.config.enabled,
                    lastTriggered: shortcutInfo.lastTriggered
                });
            }
        }
        
        return shortcuts.sort((a, b) => a.shortcut.localeCompare(b.shortcut));
    }

    /**
     * Enable/disable a shortcut
     */
    setEnabled(shortcutOrKey, enabled, context = 'global') {
        let key;
        if (shortcutOrKey.includes(':')) {
            key = shortcutOrKey;
        } else {
            const normalizedShortcut = this.normalizeShortcut(shortcutOrKey);
            key = `${context}:${normalizedShortcut}`;
        }

        const shortcutInfo = this.shortcuts.get(key);
        if (shortcutInfo) {
            shortcutInfo.config.enabled = enabled;
            return true;
        }
        
        return false;
    }

    /**
     * Get keyboard manager statistics
     */
    getStats() {
        return {
            shortcuts: this.shortcuts.size,
            sequences: this.sequences.size,
            contexts: this.contexts.size,
            activeContexts: this.getActiveContexts().length,
            pressedKeys: this.pressedKeys.size,
            currentSequence: this.currentSequence.slice(),
            lastKeyTime: this.lastKeyTime
        };
    }

    /**
     * Destroy keyboard manager
     */
    destroy() {
        // Remove event listeners
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
        }
        if (this.keyupHandler) {
            document.removeEventListener('keyup', this.keyupHandler);
        }
        if (this.blurHandler) {
            window.removeEventListener('blur', this.blurHandler);
        }

        // Clear timers
        if (this.sequenceTimer) {
            clearTimeout(this.sequenceTimer);
        }

        // Clear data
        this.shortcuts.clear();
        this.contexts.clear();
        this.sequences.clear();
        this.pressedKeys.clear();
        this.currentSequence = [];

        console.log('⌨️ Keyboard Manager destroyed');
    }
}

/**
 * Scoped keyboard context for components
 */
class KeyboardContext {
    constructor(manager, contextName) {
        this.manager = manager;
        this.contextName = contextName;
    }

    register(shortcut, handler, options = {}) {
        return this.manager.register(shortcut, handler, {
            ...options,
            context: this.contextName
        });
    }

    registerSequence(sequence, handler, options = {}) {
        return this.manager.registerSequence(sequence, handler, {
            ...options,
            context: this.contextName
        });
    }

    unregister(shortcut) {
        return this.manager.unregister(shortcut, this.contextName);
    }

    activate() {
        return this.manager.activateContext(this.contextName);
    }

    deactivate() {
        return this.manager.deactivateContext(this.contextName);
    }

    setEnabled(shortcut, enabled) {
        return this.manager.setEnabled(shortcut, enabled, this.contextName);
    }

    getShortcuts() {
        return this.manager.getShortcuts(this.contextName);
    }
}

// Create global instance
export const keyboardManager = new KeyboardManager({
    debug: chrome?.runtime?.getManifest && !chrome.runtime.getManifest().update_url
});

// Convenience exports
export const registerShortcut = (shortcut, handler, options) => keyboardManager.register(shortcut, handler, options);
export const unregisterShortcut = (shortcut, context) => keyboardManager.unregister(shortcut, context);
export const createKeyboardContext = (name, options) => keyboardManager.createContext(name, options);

export default keyboardManager;