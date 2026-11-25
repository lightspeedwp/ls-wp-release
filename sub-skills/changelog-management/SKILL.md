---
name: changelog-management
description: Manage changelog entries and automatic versioning for WordPress block plugins and themes
metadata:
  version: 1.0.0
  updated: 2026-10-30
  author: LightSpeedWP Release Team
  tags:
    - changelog
    - versioning
    - releases
    - wordpress
    - documentation
  tools:
    - Read
    - Edit
    - Write
    - Bash
    - Grep
  requires:
    - CHANGELOG.md file
    - Keep a Changelog format
    - VERSION file or version in headers
---

# Changelog Management Skill

Manages changelog entries, validates format compliance, and coordinates automatic versioning for WordPress block plugins and themes using the Keep a Changelog standard.

## Purpose

This sub-skill helps teams maintain clear release documentation by:

- **Creating** properly formatted changelog entries
- **Validating** Keep a Changelog 1.1.0 format compliance
- **Organizing** entries into standardized sections
- **Automating** version numbering and dating
- **Coordinating** changelog with version files
- **Preventing** incomplete or malformed entries

## Keep a Changelog Format

The CHANGELOG.md follows the [Keep a Changelog](https://keepachangelog.com/) standard, which provides:

- **Clarity** — Users immediately see what's changed
- **Structure** — Consistent organization across versions
- **Searchability** — Clear sections and version history
- **Automation** — Machine-readable format for tooling

### Standard Structure

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Feature 1 description
- Feature 2 description

### Changed
- Enhancement 1 description

### Deprecated
- Feature to be removed in next major version

### Removed
- Feature no longer supported

### Fixed
- Bug fix description

### Security
- Security fix description

## [1.2.4] - 2026-10-30

### Added
- New hero block component
- Theme options for hero positioning

### Fixed
- Fixed typography settings in block inspector
- Resolved color palette not persisting

## [1.2.3] - 2026-10-15

### Fixed
- Critical security issue in sanitization

## [1.2.0] - 2026-10-01

### Added
- Card block component
- Testimonial block component

### Changed
- Updated WordPress minimum to 5.8

[Unreleased]: https://github.com/lightspeedwp/my-plugin/compare/v1.2.4...HEAD
[1.2.4]: https://github.com/lightspeedwp/my-plugin/compare/v1.2.3...v1.2.4
[1.2.3]: https://github.com/lightspeedwp/my-plugin/compare/v1.2.0...v1.2.3
[1.2.0]: https://github.com/lightspeedwp/my-plugin/releases/tag/v1.2.0
```

## Valid Changelog Sections

### Added
**Use for:** New features, blocks, capabilities

Examples for WordPress projects:
- New block registration
- New custom post type
- New hook for extensibility
- New theme option
- New page template

```markdown
## [Unreleased]

### Added
- New hero block with 3 layout variations
- New `my_plugin_hero_blocks` filter for block customization
- New page template: "Full Width Hero"
```

### Changed
**Use for:** Modified features, updated behavior, improvements

Examples for WordPress projects:
- Modified block attribute structure
- Updated hook documentation
- Improved block rendering performance
- Changed default values
- Updated minimum WordPress version

```markdown
### Changed
- Improved block editor performance by 30%
- Updated block attributes schema for better consistency
- Changed default hero image size to 1200x600px
```

### Deprecated
**Use for:** Features being removed in future versions

Examples for WordPress projects:
- Deprecated block variant
- Deprecated hook (but still functional)
- Deprecated function (with replacement)
- Deprecated theme option

```markdown
### Deprecated
- `my_plugin_old_hero_block` hook (use `my_plugin_hero_block` instead)
- Hero block classic variant (use responsive layout instead)
```

### Removed
**Use for:** Deleted features, dropped support

Examples for WordPress projects:
- Removed block type
- Removed hook
- Removed support for old WordPress version
- Removed deprecated function

```markdown
### Removed
- Removed support for WordPress < 5.8
- Removed classic editor integration (editor only)
```

### Fixed
**Use for:** Bug fixes, corrections

Examples for WordPress projects:
- Fixed block rendering issue
- Fixed database migration bug
- Fixed REST API endpoint
- Fixed color validation
- Fixed accessibility issue

```markdown
### Fixed
- Fixed block not rendering with custom post types
- Fixed color picker closing unexpectedly in block inspector
- Fixed database migration creating duplicate entries
```

### Security
**Use for:** Security patches, vulnerability fixes

Examples for WordPress projects:
- Fixed nonce validation vulnerability
- Fixed SQL injection in custom query
- Fixed XSS vulnerability in block output
- Fixed unauthorized access issue

```markdown
### Security
- Fixed critical SQL injection vulnerability in custom meta queries
- Fixed XSS vulnerability in block title output
- Fixed nonce validation in form submissions
```

## Creating Changelog Entries

### During Development

After each feature or fix is merged:

1. **Identify the section** (Added, Fixed, etc.)
2. **Write the entry** in user-friendly language
3. **Add to [Unreleased] section** in CHANGELOG.md

**Example workflow:**

```markdown
# Before
## [Unreleased]

### Added
- New card block component

# After merging fix
## [Unreleased]

### Added
- New card block component

### Fixed
- Fixed card block shadow rendering on dark backgrounds
```

### Entry Guidelines

**✅ Good entry:**
```
- Fixed hero block height calculation when using responsive images
```

**❌ Bad entry:**
```
- Fixed stuff
- Version bump to 1.2.4
- Updated dependencies
```

**✅ Good entry:**
```
- Added new `hero_block_alignment` filter for custom positioning
```

**❌ Bad entry:**
```
- Added filter
- New code
```

## Preparing for Release

### Before Release: Validate Changelog

```bash
npm run check:changelog

# Output:
✅ CHANGELOG.md format: Keep a Changelog 1.1.0
✅ [Unreleased] section: Present
✅ Entries: 5 (Added: 2, Changed: 1, Fixed: 2)
✅ All entries use valid subsections
✅ No duplicate entries

Ready for release!
```

### Release: Update Changelog Automatically

During the release process:

```bash
# 1. Determine version (via commit analysis)
Version: 1.3.0 (minor release - new features)

# 2. Skill updates CHANGELOG.md automatically:
## [Unreleased]

### Added
- (will be filled for next development cycle)

## [1.3.0] - 2026-10-30

### Added
- New card block component
- New hero block positioning filter

### Changed
- Improved block editor performance

### Fixed
- Fixed card block shadow rendering
```

### Release: Add Comparison Link

The skill automatically adds GitHub comparison links:

```markdown
[Unreleased]: https://github.com/lightspeedwp/my-plugin/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/lightspeedwp/my-plugin/compare/v1.2.4...v1.3.0
[1.2.4]: https://github.com/lightspeedwp/my-plugin/compare/v1.2.3...v1.2.4
```

## WordPress-Specific Changelog Patterns

### For Plugins

**Added entries:**
```markdown
- New "My Custom Block" block with 5 layout variations
- New `my_plugin_block_render_args` filter for block customization
- New page template: "Full Width with Sidebar"
- Support for WordPress 6.4 features
```

**Changed entries:**
```markdown
- Improved block rendering performance by 40%
- Updated minimum WordPress requirement to 5.9
- Changed block attribute structure for better RTL support
- Enhanced REST API endpoint with new query parameters
```

**Fixed entries:**
```markdown
- Fixed block not rendering with Yoast SEO active
- Fixed color picker scrolling in small viewports
- Fixed database migration for multisite installations
- Fixed accessibility issue with ARIA labels
```

**Security entries:**
```markdown
- Fixed critical nonce validation vulnerability in form submissions
- Fixed XSS vulnerability in block title display
- Fixed unauthorized access to admin endpoints
```

### For Themes

**Added entries:**
```markdown
- New block pattern: "Services Section"
- New template part: "Custom Footer with Widgets"
- New theme color palette: "Sunset"
- Support for WordPress 6.4 features
```

**Changed entries:**
```markdown
- Improved theme performance by optimizing CSS
- Updated minimum WordPress requirement to 6.0
- Refactored spacing settings for better consistency
- Enhanced responsive breakpoints for mobile devices
```

**Fixed entries:**
```markdown
- Fixed heading size inconsistency on mobile devices
- Fixed color contrast issue in footer links
- Fixed spacing issue with block patterns
- Fixed accessibility issue with theme colors
```

## Validation Rules

### CHANGELOG.md Must Have:

1. **Main Heading**
   ```
   # Changelog
   ```

2. **Description**
   ```
   All notable changes to this project will be documented in this file.
   ```

3. **[Unreleased] Section**
   ```
   ## [Unreleased]

   (At least one entry)
   ```

4. **Valid Subsections**
   - Only use: Added, Changed, Deprecated, Removed, Fixed, Security
   - Case-sensitive: `### Added` (not `### added` or `### ADDED`)
   - Can be empty except at least one must have content

5. **Version Format**
   - Follows Semantic Versioning: `X.Y.Z`
   - Format: `## [X.Y.Z] - YYYY-MM-DD`
   - Example: `## [1.2.4] - 2026-10-30`

6. **Comparison Links** (optional but recommended)
   ```
   [Unreleased]: https://github.com/org/repo/compare/v1.2.4...HEAD
   [1.2.4]: https://github.com/org/repo/compare/v1.2.3...v1.2.4
   ```

## Common Changelog Issues & Fixes

### Issue: Missing [Unreleased] Section

**Error:**
```
❌ CHANGELOG validation failed
   Missing [Unreleased] section
   Cannot document development work
```

**Fix:**
```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- (entries will be added as features are completed)

## [1.2.4] - 2026-10-30

...
```

### Issue: Invalid Section Name

**Error:**
```
❌ CHANGELOG validation failed
   Invalid subsection: "Features" (use "Added" instead)
   Invalid subsection: "Bug Fixes" (use "Fixed" instead)
```

**Fix:**
```markdown
## [Unreleased]

### Added              # Was "Features"
- New card block

### Fixed             # Was "Bug Fixes"
- Fixed rendering issue

(Remove custom sections like "Features", "Improvements", etc.)
```

### Issue: Empty Unreleased Section

**Error:**
```
❌ Cannot release
   [Unreleased] section is empty
   Add entries before releasing
```

**Fix:**
Document work in [Unreleased]:
```markdown
## [Unreleased]

### Added
- New hero block component
- New positioning filter

### Fixed
- Fixed color picker in dark mode
```

### Issue: Inconsistent Date Format

**Error:**
```
❌ CHANGELOG validation failed
   Date format inconsistent: "2026-10-30" vs "Oct 30, 2026"
   Use YYYY-MM-DD for all versions
```

**Fix:**
```markdown
❌ ## [1.2.4] - Oct 30, 2026
✅ ## [1.2.4] - 2026-10-30
```

## Release Integration

### Before Release

```bash
# 1. Validate changelog
npm run check:changelog

# 2. Review entries
cat CHANGELOG.md | head -30

# 3. Verify version matches
grep "Stable tag:" readme.txt
head -1 VERSION
```

### During Release

The [[release]] skill:

1. Determines version type (patch/minor/major)
2. Moves [Unreleased] entries to version section
3. Dates the new section with today's date
4. Creates fresh [Unreleased] section
5. Adds comparison links
6. Commits and tags

### Post-Release

```bash
# Verify changelog was updated
git show HEAD:CHANGELOG.md | head -50

# Verify git tag was created
git tag | grep "v1.3.0"

# Verify version files updated
grep "Version:" plugin.php
```

## Changelog in Release Notes

The [[release]] skill uses CHANGELOG.md to generate GitHub Release notes:

```markdown
## What's Changed

### Added
- New card block component
- New hero block positioning filter

### Changed
- Improved block editor performance

### Fixed
- Fixed card block shadow rendering

[Compare on GitHub](https://github.com/lightspeedwp/my-plugin/compare/v1.2.4...v1.3.0)

**Contributors:** @john, @jane, @bot
```

## Best Practices

1. **Update as You Go** — Add changelog entries when PRs merge, not at release time
2. **User-Focused** — Write for end users, not developers
3. **One Entry Per Item** — Don't combine multiple fixes/features
4. **Be Specific** — Describe impact, not just technical change
5. **Link to Issues** — Reference issue numbers when relevant
6. **Keep It Short** — One line per entry is usually enough

## Changelog Workflow

```
Development
  ↓
PR merged with [Unreleased] entry added
  ↓
Multiple PRs merged, entries accumulate
  ↓
Ready to release
  ↓
Run: /release --dry-run
  ↓
Changelog validated and dated automatically
  ↓
Release published with notes from changelog
```

## Integration with Release Skill

This skill is called by [[release]] during version management:

```bash
/release --dry-run  # Includes changelog validation
/release --scope=minor  # Updates changelog automatically
```

## Integration with Hook Configuration

Pre-commit hooks can validate changelog:

```yaml
pre-commit:
  commands:
    validate-changelog:
      glob: "CHANGELOG.md"
      run: npm run validate:changelog
```

## Source Pack Notes

The `lightspeed-release-ops` plugin pack (`lightspeedwp/.github`, `plugins/lightspeed-release-ops`, commit
`47aee07`, GPL-3.0) has two stub skills that overlap with this one. Each stub is a heading and one sentence.
Their descriptions are recorded here so nothing is lost:

- `lightspeed-changelog-compliance`: "validate changelog completeness and semantic-release alignment before release
  handoff." This skill validates Keep a Changelog format compliance and catches incomplete entries. It does not
  cover semantic-release alignment. The term is not used anywhere else in this repository.
- `lightspeed-version-bump-planner`: "plan semantic version bump recommendations from change scope and release
  policy signals." This skill determines the version type from commit analysis (see Preparing for Release).

See [the review](../../docs/RELEASE_OPS_SKILLS_REVIEW.md) for the full comparison.

## See Also

- [[release]] — main release skill with changelog integration
- [[pre-push-validation]] — validates changelog before push
- [[hook-configuration]] — can enforce changelog validation
- [Keep a Changelog](https://keepachangelog.com/) — format specification
- [Semantic Versioning](https://semver.org/) — versioning guidelines
