---
name: release-notes-generator
description: Auto-generate professional release notes from changelog and commit history for multiple output formats
metadata:
  version: 1.0.0
  updated: 2026-10-30
  author: LightSpeedWP Release Team
  tags:
    - release-notes
    - changelog
    - github
    - communication
    - automation
    - wordpress
  tools:
    - Read
    - Write
    - Edit
    - Bash
    - Grep
    - Glob
  requires:
    - CHANGELOG.md in Keep a Changelog format
    - Git repository with commit history
    - GitHub repository (for links)
    - VERSION file or version in headers
  integrations:
    - "[[changelog-management]]" — Source changelog data
    - "[[github-release]]" — GitHub Release publication target
    - "[[release]]" — Main release orchestration
---

# Release Notes Auto-Generator Skill

Automatically generates professional, multi-format release notes from CHANGELOG.md entries and git commit history, with contributor attribution, issue linking, and WordPress-specific patterns for block plugins and themes.

## Purpose

This sub-skill accelerates release communication by:

- **Extracting** changelog entries and commit history since last release
- **Parsing** conventional commit messages (feat:, fix:, docs:, etc.)
- **Aggregating** issues closed by the release
- **Attributing** contributors and providing credit
- **Generating** multiple output formats (GitHub Release, email, Slack, blog)
- **Formatting** with contextual emojis, version links, and contributor mentions
- **Customizing** tone and detail level (brief, detailed, technical)

This saves significant time on release communication while ensuring consistency and professionalism across channels.

## When to Use

### Optimal Timing

- **After** release is tagged (git tag applied)
- **Before** GitHub Release is announced
- **Before** WordPress.org sync begins
- **For** every release cycle (major, minor, patch)

### Common Scenarios

- Publishing release notes to GitHub Release page
- Drafting email newsletter announcement
- Creating Slack channel announcement
- Writing blog post about release
- Generating release email for subscribers
- Creating WordPress.org readme changelog section

## What It Does

### 1. Changelog Parsing

The skill reads `CHANGELOG.md` and extracts:

- Version number and release date
- All entries from the [Unreleased] section (or specified version)
- Organized by section: Added, Changed, Deprecated, Removed, Fixed, Security
- WordPress-specific patterns (new blocks, themes, patterns)
- Cross-references to blocks, hooks, and features

**Example input (CHANGELOG.md):**
```markdown
## [2.0.0] - 2026-10-30

### Added
- New Image Gallery block with lightbox support
- New gallery layout: Masonry Grid
- New `my_plugin_gallery_lightbox_enabled` filter
- New theme option for gallery gutter spacing

### Changed
- Updated Image Gallery block to use modern block API (v3)
- Improved gallery image loading performance by 40%
- Enhanced gallery inspector with live preview

### Fixed
- Fixed gallery layout breaking on mobile devices
- Resolved lightbox overlay z-index issues
- Fixed image alt-text not syncing to block attributes

### Security
- Added nonce verification to gallery AJAX endpoints
```

### 2. Commit Message Parsing

