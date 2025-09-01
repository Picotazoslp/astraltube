/**
 * AstralTube v3 - WCAG 2.1 AA Accessibility Tests
 * Comprehensive accessibility testing for compliance with web standards
 */

import { chromeMocks, chromeTestUtils } from '../mocks/chrome-api.js';
import { domMocks, mockYouTubePage } from '../mocks/dom.js';

// Accessibility Testing Framework
class AccessibilityTestFramework {
  constructor() {
    this.violations = [];
    this.warnings = [];
    this.passes = [];
    this.wcagLevels = ['A', 'AA', 'AAA'];
    this.currentLevel = 'AA';
    this.colorContrastThreshold = {
      normal: { AA: 4.5, AAA: 7 },
      large: { AA: 3, AAA: 4.5 }
    };
  }

  async auditElement(element, options = {}) {
    this.violations = [];
    this.warnings = [];
    this.passes = [];

    const tests = [
      this.testColorContrast.bind(this),
      this.testKeyboardNavigation.bind(this),
      this.testAltText.bind(this),
      this.testHeadingStructure.bind(this),
      this.testFocusManagement.bind(this),
      this.testFormLabels.bind(this),
      this.testButtonAccessibility.bind(this),
      this.testLinkAccessibility.bind(this),
      this.testLandmarks.bind(this),
      this.testTabIndex.bind(this),
      this.testAriaLabels.bind(this),
      this.testSkipLinks.bind(this),
      this.testAnimationAccessibility.bind(this)
    ];

    for (const test of tests) {
      try {
        await test(element, options);
      } catch (error) {
        this.addViolation('test-error', `Test failed: ${error.message}`, element);
      }
    }

    return this.generateReport();
  }

  async testColorContrast(element) {
    const elementsToTest = element.querySelectorAll('*');
    
    for (const el of elementsToTest) {
      if (el.textContent?.trim()) {
        const style = window.getComputedStyle(el);
        const backgroundColor = this.parseColor(style.backgroundColor);
        const textColor = this.parseColor(style.color);
        
        if (backgroundColor && textColor) {
          const contrast = this.calculateContrastRatio(backgroundColor, textColor);
          const fontSize = parseFloat(style.fontSize);
          const fontWeight = style.fontWeight;
          
          const isLargeText = fontSize >= 18 || (fontSize >= 14 && (fontWeight === 'bold' || parseInt(fontWeight) >= 700));
          const threshold = isLargeText ? 
            this.colorContrastThreshold.large[this.currentLevel] : 
            this.colorContrastThreshold.normal[this.currentLevel];
          
          if (contrast < threshold) {
            this.addViolation(
              'color-contrast',
              `Color contrast ratio ${contrast.toFixed(2)} is below ${threshold} (${isLargeText ? 'large' : 'normal'} text)`,
              el,
              { contrast, threshold, isLargeText }
            );
          } else {
            this.addPass('color-contrast', `Good color contrast: ${contrast.toFixed(2)}`, el);
          }
        }
      }
    }
  }

  async testKeyboardNavigation(element) {
    const focusableElements = element.querySelectorAll(`
      a[href],
      button:not([disabled]),
      textarea:not([disabled]),
      input:not([disabled]),
      select:not([disabled]),
      [tabindex]:not([tabindex="-1"])
    `);

    let hasTabIndex = false;
    
    focusableElements.forEach((el, index) => {
      const tabIndex = el.getAttribute('tabindex');
      
      if (tabIndex !== null) {
        hasTabIndex = true;
        const tabValue = parseInt(tabIndex);
        
        if (tabValue > 0) {
          this.addWarning(
            'tabindex-positive',
            'Positive tabindex values can create confusing navigation order',
            el,
            { tabIndex: tabValue }
          );
        }
      }

      // Check if focusable elements have visible focus indicators
      const focusStyles = this.getFocusStyles(el);
      if (!focusStyles.outline && !focusStyles.boxShadow && !focusStyles.border) {
        this.addViolation(
          'focus-visible',
          'Focusable element lacks visible focus indicator',
          el
        );
      } else {
        this.addPass('focus-visible', 'Element has visible focus indicator', el);
      }
    });

    if (focusableElements.length > 0 && !hasTabIndex) {
      this.addPass('keyboard-navigation', 'Natural tab order is maintained', element);
    }

    // Test skip links
    const skipLinks = element.querySelectorAll('a[href^="#"]:first-child');
    if (skipLinks.length === 0 && element.querySelector('main')) {
      this.addWarning('skip-links', 'Consider adding skip navigation links', element);
    }
  }

