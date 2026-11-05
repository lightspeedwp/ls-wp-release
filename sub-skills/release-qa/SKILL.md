---
name: release-qa
description: Pre-release quality assurance and validation for WordPress block plugins and themes
metadata:
  version: 1.0.0
  updated: 2026-10-30
  author: LightSpeedWP Release Team
  tags:
    - qa
    - testing
    - validation
    - wordpress
---

# Release QA Skill

Performs comprehensive pre-release quality assurance and validation for WordPress block plugins and themes.

## Purpose

This sub-skill coordinates seven quality gates before release publication:

1. **Test Coverage** — All unit and integration tests pass
2. **Code Quality** — Lint, formatting, and static analysis pass
3. **Version Alignment** — All version sources match
4. **Changelog Validation** — Keep a Changelog format and completeness
5. **WordPress Compliance** — Plugin/theme headers and wordpress.org guidelines
6. **Documentation Audit** — README, contributing guides, inline comments
7. **Repository Health** — Git state, branch protection, CI status

## Pre-Release Quality Gates

### Gate 1: Test Coverage

**What it checks:**
- All unit tests pass: `npm test` or `composer test`
- Integration tests pass (if present)
- No test files are skipped
- Code coverage meets minimum threshold (default: 70% for new code)
- E2E tests pass (if present)

**For WordPress projects:**
- Block registration tests pass
- Taxonomy and CPT tests pass
- Hook/filter callback tests pass
- Database migration tests pass (if applicable)

**Command to validate:**

```bash
npm test
# or
composer test
# or
npm run test:unit && npm run test:integration
```

**Output:**
```
✅ All tests passed (42 tests, 2.3s)
✅ Code coverage: 82% (target: 70%)
✅ No skipped tests
✅ Integration tests passed (8 tests)
```

### Gate 2: Code Quality & Lint

**What it checks:**
- No ESLint errors or critical warnings
- No PHP CodeSniffer violations (WordPress standards)
- No unused variables or imports
- Code formatting matches project standards
- Security linting passes (no known vulnerabilities)

**For WordPress projects:**
- WordPress coding standards (PHPCS)
- Block.json validation
- theme.json validation (for block themes)
- Proper escaping and sanitization
- No deprecated WordPress functions

**Command to validate:**

```bash
npm run lint
# or
npm run lint:js && npm run lint:php && npm run lint:css
# or
composer run phpcs
```

**Output:**
```
✅ ESLint: 0 errors, 0 warnings
✅ PHP CodeSniffer: 0 violations
✅ CSS Lint: 0 errors
✅ Unused imports check: OK
✅ Security audit: No vulnerabilities
```

### Gate 3: Version Alignment

**What it checks:**
- `VERSION` file exists and contains valid SemVer
- Plugin header `Version:` matches VERSION file
- Theme `style.css` `Version:` matches VERSION file
- Theme `theme.json` version matches (if present)
- `readme.txt` `Stable tag:` matches VERSION file
- `package.json` version matches VERSION file (if present)
- `composer.json` version matches VERSION file (if present)

**Command to validate:**

```bash
npm run check:versions
# or manually:
grep -i "Version:" plugin.php
grep "^Version:" style.css
grep "\"version\":" theme.json
grep "Stable tag:" readme.txt
```

**Output:**
```
✅ VERSION file: 1.2.4
✅ plugin.php Version: 1.2.4 ✅
✅ style.css Version: 1.2.4 ✅
✅ theme.json version: 1.2.4 ✅
✅ readme.txt Stable tag: 1.2.4 ✅
✅ package.json version: 1.2.4 ✅

All versions aligned!
```

### Gate 4: Changelog Validation

**What it checks:**
- `CHANGELOG.md` exists
- Follows Keep a Changelog 1.1.0 format
- `## [Unreleased]` section is present (case-sensitive)
- Unreleased section is not empty
- Subsections are valid (Added, Changed, Deprecated, Removed, Fixed, Security, Documentation, Performance)
- Changelog structure is consistent
- All subsections have entries
- Links to version comparisons are valid