Extracts and categorizes commits using [Conventional Commits](https://www.conventionalcommits.org/) format:

**Supported Types:**
- `feat:` — New features (maps to "Added")
- `fix:` — Bug fixes (maps to "Fixed")
- `perf:` — Performance improvements (maps to "Changed")
- `docs:` — Documentation updates
- `refactor:` — Code refactoring (maps to "Changed")
- `style:` — Code style changes
- `test:` — Test additions/updates
- `chore:` — Build, CI, dependency updates
- `BREAKING CHANGE:` — Maps to major version change

**Scope Recognition:**
- `feat(hero-block):` — Identifies block name
- `fix(theme-colors):` — Identifies theme feature
- `perf(editor):` — Identifies component
- Converts to readable format in release notes

**Example:**
```
feat(gallery-block): add lightbox support for image gallery
fix(gallery): resolve z-index conflict in lightbox overlay
perf(gallery-block): optimize image rendering performance
```

### 3. Issue Linking & Attribution

Automatically extracts and links:

- **Issue references:** Detects `#123` in commit messages
- **PR references:** Recognizes PR numbers from merge commits
- **GitHub URLs:** Converts issue IDs to full GitHub links
- **Closing keywords:** Recognizes "Closes #123", "Fixes #456"
- **Contributor mentions:** Extracts author from commit metadata

**Example commits:**
```
fix: resolve gallery lightbox on mobile (fixes #456)
feat: add image gallery block (#123)
perf: optimize block rendering (#456, #789)
```

### 4. Contributor Attribution

Identifies all contributors to the release:

- **Commit authors** — From git commit history
- **PR reviewers** — From GitHub API (when available)
- **Mentioned contributors** — From issue comments
- **Format options:**
  - Simple: "Thanks to @alice, @bob, and @charlie"
  - Detailed: "Thanks to contributors: @alice (3 commits), @bob (2 commits)"
  - With roles: "Built by Alice (Dev), Reviewed by Bob (QA)"

### 5. Multi-Format Output Generation

Generates professionally formatted release notes for different channels:

#### A. GitHub Release Format

**Features:**
- Structured markdown with emoji indicators
- Issue link references with #IDs
- Contributor mentions with @handles
- Version comparison links
- Direct copy-paste ready

**Example:**

```markdown
## 2.0.0 - October 30, 2026

### Added
- 🎨 **Image Gallery Block** — New Gutenberg block with lightbox and multiple layouts
  - Masonry Grid layout option
  - Lightbox support with customizable overlay
  - [View block documentation →](https://docs.example.com/gallery)
- ✨ New gallery layout options (#123)
- 🪝 New `my_plugin_gallery_lightbox_enabled` filter for customization

### Changed
- 📊 **Performance** — 40% improvement in gallery image loading (#456)
- Updated Image Gallery block to modern block API v3
- Enhanced inspector with live preview

### Fixed
- 🐛 Fixed gallery layout breaking on mobile (#789)
- Resolved lightbox overlay z-index conflicts (#234)
- Fixed image alt-text not syncing to attributes

### Security
- 🔒 Added nonce verification to gallery AJAX endpoints (#567)

---

**Contributors:** Thanks to @alice, @bob, and @charlie for this release!

**Full Changelog:** [v1.9.1...v2.0.0](https://github.com/lightspeedwp/my-plugin/compare/v1.9.1...v2.0.0)
```

#### B. Email Newsletter Format

**Features:**
- Friendly greeting
- Clear subject line
- Concise feature summary
- Call-to-action buttons
- Unsubscribe link
- Professional footer

**Example:**

```
Subject: WordPress Plugin v2.0.0 Released — Gallery Block & Performance Improvements

Hi there,

We're excited to announce v2.0.0 of [Plugin Name], featuring a brand-new Image Gallery block and significant performance improvements!

## What's New

✨ **Image Gallery Block** — Full Gutenberg block with lightbox support, multiple layouts, and extensive customization options.

📊 **40% Faster Performance** — Gallery rendering is now dramatically faster, improving editor and front-end loading times.

🔧 **Enhanced Customization** — New theme options, filters, and hooks for developers to extend gallery functionality.

🔒 **Security Updates** — Added nonce verification and improved input sanitization.

[Read Full Release Notes →](https://github.com/example/releases/tag/v2.0.0)
[Update Now →](https://wordpress.org/plugins/example/)

---

As always, thank you to our amazing community of contributors who made this release possible!

Best regards,
The LightSpeedWP Team
```

#### C. Slack Channel Announcement

**Features:**
- Emoji-prefixed sections
- Emoji reactions
- Thread-friendly format
- Code block formatting
- Call-to-action with link
- Emoji reactions for engagement

**Example:**

```
:rocket: **v2.0.0 Released!** 

A major release with new Image Gallery block, performance improvements, and security updates.

:sparkles: **New**
• Image Gallery block with lightbox (finally!)
• Masonry Grid layout
• 40+ new customization options

:zap: **Improved**
• 40% faster gallery rendering
• Modern block API v3
• Better mobile support

:bug: **Fixed**
• Mobile layout issues
• Z-index conflicts
• Alt-text syncing

:lock: **Security**
• Nonce verification added
• Input sanitization improved

Check it out: <https://github.com/lightspeedwp/my-plugin/releases/tag/v2.0.0>
```

#### D. Blog Post Format

**Features:**
- Engaging headline
- Introduction paragraph
- Detailed sections with context
- Visual breaks and structure
- Author byline
- Related links section
- SEO-friendly formatting

**Example:**

```markdown
# Introducing Image Gallery Block v2.0.0 — Featuring Lightbox Support

**October 30, 2026** | By Alice Smith | 5 min read

We're thrilled to announce v2.0.0, our biggest release of the year! This major version introduces the long-awaited Image Gallery block, redesigned from the ground up to be faster, more flexible, and easier to use.

## What's New in v2.0.0

### The Image Gallery Block is Here

After months of development and community feedback, we're proud to release the new Image Gallery block. Built on Gutenberg's modern APIs, this block offers:

- **Lightbox Support** — Beautiful image viewing experience
- **Multiple Layouts** — Grid, Masonry, Carousel, Slider
- **Advanced Customization** — Colors, spacing, hover effects
- **Performance** — Optimized for fast loading

### 40% Performance Improvement

We've made dramatic performance improvements across the board. Gallery rendering is now 40% faster in both the editor and on the front-end.

### Enhanced Customization

New theme options, WordPress filters, and hooks give developers complete control over gallery functionality.

## Upgrade Now

Ready to upgrade? Visit our [GitHub releases page](https://github.com/lightspeedwp/my-plugin/releases/tag/v2.0.0) or install from [WordPress.org](https://wordpress.org/plugins/example/).

[Read Full Release Notes →](https://github.com/lightspeedwp/my-plugin/releases/tag/v2.0.0)

---

Built with love by our community. [Thanks to our contributors!](https://github.com/lightspeedwp/my-plugin/graphs/contributors)
```

### 6. Customization & Template System

The skill includes templates that can be customized:

- **Emoji sets** — Choose emoji style (nature, tech, minimal)
- **Verbosity** — Brief (bullet points), Detailed (paragraphs), Technical (code examples)
- **Format preferences** — Markdown, HTML, plain text
- **Link style** — Full URLs, shortlinks, markdown links
- **Contributor credits** — Names, avatars, commit counts, roles
- **Section highlighting** — Which sections are most important
- **WordPress patterns** — Block names, hooks, filters, template parts

## WordPress-Specific Patterns

The skill recognizes and formats WordPress-specific content:

### Block Patterns

**Input:**
```
feat(hero-block): add layout variations
feat(card-block): new badge and icon support
```

**Output:**
```
- New Hero Block layout variations
- Card Block now supports badges and icons
```

### Hook & Filter Patterns

**Input:**
```
feat: add my_plugin_gallery_lightbox filter
```

**Output:**
```
- New `my_plugin_gallery_lightbox` filter for customization
```

### Theme Features

**Input:**
```
feat(theme): add block style variations for hero
```

**Output:**
```
- New block style variations for Hero section
```

### Version Compatibility

**Input:**
```
Changed: Updated minimum WordPress to 5.9
Changed: Updated minimum PHP to 7.4
```

**Output:**
```
- Updated minimum WordPress version to 5.9
- Requires PHP 7.4 or higher
```

## Before/After Examples

### Plugin Example: Testimonial Gallery v1.3.0

**Input (CHANGELOG.md):**
```markdown
## [1.3.0] - 2026-10-30

### Added
- New Testimonial Gallery block
- Gallery layout: Carousel with autoplay
- New filter: `testimonial_gallery_autoplay_interval`

### Fixed
- Fixed gallery overflow on mobile
- Resolved color scheme conflicts
```

**Output (GitHub Release):**
```markdown
## 1.3.0 - Testimonial Gallery Block

### Added
- 🎨 **Testimonial Gallery Block** — Display customer testimonials in a beautiful, responsive gallery
- 🎠 **Carousel Layout** — New layout with autoplay support
- 🪝 New `testimonial_gallery_autoplay_interval` filter

### Fixed
- 🐛 Fixed gallery overflow on mobile devices
- Resolved color scheme conflicts

**Full Changelog:** [v1.2.1...v1.3.0](https://github.com/example/compare/v1.2.1...v1.3.0)
```

### Theme Example: Block Theme Hero v2.0.0

**Input (CHANGELOG.md):**
```markdown
## [2.0.0] - 2026-10-30

### Added
- New Hero section template part
- Block style variations for Hero
- New theme.json settings for hero customization

### Changed
- Updated Hero block to use modern block APIs
- Improved responsive behavior on mobile

### Security
- Added sanitization to hero background images
```

**Output (Email Newsletter):**
```
Subject: Block Theme Hero v2.0.0 — Redesigned Hero Section

Hi there,

We're excited to announce v2.0.0 of Block Theme Hero, featuring a completely redesigned hero section with modern block APIs and enhanced customization.

## What's New

✨ **New Hero Template Part** — Pre-built hero section ready to customize
🎨 **Block Style Variations** — Multiple pre-designed hero styles
⚙️ **Enhanced Theme Settings** — Full control over hero appearance
🔒 **Security Improvements** — Better image sanitization

[Get v2.0.0](https://github.com/example/releases/tag/v2.0.0)
```

## Usage Workflow

### Step 1: Prepare Release

Ensure your repository is ready:

```bash
# Verify changelog is updated
# Ensure VERSION file matches release version
# Commit and tag release
git tag -a v2.0.0 -m "Release v2.0.0"
git push origin v2.0.0
```

### Step 2: Generate Release Notes

Run the skill to generate notes for multiple formats:

```bash
# Generate all formats
/release-notes-generator --version=2.0.0 --all-formats

# Generate specific format
/release-notes-generator --version=2.0.0 --format=github
/release-notes-generator --version=2.0.0 --format=email
/release-notes-generator --version=2.0.0 --format=slack
/release-notes-generator --version=2.0.0 --format=blog
```

### Step 3: Customize Output

Review and customize generated notes:

- Edit emoji selections
- Adjust tone and verbosity
- Add context or examples
- Highlight important sections
- Verify links and references

### Step 4: Publish

Distribute release notes to appropriate channels:

- **GitHub:** Publish to GitHub Release page
- **Email:** Send via newsletter service
- **Slack:** Post to announcement channel
- **Blog:** Publish as blog post
- **WordPress.org:** Include in readme changelog

## Customization Guidelines

### Template Customization

The skill uses template files that can be customized:

**Available templates:**
- `templates/github-release.hbs` — GitHub Release format
- `templates/email-newsletter.hbs` — Email format
- `templates/slack-announcement.hbs` — Slack format
- `templates/blog-post.hbs` — Blog post format

### Emoji Customization

Choose your preferred emoji set:

```json
{
  "emoji_set": "standard",
  "emojis": {
    "added": "✨",
    "changed": "📊",
    "fixed": "🐛",
    "security": "🔒",
    "deprecated": "⚠️",
    "removed": "🗑️"
  }
}
```

### Link Customization

Configure link generation style:

```json
{
  "links": {
    "style": "markdown",
    "format": "full_url",
    "github_base": "https://github.com/lightspeedwp/my-plugin"
  }
}
```

### Contributor Attribution

Customize how contributors are mentioned:

```json
{
  "contributors": {
    "format": "mentions",
    "include_counts": true,
    "include_avatars": true,
    "max_mentions": 10,
    "thank_you_message": "Thanks to our amazing contributors!"
  }
}
```

## Integration Points

### With changelog-management

- Reads output from [[changelog-management]]
- Uses validated CHANGELOG.md format
- Extracts version and release information

### With github-release

- Generates markdown for [[github-release]] publication
- Formats for direct copy-paste to GitHub Release page
- Includes comparison links and contributor mentions

### With release

- Called as part of main [[release]] workflow
- Outputs notes for multiple channels
- Supports release automation

## Related Skills & Documentation

- **[[changelog-management]]** — Manage and validate changelog entries
- **[[github-release]]** — Publish releases to GitHub
- **[[release]]** — Main release orchestration
- **Keep a Changelog** — https://keepachangelog.com/
- **Conventional Commits** — https://www.conventionalcommits.org/

## Key Files & Locations

- **Main skill:** `./SKILL.md`
- **Test cases:** `./evals/`
- **Format templates:** `./references/release-notes-formats.md`
- **Patterns reference:** `./references/wordpress-block-patterns.md`
- **Attribution guide:** `./references/contributor-credit-patterns.md`
- **Scripts:** `./scripts/`
  - `parse-changelog.js` — Extract changelog entries
  - `format-release-notes.js` — Format for outputs
  - `extract-contributors.js` — Identify contributors

## Common Use Cases

### Quick Release Notes

For patch releases with few changes:

```bash
/release-notes-generator --version=1.2.5 --format=github --brief
```

### Full Release Communication

For major/minor releases with comprehensive notes:

```bash
/release-notes-generator --version=2.0.0 --all-formats --detailed
```

### Blog Post Creation

For writing a release blog post:

```bash
/release-notes-generator --version=2.0.0 --format=blog --detailed --with-context
```

### Community Announcement

For social media and newsletter:

```bash
/release-notes-generator --version=1.5.0 --format=slack --format=email --brief
```

## Troubleshooting

**Issue:** No changelog entries detected
- **Solution:** Ensure CHANGELOG.md exists and follows Keep a Changelog format
- **Check:** File is at repository root and has proper [Unreleased] section

**Issue:** Commit messages not being parsed
- **Solution:** Use Conventional Commits format (feat:, fix:, etc.)
- **Check:** Commit messages follow spec at conventionalcommits.org

**Issue:** Contributors not attributed correctly
- **Solution:** Verify GitHub authentication for PR/reviewer data
- **Check:** GitHub CLI is installed and authenticated (`gh auth status`)

**Issue:** Links are broken or incorrect
- **Solution:** Verify GitHub repository URL is correct
- **Check:** Settings.json has correct `github_base_url` configured

## Best Practices

1. **Keep Changelog Updated** — Update CHANGELOG.md during development
2. **Use Conventional Commits** — Follow commit message conventions
3. **Review Generated Notes** — Always review before publishing
4. **Customize Appropriately** — Adjust tone for your audience
5. **Include Context** — Add explanations for complex features
6. **Test Links** — Verify all links before publishing
7. **Mention Contributors** — Give credit to your community
8. **Version Consistently** — Use SemVer for all versions

## Source Pack Notes

The `lightspeed-release-ops` plugin pack (`lightspeedwp/.github`, `plugins/lightspeed-release-ops`, commit
`47aee07`, GPL-3.0) has a stub skill that overlaps with this one. The stub is a heading and one sentence. Its
description is recorded here so nothing is lost:

- `lightspeed-release-notes-generator`: "generate structured release notes from validated changelog and repository
  signals." This skill already covers it in full: it generates release notes from the changelog and the commit
  history in several output formats.

See [the review](../../docs/RELEASE_OPS_SKILLS_REVIEW.md) for the full comparison.

## Version History

- **1.0.0** (2026-10-30) — Initial release
  - Multi-format output generation
  - Changelog parsing
  - Commit history extraction
  - Contributor attribution
  - WordPress-specific patterns
  - Customizable templates
