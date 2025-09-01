# 🔑 OAuth Setup Instructions for AstralTube

## Your Credentials
- **API Key:** `AIzaSyA5WlrwJ_JvXyjfvXXD-MoPqRWKPXQ_ucc`
- **OAuth Client ID:** `531603419931-2j1ps65hids5onfut7qoo743dtoon98d.apps.googleusercontent.com`

## Step-by-Step Setup

### 1. Build and Load Extension
```bash
cd C:\Users\damat\_REPOS\astraltube
npm run build:dev
```

Then:
- Go to `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked"
- Select the `dist` folder

### 2. Configure Credentials in Extension

**Method 1: Quick Setup Script**
1. Click AstralTube extension icon
2. Right-click popup → "Inspect"
3. Go to Console tab
4. Copy and paste this script:

```javascript
// Setup script - paste in extension console
const CREDENTIALS = {
    apiKey: 'AIzaSyA5WlrwJ_JvXyjfvXXD-MoPqRWKPXQ_ucc',
    clientId: '531603419931-2j1ps65hids5onfut7qoo743dtoon98d.apps.googleusercontent.com'
};

async function setupCredentials() {
    try {
        const extensionId = chrome.runtime.id;
        console.log('Extension ID:', extensionId);
        console.log('OAuth Redirect URI:', `https://${extensionId}.chromiumapp.org/`);
        
        const response = await chrome.runtime.sendMessage({
            action: 'setOAuthCredentials',
            apiKey: CREDENTIALS.apiKey,
            clientId: CREDENTIALS.clientId
        });
        
        console.log('✅ Setup complete:', response);
        return extensionId;
    } catch (error) {
        console.error('❌ Setup failed:', error);
    }
}

setupCredentials();
```

**Method 2: Extension Settings Page**
1. Right-click extension icon → "Options"
2. Navigate to API Configuration section
3. Enter:
   - API Key: `AIzaSyA5WlrwJ_JvXyjfvXXD-MoPqRWKPXQ_ucc`
   - OAuth Client ID: `531603419931-2j1ps65hids5onfut7qoo743dtoon98d.apps.googleusercontent.com`
4. Save settings

### 3. Get Your Extension ID

After running the setup script, note the Extension ID. It will look like:
`abcdefghijklmnopqrstuvwxyz123456`

### 4. Update Google Cloud Console OAuth Settings

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Navigate to "APIs & Services" → "Credentials"

2. **Edit OAuth 2.0 Client ID**
   - Find your client ID: `531603419931-2j1ps65hids5onfut7qoo743dtoon98d.apps.googleusercontent.com`
   - Click the pencil/edit icon

3. **Add Authorized Redirect URI**
   - In "Authorized redirect URIs" section
   - Click "Add URI"
   - Enter: `https://YOUR_EXTENSION_ID.chromiumapp.org/`
   - Replace `YOUR_EXTENSION_ID` with your actual extension ID
   - Click "Save"

### 5. Test the Setup

Run this test in the extension console:

```javascript
// Test OAuth flow
chrome.runtime.sendMessage({action: 'healthCheck'})
  .then(result => console.log('Health Check:', result));

// Test API connection
chrome.runtime.sendMessage({action: 'testConnection'})
  .then(result => console.log('API Test:', result));
```

## Expected Results

✅ **Success indicators:**
- No "undefined" errors for serviceWorker, api, authentication, credentials
- Health check returns positive status
- API calls return data instead of errors
- OAuth consent screen appears when accessing YouTube features

❌ **If you see errors:**
- `unauthorized_client`: Check OAuth redirect URI matches exactly
- `invalid_client`: Verify Client ID is correct
- `API key not valid`: Check API key restrictions in Google Cloud

## Troubleshooting

### Issue: "unauthorized_client" 
**Solution:** 
1. Double-check the redirect URI in Google Cloud Console
2. Make sure it matches: `https://YOUR_ACTUAL_EXTENSION_ID.chromiumapp.org/`
3. No typos, exact match required

### Issue: Extension ID keeps changing
**Solution:** 
1. Pack the extension for stable ID
2. Or update Google Cloud settings each time you reload unpacked extension

### Issue: OAuth consent screen shows "unverified app"
**Solution:** 
- This is normal for development
- Click "Advanced" → "Go to AstralTube (unsafe)" for testing
- For production, submit OAuth app for verification

## Quick Reference Commands

```bash
# Build extension
npm run build:dev

# If you need to rebuild after changes
npm run build:dev

# Check for any remaining ESLint issues
npm run lint
```

## Final Verification

After setup, check the extension popup for:
- ✅ API Status: Connected
- ✅ Authentication: Ready  
- ✅ Credentials: Configured
- ✅ Service Worker: Active

Your AstralTube extension should now have full YouTube API access!