**For WordPress releases:**
- If MAJOR: includes BREAKING CHANGE callout
- If SECURITY: includes security fix details
- Minimum viability: at least one entry in Unreleased

**Command to validate:**

```bash
npm run check:changelog
# or manually:
grep -A 20 "## \[Unreleased\]" CHANGELOG.md
```

**Output:**
```
✅ CHANGELOG.md found
✅ Keep a Changelog format: Valid
✅ [Unreleased] section present
✅ Unreleased entries: 5
   - Added: 2 entries
   - Changed: 1 entry
   - Fixed: 2 entries
✅ Subsection format: Valid
✅ All subsections non-empty

Ready for release!
```

### Gate 5: WordPress Compliance

**For Plugins:**

Validates plugin header:
```php
<?php
/**
 * Plugin Name: My Plugin
 * Plugin URI: https://github.com/lightspeedwp/my-plugin
 * Description: Short description
 * Version: 1.2.4
 * Author: LightSpeedWP
 * Author URI: https://lightspeedwp.agency
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: my-plugin
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * Tested up to: 6.4
 */
```

Validates readme.txt:
- Has Description, Installation, FAQ sections
- Includes Stable tag matching version
- Includes Requires at least, Tested up to, Requires PHP
- Has proper License and License URI
- Changelog section formatted correctly

**For Themes:**

Validates style.css header:
```css
/*
Theme Name: My Theme
Theme URI: https://github.com/lightspeedwp/my-theme
Author: LightSpeedWP
Author URI: https://lightspeedwp.agency
Description: Block theme description
Version: 1.2.4
Requires at least: 6.0
Requires PHP: 7.4
Tested up to: 6.4
License: GPL v2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Text Domain: my-theme
*/
```

Validates theme.json (if block theme):
- Valid JSON structure
- Proper template and templateParts organization
- Color palette defined
- Typography settings present
- Responsive breakpoints (LightSpeed house rule, not a WordPress.org requirement)

**Command to validate:**

```bash
npm run check:wordpress-compliance
# or manually for plugins:
grep "^Plugin Name:" *.php
# for themes:
grep "^Theme Name:" style.css
```

**Output:**
```
✅ Plugin Type: WordPress Block Plugin

✅ Plugin Header Validation:
   ✅ Plugin Name present
   ✅ Version: 1.2.4
   ✅ License: GPL v2 or later
   ✅ Text Domain: plugin-slug
   ✅ Requires at least: 5.8
   ✅ Requires PHP: 7.4
   ✅ Tested up to: 6.4

✅ readme.txt Validation:
   ✅ Description: Present
   ✅ Installation: Present
   ✅ FAQ: Present
   ✅ Stable tag: 1.2.4 ✅
   ✅ Changelog: Present

WordPress Compliance: PASS ✅
```

### Gate 6: Documentation Audit

**What it checks:**
- README.md exists and is up to date
- CONTRIBUTING.md exists (if applicable)
- LICENSE file present (LICENSE.md or LICENSE.txt)
- Changelog exists and is current
- API documentation up to date (for plugin hooks/filters)
- Inline code comments present for complex logic
- All internal links are valid (no 404s)
- Installation instructions are clear
- Contributing guidelines are clear

**For WordPress projects:**
- Block documentation present
- Hook and filter reference documented
- Template hierarchy documented (themes)
- Setup instructions for development

**Command to validate:**

```bash
npm run check:docs
```

**Output:**
```
✅ README.md: Present and current
✅ CONTRIBUTING.md: Present
✅ LICENSE: Present (GPL-2.0)
✅ CHANGELOG.md: Current and formatted
✅ API docs: Present (20 hooks documented)
✅ Installation guide: Clear
✅ Internal links: All valid (45 checked)
⚠️  Code comments: 62% coverage (target: 80%)

Documentation Score: 85/100 (PASS)
```

### Gate 7: Repository Health

**What it checks:**
- No uncommitted changes in working tree
- No untracked files that should be committed
- Git history is clean (no merge conflicts)
- Develop branch is up to date with remote
- Main branch is up to date with remote
- Branch protection rules configured (main)
- CI workflows are defined and passing
- Security vulnerability scan (if configured)

