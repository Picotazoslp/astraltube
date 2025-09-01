# AstralTube v3 - Build System Documentation

This document provides comprehensive information about the modern build system, CI/CD pipeline, and deployment processes for AstralTube.

## 🏗️ Build System Architecture

### Core Components

- **Rollup**: Modern bundler with advanced code splitting and optimization
- **Babel**: JavaScript transpilation for browser compatibility
- **PostCSS**: CSS processing with autoprefixer and nested support
- **ESLint + Prettier**: Code quality and formatting
- **Jest**: Testing framework with coverage reporting
- **Husky**: Git hooks for quality gates

### Build Configurations

#### Development Build
```bash
npm run build:dev
```
- Source maps enabled (inline)
- No minification
- Development-friendly CSP
- Hot reload support

#### Production Build  
```bash
npm run build
```
- Code minification and optimization
- Source maps hidden
- Strict CSP
- Bundle analysis

#### Watch Mode
```bash
npm run build:watch
```
- Automatic rebuilds on file changes
- Fast incremental compilation
- Live reload integration

## 🚀 Development Workflow

### Quick Start
```bash
# Setup development environment
npm run setup

# Start development server
npm run dev

# Open development dashboard
open http://localhost:3000/dashboard
```

### Development Server Features

- **Hot Reload**: Automatic extension reloading on code changes
- **Development Dashboard**: Real-time build status and analytics  
- **Proxy Support**: YouTube API proxying for development
- **Bundle Analysis**: Live bundle size monitoring
- **Health Checks**: Server and build status endpoints

### Available Commands

```bash
# Development
npm run dev              # Start development with hot reload
npm run serve           # Start development server only  
npm run build:watch     # Watch mode building

# Building
npm run build           # Production build
npm run build:dev       # Development build
npm run clean           # Clean build artifacts

# Testing
npm run test            # Run tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report
npm run test:ci         # CI-optimized test run

# Code Quality
npm run lint            # Check code quality
npm run lint:fix        # Fix code quality issues
npm run format          # Format code with Prettier
npm run format:check    # Check code formatting
npm run validate        # Full quality check (lint + test + build)

# Analysis
npm run analyze         # Bundle size analysis
npm run security        # Security vulnerability scan
npm run deps:check      # Check for outdated dependencies

# Packaging
npm run package         # Create Chrome Web Store package
npm run package:dev     # Create development package

# Release Management
npm run release         # Create new release (patch)
npm run release:minor   # Minor version release
npm run release:major   # Major version release
npm run release:dry     # Dry run release (no changes)
```

## 🔧 Configuration Files

### Build Configuration
- `rollup.config.js` - Main build configuration with code splitting
- `package.json` - Dependencies and scripts
- `babel.config.js` - JavaScript transpilation rules
- `postcss.config.js` - CSS processing configuration

### Quality Gates
- `.eslintrc.js` - Code linting rules
- `.prettierrc` - Code formatting rules
- `jest.config.js` - Test configuration
- `.lintstagedrc.js` - Pre-commit lint rules

### CI/CD Pipeline
- `.github/workflows/ci-cd.yml` - GitHub Actions workflow
- `security-scan.js` - Security analysis tool
- `package.js` - Chrome Web Store packaging
- `release.js` - Release management automation

## 🏭 CI/CD Pipeline

### Workflow Stages

1. **Quality Checks**
   - ESLint code analysis
   - Prettier formatting check
   - TypeScript type checking
   - Security audit

2. **Testing**
   - Unit tests with Jest
   - Coverage reporting
   - Multi-Node.js version testing

3. **Building**
   - Production build creation
   - Bundle analysis
   - Extension packaging

4. **Chrome Extension Tests**
   - Manifest validation
   - Extension loading tests
   - Required file checks

5. **Security Scanning**
   - Dependency vulnerability scan
   - CodeQL security analysis
   - SARIF reporting

6. **Deployment**
   - Chrome Web Store deployment
   - GitHub release creation
   - Automated changelog generation

### Environment Variables

```bash
# Chrome Web Store API
CHROME_CLIENT_ID=your_client_id
CHROME_CLIENT_SECRET=your_client_secret  
CHROME_REFRESH_TOKEN=your_refresh_token
CHROME_EXTENSION_ID=your_extension_id

# Security Scanning
SNYK_TOKEN=your_snyk_token

# GitHub Releases
GITHUB_TOKEN=your_github_token
```

## 📦 Package Management

### Chrome Web Store Packaging

The `package.js` script provides comprehensive packaging with:

- **Build Validation**: Manifest and file structure checks
- **Checksum Generation**: SHA256 integrity verification  
- **ZIP Creation**: Optimized compression
- **Automated Upload**: Chrome Web Store API integration
- **Publishing**: Automated publishing workflow

