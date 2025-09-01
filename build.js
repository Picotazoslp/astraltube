/**
 * AstralTube v3 - Build Script
 * Simple build process for development and production
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.argv.includes('--dev');
const distDir = path.join(__dirname, 'dist');

console.log(`🔨 Building AstralTube v3 (${isDev ? 'development' : 'production'})...`);

// Clean dist directory
if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Copy files
const filesToCopy = [
    'manifest.json',
    'src/',
    'icons/',
    'README.md'
];

function copyRecursive(src, dest) {
    const stat = fs.statSync(src);
    
    if (stat.isDirectory()) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        
        const files = fs.readdirSync(src);
        files.forEach(file => {
            copyRecursive(path.join(src, file), path.join(dest, file));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

filesToCopy.forEach(file => {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(distDir, file);
    
    if (fs.existsSync(srcPath)) {
        copyRecursive(srcPath, destPath);
        console.log(`✅ Copied ${file}`);
    } else {
        console.warn(`⚠️  ${file} not found, skipping`);
    }
});

// Create placeholder icons if they don't exist
const iconSizes = [16, 32, 48, 128];
const iconsDir = path.join(distDir, 'icons');

if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

iconSizes.forEach(size => {
    const iconPath = path.join(iconsDir, `icon${size}.png`);
    if (!fs.existsSync(iconPath)) {
        // Create a simple SVG icon and note that it should be replaced
        const svgContent = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#667eea"/>
                    <stop offset="100%" style="stop-color:#764ba2"/>
                </linearGradient>
            </defs>
            <path fill="url(#grad)" d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z"/>
            <circle cx="12" cy="12" r="3" fill="white" opacity="0.9"/>
        </svg>`;
        
        fs.writeFileSync(iconPath.replace('.png', '.svg'), svgContent);
        console.log(`📝 Created placeholder icon${size}.svg (convert to PNG for production)`);
    }
});

// Update manifest for development
if (isDev) {
    const manifestPath = path.join(distDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    manifest.name += ' (Development)';
    manifest.version += '-dev';
    
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('🔧 Updated manifest for development');
}

console.log(`✅ Build completed! Output in ${distDir}`);
console.log('\n📋 Next steps:');
console.log('1. Convert SVG icons to PNG format');
console.log('2. Load the extension in Chrome from the dist/ folder');
console.log('3. Test all functionality on YouTube');

if (!isDev) {
    console.log('4. Package for Chrome Web Store submission');
}