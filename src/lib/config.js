/**
 * AstralTube v3 - Configuration Manager
 * Handles environment-based configuration and secure credential management
 */

import { credentialsManager } from './credentials.js';

export class ConfigManager {
    constructor() {
        this.config = null;
        this.initialized = false;
    }

    async initialize() {
        try {
            await this.loadConfiguration();
            this.initialized = true;
            console.log('⚙️ Configuration Manager initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Configuration Manager:', error);
            throw error;
        }
    }

    async loadConfiguration() {
        try {
            // Load configuration from storage
            const storedConfig = await chrome.storage.local.get('astraltubeConfig');
            
            if (storedConfig.astraltubeConfig) {
                this.config = storedConfig.astraltubeConfig;
            } else {
                // Initialize with default configuration
                this.config = this.getDefaultConfiguration();
                await this.saveConfiguration();
            }

            // Override with environment-specific values if available
            await this.loadEnvironmentOverrides();
            
        } catch (error) {
            console.error('❌ Failed to load configuration:', error);
            this.config = this.getDefaultConfiguration();
        }
    }

    getDefaultConfiguration() {
        return {
            environment: 'production',
            api: {
                baseUrl: 'https://www.googleapis.com',
                timeout: 30000,
                retryAttempts: 3,
                retryDelay: 1000,
                quotaLimits: {
                    daily: 10000,
                    perHour: 1000,
                    perMinute: 100
                }
            },
            oauth: {
                // These will be loaded from secure storage or environment
                clientId: null,
                scopes: [
                    'https://www.googleapis.com/auth/youtube.readonly',
                    'https://www.googleapis.com/auth/youtube'
                ],
                redirectUri: chrome.identity?.getRedirectURL?.() || null
            },
            features: {
                sidebarEnabled: true,
                deckModeEnabled: true,
                playlistManagerEnabled: true,
                subscriptionManagerEnabled: true,
                analyticsEnabled: true,
                offlineMode: false
            },
            security: {
                encryptionEnabled: true,
                encryptionAlgorithm: 'AES-GCM',
                keyRotationInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
                sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
                csrfProtection: true
            },
            storage: {
                compressionEnabled: true,
                compressionThreshold: 1000,
                cacheSize: 100,
                cleanupInterval: 60 * 60 * 1000, // 1 hour
                backupEnabled: true
            },
            ui: {
                theme: 'auto',
                animations: true,
                compactMode: false,
                showThumbnails: true,
                sidebarWidth: 350,
                deckModeColumns: 3
            },
            sync: {
                autoSync: true,
                syncInterval: 30 * 60 * 1000, // 30 minutes
                conflictResolution: 'server-wins',
                batchSize: 50
            }
        };
    }

    async loadEnvironmentOverrides() {
        try {
            // Check for secure credential storage
            const secureCredentials = await this.loadSecureCredentials();
            if (secureCredentials) {
                this.config.oauth = { ...this.config.oauth, ...secureCredentials };
            }

            // Load environment-specific overrides from options page
            const environmentConfig = await chrome.storage.local.get('environmentConfig');
            if (environmentConfig.environmentConfig) {
                this.config = this.deepMerge(this.config, environmentConfig.environmentConfig);
            }

        } catch (error) {
            console.error('❌ Failed to load environment overrides:', error);
        }
    }

