# WordPress.org Plugin SVN Repository Structure

Complete reference for plugin SVN structure, file organization, and publishing requirements.

## Repository Overview

- **URL Pattern:** `https://plugins.svn.wordpress.org/{slug}/`
- **Type:** Apache Subversion (SVN)
- **Structure:** assets/, trunk/, tags/, branches/ (all at the repository root; `assets/` is not inside `trunk/`)
- **Initial Setup:** After plugin approval at WordPress.org
- **Credentials:** WordPress.org account with plugin commit access

## Complete Directory Structure

```
block-hero/                          (repository root)
├── assets/                          (WordPress.org listing images; beside trunk/, never inside it)
│   ├── icon-128x128.png            (128×128 minimum)
│   ├── icon-256x256.png            (256×256 recommended)
│   ├── banner-772x250.jpg          (772×250 header banner)
│   ├── screenshot-1.png            (540×400 minimum)
│   ├── screenshot-2.png            (feature showcase)
│   ├── screenshot-3.png
│   └── screenshot-4.png
│
├── trunk/                           (development version)
│   ├── block-hero.php              (main plugin file, required)
│   ├── readme.txt                  (WP.org format, required)
│   ├── plugin.php                  (optional: alternative main file)
│   ├── uninstall.php               (optional: cleanup on removal)
│   │
│   ├── blocks/                     (Gutenberg blocks)
│   │   ├── hero-block/
│   │   │   ├── block.json
│   │   │   ├── edit.js
│   │   │   ├── save.js
│   │   │   ├── style.scss
│   │   │   └── render.php
│   │   ├── feature-block/
│   │   └── cta-block/
│   │
│   ├── includes/                   (PHP includes)
│   │   ├── admin/
│   │   │   ├── settings.php
│   │   │   └── metabox.php
│   │   ├── frontend/
│   │   │   └── shortcodes.php
│   │   └── class-plugin.php        (main plugin class)
│   │
│   ├── languages/                 (i18n translations)
│   │   ├── block-hero.pot         (source template)
│   │   ├── block-hero-de_DE.po    (German translation)
│   │   └── block-hero-de_DE.mo    (compiled German)
│   │
│   ├── css/                       (optional: if separating from blocks)
│   │   └── plugin.css
│   │
│   ├── js/                        (optional: admin/frontend JS)
│   │   ├── admin.js
│   │   └── frontend.js
│   │
│   ├── composer.json              (PHP dependencies, recommended)
│   ├── phpcs.xml                  (code standards config)
│   └── wp-cli-commands.php        (optional: custom WP-CLI commands)
│
├── tags/                          (release versions)
│   ├── 1.0.0/
│   │   ├── block-hero.php
│   │   ├── readme.txt
│   │   ├── blocks/
│   │   ├── includes/
│   │   ├── assets/
│   │   └── languages/
│   │
│   ├── 1.1.0/
│   │   └── (full copy of plugin at that version)
│   │
│   ├── 2.0.0/
│   │   └── (full copy of plugin at that version)
│   │
│   ├── 2.3.0/
│   └── 2.3.1/                    (latest version for users)
│
└── branches/                      (optional: development branches)
    └── feature-dark-mode/        (long-running feature branch)
        └── (full copy of plugin with experimental features)
```

## Plugin Header Requirements

All plugins must have a valid PHP plugin header in the main file:

```php
<?php
/**
 * Plugin Name: Block Hero
 * Plugin URI: https://wordpress.org/plugins/block-hero/
 * Description: A modern hero block for Gutenberg with parallax effects
 * Version: 2.3.1
 * Author: LightSpeedWP
 * Author URI: https://github.com/lightspeedwp/
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: block-hero
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * Tested up to: 6.5
 * Requires Plugins: (dependencies as comma-separated list, optional)
 *
 * @package BlockHero
 */
```

### Header Field Details

| Field | Purpose | Example | Required |
|-------|---------|---------|----------|
| Plugin Name | Display name | "Block Hero" | Yes |
| Plugin URI | Plugin page | "https://wordpress.org/plugins/..." | Yes |
| Description | Plugin description (max 150 chars) | "A modern hero block..." | Yes |
| Version | Semantic version | "2.3.1" | Yes |
| Author | Author name | "LightSpeedWP" | Yes |
| Author URI | Author website | "https://github.com/lightspeedwp/" | Optional |
| License | License type | "GPL v2 or later" | Yes |
| License URI | License URL | "https://www.gnu.org/licenses/gpl-2.0.html" | Yes |
| Text Domain | i18n domain | "block-hero" | Yes (if translatable) |
| Domain Path | Translations folder | "/languages" | Yes (if i18n) |
| Requires at least | Min WordPress version | "5.8" | Recommended |
| Requires PHP | Min PHP version | "7.4" | Recommended |
| Tested up to | Max tested WordPress | "6.5" | Recommended |

## readme.txt Format

WordPress.org requires a specific readme.txt format (NOT markdown, NOT RST):

