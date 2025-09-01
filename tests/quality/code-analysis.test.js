/**
 * AstralTube v3 - Code Quality Analysis & Continuous Improvement
 * Comprehensive code quality testing, metrics collection, and improvement tracking
 */

import { chromeMocks, chromeTestUtils } from '../mocks/chrome-api.js';
import { domMocks } from '../mocks/dom.js';

// Code Quality Analysis Framework
class CodeQualityFramework {
  constructor() {
    this.metrics = new Map();
    this.qualityGates = {
      complexity: { threshold: 10, weight: 0.2 },
      maintainability: { threshold: 70, weight: 0.25 },
      testCoverage: { threshold: 80, weight: 0.3 },
      documentation: { threshold: 75, weight: 0.15 },
      duplication: { threshold: 5, weight: 0.1 } // Max 5% duplication
    };
    this.codeSmells = [];
    this.technicalDebt = [];
    this.improvements = [];
  }

  async analyzeCodeQuality(codeFiles) {
    this.resetMetrics();

    for (const file of codeFiles) {
      await this.analyzeFile(file);
    }

    return this.generateQualityReport();
  }

  resetMetrics() {
    this.metrics.clear();
    this.codeSmells = [];
    this.technicalDebt = [];
    this.improvements = [];
  }

  async analyzeFile(file) {
    const analysis = {
      complexity: this.calculateComplexity(file.content),
      maintainability: this.assessMaintainability(file.content),
      documentation: this.assessDocumentation(file.content),
      testCoverage: this.estimateTestCoverage(file),
      duplication: this.detectDuplication(file.content),
      codeSmells: this.detectCodeSmells(file.content),
      security: this.basicSecurityCheck(file.content)
    };

    this.metrics.set(file.name, analysis);
    return analysis;
  }