**Command to validate:**

```bash
git status
git log --oneline -5
git branch -vv
```

**Output:**
```
✅ Working tree clean
✅ No untracked files
✅ Git history: Clean (0 conflicts)
✅ develop branch: Up to date with origin/develop
✅ main branch: Up to date with origin/main
✅ Branch protection: Configured on main
✅ CI workflows: All passing
   - Tests: ✅
   - Lint: ✅
   - Security: ✅
✅ Last commit: 2 hours ago

Repository Health: EXCELLENT ✅
```

## Pre-Release Checklist

The skill generates a comprehensive checklist:

```markdown
# Pre-Release Checklist for v1.2.4

## Tests & Quality
- [x] Unit tests pass (42 tests)
- [x] Integration tests pass (8 tests)
- [x] Code coverage: 82% (target: 70%)
- [x] Lint passes (ESLint, PHP CodeSniffer)
- [x] No security vulnerabilities

## Versioning
- [x] VERSION file: 1.2.4
- [x] plugin.php Version: 1.2.4
- [x] readme.txt Stable tag: 1.2.4
- [x] package.json version: 1.2.4
- [x] All versions aligned

## Changelog
- [x] CHANGELOG.md follows Keep a Changelog
- [x] [Unreleased] section has 5 entries
- [x] Added, Changed, Fixed sections present
- [x] No formatting errors

## WordPress Compliance
- [x] Plugin Name header present
- [x] Requires at least: 5.8
- [x] Tested up to: 6.4
- [x] readme.txt follows wordpress.org format
- [x] License: GPL v2 or later

## Documentation
- [x] README.md is current
- [x] CONTRIBUTING.md exists
- [x] LICENSE file present
- [x] Installation guide complete
- [x] All internal links valid

## Repository
- [x] Working tree clean
- [x] No uncommitted changes
- [x] Git history clean
- [x] Develop and main branches sync'd

## Ready to Release ✅
All 26 checks passed. Approved for release!
```

## Release Risk Assessment

Based on the quality gates, the skill produces a risk score (0-1.0):

```
Release Risk Assessment for v1.2.4

Risk Score: 0.15 (LOW RISK - Safe to release)

Breakdown:
- Test coverage: 0.0 (all tests pass)
- Code quality: 0.05 (minor lint warnings)
- Version alignment: 0.0 (perfect alignment)
- Changelog completeness: 0.0 (fully documented)
- WordPress compliance: 0.0 (fully compliant)
- Documentation: 0.1 (minor doc gaps)
- Repository health: 0.0 (excellent health)

Recommendation: APPROVE FOR RELEASE ✅

No blockers detected. Safe to proceed with release.
```

## Automated Approval Rules

Based on risk score:

| Scope | Risk Score | Auto-Approve? |
|-------|-----------|--------------|
| Patch | ≤ 0.3 | ✅ Yes |
| Patch | > 0.3 | ❌ Manual review required |
| Minor | ≤ 0.2 | ✅ Yes |
| Minor | > 0.2 | ❌ Manual review required |
| Major | Any | ❌ Always manual |

## Integration

This skill is called by the main `release` skill during the validation phase:

```bash
/release --dry-run  # Runs all QA gates
```

It can also be called independently:

```bash
/release-qa --project-type=plugin --verbose
```

## Troubleshooting

### Tests failing but were passing yesterday

```
❌ npm test failed

Investigation steps:
  1. Check for dependency updates: npm list --depth=0
  2. Clear cache: npm cache clean --force
  3. Reinstall: rm -rf node_modules && npm install
  4. Run tests again: npm test
```

### Version mismatch detected

```
❌ Version mismatch

Fix:
  1. Identify the source: VERSION file is the source of truth
  2. Update all others to match: plugin.php, style.css, readme.txt
  3. Commit: git add -A && git commit -m "chore: sync versions to 1.2.4"
  4. Retry: /release-qa
```

## See Also

- [[release]] — main release orchestration skill
- [[github-release]] — tag and release publication
- [[release-handoff-generator]] — post-release documentation
