/**
 * AstralTube v3 - Chrome Web Store Packaging Script
 * Automated packaging and deployment preparation with Chrome Web Store API integration
 */

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

class ExtensionPackager {
  constructor(options = {}) {
    this.distDir = path.join(__dirname, 'dist');
    this.packageDir = path.join(__dirname, 'packages');
    this.reportsDir = path.join(__dirname, 'reports');
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.manifest = null;
    this.isDev = options.dev || process.argv.includes('--dev');
    this.shouldDeploy = options.deploy || process.argv.includes('--deploy');
    this.skipValidation = options.skipValidation || process.argv.includes('--skip-validation');
    
    // Chrome Web Store API configuration
    this.chromeWebStoreConfig = {
      clientId: process.env.CHROME_CLIENT_ID,
      clientSecret: process.env.CHROME_CLIENT_SECRET,
      refreshToken: process.env.CHROME_REFRESH_TOKEN,
      extensionId: process.env.CHROME_EXTENSION_ID,
      apiUrl: 'https://www.googleapis.com/chromewebstore/v1.1'
    };
  }

  async init() {
    // Ensure directories exist
    [this.packageDir, this.reportsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Load manifest
    const manifestPath = path.join(this.distDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('❌ No manifest.json found in dist/. Run build first.');
    }

    this.manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // Clean development artifacts from manifest if not dev build
    if (!this.isDev && this.manifest._build) {
      delete this.manifest._build;
      fs.writeFileSync(manifestPath, JSON.stringify(this.manifest, null, 2));
    }
    
    console.log(`📦 Packaging ${this.manifest.name} v${this.manifest.version} (${this.isDev ? 'Development' : 'Production'})`);
  }

  validateBuild() {
    if (this.skipValidation) {
      console.log('⏭️  Skipping build validation');
      return;
    }
    
    console.log('🔍 Validating build...');
    
    const requiredFiles = [
      'manifest.json',
      'src/background/service-worker.js',
      'src/content/content-script.js',
      'src/popup/popup.js',
      'src/popup/popup.html'
    ];

    const missingFiles = requiredFiles.filter(file => 
      !fs.existsSync(path.join(this.distDir, file))
    );

    if (missingFiles.length > 0) {
      throw new Error(`❌ Missing required files: ${missingFiles.join(', ')}`);
    }

    // Validate manifest structure
    this.validateManifest();
    
    // Check for dev artifacts in production builds
    if (!this.isDev) {
      this.checkDevArtifacts();
    }
    
    // Validate file sizes
    this.validateFileSizes();

    console.log('✅ Build validation passed');
  }
  
  validateManifest() {
    const { manifest } = this;
    const errors = [];
    
    // Required fields
    const requiredFields = ['manifest_version', 'name', 'version'];
    requiredFields.forEach(field => {
      if (!manifest[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    });
    
    // Version format
    if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
      errors.push('Invalid version format. Use semver (x.y.z)');
    }
    
    // Icon validation
    if (manifest.icons) {
      Object.entries(manifest.icons).forEach(([size, path]) => {
        if (!fs.existsSync(path.join(this.distDir, path))) {
          errors.push(`Missing icon: ${path}`);
        }
      });
    }
    
    if (errors.length > 0) {
      throw new Error(`❌ Manifest validation failed:\n${errors.join('\n')}`);
    }
  }
  
  checkDevArtifacts() {
    const devPatterns = [
      /\.map$/,
      /-dev\./,
      /debug/i,
      /test/i,
      /spec\./i,
      /\.development\./
    ];
    
    const walkDir = (dir) => {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else {
          const relativePath = path.relative(this.distDir, fullPath);
          if (devPatterns.some(pattern => pattern.test(relativePath))) {
            console.warn(`⚠️  Dev artifact detected: ${relativePath}`);
          }
        }
      });
    };
    
    walkDir(this.distDir);
  }
  