  calculateComplexity(code) {
    // Cyclomatic complexity calculation
    let complexity = 1; // Base complexity

    // Control flow statements that increase complexity
    const complexityPatterns = [
      /\bif\s*\(/g,           // if statements
      /\belse\s*if\s*\(/g,    // else if statements
      /\bwhile\s*\(/g,        // while loops
      /\bfor\s*\(/g,          // for loops
      /\bswitch\s*\(/g,       // switch statements
      /\bcase\s+.+:/g,        // case statements
      /\bcatch\s*\(/g,        // catch blocks
      /\b&&\b/g,              // logical AND
      /\b\|\|\b/g,            // logical OR
      /\?\s*[^:]+\s*:/g       // ternary operators
    ];

    complexityPatterns.forEach(pattern => {
      const matches = code.match(pattern) || [];
      complexity += matches.length;
    });

    // Function/method complexity
    const functions = this.extractFunctions(code);
    const maxFunctionComplexity = Math.max(
      ...functions.map(fn => this.calculateFunctionComplexity(fn.body)),
      0
    );

    return {
      overall: complexity,
      maxFunction: maxFunctionComplexity,
      avgFunction: functions.length > 0 ? 
        functions.reduce((sum, fn) => sum + this.calculateFunctionComplexity(fn.body), 0) / functions.length : 0,
      functions: functions.map(fn => ({
        name: fn.name,
        complexity: this.calculateFunctionComplexity(fn.body),
        lines: fn.body.split('\n').length
      }))
    };
  }

  calculateFunctionComplexity(functionBody) {
    let complexity = 1;
    const patterns = [
      /\bif\s*\(/g, /\bwhile\s*\(/g, /\bfor\s*\(/g, /\bswitch\s*\(/g,
      /\bcatch\s*\(/g, /\b&&\b/g, /\b\|\|\b/g, /\?\s*[^:]+\s*:/g
    ];

    patterns.forEach(pattern => {
      const matches = functionBody.match(pattern) || [];
      complexity += matches.length;
    });

    return complexity;
  }

  extractFunctions(code) {
    const functions = [];
    
    // Regular functions
    const functionRegex = /function\s+(\w+)\s*\([^)]*\)\s*\{([\s\S]*?)\}/g;
    let match;
    
    while ((match = functionRegex.exec(code)) !== null) {
      functions.push({
        name: match[1],
        body: match[2]
      });
    }

    // Arrow functions
    const arrowFunctionRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)|\w+)\s*=>\s*(?:\{([\s\S]*?)\}|[^;]+)/g;
    
    while ((match = arrowFunctionRegex.exec(code)) !== null) {
      functions.push({
        name: match[1],
        body: match[2] || 'single expression'
      });
    }

    // Method definitions
    const methodRegex = /(\w+)\s*\([^)]*\)\s*\{([\s\S]*?)\}/g;
    
    while ((match = methodRegex.exec(code)) !== null) {
      if (!match[1].includes('function')) {
        functions.push({
          name: match[1],
          body: match[2]
        });
      }
    }

    return functions;
  }

  assessMaintainability(code) {
    const metrics = {
      linesOfCode: code.split('\n').length,
      commentRatio: this.calculateCommentRatio(code),
      functionLength: this.assessFunctionLength(code),
      namingQuality: this.assessNamingQuality(code),
      moduleStructure: this.assessModuleStructure(code)
    };

    // Calculate maintainability index (simplified version)
    const baseScore = 100;
    let deductions = 0;

    // Penalize long files
    if (metrics.linesOfCode > 300) {
      deductions += Math.min((metrics.linesOfCode - 300) / 10, 20);
    }

    // Reward good commenting
    if (metrics.commentRatio < 0.1) { // Less than 10% comments
      deductions += 15;
    }

    // Penalize long functions
    if (metrics.functionLength.avg > 50) {
      deductions += 10;
    }

    // Reward good naming
    if (metrics.namingQuality < 0.7) {
      deductions += 10;
    }

    const maintainabilityScore = Math.max(0, baseScore - deductions);

    return {
      score: Math.round(maintainabilityScore),
      metrics,
      issues: this.identifyMaintainabilityIssues(metrics)
    };
  }

  calculateCommentRatio(code) {
    const lines = code.split('\n');
    const commentLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.startsWith('//') || 
             trimmed.startsWith('/*') || 
             trimmed.startsWith('*') ||
             trimmed.includes('*/');
    });
    
    return lines.length > 0 ? commentLines.length / lines.length : 0;
  }

  assessFunctionLength(code) {
    const functions = this.extractFunctions(code);
    const lengths = functions.map(fn => fn.body.split('\n').length);
    
    return {
      avg: lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0,
      max: Math.max(...lengths, 0),
      functions: functions.map(fn => ({
        name: fn.name,
        length: fn.body.split('\n').length
      })).filter(f => f.length > 30) // Flag long functions
    };
  }

  assessNamingQuality(code) {
    const identifiers = this.extractIdentifiers(code);
    let goodNames = 0;
    
    identifiers.forEach(name => {
      // Check for meaningful names
      if (name.length >= 3 && 
          !name.match(/^[a-z][0-9]+$/) && // Not just letters followed by numbers
          !name.match(/^(temp|tmp|data|val|str|num|obj|el|elem)$/)) {
        goodNames++;
      }
    });
    
    return identifiers.length > 0 ? goodNames / identifiers.length : 1;
  }

  extractIdentifiers(code) {
    const identifiers = new Set();
    
    // Variables
    const varRegex = /(?:const|let|var)\s+(\w+)/g;
    let match;
    while ((match = varRegex.exec(code)) !== null) {
      identifiers.add(match[1]);
    }
    
    // Function names
    const funcRegex = /function\s+(\w+)/g;
    while ((match = funcRegex.exec(code)) !== null) {
      identifiers.add(match[1]);
    }
    
    return Array.from(identifiers);
  }

  assessModuleStructure(code) {
    const hasImports = code.includes('import');
    const hasExports = code.includes('export');
    const hasClasses = code.includes('class ');
    
    let score = 0;
    
    if (hasImports || hasExports) score += 30;
    if (hasClasses) score += 20;
    if (this.hasConsistentIndentation(code)) score += 25;
    if (this.hasSeparationOfConcerns(code)) score += 25;
    
    return Math.min(score, 100);
  }

  hasConsistentIndentation(code) {
    const lines = code.split('\n').filter(line => line.trim());
    const indentations = lines.map(line => line.length - line.trimStart().length);
    
    // Check if indentation is consistent (multiples of 2 or 4)
    const consistentSpacing = indentations.every(indent => 
      indent % 2 === 0 || indent % 4 === 0
    );
    
    return consistentSpacing;
  }

  hasSeparationOfConcerns(code) {
    // Look for signs of good separation
    const hasConfigSection = code.includes('config') || code.includes('Config');
    const hasUtilities = code.includes('utils') || code.includes('Utils');
    const hasErrorHandling = code.includes('catch') || code.includes('Error');
    
    return hasConfigSection || hasUtilities || hasErrorHandling;
  }

  identifyMaintainabilityIssues(metrics) {
    const issues = [];
    
    if (metrics.linesOfCode > 300) {
      issues.push('File is too long, consider splitting into modules');
    }
    
    if (metrics.commentRatio < 0.1) {
      issues.push('Insufficient code documentation');
    }
    
    if (metrics.functionLength.max > 50) {
      issues.push('Some functions are too long');
    }
    
    if (metrics.namingQuality < 0.7) {
      issues.push('Variable and function names could be more descriptive');
    }
    
    return issues;
  }

  assessDocumentation(code) {
    const documentation = {
      jsDocComments: this.countJSDocComments(code),
      inlineComments: this.countInlineComments(code),
      typeAnnotations: this.countTypeAnnotations(code),
      readmePresence: this.hasReadmeFile(code),
      apiDocumentation: this.hasAPIDocumentation(code)
    };
    
    let score = 0;
    
    if (documentation.jsDocComments > 0) score += 30;
    if (documentation.inlineComments > 0) score += 20;
    if (documentation.typeAnnotations > 0) score += 20;
    if (documentation.readmePresence) score += 15;
    if (documentation.apiDocumentation) score += 15;
    
    return {
      score: Math.min(score, 100),
      ...documentation
    };
  }

  countJSDocComments(code) {
    const jsDocPattern = /\/\*\*[\s\S]*?\*\//g;
    const matches = code.match(jsDocPattern) || [];
    return matches.length;
  }

  countInlineComments(code) {
    const lines = code.split('\n');
    return lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.startsWith('//') && trimmed.length > 3;
    }).length;
  }

  countTypeAnnotations(code) {
    // Look for JSDoc type annotations or TypeScript-style types
    const typePatterns = [
      /@param\s+\{[^}]+\}/g,
      /@returns?\s+\{[^}]+\}/g,
      /:\s*\w+(?:\[\])?/g
    ];
    
    let count = 0;
    typePatterns.forEach(pattern => {
      const matches = code.match(pattern) || [];
      count += matches.length;
    });
    
    return count;
  }

  hasReadmeFile(code) {
    // In a real implementation, this would check the file system
    return code.includes('README') || code.includes('documentation');
  }

  hasAPIDocumentation(code) {
    return code.includes('@api') || 
           code.includes('@endpoint') || 
           code.includes('API documentation');
  }

  estimateTestCoverage(file) {
    // Simple heuristic - look for test files and test patterns
    const isTestFile = file.name.includes('.test.') || file.name.includes('.spec.');
    
    if (isTestFile) {
      return 100; // Test files are considered 100% covered
    }
    
    // Look for corresponding test file
    const hasTestFile = this.hasCorrespondingTestFile(file.name);
    const testPatterns = this.countTestPatterns(file.content);
    
    let coverage = 0;
    if (hasTestFile) coverage += 60;
    if (testPatterns > 0) coverage += 20;
    if (file.content.includes('jest.') || file.content.includes('test(')) coverage += 20;
    
    return Math.min(coverage, 100);
  }

  hasCorrespondingTestFile(filename) {
    // Mock implementation - in real scenario, would check file system
    return filename.includes('test') || Math.random() > 0.5;
  }

  countTestPatterns(code) {
    const testPatterns = [
      /describe\s*\(/g,
      /it\s*\(/g,
      /test\s*\(/g,
      /expect\s*\(/g,
      /assert\s*\(/g
    ];
    
    let count = 0;
    testPatterns.forEach(pattern => {
      const matches = code.match(pattern) || [];
      count += matches.length;
    });
    
    return count;
  }

  detectDuplication(code) {
    const lines = code.split('\n').filter(line => line.trim());
    const duplicateLines = new Map();
    const significantLines = lines.filter(line => 
      line.trim().length > 10 && 
      !line.trim().startsWith('//') &&
      !line.trim().match(/^\s*[{}]\s*$/)
    );
    
    significantLines.forEach((line, index) => {
      const normalized = line.trim().replace(/\s+/g, ' ');
      if (!duplicateLines.has(normalized)) {
        duplicateLines.set(normalized, []);
      }
      duplicateLines.get(normalized).push(index);
    });
    
    const duplicatedLines = Array.from(duplicateLines.entries())
      .filter(([line, occurrences]) => occurrences.length > 1);
    
    const duplicationPercentage = significantLines.length > 0 ? 
      (duplicatedLines.length / significantLines.length) * 100 : 0;
    
    return {
      percentage: duplicationPercentage,
      duplicatedLines: duplicatedLines.length,
      totalLines: significantLines.length,
      examples: duplicatedLines.slice(0, 5).map(([line]) => line.substring(0, 80))
    };
  }

  detectCodeSmells(code) {
    const smells = [];
    
    // Long parameter lists
    const longParamLists = code.match(/\([^)]{50,}\)/g) || [];
    if (longParamLists.length > 0) {
      smells.push({
        type: 'LONG_PARAMETER_LIST',
        severity: 'MEDIUM',
        count: longParamLists.length,
        examples: longParamLists.slice(0, 3)
      });
    }
    
    // Deep nesting
    const deepNesting = this.detectDeepNesting(code);
    if (deepNesting.maxDepth > 4) {
      smells.push({
        type: 'DEEP_NESTING',
        severity: 'HIGH',
        maxDepth: deepNesting.maxDepth,
        locations: deepNesting.locations
      });
    }
    
    // Magic numbers
    const magicNumbers = code.match(/\b(?<!\.)\d{2,}\b/g) || [];
    const filteredMagicNumbers = magicNumbers.filter(num => 
      !['100', '200', '300', '400', '500'].includes(num)
    );
    
    if (filteredMagicNumbers.length > 3) {
      smells.push({
        type: 'MAGIC_NUMBERS',
        severity: 'LOW',
        count: filteredMagicNumbers.length,
        numbers: Array.from(new Set(filteredMagicNumbers))
      });
    }
    
    // Dead code (unreachable)
    if (code.includes('return') && code.match(/return[^;]*;[\s\S]+\w/)) {
      smells.push({
        type: 'DEAD_CODE',
        severity: 'MEDIUM',
        description: 'Code after return statement'
      });
    }
    
    // TODO comments
    const todoComments = code.match(/\/\/\s*TODO|\/\*\s*TODO/gi) || [];
    if (todoComments.length > 0) {
      smells.push({
        type: 'TODO_COMMENTS',
        severity: 'LOW',
        count: todoComments.length
      });
    }
    
    return smells;
  }

  detectDeepNesting(code) {
    const lines = code.split('\n');
    let currentDepth = 0;
    let maxDepth = 0;
    const locations = [];
    
    lines.forEach((line, index) => {
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      
      currentDepth += openBraces - closeBraces;
      
      if (currentDepth > maxDepth) {
        maxDepth = currentDepth;
        locations.push({ line: index + 1, depth: currentDepth });
      }
    });
    
    return {
      maxDepth,
      locations: locations.filter(loc => loc.depth > 4).slice(0, 5)
    };
  }

  basicSecurityCheck(code) {
    const securityIssues = [];
    
    // Dangerous functions
    const dangerousFunctions = ['eval', 'innerHTML', 'document.write'];
    dangerousFunctions.forEach(func => {
      if (code.includes(func)) {
        securityIssues.push({
          type: 'DANGEROUS_FUNCTION',
          function: func,
          severity: 'HIGH'
        });
      }
    });
    
    // Hardcoded secrets
    const secretPatterns = [
      /api[_-]?key\s*[:=]\s*['"]\w+['"]/i,
      /password\s*[:=]\s*['"]\w+['"]/i,
      /secret\s*[:=]\s*['"]\w+['"]/i
    ];
    
    secretPatterns.forEach(pattern => {
      if (pattern.test(code)) {
        securityIssues.push({
          type: 'HARDCODED_SECRET',
          severity: 'CRITICAL'
        });
      }
    });
    
    return securityIssues;
  }

  calculateOverallQualityScore() {
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const [fileName, analysis] of this.metrics.entries()) {
      Object.entries(this.qualityGates).forEach(([metric, config]) => {
        let metricScore = 0;
        
        switch (metric) {
          case 'complexity':
            metricScore = Math.max(0, 100 - (analysis.complexity.overall - 1) * 5);
            break;
          case 'maintainability':
            metricScore = analysis.maintainability.score;
            break;
          case 'testCoverage':
            metricScore = analysis.testCoverage;
            break;
          case 'documentation':
            metricScore = analysis.documentation.score;
            break;
          case 'duplication':
            metricScore = Math.max(0, 100 - analysis.duplication.percentage * 5);
            break;
        }
        
        totalScore += metricScore * config.weight;
        totalWeight += config.weight;
      });
    }
    
    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  }

  identifyTechnicalDebt() {
    const debt = [];
    
    for (const [fileName, analysis] of this.metrics.entries()) {
      // High complexity debt
      if (analysis.complexity.overall > this.qualityGates.complexity.threshold) {
        debt.push({
          type: 'HIGH_COMPLEXITY',
          file: fileName,
          severity: 'HIGH',
          effort: 'MEDIUM',
          description: `Cyclomatic complexity is ${analysis.complexity.overall}`,
          recommendation: 'Refactor complex functions into smaller, more focused functions'
        });
      }
      
      // Maintainability debt
      if (analysis.maintainability.score < this.qualityGates.maintainability.threshold) {
        debt.push({
          type: 'LOW_MAINTAINABILITY',
          file: fileName,
          severity: 'MEDIUM',
          effort: 'HIGH',
          description: `Maintainability score is ${analysis.maintainability.score}`,
          recommendation: 'Improve code structure, naming, and documentation'
        });
      }
      
      // Documentation debt
      if (analysis.documentation.score < this.qualityGates.documentation.threshold) {
        debt.push({
          type: 'POOR_DOCUMENTATION',
          file: fileName,
          severity: 'LOW',
          effort: 'MEDIUM',
          description: `Documentation score is ${analysis.documentation.score}`,
          recommendation: 'Add JSDoc comments and improve inline documentation'
        });
      }
      
      // Code smells as technical debt
      analysis.codeSmells.forEach(smell => {
        if (smell.severity === 'HIGH') {
          debt.push({
            type: smell.type,
            file: fileName,
            severity: smell.severity,
            effort: 'MEDIUM',
            description: `Code smell: ${smell.type}`,
            recommendation: this.getSmellRecommendation(smell.type)
          });
        }
      });
    }
    
    // Sort by severity and effort
    return debt.sort((a, b) => {
      const severityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  getSmellRecommendation(smellType) {
    const recommendations = {
      'LONG_PARAMETER_LIST': 'Use parameter objects or builder pattern',
      'DEEP_NESTING': 'Extract methods and use early returns',
      'MAGIC_NUMBERS': 'Define constants for magic numbers',
      'DEAD_CODE': 'Remove unreachable code',
      'TODO_COMMENTS': 'Address TODO items or convert to issues'
    };
    
    return recommendations[smellType] || 'Review and refactor as needed';
  }

  suggestImprovements() {
    const suggestions = [];
    
    for (const [fileName, analysis] of this.metrics.entries()) {
      // Test coverage improvements
      if (analysis.testCoverage < 80) {
        suggestions.push({
          type: 'INCREASE_TEST_COVERAGE',
          file: fileName,
          priority: 'HIGH',
          description: `Test coverage is ${analysis.testCoverage}%, aim for 80%+`,
          impact: 'Reduces bugs and improves maintainability'
        });
      }
      
      // Performance improvements
      if (analysis.complexity.maxFunction > 15) {
        suggestions.push({
          type: 'REDUCE_FUNCTION_COMPLEXITY',
          file: fileName,
          priority: 'MEDIUM',
          description: 'Break down complex functions',
          impact: 'Improves readability and maintainability'
        });
      }
      
      // Security improvements
      analysis.security.forEach(issue => {
        suggestions.push({
          type: 'SECURITY_IMPROVEMENT',
          file: fileName,
          priority: issue.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          description: `Address ${issue.type}`,
          impact: 'Improves application security'
        });
      });
    }
    
    return suggestions.sort((a, b) => {
      const priorityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  generateQualityReport() {
    const overallScore = this.calculateOverallQualityScore();
    const technicalDebt = this.identifyTechnicalDebt();
    const improvements = this.suggestImprovements();
    
    // Quality gates status
    const gateStatus = {};
    Object.keys(this.qualityGates).forEach(gate => {
      gateStatus[gate] = {
        passed: this.checkQualityGate(gate),
        threshold: this.qualityGates[gate].threshold
      };
    });
    
    return {
      timestamp: Date.now(),
      overallScore,
      qualityGrade: this.calculateQualityGrade(overallScore),
      gateStatus,
      fileMetrics: Object.fromEntries(this.metrics),
      codeSmells: this.getAllCodeSmells(),
      technicalDebt: {
        items: technicalDebt,
        totalCount: technicalDebt.length,
        highPriority: technicalDebt.filter(item => item.severity === 'HIGH').length
      },
      improvements: {
        suggestions: improvements,
        totalCount: improvements.length,
        critical: improvements.filter(item => item.priority === 'CRITICAL').length
      },
      trends: this.calculateTrends(),
      actionItems: this.generateActionItems(technicalDebt, improvements)
    };
  }

  checkQualityGate(gateName) {
    const threshold = this.qualityGates[gateName].threshold;
    
    for (const [, analysis] of this.metrics.entries()) {
      let value;
      switch (gateName) {
        case 'complexity':
          value = analysis.complexity.overall;
          if (value > threshold) return false;
          break;
        case 'maintainability':
          value = analysis.maintainability.score;
          if (value < threshold) return false;
          break;
        case 'testCoverage':
          value = analysis.testCoverage;
          if (value < threshold) return false;
          break;
        case 'documentation':
          value = analysis.documentation.score;
          if (value < threshold) return false;
          break;
        case 'duplication':
          value = analysis.duplication.percentage;
          if (value > threshold) return false;
          break;
      }
    }
    
    return true;
  }

  calculateQualityGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  getAllCodeSmells() {
    const allSmells = [];
    
    for (const [fileName, analysis] of this.metrics.entries()) {
      analysis.codeSmells.forEach(smell => {
        allSmells.push({ ...smell, file: fileName });
      });
    }
    
    return allSmells;
  }

  calculateTrends() {
    // Mock trend calculation - in real implementation would compare with historical data
    return {
      qualityScore: {
        current: this.calculateOverallQualityScore(),
        previous: 75,
        trend: 'improving'
      },
      technicalDebt: {
        current: this.identifyTechnicalDebt().length,
        previous: 12,
        trend: 'stable'
      },
      testCoverage: {
        current: 80,
        previous: 75,
        trend: 'improving'
      }
    };
  }

  generateActionItems(technicalDebt, improvements) {
    const actionItems = [];
    
    // High priority technical debt
    technicalDebt
      .filter(item => item.severity === 'HIGH' || item.severity === 'CRITICAL')
      .slice(0, 5)
      .forEach(item => {
        actionItems.push({
          type: 'TECHNICAL_DEBT',
          priority: item.severity,
          title: `Address ${item.type} in ${item.file}`,
          description: item.description,
          recommendation: item.recommendation,
          estimatedEffort: item.effort
        });
      });
    
    // Critical improvements
    improvements
      .filter(item => item.priority === 'CRITICAL')
      .forEach(item => {
        actionItems.push({
          type: 'CRITICAL_IMPROVEMENT',
          priority: item.priority,
          title: `${item.type} in ${item.file}`,
          description: item.description,
          impact: item.impact,
          estimatedEffort: 'HIGH'
        });
      });
    
    return actionItems;
  }
}

// Mock code files for testing
const mockCodeFiles = [
  {
    name: 'service-worker.js',
    content: `
/**
 * AstralTube Service Worker
 * Handles background operations
 */

class AstralTubeServiceWorker {
  constructor() {
    this.initialized = false;
    this.connections = new Map();
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  async initialize() {
    try {
      if (this.initialized) return;
      
      await this.setupEventListeners();
      await this.loadConfiguration();
      
      this.initialized = true;
      console.log('Service worker initialized');
    } catch (error) {
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        await this.initialize();
      } else {
        throw new Error('Failed to initialize service worker');
      }
    }
  }

  async setupEventListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'GET_PLAYLISTS') {
        this.handleGetPlaylists(message.data).then(sendResponse);
      } else if (message.type === 'CREATE_PLAYLIST') {
        this.handleCreatePlaylist(message.data).then(sendResponse);
      } else if (message.type === 'DELETE_PLAYLIST') {
        this.handleDeletePlaylist(message.data).then(sendResponse);
      }
      return true;
    });
  }

  async loadConfiguration() {
    const config = await chrome.storage.local.get('config');
    this.config = config || this.getDefaultConfig();
  }

  getDefaultConfig() {
    return {
      apiKey: 'default-key',
      timeout: 5000,
      retries: 3
    };
  }

  async handleGetPlaylists(data) {
    // TODO: Implement playlist retrieval
    const apiKey = 'AIzaSyDf3K1h2x9v8w5t4r3e2w1q'; // This is a security issue
    
    if (data && data.userId && data.userId !== null) {
      if (data.userId.length > 0) {
        if (typeof data.userId === 'string') {
          // Deep nesting example
          const playlists = await this.fetchUserPlaylists(data.userId, apiKey);
          return { success: true, data: playlists };
        }
      }
    }
    
    return { success: false, error: 'Invalid user ID' };
  }

  async fetchUserPlaylists(userId, apiKey) {
    const response = await fetch(\`https://api.youtube.com/playlists?userId=\${userId}&key=\${apiKey}\`);
    return response.json();
  }
}`
  },
  {
    name: 'content-script.js',
    content: `
// Content script for YouTube integration
function init() {
  setupSidebar();
  enhancePage();
}

function setupSidebar() {
  const sidebar = document.createElement('div');
  sidebar.innerHTML = '<div>Sidebar content</div>'; // Potential XSS
  document.body.appendChild(sidebar);
}

function enhancePage() {
  const videos = document.querySelectorAll('video');
  videos.forEach(v => addControls(v));
}

function addControls(video) {
  // Magic numbers
  video.style.width = '640px';
  video.style.height = '480px';
  
  const controls = document.createElement('div');
  controls.onclick = function() { handleClick(video, 123, 456, 789); }; // Long parameter list
  return controls;
}

function handleClick(video, param1, param2, param3, param4, param5) {
  eval('console.log("clicked")'); // Security issue
  video.play();
  return true;
  console.log('This code is unreachable'); // Dead code
}

init();`
  },
  {
    name: 'api.test.js',
    content: `
describe('API Tests', () => {
  test('should fetch playlists', async () => {
    const api = new API();
    const result = await api.getPlaylists();
    expect(result).toBeDefined();
  });

  test('should handle errors', async () => {
    const api = new API();
    await expect(api.getPlaylists('invalid')).rejects.toThrow();
  });
});`
  }
];

describe('Code Quality Analysis & Continuous Improvement', () => {
  let qualityFramework;

  beforeEach(() => {
    qualityFramework = new CodeQualityFramework();
  });

  afterEach(() => {
    qualityFramework = null;
  });

  describe('Code Complexity Analysis', () => {
    test('should calculate cyclomatic complexity correctly', () => {
      const complexCode = `
        function complexFunction(data) {
          if (data.type === 'user') {
            if (data.authenticated) {
              for (let i = 0; i < data.items.length; i++) {
                if (data.items[i].valid) {
                  switch (data.items[i].category) {
                    case 'premium':
                      return processPremium(data.items[i]);
                    case 'standard':
                      return processStandard(data.items[i]);
                    default:
                      throw new Error('Invalid category');
                  }
                }
              }
            } else {
              throw new Error('Not authenticated');
            }
          }
          return null;
        }
      `;

      const complexity = qualityFramework.calculateComplexity(complexCode);
      
      expect(complexity.overall).toBeGreaterThan(10);
      expect(complexity.functions).toHaveLength(1);
      expect(complexity.functions[0].name).toBe('complexFunction');
      expect(complexity.functions[0].complexity).toBeGreaterThan(8);
    });

    test('should identify functions with high complexity', () => {
      const code = mockCodeFiles[0].content;
      const complexity = qualityFramework.calculateComplexity(code);
      
      expect(complexity.functions.length).toBeGreaterThan(0);
      
      const complexFunctions = complexity.functions.filter(fn => fn.complexity > 5);
      expect(complexFunctions.length).toBeGreaterThan(0);
    });
  });

  describe('Maintainability Assessment', () => {
    test('should assess maintainability metrics', () => {
      const code = mockCodeFiles[0].content;
      const maintainability = qualityFramework.assessMaintainability(code);
      
      expect(maintainability.score).toBeGreaterThan(0);
      expect(maintainability.metrics).toHaveProperty('linesOfCode');
      expect(maintainability.metrics).toHaveProperty('commentRatio');
      expect(maintainability.metrics).toHaveProperty('functionLength');
      expect(maintainability.metrics).toHaveProperty('namingQuality');
    });

    test('should identify maintainability issues', () => {
      const poorCode = `
        function a(x,y,z,w,q,r,t,u,i,o,p) {
          let temp = x;
          let tmp = y;
          let val = z;
          for(let i=0;i<100;i++){
            for(let j=0;j<100;j++){
              for(let k=0;k<100;k++){
                for(let l=0;l<100;l++){
                  temp = temp + tmp + val + w + q + r + t + u + i + o + p;
                  if(temp>1000){
                    if(temp>2000){
                      if(temp>3000){
                        return temp;
                      }
                    }
                  }
                }
              }
            }
          }
          return temp;
        }
      `;

      const maintainability = qualityFramework.assessMaintainability(poorCode);
      
      expect(maintainability.score).toBeLessThan(70);
      expect(maintainability.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Documentation Quality', () => {
    test('should assess documentation quality', () => {
      const wellDocumentedCode = `
        /**
         * Calculates the total price including tax
         * @param {number} price - The base price
         * @param {number} taxRate - The tax rate (0-1)
         * @returns {number} The total price with tax
         */
        function calculateTotal(price, taxRate) {
          // Validate input parameters
          if (price < 0 || taxRate < 0) {
            throw new Error('Price and tax rate must be positive');
          }
          
          // Calculate tax amount
          const tax = price * taxRate;
          
          // Return total
          return price + tax;
        }
      `;

      const documentation = qualityFramework.assessDocumentation(wellDocumentedCode);
      
      expect(documentation.score).toBeGreaterThan(70);
      expect(documentation.jsDocComments).toBeGreaterThan(0);
      expect(documentation.inlineComments).toBeGreaterThan(0);
    });

    test('should penalize poor documentation', () => {
      const poorlyDocumentedCode = `
        function calc(p, t) {
          return p + p * t;
        }
      `;

      const documentation = qualityFramework.assessDocumentation(poorlyDocumentedCode);
      
      expect(documentation.score).toBeLessThan(50);
      expect(documentation.jsDocComments).toBe(0);
    });
  });

  describe('Code Smell Detection', () => {
    test('should detect various code smells', () => {
      const smellyCode = mockCodeFiles[1].content;
      const smells = qualityFramework.detectCodeSmells(smellyCode);
      
      expect(smells.length).toBeGreaterThan(0);
      
      const smellTypes = smells.map(smell => smell.type);
      expect(smellTypes).toContain('MAGIC_NUMBERS');
      expect(smellTypes).toContain('DEAD_CODE');
    });

    test('should detect deep nesting', () => {
      const deeplyNestedCode = `
        function nested() {
          if (condition1) {
            if (condition2) {
              if (condition3) {
                if (condition4) {
                  if (condition5) {
                    return true;
                  }
                }
              }
            }
          }
        }
      `;

      const smells = qualityFramework.detectCodeSmells(deeplyNestedCode);
      
      const nestingSmell = smells.find(smell => smell.type === 'DEEP_NESTING');
      expect(nestingSmell).toBeDefined();
      expect(nestingSmell.maxDepth).toBeGreaterThan(4);
    });

    test('should detect TODO comments', () => {
      const codeWithTodos = `
        function processData() {
          // TODO: Add validation
          /* TODO: Optimize performance */
          return data.process();
        }
      `;

      const smells = qualityFramework.detectCodeSmells(codeWithTodos);
      
      const todoSmell = smells.find(smell => smell.type === 'TODO_COMMENTS');
      expect(todoSmell).toBeDefined();
      expect(todoSmell.count).toBe(2);
    });
  });

  describe('Test Coverage Estimation', () => {
    test('should recognize test files', () => {
      const testFile = mockCodeFiles[2];
      const coverage = qualityFramework.estimateTestCoverage(testFile);
      
      expect(coverage).toBe(100); // Test files are considered 100% covered
    });

    test('should estimate coverage for source files', () => {
      const sourceFile = mockCodeFiles[0];
      const coverage = qualityFramework.estimateTestCoverage(sourceFile);
      
      expect(coverage).toBeGreaterThan(0);
      expect(coverage).toBeLessThan(100);
    });
  });

  describe('Duplication Detection', () => {
    test('should detect code duplication', () => {
      const duplicatedCode = `
        function processUserA(user) {
          if (user.active) {
            user.lastLogin = Date.now();
            user.loginCount++;
            return user.save();
          }
        }
        
        function processUserB(user) {
          if (user.active) {
            user.lastLogin = Date.now();
            user.loginCount++;
            return user.save();
          }
        }
      `;

      const duplication = qualityFramework.detectDuplication(duplicatedCode);
      
      expect(duplication.percentage).toBeGreaterThan(0);
      expect(duplication.duplicatedLines).toBeGreaterThan(0);
    });
  });

  describe('Security Analysis', () => {
    test('should detect security issues', () => {
      const insecureCode = mockCodeFiles[0].content;
      const securityIssues = qualityFramework.basicSecurityCheck(insecureCode);
      
      expect(securityIssues.length).toBeGreaterThan(0);
      
      const hardcodedSecret = securityIssues.find(issue => issue.type === 'HARDCODED_SECRET');
      expect(hardcodedSecret).toBeDefined();
    });

    test('should detect dangerous functions', () => {
      const dangerousCode = mockCodeFiles[1].content;
      const securityIssues = qualityFramework.basicSecurityCheck(dangerousCode);
      
      const evalIssue = securityIssues.find(issue => issue.function === 'eval');
      expect(evalIssue).toBeDefined();
      expect(evalIssue.severity).toBe('HIGH');
    });
  });

  describe('Overall Quality Assessment', () => {
    test('should analyze complete codebase', async () => {
      const report = await qualityFramework.analyzeCodeQuality(mockCodeFiles);
      
      expect(report).toHaveProperty('overallScore');
      expect(report).toHaveProperty('qualityGrade');
      expect(report).toHaveProperty('gateStatus');
      expect(report).toHaveProperty('fileMetrics');
      expect(report).toHaveProperty('technicalDebt');
      expect(report).toHaveProperty('improvements');
      
      expect(report.overallScore).toBeGreaterThan(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      expect(['A', 'B', 'C', 'D', 'F']).toContain(report.qualityGrade);
    });

    test('should calculate quality gates status', async () => {
      const report = await qualityFramework.analyzeCodeQuality(mockCodeFiles);
      
      expect(report.gateStatus).toHaveProperty('complexity');
      expect(report.gateStatus).toHaveProperty('maintainability');
      expect(report.gateStatus).toHaveProperty('testCoverage');
      expect(report.gateStatus).toHaveProperty('documentation');
      expect(report.gateStatus).toHaveProperty('duplication');
      
      Object.values(report.gateStatus).forEach(gate => {
        expect(gate).toHaveProperty('passed');
        expect(gate).toHaveProperty('threshold');
        expect(typeof gate.passed).toBe('boolean');
      });
    });

    test('should identify technical debt', async () => {
      const report = await qualityFramework.analyzeCodeQuality(mockCodeFiles);
      
      expect(report.technicalDebt.items.length).toBeGreaterThan(0);
      expect(report.technicalDebt.totalCount).toBe(report.technicalDebt.items.length);
      
      report.technicalDebt.items.forEach(item => {
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('file');
        expect(item).toHaveProperty('severity');
        expect(item).toHaveProperty('recommendation');
      });
    });

    test('should suggest improvements', async () => {
      const report = await qualityFramework.analyzeCodeQuality(mockCodeFiles);
      
      expect(report.improvements.suggestions.length).toBeGreaterThan(0);
      
      report.improvements.suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('type');
        expect(suggestion).toHaveProperty('priority');
        expect(suggestion).toHaveProperty('description');
        expect(suggestion).toHaveProperty('impact');
      });
    });

    test('should generate actionable items', async () => {
      const report = await qualityFramework.analyzeCodeQuality(mockCodeFiles);
      
      expect(report.actionItems.length).toBeGreaterThan(0);
      
      report.actionItems.forEach(item => {
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('priority');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('description');
      });
    });
  });

  describe('Quality Trends', () => {
    test('should calculate quality trends', async () => {
      const report = await qualityFramework.analyzeCodeQuality(mockCodeFiles);
      
      expect(report.trends).toHaveProperty('qualityScore');
      expect(report.trends).toHaveProperty('technicalDebt');
      expect(report.trends).toHaveProperty('testCoverage');
      
      expect(report.trends.qualityScore).toHaveProperty('current');
      expect(report.trends.qualityScore).toHaveProperty('previous');
      expect(report.trends.qualityScore).toHaveProperty('trend');
      
      expect(['improving', 'declining', 'stable']).toContain(report.trends.qualityScore.trend);
    });
  });

  describe('Code Metrics', () => {
    test('should collect comprehensive metrics per file', async () => {
      const report = await qualityFramework.analyzeCodeQuality(mockCodeFiles.slice(0, 1));
      
      const fileMetrics = Object.values(report.fileMetrics)[0];
      
      expect(fileMetrics).toHaveProperty('complexity');
      expect(fileMetrics).toHaveProperty('maintainability');
      expect(fileMetrics).toHaveProperty('documentation');
      expect(fileMetrics).toHaveProperty('testCoverage');
      expect(fileMetrics).toHaveProperty('duplication');
      expect(fileMetrics).toHaveProperty('codeSmells');
      expect(fileMetrics).toHaveProperty('security');
      
      expect(fileMetrics.complexity).toHaveProperty('overall');
      expect(fileMetrics.complexity).toHaveProperty('functions');
      expect(fileMetrics.maintainability).toHaveProperty('score');
      expect(fileMetrics.maintainability).toHaveProperty('metrics');
    });
  });
});