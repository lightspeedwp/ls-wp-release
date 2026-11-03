# Multi-Package Release Orchestrator

Sub-skill of the LightSpeedWP release skill for orchestrating coordinated plugin + theme releases.

## Directory Structure

```
multi-package-release/
├── SKILL.md                          # Main skill documentation (805 lines)
├── README.md                         # This file
├── scripts/
│   ├── validate-package-group.js    # Validate release group configuration
│   └── check-cross-dependencies.js  # Analyze cross-package dependencies
├── references/
│   ├── multi-package-config.md      # Configuration format reference
│   └── dependency-validation.md     # Dependency validation guide
└── evals/
    ├── release-plugin-and-theme-together.md
    ├── validate-multi-package-dependencies.md
    └── handle-multi-package-failure.md
```

## Quick Start

### 1. Configure Release Group

Create `.lightspeed/release-groups.json`:

```json
{
  "version": "1.0.0",
  "groups": [
    {
      "id": "blocks-and-theme",
      "name": "Block Plugin + Theme Release",
      "packages": [
        {
          "id": "my-blocks",
          "repo": "my-blocks-plugin",
          "type": "plugin",
          "versionFile": "my-blocks.php",
          "versionField": "Version"
        },
        {
          "id": "my-theme",
          "repo": "my-theme",
          "type": "theme",
          "versionFile": "style.css",
          "versionField": "Version"
        }
      ],
      "versionStrategy": "locked",
      "releaseOrder": ["my-blocks", "my-theme"],
      "dependencies": [
        {
          "from": "my-theme",
          "to": "my-blocks",
          "constraint": "^1.2.0",
          "constraintType": "semver"
        }
      ]
    }
  ]
}
```

### 2. Validate Configuration

```bash
node scripts/validate-package-group.js --group blocks-and-theme
```

### 3. Check Dependencies

```bash
node scripts/check-cross-dependencies.js --group blocks-and-theme --matrix
```

### 4. Execute Release

> **Note:** the `lspeed` command used in the examples below is not included in this
> repository. Treat those commands as illustrative of the intended workflow, not as
> something you can run today. The scripts in `scripts/` (`validate-package-group.js`,
> `check-cross-dependencies.js`) are the parts that exist.

```bash
lspeed release --group blocks-and-theme --execute
```

## Scripts

### validate-package-group.js

Validates multi-package release group configuration and readiness.

**Usage**:
```bash
node scripts/validate-package-group.js \
  --group blocks-and-theme \
  --config .lightspeed/release-groups.json \
  [--strict] \
  [--check-breaking]
```

**Checks**:
- Configuration structure validity
- Package definitions completeness
- Version file existence and format
- Repository state (clean, no uncommitted changes)
- Dependency configuration validity
- Breaking change detection in changelogs

**Exit Codes**:
- `0` = All validations passed
- `1` = Errors detected

### check-cross-dependencies.js

Deep analysis of cross-package dependencies.

**Usage**:
```bash
node scripts/check-cross-dependencies.js \
  --group blocks-and-theme \
  [--config .lightspeed/release-groups.json] \
  [--matrix]
```

**Analyzes**:
- Peer dependencies from package.json and composer.json
- Feature support declarations
- WordPress and PHP capability requirements
- Dependency constraint satisfaction
- Breaking changes in changelogs
- Compatibility matrix

**Output**:
- Package metadata summary
- Dependency resolution
- Issue report (errors, warnings, info)
- Optional compatibility matrix table

**Exit Codes**:
- `0` = All dependencies validated
- `1` = Dependency errors found

## References

### multi-package-config.md

Complete reference for `.lightspeed/release-groups.json` configuration format.

**Covers**:
- Root configuration structure
- Release group object definition
- Package object fields
- Dependency object types
- Sequencing configuration
- Failure modes
- GitHub configuration options
- Notification settings
- Complete working example
- Validation rules

### dependency-validation.md

Comprehensive guide to defining and validating cross-package dependencies.

**Covers**:
- Peer dependency type
- Feature dependency type
- Capability dependency type
- Semantic versioning constraints
- Minimum version constraints
- Pre-release validation workflow
- Breaking change detection
- Common errors and fixes
- CI/CD integration
- Advanced feature negotiation matrix
- Best practices

## Test Cases

Test cases are located in `evals/` directory. Each covers a specific scenario.

### release-plugin-and-theme-together.md

