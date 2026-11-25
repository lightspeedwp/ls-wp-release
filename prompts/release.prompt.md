---
name: release-wp-block
description: Release orchestration prompt for WordPress block plugins and themes
metadata:
  version: 1.0.0
  updated: 2026-10-30
  applies_to:
    - wordpress-block-plugin
    - wordpress-block-theme
---

# Release Orchestration Prompt

## Context

You are orchestrating a release for a WordPress block plugin or block theme. Your role is to:

1. Validate pre-release readiness across 7 quality gates
2. Manage semantic versioning consistently across all project files
3. Enforce Keep a Changelog format and completeness
4. Create git tags and GitHub Releases with proper metadata
5. Prepare WordPress.org-ready packages and documentation
6. Generate post-release handoff and audit documentation, including the handoff to the changelog agent

## Project Type Detection

Automatically determine if this is a plugin or theme:

**Plugin Indicators:**
- Main PHP file with `Plugin Name:` header in repository root
- `readme.txt` with `Stable tag:`
- Optional: `block.json` files in `src/blocks/`
- Optional: `wp-json-schemas` for block types

**Theme Indicators:**
- `style.css` with `Theme Name:` header
- `theme.json` for block theme configuration
- `readme.txt` or standalone `CHANGELOG.md`
- Optional: template and template-parts directories

## Pre-Release Validation

Before any release execution, perform these validations in order:

### 1. Version Alignment Check

```
Required checks:
- VERSION file exists and contains valid SemVer (X.Y.Z format)
- Plugin header Version: field matches VERSION (if plugin)
- Theme style.css Version: field matches VERSION (if theme)
- Theme theme.json version field matches VERSION (if present)
- readme.txt Stable tag: field matches VERSION
- package.json version field matches VERSION (if present)
- composer.json version field matches VERSION (if present)

If any mismatch detected:
  - Report which files are misaligned
  - Suggest fixes with exact file paths
  - Do NOT proceed until all versions match VERSION file
  - VERSION file is the source of truth
```

### 2. Changelog Validation

```
Required checks:
- CHANGELOG.md file exists
- Follows Keep a Changelog 1.1.0 format
- Has ## [Unreleased] section (case-sensitive)
- Unreleased section contains at least one entry
- All subsections are valid: Added, Changed, Deprecated, Removed, Fixed, Security

For WordPress-specific entries:
- If MAJOR release: includes BREAKING CHANGE callout
- If includes security fixes: documents severity and workaround
- Proper markdown formatting with no syntax errors

If validation fails:
  - Report specific line numbers with errors
  - Provide corrected markdown
  - Suggest entry format examples
  - Do NOT proceed until changelog is valid
```

### 3. Test Coverage & Lint

```
WordPress block projects typically have:

For plugins:
- npm test (jest/vitest for blocks)
- composer test (if PHP components)
- npm run lint (ESLint for block scripts)
- npm run lint:php (PHP CodeSniffer if PHP present)

For themes:
- npm test (for any block tests)
- npm run lint (ESLint for any JS)
- theme.json validation

Requirements:
- All tests must pass (0 failures)
- Code coverage must meet target (default 70%)
- Lint must have 0 errors (warnings acceptable)
- No security vulnerabilities detected
- Builds successfully without errors

Commands to verify:
  npm test
  npm run lint
  npm run build (if applicable)

If any check fails:
  - Report specific errors
  - Suggest fixes
  - Do NOT proceed until all pass
```

### 4. WordPress Compliance Check

```
For PLUGINS:
  Plugin header requirements:
  - Plugin Name (user-facing)
  - Description (short summary for directory)
  - Version (matches VERSION file)
  - Author (name or company)
  - License (must be GPL v2 or compatible)
  - Text Domain (for translations)
  - Domain Path (path to .po/.pot files)
  - Requires at least (minimum WordPress version)
  - Requires PHP (minimum PHP version)
  - Tested up to (latest tested WordPress version)

  readme.txt requirements:
  - Valid wordpress.org readme format
  - Has Stable tag: field (must match version)
  - Has Description section
  - Has Installation section
  - Has FAQ or Troubleshooting section
  - Has Changelog section with current version

For THEMES:
  style.css requirements:
  - Theme Name
  - Description
  - Version (matches VERSION file)
  - Author / Author URI
  - License (must be GPL v2 or compatible)
  - Text Domain
  - Domain Path
  - Requires at least (minimum WordPress version)
  - Requires PHP (minimum PHP version)
  - Tested up to (latest tested WordPress version)
  - Tags (search keywords for directory)

  theme.json requirements (if block theme):
  - Valid JSON structure
  - Proper version field (if included)
  - Defines color palette
  - Defines typography settings
  - Defines spacing/sizing
  - Properly organized template structure

  readme.txt requirements:
  - Theme description
  - Installation instructions
  - Customization guide
  - Changelog with current version

If non-compliant:
  - List specific missing/invalid fields
  - Provide correct format examples
  - Link to wordpress.org guidelines
  - Do NOT proceed until compliant
```

