---
name: multi-package-release
title: Multi-Package Release Orchestrator
description: Coordinate synchronized releases of plugin + theme packages with version alignment, dependency validation, and unified release notes
tags: [wordpress, release, plugin, theme, coordination, orchestration]
category: release-management
difficulty: advanced
icon: 📦
---

# Multi-Package Release Orchestrator

## Overview

Orchestrate coordinated releases of WordPress packages that belong together—typically a **block plugin + companion theme**. This skill ensures version alignment, validates cross-package dependencies, sequences releases in the correct order, generates unified changelog entries, and handles partial failures gracefully.

Use this when you're shipping a new plugin version that requires a matching theme update, or when a theme feature depends on a plugin version.

---

## When to Use

✓ **Plugin + theme companion releases**: New block plugin v1.5.0 ships with matching theme v2.3.0  
✓ **Version-locked packages**: Multiple packages that must share the same major version  
✓ **Coordinated features**: Plugin exposes new blocks that theme needs to support  
✓ **Dependency management**: Theme requires plugin ≥1.2.0 to function correctly  
✓ **Unified release notes**: Single GitHub Release for all packages together  
✓ **Rollback scenarios**: One package fails; need to decide whether to release the other  

❌ **Independent releases**: Each package has its own independent release cycle  
❌ **Monorepo workspaces**: Use the regular `release` skill with workspace support  
❌ **Single-package releases**: Use the main `release` skill  

---

## What This Skill Does

### 1. Release Group Definition
Define which packages release together as a logical unit:

```json
{
  "releaseGroup": "blocks-and-theme",
  "packages": [
    {
      "name": "my-blocks-plugin",
      "type": "plugin",
      "path": "plugins/my-blocks",
      "versionStrategy": "locked",
      "releaseOrder": 1
    },
    {
      "name": "my-theme",
      "type": "theme",
      "path": "themes/my-theme",
      "versionStrategy": "locked",
      "releaseOrder": 2
    }
  ]
}
```

### 2. Version Coordination
Two strategies:

**Locked versioning**: All packages share identical version numbers (plugin 1.2.0 + theme 1.2.0)
- Simplest for users to understand: "version 1.2.0 of the block system"
- Requires unified changelog
- Single semantic version bump applies to all

**Independent versioning**: Each package has its own semantic version, but with constraints
- Plugin drives major version (1.x.x)
- Theme stays within compatible range (2.x.x with peer dependency)
- Allows plugin to patch without forcing theme patch

### 3. Cross-Package Dependency Validation

Validates dependencies before release:
```yaml
dependencies:
  - type: peer
    from: my-theme
    to: my-blocks-plugin
    constraint: ">=1.2.0"
    constraint_type: "semver"
  
  - type: feature
    from: my-blocks-plugin
    to: my-theme
    feature: "custom-block-styles"
    minVersion: "2.0.0"
```

Checks:
- Does theme require plugin version that's being released?
- Does plugin depend on WordPress version available when theme releases?
- Are feature flags compatible?
- Do block supports require theme capabilities?

### 4. Release Sequencing & Timing

Smart release ordering:
1. **Dependencies-first**: Plugin releases before theme (if theme depends on plugin)
2. **Cascading wait**: After plugin release succeeds, wait for GitHub Actions to complete
3. **Tag verification**: Confirm plugin tag is available before theme release
4. **Staggered timing**: Optional delay between releases to allow GitHub edge caching

```yaml
sequencing:
  - package: my-blocks-plugin
    releaseOrder: 1
    waitFor: ["npm-publish"]  # Wait for npm publish to complete
    postReleaseDelay: 2m      # 2-minute delay before next package
    
  - package: my-theme
    releaseOrder: 2
    dependsOn: ["my-blocks-plugin:tag"]  # Require tag to exist
    waitFor: ["github-release"]
```

### 5. Unified Changelog Generation

Combines changelog entries from all packages:

```markdown
## [1.2.0] - 2024-01-15 (Block System Release)

### Plugin Changes (my-blocks v1.2.0)
- ✨ Add new testimonial block
- 🐛 Fix alignment issues on mobile
- 📚 Update block documentation

### Theme Changes (my-theme v1.2.0)
- ✨ Add testimonial block styles
- 💅 Update block color palette
- 🎨 Add custom block patterns
```

Includes:
- Cross-references between packages
- Synchronized release date
- Grouped by package with clear headers
- Combined breaking changes section

### 6. Cross-Package Linking in Release Notes

GitHub Release body includes:

```markdown
## 📦 Multi-Package Release

**Plugin**: [my-blocks v1.2.0](https://github.com/org/my-blocks/releases/tag/v1.2.0)
**Theme**: [my-theme v1.2.0](https://github.com/org/my-theme/releases/tag/v1.2.0)

### Breaking Changes
- Both packages: Requires WordPress 6.4+

### Installation
1. Update plugin to v1.2.0
2. Update theme to v1.2.0
3. Regenerate block patterns (optional)

### Feature Compatibility
- New testimonial block available in plugin
- Theme includes built-in styles for testimonial block
- Recommended: Clear cached assets after update
```

### 7. Error Scenarios & Partial Failures

Handles when one package succeeds but another fails:

**Scenario: Plugin releases successfully, theme release fails**
- Option A: Create single GitHub Release linking to successful plugin release only
- Option B: Roll back everything (requires git reset, tag deletion)
- Option C: Hold multi-package Release until manual fix

**Scenario: Theme release succeeds, plugin release fails**
- Mark theme as "pending peer release"
- Hold GitHub Release creation
- Notify: "Plugin didn't release; theme is published but incompatible"

**Scenario: Dependency validation fails before any release**
- Stop entire orchestration
- Report: "Theme requires plugin ≥1.5.0 but only 1.4.0 in release"
- Prevent any package from releasing

### 8. Rollback Procedures

**Full rollback**: Neither package released
```bash
git tag -d v1.2.0-plugin v1.2.0-theme
git push origin :refs/tags/v1.2.0-plugin :refs/tags/v1.2.0-theme
npm unpublish my-blocks@1.2.0
# Theme hosted as artifact/release asset; delete manually
```

**Partial rollback**: Revert successful package to previous version
```bash
npm unpublish my-blocks@1.2.0
git tag -d v1.2.0-plugin
git push origin :refs/tags/v1.2.0-plugin
# Leave theme release in place with note: "Plugin rolled back; incompatible"
```

**Grace period strategy**: Hold all release announcements for 10 minutes before finalizing

---

## Configuration

### Configuration File: `.lightspeed/release-groups.json`

```json
{
  "groups": [
    {
      "id": "blocks-and-theme",
      "name": "Block Plugin + Theme Release",
      "description": "Coordinated release of block plugin and companion theme",
      "packages": [
        {
          "repo": "my-blocks-plugin",
          "path": ".",
          "type": "plugin",
          "versionFile": "my-blocks.php",
          "versionField": "Version"
        },
        {
          "repo": "my-theme",
          "path": ".",
          "type": "theme",
          "versionFile": "style.css",
          "versionField": "Theme URI"
        }
      ],
      "versionStrategy": "locked",
      "dependencies": [
        {
          "from": "my-theme",
          "to": "my-blocks-plugin",
          "constraint": "^1.2.0"
        }
      ],
      "releaseOrder": [
        "my-blocks-plugin",
        "my-theme"
      ],
      "sequencingDelayMs": 120000,
      "failureMode": "hold-release"
    }
  ]
}
```

### Environment Variables

```bash
# Credentials
GITHUB_TOKEN=ghp_xxxxx          # Required: GitHub API token
NPM_TOKEN=npm_xxxxx             # For plugin npm publishing
WP_PLUGIN_REPO_TOKEN=xxxxx      # For wp.org plugin SVN (if applicable)

# Behavior
RELEASE_DRY_RUN=true            # Validate without releasing
RELEASE_AUTO_ROLLBACK=false     # Require manual confirmation for rollback
RELEASE_GRACE_PERIOD_MS=600000  # 10 minutes before announcing
RELEASE_VALIDATE_DEPS=true      # Validate dependencies
```

---

## Usage Workflow

### Step 1: Prepare Release Group
```bash
lspeed release --group blocks-and-theme --prepare
```
Validates:
- Both repos are checked out
- Branches are clean
- No uncommitted changes
- Versions defined in config

### Step 2: Validate Dependencies
```bash
lspeed release --group blocks-and-theme --validate-deps
```
Output:
```
✓ Plugin v1.2.0 compatible with WordPress 6.4+
✓ Theme requires plugin >=1.2.0 ✓ v1.2.0 satisfies
✓ Plugin ships 12 new blocks
✓ Theme includes styles for all 12 blocks
```

### Step 3: Generate Unified Changelog
```bash
lspeed release --group blocks-and-theme --generate-changelog
```
Creates:
- `CHANGELOG.md` with combined entries
- Cross-references between packages
- Release notes draft for GitHub

