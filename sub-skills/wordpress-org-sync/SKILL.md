---
name: wordpress-org-sync
description: Prepare and sync WordPress block plugins and themes to WordPress.org directory
metadata:
  version: 1.0.0
  updated: 2026-10-30
  author: LightSpeedWP Release Team
  tags:
    - wordpress.org
    - publishing
    - plugins
    - themes
    - distribution
  tools:
    - Read
    - Write
    - Bash
    - Grep
  requires:
    - SVN client (svn command)
    - WordPress.org plugin/theme account
    - readme.txt in wordpress.org format
    - Valid plugin/theme headers
---

# WordPress.org Sync Skill

Prepares WordPress block plugins and themes for publication on WordPress.org directory and manages SVN repository synchronization for ongoing releases.

## Purpose

This sub-skill streamlines WordPress.org publishing by:

- **Validating** plugin/theme compliance with wordpress.org requirements
- **Preparing** SVN repository structure and assets
- **Automating** readme.txt formatting for plugin/theme directory listing
- **Managing** asset uploads (screenshots, banner, icon)
- **Syncing** releases to WordPress.org SVN
- **Verifying** successful publication on wordpress.org

## WordPress.org Directory Structure

### Plugin SVN Repository

WordPress.org plugins use this SVN structure:

```
my-plugin/
├── assets/                  (directory listing images; top level, beside trunk/, never inside it)
│   ├── icon-128x128.jpg
│   ├── icon-256x256.jpg
│   ├── screenshot-1.png
│   ├── screenshot-2.png
│   └── banner-772x250.jpg
├── trunk/
│   ├── my-plugin.php
│   ├── readme.txt
│   ├── includes/
│   │   └── ...
│   └── blocks/
│       └── ...
├── tags/
│   ├── 1.0.0/
│   │   ├── my-plugin.php
│   │   ├── readme.txt
│   │   ├── includes/
│   │   └── blocks/
│   │
│   └── 1.1.0/
│       └── ...
└── branches/
    └── (optional: development branches)
```

### Theme SVN Repository

WordPress.org themes use similar structure:

```
my-theme/
├── trunk/
│   ├── style.css
│   ├── theme.json
│   ├── readme.txt
│   ├── screenshot.png
│   ├── templates/
│   ├── template-parts/
│   ├── patterns/
│   ├── assets/
│   │   ├── screenshot.png (1200x900px)
│   │   └── banner-772x250.jpg
│   └── ...
├── tags/
│   ├── 1.0.0/
│   │   └── (full theme copy)
│   └── 1.1.0/
│       └── ...
└── branches/
    └── (optional)
```

## Pre-Sync Validation

Before syncing to WordPress.org, validate:

### For Plugins

1. **Plugin Header** (.php file)
   ```php
   <?php
   /**
    * Plugin Name: My Block Plugin
    * Plugin URI: https://wordpress.org/plugins/my-block-plugin/
    * Description: Clear description
    * Version: 1.2.4
    * Author: LightSpeedWP
    * License: GPL v2 or later
    * License URI: https://www.gnu.org/licenses/gpl-2.0.html
    * Text Domain: my-plugin
    * Domain Path: /languages
    * Requires at least: 5.8
    * Requires PHP: 7.4
    * Tested up to: 6.4
    */
   ```

2. **readme.txt** (wordpress.org format)
   ```
   === My Block Plugin ===
   Contributors: lightspeedwp
   Donate link: https://github.com/sponsors/lightspeedwp
   Tags: blocks, wordpress, gutenberg
   License: GPL v2 or later
   License URI: https://www.gnu.org/licenses/gpl-2.0.html
   Requires at least: 5.8
   Tested up to: 6.4
   Requires PHP: 7.4
   Stable tag: 1.2.4

   Short plugin description (max 150 chars)

   == Description ==

   Longer description explaining what the plugin does.

   == Installation ==

   1. Upload the plugin files to `/wp-content/plugins/my-block-plugin/`
   2. Activate the plugin through the 'Plugins' screen in WordPress
   3. Configure settings at Settings > My Block Plugin

   == Frequently Asked Questions ==

   = How do I use the plugin? =

   [Answer here]

   == Screenshots ==

   1. Hero block in block editor
   2. Hero block on frontend
   3. Theme settings

   == Changelog ==

   = 1.2.4 =
   * Fixed rendering issue with custom post types
   * Improved performance

   = 1.2.3 =
   * Initial release

   == Support ==

   For support, visit [GitHub repository](https://github.com/lightspeedwp/my-plugin/)
   ```

3. **Assets Required**
   - `assets/icon-128x128.jpg` or `.png` (square, 128x128px minimum)
   - `assets/icon-256x256.jpg` or `.png` (square, 256x256px)
   - `assets/banner-772x250.jpg` or `.png` (plugin header banner)
   - `assets/screenshot-1.png`, `screenshot-2.png`, etc. (540x400px)

### For Themes