  async testAltText(element) {
    const images = element.querySelectorAll('img');
    
    images.forEach(img => {
      const alt = img.getAttribute('alt');
      const src = img.getAttribute('src');
      
      if (alt === null) {
        this.addViolation('missing-alt', 'Image missing alt attribute', img);
      } else if (alt === '' && img.getAttribute('role') !== 'presentation') {
        // Empty alt is okay for decorative images, but should be intentional
        if (!img.closest('[role="presentation"]')) {
          this.addWarning('empty-alt', 'Image has empty alt - ensure this is decorative', img);
        }
      } else if (alt && alt.length > 125) {
        this.addWarning('alt-too-long', 'Alt text should be concise (under 125 characters)', img);
      } else if (alt) {
        this.addPass('alt-text', 'Image has appropriate alt text', img);
      }

      // Check for redundant text
      if (alt && (alt.toLowerCase().includes('image') || alt.toLowerCase().includes('picture'))) {
        this.addWarning('alt-redundant', 'Alt text should not include "image" or "picture"', img);
      }
    });
  }

  async testHeadingStructure(element) {
    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const headingLevels = [];
    
    headings.forEach(heading => {
      const level = parseInt(heading.tagName.charAt(1));
      headingLevels.push({ level, element: heading });
    });

    // Check for proper heading hierarchy
    let previousLevel = 0;
    headingLevels.forEach(({ level, element: heading }, index) => {
      if (index === 0 && level !== 1) {
        this.addViolation('heading-order', 'Page should start with h1', heading);
      } else if (level > previousLevel + 1) {
        this.addViolation(
          'heading-skip',
          `Heading level skipped from h${previousLevel} to h${level}`,
          heading
        );
      } else {
        this.addPass('heading-structure', `Proper heading level h${level}`, heading);
      }
      
      previousLevel = level;

      // Check for empty headings
      if (!heading.textContent.trim()) {
        this.addViolation('empty-heading', 'Heading element is empty', heading);
      }
    });

    if (headings.length === 0) {
      this.addWarning('no-headings', 'No heading elements found', element);
    }
  }

  async testFocusManagement(element) {
    const focusableElements = element.querySelectorAll(`
      a[href], button:not([disabled]), textarea:not([disabled]),
      input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])
    `);

    // Test focus trap for modals/dialogs
    const modals = element.querySelectorAll('[role="dialog"], [role="alertdialog"], .modal');
    modals.forEach(modal => {
      const modalFocusable = modal.querySelectorAll(`
        a[href], button:not([disabled]), textarea:not([disabled]),
        input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])
      `);
      
      if (modalFocusable.length === 0) {
        this.addViolation('modal-focus', 'Modal should contain focusable elements', modal);
      } else {
        this.addPass('modal-focus', 'Modal contains focusable elements', modal);
      }
    });

    // Check for focus order
    const elementsWithTabIndex = Array.from(focusableElements).filter(el => 
      el.getAttribute('tabindex') !== null
    );
    
    if (elementsWithTabIndex.length > 0) {
      const tabOrder = elementsWithTabIndex.map(el => parseInt(el.getAttribute('tabindex') || '0'));
      const sortedOrder = [...tabOrder].sort((a, b) => a - b);
      
      if (JSON.stringify(tabOrder) !== JSON.stringify(sortedOrder)) {
        this.addWarning('focus-order', 'Focus order may be confusing due to tabindex values', element);
      }
    }
  }

  async testFormLabels(element) {
    const formControls = element.querySelectorAll('input, textarea, select');
    
    formControls.forEach(control => {
      const type = control.getAttribute('type');
      
      // Skip hidden inputs and buttons
      if (type === 'hidden' || type === 'button' || type === 'submit' || type === 'reset') {
        return;
      }

      const id = control.getAttribute('id');
      const ariaLabel = control.getAttribute('aria-label');
      const ariaLabelledBy = control.getAttribute('aria-labelledby');
      
      let hasLabel = false;
      let labelText = '';

      if (id) {
        const label = element.querySelector(`label[for="${id}"]`);
        if (label) {
          hasLabel = true;
          labelText = label.textContent.trim();
        }
      }

      const parentLabel = control.closest('label');
      if (parentLabel) {
        hasLabel = true;
        labelText = parentLabel.textContent.trim();
      }

      if (ariaLabel) {
        hasLabel = true;
        labelText = ariaLabel;
      }

      if (ariaLabelledBy) {
        const labelElement = element.querySelector(`#${ariaLabelledBy}`);
        if (labelElement) {
          hasLabel = true;
          labelText = labelElement.textContent.trim();
        }
      }

      if (!hasLabel) {
        this.addViolation('missing-label', 'Form control missing accessible label', control);
      } else if (labelText.length === 0) {
        this.addViolation('empty-label', 'Form control has empty label', control);
      } else {
        this.addPass('form-label', 'Form control has accessible label', control);
      }

      // Check for required field indicators
      if (control.hasAttribute('required') || control.getAttribute('aria-required') === 'true') {
        if (!labelText.includes('*') && !labelText.toLowerCase().includes('required')) {
          this.addWarning('required-indicator', 'Required field should be clearly indicated', control);
        }
      }
    });
  }

