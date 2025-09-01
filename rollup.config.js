/**
 * AstralTube v3 - Advanced Rollup Build Configuration
 * Modern build system with code splitting, hot reload, optimization, and development support
 */

import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';
import replace from '@rollup/plugin-replace';
import { babel } from '@rollup/plugin-babel';
import postcss from 'rollup-plugin-postcss';
import livereload from 'rollup-plugin-livereload';
import serve from 'rollup-plugin-serve';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import autoprefixer from 'autoprefixer';
import postcssNested from 'postcss-nested';

const isDev = process.env.NODE_ENV === 'development';
const isWatch = process.env.ROLLUP_WATCH === 'true';
const isServe = process.argv.includes('--serve');
// Read package.json for version
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const buildVersion = process.env.BUILD_VERSION || packageJson.version;

// Define input files for different parts of the extension with dynamic imports
const inputs = {
  'background/service-worker': 'src/background/service-worker.js',
  'content/content-script': 'src/content/content-script.js',
  'popup/popup': 'src/popup/popup.js',
  'options/options-enhanced': 'src/options/options-enhanced.js',
  'lib/storage': 'src/lib/storage.js',
  'lib/api': 'src/lib/api.js',
  'lib/analytics': 'src/lib/analytics.js',
  'lib/notifications': 'src/lib/notifications.js',
  'content/deck-mode': 'src/content/deck-mode.js',
  'content/sidebar': 'src/content/sidebar.js',
  'content/playlist-manager': 'src/content/playlist-manager.js',
  'content/subscription-manager': 'src/content/subscription-manager.js',
};

// Code splitting configuration for shared modules
const sharedModules = {
  'lib/shared': ['src/lib/storage.js', 'src/lib/config.js', 'src/lib/error-handler.js'],
  'lib/youtube': ['src/lib/api.js', 'src/lib/credentials.js'],
  'lib/utils': ['src/lib/analytics.js', 'src/lib/notifications.js', 'src/lib/health-checker.js']
};

// Plugin to update manifest.json for development with hot reload support
const updateManifest = () => ({
  name: 'update-manifest',
  writeBundle() {
    const manifestPath = 'dist/manifest.json';
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      if (isDev) {
        manifest.name += ' (Development)';
        manifest.version += `-dev.${Date.now()}`;
        
        // Enhanced CSP for development
        if (isWatch || isServe) {
          manifest.content_security_policy = {
            extension_pages: "script-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:35729; object-src 'none'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:35729 ws://localhost:35729;"
          };
          
          // Add livereload script to popup for hot reload
          if (manifest.action && manifest.action.default_popup) {
            manifest.action.default_popup += '?dev=true';
          }
        }
      } else {
        // Production optimizations
        manifest.version = buildVersion;
        manifest.content_security_policy = {
          extension_pages: "script-src 'self'; object-src 'none'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://www.googleapis.com https://accounts.google.com;"
        };
      }
      
      // Add build metadata
      manifest._build = {
        timestamp: new Date().toISOString(),
        version: buildVersion,
        environment: isDev ? 'development' : 'production',
        hash: createHash('sha256').update(JSON.stringify(manifest)).digest('hex').substring(0, 8)
      };
      
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`🔧 Updated manifest for ${isDev ? 'development' : 'production'}`);
    }
  }
});

// Plugin to generate bundle analysis
const bundleAnalysis = () => ({
  name: 'bundle-analysis',
  generateBundle(options, bundle) {
    const analysis = {
      timestamp: new Date().toISOString(),
      environment: isDev ? 'development' : 'production',
      bundles: {},
      totalSize: 0,
      gzippedSize: 0
    };

    Object.entries(bundle).forEach(([fileName, chunk]) => {
      if (chunk.type === 'chunk') {
        const size = Buffer.byteLength(chunk.code, 'utf8');
        analysis.bundles[fileName] = {
          size,
          modules: Object.keys(chunk.modules).length,
          imports: chunk.imports,
          exports: chunk.exports,
          isDynamicEntry: chunk.isDynamicEntry,
          isEntry: chunk.isEntry
        };
        analysis.totalSize += size;
      }
    });

    if (!fs.existsSync('dist/analysis')) {
      fs.mkdirSync('dist/analysis', { recursive: true });
    }
    
    fs.writeFileSync(
      'dist/analysis/bundle-analysis.json',
      JSON.stringify(analysis, null, 2)
    );
  }
});

// Development server plugin
const devServer = () => {
  if (!isServe) return null;
  return serve({
    contentBase: ['dist'],
    port: 3000,
    host: 'localhost',
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    verbose: true,
    historyApiFallback: false
  });
};

// Live reload plugin for development
const liveReload = () => {
  if (!isWatch && !isServe) return null;
  return livereload({
    watch: 'dist',
    port: 35729,
    delay: 300,
    verbose: true
  });
};

