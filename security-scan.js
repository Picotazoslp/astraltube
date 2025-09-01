/**
 * AstralTube v3 - Security Scanner
 * Comprehensive security analysis for the extension
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

class SecurityScanner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      summary: {
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0,
        infoIssues: 0
      },
      checks: [],
      dependencies: {},
      manifest: {},
      sourceCode: {},
      recommendations: []
    };
  }

  log(message, level = 'info') {
    const icons = { info: 'ℹ️', warn: '⚠️', error: '❌', success: '✅' };
    console.log(`${icons[level]} ${message}`);
  }

  addIssue(type, severity, message, file = null, line = null) {
    this.results.checks.push({
      type,
      severity,
      message,
      file,
      line,
      timestamp: new Date().toISOString()
    });
    
    this.results.summary[`${severity}Issues`]++;
    
    if (severity === 'critical' || severity === 'high') {
      this.log(message, 'error');
    } else if (severity === 'medium') {
      this.log(message, 'warn');
    } else {
      this.log(message, 'info');
    }
  }

  async scanDependencies() {
    this.log('Scanning dependencies for vulnerabilities...');
    
    try {
      // Run npm audit
      const { stdout: auditOutput } = await execAsync('npm audit --json').catch(() => ({ stdout: '{}' }));
      const auditData = JSON.parse(auditOutput);
      
      if (auditData.vulnerabilities) {
        Object.entries(auditData.vulnerabilities).forEach(([pkg, vuln]) => {
          const severity = this.mapAuditSeverity(vuln.severity);
          this.addIssue(
            'dependency',
            severity,
            `Vulnerability in ${pkg}: ${vuln.title || 'Unknown vulnerability'}`,
            'package.json'
          );
        });
      }

      // Check for outdated packages
      const { stdout: outdatedOutput } = await execAsync('npm outdated --json').catch(() => ({ stdout: '{}' }));
      const outdatedData = JSON.parse(outdatedOutput);
      
      if (Object.keys(outdatedData).length > 0) {
        this.addIssue(
          'dependency',
          'low',
          `${Object.keys(outdatedData).length} packages are outdated`,
          'package.json'
        );
      }

      this.results.dependencies = {
        audit: auditData,
        outdated: outdatedData
      };
      
    } catch (error) {
      this.addIssue('dependency', 'medium', `Failed to scan dependencies: ${error.message}`);
    }
  }

  scanManifest() {
    this.log('Analyzing manifest.json security...');
    
    const manifestPath = path.join(__dirname, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      this.addIssue('manifest', 'high', 'manifest.json not found', 'manifest.json');
      return;
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      this.results.manifest = manifest;

      // Check CSP
      if (!manifest.content_security_policy) {
        this.addIssue('manifest', 'high', 'No Content Security Policy defined', 'manifest.json');
      } else {
        const csp = manifest.content_security_policy.extension_pages || '';
        
        if (csp.includes("'unsafe-eval'")) {
          this.addIssue('manifest', 'critical', "CSP allows 'unsafe-eval' - major security risk", 'manifest.json');
        }
        
        if (csp.includes("'unsafe-inline'")) {
          this.addIssue('manifest', 'high', "CSP allows 'unsafe-inline' - security risk", 'manifest.json');
        }
        
        if (csp.includes('*') && !csp.includes('chrome-extension:')) {
          this.addIssue('manifest', 'medium', 'CSP contains wildcard (*) - overly permissive', 'manifest.json');
        }
      }

      // Check permissions
      if (manifest.permissions) {
        const riskyPermissions = ['tabs', 'bookmarks', 'history', 'cookies', 'webNavigation'];
        const declaredRiskyPerms = manifest.permissions.filter(p => riskyPermissions.includes(p));
        
        if (declaredRiskyPerms.length > 0) {
          this.addIssue('manifest', 'medium', 
            `Requesting sensitive permissions: ${declaredRiskyPerms.join(', ')}`, 
            'manifest.json'
          );
        }

        if (manifest.permissions.includes('<all_urls>')) {
          this.addIssue('manifest', 'high', 'Requesting access to all URLs', 'manifest.json');
        }
      }

      // Check host permissions
      if (manifest.host_permissions) {
        const wildcardHosts = manifest.host_permissions.filter(h => h.includes('*'));
        if (wildcardHosts.length > 0) {
          this.addIssue('manifest', 'medium', 
            `Wildcard host permissions: ${wildcardHosts.join(', ')}`, 
            'manifest.json'
          );
        }
      }

      // Check web accessible resources
      if (manifest.web_accessible_resources) {
        manifest.web_accessible_resources.forEach(resource => {
          if (resource.resources.some(r => r.includes('*'))) {
            this.addIssue('manifest', 'medium', 
              'Web accessible resources use wildcards - potential data exposure', 
              'manifest.json'
            );
          }
        });
      }

    } catch (error) {
      this.addIssue('manifest', 'high', `Invalid manifest.json: ${error.message}`, 'manifest.json');
    }
  }

  scanSourceCode() {
    this.log('Scanning source code for security issues...');
    
    const srcDir = path.join(__dirname, 'src');
    if (!fs.existsSync(srcDir)) {
      this.addIssue('source', 'high', 'Source directory not found');
      return;
    }

    this.scanDirectory(srcDir);
  }

  scanDirectory(dirPath) {
    const entries = fs.readdirSync(dirPath);
    
    entries.forEach(entry => {
      const fullPath = path.join(dirPath, entry);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        this.scanDirectory(fullPath);
      } else if (entry.endsWith('.js') || entry.endsWith('.ts')) {
        this.scanFile(fullPath);
      }
    });
  }

  scanFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      const relativePath = path.relative(__dirname, filePath);

      // Security patterns to check
      const patterns = [
        {
          regex: /eval\s*\(/gi,
          severity: 'critical',
          message: 'Use of eval() - major security risk'
        },
        {
          regex: /innerHTML\s*=/gi,
          severity: 'high',
          message: 'Use of innerHTML - XSS risk'
        },
        {
          regex: /document\.write\s*\(/gi,
          severity: 'high',
          message: 'Use of document.write() - XSS risk'
        },
        {
          regex: /setTimeout\s*\(\s*[\"']/gi,
          severity: 'medium',
          message: 'setTimeout with string argument - avoid eval-like behavior'
        },
        {
          regex: /setInterval\s*\(\s*[\"']/gi,
          severity: 'medium',
          message: 'setInterval with string argument - avoid eval-like behavior'
        },
        {
          regex: /window\.open\s*\(/gi,
          severity: 'medium',
          message: 'Use of window.open() - potential security risk'
        },
        {
          regex: /\.postMessage\s*\(/gi,
          severity: 'low',
          message: 'Use of postMessage - ensure proper origin validation'
        },
        {
          regex: /localStorage\./gi,
          severity: 'info',
          message: 'Use of localStorage - ensure data sensitivity is appropriate'
        },
        {
          regex: /sessionStorage\./gi,
          severity: 'info',
          message: 'Use of sessionStorage - ensure data sensitivity is appropriate'
        },
        {
          regex: /console\.log\s*\(/gi,
          severity: 'info',
          message: 'Console logging - may expose sensitive information in production'
        },
        {
          regex: /fetch\s*\(/gi,
          severity: 'info',
          message: 'Network request - ensure HTTPS and proper validation'
        },
        {
          regex: /XMLHttpRequest/gi,
          severity: 'info',
          message: 'XMLHttpRequest - ensure HTTPS and proper validation'
        }
      ];

      patterns.forEach(pattern => {
        const matches = [...content.matchAll(pattern.regex)];
        matches.forEach(match => {
          const lineNumber = content.substring(0, match.index).split('\n').length;
          this.addIssue('source', pattern.severity, pattern.message, relativePath, lineNumber);
        });
      });

      // Check for hardcoded secrets
      const secretPatterns = [
        /api[_-]?key[_-]?=.{20,}/gi,
        /secret[_-]?key[_-]?=.{20,}/gi,
        /password[_-]?=.{8,}/gi,
        /token[_-]?=.{20,}/gi,
        /client[_-]?secret[_-]?=.{20,}/gi
      ];

      secretPatterns.forEach(pattern => {
        const matches = [...content.matchAll(pattern)];
        matches.forEach(match => {
          const lineNumber = content.substring(0, match.index).split('\n').length;
          this.addIssue('source', 'critical', 'Potential hardcoded secret detected', relativePath, lineNumber);
        });
      });

    } catch (error) {
      this.addIssue('source', 'medium', `Failed to scan ${filePath}: ${error.message}`);
    }
  }

  generateRecommendations() {
    this.log('Generating security recommendations...');

    const recommendations = [];

    if (this.results.summary.criticalIssues > 0) {
      recommendations.push({
        priority: 'critical',
        title: 'Fix Critical Security Issues',
        description: 'Address all critical security vulnerabilities before deployment',
        action: 'Review and fix all critical issues found in the scan'
      });
    }

    if (this.results.summary.highIssues > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Address High Priority Security Issues',
        description: 'Fix high priority security issues to reduce attack surface',
        action: 'Review and remediate high priority security findings'
      });
    }

    // CSP recommendations
    const cspIssues = this.results.checks.filter(c => c.type === 'manifest' && c.message.includes('CSP'));
    if (cspIssues.length > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Implement Strict Content Security Policy',
        description: 'Use a restrictive CSP to prevent XSS and code injection attacks',
        action: 'Remove unsafe-eval and unsafe-inline from CSP, use nonces or hashes instead'
      });
    }

    // Permission recommendations
    const permissionIssues = this.results.checks.filter(c => c.type === 'manifest' && c.message.includes('permissions'));
    if (permissionIssues.length > 0) {
      recommendations.push({
        priority: 'medium',
        title: 'Review Extension Permissions',
        description: 'Follow principle of least privilege for extension permissions',
        action: 'Remove unnecessary permissions and use host_permissions instead of broad permissions'
      });
    }

    // Code quality recommendations
    if (this.results.checks.some(c => c.message.includes('eval') || c.message.includes('innerHTML'))) {
      recommendations.push({
        priority: 'high',
        title: 'Eliminate Dangerous JavaScript Patterns',
        description: 'Replace dangerous JavaScript patterns with safer alternatives',
        action: 'Use textContent instead of innerHTML, avoid eval() and string-based timeouts'
      });
    }

    // General security recommendations
    recommendations.push(
      {
        priority: 'medium',
        title: 'Enable Security Headers',
        description: 'Implement security headers in web accessible resources',
        action: 'Add X-Frame-Options, X-Content-Type-Options headers where applicable'
      },
      {
        priority: 'low',
        title: 'Regular Security Audits',
        description: 'Perform regular security scans and dependency updates',
        action: 'Schedule weekly dependency audits and monthly security reviews'
      },
      {
        priority: 'low',
        title: 'Implement Input Validation',
        description: 'Validate and sanitize all user inputs and external data',
        action: 'Add input validation for all user-controlled data and API responses'
      }
    );

    this.results.recommendations = recommendations;
  }

  mapAuditSeverity(npmSeverity) {
    const mapping = {
      'critical': 'critical',
      'high': 'high',
      'moderate': 'medium',
      'low': 'low',
      'info': 'info'
    };
    return mapping[npmSeverity] || 'medium';
  }

  generateReport() {
    const reportDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    // JSON report
    const jsonReportPath = path.join(reportDir, 'security-report.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(this.results, null, 2));

    // HTML report
    const htmlReport = this.generateHtmlReport();
    const htmlReportPath = path.join(reportDir, 'security-report.html');
    fs.writeFileSync(htmlReportPath, htmlReport);

    // Console summary
    this.printSummary();

    this.log(`Security report generated: ${jsonReportPath}`, 'success');
    this.log(`HTML report: ${htmlReportPath}`, 'success');
  }

  generateHtmlReport() {
    const { summary, checks, recommendations } = this.results;
    
    const severityColors = {
      critical: '#d32f2f',
      high: '#f57c00',
      medium: '#fbc02d',
      low: '#388e3c',
      info: '#1976d2'
    };

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AstralTube Security Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
        .summary-number { font-size: 2.5em; font-weight: bold; margin-bottom: 10px; }
        .critical { color: #d32f2f; }
        .high { color: #f57c00; }
        .medium { color: #fbc02d; }
        .low { color: #388e3c; }
        .info { color: #1976d2; }
        .section { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .issue { padding: 15px; margin: 10px 0; border-left: 4px solid; border-radius: 4px; background: #f9f9f9; }
        .recommendation { padding: 20px; margin: 15px 0; border-radius: 8px; background: #f0f4ff; border: 1px solid #e3f2fd; }
        .priority-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.8em; font-weight: bold; color: white; margin-bottom: 10px; }
        .file-info { font-size: 0.9em; color: #666; margin-top: 5px; }
        .timestamp { color: #888; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛡️ AstralTube Security Report</h1>
        <p>Generated: ${new Date(this.results.timestamp).toLocaleString()}</p>
    </div>
    
    <div class="summary">
        <div class="summary-card">
            <div class="summary-number critical">${summary.criticalIssues}</div>
            <div>Critical</div>
        </div>
        <div class="summary-card">
            <div class="summary-number high">${summary.highIssues}</div>
            <div>High</div>
        </div>
        <div class="summary-card">
            <div class="summary-number medium">${summary.mediumIssues}</div>
            <div>Medium</div>
        </div>
        <div class="summary-card">
            <div class="summary-number low">${summary.lowIssues}</div>
            <div>Low</div>
        </div>
        <div class="summary-card">
            <div class="summary-number info">${summary.infoIssues}</div>
            <div>Info</div>
        </div>
    </div>
    
    <div class="section">
        <h2>🔍 Security Issues</h2>
        ${checks.map(issue => `
            <div class="issue" style="border-left-color: ${severityColors[issue.severity]}">
                <div class="severity-badge" style="background: ${severityColors[issue.severity]}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; display: inline-block; margin-bottom: 8px;">
                    ${issue.severity.toUpperCase()}
                </div>
                <div><strong>${issue.type.toUpperCase()}:</strong> ${issue.message}</div>
                ${issue.file ? `<div class="file-info">📁 ${issue.file}${issue.line ? `:${issue.line}` : ''}</div>` : ''}
            </div>
        `).join('')}
    </div>
    
    <div class="section">
        <h2>💡 Recommendations</h2>
        ${recommendations.map(rec => `
            <div class="recommendation">
                <span class="priority-badge" style="background: ${severityColors[rec.priority]}">${rec.priority.toUpperCase()}</span>
                <h3>${rec.title}</h3>
                <p>${rec.description}</p>
                <p><strong>Action:</strong> ${rec.action}</p>
            </div>
        `).join('')}
    </div>
    
    <div class="section">
        <h2>📊 Scan Details</h2>
        <p><strong>Total Issues:</strong> ${checks.length}</p>
        <p><strong>Scanned Areas:</strong> Dependencies, Manifest, Source Code</p>
        <p><strong>Scan Duration:</strong> ${new Date().toISOString()}</p>
    </div>
</body>
</html>`;
  }

  printSummary() {
    const { summary } = this.results;
    
    console.log('\n🛡️  SECURITY SCAN SUMMARY');
    console.log('================================');
    console.log(`❌ Critical: ${summary.criticalIssues}`);
    console.log(`🔥 High:     ${summary.highIssues}`);
    console.log(`⚠️  Medium:  ${summary.mediumIssues}`);
    console.log(`💛 Low:      ${summary.lowIssues}`);
    console.log(`ℹ️  Info:    ${summary.infoIssues}`);
    console.log('================================');
    
    const totalIssues = summary.criticalIssues + summary.highIssues + summary.mediumIssues + summary.lowIssues + summary.infoIssues;
    console.log(`📊 Total Issues: ${totalIssues}`);
    
    if (summary.criticalIssues > 0) {
      console.log('\n🚨 CRITICAL ISSUES FOUND - IMMEDIATE ACTION REQUIRED!');
      process.exit(1);
    } else if (summary.highIssues > 0) {
      console.log('\n⚠️  HIGH PRIORITY ISSUES FOUND - REVIEW BEFORE DEPLOYMENT');
    } else {
      console.log('\n✅ No critical or high priority security issues found');
    }
  }

  async run() {
    console.log('🛡️  Starting AstralTube Security Scan...\n');
    
    await this.scanDependencies();
    this.scanManifest();
    this.scanSourceCode();
    this.generateRecommendations();
    this.generateReport();
    
    console.log('\n🏁 Security scan complete!');
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const scanner = new SecurityScanner();
  scanner.run().catch(error => {
    console.error('Security scan failed:', error);
    process.exit(1);
  });
}

export default SecurityScanner;