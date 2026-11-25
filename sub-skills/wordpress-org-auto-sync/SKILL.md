---
name: wordpress-org-auto-sync
description: Automate WordPress.org SVN publishing for plugins and themes with error handling and rollback
metadata:
  version: 2.0.0
  updated: 2026-10-30
  author: LightSpeedWP Release Team
  category: release-automation
  tags:
    - wordpress.org
    - svn
    - automation
    - plugins
    - themes
    - distribution
    - ci-cd
  prerequisites:
    - GitHub Release published
    - SVN repository access (plugins.svn.wordpress.org or themes.svn.wordpress.org)
    - SVN credentials configured locally
    - Plugin/theme approved on WordPress.org
  tools:
    - Read
    - Write
    - Bash
    - Grep
    - Glob
  integrations:
    - release (main release skill)
    - changelog-management (changelog tracking)
    - pre-push-validation (pre-sync validation)
---

# WordPress.org Auto-Sync Skill

Automates end-to-end WordPress.org SVN publishing for block plugins and themes after GitHub Release publication. Handles detection, file syncing, SVN commits, asset management, verification, and error recovery with full rollback support.

## When to Use This Skill

**Trigger:** After a GitHub Release is published, before announcing publicly  
**Purpose:** Automatically sync the release to WordPress.org SVN without manual steps  
**Outcome:** Plugin/theme is live on WordPress.org with verification confirmation

### Prerequisites

- GitHub Release created with all files and changelog
- SVN repository already approved and available at WordPress.org
- SVN credentials working (`svn auth` or `~/.subversion/auth/`)
- Plugin/theme headers validated and version-matched
- readme.txt in WordPress.org format with correct "Stable tag"
- Assets prepared (icons, banners, screenshots for plugins; screenshot for themes)

## Auto-Sync Workflow Overview

The skill executes a 5-phase automated workflow:

### Phase 1: Detect & Initialize (2-3 minutes)
- Detect plugin vs. theme from repository structure
- Validate plugin or theme headers
- Determine WordPress.org SVN repository URL
- Clone or update local SVN working copy
- Verify SVN connectivity and authentication

### Phase 2: Sync Files (3-5 minutes)
- Copy release files from GitHub to SVN trunk/
- Remove deleted files from previous version
- Preserve WordPress.org-specific files (readme.txt stable tag)
- Handle binary files (assets) with SVN add/delete
- Generate file manifest for audit trail

### Phase 3: Create Tag & Commit (2-3 minutes)
- Copy trunk/ to tags/X.Y.Z/ for version tag
- Verify version in headers matches tag name
- Commit trunk/ changes with templated message
- Commit tag creation with release metadata
- Update readme.txt stable tag

### Phase 4: Verify Sync (2-4 minutes)
- Confirm SVN commits succeeded
- Check for commit conflicts or rejections
- Poll WordPress.org API for new version detection
- Validate assets appear in WordPress.org directory
- Verify changelog is readable on listing page

### Phase 5: Report & Rollback (1-2 minutes)
- Generate sync report with status, files changed, and URLs
- Track in release log for audit trail
- On failure: revert SVN commits and notify
- Provide troubleshooting steps for manual intervention

## Architecture: Detect Plugin vs. Theme

### Plugin Detection

```bash
# Plugin detected by presence of:
# 1. Single main plugin file matching repo name
# 2. Plugin header with "Plugin Name" and "Version"
# 3. wordpress-plugin topic in GitHub
# 4. block.json files in /blocks or /src/blocks directory

# SVN Repo: https://plugins.svn.wordpress.org/{slug}/
# Structure:
# - trunk/           (development version)
# - tags/X.Y.Z/      (version snapshots)
# - branches/        (optional development branches)
```

### Theme Detection

```bash
# Theme detected by presence of:
# 1. style.css or theme.json in repository root
# 2. Theme header with "Theme Name" and "Version"
# 3. wordpress-theme topic in GitHub
# 4. /templates directory or block theme structure

# SVN Repo: https://themes.svn.wordpress.org/{slug}/
# Structure:
# - trunk/           (development version)
# - tags/X.Y.Z/      (version snapshots)
# - branches/        (optional development branches)
```

### Detection Logic

```bash
# Run detection in this order:
1. Check for style.css with Theme header
   → If found: THEME
2. Check for plugin .php file with Plugin header
   → If found: PLUGIN
3. Check repository topics (github api)
   → If "wordpress-theme": THEME
   → If "wordpress-plugin": PLUGIN
4. Check directory structure
   → If /templates or /theme.json: THEME
   → If /blocks or block.json: PLUGIN
5. Default: Prompt user to confirm type
```