```bash
# Basic packaging
npm run package

# Development package
npm run package:dev

# Package with deployment
npm run package -- --deploy

# Skip validation (not recommended)
npm run package -- --skip-validation
```

### Package Features

- Manifest validation and cleanup
- Development artifact detection
- File size validation and warnings
- Comprehensive reporting
- Chrome Web Store API integration
- Rollback support on failure

## 🔒 Security & Quality

### Security Scanning

The `security-scan.js` tool performs comprehensive security analysis:

- **Dependency Scanning**: npm audit integration
- **Manifest Analysis**: CSP and permissions review
- **Source Code Analysis**: Dangerous pattern detection
- **Secret Detection**: Hardcoded credentials search
- **Recommendation Engine**: Automated fix suggestions

```bash
# Run security scan
npm run security

# Generate security report
node security-scan.js
```

### Pre-commit Hooks

Quality gates enforced before each commit:

- Code linting and formatting
- Security audit check
- Type checking (if TypeScript present)
- Build validation
- Test execution

### Code Quality Standards

- **ESLint**: Strict linting with Chrome extension rules
- **Prettier**: Consistent code formatting
- **Jest**: Minimum 80% test coverage
- **Security**: Automatic vulnerability detection

## 🚀 Deployment

### Automated Deployment

Deployment is triggered automatically when:

- Release is published on GitHub
- Commit message contains `[release]`
- Manual workflow dispatch

### Chrome Web Store Deployment

1. **Build Creation**: Optimized production build
2. **Package Generation**: ZIP file with validation
3. **Upload**: Chrome Web Store API upload
4. **Publishing**: Automated publishing (optional)
5. **Verification**: Deployment status reporting

### Release Management

The `release.js` script automates the entire release process:

```bash
# Patch release (bug fixes)
npm run release:patch

# Minor release (new features)
npm run release:minor  

# Major release (breaking changes)
npm run release:major

# Dry run (test without changes)
npm run release:dry
```

Release process includes:

1. **Pre-release Checks**: Tests and build validation
2. **Version Bumping**: Semantic versioning
3. **Changelog Generation**: Conventional commits parsing
4. **Git Operations**: Tagging and pushing
5. **GitHub Release**: Automated release creation
6. **Extension Packaging**: Chrome Web Store preparation

## 🛠️ Development Tools

### Bundle Analysis

Comprehensive bundle analysis with:

- File size breakdown
- Compression ratios  
- Performance recommendations
- Dependency analysis
- Historical tracking

```bash
# Analyze current build
npm run analyze

# Development build analysis  
npm run analyze:dev
```

### Development Dashboard

Real-time development insights at `http://localhost:3000/dashboard`:

- **Health Monitoring**: Server and build status
- **Bundle Analysis**: Live size tracking
- **Build Status**: Real-time build information
- **Quick Links**: Extension management shortcuts

### Hot Reload System

Advanced hot reload with:

- **File Watching**: Source code change detection
- **WebSocket Communication**: Real-time notifications
- **Extension Reloading**: Automatic Chrome extension reload
- **Error Handling**: Graceful failure recovery

## 📊 Monitoring & Analytics

### Build Analytics

- Bundle size tracking over time
- Performance metrics collection
- Build duration monitoring
- Error rate tracking

### Security Monitoring

- Vulnerability scanning schedule
- Security report archival
- Compliance checking
- Threat intelligence integration

### Performance Metrics

- Extension load times
- Bundle optimization scores
- Code quality metrics
- Test coverage trends

## 🔧 Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Clean and rebuild
   npm run clean
   npm install
   npm run build
   ```

2. **Dependency Issues**
   ```bash
   # Update dependencies
   npm run deps:update
   npm audit fix
   ```

3. **Hot Reload Not Working**
   ```bash
   # Check development server
   npm run serve
   # Verify WebSocket connection at :35729
   ```

4. **Extension Loading Issues**
   ```bash
   # Validate manifest
   npm run validate:manifest
   # Check required files
   npm run validate
   ```

### Debug Mode

Enable comprehensive debugging:

```bash
# Set debug environment
NODE_ENV=development DEBUG=* npm run dev
```

### Log Analysis

Check logs for detailed information:

- `logs/build.log` - Build process logs
- `logs/dev-server.log` - Development server logs  
- `logs/security.log` - Security scan results
- `reports/` - Analysis and validation reports

## 📚 Additional Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Chrome Web Store API](https://developer.chrome.com/docs/webstore/using_webstore_api/)
- [Rollup Configuration Guide](https://rollupjs.org/guide/en/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

This build system provides a comprehensive, production-ready development environment with automated quality gates, security scanning, and deployment capabilities. For questions or issues, please refer to the troubleshooting section or create an issue in the repository.