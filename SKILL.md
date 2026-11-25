---
name: release
description: Prepare and tag WordPress block plugin and theme releases with version management, changelog enforcement, and WordPress.org publishing
metadata:
  version: 1.0.0
  updated: 2026-10-30
  author: LightSpeedWP Release Team
  tags:
    - release
    - wordpress
    - versioning
    - changelog
    - plugins
    - themes
  tools:
    - Read
    - Edit
    - Write
    - Bash
    - Glob
    - Grep
  requires:
    - GitHub CLI (gh)
    - Git
    - Node.js (for version management scripts)
---

# WordPress Block Plugin & Theme Release Skill

Automates the complete release lifecycle for WordPress block plugins and block themes, including version management, changelog enforcement, GitHub tagging, and WordPress.org directory publishing preparation.

## Purpose

This skill orchestrates the release process for LightSpeedWP WordPress block plugins and themes by:

- **Validating** pre-release readiness (tests, lint, changelog, version alignment)
- **Managing** semantic versioning across plugin headers, theme metadata, and VERSION files
- **Enforcing** Keep a Changelog format and completeness
- **Creating** annotated git tags and publishing GitHub Releases
- **Preparing** WordPress.org directory submissions (SVN-ready packages)
- **Coordinating** post-release sync and handoff documentation

## Supported Project Types

### WordPress Block Plugins
- Main plugin file with `Plugin Name:` header in root directory
- `readme.txt` with `Stable tag:` matching version
- `VERSION` file (optional but recommended)
- `CHANGELOG.md` in Keep a Changelog format
- Plugin assets in `assets/` (icon, screenshots for wordpress.org)

### WordPress Block Themes
- `style.css` with block theme headers (`Theme Name:`, `Version:`)
- `theme.json` for block theme configuration
- `readme.txt` or standalone `CHANGELOG.md`
- `VERSION` file (optional)
- Theme screenshot at `screenshot.png` (1200×900px)

## Pre-Release Workflow

### Phase 1: Repository Health Check

The skill performs these validations before any release:

1. **Version Alignment**
   - `VERSION` file exists and contains valid SemVer
   - Plugin header `Version:` matches VERSION file
   - Theme `style.css` `Version:` matches VERSION file
   - `readme.txt` `Stable tag:` matches VERSION file

2. **Changelog Validation**
   - `CHANGELOG.md` exists and follows Keep a Changelog format
   - `## [Unreleased]` section is present and case-sensitive
   - Unreleased section contains at least one entry
   - Valid subsections: Added, Changed, Deprecated, Removed, Fixed, Security

3. **Repository Quality**
   - No uncommitted changes in working tree
   - All tests pass (via npm test or composer test)
   - Lint checks pass (ESLint, PHP CodeSniffer, or configured linter)
   - No dangerous git state (detached HEAD, conflicted merge)

4. **WordPress Compliance**
   - Plugin header contains required fields (Plugin Name, Description, Version, Author)
   - Theme headers include minimum WordPress and PHP versions
   - `readme.txt` follows WordPress.org format (Description, Installation, FAQ, Changelog)

5. **Documentation Audit**
   - README.md is current and links valid
   - Contributing guidelines present
   - License file present (LICENSE.md or LICENSE.txt)
   - API documentation up to date for public hooks/filters

### Phase 2: Release Execution

When validated and approved, the skill:

1. **Determines Release Scope**
   - Analyzes commit history since last tag
   - Suggests patch/minor/major based on commit types (fix, feat, BREAKING CHANGE)
   - Confirms scope with user

2. **Updates Version Files**
   - Bumps `VERSION` file using SemVer
   - Updates plugin header `Version:`
   - Updates theme `style.css` `Version:`
   - Updates `readme.txt` `Stable tag:`
   - Updates `package.json` and `composer.json` if present

3. **Manages Changelog**
   - Moves `## [Unreleased]` entries to `## [X.Y.Z] - YYYY-MM-DD`
   - Preserves section order (Added, Changed, Deprecated, Removed, Fixed, Security)
   - Creates fresh `## [Unreleased]` section
   - Validates changelog structure post-update

4. **Creates Release Artifacts**
   - Commits version and changelog changes to `release/vX.Y.Z` branch
   - Creates annotated git tag: `vX.Y.Z`
   - Generates release notes from changelog
   - Compiles contributor list from merged PRs
   - Creates WordPress.org-ready SVN package (tags directory structure)

5. **Publishes Release**
   - Pushes branch and tag to GitHub
   - Opens PR from `release/vX.Y.Z` to `main`
   - After merge: publishes GitHub Release with notes
   - Generates release assets (zip, WordPress.org SVN sync file)

