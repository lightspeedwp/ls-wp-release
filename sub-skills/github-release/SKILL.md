---
name: github-release
description: Create and publish GitHub releases with annotated tags, release notes, and WordPress.org-compatible assets
metadata:
  version: 1.0.0
  updated: 2026-10-30
  author: LightSpeedWP Release Team
  tags:
    - github
    - releases
    - tagging
    - wordpress
---

# GitHub Release Skill

Handles creation and publication of GitHub releases for WordPress block plugins and themes, including git tagging, release notes compilation, and asset generation.

## Purpose

This sub-skill coordinates:

1. **Git Tag Creation**
   - Creates annotated tags in format `vX.Y.Z`
   - Tags include tagger information and release notes
   - Tags are pushed to remote repository

2. **GitHub Release Publishing**
   - Publishes GitHub Release with changelog excerpt
   - Compiles contributor list from merged PRs
   - Attaches release assets (zip, WordPress.org package)
   - Sets release as pre-release if version is beta/RC

3. **Release Notes Generation**
   - Extracts relevant sections from CHANGELOG.md
   - Generates highlights from Added/Changed/Security sections
   - Adds breaking changes callout for major releases
   - Lists contributors with credit links
   - Includes migration guide link if applicable

4. **Asset Management**
   - Creates distributable zip package with version in filename
   - Generates WordPress.org-ready SVN structure
   - Attaches relevant assets to GitHub Release
   - Creates checksums for security verification

## Workflow

### Input Requirements

This skill expects:

```
{
  "version": "1.2.4",           // SemVer format (from VERSION file)
  "scope": "patch",             // patch, minor, or major
  "changelog": "## [1.2.4]...", // Versioned changelog section
  "branch": "release/v1.2.4",   // Release branch (already pushed)
  "commitSha": "a1b2c3d4...",   // Commit to tag
  "contributors": [             // List of contributors
    {"name": "John Doe", "url": "https://github.com/johndoe"},
    {"name": "Jane Smith", "url": "https://github.com/janesmith"}
  ],
  "projectType": "plugin",      // plugin or theme
  "isPreRelease": false         // true for beta/RC versions
}
```

### Step 1: Create Annotated Git Tag

```bash
GIT_COMMITTER_NAME="Release Agent" \
GIT_COMMITTER_EMAIL="release@lightspeedwp.agency" \
git tag -a vX.Y.Z \
  -m "Release version X.Y.Z" \
  -m "" \
  -m "Release notes:" \
  -m "See GitHub Release for details" \
  <COMMIT_SHA>

git push origin vX.Y.Z
```

### Step 2: Compile Release Notes

Extract from CHANGELOG.md:

```markdown
## X.Y.Z Release Notes

### What's New
- [Added items from changelog]
- [Changed items]
- [Security fixes]

### Breaking Changes
⚠️ This is a major release with breaking changes:
- [List breaking changes]
- See [MIGRATION_GUIDE.md](link) for upgrade instructions

### Contributors
Thanks to our contributors for this release:
- @contributor1
- @contributor2

### Full Changelog
[Full changelog comparison link]
```

### Step 3: Create Release Assets

Required tools: `zip`, and `sha256sum` (Linux) or `shasum -a 256` (macOS). No image tools are needed.

Build first (for example `npm run build`) so compiled output exists, then package only
what users should receive. Do not ship development files such as `.git/`, `.github/`,
`node_modules/`, source maps, tests, lockfiles or editor/OS files. If the project already
keeps an exclusion list (for example `.distignore`), apply that list instead of the one below.

#### For Plugins

```bash
# Create distributable zip (excluding development files)
mkdir -p release-assets
cp -r plugin-files release-assets/plugin-name
cd release-assets
zip -r plugin-name-v1.2.4.zip plugin-name/ \
  -x "*/.git/*" "*/.github/*" "*/node_modules/*" "*/tests/*" \
  -x "*.map" "*/.DS_Store" "*/package-lock.json" "*/composer.lock"
sha256sum plugin-name-v1.2.4.zip > plugin-name-v1.2.4.zip.sha256   # macOS: shasum -a 256 ...

# Create WordPress.org SVN structure
mkdir -p wordpress-org-sync/tags/1.2.4
cp -r plugin-files wordpress-org-sync/tags/1.2.4/
# No .svnignore is applied automatically: remove the same development files from this copy.
# See "Excluded Patterns" in the wordpress-org-auto-sync sub-skill for the list.
```

#### For Themes