## File Sync Strategy

### Core Files Always Synced

For **plugins**:
```
✓ Main plugin file (.php)
✓ readme.txt
✓ /includes/ directory
✓ /blocks/ or /src/ directory
✓ /assets/ directory (icons, banners, screenshots)
✓ /languages/ directory
✓ Configuration files: composer.json, phpcs.xml
✗ Excluded: node_modules/, vendor/ (regenerated)
```

For **themes**:
```
✓ style.css
✓ theme.json
✓ readme.txt
✓ /templates/ directory
✓ /template-parts/ directory
✓ /patterns/ directory
✓ /assets/ directory
✓ /includes/ directory
✗ Excluded: node_modules/, build/ (regenerated)
```

### Excluded Patterns

Always excluded from SVN sync:
```
.git/
.gitignore
.github/
node_modules/
vendor/
build/
dist/
.env*
.DS_Store
composer.lock (usually, unless explicitly needed)
package-lock.json (usually, unless explicitly needed)
*.map
coverage/
.phpcs.cache
```

### Asset Management

**Plugin Assets**

Plugin assets live in a top-level `assets/` directory beside `trunk/`, not inside it.

```
assets/
├── icon-128x128.{png|jpg}      (required: minimum 128×128px)
├── icon-256x256.{png|jpg}      (recommended: for high-DPI)
├── banner-772x250.{jpg|png}    (recommended: plugin header banner)
├── screenshot-1.png            (recommended: feature showcase)
├── screenshot-2.png
└── screenshot-N.png            (up to 10 screenshots)
```

**Theme Assets**
```
trunk/
├── screenshot.png              (required: 1200×900px or 1200×800px minimum)
└── assets/
    ├── screenshot.png          (optional: if different from root)
    └── banner-772x250.{jpg|png} (optional: theme directory listing)
```

## SVN Commit Strategy

### Commit Messages Template

**Trunk Update Commit**
```
Version X.Y.Z: {release-title}

- Synced from GitHub release #{release-number}
- {changelog-summary-1-2-lines}

Files changed: {file-count}
Release: https://github.com/{owner}/{repo}/releases/tag/vX.Y.Z
```

**Tag Creation Commit**
```
Tagging version X.Y.Z

- Stable tag updated to X.Y.Z
- Released {date}
- GitHub release: https://github.com/{owner}/{repo}/releases/tag/vX.Y.Z
```

### Stable Tag Update

```
readme.txt in trunk/ MUST have:
  Stable tag: X.Y.Z

This is the version users download by default.
```

## Error Handling & Rollback

### Phase 1 Errors: Detection & Init

| Error | Recovery |
|-------|----------|
| SVN auth failed | Prompt for credentials, retry |
| Repository not found | Validate slug matches WordPress.org |
| Network timeout | Retry up to 3x with exponential backoff |
| Corrupt SVN working copy | `svn cleanup`, re-clone if needed |

### Phase 2 Errors: File Sync

| Error | Recovery |
|-------|----------|
| File conflict (uncommitted changes) | Abort with diff, require manual review |
| Large file (>100MB) | Error, suggest .gitignore update |
| Encoding issue (binary file) | Skip and log, allow operator override |
| Permission denied on file | Skip with warning, log as manual step |

### Phase 3 Errors: Tag & Commit

| Error | Recovery |
|-------|----------|
| Version mismatch (header ≠ tag) | Block sync, show diff, halt |
| Tag already exists | Prompt to use existing or error |
| SVN commit rejected | Fetch fresh copy, re-apply changes |
| Network interrupted mid-commit | Retry with `svn commit` (idempotent) |

### Phase 4 Errors: Verification

| Error | Recovery |
|-------|----------|
| WordPress.org API unreachable | Log as warning, manual verification required |
| Version not showing after 5min | Poll up to 30min, timeout with warning |
| Asset not visible | Note in report, may take 1hr to regenerate |
| Changelog parsing failed | Log sample, manual review suggested |

### Phase 5: Rollback

**On Critical Failure** (detected in Phase 3 or 4):
```bash
# 1. Revert SVN commits in reverse order
svn revert trunk/
svn delete tags/X.Y.Z/
svn commit -m "Rollback failed sync of vX.Y.Z"

# 2. Notify operator with:
#    - What was reverted
#    - Error details
#    - Next steps for manual intervention
#    - Link to troubleshooting guide
```

## Security Considerations

### SVN Credentials

```bash
# ✓ Use local svn auth storage
~/.subversion/auth/svn.simple/
~/.subversion/servers  (for proxy config)

# ✓ Never commit credentials to repo
# ✗ Never pass password on command line
# ✗ Never store in environment variables
# ✗ Never log credentials in output
```