  async testButtonAccessibility(element) {
    const buttons = element.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]');
    
    buttons.forEach(button => {
      const text = button.textContent?.trim() || button.getAttribute('aria-label') || button.getAttribute('title');
      
      if (!text) {
        this.addViolation('button-no-text', 'Button has no accessible text', button);
      } else if (text.length < 2) {
        this.addWarning('button-text-short', 'Button text may be too short to be descriptive', button);
      } else {
        this.addPass('button-text', 'Button has accessible text', button);
      }

      // Check for disabled buttons
      if (button.disabled || button.getAttribute('aria-disabled') === 'true') {
        if (!button.getAttribute('aria-describedby')) {
          this.addWarning('disabled-button', 'Disabled button should explain why it\'s disabled', button);
        }
      }

      // Check button size for touch targets
      const rect = button.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const minSize = 44; // WCAG 2.1 AA minimum touch target size
        if (rect.width < minSize || rect.height < minSize) {
          this.addWarning(
            'touch-target-size',
            `Button touch target (${rect.width}x${rect.height}) smaller than ${minSize}x${minSize}px`,
            button
          );
        }
      }
    });
  }

  async testLinkAccessibility(element) {
    const links = element.querySelectorAll('a[href]');
    
    links.forEach(link => {
      const text = link.textContent?.trim() || link.getAttribute('aria-label');
      const href = link.getAttribute('href');
      
      if (!text) {
        this.addViolation('link-no-text', 'Link has no accessible text', link);
      } else if (text.toLowerCase() === 'click here' || text.toLowerCase() === 'read more') {
        this.addWarning('link-generic-text', 'Link text should be more descriptive', link);
      } else {
        this.addPass('link-text', 'Link has descriptive text', link);
      }

      // Check for external links
      if (href && (href.startsWith('http') && !href.includes(window.location.hostname))) {
        if (!text.toLowerCase().includes('external') && !link.getAttribute('aria-describedby')) {
          this.addWarning('external-link', 'External links should be identified', link);
        }
      }

      // Check for links that open in new window
      if (link.getAttribute('target') === '_blank') {
        if (!text.toLowerCase().includes('new window') && !link.getAttribute('aria-describedby')) {
          this.addWarning('new-window-link', 'Links opening in new window should warn users', link);
        }
      }
    });
  }

  async testLandmarks(element) {
    const landmarks = {
      main: element.querySelectorAll('main, [role="main"]'),
      nav: element.querySelectorAll('nav, [role="navigation"]'),
      banner: element.querySelectorAll('header[role="banner"], [role="banner"]'),
      contentinfo: element.querySelectorAll('footer[role="contentinfo"], [role="contentinfo"]'),
      complementary: element.querySelectorAll('aside, [role="complementary"]')
    };

    if (landmarks.main.length === 0) {
      this.addWarning('missing-main', 'Page should have a main landmark', element);
    } else if (landmarks.main.length > 1) {
      this.addWarning('multiple-main', 'Page should have only one main landmark', element);
    } else {
      this.addPass('main-landmark', 'Page has proper main landmark', landmarks.main[0]);
    }

    if (landmarks.nav.length === 0) {
      this.addWarning('missing-nav', 'Consider adding navigation landmarks', element);
    }

    // Check for landmark labels when multiple of same type exist
    Object.entries(landmarks).forEach(([type, elements]) => {
      if (elements.length > 1) {
        elements.forEach(el => {
          const label = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
          if (!label) {
            this.addWarning(
              'landmark-label',
              `Multiple ${type} landmarks should have unique labels`,
              el
            );
          }
        });
      }
    });
  }

  async testTabIndex(element) {
    const elementsWithTabIndex = element.querySelectorAll('[tabindex]');
    
    elementsWithTabIndex.forEach(el => {
      const tabIndex = el.getAttribute('tabindex');
      const tabValue = parseInt(tabIndex);
      
      if (isNaN(tabValue)) {
        this.addViolation('invalid-tabindex', 'Invalid tabindex value', el);
      } else if (tabValue > 0) {
        this.addWarning('positive-tabindex', 'Avoid positive tabindex values', el);
      } else if (tabValue === 0) {
        // Check if element is naturally focusable
        const naturallyFocusable = el.matches('a[href], button, input, textarea, select');
        if (naturallyFocusable) {
          this.addWarning('redundant-tabindex', 'Element is naturally focusable, tabindex="0" redundant', el);
        }
      }
    });
  }

  async testAriaLabels(element) {
    const elementsWithAria = element.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby]');
    
    elementsWithAria.forEach(el => {
      const ariaLabel = el.getAttribute('aria-label');
      const ariaLabelledBy = el.getAttribute('aria-labelledby');
      const ariaDescribedBy = el.getAttribute('aria-describedby');
      
      if (ariaLabel && ariaLabel.trim().length === 0) {
        this.addViolation('empty-aria-label', 'aria-label is empty', el);
      }
      
      if (ariaLabelledBy) {
        const labelElement = element.querySelector(`#${ariaLabelledBy}`);
        if (!labelElement) {
          this.addViolation('broken-aria-labelledby', 'aria-labelledby references non-existent element', el);
        } else if (!labelElement.textContent.trim()) {
          this.addWarning('empty-aria-labelledby', 'Referenced label element is empty', el);
        }
      }
      
      if (ariaDescribedBy) {
        const descElement = element.querySelector(`#${ariaDescribedBy}`);
        if (!descElement) {
          this.addViolation('broken-aria-describedby', 'aria-describedby references non-existent element', el);
        }
      }
    });

    // Check for ARIA roles
    const elementsWithRole = element.querySelectorAll('[role]');
    const validRoles = [
      'alert', 'alertdialog', 'application', 'article', 'banner', 'button', 'cell', 'checkbox',
      'columnheader', 'combobox', 'complementary', 'contentinfo', 'definition', 'dialog',
      'directory', 'document', 'feed', 'figure', 'form', 'grid', 'gridcell', 'group',
      'heading', 'img', 'link', 'list', 'listbox', 'listitem', 'log', 'main', 'marquee',
      'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'navigation',
      'none', 'note', 'option', 'presentation', 'progressbar', 'radio', 'radiogroup',
      'region', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'search', 'searchbox',
      'separator', 'slider', 'spinbutton', 'status', 'switch', 'tab', 'table', 'tablist',
      'tabpanel', 'term', 'textbox', 'timer', 'toolbar', 'tooltip', 'tree', 'treegrid',
      'treeitem'
    ];
    
    elementsWithRole.forEach(el => {
      const role = el.getAttribute('role');
      if (!validRoles.includes(role)) {
        this.addViolation('invalid-role', `Invalid ARIA role: ${role}`, el);
      }
    });
  }

  async testSkipLinks(element) {
    const skipLinks = element.querySelectorAll('a[href^="#"]');
    const mainContent = element.querySelector('main, #main, #content');
    
    if (mainContent && skipLinks.length === 0) {
      this.addWarning('missing-skip-link', 'Consider adding skip navigation link', element);
    }
    
    skipLinks.forEach(link => {
      const href = link.getAttribute('href');
      const target = element.querySelector(href);
      
      if (!target) {
        this.addViolation('broken-skip-link', 'Skip link target does not exist', link);
      } else if (!target.getAttribute('tabindex') && !target.matches('a, button, input, textarea, select')) {
        this.addWarning('skip-target-focus', 'Skip link target should be focusable', target);
      }
    });
  }

  async testAnimationAccessibility(element) {
    const animatedElements = element.querySelectorAll('[class*="animate"], [style*="animation"], [style*="transition"]');
    
    animatedElements.forEach(el => {
      const style = window.getComputedStyle(el);
      const animation = style.getPropertyValue('animation');
      const transition = style.getPropertyValue('transition');
      
      if (animation !== 'none' || transition !== 'all 0s ease 0s') {
        // Check for prefers-reduced-motion support
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (!el.classList.contains('respect-motion-preference')) {
          this.addWarning(
            'motion-preference',
            'Animated element should respect prefers-reduced-motion',
            el
          );
        }
        
        // Check for flashing content
        if (animation.includes('blink') || el.classList.contains('flash')) {
          this.addViolation('flashing-content', 'Avoid flashing content that could trigger seizures', el);
        }
      }
    });
  }

  // Utility methods
  parseColor(colorString) {
    if (!colorString || colorString === 'rgba(0, 0, 0, 0)' || colorString === 'transparent') {
      return null;
    }
    
    const rgb = colorString.match(/\d+/g);
    if (!rgb || rgb.length < 3) return null;
    
    return {
      r: parseInt(rgb[0]),
      g: parseInt(rgb[1]),
      b: parseInt(rgb[2]),
      a: rgb[3] ? parseFloat(rgb[3]) : 1
    };
  }

  calculateContrastRatio(color1, color2) {
    const l1 = this.getLuminance(color1);
    const l2 = this.getLuminance(color2);
    
    const brightest = Math.max(l1, l2);
    const darkest = Math.min(l1, l2);
    
    return (brightest + 0.05) / (darkest + 0.05);
  }

  getLuminance(color) {
    const { r, g, b } = color;
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  getFocusStyles(element) {
    // Simulate getting focus styles (in real implementation would trigger focus)
    const style = window.getComputedStyle(element);
    return {
      outline: style.outline !== 'none',
      boxShadow: style.boxShadow !== 'none',
      border: style.border !== 'none'
    };
  }

  addViolation(rule, message, element, details = {}) {
    this.violations.push({
      rule,
      message,
      element,
      details,
      severity: 'error',
      wcagLevel: this.currentLevel
    });
  }

  addWarning(rule, message, element, details = {}) {
    this.warnings.push({
      rule,
      message,
      element,
      details,
      severity: 'warning',
      wcagLevel: this.currentLevel
    });
  }

  addPass(rule, message, element, details = {}) {
    this.passes.push({
      rule,
      message,
      element,
      details,
      severity: 'pass',
      wcagLevel: this.currentLevel
    });
  }

  generateReport() {
    const total = this.violations.length + this.warnings.length + this.passes.length;
    const score = total > 0 ? (this.passes.length / total) * 100 : 0;
    
    return {
      score: Math.round(score),
      wcagLevel: this.currentLevel,
      summary: {
        violations: this.violations.length,
        warnings: this.warnings.length,
        passes: this.passes.length,
        total
      },
      violations: this.violations,
      warnings: this.warnings,
      passes: this.passes,
      compliance: {
        level: this.violations.length === 0 ? 'AA' : 'Partial',
        canImprove: this.warnings.length > 0
      }
    };
  }
}

