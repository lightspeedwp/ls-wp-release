# Test Case: Validate Multi-Package Dependencies

## Scenario
Verify cross-package version compatibility before releasing. Test both passing and failing validation scenarios.

> **Note:** the `lspeed` command used in this test case is not included in this repository. Treat its commands
> and outputs as illustrative of the intended workflow, not as something you can run today.

## Setup

### Release Config
```json
{
  "group": "blocks-and-theme",
  "packages": [
    {
      "repo": "my-blocks",
      "type": "plugin",
      "path": "plugins/my-blocks",
      "versionFile": "my-blocks.php"
    },
    {
      "repo": "my-theme",
      "type": "theme",
      "path": "themes/my-theme",
      "versionFile": "style.css"
    }
  ],
  "dependencies": [
    {
      "from": "my-theme",
      "to": "my-blocks",
      "type": "peer",
      "constraint": "^1.2.0",
      "constraintType": "semver"
    },
    {
      "from": "my-blocks",
      "to": "wordpress",
      "constraint": ">=6.4",
      "constraintType": "semver"
    }
  ]
}
```

### Package Version Files

**Plugin (my-blocks.php)**:
```php
<?php
/**
 * Plugin Name: My Blocks
 * Version: 1.2.0
 * Requires at least: 6.4
 */
```

**Theme (package.json)**:
```json
{
  "name": "my-theme",
  "version": "1.2.0",
  "peerDependencies": {
    "@lspeed/blocks": "^1.2.0"
  }
}
```

**Theme (style.css)**:
```css
/*
Theme Name: My Theme
Theme URI: https://example.com
Version: 1.2.0
Requires at least: 6.4
*/
```

---

## Test Case 1: Successful Dependency Validation

### Input
Release versions:
- Plugin: 1.2.0
- Theme: 1.2.0

### Command
```bash
lspeed release --group blocks-and-theme --validate-deps --verbose
```

### Expected Output
```
Validating multi-package dependencies for: blocks-and-theme

Dependency Checks:
✓ Theme requires plugin ^1.2.0
  └─ Plugin v1.2.0 satisfies constraint

✓ Both require WordPress 6.4+
  └─ Plugin Requires: 6.4
  └─ Theme Requires: 6.4
  └─ Current WordPress: 6.4.1 ✓

✓ Feature compatibility
  └─ Plugin exposes: 5 new blocks
  └─ Theme supports: 5 new blocks
  └─ Coverage: 100% ✓

✓ Block style requirements
  └─ Plugin requires custom color picker: included in v1.2.0
  └─ Theme provides styles for all block types

Cross-Version Checks:
✓ Plugin v1.2.0 has no breaking changes
✓ Theme v1.2.0 compatible with all previous plugin versions >=1.1.0

Summary: All dependencies valid ✓
Proceed to release? [y/n]
```

### Acceptance Criteria
✓ All dependency constraints satisfied  
✓ WordPress version requirements met  
✓ No version mismatches detected  
✓ Feature coverage validated  
✓ Block style alignment confirmed  

---

## Test Case 2: Failed Dependency - Incompatible Plugin Version

### Input
Release versions:
- Plugin: 1.1.0 (not bumped)
- Theme: 1.2.0 (bumped)

### Theme's Constraint
```json
{
  "peerDependencies": {
    "@lspeed/blocks": "^1.2.0"
  }
}
```

### Command
```bash
lspeed release --group blocks-and-theme --validate-deps
```

### Expected Output
```
Validating multi-package dependencies for: blocks-and-theme

Dependency Validation FAILED ✗

Theme requires plugin ^1.2.0:
✗ Plugin v1.1.0 does NOT satisfy constraint ^1.2.0
  └─ Available: 1.1.0
  └─ Required: 1.2.0 or later
  └─ Gap: 0.1.0 patch version behind

Resolution Options:
1. Bump plugin to 1.2.0 (recommended)
2. Bump theme to 1.1.1 (not compatible)
3. Adjust theme's peerDependencies to ^1.1.0

Recommendation: Bump plugin version to match theme

Exit code: 1 (Release blocked)
```

### Acceptance Criteria
✓ Dependency validation fails  
✓ Clear error message identifies mismatch  
✓ Suggests resolution path  
✓ Release orchestration halted  
✓ No packages released  

---

## Test Case 3: Failed Dependency - WordPress Version

### Input
Release versions:
- Plugin: 1.2.0 (requires WordPress 6.5+)
- Theme: 1.2.0 (requires WordPress 6.4+)
- Current WordPress: 6.4.1

### Plugin Version File
```php
<?php
/**
 * Plugin Name: My Blocks
 * Version: 1.2.0
 * Requires at least: 6.5
 */
```