  validateFileSizes() {
    const maxSizes = {
      '.js': 1024 * 1024,    // 1MB for JS files
      '.css': 256 * 1024,    // 256KB for CSS files
      '.html': 100 * 1024,   // 100KB for HTML files
      '.json': 50 * 1024,    // 50KB for JSON files
      '.png': 512 * 1024,    // 512KB for PNG files
      '.svg': 100 * 1024     // 100KB for SVG files
    };
    
    const walkDir = (dir) => {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else {
          const ext = path.extname(file).toLowerCase();
          const maxSize = maxSizes[ext];
          
          if (maxSize && stat.size > maxSize) {
            console.warn(`⚠️  Large file detected: ${path.relative(this.distDir, fullPath)} (${Math.round(stat.size / 1024)}KB)`);
          }
        }
      });
    };
    
    walkDir(this.distDir);
  }

  generateChecksums() {
    console.log('🔐 Generating checksums...');
    
    const checksums = {
      version: this.manifest.version,
      timestamp: new Date().toISOString(),
      algorithm: 'sha256',
      files: {},
      summary: {
        totalFiles: 0,
        totalSize: 0
      }
    };
    
    const walkSync = (dir, filelist = []) => {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
          filelist = walkSync(filepath, filelist);
        } else {
          filelist.push(filepath);
        }
      });
      return filelist;
    };

    const files = walkSync(this.distDir);
    files.forEach(file => {
      const content = fs.readFileSync(file);
      const hash = createHash('sha256').update(content).digest('hex');
      const relativePath = path.relative(this.distDir, file).replace(/\\/g, '/');
      
      checksums.files[relativePath] = {
        sha256: hash,
        size: content.length,
        modified: fs.statSync(file).mtime.toISOString()
      };
      
      checksums.summary.totalFiles++;
      checksums.summary.totalSize += content.length;
    });

    const checksumsPath = path.join(this.packageDir, `checksums-${this.manifest.version}.json`);
    fs.writeFileSync(checksumsPath, JSON.stringify(checksums, null, 2));
    console.log(`📋 Checksums saved to ${checksumsPath} (${checksums.summary.totalFiles} files, ${Math.round(checksums.summary.totalSize / 1024)}KB)`);
    
    return checksums;
  }
  
  async createZipPackage() {
    console.log('📦 Creating ZIP package...');
    
    const zipName = `astraltube-${this.manifest.version}${this.isDev ? '-dev' : ''}.zip`;
    const zipPath = path.join(this.packageDir, zipName);
    
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Best compression
      });
      
      output.on('close', () => {
        const size = archive.pointer();
        console.log(`✅ Package created: ${zipName} (${Math.round(size / 1024)}KB)`);
        resolve({ path: zipPath, size, name: zipName });
      });
      
      archive.on('error', reject);
      archive.pipe(output);
      
      // Add all files from dist directory
      archive.directory(this.distDir, false);
      archive.finalize();
    });
  }
  
  async generatePackageReport(zipInfo, checksums) {
    const report = {
      package: {
        name: this.manifest.name,
        version: this.manifest.version,
        environment: this.isDev ? 'development' : 'production',
        timestamp: new Date().toISOString(),
        zipFile: zipInfo.name,
        zipSize: zipInfo.size,
        zipSizeFormatted: this.formatBytes(zipInfo.size)
      },
      manifest: this.manifest,
      checksums: checksums.summary,
      validation: {
        passed: true,
        skipped: this.skipValidation,
        errors: [],
        warnings: []
      },
      webStore: {
        ready: !this.isDev && this.chromeWebStoreConfig.extensionId,
        deployment: {
          configured: this.isWebStoreConfigured(),
          scheduled: this.shouldDeploy
        }
      }
    };
    
    const reportPath = path.join(this.reportsDir, `package-report-${this.manifest.version}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Package report saved: ${reportPath}`);
    
    return report;
  }
  
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
  
  isWebStoreConfigured() {
    return !!(this.chromeWebStoreConfig.clientId && 
              this.chromeWebStoreConfig.clientSecret && 
              this.chromeWebStoreConfig.refreshToken && 
              this.chromeWebStoreConfig.extensionId);
  }
  
  async getWebStoreAccessToken() {
    const { clientId, clientSecret, refreshToken } = this.chromeWebStoreConfig;
    
    if (!this.isWebStoreConfigured()) {
      throw new Error('Chrome Web Store API credentials not configured');
    }
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.access_token;
  }
  
  async uploadToWebStore(zipPath) {
    console.log('🚀 Uploading to Chrome Web Store...');
    
    try {
      const accessToken = await this.getWebStoreAccessToken();
      const zipData = fs.readFileSync(zipPath);
      
      const response = await fetch(
        `${this.chromeWebStoreConfig.apiUrl}/items/${this.chromeWebStoreConfig.extensionId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-goog-api-version': '2'
          },
          body: zipData
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ Upload successful:', result.uploadState);
      
      return result;
    } catch (error) {
      console.error('❌ Upload failed:', error.message);
      throw error;
    }
  }
  
  async publishToWebStore() {
    console.log('📢 Publishing to Chrome Web Store...');
    
    try {
      const accessToken = await this.getWebStoreAccessToken();
      
      const response = await fetch(
        `${this.chromeWebStoreConfig.apiUrl}/items/${this.chromeWebStoreConfig.extensionId}/publish`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-goog-api-version': '2',
            'Content-Length': '0'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Publish failed: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ Publish successful:', result.status);
      
      return result;
    } catch (error) {
      console.error('❌ Publish failed:', error.message);
      throw error;
    }
  }
  
  async run() {
    try {
      await this.init();
      this.validateBuild();
      
      const checksums = this.generateChecksums();
      const zipInfo = await this.createZipPackage();
      const report = await this.generatePackageReport(zipInfo, checksums);
      
      console.log('\n📊 Package Summary:');
      console.log(`   Extension: ${this.manifest.name} v${this.manifest.version}`);
      console.log(`   Package: ${zipInfo.name} (${this.formatBytes(zipInfo.size)})`);
      console.log(`   Files: ${checksums.summary.totalFiles}`);
      console.log(`   Environment: ${this.isDev ? 'Development' : 'Production'}`);
      
      // Chrome Web Store deployment
      if (this.shouldDeploy && !this.isDev) {
        if (this.isWebStoreConfigured()) {
          console.log('\n🚀 Starting Chrome Web Store deployment...');
          
          const uploadResult = await this.uploadToWebStore(zipInfo.path);
          
          if (uploadResult.uploadState === 'SUCCESS') {
            const publishResult = await this.publishToWebStore();
            
            if (publishResult.status === 'OK') {
              console.log('\n🎉 Successfully deployed to Chrome Web Store!');
            } else {
              console.log('\n⚠️  Upload successful but publish pending review');
            }
          }
        } else {
          console.log('\n⚠️  Chrome Web Store deployment skipped - missing API credentials');
        }
      }
      
      console.log('\n✅ Packaging complete!');
      return zipInfo;
      
    } catch (error) {
      console.error('\n❌ Packaging failed:', error.message);
      process.exit(1);
    }
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const packager = new ExtensionPackager();
  packager.run();
}

export default ExtensionPackager;