### File Permissions

```bash
# SVN working copy should have restricted permissions
chmod 700 ~/.svn-working-copies/
chmod 600 ~/.subversion/auth/svn.simple/*

# Commits only affect your account (WordPress.org validates)
# Assets are scanned for malware on WordPress.org
```

### Validation Safeguards

```bash
# Before every commit:
1. Verify version in headers matches tag
2. Verify readme.txt syntax is valid
3. Verify plugin/theme headers are complete
4. Verify no private keys or secrets in files
5. Verify asset images don't exceed size limits
```

## Stable Tag vs. Development Version

### Understanding Stable Tag

**Stable tag** in readme.txt = version users download by default:

```
readme.txt (in trunk/)
Stable tag: 1.2.4

# Users download: tags/1.2.4/
# trunk/ is treated as development version (won't be released)
```

### Tag vs. Trunk Strategy

```
trunk/        →  Development version (future 1.3.0)
              →  Latest code, may be in beta
              →  Not downloaded by default users

tags/1.2.4/   →  Stable release (current version)
              →  What users download
              →  Must have passing tests
              →  Must have release notes

Stable tag: 1.2.4  →  Points to which tag users get
```

### Update Stable Tag After Release

```bash
# After tagging vX.Y.Z:
# 1. Update trunk/readme.txt
sed -i '' 's/Stable tag: .*/Stable tag: X.Y.Z/' trunk/readme.txt

# 2. Commit
svn commit -m "Update stable tag to X.Y.Z"

# 3. Verify on WordPress.org (updates within 1 minute)
```

## WordPress.org Publishing Guidelines

### Before Every Sync

✓ Plugin/theme headers must match WordPress.org requirements  
✓ readme.txt must use WordPress.org-compatible formatting  
✓ Assets must meet WordPress.org dimension and format requirements  
✓ No binary files except images and allowed assets  
✓ No calls to external APIs from hooks (WP.org scans for security)  
✓ GPL license headers required (validated in code scan)  

### Prohibited in WordPress.org

✗ Activation code that makes plugin inactive after X days  
✗ Calls to check for updates outside of WordPress.org  
✗ Donation nags or premium upsells in free version  
✗ Phoning home to external servers from free version  
✗ Injecting ads or affiliate links  
✗ Malicious or obfuscated code  
✗ Trademark violations in description  

### Asset Requirements Detail

**Plugin Icon Dimensions**
- 128×128 minimum (displayed at 128×128 in most contexts)
- 256×256 recommended (for high-DPI / retina displays)
- PNG or JPG format
- Filename must match: `icon-128x128.png`, `icon-256x256.jpg`

**Plugin Banner Dimensions**
- 772×250 pixels exactly (stretched across plugin header)
- JPG recommended (smaller file) or PNG
- Filename: `banner-772x250.jpg`
- High contrast for text overlay (tagline is overlaid on banner)

**Screenshot Dimensions**
- 540×400 pixels minimum (displayed at 272×200 in list)
- Larger is OK (will be scaled down)
- PNG or JPG
- Sequential naming: `screenshot-1.png`, `screenshot-2.png`, etc.
- WordPress.org limits to 10 screenshots per listing
- Captions added by users during submission stay in readme.txt

**Theme Screenshot Dimensions**
- 1200×900 pixels (displayed as 900×675 in directory)
- Minimum: 1200×800 pixels
- PNG or JPG
- Location: `screenshot.png` in theme root or `assets/screenshot.png`
- Must represent actual theme appearance

## Complete Auto-Sync Example Workflow

### Plugin Sync Example

```bash
# 1. GitHub Release published: v2.5.1
# 2. Operator runs: /wordpress-org-auto-sync --repo=my-plugin

# OUTPUT:
# ✓ Phase 1: Detected PLUGIN (my-plugin.php found)
# ✓ Phase 1: SVN repo: https://plugins.svn.wordpress.org/my-plugin/
# ✓ Phase 1: SVN auth verified (user: ash@lightspeedwp)
#
# ✓ Phase 2: Synced 47 files to trunk/
#   - Updated: my-plugin.php, readme.txt, /blocks (14 files)
#   - Added: /languages/de_DE.mo
#   - Removed: deprecated-helper.php
#   - Assets: banner-772x250.jpg (342KB), 3 screenshots
#
# ✓ Phase 3: Created tag tags/2.5.1/
# ✓ Phase 3: Committed to WordPress.org SVN
#   - Trunk commit: abc1234 (47 files)
#   - Tag commit: abc1235
#
# ✓ Phase 4: WordPress.org verification
#   - Version found in directory: 2.5.1 ✓
#   - Changelog parsed: 8 entries ✓
#   - Banner asset visible: Yes ✓
#   - Screenshots: 3 of 3 displaying ✓
#
# ✓ Phase 5: SYNC COMPLETE
# Report: /releases/2.5.1/wordpress-org-sync-report.md
# URL: https://wordpress.org/plugins/my-plugin/
```