```
=== Block Hero ===
Contributors: lightspeedwp, coauthor1, coauthor2
Donate link: https://github.com/sponsors/lightspeedwp
Tags: blocks, gutenberg, hero, parallax, wordpress
License: GPL v2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Requires at least: 5.8
Requires PHP: 7.4
Tested up to: 6.5
Stable tag: 2.3.1

Add modern hero blocks to Gutenberg with parallax and gradient overlays.

== Description ==

Block Hero adds a professional hero block component to Gutenberg:

- Parallax scroll effect on background images
- Customizable gradient overlays
- Typography settings for headlines and subheadings
- Call-to-action button with hover effects
- Full-width and contained layout options
- Responsive design with mobile optimization

Works with any block theme or classic theme with block support.

== Installation ==

1. Upload the plugin files to `/wp-content/plugins/block-hero/`
2. Activate the plugin through the 'Plugins' screen in WordPress
3. Start using the "Hero" block in Gutenberg

OR install from WordPress.org:
1. Go to Plugins > Add New
2. Search for "Block Hero"
3. Click "Install Now" > "Activate"

== Frequently Asked Questions ==

= How do I customize the hero block? =

Select the hero block in Gutenberg. Settings appear in the right sidebar:
- Image: Upload or select from media library
- Overlay: Choose color and opacity
- Text: Add headline and subheading
- Button: Link and text for CTA

= Does this work with my theme? =

Yes! Block Hero works with any WordPress theme that supports blocks.

= Can I use the parallax effect on mobile? =

Yes, but parallax is optimized for desktop. Mobile shows static background.

== Screenshots ==

1. Hero block editor view with settings panel
2. Frontend display with parallax effect (desktop)
3. Mobile responsive design
4. Gradient overlay options

== Changelog ==

= 2.3.1 =
* Fixed z-index issue with overlay on mobile
* Improved accessibility for button focus states
* Updated translations (de_DE, fr_FR, es_ES)

= 2.3.0 =
* Added gradient overlay color picker
* New "fade" animation option
* Performance improvements for multiple hero blocks
* Updated to WordPress 6.5 compatibility

= 2.2.0 =
* Initial block theme support
* Added theme.json integration
* Refactored editor UI

= 2.1.0 =
* Fixed image upload issues
* Improved mobile responsiveness
* Added Spanish translations

= 2.0.0 =
* Complete rewrite using modern Gutenberg API
* Added parallax effect
* Block variations for different layouts

= 1.0.0 =
* Initial release

== Support ==

Support is available at:
- GitHub Issues: https://github.com/lightspeedwp/block-hero/issues
- WordPress Forums: https://wordpress.org/support/plugin/block-hero/

== Credits ==

Developed by [LightSpeedWP](https://github.com/lightspeedwp/)

== License ==

This plugin is licensed under the GNU General Public License v2 or later.
See LICENSE file for details.
```

## Asset File Requirements

### Plugin Icons

**128×128 Icon** (minimum, usually primary icon)
```
assets/icon-128x128.png
- Dimensions: 128×128 pixels exactly
- Format: PNG (recommended) or JPG
- Background: Transparent PNG preferred
- Used: Plugin search results, small areas
- File size: < 500 KB
```

**256×256 Icon** (recommended, high-DPI)
```
assets/icon-256x256.png
- Dimensions: 256×256 pixels exactly
- Format: PNG (recommended) or JPG
- Background: Transparent PNG preferred
- Used: Plugin detail page header
- File size: < 2 MB
```

### Plugin Banner

```
assets/banner-772x250.jpg
- Dimensions: 772×250 pixels exactly (not approximate)
- Format: JPG recommended (PNG OK)
- Design: Clear, high contrast
- Text overlay: Safe area is center 600px width
- Used: Plugin directory header, search results
- File size: < 2 MB
```

### Plugin Screenshots

```
assets/screenshot-1.png
assets/screenshot-2.png
assets/screenshot-3.png  (up to 10 total)

- Dimensions: 540×400 minimum (larger OK, will be scaled)
- Format: PNG or JPG
- Content: Clear, professional images
- Numbering: Sequential (1, 2, 3, not random)
- Captions: Added via readme.txt or wp.org upload
- File size: < 5 MB each
```

## File Size Limits

- **Single file:** No hard limit, but keep reasonable (< 10 MB for binaries)
- **Plugin total:** Typical plugin is 1-50 MB, rarely exceeds 100 MB
- **Assets:** Icon < 2 MB, banner < 2 MB, screenshots < 5 MB each
- **SVN repository:** Typically grows 5-20 MB per major version released

## Excluded Files

The following must NOT be in trunk/ (will fail WordPress.org scan):

```
.git/                     # Version control
.github/                  # CI/CD workflows
.gitignore               # Git configuration
node_modules/            # npm dependencies (regenerated from package.json)
vendor/                  # Composer dependencies (regenerated from composer.json)
build/                   # Build artifacts
dist/                    # Distribution files
.env                     # Environment variables, secrets
.env.local              # Local configuration
.DS_Store               # macOS system file
Thumbs.db               # Windows system file
*.map                   # Source maps
coverage/               # Test coverage reports
.phpcs.cache            # Cache files
wp-cli.yml              # Local CLI config
local.json              # Local development config
*.swp, *.swo           # Editor swap files
```

