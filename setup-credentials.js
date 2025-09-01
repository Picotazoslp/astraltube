/**
 * Complete AstralTube OAuth Setup Script
 * Sets up both API key and OAuth client ID
 */

const CREDENTIALS = {
    apiKey: 'AIzaSyA5WlrwJ_JvXyjfvXXD-MoPqRWKPXQ_ucc',
    clientId: '531603419931-2j1ps65hids5onfut7qoo743dtoon98d.apps.googleusercontent.com'
};

async function setupCredentials() {
    console.log('🔧 Setting up AstralTube credentials...');
    
    try {
        // Get current extension ID
        const extensionId = chrome.runtime.id;
        console.log('📱 Extension ID:', extensionId);
        console.log('🔗 OAuth Redirect URI:', `https://${extensionId}.chromiumapp.org/`);
        
        // Configure credentials
        const response = await chrome.runtime.sendMessage({
            action: 'setOAuthCredentials',
            apiKey: CREDENTIALS.apiKey,
            clientId: CREDENTIALS.clientId
        });
        
        console.log('✅ Credentials configured:', response);
        
        // Test health check
        const health = await chrome.runtime.sendMessage({
            action: 'checkCredentialsHealth'
        });
        
        console.log('🏥 Health Check:', health);
        
        // Test API connection
        console.log('🧪 Testing API connection...');
        const apiTest = await chrome.runtime.sendMessage({
            action: 'testConnection'
        });
        
        console.log('📡 API Test Result:', apiTest);
        
        console.log(`
✅ Setup Complete! 

Next steps:
1. Copy this OAuth Redirect URI: https://${extensionId}.chromiumapp.org/
2. Go to Google Cloud Console: https://console.cloud.google.com/
3. Navigate to APIs & Services → Credentials
4. Edit your OAuth 2.0 client ID
5. Add the redirect URI to "Authorized redirect URIs"
6. Save changes

Then test the OAuth flow by using a YouTube feature that requires authentication.
        `);
        
    } catch (error) {
        console.error('❌ Setup failed:', error);
        console.log('💡 Make sure the extension is loaded and try again');
    }
}

// Auto-run if in extension context
if (typeof chrome !== 'undefined' && chrome.runtime) {
    setupCredentials();
} else {
    console.log(`
⚠️ Please run this script in the extension context:

1. Build extension: npm run build:dev
2. Load extension in Chrome (chrome://extensions/)
3. Click AstralTube icon → Right-click → Inspect
4. Paste this script in Console tab
    `);
}