    async loadSecureCredentials() {
        try {
            // Initialize credentials manager if not already done
            if (!credentialsManager.initialized) {
                await credentialsManager.initialize();
            }

            // Try to load OAuth credentials from secure storage
            const oauthCreds = await credentialsManager.getOAuthCredentials();
            
            if (oauthCreds && oauthCreds.clientId) {
                return {
                    clientId: oauthCreds.clientId,
                    clientSecret: oauthCreds.clientSecret,
                    redirectUri: oauthCreds.redirectUri
                };
            }

            // Fallback: check for legacy storage format and migrate
            const legacyCredentials = await chrome.storage.local.get(['oauth_client_id', 'oauth_client_secret']);
            
            if (legacyCredentials.oauth_client_id) {
                console.log('🔄 Migrating legacy OAuth credentials to secure storage...');
                
                // Migrate to secure storage
                await credentialsManager.setOAuthCredentials(
                    legacyCredentials.oauth_client_id,
                    legacyCredentials.oauth_client_secret
                );
                
                // Remove legacy credentials
                await chrome.storage.local.remove(['oauth_client_id', 'oauth_client_secret']);
                
                return {
                    clientId: legacyCredentials.oauth_client_id,
                    clientSecret: legacyCredentials.oauth_client_secret
                };
            }

            // Development fallback: check environment variables or prompt user
            const manifest = chrome.runtime.getManifest();
            const isProduction = !!manifest.update_url;
            
            if (!isProduction) {
                console.warn('⚠️ No OAuth credentials found in development mode');
                console.warn('⚠️ Please configure OAuth credentials through the options page');
            }

            return null;
        } catch (error) {
            console.error('❌ Failed to load secure credentials:', error);
            return null;
        }
    }

    async saveConfiguration() {
        try {
            // Never save sensitive credentials to regular storage
            const configToSave = { ...this.config };
            if (configToSave.oauth) {
                configToSave.oauth = {
                    ...configToSave.oauth,
                    clientId: null,
                    clientSecret: null
                };
            }

            await chrome.storage.local.set({ astraltubeConfig: configToSave });
            console.log('✅ Configuration saved');
        } catch (error) {
            console.error('❌ Failed to save configuration:', error);
        }
    }

    async updateConfiguration(updates) {
        try {
            this.config = this.deepMerge(this.config, updates);
            await this.saveConfiguration();
            console.log('✅ Configuration updated');
            return true;
        } catch (error) {
            console.error('❌ Failed to update configuration:', error);
            return false;
        }
    }

    get(path, defaultValue = null) {
        try {
            const keys = path.split('.');
            let value = this.config;
            
            for (const key of keys) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                } else {
                    return defaultValue;
                }
            }
            