1. **Theme Header** (style.css)
   ```css
   /*
   Theme Name: My Block Theme
   Theme URI: https://wordpress.org/themes/my-block-theme/
   Author: LightSpeedWP
   Author URI: https://github.com/lightspeedwp/
   Description: Block theme description
   Version: 1.2.4
   License: GPL v2 or later
   License URI: https://www.gnu.org/licenses/gpl-2.0.html
   Text Domain: my-theme
   Domain Path: /languages
   Requires at least: 6.0
   Tested up to: 6.4
   Requires PHP: 7.4
   */
   ```

2. **readme.txt** (wordpress.org format)
   ```
   === My Block Theme ===
   Contributors: lightspeedwp
   Tags: block-theme, wordpress, gutenberg
   License: GPL v2 or later
   License URI: https://www.gnu.org/licenses/gpl-2.0.html
   Requires at least: 6.0
   Tested up to: 6.4
   Requires PHP: 7.4

   A block theme for WordPress.

   == Description ==

   [Theme description]

   == Installation ==

   1. Go to Appearance > Themes
   2. Click "Add New"
   3. Search for "My Block Theme"
   4. Click "Install" then "Activate"

   == Changelog ==

   = 1.2.4 =
   * Improved typography settings
   * Fixed color palette consistency

   = 1.2.0 =
   * Initial release
   ```

3. **Assets Required**
   - `screenshot.png` (1200x900px, or 1200x800px at minimum)
   - `assets/screenshot.png` (if different from theme root)
   - `assets/banner-772x250.jpg` (optional but recommended)

## SVN Repository Setup

### First-Time Plugin Setup

```bash
# 1. Get SVN repository URL from WordPress.org
# After plugin approval: https://plugins.svn.wordpress.org/my-plugin/

# 2. Create local SVN working copy
svn checkout https://plugins.svn.wordpress.org/my-plugin/ my-plugin-svn
cd my-plugin-svn

# 3. Verify structure exists
ls -la
# Should show: assets/ branches/ tags/ trunk/

# 4. Copy plugin files to trunk/
cp -r ../my-plugin-github/* trunk/

# 5. Add wordpress.org assets to the top-level assets/ (beside trunk/, not inside it)
mkdir -p assets
cp ../artwork/icon-128x128.png assets/
cp ../artwork/banner-772x250.png assets/
cp ../artwork/screenshot-*.png assets/
```

### First-Time Theme Setup

```bash
# 1. Get SVN repository URL
# After theme approval: https://themes.svn.wordpress.org/my-theme/

# 2. Create local SVN working copy
svn checkout https://themes.svn.wordpress.org/my-theme/ my-theme-svn
cd my-theme-svn

# 3. Copy theme files to trunk/
cp -r ../my-theme-github/* trunk/

# 4. Copy screenshot
cp ../artwork/screenshot.png trunk/
```

## Release: Tag Creation in SVN

### Creating a Version Tag

When releasing version 1.2.4:

```bash
# 1. Navigate to SVN working copy
cd my-plugin-svn

# 2. Copy trunk/ to tags/X.Y.Z/
svn cp trunk/ tags/1.2.4/

# 3. Verify copy
svn status
# Should show A (added) for tags/1.2.4/

# 4. Commit to WordPress.org
svn commit -m "Tagging 1.2.4 release"
# (WordPress.org verifies version in headers matches tag name)
```

### Updating Stable Tag

Update readme.txt to mark stable version:

```
Stable tag: 1.2.4
```

Then commit:

```bash
svn add trunk/readme.txt
svn commit -m "Update stable tag to 1.2.4"
```

## Complete Release Sync Workflow

### Step 1: Prepare SVN Working Copy

```bash
# 1. Ensure SVN copy is up to date
cd my-plugin-svn
svn update

# 2. Check status (should be clean)
svn status
```

### Step 2: Sync trunk/ with Latest Release

```bash
# 1. Clear current trunk/
rm -rf trunk/*

# 2. Copy latest plugin files
cp -r ../my-plugin-github/* trunk/

# 3. Check what changed
svn status trunk/

# 4. Add/delete files as needed
svn add trunk/path/to/new/file
svn delete trunk/path/to/old/file

# 5. Review changes
svn diff trunk/ | head -100
```

### Step 3: Update readme.txt

Ensure readme.txt in trunk/:
- Has correct "Stable tag: X.Y.Z"
- Has up-to-date changelog
- Has correct plugin/theme headers

```bash
# Verify readme.txt was updated
cat trunk/readme.txt | grep "Stable tag"
# Should show: Stable tag: 1.2.4
```

### Step 4: Verify Assets

For plugins, verify the top-level assets/ directory (beside trunk/):

```bash
# Check assets present
ls assets/
# Should include:
# - icon-128x128.png (or .jpg)
# - icon-256x256.png (or .jpg)
# - banner-772x250.png (or .jpg)
# - screenshot-1.png, screenshot-2.png, etc.
```

### Step 5: Create Version Tag

```bash
# Copy trunk to tags/1.2.4
svn cp trunk/ tags/1.2.4/

# Verify
svn status
# A tags/1.2.4/
```

