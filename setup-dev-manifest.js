#!/usr/bin/env node

/**
 * Development Manifest Setup Script
 * Configures manifest.json with development OAuth credentials
 */

import fs from 'fs';
import path from 'path';

const MANIFEST_PATH = './manifest.json';
const DEV_OAUTH_CLIENT_ID = '186179608672-u3l3iq7foqgtlhfgnb1d7kt5bum6p2qi.apps.googleusercontent.com';

function setupDevManifest() {
    try {
        // Read current manifest
        const manifestContent = fs.readFileSync(MANIFEST_PATH, 'utf8');
        
        // Replace placeholder with development client ID
        const updatedContent = manifestContent.replace(
            '"client_id": "$OAUTH_CLIENT_ID"',
            `"client_id": "${DEV_OAUTH_CLIENT_ID}"`
        );
        
        // Write updated manifest
        fs.writeFileSync(MANIFEST_PATH, updatedContent);
        
        console.log('✅ Development manifest configured successfully!');
        console.log(`📋 OAuth Client ID: ${DEV_OAUTH_CLIENT_ID}`);
        console.log('🚀 Extension is ready for development');
        
    } catch (error) {
        console.error('❌ Failed to setup development manifest:', error.message);
        process.exit(1);
    }
}

setupDevManifest();