### Step 4: Execute Coordinated Release
```bash
lspeed release --group blocks-and-theme --execute
```
Process:
1. Release plugin → create GitHub Release → wait for npm publish
2. Verify plugin tag exists → increment delay
3. Release theme → create GitHub Release
4. Create multi-package GitHub Release linking both

### Step 5: Handle Failures
```bash
lspeed release --group blocks-and-theme --status
```
Shows:
- Plugin release: ✓ Success (v1.2.0)
- Theme release: ✗ Failed (tag conflict)
- Recommendation: Rollback or retry theme?

---

## Integration Points

### Links to Other Skills

**[[release]]** (Parent skill)
- Delegates to multi-package-release when group defined
- Inherits version bumping, changelog validation
- Reports coordinated release completion

**[[changelog-management]]**
- Used for per-package changelog generation
- Multi-package skill combines outputs
- Validates changelog structure before release

**[[github-release]]**
- Creates individual package releases
- Multi-package skill orchestrates creation
- Links releases together in unified announcement

---

## Examples

### Example 1: Plugin + Theme Companion Release

**Scenario**: Block plugin v1.5.0 adds new "hero block". Theme v2.3.0 includes hero block styles.

**Configuration**:
```json
{
  "groups": [{
    "id": "hero-block-release",
    "packages": [
      {"repo": "my-blocks", "type": "plugin", "releaseOrder": 1},
      {"repo": "my-theme", "type": "theme", "releaseOrder": 2}
    ],
    "versionStrategy": "locked",
    "dependencies": [
      {"from": "my-theme", "to": "my-blocks", "constraint": "^1.5.0"}
    ]
  }]
}
```

**Process**:
1. Validate: Theme's package.json `peerDependencies` requires `@lspeed/blocks@^1.5.0` ✓
2. Release plugin v1.5.0 → npm publish → GitHub Release
3. Verify: npm tag available at `@lspeed/blocks@1.5.0` ✓
4. Wait: 2 minutes (npm edge caching)
5. Release theme v2.3.0 → GitHub Release
6. Create unified release: "Block Hero Feature v1.5.0" linking both

**Changelog Output**:
```
## [1.5.0] - 2024-01-20 (Block Hero Feature Release)

### Plugin: my-blocks v1.5.0
- ✨ Add hero block with background image support
- ✨ Hero block alignment controls

### Theme: my-theme v2.3.0
- ✨ Add hero block stylesheet
- 🎨 Hero block color palettes
```

### Example 2: Independent Versions with Locked Major Version

**Scenario**: Plugin v2.4.0 patch release. Theme v3.2.1 patch release. Both ship together, but theme remains at v3.x.

**Configuration**:
```json
{
  "versionStrategy": "independent",
  "majorVersionLock": "2",
  "dependencies": [
    {"from": "my-theme", "to": "my-blocks", "constraint": "^2.0.0"}
  ]
}
```

**Validation**:
- Plugin v2.4.0 ✓ (major=2)
- Theme v3.2.1 ✓ (requires plugin ^2.0.0; 2.4.0 satisfies)
- Release both: plugin first, theme follows

### Example 3: Handling Failure - Plugin Succeeds, Theme Fails

**Scenario**: Plugin v1.2.0 releases successfully. Theme v1.2.0 fails due to CI timeout.

**Configuration**:
```json
{
  "failureMode": "hold-release",
  "gracePeriodMs": 600000
}
```

**Behavior**:
1. Plugin release succeeds ✓
2. Theme release fails ✗ (CI timeout)
3. Multi-package Release creation held in draft
4. Notification: "Plugin released; theme pending. Retry theme release?"
5. Once theme succeeds, create unified release automatically
6. If theme fails 3x, ask: "Release plugin solo or full rollback?"

---

## Error Handling

### Common Errors

**"Plugin v1.2.0 already released; theme v1.2.0 requires unreleased plugin"**
- Cause: Plugin was released independently; theme expects coordinated release
- Fix: Bump theme to v1.2.1 with note, or re-orchestrate release

**"Theme requires plugin >=1.5.0 but release defines 1.4.0"**
- Cause: Dependency mismatch in config
- Fix: Update plugin version in release config or theme dependency constraint

**"Plugin published to npm but GitHub tag creation failed"**
- Cause: Network issue; npm succeeded, GitHub failed
- Fix: Retry GitHub tag creation; rollback npm if needed

---

## Advanced: Release Groups in Monorepos

For monorepo with multiple plugin + theme pairs:

```json
{
  "groups": [
    {
      "id": "hero-system",
      "packages": [
        {"path": "packages/hero-plugin", "type": "plugin"},
        {"path": "packages/hero-theme", "type": "theme"}
      ]
    },
    {
      "id": "cta-system",
      "packages": [
        {"path": "packages/cta-plugin", "type": "plugin"},
        {"path": "packages/cta-theme", "type": "theme"}
      ]
    }
  ]
}
```

Coordinate multiple groups independently or together.

---

## Best Practices

1. **Always validate dependencies first**: Never release with mismatched versions
2. **Use semantic versioning**: Lock versions only when systems must move together
3. **Test cross-package features before release**: Ensure plugin blocks render with theme
4. **Document dependency constraints**: Update README and package.json peerDependencies
5. **Grace period strategy**: Hold announcements 10 minutes to verify no immediate rollback needed
6. **Communicate in release notes**: Explain why packages are released together
7. **Monitor post-release**: Watch for user issues indicating version incompatibility
8. **Plan rollback before releasing**: Document the rollback procedure per group

---

## Troubleshooting Guide

### Issue: "Versions mismatch across packages"

**Symptom**: Configuration says locked versioning but packages have different versions.

**Cause**: Manual edits to version files without coordination.

**Resolution**:
```bash
# Option 1: Manually align versions
lspeed release --group blocks-and-theme --sync-versions 1.2.0

# Option 2: Check what needs fixing
lspeed release --group blocks-and-theme --validate --verbose
```

### Issue: "Release succeeded but GitHub Release creation failed"

**Symptom**: npm publish succeeded, GitHub tag created, but Release API call failed.

**Cause**: GitHub API rate limiting or authentication issue.

**Resolution**:
```bash
# Create GitHub Release manually
gh release create v1.2.0 --notes "Release notes here"

# Or retry with exponential backoff
lspeed release --group blocks-and-theme --retry-github-release --max-retries 5
```

### Issue: "Theme release failed; plugin already published"

**Symptom**: Plugin released successfully. Theme failed during git tag creation. Now plugin is live but theme isn't.

**Cause**: CI timeout, network failure, or conflicting tag.

**Resolution**:
```bash
# Check what's deployed
npm info my-blocks@1.2.0
gh release list --repo org/my-theme

# Option A: Retry theme release
lspeed release --group blocks-and-theme --retry my-theme

# Option B: Release plugin solo (mark incompatibility)
lspeed release --group blocks-and-theme --release-solo my-blocks --note "Theme v1.2.0 incompatible; waiting for update"

# Option C: Full rollback (both packages)
lspeed release --group blocks-and-theme --rollback-all
```

### Issue: "Dependency constraint failed - incompatible versions"

**Symptom**: Validation error: "Theme requires plugin ^1.2.0 but release defines 1.1.0"

**Cause**: Configuration or package file has mismatched versions.

**Resolution**:
1. Check theme's package.json or composer.json for actual constraint
2. Update plugin version in release group config
3. Or update theme's dependency constraint
4. Run validation again: `lspeed release --group blocks-and-theme --validate-deps`

---

## Advanced Scenarios

### Multi-Package Group with 3+ Packages

For systems with plugin, theme, and documentation site:

```json
{
  "groups": [{
    "id": "complete-system",
    "packages": [
      {"id": "blocks", "type": "plugin", "releaseOrder": 1},
      {"id": "theme", "type": "theme", "releaseOrder": 2},
      {"id": "docs", "type": "library", "releaseOrder": 3}
    ],
    "versionStrategy": "locked",
    "dependencies": [
      {"from": "theme", "to": "blocks", "constraint": "^1.2.0"},
      {"from": "docs", "to": "blocks", "constraint": "^1.2.0"},
      {"from": "docs", "to": "theme", "constraint": "^2.3.0"}
    ],
    "releaseOrder": ["blocks", "theme", "docs"],
    "sequencing": {
      "delayMs": 120000,
      "steps": [
        {
          "packageId": "blocks",
          "order": 1,
          "waitFor": ["npm-publish"],
          "postDelay": 120000
        },
        {
          "packageId": "theme",
          "order": 2,
          "dependsOn": ["blocks:tag"],
          "waitFor": ["github-release"],
          "postDelay": 60000
        },
        {
          "packageId": "docs",
          "order": 3,
          "dependsOn": ["blocks:tag", "theme:tag"],
          "waitFor": ["github-release"]
        }
      ]
    }
  }]
}
```

### Version-Locked Major Versions Only

Plugin drives major.minor, theme has independent patch:

```json
{
  "versionStrategy": "independent",
  "majorVersionLock": "1",
  "dependencies": [
    {
      "from": "theme",
      "to": "blocks",
      "constraint": "^1.0.0",
      "constraintType": "semver"
    }
  ]
}
```

Examples:
- Plugin 1.2.0 + Theme 1.0.5 ✓
- Plugin 1.2.0 + Theme 1.3.0 ✓
- Plugin 1.2.0 + Theme 2.0.0 ✗ (major mismatch)

### Post-Release Synchronization

After successful multi-package release, sync WordPress.org:

```bash
lspeed release --group blocks-and-theme --post-release-sync
```

This:
1. Waits for WordPress.org directory to index new versions
2. Verifies plugin appears in WordPress.org search
3. Updates documentation sites
4. Posts announcement to team Slack
5. Generates release metrics report

---

## Integration with Monorepos

For monorepos with multiple plugin/theme pairs:

```
monorepo/
├── packages/
│  ├── hero-plugin/
│  ├── hero-theme/
│  ├── cta-plugin/
│  └── cta-theme/
└── .lightspeed/
   └── release-groups.json
```

Configuration:
```json
{
  "groups": [
    {
      "id": "hero-system",
      "packages": [
        {"id": "hero-blocks", "path": "packages/hero-plugin"},
        {"id": "hero-theme", "path": "packages/hero-theme"}
      ]
    },
    {
      "id": "cta-system",
      "packages": [
        {"id": "cta-blocks", "path": "packages/cta-plugin"},
        {"id": "cta-theme", "path": "packages/cta-theme"}
      ]
    }
  ]
}
```

Release independently:
```bash
lspeed release --group hero-system        # Release hero pair
lspeed release --group cta-system         # Release CTA pair
lspeed release --all                      # Release all groups together
```

---

## Scripting & Automation

### NPM Package.json Integration

Make scripts available in your project:

```json
{
  "scripts": {
    "release:validate": "node scripts/validate-package-group.js --group blocks-and-theme",
    "release:check-deps": "node scripts/check-cross-dependencies.js --group blocks-and-theme --matrix",
    "release:execute": "lspeed release --group blocks-and-theme --execute"
  },
  "devDependencies": {
    "lspeed-cli": "^1.0.0"
  }
}
```

Usage:
```bash
npm run release:validate
npm run release:check-deps
npm run release:execute
```

### CI/CD Pipeline

Integrate into GitHub Actions:

```yaml
name: Multi-Package Release

on:
  workflow_dispatch:
    inputs:
      group:
        description: 'Release group ID'
        required: true

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Validate Group
        run: node scripts/validate-package-group.js --group ${{ github.event.inputs.group }}
      
      - name: Check Dependencies
        run: node scripts/check-cross-dependencies.js --group ${{ github.event.inputs.group }}
      
      - name: Execute Release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: lspeed release --group ${{ github.event.inputs.group }} --execute
```

---

## Performance Considerations

### Large Packages

For packages >500MB:

1. **Increase timeouts**: `RELEASE_TIMEOUT=600s`
2. **Parallel validation**: Validate packages in parallel before sequencing
3. **Stagger npm publishes**: Add 5+ minute delay between packages

### Many Dependencies

For systems with 10+ cross-package dependencies:

1. **Build dependency graph**: Use `--validate-deps --graph` to visualize
2. **Cache dependency checks**: Store validation results
3. **Implement circuit breaker**: Stop if >3 validation failures

---

## FAQ

**Q: Can I release just one package from a group?**
A: Yes, use `lspeed release --group blocks-and-theme --release-solo my-blocks`. Creates single GitHub Release, not multi-package.

**Q: What if dependencies have version ranges?**
A: Multi-package release validates that each package's version satisfies all constraints. Use semantic version constraints like `^1.2.0` or `~1.2`.

**Q: How do I test release orchestration locally?**
A: Use `RELEASE_DRY_RUN=true` to validate without publishing. Checks everything except npm/git push.

**Q: Can theme and plugin release in parallel?**
A: No, sequential by design. Theme may depend on plugin; parallel would race. Sequencing ensures plugin succeeds before theme starts.

**Q: What happens if WordPress.org API is down?**
A: Plugin still releases to npm/GitHub. WordPress.org sync retried automatically. Manual sync available via `--post-release-sync`.

---

## See Also

- [[release]] - Main release skill
- [[changelog-management]] - Unified changelog generation
- [[github-release]] - Creating GitHub Releases
- [[dependency-validation]] - Version constraint validation
- [[rollback-procedures]] - Recovery procedures