```bash
# Create distributable zip (excluding development files)
mkdir -p release-assets
cp -r theme-files release-assets/theme-name
cd release-assets
zip -r theme-name-v1.2.4.zip theme-name/ \
  -x "*/.git/*" "*/.github/*" "*/node_modules/*" "*/tests/*" \
  -x "*.map" "*/.DS_Store" "*/package-lock.json" "*/composer.lock"
sha256sum theme-name-v1.2.4.zip > theme-name-v1.2.4.zip.sha256   # macOS: shasum -a 256 ...

# Check the theme screenshot (do not resize it: a different aspect ratio would distort it)
file theme-name/screenshot.png   # should report the expected 1200 x 900 dimensions
```

### Step 4: Publish GitHub Release

```bash
gh release create vX.Y.Z \
  --title "Release X.Y.Z" \
  --notes-file release-notes.md \
  --prerelease=<true|false> \
  release-assets/plugin-name-vX.Y.Z.zip \
  release-assets/plugin-name-vX.Y.Z.zip.sha256
```

## Configuration

### Customize Release Notes Template

Create `.github/release-notes-template.md`:

```markdown
## What's New in X.Y.Z

[CHANGELOG]

## Credits

[CONTRIBUTORS]

## Upgrade Guide

[MIGRATION_GUIDE_LINK]

## Verify Your Download

All releases are signed and checksummed:

\`\`\`bash
sha256sum -c plugin-name-vX.Y.Z.zip.sha256      # macOS: shasum -a 256 -c plugin-name-vX.Y.Z.zip.sha256
\`\`\`

[DOWNLOAD_ALL_ASSETS]
```

### WordPress.org SVN Configuration

For automatic SVN sync, create `.github/wordpress-org-config.json`:

```json
{
  "plugin": {
    "svnUrl": "https://plugins.svn.wordpress.org/YOUR_PLUGIN_SLUG",
    "autoSync": false,
    "preserveAssets": true,
    "readmeSource": "readme.txt",
    "textDomain": "your-plugin-slug"
  },
  "theme": {
    "svnUrl": "https://themes.svn.wordpress.org/YOUR_THEME_SLUG",
    "autoSync": false,
    "screenshotDimensions": "1200x900"
  }
}
```

## Output

After execution, this skill produces:

### GitHub Release

Published at: `https://github.com/lightspeedwp/project/releases/tag/vX.Y.Z`

Contains:
- Annotated git tag (vX.Y.Z)
- Compiled release notes
- Contributor credits
- Download assets (zip, checksums)
- Link to full changelog

### Local Assets

Generated in `release-assets/`:
- `plugin-name-vX.Y.Z.zip` — distributable package
- `plugin-name-vX.Y.Z.zip.sha256` — checksum verification
- `wordpress-org-sync/tags/X.Y.Z/` — SVN-ready directory

### Audit Log Entry

Added to `.github/RELEASE_AUDIT_LOG.json`:

```json
{
  "version": "X.Y.Z",
  "gitHubRelease": "https://github.com/.../releases/tag/vX.Y.Z",
  "tagSha": "commit-sha-that-was-tagged",
  "assetsCreated": ["zip", "sha256", "wordpress-org"],
  "contributorCount": 3,
  "publishedAt": "2026-10-30T16:54:00Z"
}
```

## Troubleshooting

### Tag already exists

```
❌ error: tag 'vX.Y.Z' already exists

Solution:
  1. Check if release was already published: git tag -l | grep vX.Y.Z
  2. Delete local tag: git tag -d vX.Y.Z
  3. Delete remote tag: git push origin --delete vX.Y.Z
  4. Retry: /release --scope=patch
```

### GitHub API rate limit

```
❌ Error: API rate limit exceeded

Solution:
  1. Wait 1 hour for rate limit reset
  2. Or authenticate with higher limits: gh auth login
  3. Retry: /release --scope=patch
```

### Assets too large for release

```
⚠️  Warning: Release asset exceeds 100MB limit

Solution:
  1. Move large assets to separate storage (CDN, S3)
  2. Include download link in release notes instead
  3. Or split into multiple releases per component
```

## Integration

This skill is called by the main `release` skill after:
- Version has been bumped
- Changelog has been updated
- Release branch has been created and pushed
- PR to main has been opened and merged

It runs automatically and can be called standalone:

```bash
/github-release --version=1.2.4 --project-type=plugin
```

## See Also

- [[release]] — main release orchestration skill
- [[release-qa]] — quality gates and validation
- [[release-handoff-generator]] — post-release documentation