### Command
```bash
lspeed release --group blocks-and-theme --validate-deps
```

### Expected Output
```
Validating multi-package dependencies for: blocks-and-theme

WordPress Version Mismatch ✗

Plugin requires: WordPress 6.5+
Theme requires: WordPress 6.4+
  └─ Conflict: Plugin newer than theme
  └─ Users on WordPress 6.4 cannot use plugin
  └─ Theme will appear unsupported

Resolution:
Option 1: Bump theme requirement to 6.5
Option 2: Lower plugin requirement to 6.4
Option 3: Document incompatibility in release notes

Recommendation: Align both to WordPress 6.4
(unless plugin genuinely requires new 6.5 features)

Exit code: 1 (Release blocked)
```

### Acceptance Criteria
✓ Detects WordPress version mismatch  
✓ Identifies which package is newer  
✓ Explains user impact  
✓ Suggests resolution  
✓ Blocks release with clear error  

---

## Test Case 4: Advanced Feature Compatibility Check

### Setup
Plugin introduces breaking change in custom block metadata format.

**Plugin changelog**:
```markdown
## [1.2.0]
- BREAKING: Change block metadata format from v1 to v2
- All blocks now use new format
```

**Theme package.json**:
```json
{
  "dependencies": {
    "@lspeed/blocks": "^1.2.0"
  },
  "blockMetadataVersion": "v1"
}
```

### Command
```bash
lspeed release --group blocks-and-theme --validate-deps --check-breaking
```

### Expected Output
```
Validating multi-package dependencies for: blocks-and-theme

Breaking Change Detection ⚠️

Plugin v1.2.0 introduces breaking changes:
✗ Block metadata format changed (v1 → v2)
  └─ Plugin: Emits v2 format
  └─ Theme: Expects v1 format
  └─ Consequence: Theme cannot parse plugin blocks

Required Actions:
1. Update theme to handle block metadata v2
2. Bump theme version to match breaking change
3. Add migration guide to release notes

Current Status:
- Plugin ready: ✓
- Theme ready: ✗ (Not updated for new format)

Recommendation: Update theme before release

Exit code: 1 (Release blocked until theme updated)
```

### Acceptance Criteria
✓ Detects breaking changes in plugin  
✓ Checks theme compatibility with breaking changes  
✓ Identifies which files need updates  
✓ Prevents partial release with breaking changes  
✓ Suggests migration path  

---

## Test Case 5: Conditional Dependency (Feature Flags)

### Setup
Plugin includes optional feature that requires theme capability.

**Plugin (my-blocks.php)**:
```php
/**
 * Plugin Name: My Blocks
 * Version: 1.2.0
 * 
 * Optional features (require theme support):
 * - FEATURE_CUSTOM_COLORS: requires theme v1.2.0+
 * - FEATURE_ANIMATIONS: requires theme v1.1.0+
 */
```

**Theme (my-theme)**:
```php
// In theme's functions.php
add_theme_support( 'custom-block-colors' );
add_theme_support( 'block-animations' );
```

### Command
```bash
lspeed release --group blocks-and-theme --validate-deps --features
```

### Expected Output
```
Validating multi-package dependencies for: blocks-and-theme

Feature Capability Check:

Plugin Optional Features:
├─ FEATURE_CUSTOM_COLORS
│  ├─ Available in: plugin v1.2.0+
│  ├─ Requires: theme support 'custom-block-colors'
│  └─ Status: ✓ Theme declares support in functions.php
│
└─ FEATURE_ANIMATIONS
   ├─ Available in: plugin v1.1.0+
   ├─ Requires: theme support 'block-animations'
   └─ Status: ✓ Theme declares support in functions.php

Feature Compatibility Matrix:
✓ All optional features supported by theme v1.2.0
✓ No deprecated features in use
✓ Feature flags aligned

Summary: Feature compatibility verified ✓
```

### Acceptance Criteria
✓ Identifies optional features in plugin  
✓ Validates theme declares required support  
✓ Maps feature flags to versions  
✓ Confirms all features compatible  

---

## Summary of Dependency Validation

| Test | Scenario | Expected | Status |
|------|----------|----------|--------|
| 1 | All constraints valid | Pass, release allowed | ✓ |
| 2 | Plugin version too old | Fail, block release | ✓ |
| 3 | WordPress requirement mismatch | Fail, suggest fix | ✓ |
| 4 | Breaking changes in plugin | Fail, require theme update | ✓ |
| 5 | Feature flags and capabilities | Pass with validation | ✓ |

All validation scenarios should either:
- ✓ Allow release (test 1, 5)
- ✗ Block release with clear error and resolution (tests 2, 3, 4)
