# Scripts

This directory contains validation and utility scripts for WordPress block plugin and theme release management.

## Purpose

Scripts in this directory help with:

- **Validation** — Check plugin/theme compliance before release
- **Automation** — Generate files and update versions
- **Testing** — Verify configurations and file formats
- **Quality** — Enforce standards across the project

## Available Scripts

### validate-json.js

Validates JSON files including:
- General JSON syntax validation
- block.json schema compliance
- theme.json configuration validation
- package.json structure

**Usage:**
```bash
node scripts/validate-json.js <file-path>
```

**Example:**
```bash
node scripts/validate-json.js blocks/my-block/block.json
# Output:
# ✅ JSON syntax valid
# ✅ block.json schema valid
# ✅ Required fields present
```

### validate-links.js

Validates internal links and references:
- CHANGELOG.md comparison links
- Documentation reference links
- README.md internal links
- Cross-skill references

**Usage:**
```bash
node scripts/validate-links.js
```

**Example:**
```bash
node scripts/validate-links.js
# Output:
# ✅ CHANGELOG.md links: Valid (5 checked)
# ✅ README.md links: Valid (12 checked)
# ✅ Internal skill references: Valid
```

### validate-skill-structure.js

Validates skill SKILL.md files:
- Proper frontmatter (YAML)
- Required fields (name, description, metadata)
- Section structure
- Cross-references to other skills

**Usage:**
```bash
node scripts/validate-skill-structure.js <skill-path>
```

**Example:**
```bash
node scripts/validate-skill-structure.js skills/hook-configuration/
# Output:
# ✅ Frontmatter valid
# ✅ Required fields present
# ✅ Sections properly formatted
# ✅ Cross-references valid
```

## Planned Scripts

These scripts are planned and will be added. File names are the original plans. New scripts follow the
script policy: TypeScript, never `.sh`.

### validate-plugin-header.php

Validates WordPress plugin headers:
- All required fields present
- Version format valid
- License is GPL v2 or compatible
- Text domain matches plugin slug

**Will validate:**
```php
<?php
/**
 * Plugin Name: My Plugin ✅
 * Version: 1.2.4 ✅
 * License: GPL v2 or later ✅
 * Text Domain: my-plugin ✅
 */
```

### validate-theme-header.php

Validates WordPress theme headers:
- All required fields present
- Version format valid
- Requires at least is reasonable
- License is GPL v2 or compatible

**Will validate:**
```css
/*
Theme Name: My Theme ✅
Version: 1.2.4 ✅
Requires at least: 6.0 ✅
License: GPL v2 or later ✅
*/
```

### validate-readme-txt.js

Validates readme.txt for WordPress.org:
- Proper format for plugin/theme
- Required sections present
- Changelog format correct
- Stable tag matches version

### validate-changelog.js

Validates CHANGELOG.md format:
- Keep a Changelog 1.1.0 format
- [Unreleased] section present
- Valid subsections only
- Proper date format

### sync-versions.js

Synchronizes versions across:
- VERSION file (source of truth)
- Plugin/theme header
- readme.txt
- package.json (if present)
- composer.json (if present)

**Usage:**
```bash
node scripts/sync-versions.js 1.2.4
```

### generate-github-release-notes.js

Generates GitHub Release notes from CHANGELOG.md:
- Extracts unreleased entries
- Formats for GitHub
- Includes contributor list
- Adds comparison links

### generate-svn-structure.js

Generates WordPress.org SVN directory structure:
- Creates tags/ directory
- Copies trunk to version tags
- Prepares assets
- Generates sync instructions

## Running Scripts Locally

### Manual Execution

```bash
# From project root
node scripts/validate-json.js blocks/my-block/block.json
node scripts/validate-links.js
node scripts/validate-skill-structure.js skills/hook-configuration/
```

### From npm Scripts

Add to package.json:

```json
{
  "scripts": {
    "validate:json": "node scripts/validate-json.js",
    "validate:links": "node scripts/validate-links.js",
    "validate:skills": "node scripts/validate-skill-structure.js skills/",
    "validate:all": "npm run validate:json && npm run validate:links && npm run validate:skills"
  }
}
```

Then run:

```bash
npm run validate:json blocks/my-block/block.json
npm run validate:all
```

## Integration with Hooks

Scripts are called from [[hook-configuration]] hooks:

### Pre-Commit Hook

```yaml
# .lefthook.yml
pre-commit:
  commands:
    validate-json:
      glob: "*.json"
      run: node scripts/validate-json.js {staged_files}
    
    validate-headers:
      glob: "*.php"
      run: node scripts/validate-plugin-header.js {staged_files}
```

### Pre-Push Hook

```yaml
pre-push:
  commands:
    validate-changelog:
      run: node scripts/validate-changelog.js CHANGELOG.md
    
    validate-versions:
      run: node scripts/sync-versions.js --check
```

## Creating New Scripts

> **Script policy:** new scripts are TypeScript. Do not add shell (`.sh`) scripts. The JavaScript template below
> shows the structure of the existing scripts. Existing JavaScript is not converted by this rule, and TypeScript
> tooling is not set up in this repository yet.

### Script Template

```javascript
#!/usr/bin/env node

/**
 * Script: Validate Something
 * 
 * Purpose: Describe what this validates
 * Usage: node scripts/validate-something.js <arg1> [arg2]
 * 
 * Example:
 * node scripts/validate-something.js myfile.json
 */

const fs = require('fs');
const path = require('path');

// Main function
async function main(args) {
  try {
    if (args.length === 0) {
      console.error('Usage: node validate-something.js <file>');
      process.exit(1);
    }

    const file = args[0];
    
    // Perform validation
    const result = await validate(file);
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
      process.exit(0);
    } else {
      console.error(`❌ ${result.message}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

async function validate(file) {
  // Your validation logic
  return {
    success: true,
    message: 'Validation passed'
  };
}

// Run script
main(process.argv.slice(2));
```

### Guidelines

1. **Exit Codes** — Return 0 on success, non-zero on failure
2. **Output** — Use ✅ for pass, ❌ for fail
3. **Errors** — Log clear error messages
4. **Performance** — Keep scripts fast (< 5 seconds)
5. **Documentation** — Include JSDoc comments

## Debugging Scripts

### Enable Debug Output

```bash
DEBUG=* node scripts/validate-json.js file.json
```

### Check File Permissions

```bash
ls -la scripts/validate-*.js
# Should be executable or run with `node` prefix
```

### Verify Dependencies

```bash
npm ls
# Check that all dependencies are installed
```

## Integration with Release Skills

Scripts are used throughout the release workflow:

- **[[hook-configuration]]** → Calls validation scripts in hooks
- **[[pre-commit-validation]]** → Uses scripts to validate files
- **[[pre-push-validation]]** → Runs full validation script suite
- **[[changelog-management]]** → Uses changelog validation script
- **[[wordpress-org-sync]]** → Generates SVN structure with scripts

## See Also

- [[hook-configuration]] — Git hooks using scripts
- [[pre-commit-validation]] — Script-based validation
- [[pre-push-validation]] — Full validation workflow
- [[release]] — Main release skill
- [Node.js Documentation](https://nodejs.org/en/docs/)
