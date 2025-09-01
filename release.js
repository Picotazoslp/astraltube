/**
 * AstralTube v3 - Release Management System
 * Automated versioning, changelog generation, and release preparation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

class ReleaseManager {
  constructor(options = {}) {
    this.releaseType = options.type || this.parseReleaseType();
    this.isDryRun = options.dryRun || process.argv.includes('--dry-run');
    this.skipTests = options.skipTests || process.argv.includes('--skip-tests');
    this.skipBuild = options.skipBuild || process.argv.includes('--skip-build');
    this.autoPublish = options.autoPublish || process.argv.includes('--publish');
    
    this.packageJsonPath = path.join(__dirname, 'package.json');
    this.manifestPath = path.join(__dirname, 'manifest.json');
    this.changelogPath = path.join(__dirname, 'CHANGELOG.md');
    
    this.currentVersion = null;
    this.newVersion = null;
    this.changelog = null;
  }

  parseReleaseType() {
    const args = process.argv.slice(2);
    const typeArg = args.find(arg => ['patch', 'minor', 'major', 'prerelease'].includes(arg));
    return typeArg || 'patch';
  }

  log(message, level = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const icons = { info: 'ℹ️', warn: '⚠️', error: '❌', success: '✅' };
    console.log(`[${timestamp}] ${icons[level]} ${message}`);
  }

  async init() {
    this.log('Initializing release management...');
    
    // Verify git repository
    try {
      await execAsync('git rev-parse --git-dir');
    } catch (error) {
      throw new Error('Not in a git repository');
    }

    // Check for uncommitted changes
    const { stdout: gitStatus } = await execAsync('git status --porcelain');
    if (gitStatus.trim() && !this.isDryRun) {
      throw new Error('Working directory is not clean. Commit or stash changes first.');
    }

    // Load current version
    const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
    this.currentVersion = packageJson.version;
    
    this.log(`Current version: ${this.currentVersion}`, 'info');
    this.log(`Release type: ${this.releaseType}`, 'info');
    this.log(`Dry run: ${this.isDryRun}`, 'info');
  }

  incrementVersion(version, type) {
    const parts = version.split('.');
    const [major, minor, patch] = parts.map(Number);

    switch (type) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
      case 'prerelease':
        return `${major}.${minor}.${patch + 1}-beta.${Date.now()}`;
      default:
        throw new Error(`Unknown release type: ${type}`);
    }
  }

  async generateChangelog() {
    this.log('Generating changelog...');
    
    try {
      // Get the last tag
      const { stdout: lastTag } = await execAsync('git describe --tags --abbrev=0').catch(() => ({ stdout: '' }));
      const since = lastTag.trim() || 'HEAD';
      
      // Get commits since last tag
      const { stdout: commits } = await execAsync(
        `git log ${since === 'HEAD' ? '' : since + '..'}HEAD --pretty=format:"%h|%s|%an|%ad" --date=short`
      );

      if (!commits.trim()) {
        this.log('No new commits found', 'warn');
        return null;
      }

      const commitLines = commits.trim().split('\n');
      const changelog = {
        version: this.newVersion,
        date: new Date().toISOString().split('T')[0],
        sections: {
          features: [],
          fixes: [],
          improvements: [],
          breaking: [],
          other: []
        }
      };

      // Parse commits using conventional commit format
      commitLines.forEach(line => {
        const [hash, message, author, date] = line.split('|');
        const commit = { hash: hash.substring(0, 7), message, author, date };

        if (message.startsWith('feat:') || message.startsWith('feat(')) {
          commit.message = message.replace(/^feat(\([^)]+\))?:\s*/, '');
          changelog.sections.features.push(commit);
        } else if (message.startsWith('fix:') || message.startsWith('fix(')) {
          commit.message = message.replace(/^fix(\([^)]+\))?:\s*/, '');
          changelog.sections.fixes.push(commit);
        } else if (message.startsWith('perf:') || message.startsWith('refactor:') || message.startsWith('style:')) {
          commit.message = message.replace(/^(perf|refactor|style)(\([^)]+\))?:\s*/, '');
          changelog.sections.improvements.push(commit);
        } else if (message.includes('BREAKING CHANGE') || message.includes('!:')) {
          commit.message = message.replace(/^[^:]+!?:\s*/, '');
          changelog.sections.breaking.push(commit);
        } else if (!message.startsWith('chore:') && !message.startsWith('docs:') && !message.startsWith('test:')) {
          changelog.sections.other.push(commit);
        }
      });

      this.changelog = changelog;
      return changelog;
    } catch (error) {
      this.log(`Failed to generate changelog: ${error.message}`, 'error');
      return null;
    }
  }

  formatChangelogMarkdown(changelog) {
    if (!changelog) return '';

    let markdown = `## [${changelog.version}] - ${changelog.date}\n\n`;

    const sections = [
      { key: 'breaking', title: '⚠️ BREAKING CHANGES', icon: '💥' },
      { key: 'features', title: '✨ New Features', icon: '🚀' },
      { key: 'fixes', title: '🐛 Bug Fixes', icon: '🔧' },
      { key: 'improvements', title: '📈 Improvements', icon: '⚡' },
      { key: 'other', title: '📝 Other Changes', icon: '📋' }
    ];

    sections.forEach(section => {
      const items = changelog.sections[section.key];
      if (items.length > 0) {
        markdown += `### ${section.title}\n\n`;
        items.forEach(item => {
          markdown += `- ${item.message} ([${item.hash}](../../commit/${item.hash}))\n`;
        });
        markdown += '\n';
      }
    });

    return markdown;
  }

  async updateVersionFiles() {
    this.log(`Updating version files to ${this.newVersion}...`);

    if (this.isDryRun) {
      this.log('Dry run: Would update package.json and manifest.json', 'info');
      return;
    }

    // Update package.json
    const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
    packageJson.version = this.newVersion;
    fs.writeFileSync(this.packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

    // Update manifest.json
    if (fs.existsSync(this.manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(this.manifestPath, 'utf8'));
      manifest.version = this.newVersion;
      fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    }

    this.log('Version files updated successfully', 'success');
  }

  async updateChangelog() {
    if (!this.changelog) {
      this.log('No changelog to update', 'warn');
      return;
    }

    this.log('Updating CHANGELOG.md...');

    const newChangelogContent = this.formatChangelogMarkdown(this.changelog);
    
    if (this.isDryRun) {
      this.log('Dry run: Would add the following to CHANGELOG.md:', 'info');
      console.log(newChangelogContent);
      return;
    }

    let existingChangelog = '';
    if (fs.existsSync(this.changelogPath)) {
      existingChangelog = fs.readFileSync(this.changelogPath, 'utf8');
    } else {
      existingChangelog = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';
    }

    // Insert new changelog at the beginning
    const lines = existingChangelog.split('\n');
    const headerEndIndex = lines.findIndex((line, index) => index > 0 && line.startsWith('## '));
    
    if (headerEndIndex === -1) {
      // No existing releases, add after header
      const headerLines = lines.slice(0, 4);
      const updatedChangelog = [...headerLines, newChangelogContent, ...lines.slice(4)].join('\n');
      fs.writeFileSync(this.changelogPath, updatedChangelog);
    } else {
      // Insert before first release
      const beforeRelease = lines.slice(0, headerEndIndex);
      const afterRelease = lines.slice(headerEndIndex);
      const updatedChangelog = [...beforeRelease, newChangelogContent, ...afterRelease].join('\n');
      fs.writeFileSync(this.changelogPath, updatedChangelog);
    }

    this.log('CHANGELOG.md updated successfully', 'success');
  }

  async runTests() {
    if (this.skipTests) {
      this.log('Skipping tests', 'warn');
      return;
    }

    this.log('Running tests...');
    
    try {
      await execAsync('npm run test:ci');
      this.log('Tests passed', 'success');
    } catch (error) {
      throw new Error(`Tests failed: ${error.message}`);
    }
  }

  async runBuild() {
    if (this.skipBuild) {
      this.log('Skipping build', 'warn');
      return;
    }

    this.log('Running production build...');
    
    try {
      await execAsync('npm run build');
      this.log('Build completed successfully', 'success');
    } catch (error) {
      throw new Error(`Build failed: ${error.message}`);
    }
  }

  async createGitTag() {
    this.log(`Creating git tag v${this.newVersion}...`);

    if (this.isDryRun) {
      this.log('Dry run: Would create git tag and commit', 'info');
      return;
    }

    try {
      // Stage version files
      await execAsync(`git add ${this.packageJsonPath} ${this.manifestPath} ${this.changelogPath}`);
      
      // Commit version bump
      const commitMessage = `chore(release): bump version to ${this.newVersion}\n\n[skip ci]`;
      await execAsync(`git commit -m "${commitMessage}"`);
      
      // Create tag
      const tagMessage = `Release v${this.newVersion}\n\n${this.changelog ? this.formatChangelogMarkdown(this.changelog) : 'Release notes not available'}`;
      await execAsync(`git tag -a v${this.newVersion} -m "${tagMessage}"`);
      
      this.log(`Git tag v${this.newVersion} created`, 'success');
    } catch (error) {
      throw new Error(`Failed to create git tag: ${error.message}`);
    }
  }

  async pushRelease() {
    this.log('Pushing release to remote...');

    if (this.isDryRun) {
      this.log('Dry run: Would push commits and tags to remote', 'info');
      return;
    }

    try {
      await execAsync('git push origin main --follow-tags');
      this.log('Release pushed to remote', 'success');
    } catch (error) {
      throw new Error(`Failed to push release: ${error.message}`);
    }
  }

  async createGitHubRelease() {
    if (!this.autoPublish) {
      this.log('Skipping GitHub release creation (use --publish to enable)', 'info');
      return;
    }

    this.log('Creating GitHub release...');

    if (this.isDryRun) {
      this.log('Dry run: Would create GitHub release', 'info');
      return;
    }

    try {
      const releaseNotes = this.changelog ? this.formatChangelogMarkdown(this.changelog) : '';
      const isPrerelease = this.releaseType === 'prerelease';
      
      await execAsync(`gh release create v${this.newVersion} --title "AstralTube v${this.newVersion}" --notes "${releaseNotes}" ${isPrerelease ? '--prerelease' : ''}`);
      
      this.log('GitHub release created', 'success');
    } catch (error) {
      this.log(`Failed to create GitHub release: ${error.message}`, 'error');
      this.log('You can create the release manually after the script completes', 'info');
    }
  }

  async packageExtension() {
    this.log('Creating extension package...');
    
    try {
      await execAsync('npm run package');
      this.log('Extension packaged successfully', 'success');
    } catch (error) {
      this.log(`Failed to package extension: ${error.message}`, 'error');
    }
  }

  generateReleaseSummary() {
    console.log('\n🎉 RELEASE SUMMARY');
    console.log('==================');
    console.log(`Version: ${this.currentVersion} → ${this.newVersion}`);
    console.log(`Type: ${this.releaseType}`);
    console.log(`Dry Run: ${this.isDryRun}`);
    
    if (this.changelog) {
      console.log('\n📋 Changes:');
      Object.entries(this.changelog.sections).forEach(([key, items]) => {
        if (items.length > 0) {
          console.log(`  ${key}: ${items.length} changes`);
        }
      });
    }
    
    console.log('\n🔗 Next Steps:');
    console.log('1. Verify the release on GitHub');
    console.log('2. Monitor the CI/CD pipeline');
    console.log('3. Check Chrome Web Store deployment (if configured)');
    console.log('4. Announce the release to users');
  }

  async run() {
    try {
      await this.init();
      
      // Calculate new version
      this.newVersion = this.incrementVersion(this.currentVersion, this.releaseType);
      this.log(`New version will be: ${this.newVersion}`, 'info');
      
      // Pre-release checks
      await this.runTests();
      await this.runBuild();
      
      // Generate changelog
      await this.generateChangelog();
      
      // Update files
      await this.updateVersionFiles();
      await this.updateChangelog();
      
      // Git operations
      await this.createGitTag();
      await this.pushRelease();
      
      // Post-release tasks
      await this.createGitHubRelease();
      await this.packageExtension();
      
      // Summary
      this.generateReleaseSummary();
      
      if (!this.isDryRun) {
        this.log(`Release ${this.newVersion} completed successfully!`, 'success');
      } else {
        this.log('Dry run completed. Use without --dry-run to execute the release', 'info');
      }
      
    } catch (error) {
      this.log(`Release failed: ${error.message}`, 'error');
      
      if (!this.isDryRun) {
        this.log('Attempting to rollback changes...', 'warn');
        try {
          await execAsync('git reset --hard HEAD~1');
          await execAsync(`git tag -d v${this.newVersion}`);
          this.log('Rollback successful', 'success');
        } catch (rollbackError) {
          this.log(`Rollback failed: ${rollbackError.message}`, 'error');
          this.log('Manual cleanup may be required', 'warn');
        }
      }
      
      process.exit(1);
    }
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const releaseManager = new ReleaseManager();
  releaseManager.run();
}

export default ReleaseManager;