// Common plugins for all builds
const commonPlugins = [
  // Environment variables
  replace({
    __VERSION__: JSON.stringify(buildVersion),
    __DEV__: isDev,
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    preventAssignment: true
  }),
  
  // Node resolution with enhanced options
  nodeResolve({
    browser: true,
    preferBuiltins: false,
    exportConditions: ['browser', 'import', 'module', 'default'],
    dedupe: ['lodash', 'moment']
  }),
  
  // CommonJS support
  commonjs({
    include: /node_modules/
  }),
  
  // Babel for modern JS features
  babel({
    babelHelpers: 'bundled',
    exclude: 'node_modules/**',
    presets: [
      ['@babel/preset-env', {
        targets: { chrome: '88' },
        useBuiltIns: 'usage',
        corejs: 3
      }]
    ],
    plugins: [
      '@babel/plugin-proposal-optional-chaining',
      '@babel/plugin-proposal-nullish-coalescing-operator'
    ]
  }),
  
  // CSS processing
  postcss({
    extract: true,
    minimize: !isDev,
    sourceMap: isDev,
    plugins: [
      autoprefixer,
      postcssNested
    ]
  }),
  
  // File copying with enhanced options
  copy({
    targets: [
      { src: 'manifest.json', dest: 'dist' },
      { src: 'src/popup/*.html', dest: 'dist/src/popup' },
      { src: 'src/content/*.html', dest: 'dist/src/content' },
      { src: 'src/options/*.html', dest: 'dist/src/options' },
      { src: 'icons/**/*', dest: 'dist/icons', flatten: false },
      { src: 'assets/**/*', dest: 'dist/assets', flatten: false },
      { src: 'README.md', dest: 'dist' },
      { src: 'LICENSE', dest: 'dist' }
    ].filter(target => {
      return fs.existsSync(target.src) || target.src.includes('*');
    }),
    hook: 'writeBundle'
  }),
  
  updateManifest(),
  bundleAnalysis(),
  devServer(),
  liveReload()
].filter(Boolean);

// Production-only plugins
const productionPlugins = [
  terser({
    compress: {
      drop_console: true,
      drop_debugger: true,
      pure_funcs: ['console.log', 'console.info', 'console.debug']
    },
    format: {
      comments: false
    }
  })
];

// Create configurations for each input with code splitting
const configs = Object.entries(inputs).map(([name, input]) => ({
  input,
  output: {
    dir: 'dist',
    entryFileNames: `src/${name}.js`,
    format: 'es',
    sourcemap: isDev ? 'inline' : 'hidden',
    compact: !isDev,
    // Enable code splitting for larger modules
    manualChunks: (id) => {
      if (id.includes('node_modules')) {
        if (id.includes('lodash')) return 'vendor/lodash';
        if (id.includes('moment')) return 'vendor/moment';
        return 'vendor/common';
      }
      
      // Split shared modules
      for (const [chunkName, modules] of Object.entries(sharedModules)) {
        if (modules.some(module => id.includes(module))) {
          return `shared/${chunkName}`;
        }
      }
    },
    // Generate unique file names for chunks
    chunkFileNames: isDev ? 'chunks/[name].js' : 'chunks/[name]-[hash].js'
  },
  plugins: [
    ...commonPlugins,
    ...(isDev ? [] : productionPlugins)
  ],
  external: ['chrome'],
  context: 'window',
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false,
    unknownGlobalSideEffects: false
  },
  watch: {
    clearScreen: false,
    include: 'src/**',
    exclude: 'node_modules/**',
    chokidar: {
      usePolling: false,
      interval: 100
    }
  },
  onwarn: (warning, warn) => {
    // Skip certain warnings
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    if (warning.code === 'THIS_IS_UNDEFINED') return;
    warn(warning);
  }
}));

// Add shared chunks configuration for better code splitting
if (!isDev) {
  configs.push({
    input: Object.values(sharedModules).flat(),
    output: {
      dir: 'dist/src/shared',
      format: 'es',
      chunkFileNames: '[name]-[hash].js'
    },
    plugins: commonPlugins.filter(p => p && p.name !== 'serve' && p.name !== 'livereload'),
    external: ['chrome']
  });
}

// Log build configuration
const logConfig = () => {
  console.log('🏗️  Rollup Configuration:');
  console.log(`   Environment: ${isDev ? 'Development' : 'Production'}`);
  console.log(`   Version: ${buildVersion}`);
  console.log(`   Watch mode: ${isWatch}`);
  console.log(`   Serve mode: ${isServe}`);
  console.log(`   Inputs: ${Object.keys(inputs).length}`);
  console.log(`   Code splitting: ${!isDev ? 'Enabled' : 'Disabled'}`);
  
  if (isServe) {
    console.log('🚀 Development server will start at http://localhost:3000');
    console.log('🔄 Live reload enabled at http://localhost:35729');
  }
};

logConfig();

export default configs;