6. **Post-Release Sync**
   - Verifies main/develop branches are in sync
   - Creates backport PR if fixes were applied to main
   - Prepares next-cycle starting point
   - Logs release in audit trail
   - Hands off to the changelog agent (`ls-wp-changelog`) once the release is evidenced complete
     (see [Changelog Agent Handoff](#changelog-agent-handoff))

## Scope Parameters

```bash
# Default: patch release
/release

# Specify scope
/release --scope=minor
/release --scope=major

# Dry run (read-only analysis)
/release --dry-run

# Force specific version
/release --version=2.1.0

# WordPress.org only (no GitHub release)
/release --org-only

# Verify post-release (audit trail)
/release --verify
```

## Files Modified During Release

### Plugin Projects
- `plugin.php` (or main plugin file) — version header
- `readme.txt` — Stable tag
- `CHANGELOG.md` — unreleased entries dated and versioned
- `VERSION` — version string
- `.github/workflows/release.yml` — reference workflows

### Theme Projects
- `style.css` — version in header
- `theme.json` — optional version field
- `readme.txt` or standalone `CHANGELOG.md`
- `VERSION` — version string

### Both Project Types
- Git tags: `vX.Y.Z` (annotated)
- Release branch: `release/vX.Y.Z` (created, merged to main)
- GitHub Release: published with changelog excerpt and contributor credits
- WordPress.org SVN sync file: ready for `svn cp trunk tags/X.Y.Z`

## Key Guardrails

- **Always** run with `--dry-run` first, especially for major releases
- **Always** confirm version bump, changelog, and release notes before proceeding
- **Never** release with failing tests or lint errors
- **Never** publish incomplete changelogs (empty Unreleased section)
- **Never** skip WordPress.org compliance checks for plugins/themes
- **Never** expose secrets in release notes or commit messages
- **Never** write shell (`.sh`) scripts; any new script this skill's agent writes is TypeScript
  (existing JavaScript scripts stay as they are; converting them is a separate decision)
- **Default** to read-only mode; require explicit confirmation for changes

## Integration with Sub-Skills

This skill coordinates three sub-skills:

1. **github-release** — GitHub tag, release, and asset publication
2. **release-qa** — pre-release quality gates and validation
3. **release-handoff-generator** — post-release documentation and audit trail

See each sub-skill's SKILL.md for detailed specs.

## Post-Release Checklist

After release is published:

- [ ] GitHub Release page displays correct version, notes, and assets
- [ ] Git tag is annotated and pushed: `git show vX.Y.Z`
- [ ] Changelog is dated and versioned in main branch
- [ ] VERSION file and all headers match released version
- [ ] WordPress.org SVN sync file ready for submission
- [ ] Contributor list in release notes is accurate
- [ ] Documentation links in release notes are valid
- [ ] Release is logged in audit trail with timestamp
- [ ] Develop branch is synced with main (no drift)
- [ ] Next-cycle development can begin on develop branch
- [ ] Changelog agent handoff sent with the four inputs below (only once the release is evidenced complete)

## Changelog Agent Handoff

When a release is evidenced complete, the release agent hands off to the changelog agent (`ls-wp-changelog`).
Treat a release as complete only when the release PR is merged, the tag is pushed and the GitHub Release is
published. Do not infer completion.

The handoff carries four inputs:

| Input | What it holds |
| ----- | ------------- |
| `version` | The released version, `X.Y.Z` |
| `releaseIssue` | The issue that tracked the release (issue ID or URL) |
| `prList` | The pull requests included in the release (links) |
| `changelogPath` | The changelog file that holds the `## [X.Y.Z]` section |

Rules:

- If an input is not known, say it is unknown and why. Never invent an issue, a PR or a path.
- The handoff is a request for the changelog agent to pick up the released entries. It does not publish, tag or
  release anything.
- What the changelog agent does with the handoff is defined in the `ls-wp-changelog` repository, not here.

The handoff format is described in [release-handoff-generator](./sub-skills/release-handoff-generator/SKILL.md).

## References

- [Release workflow](./agents/release-agent.md#release-workflow) — step-by-step workflow
- [WordPress.org compliance](./agents/release-agent.md#wordpressorg-compliance) — WordPress-specific checklists
- [Release scope determination](./prompts/release.prompt.md#release-scope-determination) — patch, minor and major rules
- [changelog-management](./sub-skills/changelog-management/SKILL.md) — changelog format and validation
- [WordPress Plugin Guidelines](https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/) — wordpress.org plugin requirements
- [WordPress Theme Guidelines](https://developer.wordpress.org/themes/releasing-your-theme/) — wordpress.org theme requirements

### Documents that are referenced but not in this repository

These files were linked from this page but do not exist, so the links were removed:
`docs/RELEASE_PROCESS.md`, `docs/RELEASE_WORDPRESS.md`, `docs/VERSIONING.md`, `docs/CHANGELOG_RULES.md`,
`docs/RELEASE_RUNBOOK_PATCH.md`, `docs/RELEASE_RUNBOOK_MINOR.md` and `docs/RELEASE_RUNBOOK_MAJOR.md`.

The first four are covered by the existing sections linked above. No per-scope runbooks exist yet. Per-scope
requirements are summarised under [Scope Rules](./agents/release-agent.md#scope-rules). Whether that is enough,
or whether runbooks should be written, is an open decision.

## See Also

- [[release-qa]] — quality gates and validation
- [[github-release]] — tag and release publication
- [[release-handoff-generator]] — post-release documentation
