#!/usr/bin/env node

/**
 * AstralTube v3 - Development Environment Setup
 * Automated setup script for development environment
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

class DevSetup {
  constructor() {
    this.steps = [
      { name: 'checkRequirements', desc: 'Checking system requirements' },
      { name: 'installDependencies', desc: 'Installing dependencies' },
      { name: 'setupGitHooks', desc: 'Setting up Git hooks' },
      { name: 'createEnvFile', desc: 'Creating environment file' },
      { name: 'setupDirectories', desc: 'Creating project directories' },
      { name: 'validateSetup', desc: 'Validating setup' },
      { name: 'runInitialBuild', desc: 'Running initial build' }
    ];
    this.currentStep = 0;
  }

  log(message, level = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const icons = { 
      info: '📋', 
      success: '✅', 
      error: '❌', 
      warn: '⚠️',
      progress: '🔄'
    };
    console.log(`[${timestamp}] ${icons[level]} ${message}`);
  }

  logStep(stepName) {
    this.currentStep++;
    const step = this.steps.find(s => s.name === stepName);
    const progress = `[${this.currentStep}/${this.steps.length}]`;
    this.log(`${progress} ${step.desc}...`, 'progress');
  }

  async checkCommand(command) {
    try {
      await execAsync(`which ${command}`);
      return true;
    } catch {
      try {
        await execAsync(`where ${command}`); // Windows
        return true;
      } catch {
        return false;
      }
    }
  }

  async checkRequirements() {
    this.logStep('checkRequirements');
    
    const requirements = [
      { name: 'Node.js', command: 'node', version: '--version', minVersion: '18.0.0' },
      { name: 'npm', command: 'npm', version: '--version', minVersion: '9.0.0' },
      { name: 'Git', command: 'git', version: '--version', minVersion: '2.0.0' }
    ];

    for (const req of requirements) {
      const hasCommand = await this.checkCommand(req.command);
      if (!hasCommand) {
        throw new Error(`${req.name} is not installed. Please install it first.`);
      }

      try {
        const { stdout } = await execAsync(`${req.command} ${req.version}`);
        const version = stdout.trim();
        this.log(`${req.name}: ${version}`, 'info');
      } catch (error) {
        this.log(`Could not check ${req.name} version`, 'warn');
      }
    }

    // Check for Chrome (optional)
    const hasChrome = await this.checkCommand('google-chrome') || await this.checkCommand('chrome');
    if (hasChrome) {
      this.log('Chrome detected - extension testing available', 'success');
    } else {
      this.log('Chrome not detected - install Chrome for extension testing', 'warn');
    }

    this.log('System requirements check completed', 'success');
  }

  async installDependencies() {
    this.logStep('installDependencies');
    
    this.log('Installing npm dependencies...', 'info');
    
    try {
      // Clear any existing node_modules and package-lock.json for clean install
      if (fs.existsSync('node_modules')) {
        this.log('Cleaning existing node_modules...', 'info');
        await execAsync('rm -rf node_modules package-lock.json').catch(() => {
          // Windows fallback
          await execAsync('rmdir /s /q node_modules & del package-lock.json').catch(() => {
            this.log('Could not clean existing installation, continuing...', 'warn');
          });
        });
      }

      // Install dependencies
      await execAsync('npm install');
      this.log('Dependencies installed successfully', 'success');

      // Install global tools if needed
      try {
        await execAsync('npm list -g @rollup/cli');
      } catch {
        this.log('Installing Rollup CLI globally...', 'info');
        await execAsync('npm install -g @rollup/cli');
      }

    } catch (error) {
      throw new Error(`Failed to install dependencies: ${error.message}`);
    }
  }

  async setupGitHooks() {
    this.logStep('setupGitHooks');
    
    try {
      // Initialize husky
      await execAsync('npx husky install');
      
      // Make hook files executable (Unix-like systems)
      try {
        await execAsync('chmod +x .husky/pre-commit .husky/commit-msg');
      } catch {
        // Windows doesn't need chmod
      }

      this.log('Git hooks setup completed', 'success');
    } catch (error) {
      this.log(`Failed to setup Git hooks: ${error.message}`, 'warn');
    }
  }

  async createEnvFile() {
    this.logStep('createEnvFile');
    
    const envPath = path.join(__dirname, '.env');
    const envExamplePath = path.join(__dirname, '.env.example');
    
    if (!fs.existsSync(envPath)) {
      if (fs.existsSync(envExamplePath)) {
        fs.copyFileSync(envExamplePath, envPath);
        this.log('.env file created from template', 'success');
        this.log('Edit .env file to configure your environment', 'info');
      } else {
        // Create basic .env file
        const basicEnv = `# AstralTube Development Environment
NODE_ENV=development
BUILD_VERSION=3.0.0
DEV_SERVER_PORT=3000
DEV_WEBSOCKET_PORT=35729
ENABLE_DEBUG_MODE=true
`;
        fs.writeFileSync(envPath, basicEnv);
        this.log('Basic .env file created', 'success');
      }
    } else {
      this.log('.env file already exists', 'info');
    }
  }

  async setupDirectories() {
    this.logStep('setupDirectories');
    
    const directories = [
      'dist',
      'packages', 
      'reports',
      'coverage',
      'logs'
    ];

    directories.forEach(dir => {
      const dirPath = path.join(__dirname, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        this.log(`Created directory: ${dir}`, 'info');
      }
    });

    // Create .gitkeep files to ensure directories are tracked
    directories.forEach(dir => {
      const gitkeepPath = path.join(__dirname, dir, '.gitkeep');
      if (!fs.existsSync(gitkeepPath)) {
        fs.writeFileSync(gitkeepPath, '');
      }
    });

    this.log('Project directories setup completed', 'success');
  }

  async validateSetup() {
    this.logStep('validateSetup');
    
    // Validate package.json
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      this.log(`Package: ${packageJson.name} v${packageJson.version}`, 'info');
    } catch (error) {
      throw new Error('Invalid package.json');
    }

    // Validate essential files exist
    const essentialFiles = [
      'package.json',
      'manifest.json',
      'rollup.config.js',
      '.env',
      '.gitignore'
    ];

    essentialFiles.forEach(file => {
      if (!fs.existsSync(file)) {
        throw new Error(`Missing essential file: ${file}`);
      }
    });

    // Check npm scripts
    try {
      await execAsync('npm run --silent');
      this.log('npm scripts validated', 'success');
    } catch (error) {
      this.log('Some npm scripts may have issues', 'warn');
    }

    this.log('Setup validation completed', 'success');
  }

  async runInitialBuild() {
    this.logStep('runInitialBuild');
    
    try {
      this.log('Running development build...', 'info');
      await execAsync('npm run build:dev');
      
      this.log('Build completed successfully', 'success');
      
      // Check if dist files were created
      const distFiles = ['manifest.json', 'src/background/service-worker.js'];
      const missingFiles = distFiles.filter(file => 
        !fs.existsSync(path.join('dist', file))
      );
      
      if (missingFiles.length > 0) {
        this.log(`Warning: Some build files are missing: ${missingFiles.join(', ')}`, 'warn');
      } else {
        this.log('All build files generated successfully', 'success');
      }
      
    } catch (error) {
      this.log(`Build failed: ${error.message}`, 'error');
      this.log('You may need to fix the build configuration manually', 'warn');
    }
  }

  generateSetupSummary() {
    console.log('\n🎉 DEVELOPMENT SETUP COMPLETE!');
    console.log('================================');
    console.log('\n📋 What\'s been set up:');
    console.log('  ✅ Dependencies installed');
    console.log('  ✅ Git hooks configured');
    console.log('  ✅ Environment file created');
    console.log('  ✅ Project directories created');
    console.log('  ✅ Initial build completed');
    
    console.log('\n🚀 Next Steps:');
    console.log('  1. Edit .env file with your configuration');
    console.log('  2. Start development server: npm run dev');
    console.log('  3. Open http://localhost:3000/dashboard');
    console.log('  4. Load extension in Chrome from dist/ folder');
    console.log('  5. Visit YouTube to test the extension');
    
    console.log('\n🛠️  Available Commands:');
    console.log('  npm run dev         - Start development with hot reload');
    console.log('  npm run build       - Production build');
    console.log('  npm run test        - Run tests');
    console.log('  npm run lint        - Check code quality'); 
    console.log('  npm run package     - Create extension package');
    console.log('  npm run analyze     - Analyze bundle size');
    console.log('  node security-scan  - Run security scan');
    
    console.log('\n📚 Documentation:');
    console.log('  • Installation Guide: INSTALLATION_GUIDE.md');
    console.log('  • Development: README.md');
    console.log('  • Dashboard: http://localhost:3000/dashboard');
    
    console.log('\n💡 Need Help?');
    console.log('  • Check the logs in the logs/ directory');
    console.log('  • Review the setup in package.json');
    console.log('  • Ensure all environment variables are set');
  }

  async run() {
    console.log('🚀 AstralTube Development Environment Setup');
    console.log('==========================================\n');
    
    try {
      await this.checkRequirements();
      await this.installDependencies();
      await this.setupGitHooks();
      await this.createEnvFile();
      await this.setupDirectories();
      await this.validateSetup();
      await this.runInitialBuild();
      
      this.generateSetupSummary();
      
    } catch (error) {
      this.log(`Setup failed: ${error.message}`, 'error');
      console.log('\n🔧 Troubleshooting:');
      console.log('  • Ensure you have Node.js 18+ and npm 9+ installed');
      console.log('  • Check your internet connection for dependency downloads');
      console.log('  • Verify you have write permissions in this directory');
      console.log('  • Run setup again after resolving issues');
      process.exit(1);
    }
  }
}

// Run setup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const setup = new DevSetup();
  setup.run();
}

export default DevSetup;