describe('WCAG 2.1 AA Accessibility Tests', () => {
  let accessibilityFramework;

  beforeEach(() => {
    accessibilityFramework = new AccessibilityTestFramework();
    mockYouTubePage();
  });

  afterEach(() => {
    accessibilityFramework = null;
  });

  describe('Sidebar Component Accessibility', () => {
    test('should pass accessibility audit for sidebar', async () => {
      const sidebarHTML = `
        <nav class="astraltube-sidebar" role="navigation" aria-label="AstralTube Navigation">
          <h2>AstralTube</h2>
          <button class="collapse-btn" aria-label="Collapse sidebar" aria-expanded="true">
            <span aria-hidden="true">←</span>
          </button>
          <div class="sidebar-content">
            <section>
              <h3>Playlists</h3>
              <ul role="list">
                <li><a href="#favorites" tabindex="0">Favorites</a></li>
                <li><a href="#watch-later" tabindex="0">Watch Later</a></li>
                <li><a href="#music" tabindex="0">Music</a></li>
              </ul>
            </section>
            <section>
              <h3>Collections</h3>
              <ul role="list">
                <li><a href="#tech" tabindex="0">Tech Videos</a></li>
                <li><a href="#tutorials" tabindex="0">Tutorials</a></li>
              </ul>
            </section>
          </div>
        </nav>
      `;

      const sidebar = document.createElement('div');
      sidebar.innerHTML = sidebarHTML;
      document.body.appendChild(sidebar);

      const report = await accessibilityFramework.auditElement(sidebar);

      expect(report.violations.length).toBeLessThan(3);
      expect(report.score).toBeGreaterThan(70);

      // Check specific accessibility features
      const navElement = sidebar.querySelector('nav');
      expect(navElement.getAttribute('aria-label')).toBeTruthy();
      expect(navElement.getAttribute('role')).toBe('navigation');

      sidebar.remove();
    });

    test('should identify accessibility violations in poorly designed sidebar', async () => {
      const poorSidebarHTML = `
        <div class="bad-sidebar">
          <div>AstralTube</div>
          <button>←</button>
          <div>
            <div>Playlists</div>
            <div>
              <div onclick="navigate()">Favorites</div>
              <div onclick="navigate()" style="color: #ccc; background: #ddd;">Watch Later</div>
            </div>
          </div>
        </div>
      `;

      const sidebar = document.createElement('div');
      sidebar.innerHTML = poorSidebarHTML;
      document.body.appendChild(sidebar);

      const report = await accessibilityFramework.auditElement(sidebar);

      expect(report.violations.length).toBeGreaterThan(0);
      expect(report.score).toBeLessThan(50);

      // Should have violations for:
      // - Missing landmarks
      // - No semantic markup
      // - Poor color contrast
      // - No keyboard navigation
      const violationRules = report.violations.map(v => v.rule);
      expect(violationRules).toContain('button-no-text');

      sidebar.remove();
    });
  });

  describe('Form Accessibility', () => {
    test('should pass accessibility audit for playlist creation form', async () => {
      const formHTML = `
        <form class="playlist-form" role="form" aria-labelledby="form-title">
          <h2 id="form-title">Create New Playlist</h2>
          <div class="form-group">
            <label for="playlist-name">Playlist Name *</label>
            <input 
              type="text" 
              id="playlist-name" 
              name="name" 
              required 
              aria-required="true"
              aria-describedby="name-help"
            >
            <div id="name-help" class="help-text">Enter a descriptive name for your playlist</div>
          </div>
          <div class="form-group">
            <label for="playlist-description">Description</label>
            <textarea 
              id="playlist-description" 
              name="description"
              aria-describedby="desc-help"
            ></textarea>
            <div id="desc-help" class="help-text">Optional: Add a description for your playlist</div>
          </div>
          <div class="form-group">
            <fieldset>
              <legend>Privacy Settings</legend>
              <div>
                <input type="radio" id="public" name="privacy" value="public">
                <label for="public">Public</label>
              </div>
              <div>
                <input type="radio" id="private" name="privacy" value="private" checked>
                <label for="private">Private</label>
              </div>
            </fieldset>
          </div>
          <div class="form-actions">
            <button type="submit">Create Playlist</button>
            <button type="button">Cancel</button>
          </div>
        </form>
      `;

      const form = document.createElement('div');
      form.innerHTML = formHTML;
      document.body.appendChild(form);

      const report = await accessibilityFramework.auditElement(form);

      expect(report.violations.length).toBe(0);
      expect(report.score).toBeGreaterThan(85);

      // Check specific form accessibility features
      const inputs = form.querySelectorAll('input, textarea');
      inputs.forEach(input => {
        const id = input.getAttribute('id');
        const label = form.querySelector(`label[for="${id}"]`);
        expect(label).toBeTruthy();
      });

      form.remove();
    });

    test('should identify form accessibility issues', async () => {
      const badFormHTML = `
        <div class="bad-form">
          <div>Create Playlist</div>
          <input type="text" placeholder="Name">
          <input type="text" placeholder="Description">
          <div onclick="submit()">Create</div>
          <div onclick="cancel()">Cancel</div>
        </div>
      `;

      const form = document.createElement('div');
      form.innerHTML = badFormHTML;
      document.body.appendChild(form);

      const report = await accessibilityFramework.auditElement(form);

      expect(report.violations.length).toBeGreaterThan(0);

      // Should have violations for missing labels
      const hasLabelViolation = report.violations.some(v => v.rule === 'missing-label');
      expect(hasLabelViolation).toBe(true);

      form.remove();
    });
  });

  describe('Modal Dialog Accessibility', () => {
    test('should pass accessibility audit for modal dialog', async () => {
      const modalHTML = `
        <div class="modal-overlay" role="presentation">
          <div 
            class="modal-dialog" 
            role="dialog" 
            aria-modal="true"
            aria-labelledby="modal-title"
            aria-describedby="modal-description"
          >
            <div class="modal-header">
              <h2 id="modal-title">Confirm Delete</h2>
              <button class="close-btn" aria-label="Close dialog">×</button>
            </div>
            <div class="modal-body">
              <p id="modal-description">
                Are you sure you want to delete this playlist? This action cannot be undone.
              </p>
            </div>
            <div class="modal-footer">
              <button class="delete-btn" autofocus>Delete</button>
              <button class="cancel-btn">Cancel</button>
            </div>
          </div>
        </div>
      `;

      const modal = document.createElement('div');
      modal.innerHTML = modalHTML;
      document.body.appendChild(modal);

      const report = await accessibilityFramework.auditElement(modal);

      expect(report.violations.length).toBe(0);
      expect(report.score).toBeGreaterThan(90);

      // Check modal-specific features
      const dialog = modal.querySelector('[role="dialog"]');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();

      modal.remove();
    });
  });

  describe('Video Player Controls Accessibility', () => {
    test('should pass accessibility audit for video controls', async () => {
      const controlsHTML = `
        <div class="video-controls" role="toolbar" aria-label="Video controls">
          <button aria-label="Play video" class="play-btn">
            <span aria-hidden="true">▶</span>
          </button>
          <button aria-label="Pause video" class="pause-btn" style="display: none;">
            <span aria-hidden="true">⏸</span>
          </button>
          <div class="volume-control">
            <button aria-label="Mute" class="mute-btn">
              <span aria-hidden="true">🔊</span>
            </button>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value="75"
              aria-label="Volume"
              class="volume-slider"
            >
          </div>
          <div class="progress-control">
            <input 
              type="range" 
              min="0" 
              max="100" 
              value="30"
              aria-label="Video progress"
              aria-valuetext="3 minutes 20 seconds of 10 minutes 45 seconds"
              class="progress-slider"
            >
          </div>
          <button aria-label="Toggle fullscreen">
            <span aria-hidden="true">⛶</span>
          </button>
        </div>
      `;

      const controls = document.createElement('div');
      controls.innerHTML = controlsHTML;
      document.body.appendChild(controls);

      const report = await accessibilityFramework.auditElement(controls);

      expect(report.violations.length).toBeLessThan(2);
      expect(report.score).toBeGreaterThan(80);

      // Check that buttons have accessible labels
      const buttons = controls.querySelectorAll('button');
      buttons.forEach(button => {
        const hasLabel = button.getAttribute('aria-label') || button.textContent.trim();
        expect(hasLabel).toBeTruthy();
      });

      controls.remove();
    });
  });

  describe('Notification Accessibility', () => {
    test('should pass accessibility audit for notifications', async () => {
      const notificationHTML = `
        <div class="notifications-container" aria-live="polite" aria-label="Notifications">
          <div class="notification success" role="status" aria-atomic="true">
            <span class="icon" aria-hidden="true">✓</span>
            <span>Video added to playlist successfully</span>
            <button aria-label="Dismiss notification">×</button>
          </div>
          <div class="notification error" role="alert" aria-atomic="true">
            <span class="icon" aria-hidden="true">⚠</span>
            <span>Failed to delete playlist. Please try again.</span>
            <button aria-label="Dismiss notification">×</button>
          </div>
        </div>
      `;

      const notifications = document.createElement('div');
      notifications.innerHTML = notificationHTML;
      document.body.appendChild(notifications);

      const report = await accessibilityFramework.auditElement(notifications);

      expect(report.violations.length).toBe(0);
      expect(report.score).toBeGreaterThan(90);

      // Check ARIA live regions
      const container = notifications.querySelector('[aria-live]');
      expect(container.getAttribute('aria-live')).toBe('polite');

      const alertNotification = notifications.querySelector('[role="alert"]');
      expect(alertNotification).toBeTruthy();

      notifications.remove();
    });
  });

  describe('Keyboard Navigation', () => {
    test('should provide proper keyboard navigation', async () => {
      const navigationHTML = `
        <div class="keyboard-test">
          <a href="#skip-to-content" class="skip-link">Skip to content</a>
          <nav aria-label="Main navigation">
            <ul>
              <li><a href="#home">Home</a></li>
              <li><a href="#playlists" tabindex="0">Playlists</a></li>
              <li><a href="#subscriptions" tabindex="0">Subscriptions</a></li>
            </ul>
          </nav>
          <main id="skip-to-content" tabindex="-1">
            <h1>Main Content</h1>
            <button>Action Button</button>
            <input type="text" placeholder="Search">
          </main>
        </div>
      `;

      const navigation = document.createElement('div');
      navigation.innerHTML = navigationHTML;
      document.body.appendChild(navigation);

      const report = await accessibilityFramework.auditElement(navigation);

      expect(report.violations.length).toBeLessThan(3);

      // Check skip link functionality
      const skipLink = navigation.querySelector('.skip-link');
      const target = navigation.querySelector('#skip-to-content');
      expect(skipLink.getAttribute('href')).toBe('#skip-to-content');
      expect(target).toBeTruthy();

      navigation.remove();
    });
  });

  describe('Color Contrast', () => {
    test('should identify color contrast violations', async () => {
      const contrastHTML = `
        <div class="contrast-test">
          <p style="color: #999; background: #fff;">Good contrast text</p>
          <p style="color: #ccc; background: #fff;">Poor contrast text</p>
          <button style="color: #ddd; background: #eee;">Low contrast button</button>
          <a href="#" style="color: #4a90e2; background: #fff;">Good link contrast</a>
        </div>
      `;

      const contrast = document.createElement('div');
      contrast.innerHTML = contrastHTML;
      document.body.appendChild(contrast);

      const report = await accessibilityFramework.auditElement(contrast);

      // Should find color contrast violations
      const contrastViolations = report.violations.filter(v => v.rule === 'color-contrast');
      expect(contrastViolations.length).toBeGreaterThan(0);

      contrast.remove();
    });
  });

  describe('Responsive Design Accessibility', () => {
    test('should maintain accessibility across different viewport sizes', async () => {
      const responsiveHTML = `
        <div class="responsive-component">
          <nav aria-label="Responsive navigation">
            <button 
              class="menu-toggle" 
              aria-expanded="false" 
              aria-controls="mobile-menu"
              aria-label="Toggle navigation menu"
            >
              Menu
            </button>
            <ul id="mobile-menu" class="mobile-menu" hidden>
              <li><a href="#home">Home</a></li>
              <li><a href="#about">About</a></li>
              <li><a href="#contact">Contact</a></li>
            </ul>
          </nav>
        </div>
      `;

      const responsive = document.createElement('div');
      responsive.innerHTML = responsiveHTML;
      document.body.appendChild(responsive);

      // Test different viewport sizes
      const viewports = [
        { width: 320, height: 568 },  // Mobile
        { width: 768, height: 1024 }, // Tablet
        { width: 1920, height: 1080 } // Desktop
      ];

      for (const viewport of viewports) {
        Object.defineProperty(window, 'innerWidth', { value: viewport.width, writable: true });
        Object.defineProperty(window, 'innerHeight', { value: viewport.height, writable: true });
        
        const report = await accessibilityFramework.auditElement(responsive);
        
        // Should maintain accessibility across all viewports
        expect(report.violations.length).toBeLessThan(3);
        
        // Menu toggle should have proper ARIA attributes
        const menuToggle = responsive.querySelector('.menu-toggle');
        expect(menuToggle.getAttribute('aria-expanded')).toBeTruthy();
        expect(menuToggle.getAttribute('aria-controls')).toBeTruthy();
      }

      responsive.remove();
    });
  });

  describe('Screen Reader Compatibility', () => {
    test('should provide appropriate screen reader experience', async () => {
      const screenReaderHTML = `
        <div class="screen-reader-test">
          <h1>AstralTube Dashboard</h1>
          <div class="sr-only">Navigation instructions: Use arrow keys to navigate between sections</div>
          
          <section aria-labelledby="playlists-heading">
            <h2 id="playlists-heading">My Playlists</h2>
            <div class="playlist-count" aria-live="polite">
              <span class="sr-only">You have </span>3<span class="sr-only"> playlists</span>
            </div>
            <ul role="list">
              <li>
                <a href="#playlist1" aria-describedby="playlist1-info">
                  My Favorites
                </a>
                <div id="playlist1-info" class="sr-only">25 videos, last updated yesterday</div>
              </li>
            </ul>
          </section>
          
          <div class="loading" aria-hidden="true">
            <div class="spinner"></div>
          </div>
          <div class="sr-only" aria-live="polite" aria-atomic="true">
            <span id="loading-text">Loading playlists...</span>
          </div>
        </div>
      `;

      const screenReader = document.createElement('div');
      screenReader.innerHTML = screenReaderHTML;
      document.body.appendChild(screenReader);

      const report = await accessibilityFramework.auditElement(screenReader);

      expect(report.violations.length).toBe(0);

      // Check screen reader specific features
      const srOnlyElements = screenReader.querySelectorAll('.sr-only');
      expect(srOnlyElements.length).toBeGreaterThan(0);

      const liveRegions = screenReader.querySelectorAll('[aria-live]');
      expect(liveRegions.length).toBeGreaterThan(0);

      screenReader.remove();
    });
  });
});