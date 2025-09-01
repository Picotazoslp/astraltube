/**
 * AstralTube v3 - Bundle Analysis Tool
 * Comprehensive bundle size analysis and optimization recommendations
 */

import fs from 'fs';
import path from 'path';
import { gzipSync } from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BundleAnalyzer {
  constructor() {
    this.distDir = path.join(__dirname, 'dist');
    this.analysisDir = path.join(this.distDir, 'analysis');
    this.results = {
      timestamp: new Date().toISOString(),
      totalSize: 0,
      gzippedSize: 0,
      files: [],
      recommendations: [],
      performance: {},
      security: {}
    };
  }

  init() {
    if (!fs.existsSync(this.distDir)) {
      throw new Error('❌ No dist directory found. Run build first.');
    }

    if (!fs.existsSync(this.analysisDir)) {
      fs.mkdirSync(this.analysisDir, { recursive: true });
    }

    console.log('🔍 Analyzing bundle...');
  }

  analyzeFile(filePath, relativePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const gzipped = gzipSync(Buffer.from(content));
    
    const fileAnalysis = {
      path: relativePath,
      size: Buffer.byteLength(content),
      gzippedSize: gzipped.length,
      compressionRatio: (gzipped.length / Buffer.byteLength(content) * 100).toFixed(1),
      type: this.getFileType(relativePath),
      lines: content.split('\n').length,
      dependencies: this.extractDependencies(content),
      performance: this.analyzePerformance(content, relativePath),
      security: this.analyzeSecurity(content, relativePath)
    };

    this.results.totalSize += fileAnalysis.size;
    this.results.gzippedSize += fileAnalysis.gzippedSize;
    
    return fileAnalysis;
  }

  getFileType(filePath) {
    const ext = path.extname(filePath);
    const typeMap = {
      '.js': 'javascript',
      '.json': 'json',
      '.html': 'html',
      '.css': 'css',
      '.png': 'image',
      '.jpg': 'image',
      '.jpeg': 'image',
      '.svg': 'vector',
      '.md': 'markdown'
    };
    return typeMap[ext] || 'other';
  }

  extractDependencies(content) {
    const dependencies = [];
    
    // Extract ES6 imports
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      dependencies.push({
        type: 'import',
        module: match[1]
      });
    }

    // Extract Chrome API usage
    const chromeApiRegex = /chrome\.(\w+)/g;
    while ((match = chromeApiRegex.exec(content)) !== null) {
      dependencies.push({
        type: 'chrome-api',
        api: match[1]
      });
    }

    return dependencies;
  }

  analyzePerformance(content, filePath) {
    const issues = [];
    
    // Check for potential performance issues
    if (content.includes('document.querySelector')) {
      issues.push('Use of querySelector - consider caching selectors');
    }
    
    if (content.includes('setInterval') || content.includes('setTimeout')) {
      issues.push('Use of timers - ensure proper cleanup');
    }
    
    if (content.includes('addEventListener')) {
      issues.push('Event listeners detected - ensure proper removal');
    }
    
    if (content.match(/for\s*\(/g)) {
      const loops = content.match(/for\s*\(/g).length;
      if (loops > 5) {
        issues.push(`High number of loops (${loops}) - consider optimization`);
      }
    }
    
    // Check file size
    const size = Buffer.byteLength(content);
    if (size > 100000) { // 100KB
      issues.push('Large file size - consider code splitting');
    }

    return {
      score: Math.max(0, 100 - issues.length * 10),
      issues
    };
  }

  analyzeSecurity(content, filePath) {
    const issues = [];
    
    // Check for potential security issues
    if (content.includes('eval(') || content.includes('new Function(')) {
      issues.push('Use of eval() or Function() constructor - security risk');
    }
    
    if (content.includes('innerHTML') && !filePath.includes('content-script')) {
      issues.push('Use of innerHTML - potential XSS risk');
    }
    
    if (content.includes('document.write')) {
      issues.push('Use of document.write - security and performance risk');
    }
    
    if (content.match(/https?:\/\/[^"'\s]+/g)) {
      const urls = content.match(/https?:\/\/[^"'\s]+/g);
      issues.push(`Hardcoded URLs found (${urls.length}) - consider configuration`);
    }

    return {
      score: Math.max(0, 100 - issues.length * 20),
      issues
    };
  }

  generateRecommendations() {
    console.log('💡 Generating recommendations...');
    
    const jsFiles = this.results.files.filter(f => f.type === 'javascript');
    const largeFiles = this.results.files.filter(f => f.size > 50000); // 50KB
    const lowCompression = this.results.files.filter(f => f.compressionRatio > 70);
    
    // Size recommendations
    if (this.results.totalSize > 500000) { // 500KB
      this.results.recommendations.push({
        type: 'size',
        priority: 'high',
        message: 'Total bundle size exceeds 500KB - consider code splitting and lazy loading'
      });
    }
    
    if (largeFiles.length > 0) {
      this.results.recommendations.push({
        type: 'size',
        priority: 'medium',
        message: `Large files detected: ${largeFiles.map(f => f.path).join(', ')} - consider breaking them down`
      });
    }
    
    // Compression recommendations
    if (lowCompression.length > 0) {
      this.results.recommendations.push({
        type: 'compression',
        priority: 'low',
        message: `Files with poor compression: ${lowCompression.map(f => f.path).join(', ')} - consider minification`
      });
    }
    
    // Performance recommendations
    const performanceIssues = jsFiles.reduce((acc, file) => acc + file.performance.issues.length, 0);
    if (performanceIssues > 10) {
      this.results.recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: `${performanceIssues} performance issues detected - review and optimize`
      });
    }
    
    // Security recommendations
    const securityIssues = jsFiles.reduce((acc, file) => acc + file.security.issues.length, 0);
    if (securityIssues > 0) {
      this.results.recommendations.push({
        type: 'security',
        priority: 'high',
        message: `${securityIssues} security issues detected - immediate review required`
      });
    }
  }

  walkDirectory(dir) {
    const files = [];
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && item !== 'analysis') {
        files.push(...this.walkDirectory(fullPath));
      } else if (stat.isFile()) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  generateSizeChart() {
    const chartData = this.results.files
      .filter(f => f.size > 1000) // Only files > 1KB
      .sort((a, b) => b.size - a.size)
      .slice(0, 20) // Top 20 files
      .map(f => ({
        file: path.basename(f.path),
        size: Math.round(f.size / 1024), // KB
        gzipped: Math.round(f.gzippedSize / 1024) // KB
      }));

    return chartData;
  }

  generateReport() {
    const report = {
      summary: {
        totalFiles: this.results.files.length,
        totalSize: `${Math.round(this.results.totalSize / 1024)} KB`,
        gzippedSize: `${Math.round(this.results.gzippedSize / 1024)} KB`,
        compressionRatio: `${Math.round(this.results.gzippedSize / this.results.totalSize * 100)}%`,
        timestamp: this.results.timestamp
      },
      breakdown: {
        javascript: this.results.files.filter(f => f.type === 'javascript').length,
        html: this.results.files.filter(f => f.type === 'html').length,
        css: this.results.files.filter(f => f.type === 'css').length,
        images: this.results.files.filter(f => f.type === 'image').length,
        other: this.results.files.filter(f => !['javascript', 'html', 'css', 'image'].includes(f.type)).length
      },
      performance: {
        averageScore: Math.round(
          this.results.files.reduce((acc, f) => acc + (f.performance?.score || 0), 0) / 
          this.results.files.length
        ),
        totalIssues: this.results.files.reduce((acc, f) => acc + (f.performance?.issues.length || 0), 0)
      },
      security: {
        averageScore: Math.round(
          this.results.files.reduce((acc, f) => acc + (f.security?.score || 0), 0) / 
          this.results.files.length
        ),
        totalIssues: this.results.files.reduce((acc, f) => acc + (f.security?.issues.length || 0), 0)
      },
      recommendations: this.results.recommendations,
      topFiles: this.generateSizeChart()
    };

    return report;
  }

  async analyze() {
    try {
      this.init();
      
      const allFiles = this.walkDirectory(this.distDir);
      
      console.log(`📊 Analyzing ${allFiles.length} files...`);
      
      for (const filePath of allFiles) {
        const relativePath = path.relative(this.distDir, filePath);
        try {
          const fileAnalysis = this.analyzeFile(filePath, relativePath);
          this.results.files.push(fileAnalysis);
        } catch (error) {
          console.warn(`⚠️ Could not analyze ${relativePath}: ${error.message}`);
        }
      }
      
      this.generateRecommendations();
      const report = this.generateReport();
      
      // Save detailed results
      const detailedPath = path.join(this.analysisDir, 'bundle-analysis-detailed.json');
      fs.writeFileSync(detailedPath, JSON.stringify(this.results, null, 2));
      
      // Save summary report
      const reportPath = path.join(this.analysisDir, 'bundle-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      
      // Display results
      console.log('\n📊 Bundle Analysis Results');
      console.log('═'.repeat(50));
      console.log(`📁 Total files: ${report.summary.totalFiles}`);
      console.log(`📦 Total size: ${report.summary.totalSize}`);
      console.log(`🗜️  Gzipped size: ${report.summary.gzippedSize}`);
      console.log(`📉 Compression ratio: ${report.summary.compressionRatio}`);
      console.log(`⚡ Performance score: ${report.performance.averageScore}/100`);
      console.log(`🔒 Security score: ${report.security.averageScore}/100`);
      
      if (report.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        report.recommendations.forEach((rec, i) => {
          const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
          console.log(`   ${i + 1}. ${priority} ${rec.message}`);
        });
      }
      
      console.log('\n📊 Top files by size:');
      report.topFiles.slice(0, 5).forEach((file, i) => {
        console.log(`   ${i + 1}. ${file.file}: ${file.size} KB (${file.gzipped} KB gzipped)`);
      });
      
      console.log(`\n📋 Detailed analysis saved to: ${path.basename(detailedPath)}`);
      console.log(`📋 Summary report saved to: ${path.basename(reportPath)}`);
      
      return report;
      
    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      process.exit(1);
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const analyzer = new BundleAnalyzer();
  analyzer.analyze();
}

export default BundleAnalyzer;