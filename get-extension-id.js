/**
 * Helper script to get Chrome Extension ID after building
 * Run this after loading your unpacked extension
 */

console.log(`
🔧 AstralTube Extension ID Helper

To get your Extension ID:

1. Build the extension:
   npm run build:dev

2. Load in Chrome:
   - Go to chrome://extensions/
   - Enable "Developer mode" 
   - Click "Load unpacked"
   - Select the 'dist' folder

3. Copy the Extension ID:
   - Look for a string like: abcdefghijklmnopqrstuvwxyz123456
   - This appears under your extension name

4. Use this ID to update your OAuth settings in Google Cloud Console:
   Authorized redirect URI: https://YOUR_EXTENSION_ID.chromiumapp.org/

Current manifest info:
`);

// If running in extension context
if (typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('Extension ID:', chrome.runtime.id);
    console.log('Redirect URI:', `https://${chrome.runtime.id}.chromiumapp.org/`);
} else {
    console.log('This script needs to run in the extension context');
    console.log('Load the extension first, then run this in the extension popup console');
}