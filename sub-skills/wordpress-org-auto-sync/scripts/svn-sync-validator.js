#!/usr/bin/env node

/**
 * SVN Sync Validator for WordPress.org Auto-Sync
 *
 * Validates WordPress.org SVN publishing readiness:
 * - Plugin/theme headers match version tags
 * - readme.txt format is correct
 * - Assets meet WordPress.org dimension requirements
 * - File exclusions are properly configured
 * - SVN structure is valid
 *
 * Usage:
 *   node svn-sync-validator.js --type=plugin --path=/path/to/plugin
 *   node svn-sync-validator.js --type=theme --path=/path/to/theme
 */

const fs = require('fs');
const path = require('path');

class SVNSyncValidator {
  constructor(type, pluginPath) {
    this.type = type; // 'plugin' or 'theme'
    this.pluginPath = pluginPath;
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.version = null;
    this.headerFile = null;
  }

  /**
   * Main validation entry point
   */
  validate() {
    console.log(`\n🔍 Validating ${this.type} for WordPress.org sync...`);
    console.log(`   Path: ${this.pluginPath}\n`);

    try {
      if (this.type === 'plugin') {
        this.validatePlugin();
      } else if (this.type === 'theme') {
        this.validateTheme();
      } else {
        this.errors.push(`Invalid type: ${this.type}. Use 'plugin' or 'theme'.`);
      }

      this.validateReadme();
      this.validateAssets();
      this.validateExclusions();
      this.validateFileStructure();

      this.report();
      process.exit(this.errors.length > 0 ? 1 : 0);
    } catch (err) {
      this.errors.push(`Fatal error: ${err.message}`);
      this.report();
      process.exit(1);
    }
  }

  /**
   * Validate plugin-specific requirements
   */
  validatePlugin() {
    // Find main plugin file
    const files = fs.readdirSync(this.pluginPath);
    const phpFiles = files.filter(f => f.endsWith('.php') && fs.statSync(path.join(this.pluginPath, f)).isFile());

    if (phpFiles.length === 0) {
      this.errors.push('No PHP files found in plugin root');
      return;
    }

    // Look for plugin header
    let pluginHeaderFound = false;
    for (const phpFile of phpFiles) {
      const content = fs.readFileSync(path.join(this.pluginPath, phpFile), 'utf8');
      if (content.includes('Plugin Name:') && content.includes('Version:')) {
        pluginHeaderFound = true;
        this.headerFile = phpFile;

        // Extract version
        const versionMatch = content.match(/Version:\s*([^\n]+)/);
        if (versionMatch) {
          this.version = versionMatch[1].trim();
          this.info.push(`✓ Plugin header found in ${phpFile}`);
          this.info.push(`✓ Version detected: ${this.version}`);
        }
        break;
      }
    }

    if (!pluginHeaderFound) {
      this.errors.push('No valid plugin header found (missing "Plugin Name:" or "Version:")');
      return;
    }

    // Validate header format
    this.validatePluginHeader();
  }

  /**
   * Validate plugin header fields
   */
  validatePluginHeader() {
    const headerPath = path.join(this.pluginPath, this.headerFile);
    const content = fs.readFileSync(headerPath, 'utf8');

    const requiredFields = [
      'Plugin Name',
      'Description',
      'Version',
      'Author',
      'License',
      'License URI'
    ];

    for (const field of requiredFields) {
      if (!content.includes(`${field}:`)) {
        this.errors.push(`Missing required header field: "${field}" in ${this.headerFile}`);
      }
    }

    // Check for valid license
    if (!content.includes('GPL') && !content.includes('MIT')) {
      this.warnings.push('License should be GPL or MIT for WordPress.org');
    }

    // Validate version format (semantic versioning)
    if (!this.isValidSemanticVersion(this.version)) {
      this.errors.push(`Invalid version format: "${this.version}". Use semantic versioning (e.g., 1.0.0)`);
    }
  }

