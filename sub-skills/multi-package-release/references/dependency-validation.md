# Dependency Validation Reference

Comprehensive guide to defining, validating, and troubleshooting cross-package dependencies.

> **Note:** the `lspeed` command used in the examples below is not included in this repository. Treat those
> commands as illustrative of the intended workflow, not as something you can run today. The scripts in
> `scripts/` (`validate-package-group.js`, `check-cross-dependencies.js`) are the parts that exist.

## Overview

Cross-package dependencies ensure that when packages release together, they're compatible and ready to work together. This document covers:

1. Defining dependencies
2. Validation strategies
3. Resolving conflicts
4. Handling breaking changes

---

## Dependency Types

### 1. Peer Dependencies

One package requires a specific version of another package to function.

**Example**: Theme requires plugin ≥1.2.0

```json
{
  "from": "my-theme",
  "to": "my-blocks",
  "type": "peer",
  "constraint": "^1.2.0",
  "constraintType": "semver"
}
```

**Where to Define**:
- Theme's `package.json`: `"peerDependencies": {"@lspeed/blocks": "^1.2.0"}`
- Multi-package config: `dependencies` array

**Validation**:
- Check theme's peerDependencies or composer.json
- Verify plugin version satisfies constraint
- Block release if incompatible

**Error Example**:
```
Theme requires plugin ^1.2.0 but release defines 1.1.0
└─ Suggestion: Bump plugin to 1.2.0 or update theme constraint
```

### 2. Feature Dependencies

One package declares support for features that another provides.

**Example**: Plugin provides blocks, theme declares support for block styles.

```json
{
  "from": "my-theme",
  "to": "my-blocks",
  "type": "feature",
  "feature": "custom-block-colors",
  "minVersion": "1.2.0"
}
```

**Where to Define**:
- Theme's `functions.php`: `add_theme_support('custom-block-colors')`
- Plugin's documentation: "Available since v1.2.0"
- Multi-package config: `dependencies` array

**Validation**:
- Scan theme for `add_theme_support()` calls
- Verify plugin exports matching features
- Block release if features not supported

**Error Example**:
```
Plugin provides feature "hero-block" (v1.2.0+)
Theme doesn't declare support for "hero-block"
└─ Suggestion: Add add_theme_support('hero-block') to theme
```

### 3. Capability Dependencies

One package requires WordPress or PHP capabilities.

**Example**: Plugin uses Block Bindings API (requires WordPress 6.4+)

```json
{
  "from": "my-blocks",
  "to": "wordpress",
  "type": "capability",
  "constraint": "6.4",
  "constraintType": "min"
}
```

**Where to Define**:
- Plugin header: `Requires at least: 6.4`
- Theme header: `Requires at least: 6.4`
- Multi-package config: `dependencies` array

**Validation**:
- Read version from plugin/theme headers
- Compare against WordPress version running
- Block release if requirements not met

**Error Example**:
```
Plugin requires WordPress 6.4 but site runs 6.3
└─ Suggestion: Update WordPress before releasing
```

---

## Constraint Formats

### Semantic Versioning (SemVer)

For npm packages and modern WordPress packages:

```
^1.2.0    - Compatible with 1.2.0+ (up to <2.0.0)
~1.2.0    - Patch-level changes (1.2.0 to 1.2.x)
1.2.0     - Exact version only
>=1.2.0   - 1.2.0 or later
<=1.2.0   - 1.2.0 or earlier
1.2.0 - 2.0.0  - Version range
```

**Configuration**:
```json
{
  "constraint": "^1.2.0",
  "constraintType": "semver"
}
```

### Minimum Version

For WordPress, PHP, or simple comparisons:

```
6.4       - Minimum version 6.4
7.0+      - PHP 7.0 or higher
```

**Configuration**:
```json
{
  "constraint": "6.4",
  "constraintType": "min"
}
```

---

## Validation Workflow

### Pre-Release Validation

```bash
lspeed release --group blocks-and-theme --validate-deps
```

**Steps**:
1. Read versions from all packages
2. Collect all dependency definitions
3. For each dependency:
   - Check `from` package version against `to` requirement
   - Verify constraint is satisfied
   - Check for breaking changes
   - Validate feature support
4. Report findings
5. Block release if any validation fails

### Detailed Validation Example

**Config**:
```json
{
  "packages": [
    {"id": "my-blocks", "type": "plugin", "versionFile": "my-blocks.php"},
    {"id": "my-theme", "type": "theme", "versionFile": "style.css"}
  ],
  "dependencies": [
    {
      "from": "my-theme",
      "to": "my-blocks",
      "constraint": "^1.2.0",
      "constraintType": "semver"
    }
  ]
}
```

**Execution**:
```
Step 1: Read versions
├─ my-blocks: 1.2.0 (from my-blocks.php)
└─ my-theme: 1.2.0 (from style.css)

Step 2: Evaluate dependency
├─ Constraint: my-theme requires my-blocks ^1.2.0
├─ Actual: 1.2.0
└─ Match: ✓ (1.2.0 satisfies ^1.2.0)

Step 3: Check for breaking changes
├─ Changelog (my-blocks 1.1.0→1.2.0):
│  └─ No "BREAKING CHANGE" markers
├─ Changelog (my-theme 1.1.0→1.2.0):
│  └─ No incompatible changes
└─ Result: ✓ No breaking changes

Step 4: Feature support check
├─ Plugin exports: hero-block, cta-block, quote-block
├─ Theme declares: add_theme_support('hero-block')
│                 add_theme_support('cta-block')
│                 add_theme_support('quote-block')
└─ Result: ✓ All features supported

Summary: All dependencies valid ✓
```

---

## Breaking Change Detection

When a package has breaking changes, validation becomes stricter.

### How to Mark Breaking Changes

