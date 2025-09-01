/**
 * AstralTube v3 - Secure Credentials Manager
 * Handles secure storage and retrieval of API credentials and sensitive data
 */

export class CredentialsManager {
    constructor() {
        this.encryptionKey = null;
        this.initialized = false;
        this.credentials = new Map();
    }

    async initialize() {
        try {
            console.log('🔐 Initializing Credentials Manager...');
            
            // Initialize encryption key
            await this.initializeEncryption();
            
            // Load stored credentials
            await this.loadCredentials();
            
            this.initialized = true;
            console.log('✅ Credentials Manager initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Credentials Manager:', error);
            throw error;
        }
    }

    async initializeEncryption() {
        try {
            // Try to get existing key
            const storedKey = await chrome.storage.local.get('_credentials_key');
            
            if (storedKey._credentials_key) {
                this.encryptionKey = await this.importKey(storedKey._credentials_key);
            } else {
                // Generate new encryption key
                this.encryptionKey = await this.generateEncryptionKey();
                
                // Store the key (encrypted itself with a device-specific salt)
                const exportedKey = await this.exportKey(this.encryptionKey);
                await chrome.storage.local.set({ '_credentials_key': exportedKey });
            }
        } catch (error) {
            console.error('❌ Failed to initialize encryption:', error);
            throw error;
        }
    }

    async generateEncryptionKey() {
        try {
            return await crypto.subtle.generateKey(
                {
                    name: 'AES-GCM',
                    length: 256
                },
                true, // extractable
                ['encrypt', 'decrypt']
            );
        } catch (error) {
            console.error('❌ Failed to generate encryption key:', error);
            throw error;
        }
    }

    async exportKey(key) {
        try {
            const exported = await crypto.subtle.exportKey('jwk', key);
            return JSON.stringify(exported);
        } catch (error) {
            console.error('❌ Failed to export key:', error);
            throw error;
        }
    }

    async importKey(keyData) {
        try {
            const keyObject = JSON.parse(keyData);
            return await crypto.subtle.importKey(
                'jwk',
                keyObject,
                {
                    name: 'AES-GCM',
                    length: 256
                },
                true,
                ['encrypt', 'decrypt']
            );
        } catch (error) {
            console.error('❌ Failed to import key:', error);
            throw error;
        }
    }