            return value;
        } catch (error) {
            console.error('❌ Failed to get config value:', error);
            return defaultValue;
        }
    }

    async set(path, value) {
        try {
            const keys = path.split('.');
            const lastKey = keys.pop();
            let target = this.config;
            
            // Navigate to parent object
            for (const key of keys) {
                if (!target[key] || typeof target[key] !== 'object') {
                    target[key] = {};
                }
                target = target[key];
            }
            
            target[lastKey] = value;
            await this.saveConfiguration();
            return true;
        } catch (error) {
            console.error('❌ Failed to set config value:', error);
            return false;
        }
    }

    // OAuth Configuration Methods
    async setOAuthCredentials(clientId, clientSecret = null) {
        try {
            // Store credentials securely
            const credentialsToStore = { oauth_client_id: clientId };
            if (clientSecret) {
                credentialsToStore.oauth_client_secret = clientSecret;
            }

            await chrome.storage.local.set(credentialsToStore);
            
            // Update runtime config
            this.config.oauth.clientId = clientId;
            if (clientSecret) {
                this.config.oauth.clientSecret = clientSecret;
            }

            console.log('✅ OAuth credentials updated');
            return true;
        } catch (error) {
            console.error('❌ Failed to set OAuth credentials:', error);
            return false;
        }
    }

    getOAuthConfig() {
        return {
            clientId: this.config?.oauth?.clientId,
            scopes: this.config?.oauth?.scopes || [],
            redirectUri: this.config?.oauth?.redirectUri
        };
    }

    // API Configuration
    getAPIConfig() {
        return {
            baseUrl: this.get('api.baseUrl'),
            timeout: this.get('api.timeout'),
            retryAttempts: this.get('api.retryAttempts'),
            retryDelay: this.get('api.retryDelay'),
            quotaLimits: this.get('api.quotaLimits')
        };
    }

    // Security Configuration
    getSecurityConfig() {
        return {
            encryptionEnabled: this.get('security.encryptionEnabled'),
            encryptionAlgorithm: this.get('security.encryptionAlgorithm'),
            keyRotationInterval: this.get('security.keyRotationInterval'),
            sessionTimeout: this.get('security.sessionTimeout'),
            csrfProtection: this.get('security.csrfProtection')
        };
    }

    // Feature Flags
    isFeatureEnabled(feature) {
        return this.get(`features.${feature}`, false);
    }

    async setFeatureEnabled(feature, enabled) {
        return await this.set(`features.${feature}`, enabled);
    }

    // Environment Detection
    isProduction() {
        return this.get('environment') === 'production';
    }

    isDevelopment() {
        return this.get('environment') === 'development';
    }

    // Validation Methods
    validateConfiguration() {
        const errors = [];

        // Validate OAuth configuration
        if (!this.config.oauth?.clientId && this.isProduction()) {
            errors.push('OAuth client ID is required in production');
        }

        // Validate API configuration
        if (!this.config.api?.baseUrl) {
            errors.push('API base URL is required');
        }

        // Validate security settings
        if (this.isProduction() && !this.config.security?.encryptionEnabled) {
            errors.push('Encryption must be enabled in production');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Development/Testing Methods
    async loadDevelopmentConfig() {
        if (!this.isDevelopment()) {
            console.warn('⚠️ Development config can only be loaded in development environment');
            return false;
        }

        try {
            // Load development-specific configuration
            const devConfig = {
                api: {
                    baseUrl: 'https://www.googleapis.com',
                    timeout: 10000,
                    retryAttempts: 1
                },
                security: {
                    encryptionEnabled: false // Disable encryption in dev for easier debugging
                },
                features: {
                    analyticsEnabled: false
                }
            };

            await this.updateConfiguration(devConfig);
            console.log('🔧 Development configuration loaded');
            return true;
        } catch (error) {
            console.error('❌ Failed to load development config:', error);
            return false;
        }
    }

    // Utility Methods
    deepMerge(target, source) {
        const output = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
                    output[key] = this.deepMerge(target[key], source[key]);
                } else {
                    output[key] = source[key];
                }
            } else {
                output[key] = source[key];
            }
        }
        
        return output;
    }

    // Export/Import Configuration
    async exportConfiguration() {
        try {
            const exportData = {
                version: chrome.runtime.getManifest().version,
                timestamp: Date.now(),
                config: { ...this.config }
            };

            // Remove sensitive data from export
            if (exportData.config.oauth) {
                exportData.config.oauth = {
                    ...exportData.config.oauth,
                    clientId: null,
                    clientSecret: null
                };
            }

            return exportData;
        } catch (error) {
            console.error('❌ Failed to export configuration:', error);
            return null;
        }
    }

    async importConfiguration(configData) {
        try {
            if (!configData.config) {
                throw new Error('Invalid configuration data');
            }

            // Validate imported configuration
            const tempConfig = configData.config;
            const validation = this.validateImportedConfig(tempConfig);
            
            if (!validation.valid) {
                throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
            }

            await this.updateConfiguration(tempConfig);
            console.log('✅ Configuration imported successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to import configuration:', error);
            return false;
        }
    }

    validateImportedConfig(config) {
        const errors = [];

        // Basic structure validation
        if (!config || typeof config !== 'object') {
            errors.push('Configuration must be an object');
        }

        // Add more specific validation as needed
        if (config.api && typeof config.api.timeout !== 'undefined' && typeof config.api.timeout !== 'number') {
            errors.push('API timeout must be a number');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Reset to defaults
    async resetToDefaults() {
        try {
            this.config = this.getDefaultConfiguration();
            await this.saveConfiguration();
            console.log('✅ Configuration reset to defaults');
            return true;
        } catch (error) {
            console.error('❌ Failed to reset configuration:', error);
            return false;
        }
    }
}

// Export singleton instance
export const configManager = new ConfigManager();