**In Changelog**:
```markdown
## [1.2.0]

### Breaking Changes
- Block metadata format changed from v1 to v2
  - All blocks now use new format
  - Theme must be updated to handle v2 metadata
```

**In Package Header (PHP)**:
```php
<?php
/**
 * Plugin Name: My Blocks
 * Version: 1.2.0
 * 
 * @breaking Block API changed. See MIGRATION.md
 */
```

### Validation with Breaking Changes

```bash
lspeed release --group blocks-and-theme --validate-deps --check-breaking
```

**Output**:
```
Breaking Change Alert ⚠️

my-blocks v1.2.0 has breaking changes:
├─ BREAKING: Block metadata format (v1 → v2)
├─ Impact: Themes must update to parse new format
└─ Theme Status: ✗ NOT UPDATED

Resolution Required:
1. Update my-theme to handle v2 metadata
2. Test my-theme with v1.2.0 blocks
3. Update version to match or bump

Current state blocks release.
```

### Responding to Breaking Changes

**Option 1: Update theme to handle new format**
```bash
# Update my-theme to v1.2.0 with breaking change support
lspeed release --group blocks-and-theme --validate-deps --check-breaking
# Should now pass
```

**Option 2: Release solo with warning**
```bash
# Release plugin solo with deprecation warning
lspeed release --group blocks-and-theme --release-solo my-blocks --warn
# Marks theme as "incompatible with plugin v1.2.0"
```

**Option 3: Hold release until ready**
```bash
# Postpone release until both packages ready
lspeed release --group blocks-and-theme --postpone
```

---

## Common Validation Errors & Fixes

### Error 1: Version Constraint Mismatch

```
ERROR: Theme requires plugin ^1.2.0
Actual: Plugin v1.1.0

Theme's peerDependencies:
  "@lspeed/blocks": "^1.2.0"

Release defines:
  "plugin": "1.1.0"

The 1.1.0 does not satisfy ^1.2.0 (requires >=1.2.0 <2.0.0)
```

**Fix**:
```json
// Option 1: Bump plugin version in release
{
  "packages": [
    {"id": "my-blocks", "targetVersion": "1.2.0"}
  ]
}

// Option 2: Update theme's peerDependencies
{
  "peerDependencies": {
    "@lspeed/blocks": "^1.1.0"  // Accept 1.1.0
  }
}
```

### Error 2: WordPress Version Mismatch

```
ERROR: WordPress version requirement mismatch

Plugin requires: WordPress 6.5+
Theme requires: WordPress 6.4+

This creates conflicting requirements.
Users on WordPress 6.4 cannot use the plugin.
```

**Fix**:
```php
// Option 1: Lower plugin requirement
/**
 * Plugin Name: My Blocks
 * Requires at least: 6.4
 */

// Option 2: Raise theme requirement
/*
Theme Name: My Theme
Requires at least: 6.5
*/
```

### Error 3: Missing Feature Support

```
ERROR: Feature compatibility check failed

Plugin v1.2.0 provides: hero-block, cta-block, quote-block
Theme declares support: hero-block, cta-block

Missing support for: quote-block
└─ Theme must declare: add_theme_support('quote-block')
```

**Fix**:
```php
// In theme's functions.php
add_theme_support('hero-block');
add_theme_support('cta-block');
add_theme_support('quote-block');  // Add missing support
```

### Error 4: Circular Dependencies

```
ERROR: Circular dependency detected

my-blocks (v1.2.0) → requires my-theme ^1.2.0
my-theme (v1.2.0) → requires my-blocks ^1.2.0

Cannot determine release order.
```

**Fix**:
```json
// Remove circular reference (one must not depend on other)
{
  "dependencies": [
    {
      "from": "my-theme",
      "to": "my-blocks",
      "constraint": "^1.2.0"
      // Remove: my-blocks → my-theme dependency
    }
  ]
}
```

---

## Validation in CI/CD

### GitHub Actions

```yaml
name: Validate Release

on: [pull_request]

jobs:
  validate-release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Validate multi-package config
        run: |
          lspeed release --validate-config .lightspeed/release-groups.json
      
      - name: Check dependencies
        run: |
          lspeed release --group blocks-and-theme --validate-deps
      
      - name: Detect breaking changes
        run: |
          lspeed release --group blocks-and-theme --validate-deps --check-breaking
```

---

## Advanced: Feature Negotiation Matrix

For complex systems, document which features work with which versions:

### Feature Support Matrix

```markdown
| Feature | Plugin Min | Theme Support | Notes |
|---------|-----------|---|---|
| hero-block | 1.2.0 | ✓ 1.2.0+ | Full support |
| cta-block | 1.1.0 | ✓ 1.0.0+ | Backward compatible |
| quote-block | 1.2.0 | ✓ 1.2.0+ | Requires styles |
| animations | 1.3.0 | ✓ 1.2.0+ | Theme has partial support |
| custom-colors | 1.2.0 | ✓ 1.2.0+ | New in both |
```

**Configuration**:
```json
{
  "featureMatrix": "references/feature-matrix.md",
  "validateFeatureMatrix": true
}
```

---

## Validation Best Practices

1. **Always validate before release**: Make it mandatory in CI/CD
2. **Document dependencies**: Update README with version requirements
3. **Test cross-package integration**: Ensure blocks render with theme styles
4. **Version lock if coupled**: Use "locked" strategy if packages must move together
5. **Clear changelog**: Mark breaking changes prominently
6. **Notify users**: Include compatibility notes in release body
7. **Monitor compatibility**: Track user reports of version mismatches
8. **Have rollback plan**: Know how to revert if incompatibility found

---

## See Also

- [[multi-package-config.md]] - Configuration reference
- [[rollback-procedures.md]] - Recovery procedures
- [[release]] - Main release skill