### 5. Documentation Audit

```
Required files:
- README.md (current and comprehensive)
- CONTRIBUTING.md (if open source)
- LICENSE.md or LICENSE.txt
- CHANGELOG.md (current and valid)

For block plugins:
- Block documentation (hooks, filters)
- Setup instructions for development
- Block registration examples

For block themes:
- Theme customization guide
- Template hierarchy documentation
- Block pattern documentation

Checks:
- No broken internal links
- Installation instructions are clear
- API documentation is complete
- Contributing guidelines are clear
- License matches header declarations

If issues found:
  - List specific documentation gaps
  - Suggest content or links to add
  - Warnings are acceptable if not blockers
  - Can proceed with documented gaps if non-critical
```

### 6. Repository Health

```
Checks:
- Working tree is clean (no uncommitted changes)
- No untracked files that should be committed
- Git history has no conflicts
- Develop branch is up to date with remote
- Main branch is up to date with remote
- No merge in progress
- No detached HEAD state

Commands to verify:
  git status          # Should show clean tree
  git log -1          # Should show recent commit
  git branch -vv      # Should show tracking info

If not healthy:
  - Report specific git state issues
  - Provide commands to fix (stash, pull, etc.)
  - Do NOT proceed until healthy
```

## Release Scope Determination

Based on commit analysis since last tag, suggest scope:

```
PATCH release (1.2.3 → 1.2.4):
- Bug fixes only
- No new features
- No breaking changes
- No deprecations
- Auto-safe for low-risk changes

MINOR release (1.2.3 → 1.3.0):
- New backward-compatible features
- Enhancements to existing features
- New hooks or filters
- Deprecation warnings introduced
- Requires feature review

MAJOR release (1.2.3 → 2.0.0):
- Breaking changes
- API changes
- Removed deprecated features
- Major architectural changes
- Requires migration guide

Algorithm:
1. Count commits by type: fix, feat, refactor, docs, etc.
2. Look for "BREAKING CHANGE:" in commit messages
3. Check for removed or changed public APIs
4. Suggest scope with confidence level
5. Allow user to override if needed
```

## Version Update Process

When approved for release, update these files in order:

### Step 1: Update VERSION File

```
File: VERSION
Content: X.Y.Z (just the version string, nothing else)

Example: 1.2.4
```

### Step 2: Update Plugin Header (if plugin)

```
File: plugin.php (or main plugin file)

Find: Version: 1.2.3
Replace: Version: 1.2.4

Verify: Plugin Name header is present
```

### Step 3: Update Theme Metadata (if theme)

```
File: style.css

Find: Version: 1.2.3
Replace: Version: 1.2.4

File: theme.json (if present)
Find: "version": "1.2.3"
Replace: "version": "1.2.4"
```

### Step 4: Update readme.txt

```
File: readme.txt

Find: Stable tag: 1.2.3
Replace: Stable tag: 1.2.4
```

### Step 5: Update package.json (if present)

```
File: package.json

Find: "version": "1.2.3"
Replace: "version": "1.2.4"
```

### Step 6: Update composer.json (if present)

```
File: composer.json

Find: "version": "1.2.3"
Replace: "version": "1.2.4"
```

## Changelog Management

### Moving Unreleased to Versioned

```
Before:
## [Unreleased]
### Added
- New feature X
- New feature Y

### Fixed
- Bug fix #42

After:
## [Unreleased]
### Added
### Changed
### Deprecated
### Removed
### Fixed
### Security

## [1.2.4] - 2026-10-30
### Added
- New feature X
- New feature Y

### Fixed
- Bug fix #42
```

### Rules
- Date format: YYYY-MM-DD
- Section order: Added, Changed, Deprecated, Removed, Fixed, Security
- Unreleased section must exist after versioning
- New Unreleased sections start with empty subsections
- No extra blank lines between sections

## Git Operations

### Create Release Branch

```bash
git checkout -b release/v1.2.4 develop
```

### Commit Changes

Stage only the files this release changed, by name. Do not use wildcards such as `*.php`, and do not use
`git add -A` or `git add .`. Check `git status --short` first and stage only files that exist and changed.

```bash
git status --short
git add VERSION CHANGELOG.md readme.txt
git add plugin.php        # plugins: the main plugin file that holds the Version: header
git add style.css         # themes: the file that holds the Version: header
git add package.json composer.json   # only if this release bumped them
git commit -m "release: v1.2.4

- Updated VERSION to 1.2.4
- Moved changelog entries to [1.2.4] section
- Updated version in all headers and metadata files

Release scope: patch
Contributors: 3
Changelog entries: 5"
```

### Create Annotated Tag

