# AstralTube v3 - Installation Guide

## 🚀 Quick Installation

### Method 1: Load as Unpacked Extension (Recommended for Testing)

1. **Build the extension**:
   ```bash
   cd "c:\Users\damat\_REPOS\Playlist Extension\v2\astraltube"
   node build.js --dev
   ```

2. **Open Chrome Extensions**:
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

3. **Load the extension**:
   - Click "Load unpacked"
   - Select the `dist` folder that was created
   - The extension should now appear in your extensions list

4. **Test on YouTube**:
   - Go to `https://youtube.com`
   - Click the AstralTube extension icon in the toolbar
   - The popup should open showing the dashboard

## 🔧 Development Setup

### Prerequisites
- Node.js 18+ installed
- Chrome browser
- Basic knowledge of browser extensions

### Setup Steps

1. **Clone/Navigate to the project**:
   ```bash
   cd "c:\Users\damat\_REPOS\Playlist Extension\v2\astraltube"
   ```

2. **Install dependencies** (optional, for development tools):
   ```bash
   npm install
   ```

3. **Build for development**:
   ```bash
   node build.js --dev
   ```

4. **Load in Chrome** (see Method 1 above)

## 🎨 Icon Setup (Optional)

The build script creates placeholder SVG icons. For a production-ready extension, you should:

1. **Convert SVG to PNG**:
   - Use an online converter or image editor
   - Convert each icon size: 16x16, 32x32, 48x48, 128x128
   - Save as PNG files in the `icons/` directory

2. **Rebuild**:
   ```bash
   node build.js --dev
   ```

3. **Reload extension** in Chrome

## 🧪 Testing the Extension

### Basic Functionality Test

1. **Popup Test**:
   - Click the extension icon
   - Verify the popup opens with tabs (Dashboard, Playlists, Subscriptions, Tools)
   - Check that the UI looks correct

2. **YouTube Integration Test**:
   - Go to YouTube.com
   - Look for AstralTube enhancements (may take a moment to load)
   - Try keyboard shortcuts:
     - `Ctrl+Shift+A` - Toggle sidebar
     - `Ctrl+Shift+D` - Toggle deck mode

3. **Settings Test**:
   - Right-click the extension icon → Options
   - Verify the settings page opens
   - Test different settings toggles

### Expected Behavior

✅ **Working Features**:
- Extension popup opens and displays correctly
- Settings page loads and is functional
- Content script injects into YouTube pages
- Basic UI enhancements appear on YouTube
- Keyboard shortcuts work

⚠️ **Known Limitations** (v3.0.0):
- Some advanced features may need additional API setup
- Icons are placeholder SVGs (should be converted to PNG)
- Some components may need YouTube API credentials for full functionality

## 🔑 API Setup (Optional)

For full functionality, you may want to set up YouTube API access:

1. **Get YouTube API Key**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable YouTube Data API v3
   - Create credentials (API Key)

2. **Configure OAuth** (for advanced features):
   - Set up OAuth 2.0 credentials
   - Add authorized domains
   - Update the manifest.json with your client ID

3. **Update Extension**:
   - Add your API key to the extension settings
   - Rebuild and reload the extension

## 🐛 Troubleshooting

### Common Issues

**Extension doesn't load**:
- Check that Developer mode is enabled
- Verify the manifest.json is valid
- Check Chrome's extension error logs

**Popup doesn't open**:
- Check for JavaScript errors in the console
- Verify all required files are in the dist folder
- Try reloading the extension

**YouTube integration not working**:
- Refresh the YouTube page
- Check that content scripts are allowed
- Verify no other YouTube extensions are conflicting

**Settings page blank**:
- Check for JavaScript errors
- Verify all CSS and JS files are loaded
- Try opening in incognito mode

### Debug Mode

Enable debug logging by:
1. Opening the extension popup
2. Right-click → Inspect
3. Check the Console tab for debug messages

## 📝 Next Steps

Once you have the extension loaded and working:

1. **Customize Settings**: Configure the extension to your preferences
2. **Test Features**: Try creating playlists, collections, and using tools
3. **Report Issues**: If you find bugs, document them for fixing
4. **Contribute**: Consider contributing improvements or features

## 🎯 Production Deployment

For deploying to the Chrome Web Store:

1. **Build for production**:
   ```bash
   node build.js
   ```

2. **Create proper icons** (PNG format)

3. **Test thoroughly** on multiple YouTube pages

4. **Package for submission**:
   - Zip the dist folder contents
   - Submit to Chrome Web Store Developer Dashboard

## 📞 Support

If you encounter issues:
- Check the browser console for errors
- Verify all files are present in the dist folder
- Try rebuilding the extension
- Test in a clean Chrome profile

---

**Congratulations!** 🎉 You now have AstralTube v3 running as a Chrome extension. This powerful YouTube manager combines the best features of playlist and subscription management into one seamless experience.