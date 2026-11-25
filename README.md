---
name: LightSpeedWP Release Skill
description: Comprehensive release management for WordPress block plugins and themes
version: 1.0.0
updated: 2026-10-30
---

# LightSpeedWP Release Skill

Automated release orchestration for WordPress block plugins and block themes, with semantic versioning, changelog enforcement, GitHub publishing, and WordPress.org directory preparation.

## Quick Start

### For a Patch Release (Bug Fix)

```bash
cd your-plugin-or-theme-repo
/release --dry-run          # Check everything
/release --scope=patch      # Execute patch release
```

### For a Minor Release (New Feature)

```bash
/release --dry-run --scope=minor
/release --scope=minor
```

### For a Major Release (Breaking Changes)

```bash
/release --dry-run --scope=major
/release --scope=major      # Requires manual approval
```

## What This Skill Does

### Pre-Release Phase

1. ✅ Validates tests pass and code lints
2. ✅ Checks version alignment (VERSION file is source of truth)
3. ✅ Audits changelog for completeness and format
4. ✅ Confirms WordPress compliance (headers, readme.txt, etc)
5. ✅ Reviews documentation quality
6. ✅ Assesses repository health and git state
7. ✅ Produces pre-release checklist and risk score

### Release Phase

1. 🔧 Determines next version using SemVer
2. 📝 Updates VERSION, plugin headers, theme metadata, readme.txt
3. 📋 Manages changelog (moves Unreleased to dated version)
4. 🏷️ Creates annotated git tag (vX.Y.Z)
5. 🚀 Publishes GitHub Release with notes and assets
6. 📦 Prepares WordPress.org SVN sync package
7. 👥 Compiles contributor credits from PR history

### Post-Release Phase

1. 📊 Generates release audit log
2. 📄 Creates handoff documentation for next maintainer
3. 📋 Plans next development cycle
4. 🔄 Verifies branch sync (main/develop)
5. ✨ Suggests follow-up issues and tasks

## File Structure

```
release/
├── README.md                          # This file
├── SKILL.md                           # Main skill definition
├── agents/
│   └── release-agent.md               # Agent instructions
├── sub-skills/                        # 12 bundled sub-skills (core three shown)
│   ├── github-release/
│   │   └── SKILL.md                   # GitHub tag and release publishing
│   ├── release-qa/
│   │   └── SKILL.md                   # Quality gates and validation
│   ├── release-handoff-generator/
│   │   └── SKILL.md                   # Post-release documentation
│   └── ...                            # see sub-skills/README.md
├── prompts/
│   ├── release.prompt.md              # Release orchestration prompt
│   └── changelog.prompt.md            # Changelog entry guidelines
└── docs/                              # [To be added from .github]
```

## Usage Patterns

### Standard Release Workflow

```bash
# 1. On develop branch, add changelog entries as you work
# Edit CHANGELOG.md:
# ## [Unreleased]
# ### Added
# - New feature X
# ### Fixed
# - Bug fix Y

# 2. When ready to release, run dry-run first
/release --dry-run
# Review the checklist, risk assessment, and proposed changes

# 3. Execute the release
/release --scope=patch
# Agent asks for confirmation at each step

# 4. After merge, review GitHub Release
# https://github.com/lightspeedwp/your-project/releases/tag/vX.Y.Z

# 5. Monitor for issues (first 24 hours critical)
```

### Version-Specific Workflows

**Patch Release (Bug fix):**
```bash
/release --scope=patch
# Fast, auto-approves if risk score ≤ 0.3
```

**Minor Release (New feature):**
```bash
/release --scope=minor
# Requires manual review of new features
# Risk score guides approval
```

**Major Release (Breaking changes):**
```bash
/release --scope=major
# Always requires manual review
# Must include migration guide
# Creates detailed breaking changes callout
```

### Rollback (If Critical Issues)

```bash
# Delete tag and release
git tag -d vX.Y.Z
git push origin --delete vX.Y.Z
gh release delete vX.Y.Z

# Revert main
git revert <COMMIT_SHA>
git push origin main

# Issue emergency patch when ready
/release --scope=patch --notes="Emergency rollback and fix"
```

## Pre-Release Checklist

Before running `/release`, ensure:

- [ ] On `develop` branch
- [ ] Working tree is clean (`git status`)
- [ ] Tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Changelog has [Unreleased] entries
- [ ] VERSION file is correct
- [ ] Plugin/theme headers are up to date
- [ ] Documentation is current
- [ ] README has setup instructions
- [ ] Contributing guidelines exist (if open source)

## Configuration

### Project Detection

The skill automatically detects your project type:

**Plugin:** Looks for `Plugin Name:` in root PHP file  
**Theme:** Looks for `Theme Name:` in `style.css`

### Version File

Create/update `VERSION` file in repository root:

```
1.2.3
```

This is the source of truth for all versioning.

### Changelog Format

Maintain `CHANGELOG.md` in Keep a Changelog format:

```markdown
## [Unreleased]
### Added
- New feature

### Fixed
- Bug fix

## [1.2.3] - 2026-10-29
### Added
- Previous feature
```

## Quality Gates

The skill enforces these gates before release:

| Gate | Requirement | Fix |
|------|-------------|-----|
| Tests | All pass | `npm test` or `composer test` |
| Lint | 0 errors | `npm run lint` or `composer run phpcs` |
| Versions | All match VERSION file | Update headers |
| Changelog | Valid format, has Unreleased | Fix markdown, add entries |
| WordPress | Headers present, readme.txt valid | Add missing fields |
| Documentation | README, LICENSE, Contributing | Create/update files |
| Repository | Clean tree, branches in sync | Commit, pull/push |

## WordPress Compliance

### Plugin Requirements

✅ `Plugin Name:` header with user-facing name  
✅ Version matches VERSION file  
✅ `readme.txt` with `Stable tag:` matching version  
✅ License: GPL v2 or compatible  
✅ Text Domain for translations  
✅ Minimum WordPress and PHP versions declared  
✅ Tested up to: current WordPress version  

### Theme Requirements

✅ `style.css` header with `Theme Name:`  
✅ `theme.json` for block themes (if applicable)  
✅ Version matches VERSION file  
✅ Screenshot.png (1200×900px)  
✅ `readme.txt` or `CHANGELOG.md`  
✅ License: GPL v2 or compatible  
✅ Minimum WordPress and PHP versions  

## Post-Release

After release is published, the skill generates:

1. **Release Audit Log** (`.github/RELEASE_AUDIT_LOG.json`)
   - Timestamp, version, scope, duration
   - Contributors, test metrics, risk score
   - WordPress.org compliance status

2. **Handoff Document** (`docs/HANDOFF_vX.Y.Z.md`)
   - Release summary and timeline
   - Quality metrics and contributor credits
   - What to monitor after release
   - Rollback plan if needed
   - Next cycle recommendations

3. **Next Cycle Plan** (`.github/NEXT_CYCLE_PLAN.md`)
   - Recommended priorities from open issues
   - Milestone planning
   - Team assignments

4. **Follow-Up Issues** (`.github/RELEASE_FOLLOWUP_ISSUES.json`)
   - Suggested work for next cycle
   - Documentation updates needed
   - Testing recommendations

## Troubleshooting

### Tests Failing

Run the test command of the plugin or theme being released, and fix the failures it reports:

```bash
npm test                    # Or the project's own test command (composer test, etc.)
```

Extra flags (watch mode, snapshots, coverage) depend on that project's test runner.
In this skill repository, `npm test` runs only the validator fixture tests.

### Version Mismatch

The skill will report which files don't match VERSION.

Fix by editing each file and updating the version to match.

### Changelog Invalid

```bash
# Common issues:
# - "## [unreleased]" should be "## [Unreleased]" (case-sensitive)
# - Section name "## Bugs" should be "### Fixed"
# - Missing entries under sections
```

### WordPress.org Compliance

The skill will list missing or invalid headers.

Review [WordPress Plugin Guidelines](https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/) or [Theme Guidelines](https://developer.wordpress.org/themes/releasing-your-theme/)

### Git Issues

```bash
git status                  # Check working tree status
git log --oneline -5        # View recent commits
git branch -vv              # Check branch tracking
git pull origin develop     # Update develop branch
```

## Advanced Usage

### Force Specific Version

```bash
/release --version=2.1.0
```

Skip SemVer calculation and use explicit version.

### WordPress.org Only

```bash
/release --org-only
```

Create WordPress.org package without GitHub release.

### Verify Previous Release

```bash
/release --verify --version=1.2.3
```

Audit previous release (check tag, notes, wordpress.org ready).

### Dry-Run Mode

```bash
/release --dry-run --scope=major
```

Read-only analysis with no changes. Always run before actual release.

## Sub-Skills

This skill consists of three coordinated sub-skills:

### github-release
Handles git tagging, GitHub Release publishing, and asset generation.

See: `sub-skills/github-release/SKILL.md`

### release-qa
Performs seven quality gates and produces risk assessment.

See: `sub-skills/release-qa/SKILL.md`

### release-handoff-generator
Creates post-release documentation and audit trail.

See: `sub-skills/release-handoff-generator/SKILL.md`

## Agents

### release-agent
Orchestrates the complete release workflow, coordinating all sub-skills.

See: `agents/release-agent.md`

## Prompts

### release.prompt.md
Step-by-step prompt for release orchestration, version management, and git operations.

### changelog.prompt.md
Guidelines for writing user-facing changelog entries and Keep a Changelog format.

## References

- [SKILL.md](./SKILL.md) — Full skill specification
- [Release Agent](./agents/release-agent.md) — Agent instructions
- [GitHub Release Skill](./sub-skills/github-release/SKILL.md)
- [Release QA Skill](./sub-skills/release-qa/SKILL.md)
- [Release Handoff Skill](./sub-skills/release-handoff-generator/SKILL.md)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [WordPress Plugin Guidelines](https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/)
- [WordPress Theme Guidelines](https://developer.wordpress.org/themes/releasing-your-theme/)

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section above
2. Review relevant skill documentation
3. Check GitHub issues in this repository
4. Contact LightSpeedWP release team

## License

These release utilities are part of the LightSpeedWP organization's internal toolkit.

---

**Version:** 1.0.0  
**Updated:** 2026-10-30  
**Maintained by:** LightSpeedWP Release Team