**Scenario**: Coordinated synchronized release of WordPress block plugin and companion theme with locked versioning.

**Setup**:
- Plugin: my-blocks v1.1.0 → v1.2.0
- Theme: my-theme v1.1.0 → v1.2.0
- Version strategy: locked
- Release order: plugin first, then theme

**Validation**:
- Both versions align
- Dependencies satisfy
- Changelog entries present
- Sequence succeeds

### validate-multi-package-dependencies.md

**Scenario**: Validate cross-package dependencies before release.

**Setup**:
- Plugin provides blocks
- Theme declares support for those blocks
- Multiple feature types
- Complex version constraints

**Validation**:
- Dependency graph validation
- Feature support matrix
- Constraint satisfaction
- Breaking change detection
- Error reporting

### handle-multi-package-failure.md

**Scenario**: Handle partial failure when one package releases successfully but another fails.

**Setup**:
- Plugin releases successfully to npm and GitHub
- Theme release fails during git tag creation
- Network issue causes race condition

**Validation**:
- Error detection
- Partial state analysis
- Rollback options
- Recovery procedures
- User notification

## Integration

This skill integrates with:

- **[[release]]** - Main release skill delegates to multi-package-release when group defined
- **[[changelog-management]]** - Used for per-package changelog generation and validation
- **[[github-release]]** - Creates individual and coordinated GitHub Releases
- **[[wordpress-org-auto-sync]]** - Post-release synchronization to WordPress.org

## Environment Variables

```bash
# Validation
RELEASE_VALIDATE_STRICT=true         # Fail on warnings (not just errors)
RELEASE_VALIDATE_DEPS=true           # Enable dependency validation
RELEASE_CHECK_BREAKING=true          # Detect breaking changes

# Behavior
RELEASE_DRY_RUN=true                 # Validate without releasing
RELEASE_AUTO_ROLLBACK=false          # Require manual confirmation for rollback
RELEASE_GRACE_PERIOD_MS=600000       # 10 minutes before announcing release
```

## Architecture Diagram

```
Release Group Configuration
      ↓
┌─────────────────────────────────┐
│ Validate Package Group           │
│ - Config structure               │
│ - Version files                  │
│ - Repository state               │
│ - Breaking changes               │
└──────────┬──────────────────────┘
           ↓
┌─────────────────────────────────┐
│ Check Cross Dependencies         │
│ - Peer dependencies              │
│ - Feature support                │
│ - Capability requirements        │
│ - Constraint satisfaction        │
└──────────┬──────────────────────┘
           ↓
┌─────────────────────────────────┐
│ Orchestrate Release              │
│ - Sequence packages by order     │
│ - Release first package          │
│ - Wait for publish success       │
│ - Release subsequent packages    │
│ - Create unified GitHub Release  │
└──────────┬──────────────────────┘
           ↓
┌─────────────────────────────────┐
│ Handle Success/Failure           │
│ - Grace period strategy          │
│ - Rollback if needed             │
│ - Announce release               │
│ - Post-sync to WordPress.org     │
└─────────────────────────────────┘
```

## Best Practices

1. **Always validate before release**: Run validation scripts in CI/CD
2. **Use semantic versioning**: Consistent version numbering across packages
3. **Document dependencies**: Keep peerDependencies and constraints up to date
4. **Test cross-package integration**: Verify blocks render with theme styles
5. **Version lock if coupled**: Use "locked" strategy when packages are tightly coupled
6. **Clear changelog entries**: Mark breaking changes and cross-package impacts
7. **Grace period strategy**: Hold announcements to allow verification
8. **Monitor post-release**: Track user reports of version incompatibility

## Troubleshooting

### Validation fails with "uncommitted changes"

```bash
# Commit or stash changes
git status
git add .
git commit -m "Pre-release changes"
```

### "Theme requires plugin ^1.2.0 but release defines 1.1.0"

```bash
# Update plugin version in release config or theme's peerDependencies
# Then re-validate
node scripts/validate-package-group.js --group blocks-and-theme
```

### Scripts need semver module

```bash
npm install semver
# Or use system-wide: npm install -g semver
```

## Support

For issues or questions:
- Review SKILL.md for detailed documentation
- Check references/ for configuration and validation guides
- See evals/ for test case examples
- Consult parent [[release]] skill

## Version

- Skill Version: 1.0.0
- Last Updated: 2026-10-30
- Author: LightSpeedWP Release Team