## Version Numbering

WordPress.org plugin versions follow semantic versioning:

```
MAJOR.MINOR.PATCH[-PRERELEASE]

2.3.1
^     ^ ^
|     | └─ Patch (bug fixes)
|     └─── Minor (new features, backward compatible)
└───────── Major (breaking changes)

Examples:
1.0.0      First stable release
1.1.0      New features added
1.1.1      Bug fix
2.0.0      Major update, breaking changes
```

**Version Tag Rules:**
- Tag must match plugin header version exactly
- Use semantic versioning format
- No "v" prefix in tag (just "2.3.1", not "v2.3.1")
- Each version released once (don't re-tag)

## Stable Tag Concept

The "Stable tag" in readme.txt determines what version users download:

```
readme.txt (trunk/)
Stable tag: 2.3.1

Result:
- Users download: /tags/2.3.1/ version
- trunk/ is NOT downloaded (considered development)
- WordPress.org updates stable tag within 1 minute
```

**When to Update Stable Tag:**
1. After creating a new release tag
2. When rolling back to previous version (emergency)
3. After emergency security patch

## Commit Message Guidelines

### Trunk Commit
```
Version X.Y.Z: {Short release title}

{Optional multi-line description of changes}

- Changelog item 1
- Changelog item 2
- Changelog item 3

Files changed: {N} files
Release: https://github.com/{owner}/{repo}/releases/tag/vX.Y.Z
```

### Tag Creation Commit
```
Tagging version X.Y.Z

Released: {date}
Stable tag updated to X.Y.Z
```

## First Release Workflow

```bash
# 1. Plugin approved on WordPress.org
# Get URL: https://wordpress.org/plugins/block-hero/

# 2. Get SVN repository
svn checkout https://plugins.svn.wordpress.org/block-hero/ block-hero-svn
cd block-hero-svn
ls -la
# Should show: assets/ branches/ tags/ trunk/

# 3. Copy plugin files to trunk/
cp -r ../block-hero-github/* trunk/

# 4. Add assets (top-level assets/, beside trunk/)
mkdir -p assets
cp ../artwork/icon-128x128.png assets/
cp ../artwork/banner-772x250.jpg assets/
cp ../artwork/screenshot-*.png assets/

# 5. Stage all files
svn add --force trunk/ assets/

# 6. Verify readme.txt stable tag
cat trunk/readme.txt | grep "Stable tag"
# Should show: Stable tag: 1.0.0

# 7. Commit trunk
svn commit -m "Version 1.0.0: Initial release"

# 8. Create tag
svn cp trunk tags/1.0.0
svn commit -m "Tagging version 1.0.0"

# 9. Verify on WordPress.org
# Visit: https://wordpress.org/plugins/block-hero/
```

## Ongoing Release Workflow

```bash
cd block-hero-svn

# 1. Update SVN copy
svn update

# 2. Clear trunk and copy new version
rm -rf trunk/*
cp -r ../block-hero-github/* trunk/

# 3. Update readme.txt stable tag
sed -i '' 's/Stable tag: .*/Stable tag: 2.3.1/' trunk/readme.txt

# 4. Handle files
svn add trunk/*                    # Add new files
svn status | grep "^!" | cut -c 9- | xargs svn delete  # Remove deleted files

# 5. Review changes
svn diff trunk/ | head -100

# 6. Commit trunk
svn commit -m "Version 2.3.1: Performance improvements and bug fixes"

# 7. Create tag
svn cp trunk tags/2.3.1
svn commit -m "Tagging version 2.3.1"

# 8. Verify on WordPress.org (within 1-5 minutes)
```

## Integration with Auto-Sync Skill

The wordpress-org-auto-sync skill automates all of the above workflow:

```bash
/wordpress-org-auto-sync --plugin block-hero --version 2.3.1

# Automatically:
# 1. Detects plugin structure
# 2. Clones/updates SVN
# 3. Syncs files
# 4. Creates tag
# 5. Commits to WordPress.org
# 6. Verifies on WordPress.org
# 7. Generates report
```

## Troubleshooting

### "Version mismatch" error
Ensure these all match:
- block-hero.php header: `Version: 2.3.1`
- readme.txt: `Stable tag: 2.3.1`
- SVN tag name: `tags/2.3.1/`

### "Icon not showing"
- File must be exactly 128×128 or 256×256 pixels
- Filename must match: `icon-128x128.png` (not `icon.png`)
- Wait up to 1 hour for cache regeneration on WordPress.org

### "Commit rejected"
- Check SVN auth with: `svn status`
- Verify no uncommitted changes: `svn status` (should be empty)
- Update before committing: `svn update`

See main SKILL.md for complete troubleshooting guide.
