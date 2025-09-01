/**
 * Lint-staged configuration for AstralTube
 * Runs linting and formatting on staged files
 */

module.exports = {
  // JavaScript files
  '*.{js,jsx}': [
    'eslint --fix',
    'prettier --write',
    'git add'
  ],
  
  // CSS files
  '*.{css,scss}': [
    'prettier --write',
    'git add'
  ],
  
  // HTML files
  '*.html': [
    'prettier --write',
    'git add'
  ],
  
  // JSON files
  '*.json': [
    'prettier --write',
    'git add'
  ],
  
  // Markdown files
  '*.md': [
    'prettier --write',
    'git add'
  ],
  
  // Package.json validation
  'package.json': [
    'npm run validate:package || echo "Warning: package.json validation failed"',
    'prettier --write',
    'git add'
  ],
  
  // Manifest validation
  'manifest.json': [
    'npm run validate:manifest || echo "Warning: manifest.json validation failed"',
    'prettier --write',
    'git add'
  ]
};