  /**
   * Validate theme-specific requirements
   */
  validateTheme() {
    // Check for style.css
    const styleCssPath = path.join(this.pluginPath, 'style.css');
    if (!fs.existsSync(styleCssPath)) {
      this.errors.push('Missing required file: style.css');
      return;
    }

    const styleContent = fs.readFileSync(styleCssPath, 'utf8');

    // Extract theme header
    if (!styleContent.includes('Theme Name:')) {
      this.errors.push('Missing "Theme Name:" in style.css');
      return;
    }

    const versionMatch = styleContent.match(/Version:\s*([^\n]+)/);
    if (versionMatch) {
      this.version = versionMatch[1].trim();
      this.info.push(`✓ Theme header found in style.css`);
      this.info.push(`✓ Version detected: ${this.version}`);
    } else {
      this.errors.push('Missing "Version:" in style.css');
      return;
    }

    // Validate version format
    if (!this.isValidSemanticVersion(this.version)) {
      this.errors.push(`Invalid version format: "${this.version}". Use semantic versioning (e.g., 1.0.0)`);
    }

    // Check for theme.json
    const themeJsonPath = path.join(this.pluginPath, 'theme.json');
    if (!fs.existsSync(themeJsonPath)) {
      this.warnings.push('Recommended: Add theme.json for full block theme support');
    } else {
      this.info.push(`✓ theme.json found`);
      try {
        const themeJson = JSON.parse(fs.readFileSync(themeJsonPath, 'utf8'));
        if (themeJson.version !== 2) {
          this.warnings.push(`theme.json version is ${themeJson.version}, version 2 is recommended`);
        }
      } catch (err) {
        this.errors.push(`Invalid JSON in theme.json: ${err.message}`);
      }
    }

    // Validate theme header fields
    this.validateThemeHeader(styleContent);
  }

  /**
   * Validate theme header fields in style.css
   */
  validateThemeHeader(content) {
    const requiredFields = [
      'Theme Name',
      'Description',
      'Version',
      'Author',
      'License',
      'License URI'
    ];

    for (const field of requiredFields) {
      if (!content.includes(`${field}:`)) {
        this.errors.push(`Missing required header field: "${field}" in style.css`);
      }
    }
  }

  /**
   * Validate readme.txt format and content
   */
  validateReadme() {
    const readmePath = path.join(this.pluginPath, 'readme.txt');
    if (!fs.existsSync(readmePath)) {
      this.errors.push('Missing required file: readme.txt');
      return;
    }

    const content = fs.readFileSync(readmePath, 'utf8');

    // Check for required sections
    const requiredSections = ['Description', 'Installation', 'Changelog'];
    for (const section of requiredSections) {
      if (!content.includes(`== ${section} ==`)) {
        this.errors.push(`Missing required section in readme.txt: "== ${section} =="`);
      }
    }

    // Check for stable tag
    const stableTagMatch = content.match(/Stable tag:\s*([^\n]+)/i);
    if (!stableTagMatch) {
      this.errors.push('Missing "Stable tag:" in readme.txt');
    } else {
      const stableTag = stableTagMatch[1].trim();
      if (this.version && stableTag !== this.version) {
        this.errors.push(`Version mismatch: header version is ${this.version}, stable tag is ${stableTag}`);
      }
    }

    // Validate contributors field
    if (!content.match(/Contributors:\s*[^\n]+/i)) {
      this.warnings.push('Recommended: Add "Contributors:" field to readme.txt');
    }

    this.info.push(`✓ readme.txt is properly formatted`);
  }

  /**
   * Validate asset files (icons, banners, screenshots)
   */
  validateAssets() {
    const assetsPath = path.join(this.pluginPath, 'assets');
    if (!fs.existsSync(assetsPath)) {
      this.warnings.push('No assets directory found (icon, banner, screenshots recommended)');
      return;
    }

    const files = fs.readdirSync(assetsPath);
    const imageFiles = files.filter(f => /\.(png|jpg|jpeg)$/i.test(f));

    if (imageFiles.length === 0) {
      this.warnings.push('No image assets found in /assets directory');
      return;
    }

    this.info.push(`✓ Found ${imageFiles.length} asset files`);

    if (this.type === 'plugin') {
      this.validatePluginAssets(assetsPath, imageFiles);
    } else if (this.type === 'theme') {
      this.validateThemeAssets(assetsPath, imageFiles);
    }
  }

  /**
   * Validate plugin-specific assets
   */
  validatePluginAssets(assetsPath, imageFiles) {
    // Check for icon
    const icons = imageFiles.filter(f => f.match(/icon-(\d+)x\1\.(png|jpg|jpeg)$/i));
    if (icons.length === 0) {
      this.warnings.push('Recommended: Add icon-128x128.png or icon-256x256.png');
    } else {
      this.info.push(`✓ Plugin icon(s) found: ${icons.join(', ')}`);
    }

    // Check for banner
    const banners = imageFiles.filter(f => f.includes('banner') && f.match(/banner-772x250/i));
    if (banners.length === 0) {
      this.warnings.push('Recommended: Add banner-772x250.jpg for plugin directory header');
    } else {
      this.info.push(`✓ Plugin banner found: ${banners[0]}`);
    }

    // Check for screenshots
    const screenshots = imageFiles.filter(f => f.match(/screenshot-\d+/i));
    if (screenshots.length === 0) {
      this.warnings.push('Recommended: Add screenshots (screenshot-1.png, screenshot-2.png, etc.)');
    } else {
      this.info.push(`✓ Screenshots found: ${screenshots.length} files`);
    }
  }