    async loadCredentials() {
        try {
            // Load all encrypted credentials
            const result = await chrome.storage.local.get(null);
            
            for (const [key, value] of Object.entries(result)) {
                if (key.startsWith('_cred_') && value) {
                    try {
                        const decrypted = await this.decrypt(value);
                        const credentialName = key.replace('_cred_', '');
                        this.credentials.set(credentialName, decrypted);
                    } catch (error) {
                        console.error(`❌ Failed to decrypt credential ${key}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Failed to load credentials:', error);
        }
    }

    async encrypt(data) {
        if (!this.encryptionKey) {
            throw new Error('Encryption key not initialized');
        }

        try {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(JSON.stringify(data));
            
            // Generate random IV for each encryption
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            const encrypted = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                this.encryptionKey,
                dataBuffer
            );

            // Combine IV and encrypted data
            const combinedBuffer = new Uint8Array(iv.byteLength + encrypted.byteLength);
            combinedBuffer.set(iv, 0);
            combinedBuffer.set(new Uint8Array(encrypted), iv.byteLength);

            // Convert to base64 for storage
            return btoa(String.fromCharCode(...combinedBuffer));
        } catch (error) {
            console.error('❌ Encryption failed:', error);
            throw error;
        }
    }

    async decrypt(encryptedData) {
        if (!this.encryptionKey) {
            throw new Error('Encryption key not initialized');
        }

        try {
            // Decode from base64
            const combinedBuffer = new Uint8Array(
                atob(encryptedData).split('').map(char => char.charCodeAt(0))
            );

            // Extract IV and encrypted data
            const iv = combinedBuffer.slice(0, 12);
            const encrypted = combinedBuffer.slice(12);

            const decrypted = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                this.encryptionKey,
                encrypted
            );

            const decoder = new TextDecoder();
            const decryptedString = decoder.decode(decrypted);
            
            return JSON.parse(decryptedString);
        } catch (error) {
            console.error('❌ Decryption failed:', error);
            throw error;
        }
    }

    // Public API Methods
    async setCredential(name, value, metadata = {}) {
        if (!this.initialized) {
            throw new Error('Credentials Manager not initialized');
        }

        try {
            const credentialData = {
                value: value,
                metadata: {
                    ...metadata,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                }
            };

            // Encrypt and store
            const encrypted = await this.encrypt(credentialData);
            await chrome.storage.local.set({ [`_cred_${name}`]: encrypted });
            
            // Update in-memory cache
            this.credentials.set(name, credentialData);

            console.log(`✅ Credential '${name}' stored securely`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to set credential '${name}':`, error);
            throw error;
        }
    }

    async getCredential(name) {
        if (!this.initialized) {
            throw new Error('Credentials Manager not initialized');
        }

        try {
            // Check in-memory cache first
            if (this.credentials.has(name)) {
                return this.credentials.get(name);
            }

            // Try to load from storage
            const result = await chrome.storage.local.get(`_cred_${name}`);
            const encryptedData = result[`_cred_${name}`];
            
            if (!encryptedData) {
                return null;
            }

            const decrypted = await this.decrypt(encryptedData);
            this.credentials.set(name, decrypted);
            
            return decrypted;
        } catch (error) {
            console.error(`❌ Failed to get credential '${name}':`, error);
            return null;
        }
    }

    async deleteCredential(name) {
        if (!this.initialized) {
            throw new Error('Credentials Manager not initialized');
        }

        try {
            await chrome.storage.local.remove(`_cred_${name}`);
            this.credentials.delete(name);
            
            console.log(`✅ Credential '${name}' deleted`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to delete credential '${name}':`, error);
            return false;
        }
    }

    async listCredentials() {
        if (!this.initialized) {
            throw new Error('Credentials Manager not initialized');
        }

        const credentialsList = [];
        
        for (const [name, data] of this.credentials.entries()) {
            credentialsList.push({
                name: name,
                metadata: data.metadata,
                // Never expose the actual value
                hasValue: !!data.value
            });
        }

        return credentialsList;
    }

    // OAuth-specific methods
    async setOAuthCredentials(clientId, clientSecret = null, metadata = {}) {
        try {
            const oauthData = {
                clientId: clientId,
                clientSecret: clientSecret,
                redirectUri: chrome.identity?.getRedirectURL?.() || null,
                ...metadata
            };

            await this.setCredential('oauth_google', oauthData, {
                type: 'oauth',
                provider: 'google',
                ...metadata
            });

            console.log('✅ OAuth credentials stored securely');
            return true;
        } catch (error) {
            console.error('❌ Failed to set OAuth credentials:', error);
            throw error;
        }
    }

    async getOAuthCredentials() {
        try {
            const credential = await this.getCredential('oauth_google');
            return credential ? credential.value : null;
        } catch (error) {
            console.error('❌ Failed to get OAuth credentials:', error);
            return null;
        }
    }

    // API Key management
    async setAPIKey(service, apiKey, metadata = {}) {
        try {
            await this.setCredential(`api_key_${service}`, apiKey, {
                type: 'api_key',
                service: service,
                ...metadata
            });

            console.log(`✅ API key for '${service}' stored securely`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to set API key for '${service}':`, error);
            throw error;
        }
    }

    async getAPIKey(service) {
        try {
            const credential = await this.getCredential(`api_key_${service}`);
            return credential ? credential.value : null;
        } catch (error) {
            console.error(`❌ Failed to get API key for '${service}':`, error);
            return null;
        }
    }

    // Environment detection and validation
    async validateEnvironment() {
        const errors = [];
        const warnings = [];

        try {
            // Check if running in production
            const isProduction = chrome.runtime.getManifest().update_url;
            
            if (isProduction) {
                // In production, require OAuth credentials
                const oauthCreds = await this.getOAuthCredentials();
                if (!oauthCreds || !oauthCreds.clientId) {
                    errors.push('OAuth Client ID is required in production environment');
                }
                
                // Check for development-only credentials
                const devCredentials = ['dev_api_key', 'test_token'];
                for (const devCred of devCredentials) {
                    if (this.credentials.has(devCred)) {
                        warnings.push(`Development credential '${devCred}' found in production`);
                    }
                }
            }

            return {
                valid: errors.length === 0,
                errors,
                warnings
            };
        } catch (error) {
            console.error('❌ Environment validation failed:', error);
            return {
                valid: false,
                errors: ['Environment validation failed'],
                warnings: []
            };
        }
    }

    // Security audit
    async performSecurityAudit() {
        try {
            const audit = {
                timestamp: Date.now(),
                credentialsCount: this.credentials.size,
                encryptionStatus: !!this.encryptionKey,
                issues: [],
                recommendations: []
            };

            // Check for old credentials (older than 90 days)
            const now = Date.now();
            const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days

            for (const [name, data] of this.credentials.entries()) {
                const age = now - (data.metadata?.createdAt || 0);
                
                if (age > maxAge) {
                    audit.issues.push(`Credential '${name}' is older than 90 days`);
                    audit.recommendations.push(`Consider rotating credential '${name}'`);
                }
            }

            // Check for weak or default credentials
            const oauthCreds = await this.getOAuthCredentials();
            if (oauthCreds && oauthCreds.clientId === '186179608672-u3l3iq7foqgtlhfgnb1d7kt5bum6p2qi.apps.googleusercontent.com') {
                audit.issues.push('Using example/default OAuth Client ID');
                audit.recommendations.push('Replace with production OAuth credentials');
            }

            return audit;
        } catch (error) {
            console.error('❌ Security audit failed:', error);
            throw error;
        }
    }

    // Cleanup and rotation
    async rotateEncryptionKey() {
        try {
            console.log('🔄 Rotating encryption key...');
            
            // Store old credentials temporarily
            const oldCredentials = new Map(this.credentials);
            
            // Generate new key
            const newKey = await this.generateEncryptionKey();
            
            // Re-encrypt all credentials with new key
            const oldEncryptionKey = this.encryptionKey;
            this.encryptionKey = newKey;
            
            // Store new key
            const exportedKey = await this.exportKey(newKey);
            await chrome.storage.local.set({ '_credentials_key': exportedKey });
            
            // Re-encrypt and store all credentials
            const updates = {};
            for (const [name, data] of oldCredentials.entries()) {
                const encrypted = await this.encrypt(data);
                updates[`_cred_${name}`] = encrypted;
            }
            
            await chrome.storage.local.set(updates);
            
            console.log('✅ Encryption key rotation completed');
            return true;
        } catch (error) {
            console.error('❌ Key rotation failed:', error);
            throw error;
        }
    }

    // Import/Export for backup (encrypted)
    async exportCredentials(password) {
        try {
            const exportData = {
                version: '3.0.0',
                timestamp: Date.now(),
                credentials: {}
            };

            // Export credentials (double-encrypted with user password)
            for (const [name, data] of this.credentials.entries()) {
                const encrypted = await this.encryptWithPassword(data, password);
                exportData.credentials[name] = encrypted;
            }

            return exportData;
        } catch (error) {
            console.error('❌ Credentials export failed:', error);
            throw error;
        }
    }

    async importCredentials(importData, password) {
        try {
            if (!importData.credentials) {
                throw new Error('Invalid import data format');
            }

            // Decrypt and import credentials
            for (const [name, encryptedData] of Object.entries(importData.credentials)) {
                const decrypted = await this.decryptWithPassword(encryptedData, password);
                await this.setCredential(name, decrypted.value, decrypted.metadata);
            }

            console.log('✅ Credentials import completed');
            return true;
        } catch (error) {
            console.error('❌ Credentials import failed:', error);
            throw error;
        }
    }

    // Helper methods for password-based encryption
    async encryptWithPassword(data, password) {
        try {
            const encoder = new TextEncoder();
            const passwordBuffer = encoder.encode(password);
            
            // Derive key from password
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                passwordBuffer,
                'PBKDF2',
                false,
                ['deriveBits', 'deriveKey']
            );
            
            const salt = crypto.getRandomValues(new Uint8Array(16));
            
            const key = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt']
            );
            
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const dataBuffer = encoder.encode(JSON.stringify(data));
            
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                dataBuffer
            );
            
            // Combine salt, iv, and encrypted data
            const combinedBuffer = new Uint8Array(salt.byteLength + iv.byteLength + encrypted.byteLength);
            combinedBuffer.set(salt, 0);
            combinedBuffer.set(iv, salt.byteLength);
            combinedBuffer.set(new Uint8Array(encrypted), salt.byteLength + iv.byteLength);
            
            return btoa(String.fromCharCode(...combinedBuffer));
        } catch (error) {
            console.error('❌ Password encryption failed:', error);
            throw error;
        }
    }

    async decryptWithPassword(encryptedData, password) {
        try {
            const encoder = new TextEncoder();
            const passwordBuffer = encoder.encode(password);
            
            // Decode from base64
            const combinedBuffer = new Uint8Array(
                atob(encryptedData).split('').map(char => char.charCodeAt(0))
            );
            
            const salt = combinedBuffer.slice(0, 16);
            const iv = combinedBuffer.slice(16, 28);
            const encrypted = combinedBuffer.slice(28);
            
            // Derive key from password
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                passwordBuffer,
                'PBKDF2',
                false,
                ['deriveBits', 'deriveKey']
            );
            
            const key = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['decrypt']
            );
            
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encrypted
            );
            
            const decoder = new TextDecoder();
            const decryptedString = decoder.decode(decrypted);
            
            return JSON.parse(decryptedString);
        } catch (error) {
            console.error('❌ Password decryption failed:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const credentialsManager = new CredentialsManager();