### Theme Sync Example

```bash
# 1. GitHub Release published: v1.0.0 (block theme)
# 2. Operator runs: /wordpress-org-auto-sync --repo=my-theme

# OUTPUT:
# ✓ Phase 1: Detected THEME (theme.json + style.css found)
# ✓ Phase 1: SVN repo: https://themes.svn.wordpress.org/my-theme/
# ✓ Phase 1: SVN auth verified
#
# ✓ Phase 2: Synced 89 files to trunk/
#   - theme.json, style.css, readme.txt
#   - Templates: 8 updated
#   - Template parts: 6 updated
#   - Patterns: 12 updated
#   - Screenshot: 1200x900px
#   - Assets: banner-772x250.jpg
#
# ✓ Phase 3: Created tag tags/1.0.0/
# ✓ Phase 3: Committed to WordPress.org SVN
#
# ✓ Phase 4: WordPress.org verification
#   - Version found: 1.0.0 ✓
#   - Screenshot displaying: Yes ✓
#   - Installation available: Yes ✓
#
# ✓ Phase 5: SYNC COMPLETE
# Report: /releases/1.0.0/wordpress-org-sync-report.md
# URL: https://wordpress.org/themes/my-theme/
```

## Troubleshooting Common Issues

### "SVN command not found"
```bash
# Install SVN client
brew install subversion      # macOS
apt install subversion       # Ubuntu
# OR: apt install svn
yum install subversion       # CentOS/RHEL
```

### "SVN: E170013 Unable to connect to repository"
```bash
# Network issue or repo doesn't exist
# Verify:
1. Internet connection
2. Plugin/theme slug correct
3. Plugin/theme approved on WordPress.org
4. https://plugins.svn.wordpress.org/{slug}/  reachable
```

### "Commit failed: Version mismatch"
```bash
# Error: Version in plugin.php (1.0.1) ≠ tag name (1.0.0)

# Fix: Update all version references
grep -r "1.0.0" /path/to/plugin/
# Should find and update:
# - Main plugin file header: "Version: 1.0.1"
# - readme.txt: "Stable tag: 1.0.1"
# - style.css (themes): "Version: 1.0.1"
# - theme.json (optional): "version" property
```

### "Asset not showing on WordPress.org after commit"
```bash
# WordPress.org regenerates assets cache after ~1 hour
# Common issues:
1. Filename doesn't match pattern (banner-772x250.jpg, not banner.jpg)
2. Dimensions incorrect (banner must be exactly 772×250)
3. File type not supported (use .jpg, .jpeg, or .png only)
4. SVN add didn't register (svn status should show "A")

# Fix:
svn add assets/banner-772x250.jpg
svn commit -m "Add plugin banner"
# Wait up to 1 hour for WordPress.org to regenerate
```

### "Tag already exists"
```bash
# If version is released twice accidentally
# Option 1: Delete old tag in SVN (requires careful handling)
svn delete https://plugins.svn.wordpress.org/my-plugin/tags/1.2.4 \
  -m "Delete duplicate tag"

# Option 2: Use new semantic version (1.2.4.1)
# Update plugin header to 1.2.4.1
# Create tag 1.2.4.1
```

## Integration Points

### Upstream: GitHub Release

```bash
# Triggered after: GitHub Release published with version tag
# Requirement: Release has all files and changelog
# Outcome: Files available for SVN sync
```

### Downstream: Announcements

```bash
# After: wordpress-org-auto-sync completes successfully
# Next: Announce release with WordPress.org URL
# Link format: https://wordpress.org/plugins/{slug}/
```

### Related Skills

- [[release]] — orchestrates complete release workflow
- [[changelog-management]] — maintains changelog for WordPress.org
- [[pre-push-validation]] — validates before sync
- [[github-release]] — creates GitHub Release

## Related Documentation

See also:
- [[wordpress-org-plugin-svn]] — plugin-specific SVN structure details
- [[wordpress-org-theme-svn]] — theme-specific SVN structure details
- [WordPress Plugin Handbook](https://developer.wordpress.org/plugins/wordpress-org/)
- [WordPress Theme Directory](https://wordpress.org/themes/)
- [SVN & Git Clients Guide](https://developer.wordpress.org/plugins/wordpress-org/how-to-use-subversion/)