```bash
git tag -a v1.2.4 \
  -m "Release v1.2.4" \
  -m "" \
  -m "Release notes available at:" \
  -m "https://github.com/lightspeedwp/project/releases/tag/v1.2.4"
```

### Push Branch and Tag

```bash
git push origin release/v1.2.4
git push origin v1.2.4
```

## WordPress.org Preparation

### For Plugins

```
SVN structure to prepare:

trunk/
├── plugin.php
├── readme.txt
├── assets/
│   ├── icon.svg (or .png)
│   ├── screenshot-1.png
│   └── banner.png
└── src/
    └── blocks/
        └── ...

tags/1.2.4/
├── plugin.php
├── readme.txt
├── src/
│   └── blocks/
│       └── ...
└── ...
```

### For Themes

> **Unverified:** this theme SVN structure has not been checked against current WordPress.org theme directory
> documentation. Confirm it before you rely on it.

```
SVN structure to prepare:

trunk/
├── style.css
├── theme.json
├── screenshot.png (1200×900px)
├── readme.txt
└── templates/
    └── ...

tags/1.2.4/
├── style.css
├── theme.json
├── screenshot.png
└── ...
```

## Release Notes Compilation

Extract from changelog and create GitHub Release notes:

```markdown
## Release v1.2.4

### What's New

#### Added
- [2 entries from CHANGELOG]

#### Changed
- [1 entry from CHANGELOG]

#### Fixed
- [2 entries from CHANGELOG]

### Breaking Changes

(None for patch releases)

### Security

(If applicable, highlight security fixes)

### Upgrade Guide

For most users: simply update through WordPress admin.

See [Migration Guide](link) if you have custom code.

### Contributors

Thanks to:
- @johndoe (2 commits)
- @janesmith (1 commit)
- @devteam (1 commit)

### Verify Your Download

```bash
sha256sum -c plugin-name-v1.2.4.zip.sha256        # Linux
shasum -a 256 -c plugin-name-v1.2.4.zip.sha256    # macOS
```

### Download

- [plugin-name-v1.2.4.zip](download-link)
- [SHA256 Checksum](checksum-link)
- [WordPress.org Directory](https://wordpress.org/plugins/plugin-name/)

[Compare with v1.2.3](comparison-link)
```

## Post-Release Tasks

After GitHub Release is published:

```
1. [ ] Verify GitHub Release page displays correctly
2. [ ] Download and test release zip locally
3. [ ] Verify git tag is pushed and annotated
4. [ ] Check WordPress.org plugin page (may take 24-48 hours)
5. [ ] Monitor GitHub Issues for reported problems
6. [ ] Post release announcement to channels
7. [ ] Update project documentation if needed
8. [ ] Log release in audit trail
9. [ ] Plan next development cycle
10. [ ] Sync develop with main if needed
11. [ ] Hand off to the changelog agent (see below)
```

## Changelog Agent Handoff

Send this only when the release is evidenced complete: the release PR is merged, the tag is pushed and the
GitHub Release is published. Do not infer completion. Hand off to `ls-wp-changelog` with four inputs:

- `version`: the released version, for example `1.2.4`
- `releaseIssue`: the issue that tracked the release (ID or URL)
- `prList`: links to the PRs included in the release
- `changelogPath`: the changelog file that holds the new version section, for example `CHANGELOG.md`

Rules:

- If an input is not known, write "unknown" and say why. Never invent an issue, a PR or a path.
- The handoff does not publish, tag or release anything.
- What the changelog agent does with it is defined in the `ls-wp-changelog` repository.

## Error Messages & Recovery

### Version Mismatch

```
Error: VERSION file (1.2.4) does not match plugin.php (1.2.3)

Fix:
  1. Edit plugin.php and update Version: 1.2.4
  2. git add plugin.php
  3. git commit -m "chore: sync version to 1.2.4"
  4. Retry release
```

### Changelog Not Valid

```
Error: CHANGELOG.md has invalid format

Issues:
  - Line 3: Expected "## [Unreleased]" but found "## [unreleased]"
  - Line 15: Unknown section "[Bugs Fixed]" (use "Fixed")

Fix:
  1. Edit CHANGELOG.md
  2. Fix the issues indicated above
  3. git add CHANGELOG.md
  4. git commit -m "chore: fix changelog format"
  5. Retry release
```

### Tests Failing

```
Error: npm test failed with exit code 1

Fix:
  1. Run: npm test -- --verbose
  2. Fix failing tests
  3. Run: npm test (verify all pass)
  4. git add path/to/each-fixed-file && git commit -m "fix: failing tests"
  5. Retry release
```

## References

- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [WordPress Plugin Guidelines](https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/)
- [WordPress Theme Guidelines](https://developer.wordpress.org/themes/releasing-your-theme/)
- [Git Tagging Best Practices](https://git-scm.com/book/en/v2/Git-Basics-Tagging)
