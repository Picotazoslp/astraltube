/**
 * Quick setup script to configure your API key
 * Run this in browser console after loading the extension
 */

const API_KEY = 'AIzaSyA5WlrwJ_JvXyjfvXXD-MoPqRWKPXQ_ucc';

// Configure the API key
async function setupApiKey() {
    try {
        // Store API key securely
        const response = await chrome.runtime.sendMessage({
            action: 'setCredentials',
            apiKey: API_KEY
        });
        
        console.log('✅ API Key configured:', response);
        
        // Test API connection
        const healthCheck = await chrome.runtime.sendMessage({
            action: 'healthCheck'
        });
        
        console.log('🔍 Health Check Result:', healthCheck);
        
    } catch (error) {
        console.error('❌ Setup failed:', error);
    }
}

// Auto-run if in extension context
if (typeof chrome !== 'undefined' && chrome.runtime) {
    setupApiKey();
} else {
    console.log('⚠️ Please run this in the extension context');
    console.log('1. Load your extension');
    console.log('2. Open extension popup');
    console.log('3. Right-click → Inspect');
    console.log('4. Paste and run this script in Console');
}