### Step 6: Commit All Changes

```bash
# Commit trunk updates
svn commit -m "Release 1.2.4: Add hero block and performance improvements"

# Commit tag creation (if needed separately)
svn commit -m "Tagging 1.2.4"
```

### Step 7: Verify on wordpress.org

```bash
# 1. Visit plugin/theme page
https://wordpress.org/plugins/my-block-plugin/

# 2. Check version is correct
# Should show: Version 1.2.4

# 3. Check changelog
# Should show recent entries from readme.txt

# 4. Check assets appear
# Icon, banner, and screenshots should be visible
```

## Troubleshooting SVN Issues

### SVN Authentication Failed

```bash
# 1. Verify WordPress.org account
# Plugin/theme must be approved and you must have commit access

# 2. Generate SVN credentials
# Visit: https://wordpress.org/support/article/svn-and-git-clients/

# 3. Re-authenticate
svn cleanup
svn update
# Will prompt for username/password
```

### Version Mismatch Error

```bash
❌ Error: Version in header (1.2.3) doesn't match tag (1.2.4)

# Fix:
# 1. Update plugin/theme header to match tag
# 2. Update VERSION file
# 3. Commit to SVN
```

### Asset Upload Failed

```bash
❌ Banner not showing on wordpress.org

# 1. Verify file path: assets/banner-772x250.jpg
# 2. Verify dimensions: 772×250 pixels
# 3. Verify file format: .jpg, .jpeg, or .png
# 4. Re-add to SVN:
svn add assets/banner-772x250.jpg
svn commit -m "Add plugin banner"

# 5. WordPress.org regenerates after ~1 hour
```

## Integration with Release Skill

The [[release]] skill coordinates with this skill:

```bash
# 1. Run complete release
/release --scope=minor

# 2. Skill performs:
#    a. Validate readiness
#    b. Update versions
#    c. Update changelog
#    d. Create git tag
#    e. Prepare WordPress.org package
#    f. Generate sync instructions
```

## WordPress.org Release Checklist

```markdown
# WordPress.org Release Checklist for v1.2.4

## Pre-Release Validation
- [x] Plugin/theme headers correct
- [x] readme.txt follows wordpress.org format
- [x] Assets prepared (icons, banners, screenshots)
- [x] Version matches across all files
- [x] Changelog updated

## SVN Preparation
- [x] SVN working copy updated (svn update)
- [x] trunk/ files copied
- [x] readme.txt updated with stable tag
- [x] Assets in top-level assets/ (beside trunk/)
- [x] Changes reviewed (svn diff)

## Tag Creation
- [x] Version tag created (svn cp trunk tags/1.2.4/)
- [x] No uncommitted changes (svn status)
- [x] Committed to WordPress.org SVN

## Post-Release
- [x] Plugin page shows version 1.2.4
- [x] Changelog visible on wordpress.org
- [x] Assets (icon, banner, screenshots) display
- [x] Download link works
- [x] GitHub release matches wordpress.org version

## Ready to Announce ✅
```

## Best Practices

1. **Keep SVN Separate** — Maintain separate SVN working copy, don't mix with git repo
2. **Test Before Sync** — Verify wordpress.org compliance before each release
3. **Tag Carefully** — Ensure version matches exactly (1.2.4, not 1.2.4.0)
4. **Asset Dimensions** — Follow wordpress.org asset size requirements exactly
5. **Document Changes** — Keep readme.txt changelog up to date
6. **Verify Publish** — Always check wordpress.org after sync to confirm success

## WordPress.org Asset Requirements

### Plugin Icon
- Minimum: 128×128 pixels (displayed as 128×128)
- Recommended: 256×256 pixels (for high-DPI displays)
- Location: `assets/icon-128x128.png` (or .jpg)
- Format: PNG or JPG
- Filename must match size: `icon-128x128`, `icon-256x256`

### Plugin Banner
- Size: 772×250 pixels (displayed across plugin header)
- Location: `assets/banner-772x250.jpg`
- Format: JPG (recommended) or PNG
- High contrast with text overlay

### Plugin Screenshots
- Size: 540×400 pixels (or larger)
- Location: `assets/screenshot-1.png`, `screenshot-2.png`, etc.
- Format: PNG or JPG
- Clear, high-quality images

### Theme Screenshot
- Size: 1200×900 pixels (or 1200×800 at minimum)
- Location: `screenshot.png` in theme root (or `assets/screenshot.png`)
- Format: PNG or JPG
- Representative of theme appearance

## See Also

- [[release]] — main release skill coordinating wordpress.org sync
- [[changelog-management]] — managing changelog for wordpress.org listing
- [[pre-push-validation]] — validating before release
- [WordPress Plugin Handbook](https://developer.wordpress.org/plugins/wordpress-org/)
- [WordPress Theme Directory](https://wordpress.org/themes/)
- [WordPress.org SVN Guide](https://developer.wordpress.org/plugins/wordpress-org/how-to-use-subversion/)
