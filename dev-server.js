/**
 * AstralTube v3 - Development Server
 * Advanced development server with hot reload, proxy support, and debugging tools
 */

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import chokidar from 'chokidar';
import WebSocket from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import compression from 'compression';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DevServer {
  constructor(options = {}) {
    this.port = options.port || 3000;
    this.wsPort = options.wsPort || 35729;
    this.host = options.host || 'localhost';
    this.distDir = path.join(__dirname, 'dist');
    this.srcDir = path.join(__dirname, 'src');
    
    this.app = express();
    this.wss = null;
    this.clients = new Set();
    this.buildProcess = null;
    
    this.setupExpress();
    this.setupWebSocket();
    this.setupFileWatcher();
  }

  setupExpress() {
    // Enable CORS for cross-origin requests
    this.app.use(cors({
      origin: ['https://www.youtube.com', 'https://youtube.com'],
      credentials: true
    }));

    // Compression middleware
    this.app.use(compression());

    // Logging middleware
    this.app.use((req, res, next) => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] ${req.method} ${req.url}`);
      next();
    });

    // Serve static files from dist
    this.app.use('/dist', express.static(this.distDir, {
      setHeaders: (res, path) => {
        // Set appropriate headers for extension files
        if (path.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript');
        } else if (path.endsWith('.json')) {
          res.setHeader('Content-Type', 'application/json');
        }
      }
    }));

    // API endpoints for development tools
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        clients: this.clients.size
      });
    });

    this.app.get('/api/build-status', (req, res) => {
      const manifestPath = path.join(this.distDir, 'manifest.json');
      const buildStatus = {
        built: fs.existsSync(manifestPath),
        lastBuild: null,
        files: {}
      };

      if (buildStatus.built) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          buildStatus.lastBuild = manifest._build?.timestamp || null;
          
          // Check key files
          const keyFiles = [
            'src/background/service-worker.js',
            'src/content/content-script.js',
            'src/popup/popup.js'
          ];
          
          keyFiles.forEach(file => {
            const filePath = path.join(this.distDir, file);
            buildStatus.files[file] = {
              exists: fs.existsSync(filePath),
              size: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0,
              modified: fs.existsSync(filePath) ? fs.statSync(filePath).mtime : null
            };
          });
        } catch (error) {
          buildStatus.error = error.message;
        }
      }

      res.json(buildStatus);
    });

    // Bundle analysis endpoint
    this.app.get('/api/bundle-analysis', (req, res) => {
      const analysisPath = path.join(this.distDir, 'analysis', 'bundle-analysis.json');
      
      if (fs.existsSync(analysisPath)) {
        try {
          const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
          res.json(analysis);
        } catch (error) {
          res.status(500).json({ error: 'Failed to read bundle analysis' });
        }
      } else {
        res.status(404).json({ error: 'Bundle analysis not found' });
      }
    });

    // Live reload client script
    this.app.get('/livereload.js', (req, res) => {
      const script = `
        (function() {
          const ws = new WebSocket('ws://${this.host}:${this.wsPort}');
          
          ws.onopen = function() {
            console.log('[AstralTube DevServer] Connected to live reload');
          };
          
          ws.onmessage = function(event) {
            const data = JSON.parse(event.data);
            console.log('[AstralTube DevServer] Received:', data);
            
            if (data.type === 'reload') {
              console.log('[AstralTube DevServer] Reloading extension...');
              if (chrome && chrome.runtime && chrome.runtime.reload) {
                chrome.runtime.reload();
              } else {
                window.location.reload();
              }
            }
          };
          
          ws.onerror = function(error) {
            console.error('[AstralTube DevServer] WebSocket error:', error);
          };
          
          ws.onclose = function() {
            console.log('[AstralTube DevServer] Disconnected from live reload');
            // Try to reconnect after 2 seconds
            setTimeout(function() {
              window.location.reload();
            }, 2000);
          };
        })();
      `;
      
      res.setHeader('Content-Type', 'application/javascript');
      res.send(script);
    });

    // Development dashboard
    this.app.get('/dashboard', (req, res) => {
      const dashboardHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>AstralTube Development Dashboard</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .status-ok { color: #4CAF50; }
            .status-error { color: #f44336; }
            .file-list { list-style: none; padding: 0; }
            .file-list li { padding: 8px; background: #f9f9f9; margin: 4px 0; border-radius: 4px; }
            .refresh-btn { background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
            .refresh-btn:hover { background: #764ba2; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🚀 AstralTube Development Dashboard</h1>
            <p>Monitor your extension build status and development tools</p>
          </div>
          
          <div class="grid">
            <div class="card">
              <h3>🏥 Server Health</h3>
              <div id="health-status">Loading...</div>
              <button class="refresh-btn" onclick="refreshHealth()">Refresh</button>
            </div>
            
            <div class="card">
              <h3>🔨 Build Status</h3>
              <div id="build-status">Loading...</div>
              <button class="refresh-btn" onclick="refreshBuild()">Refresh</button>
            </div>
            
            <div class="card">
              <h3>📊 Bundle Analysis</h3>
              <div id="bundle-analysis">Loading...</div>
              <button class="refresh-btn" onclick="refreshBundle()">Refresh</button>
            </div>
            
            <div class="card">
              <h3>🔗 Quick Links</h3>
              <ul class="file-list">
                <li><a href="/dist/manifest.json" target="_blank">📄 Manifest</a></li>
                <li><a href="chrome://extensions/" target="_blank">🧩 Chrome Extensions</a></li>
                <li><a href="https://www.youtube.com" target="_blank">📺 YouTube</a></li>
              </ul>
            </div>
          </div>
          
          <script>
            async function refreshHealth() {
              try {
                const response = await fetch('/api/health');
                const data = await response.json();
                document.getElementById('health-status').innerHTML = \`
                  <div class="status-ok">✅ Server Online</div>
                  <p>Uptime: \${Math.floor(data.uptime)} seconds</p>
                  <p>Connected clients: \${data.clients}</p>
                  <p>Last check: \${new Date(data.timestamp).toLocaleTimeString()}</p>
                \`;
              } catch (error) {
                document.getElementById('health-status').innerHTML = \`
                  <div class="status-error">❌ Server Error</div>
                  <p>\${error.message}</p>
                \`;
              }
            }
            
            async function refreshBuild() {
              try {
                const response = await fetch('/api/build-status');
                const data = await response.json();
                
                if (data.built) {
                  let fileList = '';
                  Object.entries(data.files).forEach(([file, info]) => {
                    const status = info.exists ? '✅' : '❌';
                    const size = info.exists ? \`(\${Math.round(info.size / 1024)}KB)\` : '';
                    fileList += \`<li>\${status} \${file} \${size}</li>\`;
                  });
                  
                  document.getElementById('build-status').innerHTML = \`
                    <div class="status-ok">✅ Build Complete</div>
                    <p>Last build: \${data.lastBuild ? new Date(data.lastBuild).toLocaleTimeString() : 'Unknown'}</p>
                    <ul class="file-list">\${fileList}</ul>
                  \`;
                } else {
                  document.getElementById('build-status').innerHTML = \`
                    <div class="status-error">❌ No Build Found</div>
                    <p>Run 'npm run build' or 'npm run dev' first</p>
                  \`;
                }
              } catch (error) {
                document.getElementById('build-status').innerHTML = \`
                  <div class="status-error">❌ Build Check Error</div>
                  <p>\${error.message}</p>
                \`;
              }
            }
            
            async function refreshBundle() {
              try {
                const response = await fetch('/api/bundle-analysis');
                const data = await response.json();
                
                document.getElementById('bundle-analysis').innerHTML = \`
                  <div class="status-ok">✅ Analysis Available</div>
                  <p>Total size: \${Math.round(data.totalSize / 1024)}KB</p>
                  <p>Bundles: \${Object.keys(data.bundles || {}).length}</p>
                  <p>Generated: \${new Date(data.timestamp).toLocaleTimeString()}</p>
                \`;
              } catch (error) {
                document.getElementById('bundle-analysis').innerHTML = \`
                  <div class="status-error">❌ No Analysis Found</div>
                  <p>Build the extension to generate analysis</p>
                \`;
              }
            }
            
            // Auto-refresh every 5 seconds
            setInterval(() => {
              refreshHealth();
              refreshBuild();
              refreshBundle();
            }, 5000);
            
            // Initial load
            refreshHealth();
            refreshBuild();
            refreshBundle();
          </script>
        </body>
        </html>
      `;
      
      res.send(dashboardHtml);
    });

    // Proxy YouTube API requests (for development only)
    this.app.use('/api/youtube', createProxyMiddleware({
      target: 'https://www.googleapis.com',
      changeOrigin: true,
      pathRewrite: {
        '^/api/youtube': '/youtube/v3'
      },
      onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.status(500).json({ error: 'Proxy error' });
      }
    }));

    // Default route
    this.app.get('/', (req, res) => {
      res.redirect('/dashboard');
    });
  }

  setupWebSocket() {
    this.wss = new WebSocket.Server({ port: this.wsPort });
    
    this.wss.on('connection', (ws) => {
      console.log(`🔗 WebSocket client connected (${this.clients.size + 1} total)`);
      this.clients.add(ws);
      
      ws.on('close', () => {
        console.log('📡 WebSocket client disconnected');
        this.clients.delete(ws);
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
      
      // Send initial connection message
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'AstralTube DevServer connected',
        timestamp: new Date().toISOString()
      }));
    });
  }

  setupFileWatcher() {
    // Watch source files for changes
    const watcher = chokidar.watch([
      'src/**/*',
      'manifest.json',
      'icons/**/*'
    ], {
      ignored: /node_modules/,
      persistent: true,
      ignoreInitial: true
    });

    watcher.on('change', (filePath) => {
      console.log(`📝 File changed: ${filePath}`);
      this.triggerReload('change', filePath);
    });

    watcher.on('add', (filePath) => {
      console.log(`➕ File added: ${filePath}`);
      this.triggerReload('add', filePath);
    });

    watcher.on('unlink', (filePath) => {
      console.log(`🗑️  File removed: ${filePath}`);
      this.triggerReload('unlink', filePath);
    });

    // Also watch dist directory for build output changes
    const distWatcher = chokidar.watch('dist/**/*', {
      persistent: true,
      ignoreInitial: true
    });

    distWatcher.on('change', () => {
      this.notifyClients({
        type: 'build-complete',
        timestamp: new Date().toISOString()
      });
    });
  }

  triggerReload(changeType, filePath) {
    // Debounce rapid file changes
    clearTimeout(this.reloadTimeout);
    this.reloadTimeout = setTimeout(() => {
      this.notifyClients({
        type: 'reload',
        changeType,
        filePath,
        timestamp: new Date().toISOString()
      });
    }, 300);
  }

  notifyClients(message) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  start() {
    this.app.listen(this.port, this.host, () => {
      console.log('\n🚀 AstralTube Development Server');
      console.log('=====================================');
      console.log(`📡 Server: http://${this.host}:${this.port}`);
      console.log(`🔄 WebSocket: ws://${this.host}:${this.wsPort}`);
      console.log(`📊 Dashboard: http://${this.host}:${this.port}/dashboard`);
      console.log('=====================================');
      console.log('🔥 Hot reload enabled');
      console.log('📁 Serving from: dist/');
      console.log('👁️  Watching: src/, manifest.json, icons/');
      console.log('\n💡 Load your extension from the dist/ folder in Chrome');
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down development server...');
      if (this.wss) {
        this.wss.close();
      }
      process.exit(0);
    });
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new DevServer();
  server.start();
}

export default DevServer;