#!/usr/bin/env node

/**
 * validate-package-group.js
 *
 * Validates a release group configuration and all packages for release readiness.
 * Checks versions, dependencies, changelog, and repository state.
 *
 * Usage:
 *   node validate-package-group.js [--group <groupId>] [--config <path>] [--strict]
 *
 * Environment:
 *   RELEASE_VALIDATE_STRICT=true   - Fail on warnings (not just errors)
 *   RELEASE_VALIDATE_DEPS=true     - Enable dependency validation
 *   RELEASE_CHECK_BREAKING=true    - Detect breaking changes
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

class GroupValidator {
  constructor(options = {}) {
    this.configPath = options.configPath || '.lightspeed/release-groups.json';
    this.groupId = options.groupId;
    this.strict = options.strict || process.env.RELEASE_VALIDATE_STRICT === 'true';
    this.validateDeps = options.validateDeps !== false && process.env.RELEASE_VALIDATE_DEPS !== 'false';
    this.checkBreaking = options.checkBreaking || process.env.RELEASE_CHECK_BREAKING === 'true';

    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.config = null;
    this.group = null;
  }

  /**
   * Main validation entry point
   */
  validate() {
    try {
      this.loadConfig();
      this.resolveGroup();
      this.validateGroupConfig();
      this.validatePackages();

      if (this.validateDeps) {
        this.validateDependencies();
      }

      if (this.checkBreaking) {
        this.detectBreakingChanges();
      }

      this.reportResults();
      return this.errors.length === 0;
    } catch (err) {
      this.errors.push(`Fatal error: ${err.message}`);
      this.reportResults();
      return false;
    }
  }

  /**
   * Load configuration file
   */
  loadConfig() {
    if (!fs.existsSync(this.configPath)) {
      throw new Error(`Config file not found: ${this.configPath}`);
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf8');
      this.config = JSON.parse(content);
      this.info.push(`Loaded config from ${this.configPath}`);
    } catch (err) {
      throw new Error(`Failed to parse config: ${err.message}`);
    }

    if (!this.config.groups || !Array.isArray(this.config.groups)) {
      throw new Error('Config must have "groups" array');
    }
  }

  /**
   * Resolve and select the group to validate
   */
  resolveGroup() {
    if (!this.groupId && this.config.groups.length === 1) {
      this.group = this.config.groups[0];
      this.groupId = this.group.id;
      this.info.push(`Using single group: ${this.groupId}`);
      return;
    }

    if (!this.groupId) {
      throw new Error('Must specify --group or have single group in config');
    }

    this.group = this.config.groups.find(g => g.id === this.groupId);
    if (!this.group) {
      throw new Error(`Group not found: ${this.groupId}`);
    }
  }

  /**
   * Validate group configuration structure
   */
  validateGroupConfig() {
    if (!this.group.id) {
      this.errors.push('Group must have "id"');
      return;
    }

    if (!this.group.name) {
      this.errors.push('Group must have "name"');
    }

    if (!this.group.packages || !Array.isArray(this.group.packages)) {
      this.errors.push('Group must have "packages" array');
      return;
    }

    if (this.group.packages.length < 2) {
      this.warnings.push('Group has only 1 package; multi-package release may not be needed');
    }

    const validStrategies = ['locked', 'independent'];
    if (!validStrategies.includes(this.group.versionStrategy)) {
      this.errors.push(`Invalid versionStrategy: ${this.group.versionStrategy}. Must be: ${validStrategies.join(', ')}`);
    }

    if (!this.group.releaseOrder || !Array.isArray(this.group.releaseOrder)) {
      this.errors.push('Group must have "releaseOrder" array');
      return;
    }

    // Validate release order
    const packageIds = this.group.packages.map(p => p.id);
    for (const orderId of this.group.releaseOrder) {
      if (!packageIds.includes(orderId)) {
        this.errors.push(`Unknown package in releaseOrder: ${orderId}`);
      }
    }

    if (this.group.releaseOrder.length !== new Set(this.group.releaseOrder).size) {
      this.errors.push('Duplicate package IDs in releaseOrder');
    }
  }

  /**
   * Validate each package in the group
   */
  validatePackages() {
    if (!this.group.packages) return;

    for (const pkg of this.group.packages) {
      this.validatePackageConfig(pkg);

      if (this.errors.length > 0 && !this.strict) {
        continue; // Skip detailed checks if already failed on config
      }

      this.validatePackageVersions(pkg);
      this.validatePackageRepository(pkg);
    }
  }

  /**
   * Validate individual package configuration
   */
  validatePackageConfig(pkg) {
    if (!pkg.id) {
      this.errors.push('Package must have "id"');
      return;
    }

    if (!pkg.repo) {
      this.errors.push(`Package ${pkg.id}: missing "repo" field`);
    }

    const validTypes = ['plugin', 'theme', 'library'];
    if (!validTypes.includes(pkg.type)) {
      this.errors.push(`Package ${pkg.id}: invalid type "${pkg.type}". Must be: ${validTypes.join(', ')}`);
    }

    if (!pkg.versionFile) {
      this.errors.push(`Package ${pkg.id}: missing "versionFile"`);
    }

    if (!pkg.versionField) {
      this.errors.push(`Package ${pkg.id}: missing "versionField"`);
    }
  }

  /**
   * Validate package versions
   */
  validatePackageVersions(pkg) {
    const versionPath = path.join(pkg.path || '.', pkg.versionFile);

    if (!fs.existsSync(versionPath)) {
      this.errors.push(`Package ${pkg.id}: version file not found: ${versionPath}`);
      return;
    }

    try {
      const content = fs.readFileSync(versionPath, 'utf8');
      const version = this.extractVersion(content, pkg.versionField, pkg.type);

      if (!version) {
        this.errors.push(`Package ${pkg.id}: could not extract version from ${pkg.versionFile}`);
        return;
      }

      if (!this.isValidSemVer(version)) {
        this.warnings.push(`Package ${pkg.id}: version "${version}" is not valid semantic versioning`);
      }

      this.info.push(`Package ${pkg.id}: version ${version}`);
    } catch (err) {
      this.errors.push(`Package ${pkg.id}: failed to read version: ${err.message}`);
    }
  }

  /**
   * Extract version from file based on type
   */
  extractVersion(content, field, type) {
    if (type === 'plugin') {
      // PHP: Version: 1.2.0
      const phpMatch = content.match(new RegExp(`[/*\\s]*${field}[:\\s]*([\\d.]+)`));
      if (phpMatch) return phpMatch[1];
    }

    if (type === 'theme') {
      // CSS: Version: 1.2.0
      const cssMatch = content.match(new RegExp(`${field}[:\\s]*([\\d.]+)`));
      if (cssMatch) return cssMatch[1];
    }

    if (field === 'version' && content.includes('"version"')) {
      // JSON: "version": "1.2.0"
      const jsonMatch = content.match(/"version"\s*:\s*"([^"]+)"/);
      if (jsonMatch) return jsonMatch[1];
    }

    return null;
  }

  /**
   * Validate package repository state
   */
  validatePackageRepository(pkg) {
    try {
      // Check for uncommitted changes
      const status = this.execGit(['status', '--porcelain'], pkg.path);
      if (status) {
        this.errors.push(`Package ${pkg.id}: uncommitted changes detected`);
      }

      // Check for untracked files
      const untracked = this.execGit(['ls-files', '--others', '--exclude-standard'], pkg.path);
      if (untracked) {
        this.warnings.push(`Package ${pkg.id}: untracked files present`);
      }

      // Check current branch
      const branch = this.execGit(['rev-parse', '--abbrev-ref', 'HEAD'], pkg.path).trim();
      if (branch !== 'develop' && branch !== 'main' && branch !== 'master') {
        this.warnings.push(`Package ${pkg.id}: on branch "${branch}" (expected develop/main/master)`);
      }
    } catch (err) {
      this.warnings.push(`Package ${pkg.id}: could not check repository: ${err.message}`);
    }
  }

  /**
   * Validate cross-package dependencies
   */
  validateDependencies() {
    if (!this.group.dependencies || this.group.dependencies.length === 0) {
      this.info.push('No cross-package dependencies configured');
      return;
    }

    for (const dep of this.group.dependencies) {
      this.validateDependency(dep);
    }
  }

  /**
   * Validate individual dependency
   */
  validateDependency(dep) {
    if (!dep.from || !dep.to) {
      this.errors.push(`Invalid dependency: missing from/to`);
      return;
    }

    // Check for circular dependencies
    if (dep.from === dep.to) {
      this.errors.push(`Circular dependency: ${dep.from} depends on itself`);
      return;
    }

    // Find packages
    const fromPkg = this.group.packages.find(p => p.id === dep.from);
    const toPkg = this.group.packages.find(p => p.id === dep.to);

    if (!fromPkg && dep.to !== 'wordpress') {
      this.errors.push(`Dependency references unknown package: ${dep.from}`);
      return;
    }

    if (!toPkg && dep.to !== 'wordpress') {
      this.errors.push(`Dependency references unknown package: ${dep.to}`);
      return;
    }

    // Validate constraint format
    if (!this.isValidConstraint(dep.constraint, dep.constraintType)) {
      this.errors.push(`Invalid constraint for ${dep.from}->${dep.to}: "${dep.constraint}"`);
    }

    // Check ordering if dependency has ordering implications
    if (fromPkg && toPkg) {
      const fromIdx = this.group.releaseOrder.indexOf(dep.from);
      const toIdx = this.group.releaseOrder.indexOf(dep.to);

      if (fromIdx < toIdx) {
        this.warnings.push(
          `Dependency ordering: ${dep.from} depends on ${dep.to}, ` +
          `but ${dep.from} releases before ${dep.to}`
        );
      }
    }
  }

  /**
   * Detect breaking changes in changelogs
   */
  detectBreakingChanges() {
    for (const pkg of this.group.packages) {
      const changelogPath = path.join(pkg.path || '.', pkg.changelog || 'CHANGELOG.md');

      if (!fs.existsSync(changelogPath)) {
        this.warnings.push(`Package ${pkg.id}: changelog not found at ${changelogPath}`);
        continue;
      }

      try {
        const content = fs.readFileSync(changelogPath, 'utf8');

        // Look for breaking change markers
        if (content.match(/BREAKING\s*CHANGE|###\s*Breaking/i)) {
          this.info.push(`Package ${pkg.id}: contains breaking changes`);

          // Extract the breaking change section
          const lines = content.split('\n');
          let inBreakingSection = false;
          const breakingChanges = [];

          for (const line of lines) {
            if (line.match(/###\s*Breaking|BREAKING\s*CHANGE/i)) {
              inBreakingSection = true;
              continue;
            }

            if (inBreakingSection && line.match(/^###/)) {
              inBreakingSection = false;
            }

            if (inBreakingSection && line.trim().startsWith('-')) {
              breakingChanges.push(line.trim());
            }
          }

          if (breakingChanges.length > 0) {
            this.warnings.push(`Package ${pkg.id}: breaking changes detected:\n  - ${breakingChanges.join('\n  - ')}`);
          }
        }
      } catch (err) {
        this.warnings.push(`Package ${pkg.id}: could not read changelog: ${err.message}`);
      }
    }
  }

  /**
   * Execute git command in package directory
   */
  execGit(args, cwd = '.') {
    // Arguments are passed as an argv array, never through a shell
    const cmd = ['git', ...args].join(' ');
    try {
      return execFileSync('git', args, { cwd, encoding: 'utf8' });
    } catch (err) {
      throw new Error(`Git command failed: ${cmd}`);
    }
  }

  /**
   * Check if string is valid semantic version
   */
  isValidSemVer(version) {
    return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/.test(version);
  }

  /**
   * Check if constraint is valid
   */
  isValidConstraint(constraint, type) {
    if (type === 'semver') {
      return /^[\^~>=<]?[\d.]+/.test(constraint);
    }
    if (type === 'min') {
      return /^\d+(\.\d+)*/.test(constraint);
    }
    return false;
  }

  /**
   * Report validation results
   */
  reportResults() {
    const hasIssues = this.errors.length > 0 || (this.strict && this.warnings.length > 0);

    console.log('\n' + '='.repeat(60));
    console.log(`Validation Report: ${this.groupId}`);
    console.log('='.repeat(60) + '\n');

    if (this.info.length > 0) {
      console.log('ℹ️  Info:');
      this.info.forEach(msg => console.log(`  ${msg}`));
      console.log();
    }

    if (this.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      this.warnings.forEach(msg => console.log(`  ${msg}`));
      console.log();
    }

    if (this.errors.length > 0) {
      console.log('❌ Errors:');
      this.errors.forEach(msg => console.log(`  ${msg}`));
      console.log();
    }

    if (!hasIssues) {
      console.log('✅ All validations passed!');
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Summary: ${this.errors.length} errors, ${this.warnings.length} warnings`);
    console.log('='.repeat(60) + '\n');
  }
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    configPath: '.lightspeed/release-groups.json',
    groupId: null,
    strict: false,
    validateDeps: true,
    checkBreaking: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--group' && args[i + 1]) {
      options.groupId = args[++i];
    } else if (args[i] === '--config' && args[i + 1]) {
      options.configPath = args[++i];
    } else if (args[i] === '--strict') {
      options.strict = true;
    } else if (args[i] === '--check-breaking') {
      options.checkBreaking = true;
    }
  }

  const validator = new GroupValidator(options);
  const success = validator.validate();

  process.exit(success ? 0 : 1);
}

module.exports = GroupValidator;