  /**
   * Validate theme-specific assets
   */
  validateThemeAssets(assetsPath, imageFiles) {
    // Check for screenshot
    const screenshots = imageFiles.filter(f => f.match(/screenshot\.(png|jpg|jpeg)$/i));
    if (screenshots.length === 0) {
      this.warnings.push('Recommended: Add screenshot.png (1200×900px) to assets/ or root');
    } else {
      this.info.push(`✓ Theme screenshot found: ${screenshots[0]}`);
    }

    // Check for banner
    const banners = imageFiles.filter(f => f.includes('banner') && f.match(/banner-772x250/i));
    if (banners.length > 0) {
      this.info.push(`✓ Theme banner found: ${banners[0]}`);
    }
  }

  /**
   * Validate excluded files are not present
   */
  validateExclusions() {
    const excludedPatterns = [
      '.git',
      '.github',
      'node_modules',
      'vendor',
      'build',
      'dist',
      '.env',
      '.DS_Store',
      'composer.lock',
      'package-lock.json'
    ];

    const filesToCheck = this.getAllFiles(this.pluginPath);

    for (const pattern of excludedPatterns) {
      for (const file of filesToCheck) {
        if (file.includes(pattern)) {
          this.errors.push(`Excluded file/directory found: ${file} (must not be in WordPress.org sync)`);
        }
      }
    }

    this.info.push(`✓ Checked ${filesToCheck.length} files against exclusion patterns`);
  }

  /**
   * Recursively get all files in directory
   */
  getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        if (!file.startsWith('.')) {
          this.getAllFiles(filePath, fileList);
        }
      } else {
        fileList.push(path.relative(this.pluginPath, filePath));
      }
    }

    return fileList;
  }

  /**
   * Validate overall file structure
   */
  validateFileStructure() {
    const hasReadme = fs.existsSync(path.join(this.pluginPath, 'readme.txt'));
    const hasLicense = fs.existsSync(path.join(this.pluginPath, 'LICENSE')) ||
                       fs.existsSync(path.join(this.pluginPath, 'LICENSE.txt'));

    if (!hasReadme) {
      this.errors.push('Missing readme.txt at root');
    }

    if (!hasLicense) {
      this.warnings.push('Recommended: Add LICENSE or LICENSE.txt file');
    } else {
      this.info.push(`✓ License file present`);
    }
  }

  /**
   * Check if version string is valid semantic versioning
   */
  isValidSemanticVersion(version) {
    // Allow: 1.0.0, 1.0.0-beta, 1.0.0-rc.1, etc.
    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
    return semverRegex.test(version);
  }

  /**
   * Print validation report
   */
  report() {
    console.log('\n' + '='.repeat(70));
    console.log('VALIDATION REPORT');
    console.log('='.repeat(70) + '\n');

    // Info messages
    if (this.info.length > 0) {
      console.log('ℹ️  INFO:');
      this.info.forEach(msg => console.log(`   ${msg}`));
      console.log();
    }

    // Warnings
    if (this.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      this.warnings.forEach(msg => console.log(`   ${msg}`));
      console.log();
    }

    // Errors
    if (this.errors.length > 0) {
      console.log('❌ ERRORS:');
      this.errors.forEach(msg => console.log(`   ${msg}`));
      console.log();
    }

    // Summary
    const status = this.errors.length === 0 ? '✅ PASS' : '❌ FAIL';
    const summary = `${status} - ${this.errors.length} errors, ${this.warnings.length} warnings`;
    console.log('-'.repeat(70));
    console.log(summary);
    console.log('-'.repeat(70) + '\n');

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✨ Ready for WordPress.org sync!\n');
    } else if (this.errors.length === 0) {
      console.log('⚠️  Ready for sync, but consider the warnings above.\n');
    } else {
      console.log('Fix the errors above before syncing to WordPress.org.\n');
    }
  }
}

// CLI entry point
const args = process.argv.slice(2);
let type = null;
let pluginPath = null;

for (const arg of args) {
  if (arg.startsWith('--type=')) {
    type = arg.split('=')[1];
  } else if (arg.startsWith('--path=')) {
    pluginPath = arg.split('=')[1];
  }
}

if (!type || !pluginPath) {
  console.error('Usage: node svn-sync-validator.js --type=plugin|theme --path=/path/to/plugin');
  console.error('Example: node svn-sync-validator.js --type=plugin --path=./block-hero');
  process.exit(1);
}

const validator = new SVNSyncValidator(type, pluginPath);
validator.validate();
